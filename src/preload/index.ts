import { randomUUID } from 'crypto'
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { LevelcapApi } from '@shared/ipc'
import type { ExportResult, PipelineProgressEvent, Segment } from '@shared/types'

// Custom APIs for renderer
const api: LevelcapApi = {
  selectVideo: () => ipcRenderer.invoke('video:select'),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  importVideoFromPath: (filePath) => ipcRenderer.invoke('video:importPath', filePath),

  runPipeline: (video, onProgress) =>
    new Promise<void>((resolve, reject) => {
      const requestId = randomUUID()
      const channel = `pipeline:progress:${requestId}`
      const listener = (_event: unknown, progress: PipelineProgressEvent): void => {
        onProgress(progress)
        if (progress.phase === 'done') {
          ipcRenderer.removeListener(channel, listener)
          resolve()
        } else if (progress.phase === 'error') {
          ipcRenderer.removeListener(channel, listener)
          reject(new Error(progress.message))
        }
      }
      ipcRenderer.on(channel, listener)
      ipcRenderer.send('pipeline:run', requestId, video)
    }),

  exportResult: (normalizedVideoPath: string, segments: Segment[]) =>
    ipcRenderer.invoke('export:run', normalizedVideoPath, segments) as Promise<ExportResult | null>
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
