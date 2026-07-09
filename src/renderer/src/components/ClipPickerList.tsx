import { formatClipTime } from '../mock/format'
import type { MockClip } from '../mock/types'

interface ClipPickerListProps {
  clips: MockClip[]
  selectedClipIds: string[]
  onToggle: (id: string) => void
}

function ClipPickerList({
  clips,
  selectedClipIds,
  onToggle
}: ClipPickerListProps): React.JSX.Element {
  return (
    <div className="clip-picker">
      {clips.map((clip) => {
        const isSelected = selectedClipIds.includes(clip.id)
        return (
          <div
            key={clip.id}
            className={`clip-picker__row${isSelected ? ' clip-picker__row--selected' : ''}`}
            onClick={() => onToggle(clip.id)}
          >
            <span className={`clip-picker__check${isSelected ? ' clip-picker__check--on' : ''}`}>
              {isSelected ? '✓' : ''}
            </span>
            <span className="clip-picker__name">{clip.name}</span>
            <span className="clip-picker__duration mono">{formatClipTime(clip.durationSec)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default ClipPickerList
