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
  clipId: string
  startSec: number
  endSec: number
  text: string
}

export interface MusicTrack {
  id: string
  name: string
  /** Absolute path; either a bundled track or a user-uploaded MP3. */
  filePath: string
  isBundled: boolean
}

export interface ProjectSettings {
  fadeTransitionsEnabled: boolean
  normalizeAudio: boolean
  musicTrackId: string | null
  musicVolumeDb: number
}

export interface Project {
  id: string
  clips: Clip[]
  captions: CaptionSegment[]
  settings: ProjectSettings
}

export type ExportProgressEvent =
  | { phase: 'normalizing'; clipIndex: number; clipCount: number }
  | { phase: 'transcribing'; percent: number }
  | { phase: 'rendering'; percent: number }
  | { phase: 'done'; outputPath: string }
  | { phase: 'error'; message: string }
