import type { ExportPhase, SaveStatus } from '../mock/types'

const PHASE_LABELS: Record<Exclude<ExportPhase, null | 'done'>, string> = {
  normalizing: 'Normalizing audio…',
  transcribing: 'Generating captions…',
  rendering: 'Rendering video…'
}

const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed'
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-') || 'untitled'
}

interface EditorHeaderProps {
  projectName: string
  onBack: () => void
  saveStatus: SaveStatus
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  exportPhase: ExportPhase
  exportPercent: number
  onExport: () => void
  onResetExport: () => void
}

function EditorHeader({
  projectName,
  onBack,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  exportPhase,
  exportPercent,
  onExport,
  onResetExport
}: EditorHeaderProps): React.JSX.Element {
  return (
    <header className="editor-header">
      <div className="editor-header__brand">
        <button className="icon-btn" onClick={onBack} title="Back to projects">
          ←
        </button>
        <div className="editor-header__logo" />
        <span className="editor-header__title">Rushcut</span>
        <span className="editor-header__project">/ {projectName}</span>
        {saveStatus !== 'idle' && (
          <span className={`editor-header__save-status editor-header__save-status--${saveStatus}`}>
            {SAVE_STATUS_LABELS[saveStatus]}
          </span>
        )}
      </div>

      <div className="editor-header__right">
        <div className="editor-header__history">
          <button className="icon-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button
            className="icon-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
        </div>

        {exportPhase === null && (
          <button className="btn btn--primary" onClick={onExport}>
            Export
          </button>
        )}

        {exportPhase !== null && exportPhase !== 'done' && (
          <div className="editor-header__progress">
            <span className="editor-header__progress-label">{PHASE_LABELS[exportPhase]}</span>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${exportPercent}%` }} />
            </div>
            <span className="editor-header__progress-pct">{exportPercent}%</span>
          </div>
        )}

        {exportPhase === 'done' && (
          <div className="editor-header__done">
            <span className="editor-header__done-badge">
              <span className="editor-header__done-check">✓</span>
              Exported
            </span>
            <span className="editor-header__done-path">
              ~/Movies/Rushcut/{slugify(projectName)}.mp4
            </span>
            <button className="btn btn--ghost" onClick={onResetExport}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default EditorHeader
