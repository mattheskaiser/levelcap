import type { Clip } from '@shared/types'
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

export interface ActiveClipPosition {
  clip: Clip
  clipIndex: number
  /** Seconds into the clip's own source file to seek to. */
  sourceTimeSec: number
  /** Where this clip begins on the assembled timeline, in seconds. */
  clipStartOffsetSec: number
}

/** Maps a position on the assembled timeline to the clip (and source-file offset) playing there. */
export function locateActiveClip(clips: Clip[], globalSec: number): ActiveClipPosition | null {
  let acc = 0
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]
    if (!clip) continue
    const dur = clip.trimEndSec - clip.trimStartSec
    if (globalSec >= acc && globalSec < acc + dur) {
      return {
        clip,
        clipIndex: i,
        sourceTimeSec: clip.trimStartSec + (globalSec - acc),
        clipStartOffsetSec: acc
      }
    }
    acc += dur
  }
  const lastIndex = clips.length - 1
  const last = clips[lastIndex]
  if (!last) return null
  const lastDur = last.trimEndSec - last.trimStartSec
  return {
    clip: last,
    clipIndex: lastIndex,
    sourceTimeSec: last.trimEndSec,
    clipStartOffsetSec: acc - lastDur
  }
}
