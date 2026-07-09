import { waveformPath } from '../mock/format'
import type { MockProject } from '../mock/projects'

interface ProjectCardProps {
  project: MockProject
  onOpen: () => void
}

function ProjectCard({ project, onOpen }: ProjectCardProps): React.JSX.Element {
  return (
    <button className="project-card" onClick={onOpen}>
      <div className="project-card__thumb">
        <svg width="100%" height="100%" viewBox="0 0 140 34" preserveAspectRatio="none">
          <path
            d={waveformPath(project.seed)}
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
      <div className="project-card__meta">
        <div className="project-card__name">{project.name}</div>
        <div className="project-card__sub mono">
          {project.clipCount} {project.clipCount === 1 ? 'clip' : 'clips'} · {project.durationLabel}
        </div>
        <div className="project-card__updated">{project.updatedLabel}</div>
      </div>
    </button>
  )
}

export default ProjectCard
