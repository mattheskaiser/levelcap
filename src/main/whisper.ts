import { randomUUID } from 'crypto'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { Segment } from '@shared/types'
import { whisperCliPath, whisperModelPath } from './resources'

// Subtitle-friendly segmentation: cap each whisper.cpp segment at this many
// characters and force splits on word boundaries (-sow), rather than
// re-grouping word-level timestamps ourselves.
const MAX_SEGMENT_CHARS = 42

interface WhisperJsonSegment {
  offsets: { from: number; to: number }
  text: string
}

interface WhisperJson {
  transcription: WhisperJsonSegment[]
}

export function whisperIsReady(): boolean {
  return existsSync(whisperCliPath()) && existsSync(whisperModelPath())
}

export async function transcribeAudio(
  wavPath: string,
  onProgress: (percent: number) => void
): Promise<Segment[]> {
  if (!whisperIsReady()) {
    throw new Error(
      'Whisper model not found. Run `npm run setup:whisper` once, then restart the app.'
    )
  }

  const outBase = join(app.getPath('temp'), `rushcut-whisper-${randomUUID()}`)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      whisperCliPath(),
      [
        '-m',
        whisperModelPath(),
        '-f',
        wavPath,
        '-of',
        outBase,
        '-oj',
        '-ml',
        String(MAX_SEGMENT_CHARS),
        '-sow',
        '-pp',
        '-l',
        'en'
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    )

    let tail = ''
    child.stderr.on('data', (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-256)
      for (const match of tail.matchAll(/progress\s*=\s*(\d+)%/g)) {
        const percent = Number(match[1])
        if (Number.isFinite(percent)) onProgress(percent)
      }
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`whisper-cli exited with code ${code}`))
    })
  })

  const raw = await readFile(`${outBase}.json`, 'utf-8')
  const parsed = JSON.parse(raw) as WhisperJson

  return parsed.transcription
    .map((seg) => ({
      id: randomUUID(),
      startSec: seg.offsets.from / 1000,
      endSec: seg.offsets.to / 1000,
      text: seg.text.trim()
    }))
    .filter((seg) => seg.text.length > 0)
}
