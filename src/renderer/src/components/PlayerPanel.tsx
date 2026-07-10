import { useEffect, useRef, useState } from 'react'
import type { DisplayClip } from '../types'
import { formatClipTime } from '../utils/format'
import { locateActiveClip, toMediaUrl } from '../utils/media'

const SEEK_EPSILON_SEC = 0.35

interface TrimPreview {
  sourcePath: string
  sourceTimeSec: number
}

interface PlayerPanelProps {
  clips: DisplayClip[]
  currentSec: number
  totalDurationSec: number
  isPlaying: boolean
  onTogglePlay: () => void
  onPlaybackTimeUpdate: (sec: number) => void
  onScrub: (pct: number) => void
  trimPreview: TrimPreview | null
}

function PlayerPanel({
  clips,
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
  const loadedClipIdRef = useRef<string | null>(null)
  const trimPreviewUrlRef = useRef<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const active = locateActiveClip(clips, currentSec)

  // Swap the video source when playback crosses into a different clip.
  useEffect(() => {
    if (trimPreview) return
    const video = videoRef.current
    if (!video || !active) return
    if (loadedClipIdRef.current === active.clip.id) return
    loadedClipIdRef.current = active.clip.id
    video.src = toMediaUrl(active.clip.sourcePath)
    video.currentTime = active.sourceTimeSec
    if (isPlaying) void video.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.clip.id, trimPreview])

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
        loadedClipIdRef.current = active.clip.id
        video.src = toMediaUrl(active.clip.sourcePath)
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
    if (video.currentTime >= active.clip.trimEndSec) {
      const endOfClipGlobalSec =
        active.clipStartOffsetSec + (active.clip.trimEndSec - active.clip.trimStartSec)
      onPlaybackTimeUpdate(endOfClipGlobalSec)
      return
    }
    onPlaybackTimeUpdate(active.clipStartOffsetSec + (video.currentTime - active.clip.trimStartSec))
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
        {trimPreview ? (
          <span className="player__clip-label player__clip-label--trim">Trimming…</span>
        ) : (
          active && <span className="player__clip-label">Clip {active.clipIndex + 1}</span>
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
