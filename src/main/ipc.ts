import { ipcMain, dialog } from 'electron'
import type { Project } from '@shared/types'
import { importClips } from './clips'
import { createProject, listProjects, loadProject, saveProject } from './projects'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'avi', 'mkv']

export function registerIpcHandlers(): void {
  ipcMain.handle('clips:import:dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: VIDEO_EXTENSIONS }]
    })
    if (result.canceled) return []
    return importClips(result.filePaths)
  })

  ipcMain.handle('clips:import', async (_event, filePaths: string[]) => {
    return importClips(filePaths)
  })

  ipcMain.handle('projects:list', () => listProjects())
  ipcMain.handle('projects:create', (_event, name: string) => createProject(name))
  ipcMain.handle('projects:load', (_event, id: string) => loadProject(id))
  ipcMain.handle('projects:save', (_event, project: Project) => saveProject(project))
}
