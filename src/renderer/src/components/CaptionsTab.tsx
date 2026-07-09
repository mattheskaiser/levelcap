import type { CaptionSegment } from '@shared/types'
import { formatCaptionTime } from '../utils/format'

interface CaptionsTabProps {
  captions: CaptionSegment[]
  editingCaptionId: string | null
  editDraft: string
  clipLabelForTime: (t: number) => string
  onStartEdit: (id: string, currentText: string) => void
  onDraftChange: (text: string) => void
  onCommit: (id: string) => void
  onCancel: () => void
  onAdjustTime: (id: string, field: 'startSec' | 'endSec', delta: number) => void
}

function CaptionsTab({
  captions,
  editingCaptionId,
  editDraft,
  clipLabelForTime,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  onAdjustTime
}: CaptionsTabProps): React.JSX.Element {
  return (
    <div className="right-tab">
      <div className="right-tab__intro">
        <span>Click a caption to edit its text.</span>
        <span className="mono">
          {captions.length} {captions.length === 1 ? 'caption' : 'captions'}
        </span>
      </div>

      <div className="caption-list">
        {captions.map((cap) => {
          const isEditing = editingCaptionId === cap.id
          return (
            <div className="caption-row" key={cap.id}>
              <div className="caption-row__top">
                <div className="caption-row__times">
                  <div className="stepper">
                    <button onClick={() => onAdjustTime(cap.id, 'startSec', -0.1)}>−</button>
                    <span className="mono">{formatCaptionTime(cap.startSec)}</span>
                    <button onClick={() => onAdjustTime(cap.id, 'startSec', 0.1)}>+</button>
                  </div>
                  <span className="caption-row__arrow">→</span>
                  <div className="stepper">
                    <button onClick={() => onAdjustTime(cap.id, 'endSec', -0.1)}>−</button>
                    <span className="mono">{formatCaptionTime(cap.endSec)}</span>
                    <button onClick={() => onAdjustTime(cap.id, 'endSec', 0.1)}>+</button>
                  </div>
                </div>
                <span className="caption-row__clip mono">{clipLabelForTime(cap.startSec)}</span>
              </div>

              {isEditing ? (
                <textarea
                  className="caption-row__textarea"
                  value={editDraft}
                  autoFocus
                  rows={2}
                  onChange={(e) => onDraftChange(e.target.value)}
                  onBlur={() => onCommit(cap.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      onCommit(cap.id)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      onCancel()
                    }
                  }}
                />
              ) : (
                <div className="caption-row__text" onClick={() => onStartEdit(cap.id, cap.text)}>
                  {cap.text}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CaptionsTab
