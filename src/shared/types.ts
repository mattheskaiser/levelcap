// Types shared between the main and renderer processes.

export interface Clip {
  id: string
  /** Absolute path to the source video file on disk. */
  sourcePath: string
  /** Duration of the source clip in seconds, probed via ffmpeg. */
  durationSec: number
  /** Trim points relative to the source file, in seconds. */
  trimStartSec: number
  trimEndSec: number
}

export interface VideoTrackItem {
  kind: 'video'
  id: string
  sourcePath: string
  /** Duration of the source file in seconds, probed via ffmpeg. */
  durationSec: number
  /** Trim points relative to the source file, in seconds. */
  trimStartSec: number
  trimEndSec: number
  /** Position on the global timeline, in seconds. */
  startSec: number
}

export interface TextTrackItem {
  kind: 'text'
  id: string
  /** Timeline-absolute seconds. */
  startSec: number
  endSec: number
  text: string
}

export type TrackItem = VideoTrackItem | TextTrackItem

/** Alias kept for readability in caption-specific UI code — structurally identical to TextTrackItem. */
export type CaptionSegment = TextTrackItem

export interface Track {
  id: string
  name: string
  items: TrackItem[]
}

export interface ProjectSettings {
  /** "<itemIdA>__<itemIdB>" keys — ids of two time-touching video items on the same track. */
  fadeJunctions: string[]
  /** Video item ids that have been through the loudnorm pass. */
  normalizedClipIds: string[]
}

export const CURRENT_SCHEMA_VERSION = 2 as const

export interface Project {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  id: string
  name: string
  /** ISO 8601 timestamps, set by the main process. */
  createdAt: string
  updatedAt: string
  /** Imported but not yet placed on the timeline. */
  mediaBinClips: Clip[]
  tracks: Track[]
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
