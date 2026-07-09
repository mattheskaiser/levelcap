export interface MockClip {
  id: string
  name: string
  durationSec: number
  seed: number
}

export interface MockCaption {
  id: string
  startSec: number
  endSec: number
  text: string
}

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
