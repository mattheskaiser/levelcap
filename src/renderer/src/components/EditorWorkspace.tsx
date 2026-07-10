import type { Project } from '@shared/types'
import EditorHeader from './EditorHeader'
import MediaBinPanel from './MediaBinPanel'
import PlayerPanel from './PlayerPanel'
import RightPanel from './RightPanel'
import TimelinePanel from './TimelinePanel'
import { useEditorState } from '../hooks/useEditorState'
import { formatClipTime } from '../utils/format'

interface EditorWorkspaceProps {
  project: Project
  onBack: () => void
}

function EditorWorkspace({ project, onBack }: EditorWorkspaceProps): React.JSX.Element {
  const state = useEditorState({ project })

  const clipCountLabel = `${state.timelineClips.length} ${
    state.timelineClips.length === 1 ? 'clip' : 'clips'
  }`

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

      <div className="editor__body">
        <MediaBinPanel
          items={state.mediaBin}
          draggingBinId={state.draggingBinId}
          onImportClip={state.importClip}
          onDragStart={state.setDraggingBinId}
          onDragEnd={() => state.setDraggingBinId(null)}
          onAddToTimeline={state.addBinItemToTimeline}
        />

        <div className="editor__center">
          <PlayerPanel
            clips={state.timelineClips}
            currentSec={state.currentSec}
            totalDurationSec={state.totalDurationSec}
            isPlaying={state.isPlaying}
            onTogglePlay={state.togglePlay}
            onScrub={state.onScrub}
            onPlaybackTimeUpdate={state.onPlaybackTimeUpdate}
          />

          <TimelinePanel
            clips={state.timelineClips}
            selectedClipIds={state.selectedClipIds}
            draggingClipId={state.draggingClipId}
            dragOverClipId={state.dragOverClipId}
            fadeJunctions={state.fadeJunctions}
            normalizedIds={state.normalizedIds}
            clipCountLabel={clipCountLabel}
            totalDurationLabel={formatClipTime(state.totalDurationSec)}
            onSelectClip={state.toggleClipSelection}
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
          />
        </div>

        <RightPanel {...state} />
      </div>
    </div>
  )
}

export default EditorWorkspace
