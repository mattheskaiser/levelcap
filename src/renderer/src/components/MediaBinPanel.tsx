import { formatClipTime } from '../mock/format'
import type { MockClip } from '../mock/types'

interface MediaBinPanelProps {
  items: MockClip[]
  draggingBinId: string | null
  onImportClip: () => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onAddToTimeline: (id: string) => void
}

function MediaBinPanel({
  items,
  draggingBinId,
  onImportClip,
  onDragStart,
  onDragEnd,
  onAddToTimeline
}: MediaBinPanelProps): React.JSX.Element {
  return (
    <div className="media-bin">
      <div className="media-bin__header">
        <span className="panel-label">Media</span>
        <button className="icon-btn" onClick={onImportClip} title="Import clip">
          +
        </button>
      </div>

      <div className="media-bin__list">
        {items.map((item) => (
          <div
            key={item.id}
            className="media-bin__item"
            draggable
            onDragStart={() => onDragStart(item.id)}
            onDragEnd={onDragEnd}
            style={{ opacity: draggingBinId === item.id ? 0.35 : 1 }}
          >
            <span className="media-bin__thumb">⤢</span>
            <div className="media-bin__meta">
              <div className="media-bin__name">{item.name}</div>
              <div className="media-bin__duration">{formatClipTime(item.durationSec)}</div>
            </div>
            <button className="icon-btn icon-btn--small" onClick={() => onAddToTimeline(item.id)}>
              +
            </button>
          </div>
        ))}

        {items.length === 0 && (
          <p className="media-bin__empty">
            All imported clips are on the timeline. Import more with the + above.
          </p>
        )}
      </div>
    </div>
  )
}

export default MediaBinPanel
