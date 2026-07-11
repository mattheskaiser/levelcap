import { MEDIA_PROTOCOL } from '@shared/media'

export function toMediaUrl(sourcePath: string): string {
  return `${MEDIA_PROTOCOL}://local/${encodeURIComponent(sourcePath)}`
}
