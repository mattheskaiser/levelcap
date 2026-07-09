import type { Clip } from '@shared/types'

/** A Clip decorated with a display name derived from its source path, for rendering only. */
export interface DisplayClip extends Clip {
  name: string
}
