export type AppState = 'idle' | 'analyzing' | 'rendering' | 'ready'

export interface Material {
  name: string
  surface: 'floor' | 'wall' | 'ceiling' | 'fixture'
  color?: string
}

export interface Room {
  id: string
  name: string
  label: string
  x: number
  y: number
  width: number
  height: number
  dimensions: string
  materials: Material[]
  renderUrl?: string
  renderPrompt?: string
}

export interface FloorPlan {
  name: string
  confidence: number
  rooms: Room[]
  originalImage: string
}

export interface ProcessingStep {
  label: string
  status: 'pending' | 'active' | 'done'
  detail?: string
}
