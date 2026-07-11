import { writeFile, copyFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { ipcMain, dialog } from 'electron'
import type { ExportResult, PipelineProgressEvent, Segment, SourceVideo } from '@shared/types'
import { importVideo } from './video'
import { runPipeline } from './pipeline'
import { toSrt } from './srt'

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'avi', 'mkv']

export function registerIpcHandlers(): void {
  ipcMain.handle('video:select', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: VIDEO_EXTENSIONS }]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return importVideo(result.filePaths[0])
  })

  ipcMain.handle('video:importPath', async (_event, filePath: string) => importVideo(filePath))

  ipcMain.on('pipeline:run', (event, requestId: string, video: SourceVideo) => {
    void runPipeline(video, (progress: PipelineProgressEvent) => {
      event.sender.send(`pipeline:progress:${requestId}`, progress)
    })
  })

  ipcMain.handle(
    'export:run',
    async (
      _event,
      normalizedVideoPath: string,
      segments: Segment[]
    ): Promise<ExportResult | null> => {
      const result = await dialog.showSaveDialog({
        defaultPath: 'export.mp4',
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
      })
      if (result.canceled || !result.filePath) return null

      const dir = dirname(result.filePath)
      const base = basename(result.filePath, extname(result.filePath))
      const videoPath = join(dir, `${base}.mp4`)
      const srtPath = join(dir, `${base}.srt`)

      await copyFile(normalizedVideoPath, videoPath)
      await writeFile(srtPath, toSrt(segments), 'utf-8')

      return { videoPath, srtPath }
    }
  )
}
