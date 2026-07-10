import { useEffect, useRef } from 'react'
import type { DisplayClip } from '../types'
import { formatClipTime } from '../utils/format'
import { locateActiveClip, toMediaUrl } from '../utils/media'

const SEEK_EPSILON_SEC = 0.35

interface PlayerPanelProps {
  clips: DisplayClip[]
  currentSec: number
  totalDurationSec: number
  isPlaying: boolean
  onTogglePlay: () => void
  onScrub: (pct: number) => void
  onPlaybackTimeUpdate: (sec: number) => void
}

function PlayerPanel({
  clips,
  currentSec,
  totalDurationSec,
  isPlaying,
  onTogglePlay,
  onScrub,
  onPlaybackTimeUpdate
}: PlayerPanelProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const loadedClipIdRef = useRef<string | null>(null)

  const active = locateActiveClip(clips, currentSec)
  const pct = totalDurationSec ? (currentSec / totalDurationSec) * 100 : 0

  // Swap the video source when playback crosses into a different clip.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !active) return
    if (loadedClipIdRef.current === active.clip.id) return
    loadedClipIdRef.current = active.clip.id
    video.src = toMediaUrl(active.clip.sourcePath)
    video.currentTime = active.sourceTimeSec
    if (isPlaying) void video.play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.clip.id])

  // Seek when the playhead moves from something other than our own timeupdate (e.g. scrubbing).
  useEffect(() => {
    const video = videoRef.current
    if (!video || !active) return
    if (Math.abs(video.currentTime - active.sourceTimeSec) > SEEK_EPSILON_SEC) {
      video.currentTime = active.sourceTimeSec
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSec])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) void video.play()
    else video.pause()
  }, [isPlaying])

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

  function handleScrubClick(event: React.MouseEvent<HTMLDivElement>): void {
    const rect = event.currentTarget.getBoundingClientRect()
    const clicked = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onScrub(clicked)
  }

  return (
    <div className="player">
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
        {active && <span className="player__clip-label">Clip {active.clipIndex + 1}</span>}
      </div>
      <div className="player__controls">
        <div className="player__transport">
          <button className="player__play-btn" onClick={onTogglePlay} disabled={!active}>
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <span className="player__time">
            {formatClipTime(currentSec)} / {formatClipTime(totalDurationSec)}
          </span>
          <div className="scrub-bar" onClick={handleScrubClick}>
            <div className="scrub-bar__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="player__hint">
          Preview reflects clip order as you edit the timeline. Fades and captions aren&apos;t
          rendered here yet.
        </p>
      </div>
    </div>
  )
}

export default PlayerPanel
