import { useCallback, useState } from 'react'

interface UploadScreenProps {
  onSelectVideo: () => void
  onDroppedPath: (filePath: string) => void
  errorMessage: string | null
}

function UploadScreen({
  onSelectVideo,
  onDroppedPath,
  errorMessage
}: UploadScreenProps): React.JSX.Element {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file) return
      const filePath = window.api.getPathForFile(file)
      if (filePath) onDroppedPath(filePath)
    },
    [onDroppedPath]
  )

  return (
    <div className="upload-screen">
      <div className="upload-screen__brand">Levelcap</div>
      <div
        className={`upload-dropzone${isDragging ? ' upload-dropzone--active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <p className="upload-dropzone__title">Drop a video here</p>
        <p className="upload-dropzone__subtitle">or</p>
        <button className="btn btn--primary" onClick={onSelectVideo}>
          Choose a video file
        </button>
      </div>
      {errorMessage && <p className="upload-screen__error">{errorMessage}</p>}
    </div>
  )
}

export default UploadScreen
