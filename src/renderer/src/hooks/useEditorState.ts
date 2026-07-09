import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { CaptionSegment, Clip, Project } from '@shared/types'
import { initialTracks } from '../mock/data'
import type {
  ExportPhase,
  MockTrack,
  MockUploadedTrack,
  MusicTab,
  NormalizeStatus,
  RightTab,
  SaveStatus
} from '../mock/types'
import type { DisplayClip } from '../types'
import { junctionKey, toDisplayClip } from '../utils/format'

const MAX_HISTORY = 50
const AUTOSAVE_DELAY_MS = 800

/** The persisted, undoable part of a project — everything else here is ephemeral UI state. */
interface DocState {
  mediaBinClips: Clip[]
  timelineClips: Clip[]
  captions: CaptionSegment[]
  fadeJunctions: string[]
  normalizedClipIds: string[]
}

function docFromProject(project: Project): DocState {
  return {
    mediaBinClips: project.mediaBinClips,
    timelineClips: project.timelineClips,
    captions: project.captions,
    fadeJunctions: project.settings.fadeJunctions,
    normalizedClipIds: project.settings.normalizedClipIds
  }
}

function reindexOrder(clips: Clip[]): Clip[] {
  return clips.map((c, i) => ({ ...c, order: i }))
}

interface ExportEngine {
  phase: ExportPhase
  percent: number
  clipIdx: number
}

export interface UseEditorStateOptions {
  project: Project
}

export interface EditorState {
  mediaBin: DisplayClip[]
  timelineClips: DisplayClip[]
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
  captions: CaptionSegment[]
  editingCaptionId: string | null
  editDraft: string
  isPlaying: boolean
  currentSec: number
  exportPhase: ExportPhase
  exportPercent: number
  totalDurationSec: number
  saveStatus: SaveStatus
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
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

export function useEditorState({ project }: UseEditorStateOptions): EditorState {
  const [doc, setDocRaw] = useState<DocState>(() => docFromProject(project))
  const docRef = useRef(doc)

  const [undoStack, setUndoStack] = useState<DocState[]>([])
  const [redoStack, setRedoStack] = useState<DocState[]>([])

  const [draggingBinId, setDraggingBinId] = useState<string | null>(null)
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null)
  const [dragOverClipId, setDragOverClipId] = useState<string | null>(null)
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([])

  const [activeRightTab, setActiveRightTab] = useState<RightTab>('captions')

  const [normalizeStatus, setNormalizeStatus] = useState<NormalizeStatus>('idle')

