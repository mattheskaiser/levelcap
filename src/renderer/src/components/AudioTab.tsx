import ClipPickerList from './ClipPickerList'
import type { MockTrack, MockUploadedTrack, MusicTab, NormalizeStatus } from '../mock/types'
import type { DisplayClip } from '../types'
import { formatClipTime } from '../utils/format'

interface AudioTabProps {
  clips: DisplayClip[]
  selectedClipIds: string[]
  onToggleClipSelection: (id: string) => void
  normalizeStatus: NormalizeStatus
  onRunNormalize: () => void
  musicTab: MusicTab
  onSetMusicTab: (tab: MusicTab) => void
  tracks: MockTrack[]
  selectedTrackId: string | null
  previewingId: string | null
  uploadIsSelected: boolean
  onSelectTrack: (id: string) => void
  onTogglePreviewTrack: (id: string) => void
  uploadedTrack: MockUploadedTrack | null
  previewingUpload: boolean
  onSelectUploadedTrack: () => void
  onToggleUploadPreview: () => void
  onSimulateUpload: () => void
}

function AudioTab({
  clips,
  selectedClipIds,
  onToggleClipSelection,
  normalizeStatus,
  onRunNormalize,
  musicTab,
  onSetMusicTab,
  tracks,
  selectedTrackId,
  previewingId,
  uploadIsSelected,
  onSelectTrack,
  onTogglePreviewTrack,
  uploadedTrack,
  previewingUpload,
  onSelectUploadedTrack,
  onToggleUploadPreview,
  onSimulateUpload
}: AudioTabProps): React.JSX.Element {
  const normalizeLabel =
    normalizeStatus === 'running'
      ? 'Normalizing…'
      : normalizeStatus === 'done'
        ? 'Normalized'
        : 'Normalize Audio'
  const normalizeIcon =
    normalizeStatus === 'running' ? '↻' : normalizeStatus === 'done' ? '✓' : '⚡'
  const normalizeScopeHint = selectedClipIds.length
    ? `Applies to ${selectedClipIds.length} selected clip${selectedClipIds.length === 1 ? '' : 's'}.`
    : `No clips selected — applies to all ${clips.length} clips.`

  return (
    <div className="right-tab">
      <div className="right-tab__section">
        <div className="right-tab__section-title">Select clips</div>
        <ClipPickerList
          clips={clips}
          selectedClipIds={selectedClipIds}
          onToggle={onToggleClipSelection}
        />
      </div>

      <div className="right-tab__divider" />

      <div className="right-tab__section">
        <div className="right-tab__section-title">Normalize</div>
        <button
          className={`normalize-btn${normalizeStatus === 'done' ? ' normalize-btn--done' : ''}`}
          onClick={onRunNormalize}
        >
          <span className={`normalize-btn__icon${normalizeStatus === 'running' ? ' spin' : ''}`}>
            {normalizeIcon}
          </span>
          {normalizeLabel}
        </button>
        <p className="right-tab__hint">{normalizeScopeHint}</p>
      </div>

      <div className="right-tab__divider" />

      <div className="right-tab__section">
        <div className="right-tab__section-title">Background music</div>
        <div className="segmented">
          <button
            className={`segmented__btn${musicTab === 'library' ? ' segmented__btn--active' : ''}`}
            onClick={() => onSetMusicTab('library')}
          >
            Library track
          </button>
          <button
            className={`segmented__btn${musicTab === 'upload' ? ' segmented__btn--active' : ''}`}
            onClick={() => onSetMusicTab('upload')}
          >
            Upload your own
          </button>
        </div>

        {musicTab === 'library' && (
          <div className="track-list">
            {tracks.map((track) => {
              const isSelected = selectedTrackId === track.id && !uploadIsSelected
              const isPreviewing = previewingId === track.id
              return (
                <div
                  key={track.id}
                  className={`track-row${isSelected ? ' track-row--selected' : ''}`}
                  onClick={() => onSelectTrack(track.id)}
                >
                  <button
                    className="track-row__preview"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePreviewTrack(track.id)
                    }}
                  >
                    {isPreviewing ? '❚❚' : '▶'}
                  </button>
                  <div className="track-row__meta">
                    <div className="track-row__name">{track.name}</div>
                    <div className="track-row__duration mono">
                      {formatClipTime(track.durationSec)}
                    </div>
                  </div>
                  {isSelected && <span className="track-row__check">✓</span>}
                </div>
              )
            })}
          </div>
        )}

        {musicTab === 'upload' && (
          <>
            {uploadedTrack && (
              <div
                className={`track-row${uploadIsSelected ? ' track-row--selected' : ''}`}
                onClick={onSelectUploadedTrack}
              >
                <button
                  className="track-row__preview"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleUploadPreview()
                  }}
                >
                  {previewingUpload ? '❚❚' : '▶'}
                </button>
                <div className="track-row__meta">
                  <div className="track-row__name">{uploadedTrack.name}</div>
                  <div className="track-row__duration">Uploaded</div>
                </div>
                {uploadIsSelected && <span className="track-row__check">✓</span>}
              </div>
            )}
            <button className="upload-dropzone" onClick={onSimulateUpload}>
              <span className="upload-dropzone__icon">+</span>
              Drop an MP3 or browse
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default AudioTab
