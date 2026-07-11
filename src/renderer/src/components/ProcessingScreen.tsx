import type { ProcessingProgress } from '../hooks/usePipeline'

interface ProcessingScreenProps {
  progress: ProcessingProgress
}

function ProcessingScreen({ progress }: ProcessingScreenProps): React.JSX.Element {
  return (
    <div className="processing-screen">
      <h1 className="processing-screen__heading">Processing your video…</h1>

      <div className="processing-step">
        <span>Transcribing speech</span>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${progress.transcribePercent}%` }} />
        </div>
      </div>

      <div className="processing-step">
        <span>Normalizing audio</span>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${progress.normalizePercent}%` }} />
        </div>
      </div>
    </div>
  )
}

export default ProcessingScreen