  const [musicTab, setMusicTab] = useState<MusicTab>('library')
  const [tracks] = useState(initialTracks)
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [uploadedTrack, setUploadedTrack] = useState<MockUploadedTrack | null>(null)
  const [uploadIsSelected, setUploadIsSelected] = useState(false)
  const [previewingUpload, setPreviewingUpload] = useState(false)

  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSec, setCurrentSec] = useState(0)

  const [exportPhase, setExportPhase] = useState<ExportPhase>(null)
  const [exportPercent, setExportPercent] = useState(0)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const normalizeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const exportTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const exportEngineRef = useRef<ExportEngine>({ phase: null, percent: 0, clipIdx: 0 })
  const playTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const totalDurationRef = useRef(0)
  const isFirstDocEffectRef = useRef(true)

  const totalDurationSec = doc.timelineClips.reduce(
    (acc, c) => acc + (c.trimEndSec - c.trimStartSec),
    0
  )

  useEffect(() => {
    totalDurationRef.current = totalDurationSec
  }, [totalDurationSec])

  function buildProjectPayload(d: DocState): Project {
    return {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      mediaBinClips: d.mediaBinClips,
      timelineClips: d.timelineClips,
      captions: d.captions,
      settings: {
        fadeJunctions: d.fadeJunctions,
        normalizedClipIds: d.normalizedClipIds
      }
    }
  }

  // Autosave: debounce writes to disk whenever the document changes.
  useEffect(() => {
    if (isFirstDocEffectRef.current) {
      isFirstDocEffectRef.current = false
      return
    }
    setSaveStatus('saving')
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      window.api.saveProject(buildProjectPayload(docRef.current)).then(
        () => setSaveStatus('saved'),
        () => setSaveStatus('error')
      )
    }, AUTOSAVE_DELAY_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  useEffect(() => {
    return (): void => {
      clearTimeout(normalizeTimerRef.current)
      clearInterval(exportTimerRef.current)
      clearInterval(playTimerRef.current)
      clearTimeout(saveTimerRef.current)
      void window.api.saveProject(buildProjectPayload(docRef.current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commitDoc(next: DocState): void {
    const prev = docRef.current
    setUndoStack((u) => [...u, prev].slice(-MAX_HISTORY))
    setRedoStack([])
    docRef.current = next
    setDocRaw(next)
  }

  function undo(): void {
    const prevDoc = undoStack[undoStack.length - 1]
    if (!prevDoc) return
    setRedoStack((r) => [...r, docRef.current])
    setUndoStack((u) => u.slice(0, -1))
    docRef.current = prevDoc
    setDocRaw(prevDoc)
  }

  function redo(): void {
    const nextDoc = redoStack[redoStack.length - 1]
    if (!nextDoc) return
    setUndoStack((u) => [...u, docRef.current])
    setRedoStack((r) => r.slice(0, -1))
    docRef.current = nextDoc
    setDocRaw(nextDoc)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const isEditableTarget = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.key.toLowerCase() !== 'z' || isEditableTarget) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  function clipLabelForTime(t: number): string {
    let acc = 0
    for (let i = 0; i < doc.timelineClips.length; i++) {
      const c = doc.timelineClips[i]
      if (!c) continue
      const dur = c.trimEndSec - c.trimStartSec
      if (t >= acc && t < acc + dur) return `Clip ${i + 1}`
      acc += dur
    }
    return doc.timelineClips.length ? `Clip ${doc.timelineClips.length}` : '—'
  }

  function importClip(): void {
    void (async (): Promise<void> => {
      const imported = await window.api.selectAndImportClips()
      if (imported.length === 0) return
      commitDoc({ ...doc, mediaBinClips: [...doc.mediaBinClips, ...imported] })
    })()
  }

  function addBinItemToTimeline(binId: string): void {
    const item = doc.mediaBinClips.find((b) => b.id === binId)
    if (!item) return
    commitDoc({
      ...doc,
      mediaBinClips: doc.mediaBinClips.filter((b) => b.id !== binId),
      timelineClips: reindexOrder([...doc.timelineClips, item])
    })
  }

  function reorderClips(draggedId: string, targetId: string): void {
    if (draggedId === targetId) return
    const clips = [...doc.timelineClips]
    const from = clips.findIndex((c) => c.id === draggedId)
    const to = clips.findIndex((c) => c.id === targetId)
    if (from < 0 || to < 0) return
    const item = clips[from]
    if (!item) return
    clips.splice(from, 1)
    clips.splice(to, 0, item)
    commitDoc({ ...doc, timelineClips: reindexOrder(clips) })
  }

  function toggleClipSelection(id: string): void {
    setSelectedClipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function runNormalize(): void {
    const scope = selectedClipIds.length ? selectedClipIds : doc.timelineClips.map((c) => c.id)
    clearTimeout(normalizeTimerRef.current)
    setNormalizeStatus('running')
    normalizeTimerRef.current = setTimeout(() => {
      setNormalizeStatus('done')
      commitDoc({ ...docRef.current, normalizedClipIds: scope })
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
    const idxA = doc.timelineClips.findIndex((c) => c.id === selA)
    const idxB = doc.timelineClips.findIndex((c) => c.id === selB)
    if (idxA < 0 || idxB < 0 || Math.abs(idxA - idxB) !== 1) return [null, null]
    return idxA < idxB ? [selA, selB] : [selB, selA]
  }

  function toggleFadeAction(): void {
    const [a, b] = orderedSelectedPair()
    if (!a || !b) return
    const key = junctionKey(a, b)
    const fadeJunctions = doc.fadeJunctions.includes(key)
      ? doc.fadeJunctions.filter((k) => k !== key)
      : [...doc.fadeJunctions, key]
    commitDoc({ ...doc, fadeJunctions })
  }

  function removeFade(key: string): void {
    commitDoc({ ...doc, fadeJunctions: doc.fadeJunctions.filter((k) => k !== key) })
  }

  function startEditCaption(id: string, currentText: string): void {
    setEditingCaptionId(id)
    setEditDraft(currentText)
  }

  function updateDraft(text: string): void {
    setEditDraft(text)
  }

  function commitCaptionEdit(id: string): void {
    const captions = doc.captions.map((c) => (c.id === id ? { ...c, text: editDraft } : c))
    commitDoc({ ...doc, captions })
    setEditingCaptionId(null)
  }

  function cancelEdit(): void {
    setEditingCaptionId(null)
  }

  function adjustCaptionTime(id: string, field: 'startSec' | 'endSec', delta: number): void {
    const captions = doc.captions.map((c) => {
      if (c.id !== id) return c
      let v = Math.max(0, +(c[field] + delta).toFixed(1))
      if (field === 'startSec') v = Math.min(v, c.endSec - 0.1)
      if (field === 'endSec') v = Math.max(v, c.startSec + 0.1)
      return { ...c, [field]: v }
    })
    commitDoc({ ...doc, captions })
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
    const totalClips = doc.timelineClips.length || 1
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
    mediaBin: doc.mediaBinClips.map(toDisplayClip),
    timelineClips: doc.timelineClips.map(toDisplayClip),
    draggingBinId,
    draggingClipId,
    dragOverClipId,
    selectedClipIds,
    activeRightTab,
    setActiveRightTab,
    fadeJunctions: doc.fadeJunctions,
    normalizedIds: doc.normalizedClipIds,
    normalizeStatus,
    musicTab,
    setMusicTab,
    tracks,
    selectedTrackId,
    previewingId,
    uploadedTrack,
    uploadIsSelected,
    previewingUpload,
    captions: doc.captions,
    editingCaptionId,
    editDraft,
    isPlaying,
    currentSec,
    exportPhase,
    exportPercent,
    totalDurationSec,
    saveStatus,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undo,
    redo,
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
