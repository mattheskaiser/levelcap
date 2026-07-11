import type { ExportResult, PipelineProgressEvent, Segment, SourceVideo } from './types'

export interface LevelcapApi {
  /** Opens a native file picker filtered to video files, probes, and returns the selected video. */
  selectVideo(): Promise<SourceVideo | null>
  /** Resolves the absolute filesystem path for a File dropped onto the window. */
  getPathForFile(file: File): string
  /** Probes a known file path (e.g. drag-and-drop) and returns it as a SourceVideo. */
  importVideoFromPath(filePath: string): Promise<SourceVideo>

  /** Runs the transcribe+normalize pipeline on the given video, streaming progress via onProgress. */
  runPipeline(video: SourceVideo, onProgress: (event: PipelineProgressEvent) => void): Promise<void>

  /** Opens a save dialog and writes the final <name>.mp4 + <name>.srt next to each other. */
  exportResult(normalizedVideoPath: string, segments: Segment[]): Promise<ExportResult | null>
}
