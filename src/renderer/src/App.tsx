import { usePipeline } from './hooks/usePipeline'
import UploadScreen from './components/UploadScreen'
import ProcessingScreen from './components/ProcessingScreen'
import WorkspaceScreen from './components/WorkspaceScreen'

function App(): React.JSX.Element {
  const pipeline = usePipeline()

  if (pipeline.stage === 'upload') {
    return (
      <UploadScreen
        onSelectVideo={pipeline.selectVideo}
        onDroppedPath={pipeline.importDroppedPath}
        errorMessage={pipeline.errorMessage}
      />
    )
  }

  if (pipeline.stage === 'processing') {
    return <ProcessingScreen progress={pipeline.progress} />
  }

  if (!pipeline.normalizedVideoPath) {
    return <div className="app-status">Something went wrong.</div>
  }

  return (
    <WorkspaceScreen
      normalizedVideoPath={pipeline.normalizedVideoPath}
      segments={pipeline.segments}
      isExporting={pipeline.isExporting}
      exported={pipeline.exported}
      onUpdateText={pipeline.updateSegmentText}
      onNudgeTime={pipeline.nudgeSegmentTime}
      onDeleteSegment={pipeline.deleteSegment}
      onExport={pipeline.runExport}
      onStartOver={pipeline.reset}
    />
  )
}

export default App
