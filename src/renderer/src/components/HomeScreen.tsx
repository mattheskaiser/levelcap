import ProjectCard from './ProjectCard'
import type { MockProject } from '../mock/projects'

interface HomeScreenProps {
  projects: MockProject[]
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

        {projects.length === 0 && (
          <p className="home__empty">No projects yet — create one to get started.</p>
        )}
      </div>
    </div>
  )
}

export default HomeScreen
