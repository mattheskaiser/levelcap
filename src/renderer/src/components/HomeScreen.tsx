import ProjectCard from './ProjectCard'
import type { ProjectSummary } from '@shared/types'

interface HomeScreenProps {
  projects: ProjectSummary[] | null
  onOpenProject: (id: string) => void
  onCreateProject: () => void
}

function HomeScreen({
  projects,
  onOpenProject,
  onCreateProject
}: HomeScreenProps): React.JSX.Element {
  return (
    <div className="home">
      <header className="editor-header">
        <div className="editor-header__brand">
          <div className="editor-header__logo" />
          <span className="editor-header__title">Rushcut</span>
        </div>
      </header>

      <div className="home__body">
        <div className="home__toolbar">
          <div>
            <h1 className="home__heading">Your Projects</h1>
            <p className="home__subheading">Pick up where you left off, or start something new.</p>
          </div>
          <button className="btn btn--primary" onClick={onCreateProject}>
            + New Project
          </button>
        </div>

        {projects === null && <p className="home__empty">Loading your projects…</p>}

        {projects !== null && (
          <div className="home__grid">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project.id)}
              />
            ))}
            <button className="project-card project-card--new" onClick={onCreateProject}>
              <span className="project-card__new-icon">+</span>
              New Project
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomeScreen
