import { ElectronAPI } from '@electron-toolkit/preload'
import type { LevelcapApi } from '@shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: LevelcapApi
  }
}
