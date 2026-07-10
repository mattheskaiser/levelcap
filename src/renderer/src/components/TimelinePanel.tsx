import type { DisplayClip } from '../types'
import { formatClipTime, junctionKey } from '../utils/format'
import { seekToFirstFrame, toMediaUrl } from '../utils/media'

interface TimelinePanelProps {
  clips: DisplayClip[]
  selectedClipIds: string[]
  draggingClipId: string | null
  dragOverClipId: string | null
  fadeJunctions: string[]
  normalizedIds: string[]
  clipCountLabel: string
  totalDurationLabel: string
  onSelectClip: (id: string) => void
  onClipDragStart: (id: string) => void
  onClipDragOver: (id: string) => void
  onClipDrop: (id: string) => void
  onClipDragEnd: () => void
  onTimelineDrop: () => void
}

function TimelinePanel({
  clips,
  selectedClipIds,
  draggingClipId,
  dragOverClipId,
  fadeJunctions,
  normalizedIds,
  clipCountLabel,
  totalDurationLabel,
  onSelectClip,
  onClipDragStart,
  onClipDragOver,
  onClipDrop,
  onClipDragEnd,
  onTimelineDrop
}: TimelinePanelProps): React.JSX.Element {
  return (
    <div className="timeline">
      <div className="timeline__header">
        <span className="panel-label">Timeline</span>
        <span className="timeline__summary">
          {clipCountLabel} · {totalDurationLabel} total
        </span>
      </div>

      <div
        className="timeline__track"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onTimelineDrop}
      >
        {clips.map((clip, i) => {
          const isDragging = draggingClipId === clip.id
          const isDragOver = dragOverClipId === clip.id && draggingClipId !== clip.id
          const isSelected = selectedClipIds.includes(clip.id)
          const next = clips[i + 1]
          const key = next ? junctionKey(clip.id, next.id) : null
          const hasFade = !!key && fadeJunctions.includes(key)

          return (
            <div className="timeline__clip-group" key={clip.id}>
              <div
                className={`timeline-clip${isSelected ? ' timeline-clip--selected' : ''}${
                  isDragOver ? ' timeline-clip--drag-over' : ''
                }`}
                draggable
                onClick={() => onSelectClip(clip.id)}
                onDragStart={(e) => {
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
                style={{ opacity: isDragging ? 0.35 : 1 }}
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
                    {formatClipTime(clip.trimEndSec - clip.trimStartSec)}
                  </div>
                </div>
              </div>

              {next && (
                <div
                  className={`timeline__junction${hasFade ? ' timeline__junction--active' : ''}`}
                >
                  {hasFade ? '◆' : '·'}
                </div>
              )}
            </div>
          )
        })}

        {clips.length === 0 && (
          <p className="timeline__empty">Drag a clip here from Media, or use the + button.</p>
        )}
      </div>
    </div>
  )
}

export default TimelinePanel
