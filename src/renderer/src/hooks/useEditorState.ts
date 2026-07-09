import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { initialCaptions, initialMediaBin, initialTimelineClips, initialTracks } from '../mock/data'
import { junctionKey } from '../mock/format'
import type {
  ExportPhase,
  MockCaption,
  MockClip,
  MockTrack,
  MockUploadedTrack,
  MusicTab,
  NormalizeStatus,
  RightTab
} from '../mock/types'

interface ExportEngine {
  phase: ExportPhase
  percent: number
  clipIdx: number
}

export interface EditorState {
  mediaBin: MockClip[]
  timelineClips: MockClip[]
  draggingBinId: string | null
  draggingClipId: string | null
  dragOverClipId: string | null
  selectedClipIds: string[]
  activeRightTab: RightTab
  setActiveRightTab: Dispatch<SetStateAction<RightTab>>
  fadeJunctions: string[]
  normalizedIds: string[]
  normalizeStatus: NormalizeStatus
  musicTab: MusicTab
  setMusicTab: Dispatch<SetStateAction<MusicTab>>
  tracks: MockTrack[]
  selectedTrackId: string | null
  previewingId: string | null
  uploadedTrack: MockUploadedTrack | null
  uploadIsSelected: boolean
  previewingUpload: boolean
  captions: MockCaption[]
  editingCaptionId: string | null
  editDraft: string
  isPlaying: boolean
  currentSec: number
  exportPhase: ExportPhase
  exportPercent: number
  totalDurationSec: number
  clipLabelForTime: (t: number) => string
  importClip: () => void
  addBinItemToTimeline: (binId: string) => void
  setDraggingBinId: Dispatch<SetStateAction<string | null>>
  setDraggingClipId: Dispatch<SetStateAction<string | null>>
  setDragOverClipId: Dispatch<SetStateAction<string | null>>
  reorderClips: (draggedId: string, targetId: string) => void
  toggleClipSelection: (id: string) => void
  runNormalize: () => void
  selectTrack: (id: string) => void
  togglePreviewTrack: (id: string) => void
  simulateUpload: () => void
  selectUploadedTrack: () => void
  toggleUploadPreview: () => void
  orderedSelectedPair: () => [string, string] | [null, null]
  toggleFadeAction: () => void
  removeFade: (key: string) => void
  startEditCaption: (id: string, currentText: string) => void
  updateDraft: (text: string) => void
  commitCaptionEdit: (id: string) => void
  cancelEdit: () => void
  adjustCaptionTime: (id: string, field: 'startSec' | 'endSec', delta: number) => void
  togglePlay: () => void
  onScrub: (pct: number) => void
  runExport: () => void
  resetExport: () => void
}

export interface UseEditorStateOptions {
  /** Seed the editor with the bundled demo footage/captions instead of starting blank. */
  demo: boolean
}

