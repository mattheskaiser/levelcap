import { useEffect, useRef, useState } from 'react'
import type { TextTrackItem, Track, TrackItem, VideoTrackItem } from '@shared/types'
import { formatCaptionTime, formatClipTime, junctionKey, waveformPath } from '../utils/format'
import { toMediaUrl } from '../utils/media'

const DEFAULT_PIXELS_PER_SECOND = 60
const MIN_PIXELS_PER_SECOND = 15
const MAX_PIXELS_PER_SECOND = 300
const ZOOM_FACTOR = 1.4
const MIN_CAPTION_DURATION_SEC = 0.2
const MIN_CLIP_TRIM_SEC = 0.3
const FRAME_WIDTH_PX = 64
const MAX_FRAMES_PER_CLIP = 20
const VIDEO_TRACK_HEIGHT_PX = 150
const TEXT_TRACK_HEIGHT_PX = 36
const DRAG_MOVE_THRESHOLD_PX = 3
// Matches the hook's FADE_ADJACENCY_EPSILON_SEC — how close two same-track video items'
// edges must be to count as "touching" and therefore fade-eligible/marker-worthy.
const FADE_ADJACENCY_EPSILON_SEC = 0.05
// "Nice" ruler intervals to pick from as you zoom, so labeled ticks stay readable
// instead of a fixed 5s spacing regardless of how zoomed in you are.
const NICE_TICK_INTERVALS_SEC = [
  0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600
]
const MIN_MAJOR_TICK_SPACING_PX = 70

const LARGEST_TICK_INTERVAL_SEC =
  NICE_TICK_INTERVALS_SEC[NICE_TICK_INTERVALS_SEC.length - 1] ?? 3600

function pickMajorTickIntervalSec(pixelsPerSecond: number): number {
  for (const interval of NICE_TICK_INTERVALS_SEC) {
    if (interval * pixelsPerSecond >= MIN_MAJOR_TICK_SPACING_PX) return interval
  }
  return LARGEST_TICK_INTERVAL_SEC
}

function formatTickLabel(sec: number, majorIntervalSec: number): string {
  return majorIntervalSec < 1 ? formatCaptionTime(sec) : formatClipTime(sec)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function itemDuration(item: TrackItem): number {
  return item.kind === 'video' ? item.trimEndSec - item.trimStartSec : item.endSec - item.startSec
}

function trackHeightPx(track: Track): number {
  return track.items.some((i) => i.kind === 'video') ? VIDEO_TRACK_HEIGHT_PX : TEXT_TRACK_HEIGHT_PX
}

function resolveTrackIdAtPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  const match = el instanceof Element ? el.closest<HTMLElement>('[data-track-id]') : null
  return match?.dataset.trackId ?? null
}

interface TrimPreview {
  sourcePath: string
  sourceTimeSec: number
}

interface TimelinePanelProps {
  heightPx: number
  tracks: Track[]
  selectedClipIds: string[]
  activeClipId: string | null
  fadeJunctions: string[]
  normalizedIds: string[]
  clipCountLabel: string
  totalDurationLabel: string
  currentSec: number
  totalDurationSec: number
  onScrub: (pct: number) => void
  onSelectClip: (id: string, additive: boolean) => void
  onResizeVideoItem: (id: string, trimEndSec: number) => void
  onTrimPreview: (preview: TrimPreview | null) => void
  onMoveCaption: (id: string, startSec: number, endSec: number) => void
  onMoveItemWithinTrack: (itemId: string, desiredStartSec: number) => void
  onMoveItemToTrack: (itemId: string, targetTrackId: string, desiredStartSec: number) => void
  onAddTrack: () => void
  onRemoveTrack: (trackId: string) => void
  onReorderTracks: (draggedTrackId: string, targetTrackId: string) => void
  onDropBinItem: (trackId: string, startSec: number) => void
  onTimelineDrop: () => void
}

type CaptionResizeMode = 'resize-start' | 'resize-end'

interface CaptionResizeDragState {
  id: string
  mode: CaptionResizeMode
  startClientX: number
  originStart: number
  originEnd: number
  previewStart: number
  previewEnd: number
}

