import AudioTab from './AudioTab'
import CaptionsTab from './CaptionsTab'
import FadeTab from './FadeTab'
import type { EditorState } from '../hooks/useEditorState'

type RightPanelProps = EditorState

function RightPanel(state: RightPanelProps): React.JSX.Element {
  const { activeRightTab, setActiveRightTab } = state

  return (
    <div className="right-panel">
      <div className="right-panel__tabs">
        <button
          className={`right-panel__tab${activeRightTab === 'captions' ? ' right-panel__tab--active' : ''}`}
          onClick={() => setActiveRightTab('captions')}
        >
          Captions
        </button>
        <button
          className={`right-panel__tab${activeRightTab === 'audio' ? ' right-panel__tab--active' : ''}`}
          onClick={() => setActiveRightTab('audio')}
        >
          Audio
        </button>
        <button
          className={`right-panel__tab${activeRightTab === 'fade' ? ' right-panel__tab--active' : ''}`}
          onClick={() => setActiveRightTab('fade')}
        >
          Fade
        </button>
      </div>

      {activeRightTab === 'captions' && (
        <CaptionsTab
          captions={state.captions}
          editingCaptionId={state.editingCaptionId}
          editDraft={state.editDraft}
          clipLabelForTime={state.clipLabelForTime}
          onStartEdit={state.startEditCaption}
          onDraftChange={state.updateDraft}
          onCommit={state.commitCaptionEdit}
          onCancel={state.cancelEdit}
          onAdjustTime={state.adjustCaptionTime}
        />
      )}

      {activeRightTab === 'audio' && (
        <AudioTab
          clips={state.videoItems}
          selectedClipIds={state.selectedClipIds}
          onToggleClipSelection={state.toggleClipSelection}
          normalizeStatus={state.normalizeStatus}
          onRunNormalize={state.runNormalize}
          musicTab={state.musicTab}
          onSetMusicTab={state.setMusicTab}
          tracks={state.musicLibraryTracks}
          selectedTrackId={state.selectedTrackId}
          previewingId={state.previewingId}
          uploadIsSelected={state.uploadIsSelected}
          onSelectTrack={state.selectTrack}
          onTogglePreviewTrack={state.togglePreviewTrack}
          uploadedTrack={state.uploadedTrack}
          previewingUpload={state.previewingUpload}
          onSelectUploadedTrack={state.selectUploadedTrack}
          onToggleUploadPreview={state.toggleUploadPreview}
          onSimulateUpload={state.simulateUpload}
        />
      )}

      {activeRightTab === 'fade' && (
        <FadeTab
          clips={state.videoItems}
          selectedClipIds={state.selectedClipIds}
          onToggleClipSelection={state.toggleClipSelection}
          orderedSelectedPair={state.orderedSelectedPair}
          fadeJunctions={state.fadeJunctions}
          onToggleFadeAction={state.toggleFadeAction}
          onRemoveFade={state.removeFade}
        />
      )}
    </div>
  )
}

export default RightPanel
