import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { RushcutApi } from '@shared/ipc'

// Custom APIs for renderer
const api: RushcutApi = {
  selectAndImportClips: () => ipcRenderer.invoke('clips:import:dialog'),
  importClipsFromPaths: (filePaths) => ipcRenderer.invoke('clips:import', filePaths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name) => ipcRenderer.invoke('projects:create', name),
  loadProject: (id) => ipcRenderer.invoke('projects:load', id),
  saveProject: (project) => ipcRenderer.invoke('projects:save', project)
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
