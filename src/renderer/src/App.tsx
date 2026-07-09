import { useState } from 'react'
import EditorScreen from './components/EditorScreen'
import HomeScreen from './components/HomeScreen'
import { initialProjects } from './mock/projects'
import type { MockProject } from './mock/projects'

type View = { screen: 'home' } | { screen: 'editor'; projectId: string }

let untitledCount = 0

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<MockProject[]>(initialProjects)
  const [view, setView] = useState<View>({ screen: 'home' })

  function handleOpenProject(id: string): void {
    setView({ screen: 'editor', projectId: id })
  }

  function handleCreateProject(): void {
    untitledCount += 1
    const newProject: MockProject = {
      id: `proj-${Date.now()}`,
      name: `Untitled Project ${untitledCount}`,
      clipCount: 0,
      durationLabel: '0:00',
      updatedLabel: 'Just now',
      seed: Math.floor(Math.random() * 90) + 1
    }
    setProjects((prev) => [...prev, newProject])
    setView({ screen: 'editor', projectId: newProject.id })
  }

  function handleBack(): void {
    setView({ screen: 'home' })
  }

  if (view.screen === 'home') {
    return (
      <HomeScreen
        projects={projects}
        onOpenProject={handleOpenProject}
        onCreateProject={handleCreateProject}
      />
    )
  }

  const project = projects.find((p) => p.id === view.projectId)

  return (
    <EditorScreen
      key={view.projectId}
      projectName={project?.name ?? 'Untitled'}
      isDemo={project?.isDemo ?? false}
      onBack={handleBack}
    />
  )
}

export default App
