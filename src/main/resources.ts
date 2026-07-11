import { join } from 'path'
import { app } from 'electron'

// resources/whisper is listed under electron-builder's asarUnpack, so in a
// packaged app it lands next to (not inside) app.asar, under app.asar.unpacked.
function resourcesRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'resources')
    : join(app.getAppPath(), 'resources')
}

export function whisperCliPath(): string {
  return join(resourcesRoot(), 'whisper', 'bin', 'Release', 'whisper-cli.exe')
}

export function whisperModelPath(): string {
  return join(resourcesRoot(), 'whisper', 'models', 'ggml-base.en.bin')
}
