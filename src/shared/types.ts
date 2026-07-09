// Types shared between the main and renderer processes.

export interface Clip {
  id: string
  /** Absolute path to the source video file on disk. */
  sourcePath: string
  /** Order on the timeline; lower plays first. */
  order: number
  /** Duration of the source clip in seconds, probed via ffmpeg. */
  durationSec: number
  /** Trim points relative to the source file, in seconds. */
  trimStartSec: number
  trimEndSec: number
}

export interface CaptionSegment {
  id: string
  /** Timeline-absolute seconds (not per-clip — see PLAN.md open question on caption timing model). */
  startSec: number
  endSec: number
  text: string
}

export interface ProjectSettings {
  /** "<clipIdA>__<clipIdB>" keys where a fade-to-black is applied between adjacent timeline clips. */
  fadeJunctions: string[]
  /** Clip ids that have been through the loudnorm pass. */
  normalizedClipIds: string[]
}

export interface Project {
  id: string
  name: string
  /** ISO 8601 timestamps, set by the main process. */
  createdAt: string
  updatedAt: string
  /** Imported but not yet placed on the timeline. */
  mediaBinClips: Clip[]
  timelineClips: Clip[]
  captions: CaptionSegment[]
  settings: ProjectSettings
}

export interface ProjectSummary {
  id: string
  name: string
  updatedAt: string
  clipCount: number
  totalDurationSec: number
}

export type ExportProgressEvent =
  | { phase: 'normalizing'; clipIndex: number; clipCount: number }
  | { phase: 'transcribing'; percent: number }
  | { phase: 'rendering'; percent: number }
  | { phase: 'done'; outputPath: string }
  | { phase: 'error'; message: string }
