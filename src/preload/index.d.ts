import { ElectronAPI } from '@electron-toolkit/preload'
import type { RushcutApi } from '@shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: RushcutApi
  }
}