interface ClipTrimDragState {
  id: string
  sourcePath: string
  startClientX: number
  originEnd: number
  minEndSec: number
  durationSec: number
  previewEnd: number
}

interface ItemMoveDragState {
  itemId: string
  startClientX: number
  originStartSec: number
  originTrackId: string
  durationSec: number
  previewStartSec: number
  previewTrackId: string
}

interface TrackReorderDragState {
  trackId: string
}

interface FilmstripFrame {
  key: number
  timeSec: number
  leftPx: number
}

/** Frames sit on a fixed grid anchored to the source video's own time axis (index * interval),
 *  not to the clip's current trim range — so trimming the end never re-samples or rescales
 *  existing tiles, it only reveals/hides tiles at the edge, like cropping a physical filmstrip. */
function computeFilmstripFrames(
  trimStartSec: number,
  trimEndSec: number,
  durationSec: number,
  pixelsPerSecond: number
): FilmstripFrame[] {
  const intervalSec = FRAME_WIDTH_PX / pixelsPerSecond
  const startIdx = Math.floor(trimStartSec / intervalSec)
  const endIdx = Math.min(
    Math.floor(trimEndSec / intervalSec),
    Math.floor(durationSec / intervalSec)
  )
  const count = Math.min(Math.max(0, endIdx - startIdx + 1), MAX_FRAMES_PER_CLIP)
  return Array.from({ length: count }, (_, i) => {
    const idx = startIdx + i
    return {
      key: idx,
      timeSec: Math.min(idx * intervalSec, durationSec),
      leftPx: (idx * intervalSec - trimStartSec) * pixelsPerSecond
    }
  })
}

interface ClipFrameProps {
  sourcePath: string
  timeSec: number
  leftPx: number
}

/** One filmstrip tile. Its time is fixed for its lifetime (anchored by key to a stable grid
 *  index), so it's seeked once on load and never needs to reload or re-seek afterward. */
function ClipFrame({ sourcePath, timeSec, leftPx }: ClipFrameProps): React.JSX.Element {
  function handleLoadedMetadata(event: React.SyntheticEvent<HTMLVideoElement>): void {
    event.currentTarget.currentTime = timeSec
  }

  return (
    <div className="timeline-clip__frame" style={{ left: leftPx }}>
      <video
        src={toMediaUrl(sourcePath)}
        muted
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
      />
    </div>
  )
}

function computeJunctionMarkers(
  track: Track,
  fadeJunctions: string[]
): { atSec: number; hasFade: boolean; key: string }[] {
  const videoItems = track.items
    .filter((i): i is VideoTrackItem => i.kind === 'video')
    .slice()
    .sort((a, b) => a.startSec - b.startSec)
  const markers: { atSec: number; hasFade: boolean; key: string }[] = []
  for (let i = 0; i < videoItems.length - 1; i++) {
    const a = videoItems[i]
    const b = videoItems[i + 1]
    if (!a || !b) continue
    const aEnd = a.startSec + (a.trimEndSec - a.trimStartSec)
    if (Math.abs(b.startSec - aEnd) > FADE_ADJACENCY_EPSILON_SEC) continue
    const key = junctionKey(a.id, b.id)
    markers.push({ atSec: aEnd, hasFade: fadeJunctions.includes(key), key })
  }
  return markers
}

