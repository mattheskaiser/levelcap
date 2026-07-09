import type { Clip } from './types'

export interface RushcutApi {
  /** Opens a native file picker filtered to video files, probes, and returns the imported clips. */
  selectAndImportClips(): Promise<Clip[]>
  /** Probes and imports clips from already-known file paths (e.g. drag-and-drop). */
  importClipsFromPaths(filePaths: string[]): Promise<Clip[]>
  /** Resolves the absolute filesystem path for a File dropped onto the window. */
  getPathForFile(file: File): string
}
