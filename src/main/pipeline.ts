import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import ffmpegPath from 'ffmpeg-static'
import type { PipelineProgressEvent, SourceVideo } from '@shared/types'
import { transcribeAudio } from './whisper'
import { normalizeAudio } from './normalize'

const execFileAsync = promisify(execFile)

async function extractAudioWav(sourcePath: string, wavPath: string): Promise<void> {
  await execFileAsync(ffmpegPath as string, [
    '-y',
    '-i',
    sourcePath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    wavPath
  ])
}

export async function runPipeline(
  video: SourceVideo,
  onProgress: (event: PipelineProgressEvent) => void
): Promise<void> {
  const workDir = join(app.getPath('temp'), 'rushcut', randomUUID())
  await mkdir(workDir, { recursive: true })
  const wavPath = join(workDir, 'audio.wav')
  const normalizedPath = join(workDir, 'normalized.mp4')

  try {
    onProgress({ phase: 'extracting-audio' })
    await extractAudioWav(video.path, wavPath)

    // Transcription and normalization both only read the source/extracted audio, so
    // they run side by side rather than one after the other.
    const [segments] = await Promise.all([
      transcribeAudio(wavPath, (percent) => onProgress({ phase: 'transcribing', percent })),
      normalizeAudio(video.path, normalizedPath, (percent) =>
        onProgress({ phase: 'normalizing', percent })
      )
    ])

    onProgress({ phase: 'done', normalizedVideoPath: normalizedPath, segments })
  } catch (error) {
    onProgress({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
  } finally {
    await rm(wavPath, { force: true })
  }
}
