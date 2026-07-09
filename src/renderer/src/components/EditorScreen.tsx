import { useEffect, useState } from 'react'
import type { Project } from '@shared/types'
import EditorWorkspace from './EditorWorkspace'

interface EditorScreenProps {
  projectId: string
  onBack: () => void
}

function EditorScreen({ projectId, onBack }: EditorScreenProps): React.JSX.Element {
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.loadProject(projectId).then(
      (loaded) => {
        if (!cancelled) setProject(loaded)
      },
      (err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    )
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (error) {
    return (
      <div className="editor-status">
        <p>Couldn&apos;t load this project.</p>
        <p className="editor-status__detail">{error}</p>
        <button className="btn btn--ghost" onClick={onBack}>
          Back to projects
        </button>
      </div>
    )
  }

  if (!project) {
    return <div className="editor-status">Loading project…</div>
  }

  return <EditorWorkspace project={project} onBack={onBack} />
}

export default EditorScreen
