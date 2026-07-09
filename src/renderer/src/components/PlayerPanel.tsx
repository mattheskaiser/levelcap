import { formatClipTime } from '../mock/format'

interface PlayerPanelProps {
  currentSec: number
  totalDurationSec: number
  isPlaying: boolean
  clipLabel: string
  onTogglePlay: () => void
  onScrub: (pct: number) => void
}

function PlayerPanel({
  currentSec,
  totalDurationSec,
  isPlaying,
  clipLabel,
  onTogglePlay,
  onScrub
}: PlayerPanelProps): React.JSX.Element {
  const pct = totalDurationSec ? (currentSec / totalDurationSec) * 100 : 0

  function handleScrubClick(event: React.MouseEvent<HTMLDivElement>): void {
    const rect = event.currentTarget.getBoundingClientRect()
    const clicked = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onScrub(clicked)
  }

  return (
    <div className="player">
      <div className="player__preview">
        <span className="player__preview-label">video preview</span>
        <span className="player__clip-label">{clipLabel}</span>
      </div>
      <div className="player__controls">
        <div className="player__transport">
          <button className="player__play-btn" onClick={onTogglePlay}>
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
          Preview reflects clip order, fades, and captions as you edit the timeline.
        </p>
      </div>
    </div>
  )
}

export default PlayerPanel
