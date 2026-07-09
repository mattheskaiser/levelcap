import { existsSync } from 'fs'
import { execFile } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import { nodewhisper } from 'nodejs-whisper'

// Confirms ffmpeg-static and nodejs-whisper are wired up correctly from the
// main process. Does not run a real transcode/transcription: nodejs-whisper
// compiles whisper.cpp on first actual use (needs make/mingw on the host),
// so this only checks that the binary/module are resolvable and callable.
export function runSmokeTest(): void {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    console.error('[smoke-test] ffmpeg-static: binary not found at', ffmpegPath)
  } else {
    execFile(ffmpegPath, ['-version'], (error, stdout) => {
      if (error) {
        console.error('[smoke-test] ffmpeg-static: failed to run', error)
        return
      }
      console.log('[smoke-test] ffmpeg-static OK:', stdout.split('\n')[0])
    })
  }

  console.log(
    '[smoke-test] nodejs-whisper OK: nodewhisper is',
    typeof nodewhisper === 'function' ? 'callable' : 'MISSING'
  )
}
