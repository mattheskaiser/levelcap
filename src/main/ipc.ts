import { ipcMain, dialog } from 'electron'
import { importClips } from './clips'

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
}
