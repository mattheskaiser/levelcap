import type { Track, VideoTrackItem } from '@shared/types'
import { MEDIA_PROTOCOL } from '@shared/media'

export function toMediaUrl(sourcePath: string): string {
  return `${MEDIA_PROTOCOL}://local/${encodeURIComponent(sourcePath)}`
}

/** Forces the browser to decode and paint a frame so <video> elements show a real thumbnail. */
export function seekToFirstFrame(event: React.SyntheticEvent<HTMLVideoElement>): void {
  const video = event.currentTarget
  if (Number.isFinite(video.duration) && video.duration > 0) {
    video.currentTime = Math.min(0.15, video.duration / 2)
  }
}

export interface ActiveVideoItem {
  item: VideoTrackItem
  trackId: string
  /** Seconds into the item's own source file to seek to. */
  sourceTimeSec: number
}

/** Finds which video item is playing at a position on the assembled timeline. Tracks are
 *  checked topmost-first (last in the array), so an overlapping item on a higher track wins —
 *  there's no real compositing, just "whichever layer is in front is what's shown." */
export function locateActiveVideoItem(tracks: Track[], globalSec: number): ActiveVideoItem | null {
  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i]
    if (!track) continue
    for (const item of track.items) {
      if (item.kind !== 'video') continue
      const durationSec = item.trimEndSec - item.trimStartSec
      if (globalSec >= item.startSec && globalSec < item.startSec + durationSec) {
        return {
          item,
          trackId: track.id,
          sourceTimeSec: item.trimStartSec + (globalSec - item.startSec)
        }
      }
    }
  }

  // Past the very end of the whole timeline, freeze on the last frame of whichever
  // topmost item ends last — avoids a flash of "nothing" right at the tail.
  let fallback: { item: VideoTrackItem; trackId: string; endSec: number } | null = null
  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i]
    if (!track) continue
    for (const item of track.items) {
      if (item.kind !== 'video') continue
      const endSec = item.startSec + (item.trimEndSec - item.trimStartSec)
      if (!fallback || endSec > fallback.endSec) {
        fallback = { item, trackId: track.id, endSec }
      }
    }
  }
  if (!fallback || globalSec < fallback.endSec) return null
  return { item: fallback.item, trackId: fallback.trackId, sourceTimeSec: fallback.item.trimEndSec }
}
