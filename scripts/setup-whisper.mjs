/* eslint-disable @typescript-eslint/explicit-function-return-type */
// One-time setup: downloads the prebuilt whisper.cpp Windows CLI + a ggml model into
// resources/whisper/ (gitignored) so transcription needs no local compiler and, once this
// has run, works fully offline. Re-run any time to re-fetch a missing/corrupted file.
import { createWriteStream, existsSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import extractZip from 'extract-zip'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const WHISPER_DIR = join(ROOT, 'resources', 'whisper')
const BIN_DIR = join(WHISPER_DIR, 'bin')
const MODELS_DIR = join(WHISPER_DIR, 'models')

const WHISPER_RELEASE_ZIP_URL =
  'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip'
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin'
const MODEL_PATH = join(MODELS_DIR, 'ggml-base.en.bin')
const CLI_PATH = join(BIN_DIR, 'Release', 'whisper-cli.exe')

async function download(url, destPath) {
  console.log(`Downloading ${url}`)
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }
  await mkdir(dirname(destPath), { recursive: true })
  await pipeline(response.body, createWriteStream(destPath))
}

async function setupBinary() {
  if (existsSync(CLI_PATH)) {
    console.log('whisper-cli.exe already present, skipping binary download.')
    return
  }
  const zipPath = join(WHISPER_DIR, 'whisper-bin-x64.zip')
  await download(WHISPER_RELEASE_ZIP_URL, zipPath)
  console.log('Extracting whisper-cli binary...')
  await extractZip(zipPath, { dir: BIN_DIR })
  await rm(zipPath, { force: true })
}

async function setupModel() {
  if (existsSync(MODEL_PATH)) {
    console.log('ggml-base.en.bin already present, skipping model download.')
    return
  }
  await download(MODEL_URL, MODEL_PATH)
}

await setupBinary()
await setupModel()

if (!existsSync(CLI_PATH) || !existsSync(MODEL_PATH)) {
  throw new Error('Setup finished but expected files are missing — see output above.')
}

console.log('Whisper setup complete:')
console.log(`  ${CLI_PATH}`)
console.log(`  ${MODEL_PATH}`)
