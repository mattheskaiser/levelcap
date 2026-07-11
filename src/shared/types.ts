// Types shared between the main and renderer processes.

export interface SourceVideo {
  /** Absolute path to the source video file on disk. */
  path: string
  durationSec: number
}

export interface Segment {
  id: string
  startSec: number
  endSec: number
  text: string
}

export type PipelineProgressEvent =
  | { phase: 'extracting-audio' }
  | { phase: 'transcribing'; percent: number }
  | { phase: 'normalizing'; percent: number }
  | { phase: 'done'; normalizedVideoPath: string; segments: Segment[] }
  | { phase: 'error'; message: string }

export interface ExportResult {
  videoPath: string
  srtPath: string
}
