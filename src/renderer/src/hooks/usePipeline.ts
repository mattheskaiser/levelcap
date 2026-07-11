import { useCallback, useState } from 'react'
import type { ExportResult, Segment, SourceVideo } from '@shared/types'

export type Stage = 'upload' | 'processing' | 'workspace'

export interface ProcessingProgress {
  audioExtracted: boolean
  transcribePercent: number
  normalizePercent: number
}

const initialProgress: ProcessingProgress = {
  audioExtracted: false,
  transcribePercent: 0,
  normalizePercent: 0
}

export interface PipelineState {
  stage: Stage
  progress: ProcessingProgress
  errorMessage: string | null
  segments: Segment[]
  normalizedVideoPath: string | null
  isExporting: boolean
  exported: ExportResult | null
  selectVideo: () => void
  importDroppedPath: (filePath: string) => void
  updateSegmentText: (id: string, text: string) => void
  nudgeSegmentTime: (id: string, field: 'startSec' | 'endSec', deltaSec: number) => void
  deleteSegment: (id: string) => void
  runExport: () => void
  reset: () => void
}

export function usePipeline(): PipelineState {
  const [stage, setStage] = useState<Stage>('upload')
  const [progress, setProgress] = useState<ProcessingProgress>(initialProgress)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [normalizedVideoPath, setNormalizedVideoPath] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exported, setExported] = useState<ExportResult | null>(null)

  const startPipeline = useCallback((video: SourceVideo) => {
    setErrorMessage(null)
    setProgress(initialProgress)
    setStage('processing')

    void window.api
      .runPipeline(video, (event) => {
        if (event.phase === 'extracting-audio') {
          setProgress((p) => ({ ...p, audioExtracted: true }))
        } else if (event.phase === 'transcribing') {
          setProgress((p) => ({ ...p, transcribePercent: event.percent }))
        } else if (event.phase === 'normalizing') {
          setProgress((p) => ({ ...p, normalizePercent: event.percent }))
        } else if (event.phase === 'done') {
          setNormalizedVideoPath(event.normalizedVideoPath)
          setSegments(event.segments)
          setStage('workspace')
        }
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : String(err))
        setStage('upload')
      })
  }, [])

  const selectVideo = useCallback(() => {
    void window.api.selectVideo().then((video) => {
      if (video) startPipeline(video)
    })
  }, [startPipeline])

  const importDroppedPath = useCallback(
    (filePath: string) => {
      void window.api.importVideoFromPath(filePath).then(startPipeline)
    },
    [startPipeline]
  )

  const updateSegmentText = useCallback((id: string, text: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }, [])

  const nudgeSegmentTime = useCallback(
    (id: string, field: 'startSec' | 'endSec', deltaSec: number) => {
      setSegments((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s
          const next = Math.max(0, +(s[field] + deltaSec).toFixed(2))
          if (field === 'startSec') return { ...s, startSec: Math.min(next, s.endSec - 0.1) }
          return { ...s, endSec: Math.max(next, s.startSec + 0.1) }
        })
      )
    },
    []
  )

  const deleteSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const runExport = useCallback(() => {
    if (!normalizedVideoPath) return
    setIsExporting(true)
    void window.api
      .exportResult(normalizedVideoPath, segments)
      .then((result) => setExported(result))
      .finally(() => setIsExporting(false))
  }, [normalizedVideoPath, segments])

  const reset = useCallback(() => {
    setStage('upload')
    setProgress(initialProgress)
    setSegments([])
    setNormalizedVideoPath(null)
    setExported(null)
    setErrorMessage(null)
  }, [])

  return {
    stage,
    progress,
    errorMessage,
    segments,
    normalizedVideoPath,
    isExporting,
    exported,
    selectVideo,
    importDroppedPath,
    updateSegmentText,
    nudgeSegmentTime,
    deleteSegment,
    runExport,
    reset
  }
}
