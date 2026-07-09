import type { ProjectSummary } from '@shared/types'
import { formatClipTime, waveformPath } from '../utils/format'

interface ProjectCardProps {
  project: ProjectSummary
  onOpen: () => void
}

function ProjectCard({ project, onOpen }: ProjectCardProps): React.JSX.Element {
  return (
    <button className="project-card" onClick={onOpen}>
      <div className="project-card__thumb">
        <svg width="100%" height="100%" viewBox="0 0 140 34" preserveAspectRatio="none">
          <path
            d={waveformPath(project.id)}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
      <div className="project-card__meta">
        <div className="project-card__name">{project.name}</div>
        <div className="project-card__sub mono">
          {project.clipCount} {project.clipCount === 1 ? 'clip' : 'clips'} ·{' '}
          {formatClipTime(project.totalDurationSec)}
        </div>
        <div className="project-card__updated">{new Date(project.updatedAt).toLocaleString()}</div>
      </div>
    </button>
  )
}

export default ProjectCard
