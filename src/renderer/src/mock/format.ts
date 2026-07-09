export function formatClipTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatCaptionTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = (sec % 60).toFixed(1).padStart(4, '0')
  return `${m}:${s}`
}

export function waveformPath(seed: number): string {
  let d = 'M0 17'
  let v = seed
  for (let x = 0; x <= 140; x += 7) {
    v = (v * 9301 + 49297) % 233280
    const amp = (v / 233280) * 14 + 3
    const y = 17 + (x % 14 < 7 ? -amp : amp) / 2
    d += ` L${x} ${y.toFixed(1)}`
  }
  return d
}

export function junctionKey(idA: string, idB: string): string {
  return `${idA}__${idB}`
}
