import type { Segment } from '@shared/types'

function formatTimestamp(totalSec: number): string {
  const ms = Math.max(0, Math.round(totalSec * 1000))
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const millis = ms % 1000
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`
}

export function toSrt(segments: Segment[]): string {
  return segments
    .map((seg, index) => {
      const start = formatTimestamp(seg.startSec)
      const end = formatTimestamp(seg.endSec)
      return `${index + 1}\n${start} --> ${end}\n${seg.text}\n`
    })
    .join('\n')
}
