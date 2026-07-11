import type { TextTrackItem, Track, TrackItem, VideoTrackItem } from './types'

export function itemDurationSec(item: TrackItem): number {
  if (item.kind === 'video') return item.trimEndSec - item.trimStartSec
  return item.endSec - item.startSec
}

export function itemEndSec(item: TrackItem): number {
  return item.startSec + itemDurationSec(item)
}

export function timelineDurationSec(tracks: Track[]): number {
  let maxEnd = 0
  for (const track of tracks) {
    for (const item of track.items) {
      maxEnd = Math.max(maxEnd, itemEndSec(item))
    }
  }
  return maxEnd
}

export interface FoundTrackItem {
  trackIndex: number
  itemIndex: number
  track: Track
  item: TrackItem
}

export function findTrackItem(tracks: Track[], itemId: string): FoundTrackItem | null {
  for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
    const track = tracks[trackIndex]
    if (!track) continue
    const itemIndex = track.items.findIndex((i) => i.id === itemId)
    if (itemIndex >= 0) {
      const item = track.items[itemIndex]
      if (item) return { trackIndex, itemIndex, track, item }
    }
  }
  return null
}

export function videoItemsAcrossTracks(tracks: Track[]): VideoTrackItem[] {
  const items: VideoTrackItem[] = []
  for (const track of tracks) {
    for (const item of track.items) {
      if (item.kind === 'video') items.push(item)
    }
  }
  return items
}

export function textItemsAcrossTracks(tracks: Track[]): TextTrackItem[] {
  const items: TextTrackItem[] = []
  for (const track of tracks) {
    for (const item of track.items) {
      if (item.kind === 'text') items.push(item)
    }
  }
  return items
}
