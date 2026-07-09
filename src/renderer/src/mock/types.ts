// The background-music library is still fully placeholder — no bundled tracks ship yet
// (see PLAN.md open questions), so these stay local/mock rather than backed by real data.

export interface MockTrack {
  id: string
  name: string
  durationSec: number
}

export interface MockUploadedTrack {
  name: string
  durationSec: number
}

export type RightTab = 'captions' | 'audio' | 'fade'
export type MusicTab = 'library' | 'upload'
export type NormalizeStatus = 'idle' | 'running' | 'done'
export type ExportPhase = 'normalizing' | 'transcribing' | 'rendering' | 'done' | null
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
