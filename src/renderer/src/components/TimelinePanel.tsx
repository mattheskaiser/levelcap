import { useEffect, useRef, useState } from 'react'
import type { CaptionSegment } from '@shared/types'
import type { DisplayClip } from '../types'
import { formatClipTime, junctionKey } from '../utils/format'
import { seekToFirstFrame, toMediaUrl } from '../utils/media'

const DEFAULT_PIXELS_PER_SECOND = 60
const MIN_PIXELS_PER_SECOND = 15
const MAX_PIXELS_PER_SECOND = 300
const ZOOM_FACTOR = 1.4
const TICK_INTERVAL_SEC = 5
const MIN_CAPTION_DURATION_SEC = 0.2
const MIN_CLIP_TRIM_SEC = 0.3

interface SelectedMusicTrack {
  name: string
  durationSec: number
}

interface TrimPreview {
  sourcePath: string
  sourceTimeSec: number
}

interface TimelinePanelProps {
  heightPx: number
  clips: DisplayClip[]
  selectedClipIds: string[]
  activeClipId: string | null
  draggingClipId: string | null
  dragOverClipId: string | null
  fadeJunctions: string[]
  normalizedIds: string[]
  clipCountLabel: string
  totalDurationLabel: string
  currentSec: number
  totalDurationSec: number
  onScrub: (pct: number) => void
  onSelectClip: (id: string, additive: boolean) => void
  onClipDragStart: (id: string) => void
  onClipDragOver: (id: string) => void
  onClipDrop: (id: string) => void
  onClipDragEnd: () => void
  onTimelineDrop: () => void
  onResizeClip: (id: string, trimEndSec: number) => void
  onTrimPreview: (preview: TrimPreview | null) => void
  captions: CaptionSegment[]
  onMoveCaption: (id: string, startSec: number, endSec: number) => void
  selectedMusicTrack: SelectedMusicTrack | null
}

type CaptionDragMode = 'move' | 'resize-start' | 'resize-end'

interface CaptionDragState {
  id: string
  mode: CaptionDragMode
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function TimelinePanel({
  heightPx,
  clips,
  selectedClipIds,
  activeClipId,
  draggingClipId,
  dragOverClipId,
  fadeJunctions,
  normalizedIds,
  clipCountLabel,
  totalDurationLabel,
  currentSec,
  totalDurationSec,
  onScrub,
  onSelectClip,
  onClipDragStart,
  onClipDragOver,
  onClipDrop,
  onClipDragEnd,
  onTimelineDrop,
  onResizeClip,
  onTrimPreview,
  captions,
  onMoveCaption,
  selectedMusicTrack
}: TimelinePanelProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_PIXELS_PER_SECOND)
  const [captionDrag, setCaptionDrag] = useState<CaptionDragState | null>(null)
  const [clipTrimDrag, setClipTrimDrag] = useState<ClipTrimDragState | null>(null)
  // Native HTML5 drag (used for reordering clips) is decided by walking up from the
  // pointerdown target to the nearest draggable ancestor — it ignores draggable={false}
  // on the trim handle itself and still initiates a reorder-drag on the parent clip.
  // This ref lets the clip's onDragStart veto that whenever a trim gesture is live.
  const isTrimmingRef = useRef(false)

  const contentWidthPx = Math.max(totalDurationSec * pixelsPerSecond, 1)
  const playheadLeftPx = currentSec * pixelsPerSecond

