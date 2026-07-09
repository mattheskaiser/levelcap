import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { path as ffprobePath } from '@ffprobe-installer/ffprobe'
import type { Clip } from '@shared/types'

const execFileAsync = promisify(execFile)

interface FfprobeFormat {
  format: {
    duration?: string
  }
}

async function probeDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    filePath
  ])
  const parsed = JSON.parse(stdout) as FfprobeFormat
  const duration = Number(parsed.format.duration)
  if (!Number.isFinite(duration)) {
    throw new Error(`Could not read duration for ${filePath}`)
  }
  return duration
}

export async function importClips(filePaths: string[]): Promise<Clip[]> {
  const clips: Clip[] = []
  for (const [index, sourcePath] of filePaths.entries()) {
    const durationSec = await probeDurationSec(sourcePath)
    clips.push({
      id: randomUUID(),
      sourcePath,
      order: index,
      durationSec,
      trimStartSec: 0,
      trimEndSec: durationSec
    })
  }
  return clips
}
