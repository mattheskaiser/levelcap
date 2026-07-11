import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type {
  CaptionSegment,
  Clip,
  Project,
  TextTrackItem,
  Track,
  TrackItem,
  VideoTrackItem
} from '@shared/types'
import { CURRENT_SCHEMA_VERSION } from '@shared/types'
import {
  findTrackItem,
  itemDurationSec,
  itemEndSec,
  textItemsAcrossTracks,
  timelineDurationSec,
  videoItemsAcrossTracks
} from '@shared/tracks'
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
import type { DisplayClip, DisplayVideoItem } from '../types'
import { basename, junctionKey, toDisplayClip, toDisplayVideoItem } from '../utils/format'
import { locateActiveVideoItem } from '../utils/media'

const MAX_HISTORY = 50
const AUTOSAVE_DELAY_MS = 800
const MIN_CLIP_TRIM_SEC = 0.3
const OVERLAP_EPSILON_SEC = 0.001
const FADE_ADJACENCY_EPSILON_SEC = 0.05

/** The persisted, undoable part of a project — everything else here is ephemeral UI state. */
interface DocState {
  mediaBinClips: Clip[]
  tracks: Track[]
  fadeJunctions: string[]
  normalizedClipIds: string[]
}

function docFromProject(project: Project): DocState {
  return {
    mediaBinClips: project.mediaBinClips,
    tracks: project.tracks,
    fadeJunctions: project.settings.fadeJunctions,
    normalizedClipIds: project.settings.normalizedClipIds
  }
}

interface ExportEngine {
  phase: ExportPhase
  percent: number
  clipIdx: number
}

/** Snaps a desired start time away from overlapping any sibling on the same track — items on
 *  one track may never overlap in time; overlap across different tracks is fine (that's what
 *  tracks are for). */
function clampStartToAvoidOverlap(
  siblings: TrackItem[],
  excludingId: string,
  desiredStart: number,
  durationSec: number
): number {
  const occupied = siblings
    .filter((i) => i.id !== excludingId)
    .map((i) => ({ start: i.startSec, end: itemEndSec(i) }))
    .sort((a, b) => a.start - b.start)

  function overlapsAt(start: number): { start: number; end: number } | null {
    const end = start + durationSec
    for (const o of occupied) {
      if (start < o.end - OVERLAP_EPSILON_SEC && end > o.start + OVERLAP_EPSILON_SEC) return o
    }
    return null
  }

  const clampedDesired = Math.max(0, desiredStart)
  const hit = overlapsAt(clampedDesired)
  if (!hit) return clampedDesired

  const beforeCandidate = Math.max(0, hit.start - durationSec)
  const afterCandidate = hit.end
  const beforeOk = !overlapsAt(beforeCandidate)
  const afterOk = !overlapsAt(afterCandidate)

  if (beforeOk && afterOk) {
    return Math.abs(beforeCandidate - clampedDesired) <= Math.abs(afterCandidate - clampedDesired)
      ? beforeCandidate
      : afterCandidate
  }
  if (afterOk) return afterCandidate
  if (beforeOk) return beforeCandidate
  return occupied.reduce((max, o) => Math.max(max, o.end), 0)
}

function withMovedStart(item: TrackItem, newStart: number): TrackItem {
  if (item.kind === 'video') return { ...item, startSec: newStart }
  const duration = item.endSec - item.startSec
  return { ...item, startSec: newStart, endSec: newStart + duration }
}

export interface UseEditorStateOptions {
  project: Project
}

export interface EditorState {
  mediaBin: DisplayClip[]
  videoItems: DisplayVideoItem[]
  tracks: Track[]
  draggingBinId: string | null
  selectedClipIds: string[]
  activeClipId: string | null
  activeRightTab: RightTab
  setActiveRightTab: Dispatch<SetStateAction<RightTab>>
  fadeJunctions: string[]
  normalizedIds: string[]
  normalizeStatus: NormalizeStatus
  musicTab: MusicTab
  setMusicTab: Dispatch<SetStateAction<MusicTab>>
  musicLibraryTracks: MockTrack[]
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
  addBinItemToTimeline: (binId: string, trackId?: string, startSec?: number) => void
  setDraggingBinId: Dispatch<SetStateAction<string | null>>
  addTrack: () => void
  removeTrack: (trackId: string) => void
  reorderTracks: (draggedTrackId: string, targetTrackId: string) => void
  moveItemWithinTrack: (itemId: string, desiredStartSec: number) => void
  moveItemToTrack: (itemId: string, targetTrackId: string, desiredStartSec: number) => void
  resizeVideoItem: (itemId: string, trimEndSec: number) => void
  toggleClipSelection: (id: string) => void
  selectClip: (id: string, additive: boolean) => void
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
  moveCaption: (id: string, startSec: number, endSec: number) => void
  togglePlay: () => void
  onScrub: (pct: number) => void
  onPlaybackTimeUpdate: (sec: number) => void
  runExport: () => void
  resetExport: () => void
}

export function useEditorState({ project }: UseEditorStateOptions): EditorState {
  const [doc, setDocRaw] = useState<DocState>(() => docFromProject(project))
  const docRef = useRef(doc)

  const [undoStack, setUndoStack] = useState<DocState[]>([])
  const [redoStack, setRedoStack] = useState<DocState[]>([])

  const [draggingBinId, setDraggingBinId] = useState<string | null>(null)
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([])
  const [activeClipId, setActiveClipId] = useState<string | null>(null)

  const [activeRightTab, setActiveRightTab] = useState<RightTab>('captions')

  const [normalizeStatus, setNormalizeStatus] = useState<NormalizeStatus>('idle')

  const [musicTab, setMusicTab] = useState<MusicTab>('library')
  const [musicLibraryTracks] = useState(initialTracks)
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const totalDurationRef = useRef(0)
  const isFirstDocEffectRef = useRef(true)

  const totalDurationSec = timelineDurationSec(doc.tracks)

  useEffect(() => {
    totalDurationRef.current = totalDurationSec
  }, [totalDurationSec])

  function buildProjectPayload(d: DocState): Project {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      mediaBinClips: d.mediaBinClips,
      tracks: d.tracks,
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
    const active = locateActiveVideoItem(doc.tracks, t)
    return active ? basename(active.item.sourcePath) : '—'
  }

  function importClip(): void {
    void (async (): Promise<void> => {
      const imported = await window.api.selectAndImportClips()
      if (imported.length === 0) return
      commitDoc({ ...doc, mediaBinClips: [...doc.mediaBinClips, ...imported] })
    })()
  }

  function addBinItemToTimeline(binId: string, trackId?: string, startSec?: number): void {
    const binItem = doc.mediaBinClips.find((b) => b.id === binId)
    if (!binItem) return

    let tracks = doc.tracks
    let targetTrack = trackId ? tracks.find((t) => t.id === trackId) : undefined
    if (!targetTrack && !trackId) {
      targetTrack = tracks.find((t) => t.items.some((i) => i.kind === 'video'))
    }
    if (!targetTrack) {
      targetTrack = { id: crypto.randomUUID(), name: `Track ${tracks.length + 1}`, items: [] }
      tracks = [...tracks, targetTrack]
    }

    const duration = binItem.trimEndSec - binItem.trimStartSec
    const placedStart = clampStartToAvoidOverlap(
      targetTrack.items,
      binItem.id,
      startSec ?? timelineDurationSec([targetTrack]),
      duration
    )

    const newItem: VideoTrackItem = {
      kind: 'video',
      id: binItem.id,
      sourcePath: binItem.sourcePath,
      durationSec: binItem.durationSec,
      trimStartSec: binItem.trimStartSec,
      trimEndSec: binItem.trimEndSec,
      startSec: placedStart
    }

    const targetTrackId = targetTrack.id
    const nextTracks = tracks.map((t) =>
      t.id === targetTrackId ? { ...t, items: [...t.items, newItem] } : t
    )

    commitDoc({
      ...doc,
      tracks: nextTracks,
      mediaBinClips: doc.mediaBinClips.filter((b) => b.id !== binId)
    })
  }

  function addTrack(): void {
    const track: Track = {
      id: crypto.randomUUID(),
      name: `Track ${doc.tracks.length + 1}`,
      items: []
    }
    commitDoc({ ...doc, tracks: [...doc.tracks, track] })
  }

  function removeTrack(trackId: string): void {
    commitDoc({ ...doc, tracks: doc.tracks.filter((t) => t.id !== trackId) })
  }

  function reorderTracks(draggedTrackId: string, targetTrackId: string): void {
    if (draggedTrackId === targetTrackId) return
    const list = [...doc.tracks]
    const from = list.findIndex((t) => t.id === draggedTrackId)
    const to = list.findIndex((t) => t.id === targetTrackId)
    if (from < 0 || to < 0) return
    const moved = list[from]
    if (!moved) return
    list.splice(from, 1)
    list.splice(to, 0, moved)
    commitDoc({ ...doc, tracks: list })
  }

  function moveItemWithinTrack(itemId: string, desiredStartSec: number): void {
    const found = findTrackItem(doc.tracks, itemId)
    if (!found) return
    const duration = itemDurationSec(found.item)
    const startSec = clampStartToAvoidOverlap(found.track.items, itemId, desiredStartSec, duration)
    const nextTracks = doc.tracks.map((t, i) =>
      i === found.trackIndex
        ? {
            ...t,
            items: t.items.map((it) => (it.id === itemId ? withMovedStart(it, startSec) : it))
          }
        : t
    )
    commitDoc({ ...doc, tracks: nextTracks })
  }

  function moveItemToTrack(itemId: string, targetTrackId: string, desiredStartSec: number): void {
    const found = findTrackItem(doc.tracks, itemId)
    if (!found) return
    if (found.track.id === targetTrackId) {
      moveItemWithinTrack(itemId, desiredStartSec)
      return
    }
    const targetTrack = doc.tracks.find((t) => t.id === targetTrackId)
    if (!targetTrack) return
    const duration = itemDurationSec(found.item)
    const startSec = clampStartToAvoidOverlap(targetTrack.items, itemId, desiredStartSec, duration)
    const movedItem = withMovedStart(found.item, startSec)
    const nextTracks = doc.tracks.map((t) => {
      if (t.id === found.track.id) return { ...t, items: t.items.filter((it) => it.id !== itemId) }
      if (t.id === targetTrackId) return { ...t, items: [...t.items, movedItem] }
      return t
    })
    commitDoc({ ...doc, tracks: nextTracks })
  }

  /** Commits a video item's final out-point — called once at the end of a drag-to-trim gesture,
   *  so a whole drag is a single undo entry. Clamps against the next same-track item's start so
   *  trimming never ripples/overlaps into whatever comes after it. */
  function resizeVideoItem(itemId: string, trimEndSec: number): void {
    const found = findTrackItem(doc.tracks, itemId)
    if (!found || found.item.kind !== 'video') return
    const item = found.item

    const nextNeighborStart = found.track.items
      .filter((i) => i.id !== itemId && i.startSec > item.startSec)
      .reduce((min, i) => Math.min(min, i.startSec), Infinity)
    const maxTrimEnd = Number.isFinite(nextNeighborStart)
      ? item.trimStartSec + (nextNeighborStart - item.startSec)
      : item.durationSec

    const clampedTrimEnd = Math.min(
      item.durationSec,
      maxTrimEnd,
      Math.max(trimEndSec, item.trimStartSec + MIN_CLIP_TRIM_SEC)
    )

    const nextTracks = doc.tracks.map((t, i) =>
      i === found.trackIndex
        ? {
            ...t,
            items: t.items.map((it) =>
              it.id === itemId && it.kind === 'video' ? { ...it, trimEndSec: clampedTrimEnd } : it
            )
          }
        : t
    )
    commitDoc({ ...doc, tracks: nextTracks })
  }

  function toggleClipSelection(id: string): void {
    setSelectedClipIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  /** Timeline click behavior: a plain click sets which single clip is "active" (jumps the
   *  player to it) without touching the multi-select used for fade/normalize scope; Ctrl/Cmd
   *  click instead toggles that multi-select, uncoupled from which clip is previewing. */
  function selectClip(id: string, additive: boolean): void {
    if (additive) {
      toggleClipSelection(id)
      return
    }
    setActiveClipId(id)
    const found = findTrackItem(doc.tracks, id)
    if (found) setCurrentSec(found.item.startSec)
  }

  function runNormalize(): void {
    const scope = selectedClipIds.length
      ? selectedClipIds
      : videoItemsAcrossTracks(doc.tracks).map((i) => i.id)
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

  /** A fade is only offerable between exactly two selected video items that are on the SAME
   *  track and touch end-to-end (no gap) — array-index adjacency no longer means anything once
   *  items carry independent absolute positions. */
  function orderedSelectedPair(): [string, string] | [null, null] {
    if (selectedClipIds.length !== 2) return [null, null]
    const [selA, selB] = selectedClipIds
    if (!selA || !selB) return [null, null]
    const foundA = findTrackItem(doc.tracks, selA)
    const foundB = findTrackItem(doc.tracks, selB)
    if (!foundA || !foundB) return [null, null]
    if (foundA.item.kind !== 'video' || foundB.item.kind !== 'video') return [null, null]
    if (foundA.track.id !== foundB.track.id) return [null, null]
    const [first, second] =
      foundA.item.startSec <= foundB.item.startSec
        ? [foundA.item, foundB.item]
        : [foundB.item, foundA.item]
    const gap = Math.abs(second.startSec - itemEndSec(first))
    if (gap > FADE_ADJACENCY_EPSILON_SEC) return [null, null]
    return [first.id, second.id]
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

  function updateTextItem(id: string, updater: (item: TextTrackItem) => TextTrackItem): void {
    const found = findTrackItem(doc.tracks, id)
    if (!found || found.item.kind !== 'text') return
    const nextTracks = doc.tracks.map((t, i) =>
      i === found.trackIndex
        ? {
            ...t,
            items: t.items.map((it) => (it.id === id && it.kind === 'text' ? updater(it) : it))
          }
        : t
    )
    commitDoc({ ...doc, tracks: nextTracks })
  }

  function commitCaptionEdit(id: string): void {
    updateTextItem(id, (item) => ({ ...item, text: editDraft }))
    setEditingCaptionId(null)
  }

  function cancelEdit(): void {
    setEditingCaptionId(null)
  }

  function adjustCaptionTime(id: string, field: 'startSec' | 'endSec', delta: number): void {
    updateTextItem(id, (item) => {
      let v = Math.max(0, +(item[field] + delta).toFixed(1))
      if (field === 'startSec') v = Math.min(v, item.endSec - 0.1)
      if (field === 'endSec') v = Math.max(v, item.startSec + 0.1)
      return { ...item, [field]: v }
    })
  }

  /** Sets a caption's absolute timing (vs. adjustCaptionTime's nudge-by-delta) — used once, at
   *  the end of a drag-to-move/drag-to-resize gesture on the timeline's text track, so a whole
   *  drag collapses into a single undo entry instead of one per pointer-move. Also snapped away
   *  from overlapping another caption on the same text track. */
  function moveCaption(id: string, startSec: number, endSec: number): void {
    const found = findTrackItem(doc.tracks, id)
    if (!found || found.item.kind !== 'text') return
    const clampedStart = Math.max(0, startSec)
    const duration = Math.max(0.1, endSec - clampedStart)
    const safeStart = clampStartToAvoidOverlap(found.track.items, id, clampedStart, duration)
    updateTextItem(id, (item) => ({ ...item, startSec: safeStart, endSec: safeStart + duration }))
  }

  function togglePlay(): void {
    setIsPlaying((prev) => !prev)
  }

  function onScrub(pct: number): void {
    setCurrentSec(pct * totalDurationSec)
  }

  /** Driven by the real <video> element's timeupdate — replaces the old fake ticker. */
  function onPlaybackTimeUpdate(sec: number): void {
    const clamped = Math.max(0, Math.min(sec, totalDurationRef.current))
    setCurrentSec(clamped)
    if (clamped >= totalDurationRef.current - 0.02) {
      setIsPlaying(false)
    }
  }

  function runExport(): void {
    const totalClips = videoItemsAcrossTracks(doc.tracks).length || 1
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
    videoItems: videoItemsAcrossTracks(doc.tracks).map(toDisplayVideoItem),
    tracks: doc.tracks,
    draggingBinId,
    selectedClipIds,
    activeClipId,
    activeRightTab,
    setActiveRightTab,
    fadeJunctions: doc.fadeJunctions,
    normalizedIds: doc.normalizedClipIds,
    normalizeStatus,
    musicTab,
    setMusicTab,
    musicLibraryTracks,
    selectedTrackId,
    previewingId,
    uploadedTrack,
    uploadIsSelected,
    previewingUpload,
    captions: textItemsAcrossTracks(doc.tracks),
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
    addTrack,
    removeTrack,
    reorderTracks,
    moveItemWithinTrack,
    moveItemToTrack,
    resizeVideoItem,
    toggleClipSelection,
    selectClip,
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
    moveCaption,
    togglePlay,
    onScrub,
    onPlaybackTimeUpdate,
    runExport,
    resetExport
  }
}
