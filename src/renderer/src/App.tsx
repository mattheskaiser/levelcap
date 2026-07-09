import { useCallback, useEffect, useState } from 'react'
import EditorScreen from './components/EditorScreen'
import HomeScreen from './components/HomeScreen'
import type { ProjectSummary } from '@shared/types'

type View = { screen: 'home' } | { screen: 'editor'; projectId: string }

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [view, setView] = useState<View>({ screen: 'home' })

  const refreshProjects = useCallback(() => {
    void window.api.listProjects().then(setProjects)
  }, [])

  useEffect(() => {
    refreshProjects()
  }, [refreshProjects])

  async function handleCreateProject(): Promise<void> {
    const name = `Untitled Project ${(projects?.length ?? 0) + 1}`
    const project = await window.api.createProject(name)
    refreshProjects()
    setView({ screen: 'editor', projectId: project.id })
  }

  function handleOpenProject(id: string): void {
    setView({ screen: 'editor', projectId: id })
  }

  function handleBack(): void {
    refreshProjects()
    setView({ screen: 'home' })
  }

  if (view.screen === 'home') {
    return (
      <HomeScreen
        projects={projects}
        onOpenProject={handleOpenProject}
        onCreateProject={() => void handleCreateProject()}
      />
    )
  }

  return <EditorScreen key={view.projectId} projectId={view.projectId} onBack={handleBack} />
}

export default App
