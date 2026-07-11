import type { Clip, VideoTrackItem } from '@shared/types'

/** A Clip decorated with a display name derived from its source path, for rendering only. */
export interface DisplayClip extends Clip {
  name: string
}

/** A VideoTrackItem decorated with a display name, for rendering only. */
export interface DisplayVideoItem extends VideoTrackItem {
  name: string
}