  const tickCount = Math.floor(totalDurationSec / TICK_INTERVAL_SEC)
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * TICK_INTERVAL_SEC)

  // Boundary markers are absolutely positioned on the exact time-based pixel of each
  // clip junction, rather than taking up their own flex slot, so clip widths stay
  // exactly proportional to duration and the playhead math never drifts.
  const boundaries = clips
    .slice(0, -1)
    .reduce<{ atSec: number; hasFade: boolean }[]>((acc, clip, i) => {
      const priorEnd = acc[acc.length - 1]?.atSec ?? 0
      const atSec = priorEnd + (clip.trimEndSec - clip.trimStartSec)
      const next = clips[i + 1]
      const key = next ? junctionKey(clip.id, next.id) : null
      return [...acc, { atSec, hasFade: !!key && fadeJunctions.includes(key) }]
    }, [])

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

  function handleCaptionPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    cap: CaptionSegment,
    mode: CaptionDragMode
  ): void {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setCaptionDrag({
      id: cap.id,
      mode,
      startClientX: event.clientX,
      originStart: cap.startSec,
      originEnd: cap.endSec,
      previewStart: cap.startSec,
      previewEnd: cap.endSec
    })
  }

  function handleCaptionPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    setCaptionDrag((prev) => {
      if (!prev) return prev
      const deltaSec = (event.clientX - prev.startClientX) / pixelsPerSecond
      if (prev.mode === 'move') {
        const duration = prev.originEnd - prev.originStart
        const previewStart = clamp(
          prev.originStart + deltaSec,
          0,
          Math.max(0, totalDurationSec - duration)
        )
        return { ...prev, previewStart, previewEnd: previewStart + duration }
      }
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

  function handleCaptionPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    event.stopPropagation()
    if (!captionDrag) return
    onMoveCaption(captionDrag.id, captionDrag.previewStart, captionDrag.previewEnd)
    setCaptionDrag(null)
  }

  function handleClipTrimPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    clip: DisplayClip
  ): void {
    event.stopPropagation()
    isTrimmingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    setClipTrimDrag({
      id: clip.id,
      sourcePath: clip.sourcePath,
      startClientX: event.clientX,
      originEnd: clip.trimEndSec,
      minEndSec: clip.trimStartSec + MIN_CLIP_TRIM_SEC,
      durationSec: clip.durationSec,
      previewEnd: clip.trimEndSec
    })
    onTrimPreview({ sourcePath: clip.sourcePath, sourceTimeSec: clip.trimEndSec })
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
    isTrimmingRef.current = false
    onTrimPreview(null)
    if (!clipTrimDrag) return
    onResizeClip(clipTrimDrag.id, clipTrimDrag.previewEnd)
    setClipTrimDrag(null)
  }

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
          <div className="timeline__track-header">Text</div>
          <div className="timeline__track-header">Video</div>
          <div className="timeline__track-header">Audio</div>
        </div>

        <div
          className="timeline__scrubber-viewport"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onTimelineDrop}
          onWheel={handleWheelZoom}
        >
          {clips.length === 0 ? (
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
                {ticks.map((sec) => (
                  <div key={sec} className="timeline__tick" style={{ left: sec * pixelsPerSecond }}>
                    <span className="timeline__tick-label">{formatClipTime(sec)}</span>
                  </div>
                ))}
              </div>

              <div className="timeline__captions-row">
                {captions.map((cap) => {
                  const drag = captionDrag?.id === cap.id ? captionDrag : null
                  const startSec = drag ? drag.previewStart : cap.startSec
                  const endSec = drag ? drag.previewEnd : cap.endSec
                  const left = startSec * pixelsPerSecond
                  const width = Math.max(4, (endSec - startSec) * pixelsPerSecond)
                  return (
                    <div
                      key={cap.id}
                      className={`timeline-caption${drag ? ' timeline-caption--dragging' : ''}`}
                      style={{ left, width }}
                      onPointerDown={(e) => handleCaptionPointerDown(e, cap, 'move')}
                      onPointerMove={handleCaptionPointerMove}
                      onPointerUp={handleCaptionPointerUp}
                    >
                      <div
                        className="timeline-caption__handle timeline-caption__handle--start"
                        onPointerDown={(e) => handleCaptionPointerDown(e, cap, 'resize-start')}
                        onPointerMove={handleCaptionPointerMove}
                        onPointerUp={handleCaptionPointerUp}
                      />
                      <span className="timeline-caption__text">{cap.text}</span>
                      <div
                        className="timeline-caption__handle timeline-caption__handle--end"
                        onPointerDown={(e) => handleCaptionPointerDown(e, cap, 'resize-end')}
                        onPointerMove={handleCaptionPointerMove}
                        onPointerUp={handleCaptionPointerUp}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="timeline__clips-row">
                {clips.map((clip, i) => {
                  const isDragging = draggingClipId === clip.id
                  const isDragOver = dragOverClipId === clip.id && draggingClipId !== clip.id
                  const isSelected = selectedClipIds.includes(clip.id)
                  const isActive = activeClipId === clip.id
                  const trim = clipTrimDrag?.id === clip.id ? clipTrimDrag : null
                  const trimEndSec = trim ? trim.previewEnd : clip.trimEndSec
                  const widthPx = (trimEndSec - clip.trimStartSec) * pixelsPerSecond

                  return (
                    <div
                      key={clip.id}
                      className={`timeline-clip${isSelected ? ' timeline-clip--selected' : ''}${
                        isActive ? ' timeline-clip--active' : ''
                      }${isDragOver ? ' timeline-clip--drag-over' : ''}${
                        trim ? ' timeline-clip--trimming' : ''
                      }`}
                      draggable
                      onClick={(e) => onSelectClip(clip.id, e.ctrlKey || e.metaKey)}
                      onDragStart={(e) => {
                        if (isTrimmingRef.current) {
                          e.preventDefault()
                          return
                        }
                        e.stopPropagation()
                        onClipDragStart(clip.id)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onClipDragOver(clip.id)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onClipDrop(clip.id)
                      }}
                      onDragEnd={onClipDragEnd}
                      style={{ width: widthPx, opacity: isDragging ? 0.35 : 1 }}
                    >
                      <div className="timeline-clip__top">
                        <span className="timeline-clip__order">CLIP {i + 1}</span>
                        {normalizedIds.includes(clip.id) && (
                          <span className="timeline-clip__norm-badge">NORM ✓</span>
                        )}
                      </div>
                      <div className="timeline-clip__thumb">
                        <video
                          src={toMediaUrl(clip.sourcePath)}
                          muted
                          preload="metadata"
                          onLoadedMetadata={seekToFirstFrame}
                        />
                      </div>
                      <div>
                        <div className="timeline-clip__name">{clip.name}</div>
                        <div className="timeline-clip__duration">
                          {formatClipTime(trimEndSec - clip.trimStartSec)}
                        </div>
                      </div>
                      <div
                        className="timeline-clip__trim-handle timeline-clip__trim-handle--end"
                        draggable={false}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => handleClipTrimPointerDown(e, clip)}
                        onPointerMove={handleClipTrimPointerMove}
                        onPointerUp={handleClipTrimPointerUp}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="timeline__audio-row">
                {selectedMusicTrack ? (
                  <div
                    className="timeline__audio-block"
                    style={{
                      width:
                        Math.min(selectedMusicTrack.durationSec, totalDurationSec) * pixelsPerSecond
                    }}
                  >
                    <span className="timeline__audio-block-name">{selectedMusicTrack.name}</span>
                  </div>
                ) : (
                  <span className="timeline__audio-empty">
                    No music selected — pick one in the Audio tab
                  </span>
                )}
              </div>

              {boundaries.map((b) => (
                <div
                  key={b.atSec}
                  className={`timeline__junction-marker${
                    b.hasFade ? ' timeline__junction-marker--active' : ''
                  }`}
                  style={{ left: b.atSec * pixelsPerSecond }}
                >
                  {b.hasFade ? '◆' : '·'}
                </div>
              ))}

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
