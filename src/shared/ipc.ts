import type { Clip, Project, ProjectSummary } from './types'

export interface RushcutApi {
  /** Opens a native file picker filtered to video files, probes, and returns the imported clips. */
  selectAndImportClips(): Promise<Clip[]>
  /** Probes and imports clips from already-known file paths (e.g. drag-and-drop). */
  importClipsFromPaths(filePaths: string[]): Promise<Clip[]>
  /** Resolves the absolute filesystem path for a File dropped onto the window. */
  getPathForFile(file: File): string

  /** Lightweight summaries for the project picker, newest first. */
  listProjects(): Promise<ProjectSummary[]>
  /** Creates and persists a new empty project, returning the full record. */
  createProject(name: string): Promise<Project>
  loadProject(id: string): Promise<Project>
  /** Overwrites the project file on disk and returns the refreshed summary. */
  saveProject(project: Project): Promise<ProjectSummary>
}
