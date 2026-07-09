import ClipPickerList from './ClipPickerList'
import { junctionKey } from '../mock/format'
import type { MockClip } from '../mock/types'

interface FadeTabProps {
  clips: MockClip[]
  selectedClipIds: string[]
  onToggleClipSelection: (id: string) => void
  orderedSelectedPair: () => [string, string] | [null, null]
  fadeJunctions: string[]
  onToggleFadeAction: () => void
  onRemoveFade: (key: string) => void
}

function FadeTab({
  clips,
  selectedClipIds,
  onToggleClipSelection,
  orderedSelectedPair,
  fadeJunctions,
  onToggleFadeAction,
  onRemoveFade
}: FadeTabProps): React.JSX.Element {
  const [fadeA, fadeB] = orderedSelectedPair()
  const fadeSelectable = !!(fadeA && fadeB)
  const pairKey = fadeSelectable ? junctionKey(fadeA, fadeB) : null
  const pairHasFade = !!pairKey && fadeJunctions.includes(pairKey)

  const idxA = fadeSelectable ? clips.findIndex((c) => c.id === fadeA) : -1
  const idxB = fadeSelectable ? clips.findIndex((c) => c.id === fadeB) : -1
  const fadeActionLabel = fadeSelectable ? `Fade between Clip ${idxA + 1} and Clip ${idxB + 1}` : ''

  const activeFades = fadeJunctions.map((key) => {
    const [idA, idB] = key.split('__')
    const clipIdxA = clips.findIndex((c) => c.id === idA)
    const clipIdxB = clips.findIndex((c) => c.id === idB)
    return {
      key,
      label: `${clipIdxA >= 0 ? `Clip ${clipIdxA + 1}` : '?'} → ${
        clipIdxB >= 0 ? `Clip ${clipIdxB + 1}` : '?'
      }`
    }
  })

  return (
    <div className="right-tab">
      <p className="right-tab__hint right-tab__hint--lead">
        Select two neighboring clips below (or on the timeline) to add a fade-to-black between them.
      </p>

      <ClipPickerList
        clips={clips}
        selectedClipIds={selectedClipIds}
        onToggle={onToggleClipSelection}
      />

      {fadeSelectable ? (
        <div className="fade-action">
          <span className="fade-action__label">{fadeActionLabel}</span>
          <button
            className={`btn ${pairHasFade ? 'btn--ghost' : 'btn--primary'}`}
            onClick={onToggleFadeAction}
          >
            {pairHasFade ? 'Remove' : 'Add Fade'}
          </button>
        </div>
      ) : (
        <p className="right-tab__hint">
          {selectedClipIds.length === 2
            ? 'Selected clips must be next to each other on the timeline.'
            : 'Select exactly two neighboring clips.'}
        </p>
      )}

      <div className="right-tab__divider" />

      <div className="right-tab__section">
        <div className="right-tab__section-title">Active fades</div>
        <div className="fade-chip-list">
          {activeFades.map((f) => (
            <div className="fade-chip" key={f.key}>
              <span>{f.label}</span>
              <button onClick={() => onRemoveFade(f.key)}>×</button>
            </div>
          ))}
          {activeFades.length === 0 && <span className="right-tab__hint">None yet.</span>}
        </div>
      </div>
    </div>
  )
}

export default FadeTab
