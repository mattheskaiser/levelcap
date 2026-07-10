import { useRef, useState } from 'react'
import type { Project } from '@shared/types'
import EditorHeader from './EditorHeader'
import MediaBinPanel from './MediaBinPanel'
import PlayerPanel from './PlayerPanel'
import RightPanel from './RightPanel'
import TimelinePanel from './TimelinePanel'
import { useEditorState } from '../hooks/useEditorState'
import { formatClipTime } from '../utils/format'

const DEFAULT_TIMELINE_HEIGHT = 300
const MIN_TIMELINE_HEIGHT = 180
const MAX_TIMELINE_HEIGHT = 560

interface EditorWorkspaceProps {
  project: Project
  onBack: () => void
}

interface TrimPreview {
  sourcePath: string
  sourceTimeSec: number
}

function EditorWorkspace({ project, onBack }: EditorWorkspaceProps): React.JSX.Element {
  const state = useEditorState({ project })
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT)
  const resizeStartRef = useRef<{ clientY: number; height: number } | null>(null)
  const [trimPreview, setTrimPreview] = useState<TrimPreview | null>(null)

  const clipCountLabel = `${state.timelineClips.length} ${
    state.timelineClips.length === 1 ? 'clip' : 'clips'
  }`

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStartRef.current = { clientY: event.clientY, height: timelineHeight }
  }

  function handleResizePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const start = resizeStartRef.current
    if (!start) return
    const delta = event.clientY - start.clientY
    const next = Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, start.height - delta))
    setTimelineHeight(next)
  }

  function handleResizePointerUp(): void {
    resizeStartRef.current = null
  }

  return (
    <div className="editor">
      <EditorHeader
        projectName={project.name}
        onBack={onBack}
        saveStatus={state.saveStatus}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={state.undo}
        onRedo={state.redo}
        exportPhase={state.exportPhase}
        exportPercent={state.exportPercent}
        onExport={state.runExport}
        onResetExport={state.resetExport}
      />

      <div className="editor__main">
        <div className="editor__upper">
          <MediaBinPanel
            items={state.mediaBin}
            draggingBinId={state.draggingBinId}
            onImportClip={state.importClip}
            onDragStart={state.setDraggingBinId}
            onDragEnd={() => state.setDraggingBinId(null)}
            onAddToTimeline={state.addBinItemToTimeline}
          />

          <PlayerPanel
            clips={state.timelineClips}
            currentSec={state.currentSec}
            totalDurationSec={state.totalDurationSec}
            isPlaying={state.isPlaying}
            onTogglePlay={state.togglePlay}
            onPlaybackTimeUpdate={state.onPlaybackTimeUpdate}
            onScrub={state.onScrub}
            trimPreview={trimPreview}
          />

          <RightPanel {...state} />
        </div>

        <div
          className="editor__resize-handle"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />

        <TimelinePanel
          heightPx={timelineHeight}
          clips={state.timelineClips}
          selectedClipIds={state.selectedClipIds}
          activeClipId={state.activeClipId}
          draggingClipId={state.draggingClipId}
          dragOverClipId={state.dragOverClipId}
          fadeJunctions={state.fadeJunctions}
          normalizedIds={state.normalizedIds}
          clipCountLabel={clipCountLabel}
          totalDurationLabel={formatClipTime(state.totalDurationSec)}
          currentSec={state.currentSec}
          totalDurationSec={state.totalDurationSec}
          onScrub={state.onScrub}
          onSelectClip={state.selectClip}
          onClipDragStart={state.setDraggingClipId}
          onClipDragOver={state.setDragOverClipId}
          onClipDrop={(targetId) => {
            if (state.draggingClipId) state.reorderClips(state.draggingClipId, targetId)
            state.setDraggingClipId(null)
            state.setDragOverClipId(null)
          }}
          onClipDragEnd={() => {
            state.setDraggingClipId(null)
            state.setDragOverClipId(null)
          }}
          onTimelineDrop={() => {
            if (state.draggingBinId) {
              state.addBinItemToTimeline(state.draggingBinId)
              state.setDraggingBinId(null)
            }
          }}
          onResizeClip={state.resizeClip}
          onTrimPreview={setTrimPreview}
          captions={state.captions}
          onMoveCaption={state.moveCaption}
          selectedMusicTrack={state.selectedMusicTrack}
        />
      </div>
    </div>
  )
}

export default EditorWorkspace
