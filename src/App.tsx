import { useState, useCallback } from 'react'
import type { AppState, FloorPlan, ProcessingStep } from './services/types'
import { analyzeFloorPlan, getApiKey } from './services/floorPlanAnalyzer'
import { generateRoomRender, getRenderPrompt } from './services/renderGenerator'
import UploadZone from './components/UploadZone'
import ProcessingView from './components/ProcessingView'
import DollhouseView from './components/DollhouseView'
import FloorPlanOverlay from './components/FloorPlanOverlay'
import RoomPanel from './components/RoomPanel'
import ViewToggle from './components/ViewToggle'
import ApiKeyModal from './components/ApiKeyModal'
import './App.css'

function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [showApiModal, setShowApiModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<ProcessingStep[]>([])

  const updateStep = (index: number, updates: Partial<ProcessingStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

  const startProcessing = useCallback(async (previewUrl: string) => {
    setAppState('analyzing')
    setError(null)

    const processingSteps: ProcessingStep[] = [
      { label: 'Image uploaded', status: 'done' },
      { label: 'Detecting rooms', status: 'active' },
      { label: 'Extracting materials', status: 'pending' },
      { label: 'Building 3D model', status: 'pending' },
      { label: 'Rendering room views', status: 'pending' },
    ]
    setSteps(processingSteps)

    try {
      let base64: string
      if (previewUrl.startsWith('data:')) {
        base64 = previewUrl
      } else {
        const resp = await fetch(previewUrl)
        const blob = await resp.blob()
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      }

      const plan = await analyzeFloorPlan(base64)
      setFloorPlan(plan)

      updateStep(1, { status: 'done', detail: `${plan.rooms.length} rooms found` })
      updateStep(2, { status: 'done', detail: 'Materials mapped' })
      updateStep(3, { status: 'done' })

      setViewMode(plan.confidence > 0.7 ? '3d' : '2d')

      setAppState('rendering')
      updateStep(4, { status: 'active' })

      let completedCount = 0
      const totalRooms = plan.rooms.length

      plan.rooms.forEach((room) => {
        const prompt = getRenderPrompt(room)
        generateRoomRender(room)
          .then(renderUrl => {
            setFloorPlan(prev => {
              if (!prev) return prev
              return {
                ...prev,
                rooms: prev.rooms.map(r =>
                  r.id === room.id ? { ...r, renderUrl, renderPrompt: prompt } : r
                ),
              }
            })
          })
          .catch(() => {
            setFloorPlan(prev => {
              if (!prev) return prev
              return {
                ...prev,
                rooms: prev.rooms.map(r =>
                  r.id === room.id ? { ...r, renderPrompt: prompt } : r
                ),
              }
            })
          })
          .finally(() => {
            completedCount++
            if (completedCount === totalRooms) {
              updateStep(4, { status: 'done' })
            }
          })
      })

      setAppState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
      setAppState('idle')
    }
  }, [])

  const handleFileSelected = useCallback((_file: File, previewUrl: string) => {
    setImageUrl(previewUrl)
    if (!getApiKey()) {
      setShowApiModal(true)
      return
    }
    startProcessing(previewUrl)
  }, [startProcessing])

  const handleApiKeySet = () => {
    setShowApiModal(false)
    if (imageUrl) startProcessing(imageUrl)
  }

  const selectedRoom = floorPlan?.rooms.find(r => r.id === selectedRoomId) ?? null

  const breadcrumb = appState === 'idle' ? 'New Project'
    : appState === 'ready' && floorPlan ? floorPlan.name
    : 'Processing...'

  return (
    <div className="app">
      <nav className="app-nav">
        <span className="nav-logo">SpaceWalk</span>
        <span className="nav-sep">/</span>
        <span className="nav-breadcrumb">{breadcrumb}</span>
        {appState === 'ready' && (
          <button
            className="nav-reset"
            onClick={() => {
              setAppState('idle')
              setFloorPlan(null)
              setImageUrl(null)
              setSelectedRoomId(null)
              setError(null)
            }}
          >
            ← New
          </button>
        )}
        <button
          className="nav-settings"
          onClick={() => setShowApiModal(true)}
          style={{ marginLeft: 'auto' }}
        >
          ⚙
        </button>
      </nav>

      <main className="app-main">
        {appState === 'idle' && (
          <UploadZone onFileSelected={handleFileSelected} />
        )}

        {(appState === 'analyzing' || appState === 'rendering') && imageUrl && (
          <ProcessingView imageUrl={imageUrl} steps={steps} />
        )}

        {appState === 'ready' && floorPlan && (
          <div className="explore-view">
            <div className="explore-main">
              <ViewToggle view={viewMode} onToggle={setViewMode} />
              {viewMode === '3d' ? (
                <DollhouseView
                  rooms={floorPlan.rooms}
                  selectedRoomId={selectedRoomId}
                  onRoomClick={setSelectedRoomId}
                  onRoomHover={setHoveredRoomId}
                  hoveredRoomId={hoveredRoomId}
                />
              ) : (
                <FloorPlanOverlay
                  imageUrl={floorPlan.originalImage}
                  rooms={floorPlan.rooms}
                  selectedRoomId={selectedRoomId}
                  onRoomClick={setSelectedRoomId}
                  onRoomHover={setHoveredRoomId}
                  hoveredRoomId={hoveredRoomId}
                />
              )}
            </div>
            {selectedRoom && (
              <RoomPanel
                room={selectedRoom}
                onClose={() => setSelectedRoomId(null)}
              />
            )}
          </div>
        )}

        {error && (
          <div className="error-banner">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}
      </main>

      {showApiModal && (
        <ApiKeyModal
          onKeySet={handleApiKeySet}
          onClose={() => setShowApiModal(false)}
        />
      )}
    </div>
  )
}

export default App