export function useEditorState({ demo }: UseEditorStateOptions): EditorState {
  const [mediaBin, setMediaBin] = useState(demo ? initialMediaBin : [])
  const [timelineClips, setTimelineClips] = useState(demo ? initialTimelineClips : [])
  const [nextImportN, setNextImportN] = useState(41)

  const [draggingBinId, setDraggingBinId] = useState<string | null>(null)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [dragOverClipId, setDragOverClipId] = useState<string | null>(null)
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([])

  const [activeRightTab, setActiveRightTab] = useState<RightTab>('captions')

  const [fadeJunctions, setFadeJunctions] = useState<string[]>([])
  const [normalizedIds, setNormalizedIds] = useState<string[]>([])
  const [normalizeStatus, setNormalizeStatus] = useState<NormalizeStatus>('idle')

  const [musicTab, setMusicTab] = useState<MusicTab>('library')
  const [tracks] = useState(initialTracks)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [uploadedTrack, setUploadedTrack] = useState<MockUploadedTrack | null>(null)
  const [uploadIsSelected, setUploadIsSelected] = useState(false)
  const [previewingUpload, setPreviewingUpload] = useState(false)

  const [captions, setCaptions] = useState(demo ? initialCaptions : [])
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSec, setCurrentSec] = useState(0)

  const [exportPhase, setExportPhase] = useState<ExportPhase>(null)
  const [exportPercent, setExportPercent] = useState(0)

  const normalizeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const exportTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const exportEngineRef = useRef<ExportEngine>({ phase: null, percent: 0, clipIdx: 0 })
  const playTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const totalDurationRef = useRef(0)

  const totalDurationSec = timelineClips.reduce((acc, c) => acc + c.durationSec, 0)

  useEffect(() => {
    totalDurationRef.current = totalDurationSec
  }, [totalDurationSec])

  useEffect(() => {
    return (): void => {
      clearTimeout(normalizeTimerRef.current)
      clearInterval(exportTimerRef.current)
      clearInterval(playTimerRef.current)
    }
  }, [])

  function clipLabelForTime(t: number): string {
    let acc = 0
    for (let i = 0; i < timelineClips.length; i++) {
      const c = timelineClips[i]
      if (!c) continue
      if (t >= acc && t < acc + c.durationSec) return `Clip ${i + 1}`
      acc += c.durationSec
    }
    return timelineClips.length ? `Clip ${timelineClips.length}` : '—'
  }

  function importClip(): void {
    const n = nextImportN
    const newClip: MockClip = {
      id: `b${Date.now()}`,
      name: `IMG_48${n}.MOV`,
      durationSec: +(6 + Math.random() * 18).toFixed(1),
      seed: n
    }
    setMediaBin((prev) => [...prev, newClip])
    setNextImportN(n + 1)
  }

  function addBinItemToTimeline(binId: string): void {
    const item = mediaBin.find((b) => b.id === binId)
    if (!item) return
    setMediaBin((prev) => prev.filter((b) => b.id !== binId))
    setTimelineClips((prev) => [...prev, item])
  }

  function reorderClips(draggedId: string, targetId: string): void {
    if (draggedId === targetId) return
    setTimelineClips((prev) => {
      const clips = [...prev]
      const from = clips.findIndex((c) => c.id === draggedId)
      const to = clips.findIndex((c) => c.id === targetId)
      if (from < 0 || to < 0) return prev
      const item = clips[from]
      if (!item) return prev
      clips.splice(from, 1)
      clips.splice(to, 0, item)
      return clips
    })
  }

  function toggleClipSelection(id: string): void {
    setSelectedClipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function runNormalize(): void {
    const scope = selectedClipIds.length ? selectedClipIds : timelineClips.map((c) => c.id)
    clearTimeout(normalizeTimerRef.current)
    setNormalizeStatus('running')
    normalizeTimerRef.current = setTimeout(() => {
      setNormalizeStatus('done')
      setNormalizedIds(scope)
    }, 1300)
  }

  function selectTrack(id: string): void {
    setSelectedTrackId(id)
    setUploadIsSelected(false)
  }

  function togglePreviewTrack(id: string): void {
    setPreviewingId((prev) => (prev === id ? null : id))
    setPreviewingUpload(false)
  }

  function simulateUpload(): void {
    setUploadedTrack({ name: 'my-track.mp3', durationSec: 132 })
  }

  function selectUploadedTrack(): void {
    setUploadIsSelected(true)
    setSelectedTrackId(null)
  }

  function toggleUploadPreview(): void {
    setPreviewingUpload((prev) => !prev)
    setPreviewingId(null)
  }

  function orderedSelectedPair(): [string, string] | [null, null] {
    if (selectedClipIds.length !== 2) return [null, null]
    const [selA, selB] = selectedClipIds
    if (!selA || !selB) return [null, null]
    const idxA = timelineClips.findIndex((c) => c.id === selA)
    const idxB = timelineClips.findIndex((c) => c.id === selB)
    if (idxA < 0 || idxB < 0 || Math.abs(idxA - idxB) !== 1) return [null, null]
    return idxA < idxB ? [selA, selB] : [selB, selA]
  }

  function toggleFadeAction(): void {
    const [a, b] = orderedSelectedPair()
    if (!a || !b) return
    const key = junctionKey(a, b)
    setFadeJunctions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function removeFade(key: string): void {
    setFadeJunctions((prev) => prev.filter((k) => k !== key))
  }

  function startEditCaption(id: string, currentText: string): void {
    setEditingCaptionId(id)
    setEditDraft(currentText)
  }

  function updateDraft(text: string): void {
    setEditDraft(text)
  }

  function commitCaptionEdit(id: string): void {
    setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, text: editDraft } : c)))
    setEditingCaptionId(null)
  }

  function cancelEdit(): void {
    setEditingCaptionId(null)
  }

  function adjustCaptionTime(id: string, field: 'startSec' | 'endSec', delta: number): void {
    setCaptions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        let v = Math.max(0, +(c[field] + delta).toFixed(1))
        if (field === 'startSec') v = Math.min(v, c.endSec - 0.1)
        if (field === 'endSec') v = Math.max(v, c.startSec + 0.1)
        return { ...c, [field]: v }
      })
    )
  }

  function togglePlay(): void {
    const willPlay = !isPlaying
    setIsPlaying(willPlay)
    clearInterval(playTimerRef.current)
    if (willPlay) {
      playTimerRef.current = setInterval(() => {
        setCurrentSec((prev) => {
          const total = totalDurationRef.current
          const next = prev + 0.25
          if (next >= total) {
            clearInterval(playTimerRef.current)
            setIsPlaying(false)
            return total
          }
          return next
        })
      }, 250)
    }
  }

  function onScrub(pct: number): void {
    setCurrentSec(pct * totalDurationSec)
  }

  function runExport(): void {
    const totalClips = timelineClips.length || 1
    exportEngineRef.current = { phase: 'normalizing', percent: 0, clipIdx: 0 }
    setExportPhase('normalizing')
    setExportPercent(0)
    clearInterval(exportTimerRef.current)
    exportTimerRef.current = setInterval(() => {
      const engine = exportEngineRef.current
      if (engine.phase === 'normalizing') {
        engine.clipIdx += 1
        if (engine.clipIdx >= totalClips) {
          engine.phase = 'transcribing'
          engine.percent = 0
        } else {
          engine.percent = Math.round((engine.clipIdx / totalClips) * 100)
        }
      } else if (engine.phase === 'transcribing') {
        const next = engine.percent + 14 + Math.random() * 10
        if (next >= 100) {
          engine.phase = 'rendering'
          engine.percent = 0
        } else {
          engine.percent = Math.round(next)
        }
      } else if (engine.phase === 'rendering') {
        const next = engine.percent + 10 + Math.random() * 8
        if (next >= 100) {
          engine.phase = 'done'
          engine.percent = 100
          clearInterval(exportTimerRef.current)
        } else {
          engine.percent = Math.round(next)
        }
      }
      setExportPhase(engine.phase)
      setExportPercent(engine.percent)
    }, 280)
  }

  function resetExport(): void {
    clearInterval(exportTimerRef.current)
    exportEngineRef.current = { phase: null, percent: 0, clipIdx: 0 }
    setExportPhase(null)
    setExportPercent(0)
  }

  return {
    mediaBin,
    timelineClips,
    draggingBinId,
    draggingClipId,
    dragOverClipId,
    selectedClipIds,
    activeRightTab,
    setActiveRightTab,
    fadeJunctions,
    normalizedIds,
    normalizeStatus,
    musicTab,
    setMusicTab,
    tracks,
    selectedTrackId,
    previewingId,
    uploadedTrack,
    uploadIsSelected,
    previewingUpload,
    captions,
    editingCaptionId,
    editDraft,
    isPlaying,
    currentSec,
    exportPhase,
    exportPercent,
    totalDurationSec,
    clipLabelForTime,
    importClip,
    addBinItemToTimeline,
    setDraggingBinId,
    setDraggingClipId,
    setDragOverClipId,
    reorderClips,
    toggleClipSelection,
    runNormalize,
    selectTrack,
    togglePreviewTrack,
    simulateUpload,
    selectUploadedTrack,
    toggleUploadPreview,
    orderedSelectedPair,
    toggleFadeAction,
    removeFade,
    startEditCaption,
    updateDraft,
    commitCaptionEdit,
    cancelEdit,
    adjustCaptionTime,
    togglePlay,
    onScrub,
    runExport,
    resetExport
  }
}
