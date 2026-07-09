import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { RushcutApi } from '@shared/ipc'

// Custom APIs for renderer
const api: RushcutApi = {
  selectAndImportClips: () => ipcRenderer.invoke('clips:import:dialog'),
  importClipsFromPaths: (filePaths) => ipcRenderer.invoke('clips:import', filePaths),
  getPathForFile: (file) => webUtils.getPathForFile(file)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
