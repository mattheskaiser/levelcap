import { execFile } from 'child_process'
import { promisify } from 'util'
import ffmpegPath from 'ffmpeg-static'

const execFileAsync = promisify(execFile)
const MAX_BUFFER = 10 * 1024 * 1024

// dynaudnorm continuously adapts gain over a short sliding window, which is what actually
// evens out a single file's clips that were recorded at different levels (loudnorm alone
// only applies one constant gain for the whole file, so it can't fix that). loudnorm on top
// then brings the now-consistent result to a standard overall target loudness. -c:v copy
// keeps the video/overlay stream untouched.
const FILTER = 'dynaudnorm=f=250:g=9:m=20:p=0.95,loudnorm=I=-16:TP=-1.5:LRA=11'

export async function normalizeAudio(
  inputPath: string,
  outputPath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  onProgress(0)
  await execFileAsync(
    ffmpegPath as string,
    ['-y', '-i', inputPath, '-af', FILTER, '-c:v', 'copy', outputPath],
    { maxBuffer: MAX_BUFFER }
  )
  onProgress(100)
}