function TimelinePanel({
  heightPx,
  tracks,
  selectedClipIds,
  activeClipId,
  fadeJunctions,
  normalizedIds,
  clipCountLabel,
  totalDurationLabel,
  currentSec,
  totalDurationSec,
  onScrub,
  onSelectClip,
  onResizeVideoItem,
  onTrimPreview,
  onMoveCaption,
  onMoveItemWithinTrack,
  onMoveItemToTrack,
  onAddTrack,
  onRemoveTrack,
  onReorderTracks,
  onDropBinItem,
  onTimelineDrop
}: TimelinePanelProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND)
  const [captionResizeDrag, setCaptionResizeDrag] = useState<CaptionResizeDragState | null>(null)
  const [clipTrimDrag, setClipTrimDrag] = useState<ClipTrimDragState | null>(null)
  const [itemMoveDrag, setItemMoveDrag] = useState<ItemMoveDragState | null>(null)
  const [trackReorderDrag, setTrackReorderDrag] = useState<TrackReorderDragState | null>(null)

  const contentWidthPx = Math.max(totalDurationSec * pixelsPerSecond, 1)
  const playheadLeftPx = currentSec * pixelsPerSecond

  const majorIntervalSec = pickMajorTickIntervalSec(pixelsPerSecond)
  const majorIntervalIdx = NICE_TICK_INTERVALS_SEC.indexOf(majorIntervalSec)
  const minorIntervalSec =
    majorIntervalIdx > 0
      ? (NICE_TICK_INTERVALS_SEC[majorIntervalIdx - 1] ?? majorIntervalSec / 2)
      : majorIntervalSec / 2

  const majorTickCount = Math.floor(totalDurationSec / majorIntervalSec)
  const majorTicks = Array.from({ length: majorTickCount + 1 }, (_, i) => i * majorIntervalSec)

  const minorTickCount = Math.floor(totalDurationSec / minorIntervalSec)
  const minorTicks = Array.from({ length: minorTickCount + 1 }, (_, i) => i * minorIntervalSec)

  // Rendered topmost-first: the last track in the array is both the frontmost layer for
  // playback (see locateActiveVideoItem) and the visually topmost row here.
  const displayTracks = [...tracks].reverse()

  function zoomIn(): void {
    setPixelsPerSecond((prev) =>
      clamp(prev * ZOOM_FACTOR, MIN_PIXELS_PER_SECOND, MAX_PIXELS_PER_SECOND)
    )
  }

  function zoomOut(): void {
    setPixelsPerSecond((prev) =>
      clamp(prev / ZOOM_FACTOR, MIN_PIXELS_PER_SECOND, MAX_PIXELS_PER_SECOND)
    )
  }

  // Ctrl+=/Ctrl+-/Ctrl+0 zoom the timeline specifically, instead of Electron's default
  // whole-window zoom (which we've disabled the menu accelerators for in the main process).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        setPixelsPerSecond(DEFAULT_PIXELS_PER_SECOND)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function handleWheelZoom(event: React.WheelEvent<HTMLDivElement>): void {
    if (!event.ctrlKey) return
    event.preventDefault()
    setPixelsPerSecond((prev) =>
      clamp(
        prev * (event.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR),
        MIN_PIXELS_PER_SECOND,
        MAX_PIXELS_PER_SECOND
      )
    )
  }

  function seekFromClientX(clientX: number): void {
    const content = contentRef.current
    if (!content || totalDurationSec <= 0) return
    const rect = content.getBoundingClientRect()
    const sec = clamp((clientX - rect.left) / pixelsPerSecond, 0, totalDurationSec)
    onScrub(sec / totalDurationSec)
  }

  function handleScrubPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    seekFromClientX(event.clientX)
  }

  function handleScrubPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.buttons !== 1) return
    seekFromClientX(event.clientX)
  }

  function handleCaptionResizePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    cap: TextTrackItem,
    mode: CaptionResizeMode
  ): void {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCaptionResizeDrag({
      id: cap.id,
      mode,
      startClientX: event.clientX,
      originStart: cap.startSec,
      originEnd: cap.endSec,
      previewStart: cap.startSec,
      previewEnd: cap.endSec
    })
  }

  function handleCaptionResizePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    setCaptionResizeDrag((prev) => {
      if (!prev) return prev
      const deltaSec = (event.clientX - prev.startClientX) / pixelsPerSecond
      if (prev.mode === 'resize-start') {
        const previewStart = clamp(
          prev.originStart + deltaSec,
          0,
          prev.originEnd - MIN_CAPTION_DURATION_SEC
        )
        return { ...prev, previewStart, previewEnd: prev.originEnd }
      }
      const previewEnd = clamp(
        prev.originEnd + deltaSec,
        prev.originStart + MIN_CAPTION_DURATION_SEC,
        totalDurationSec
      )
      return { ...prev, previewStart: prev.originStart, previewEnd }
    })
  }

  function handleCaptionResizePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    if (!captionResizeDrag) return
    onMoveCaption(
      captionResizeDrag.id,
      captionResizeDrag.previewStart,
      captionResizeDrag.previewEnd
    )
    setCaptionResizeDrag(null)
  }

  function handleClipTrimPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    item: VideoTrackItem
  ): void {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setClipTrimDrag({
      id: item.id,
      sourcePath: item.sourcePath,
      startClientX: event.clientX,
      originEnd: item.trimEndSec,
      minEndSec: item.trimStartSec + MIN_CLIP_TRIM_SEC,
      durationSec: item.durationSec,
      previewEnd: item.trimEndSec
    })
    onTrimPreview({ sourcePath: item.sourcePath, sourceTimeSec: item.trimEndSec })
  }

  function handleClipTrimPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    if (!clipTrimDrag) return
    const deltaSec = (event.clientX - clipTrimDrag.startClientX) / pixelsPerSecond
    const previewEnd = clamp(
      clipTrimDrag.originEnd + deltaSec,
      clipTrimDrag.minEndSec,
      clipTrimDrag.durationSec
    )
    setClipTrimDrag((prev) => (prev ? { ...prev, previewEnd } : prev))
    onTrimPreview({ sourcePath: clipTrimDrag.sourcePath, sourceTimeSec: previewEnd })
  }

  function handleClipTrimPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    onTrimPreview(null)
    if (!clipTrimDrag) return
    onResizeVideoItem(clipTrimDrag.id, clipTrimDrag.previewEnd)
    setClipTrimDrag(null)
  }

  function handleItemMovePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    item: TrackItem,
    trackId: string
  ): void {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setItemMoveDrag({
      itemId: item.id,
      startClientX: event.clientX,
      originStartSec: item.startSec,
      originTrackId: trackId,
      durationSec: itemDuration(item),
      previewStartSec: item.startSec,
      previewTrackId: trackId
    })
  }

  function handleItemMovePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    if (!itemMoveDrag) return
    const deltaSec = (event.clientX - itemMoveDrag.startClientX) / pixelsPerSecond
    const previewStartSec = Math.max(0, itemMoveDrag.originStartSec + deltaSec)
    const hoveredTrackId = resolveTrackIdAtPoint(event.clientX, event.clientY)
    setItemMoveDrag((prev) =>
      prev
        ? { ...prev, previewStartSec, previewTrackId: hoveredTrackId ?? prev.previewTrackId }
        : prev
    )
  }

  function handleItemMovePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    if (!itemMoveDrag) return
    const movedPx = Math.abs(event.clientX - itemMoveDrag.startClientX)
    const trackChanged = itemMoveDrag.previewTrackId !== itemMoveDrag.originTrackId
    if (movedPx >= DRAG_MOVE_THRESHOLD_PX || trackChanged) {
      if (trackChanged) {
        onMoveItemToTrack(
          itemMoveDrag.itemId,
          itemMoveDrag.previewTrackId,
          itemMoveDrag.previewStartSec
        )
      } else {
        onMoveItemWithinTrack(itemMoveDrag.itemId, itemMoveDrag.previewStartSec)
      }
    }
    setItemMoveDrag(null)
  }

  function handleTrackHeaderPointerDown(
    event: React.PointerEvent<HTMLSpanElement>,
    trackId: string
  ): void {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setTrackReorderDrag({ trackId })
  }

  function handleTrackHeaderPointerUp(event: React.PointerEvent<HTMLSpanElement>): void {
    event.stopPropagation()
    if (!trackReorderDrag) return
    const targetTrackId = resolveTrackIdAtPoint(event.clientX, event.clientY)
    if (targetTrackId && targetTrackId !== trackReorderDrag.trackId) {
      onReorderTracks(trackReorderDrag.trackId, targetTrackId)
    }
    setTrackReorderDrag(null)
  }

  function handleTrackDrop(event: React.DragEvent<HTMLDivElement>, trackId: string): void {
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const startSec = Math.max(0, (event.clientX - rect.left) / pixelsPerSecond)
    onDropBinItem(trackId, startSec)
  }

  function renderVideoItem(item: VideoTrackItem, track: Track): React.JSX.Element {
    const isSelected = selectedClipIds.includes(item.id)
    const isActive = activeClipId === item.id
    const trim = clipTrimDrag?.id === item.id ? clipTrimDrag : null
    const move = itemMoveDrag?.itemId === item.id ? itemMoveDrag : null
    const trimEndSec = trim ? trim.previewEnd : item.trimEndSec
    const startSec = move ? move.previewStartSec : item.startSec
    const widthPx = (trimEndSec - item.trimStartSec) * pixelsPerSecond
    const frames = computeFilmstripFrames(
      item.trimStartSec,
      trimEndSec,
      item.durationSec,
      pixelsPerSecond
    )

    return (
      <div
        key={item.id}
        className={`timeline-clip${isSelected ? ' timeline-clip--selected' : ''}${
          isActive ? ' timeline-clip--active' : ''
        }${trim ? ' timeline-clip--trimming' : ''}${move ? ' timeline-clip--moving' : ''}`}
        onClick={(e) => onSelectClip(item.id, e.ctrlKey || e.metaKey)}
        onPointerDown={(e) => handleItemMovePointerDown(e, item, track.id)}
        onPointerMove={handleItemMovePointerMove}
        onPointerUp={handleItemMovePointerUp}
        style={{ left: startSec * pixelsPerSecond, width: widthPx }}
      >
        <div className="timeline-clip__filmstrip">
          {frames.map((f) => (
            <ClipFrame
              key={f.key}
              sourcePath={item.sourcePath}
              timeSec={f.timeSec}
              leftPx={f.leftPx}
            />
          ))}
        </div>
        <div className="timeline-clip__waveform">
          <svg width="100%" height="100%" viewBox="0 0 140 34" preserveAspectRatio="none">
            <path
              d={waveformPath(item.id)}
              stroke="rgba(148, 226, 189, 0.85)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        </div>
        {normalizedIds.includes(item.id) && (
          <span className="timeline-clip__norm-badge" title="Normalized">
            ✓
          </span>
        )}
        <span className="timeline-clip__duration">
          {formatClipTime(trimEndSec - item.trimStartSec)}
        </span>
        <div
          className="timeline-clip__trim-handle timeline-clip__trim-handle--end"
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => handleClipTrimPointerDown(e, item)}
          onPointerMove={handleClipTrimPointerMove}
          onPointerUp={handleClipTrimPointerUp}
        />
      </div>
    )
  }

  function renderTextItem(item: TextTrackItem, track: Track): React.JSX.Element {
    const resize = captionResizeDrag?.id === item.id ? captionResizeDrag : null
    const move = itemMoveDrag?.itemId === item.id ? itemMoveDrag : null
    const startSec = resize ? resize.previewStart : move ? move.previewStartSec : item.startSec
    const endSec = resize ? resize.previewEnd : startSec + itemDuration(item)
    const left = startSec * pixelsPerSecond
    const width = Math.max(4, (endSec - startSec) * pixelsPerSecond)

    return (
      <div
        key={item.id}
        className={`timeline-caption${resize || move ? ' timeline-caption--dragging' : ''}`}
        style={{ left, width }}
        onPointerDown={(e) => handleItemMovePointerDown(e, item, track.id)}
        onPointerMove={handleItemMovePointerMove}
        onPointerUp={handleItemMovePointerUp}
      >
        <div
          className="timeline-caption__handle timeline-caption__handle--start"
          onPointerDown={(e) => handleCaptionResizePointerDown(e, item, 'resize-start')}
          onPointerMove={handleCaptionResizePointerMove}
          onPointerUp={handleCaptionResizePointerUp}
        />
        <span className="timeline-caption__text">{item.text}</span>
        <div
          className="timeline-caption__handle timeline-caption__handle--end"
          onPointerDown={(e) => handleCaptionResizePointerDown(e, item, 'resize-end')}
          onPointerMove={handleCaptionResizePointerMove}
          onPointerUp={handleCaptionResizePointerUp}
        />
      </div>
    )
  }

  const hasAnyTracks = tracks.length > 0

  return (
    <div className="timeline" style={{ height: heightPx }}>
      <div className="timeline__header">
        <span className="panel-label">Timeline</span>
        <span className="timeline__summary">
          {clipCountLabel} · {totalDurationLabel} total
        </span>
        <div className="timeline__zoom">
          <button className="icon-btn" onClick={zoomOut} title="Zoom out">
            −
          </button>
          <button className="icon-btn" onClick={zoomIn} title="Zoom in">
            +
          </button>
        </div>
      </div>

      <div className="timeline__body">
        <div className="timeline__track-headers">
          <div className="timeline__track-header-spacer" />
          {displayTracks.map((track) => (
            <div
              key={track.id}
              className="timeline__track-header"
              data-track-id={track.id}
              style={{ height: trackHeightPx(track) }}
            >
              <span
                className="timeline__track-header-handle"
                onPointerDown={(e) => handleTrackHeaderPointerDown(e, track.id)}
                onPointerUp={handleTrackHeaderPointerUp}
                title="Drag to reorder"
              >
                ⠿
              </span>
              <span className="timeline__track-header-name">{track.name}</span>
              <button
                className="icon-btn icon-btn--small timeline__track-header-remove"
                onClick={() => onRemoveTrack(track.id)}
                title="Delete track"
              >
                ×
              </button>
            </div>
          ))}
          <button className="timeline__add-track-btn" onClick={onAddTrack}>
            + Add Track
          </button>
        </div>

        <div
          className="timeline__scrubber-viewport"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onTimelineDrop}
          onWheel={handleWheelZoom}
        >
          {!hasAnyTracks ? (
            <p className="timeline__empty">Drag a clip here from Media, or use the + button.</p>
          ) : (
            <div
              className="timeline__scrubber-content"
              ref={contentRef}
              style={{ width: contentWidthPx }}
            >
              <div
                className="timeline__ruler"
                onPointerDown={handleScrubPointerDown}
                onPointerMove={handleScrubPointerMove}
              >
                {minorTicks.map((sec) => (
                  <div
                    key={`minor-${sec}`}
                    className="timeline__tick timeline__tick--minor"
                    style={{ left: sec * pixelsPerSecond }}
                  />
                ))}
                {majorTicks.map((sec) => (
                  <div
                    key={`major-${sec}`}
                    className="timeline__tick"
                    style={{ left: sec * pixelsPerSecond }}
                  >
                    <span className="timeline__tick-label">
                      {formatTickLabel(sec, majorIntervalSec)}
                    </span>
                  </div>
                ))}
              </div>

              {displayTracks.map((track) => {
                const isDropTarget =
                  itemMoveDrag !== null &&
                  itemMoveDrag.previewTrackId === track.id &&
                  itemMoveDrag.originTrackId !== track.id
                const markers = computeJunctionMarkers(track, fadeJunctions)
                return (
                  <div
                    key={track.id}
                    className={`timeline__track-row${
                      isDropTarget ? ' timeline__track-row--drop-target' : ''
                    }`}
                    data-track-id={track.id}
                    style={{ height: trackHeightPx(track) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleTrackDrop(e, track.id)}
                  >
                    {track.items.map((item) =>
                      item.kind === 'video'
                        ? renderVideoItem(item, track)
                        : renderTextItem(item, track)
                    )}
                    {markers.map((m) => (
                      <div
                        key={m.key}
                        className={`timeline__junction-marker${
                          m.hasFade ? ' timeline__junction-marker--active' : ''
                        }`}
                        style={{ left: m.atSec * pixelsPerSecond }}
                      >
                        {m.hasFade ? '◆' : '·'}
                      </div>
                    ))}
                  </div>
                )
              })}

              <div className="timeline__playhead" style={{ left: playheadLeftPx }}>
                <div
                  className="timeline__playhead-flag"
                  onPointerDown={handleScrubPointerDown}
                  onPointerMove={handleScrubPointerMove}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TimelinePanel
