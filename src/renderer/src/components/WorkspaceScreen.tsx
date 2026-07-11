import { useRef, useState } from 'react'
import type { ExportResult, Segment } from '@shared/types'
import { toMediaUrl } from '../utils/media'
import { formatTime } from '../utils/format'

interface WorkspaceScreenProps {
  normalizedVideoPath: string
  segments: Segment[]
  isExporting: boolean
  exported: ExportResult | null
  onUpdateText: (id: string, text: string) => void
  onNudgeTime: (id: string, field: 'startSec' | 'endSec', deltaSec: number) => void
  onDeleteSegment: (id: string) => void
  onExport: () => void
  onStartOver: () => void
}

function WorkspaceScreen({
  normalizedVideoPath,
  segments,
  isExporting,
  exported,
  onUpdateText,
  onNudgeTime,
  onDeleteSegment,
  onExport,
  onStartOver
}: WorkspaceScreenProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [currentSec, setCurrentSec] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const activeCaption = segments.find((s) => currentSec >= s.startSec && currentSec < s.endSec)

  function seekTo(sec: number): void {
    const video = videoRef.current
    if (!video) return
    video.currentTime = sec
    setCurrentSec(sec)
  }

  function startEdit(seg: Segment): void {
    setEditingId(seg.id)
    setDraft(seg.text)
  }

  function commitEdit(id: string): void {
    onUpdateText(id, draft)
    setEditingId(null)
  }

  return (
    <div className="workspace-screen">
      <div className="workspace-screen__player">
        <div className="player">
          <video
            ref={videoRef}
            className="player__video"
            src={toMediaUrl(normalizedVideoPath)}
            controls
            onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime)}
          />
          {activeCaption && <div className="subtitle-overlay">{activeCaption.text}</div>}
        </div>

        <div className="workspace-screen__actions">
          <button className="btn btn--ghost" onClick={onStartOver}>
            Start over
          </button>
          <button className="btn btn--primary" onClick={onExport} disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Export for CapCut'}
          </button>
        </div>

        {exported && (
          <p className="workspace-screen__export-result">
            Exported <span className="mono">{exported.videoPath}</span> and{' '}
            <span className="mono">{exported.srtPath}</span>
          </p>
        )}
      </div>

      <div className="transcript-list">
        <div className="transcript-list__intro">
          <span>Click a line to edit its text.</span>
          <span className="mono">
            {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
          </span>
        </div>

        {segments.map((seg) => {
          const isEditing = editingId === seg.id
          return (
            <div className="transcript-row" key={seg.id}>
              <div className="transcript-row__top">
                <button
                  type="button"
                  className="transcript-row__time mono"
                  onClick={() => seekTo(seg.startSec)}
                >
                  {formatTime(seg.startSec)}
                </button>
                <div className="stepper">
                  <button onClick={() => onNudgeTime(seg.id, 'startSec', -0.1)}>−</button>
                  <span className="mono">start</span>
                  <button onClick={() => onNudgeTime(seg.id, 'startSec', 0.1)}>+</button>
                </div>
                <div className="stepper">
                  <button onClick={() => onNudgeTime(seg.id, 'endSec', -0.1)}>−</button>
                  <span className="mono">end</span>
                  <button onClick={() => onNudgeTime(seg.id, 'endSec', 0.1)}>+</button>
                </div>
                <button
                  type="button"
                  className="transcript-row__time mono"
                  onClick={() => seekTo(seg.endSec)}
                >
                  {formatTime(seg.endSec)}
                </button>
                <button className="transcript-row__delete" onClick={() => onDeleteSegment(seg.id)}>
                  Delete
                </button>
              </div>

              {isEditing ? (
                <textarea
                  className="transcript-row__textarea"
                  value={draft}
                  autoFocus
                  rows={2}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitEdit(seg.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      commitEdit(seg.id)
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditingId(null)
                    }
                  }}
                />
              ) : (
                <div className="transcript-row__text" onClick={() => startEdit(seg)}>
                  {seg.text}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WorkspaceScreen
