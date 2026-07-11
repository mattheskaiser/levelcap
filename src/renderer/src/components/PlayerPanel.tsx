import { useEffect, useRef, useState } from 'react'
import type { Track } from '@shared/types'
import { textItemsAcrossTracks } from '@shared/tracks'
import { basename, formatClipTime } from '../utils/format'
import { locateActiveVideoItem, toMediaUrl } from '../utils/media'

const SEEK_EPSILON_SEC = 0.35

interface TrimPreview {
  sourcePath: string
  sourceTimeSec: number
}

interface PlayerPanelProps {
  tracks: Track[]
  currentSec: number
  totalDurationSec: number
  isPlaying: boolean
  onTogglePlay: () => void
  onPlaybackTimeUpdate: (sec: number) => void
  onScrub: (pct: number) => void
  trimPreview: TrimPreview | null
}

function PlayerPanel({
  tracks,
  currentSec,
  totalDurationSec,
  isPlaying,
  onTogglePlay,
  onPlaybackTimeUpdate,
  onScrub,
  trimPreview
}: PlayerPanelProps): React.JSX.Element {
  const playerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const loadedItemIdRef = useRef<string | null>(null)
  const trimPreviewUrlRef = useRef<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const active = locateActiveVideoItem(tracks, currentSec)
  const activeCaptions = textItemsAcrossTracks(tracks).filter(
    (c) => currentSec >= c.startSec && currentSec < c.endSec
  )

  // Swap the video source when playback crosses into a different item.
  useEffect(() => {
    if (trimPreview) return
    const video = videoRef.current
    if (!video || !active) return
    if (loadedItemIdRef.current === active.item.id) return
    loadedItemIdRef.current = active.item.id
    video.src = toMediaUrl(active.item.sourcePath)
    video.currentTime = active.sourceTimeSec
    if (isPlaying) void video.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.item.id, trimPreview])

  // Seek when the playhead moves from something other than our own timeupdate (e.g. scrubbing).
  useEffect(() => {
    if (trimPreview) return
    const video = videoRef.current
    if (!video || !active) return
    if (Math.abs(video.currentTime - active.sourceTimeSec) > SEEK_EPSILON_SEC) {
      video.currentTime = active.sourceTimeSec
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSec])

  useEffect(() => {
    if (trimPreview) return
    const video = videoRef.current
    if (!video) return
    if (isPlaying) void video.play()
    else video.pause()
  }, [isPlaying, trimPreview])

  // While dragging a clip's trim handle, freeze the player on the exact frame at the new
  // in/out point instead of the normal timeline-position playback, so you can see which
  // frame you're cutting to rather than just a shrinking/scaling thumbnail.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (trimPreview) {
      const url = toMediaUrl(trimPreview.sourcePath)
      if (trimPreviewUrlRef.current !== url) {
        trimPreviewUrlRef.current = url
        video.src = url
      }
      video.pause()
      video.currentTime = trimPreview.sourceTimeSec
    } else if (trimPreviewUrlRef.current !== null) {
      trimPreviewUrlRef.current = null
      if (active) {
        loadedItemIdRef.current = active.item.id
        video.src = toMediaUrl(active.item.sourcePath)
        video.currentTime = active.sourceTimeSec
        if (isPlaying) void video.play()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimPreview])

  useEffect(() => {
    function handleFullscreenChange(): void {
      setIsFullscreen(document.fullscreenElement === playerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  function toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void playerRef.current?.requestFullscreen()
    }
  }

  function seekFromClientX(clientX: number, track: HTMLDivElement): void {
    if (totalDurationSec <= 0) return
    const rect = track.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    onScrub(pct)
  }

  function handleScrubPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (!active) return
    event.currentTarget.setPointerCapture(event.pointerId)
    seekFromClientX(event.clientX, event.currentTarget)
  }

  function handleScrubPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (!active || event.buttons !== 1) return
    seekFromClientX(event.clientX, event.currentTarget)
  }

  function handleTimeUpdate(): void {
    const video = videoRef.current
    if (!video || !active) return
    if (video.currentTime >= active.item.trimEndSec) {
      const endOfItemGlobalSec =
        active.item.startSec + (active.item.trimEndSec - active.item.trimStartSec)
      onPlaybackTimeUpdate(endOfItemGlobalSec)
      return
    }
    onPlaybackTimeUpdate(active.item.startSec + (video.currentTime - active.item.trimStartSec))
  }

  return (
    <div className="player" ref={playerRef}>
      <div className="player__preview">
        {active ? (
          <video
            ref={videoRef}
            className="player__video"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleTimeUpdate}
          />
        ) : (
          <span className="player__preview-label">Add clips to the timeline to preview</span>
        )}
        {activeCaptions.length > 0 && (
          <div className="player__caption-overlay">
            {activeCaptions.map((c) => (
              <div key={c.id} className="player__caption-line">
                {c.text}
              </div>
            ))}
          </div>
        )}
        {trimPreview ? (
          <span className="player__clip-label player__clip-label--trim">Trimming…</span>
        ) : (
          active && <span className="player__clip-label">{basename(active.item.sourcePath)}</span>
        )}
      </div>
      <div
        className={`player__scrubbar${!active ? ' player__scrubbar--disabled' : ''}`}
        onPointerDown={handleScrubPointerDown}
        onPointerMove={handleScrubPointerMove}
      >
        <div
          className="player__scrubbar-fill"
          style={{ width: `${(currentSec / (totalDurationSec || 1)) * 100}%` }}
        />
        <div
          className="player__scrubbar-thumb"
          style={{ left: `${(currentSec / (totalDurationSec || 1)) * 100}%` }}
        />
      </div>
      <div className="player__controls">
        <button className="player__play-btn" onClick={onTogglePlay} disabled={!active}>
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <span className="player__time">
          {formatClipTime(currentSec)} / {formatClipTime(totalDurationSec)}
        </span>
        <div className="player__spacer" />
        <button className="icon-btn" onClick={toggleFullscreen} title="Fullscreen">
          {isFullscreen ? '⤡' : '⤢'}
        </button>
      </div>
    </div>
  )
}

export default PlayerPanel
