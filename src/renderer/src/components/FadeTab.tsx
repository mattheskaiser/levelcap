import ClipPickerList from './ClipPickerList'
import type { DisplayClip } from '../types'
import { junctionKey } from '../utils/format'

interface FadeTabProps {
  clips: DisplayClip[]
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

  const nameA = fadeSelectable ? clips.find((c) => c.id === fadeA)?.name : undefined
  const nameB = fadeSelectable ? clips.find((c) => c.id === fadeB)?.name : undefined
  const fadeActionLabel = fadeSelectable ? `Fade between ${nameA} and ${nameB}` : ''

  const activeFades = fadeJunctions.map((key) => {
    const [idA, idB] = key.split('__')
    const nameFor = (id: string | undefined): string => clips.find((c) => c.id === id)?.name ?? '?'
    return {
      key,
      label: `${nameFor(idA)} → ${nameFor(idB)}`
    }
  })

  return (
    <div className="right-tab">
      <p className="right-tab__hint right-tab__hint--lead">
        Select two clips on the same track that touch end-to-end to add a fade-to-black between
        them.
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
            ? 'Selected clips must be on the same track and touching, with no gap between them.'
            : 'Select exactly two clips.'}
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
