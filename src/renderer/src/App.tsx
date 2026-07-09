import EditorHeader from './components/EditorHeader'
import MediaBinPanel from './components/MediaBinPanel'
import PlayerPanel from './components/PlayerPanel'
import RightPanel from './components/RightPanel'
import TimelinePanel from './components/TimelinePanel'
import { useEditorState } from './hooks/useEditorState'
import { formatClipTime } from './mock/format'

function App(): React.JSX.Element {
  const state = useEditorState()

  const clipCountLabel = `${state.timelineClips.length} ${
    state.timelineClips.length === 1 ? 'clip' : 'clips'
  }`

  return (
    <div className="editor">
      <EditorHeader
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
            currentSec={state.currentSec}
            totalDurationSec={state.totalDurationSec}
            isPlaying={state.isPlaying}
            clipLabel={state.clipLabelForTime(state.currentSec)}
            onTogglePlay={state.togglePlay}
            onScrub={state.onScrub}
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

export default App
