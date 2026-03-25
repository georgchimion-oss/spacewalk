# SpaceWalk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React app that takes a floor plan image, extracts room data via Claude Vision, renders a 3D dollhouse, and generates AI room renders via Pollinations.ai.

**Architecture:** State machine app (upload → processing → explore). Claude Vision analyzes the floor plan into structured room data. Three.js renders a 3D dollhouse with orbit controls. Pollinations.ai generates photorealistic room views. 2D overlay fallback when confidence is low.

**Tech Stack:** React 19, TypeScript, Vite, Three.js (@react-three/fiber + drei), Anthropic SDK, Pollinations.ai (fetch)

**Spec:** `docs/superpowers/specs/2026-03-25-spacewalk-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/services/types.ts` | All TypeScript interfaces (FloorPlan, Room, Material, AppState) |
| `src/services/floorPlanAnalyzer.ts` | Claude Vision API call, prompt, JSON parsing, SVG rasterization |
| `src/services/renderGenerator.ts` | Interior design prompt builder + Pollinations.ai fetch |
| `src/components/UploadZone.tsx` | Drag & drop file upload, validation, preview |
| `src/components/ProcessingView.tsx` | Scan animation, step progress indicators |
| `src/components/DollhouseView.tsx` | Three.js 3D room model, orbit controls, click/hover |
| `src/components/FloorPlanOverlay.tsx` | 2D fallback: hotspot zones over original image |
| `src/components/RoomPanel.tsx` | Side panel: AI render, room name, dims, materials |
| `src/components/ViewToggle.tsx` | Toggle button between 3D and 2D views |
| `src/components/ApiKeyModal.tsx` | Settings modal for entering Anthropic API key |
| `src/App.tsx` | State machine, layout, wires everything together |
| `src/App.css` | App-level styles (layout, panels, animations) |
| `src/index.css` | Georg design system (already done) |

---

## Task 1: Install Dependencies & Clean Scaffold

**Files:**
- Modify: `package.json`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Delete: `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`

- [ ] **Step 1: Install Three.js and Anthropic SDK**

```bash
cd /Users/georgchimion/Desktop/Coding/personal/spacewalk
npm install three @react-three/fiber @react-three/drei @anthropic-ai/sdk
npm install -D @types/three
```

- [ ] **Step 2: Create `.env` file**

Create `.env` at project root:
```
VITE_ANTHROPIC_API_KEY=
```

Add `.env` to `.gitignore` (Vite default only ignores `.env.local`, not `.env`):

```bash
echo ".env" >> .gitignore
```

- [ ] **Step 3: Clean out Vite boilerplate from App.tsx**

Replace `src/App.tsx` with a minimal shell:

```tsx
import { useState } from 'react'
import './App.css'

type AppState = 'idle' | 'uploading' | 'analyzing' | 'rendering' | 'ready'

function App() {
  const [appState, setAppState] = useState<AppState>('idle')

  return (
    <div className="app">
      <nav className="app-nav">
        <span className="nav-logo">SpaceWalk</span>
        <span className="nav-sep">/</span>
        <span className="nav-breadcrumb">
          {appState === 'idle' ? 'New Project' : 'Processing...'}
        </span>
      </nav>
      <main className="app-main">
        <p>State: {appState}</p>
      </main>
    </div>
  )
}

export default App
```

- [ ] **Step 4: Replace App.css with base layout styles**

```css
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 56px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border);
  background: rgba(8, 8, 10, 0.88);
  backdrop-filter: blur(24px) saturate(1.3);
}

.nav-logo {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}

.nav-sep { color: var(--text-3); font-weight: 300; }
.nav-breadcrumb { font-size: 13px; color: var(--text-3); }

.app-main {
  flex: 1;
  padding-top: 56px;
  display: flex;
}
```

- [ ] **Step 5: Delete boilerplate assets**

```bash
rm src/assets/hero.png src/assets/react.svg src/assets/vite.svg
```

- [ ] **Step 6: Verify dev server runs**

```bash
npm run dev
```

Open in browser — should show "SpaceWalk / New Project" nav and "State: idle".

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: clean scaffold, install three.js + anthropic deps"
```

---

## Task 2: Types & Data Model

**Files:**
- Create: `src/services/types.ts`

- [ ] **Step 1: Write all TypeScript interfaces**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/services/types.ts && git commit -m "feat: add TypeScript interfaces for FloorPlan, Room, Material"
```

---

## Task 3: Upload Zone Component

**Files:**
- Create: `src/components/UploadZone.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Build UploadZone component**

```tsx
import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react'

interface UploadZoneProps {
  onFileSelected: (file: File, previewUrl: string) => void
}

async function rasterizeSvg(file: File): Promise<string> {
  const text = await file.text()
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Scale up small SVGs while preserving aspect ratio
      const minWidth = 1600
      const scale = img.naturalWidth < minWidth ? minWidth / img.naturalWidth : 1
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#0a1628'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to rasterize SVG'))
    }
    img.src = url
  })
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

export default function UploadZone({ onFileSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a PNG, JPG, or SVG file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File too large. Max 20MB.')
      return
    }

    let previewUrl: string
    if (file.type === 'image/svg+xml') {
      previewUrl = await rasterizeSvg(file)
    } else {
      previewUrl = URL.createObjectURL(file)
    }
    onFileSelected(file, previewUrl)
  }, [onFileSelected])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  return (
    <div
      className={`upload-zone ${isDragging ? 'upload-zone--dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="upload-icon">📐</div>
      <div className="upload-text">Drop your floor plan here</div>
      <div className="upload-sub">PNG, JPG, or SVG — professional blueprints work best</div>
      <label className="upload-btn">
        Choose File
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.svg"
          onChange={handleChange}
          hidden
        />
      </label>
      {error && <div className="upload-error">{error}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Add UploadZone styles to App.css**

```css
/* Upload Zone */
.upload-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin: 40px;
  border: 2px dashed var(--border);
  border-radius: var(--r);
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-zone--dragging {
  border-color: var(--warm);
  background: var(--warm-glow);
}

.upload-icon { font-size: 48px; opacity: 0.3; }
.upload-text { font-size: 15px; color: var(--text-2); }
.upload-sub { font-size: 12px; color: var(--text-3); }

.upload-btn {
  padding: 10px 24px;
  background: var(--warm);
  color: #0A0A0B;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--r-sm);
  font-family: 'Space Grotesk', sans-serif;
  cursor: pointer;
  transition: background 0.2s;
}

.upload-btn:hover { background: var(--warm-2); }

.upload-error {
  color: var(--coral);
  font-size: 13px;
  margin-top: 8px;
}
```

- [ ] **Step 3: Wire UploadZone into App.tsx**

```tsx
import { useState } from 'react'
import type { AppState } from './services/types'
import UploadZone from './components/UploadZone'
import './App.css'

function App() {
  const [appState, setAppState] = useState<AppState>('idle')
  const [_imageUrl, setImageUrl] = useState<string | null>(null)

  const handleFileSelected = (_file: File, previewUrl: string) => {
    setImageUrl(previewUrl)
    setAppState('uploading')
  }

  return (
    <div className="app">
      <nav className="app-nav">
        <span className="nav-logo">SpaceWalk</span>
        <span className="nav-sep">/</span>
        <span className="nav-breadcrumb">
          {appState === 'idle' ? 'New Project' : 'Processing...'}
        </span>
      </nav>
      <main className="app-main">
        {appState === 'idle' && (
          <UploadZone onFileSelected={handleFileSelected} />
        )}
        {appState !== 'idle' && (
          <p style={{ padding: 40, color: 'var(--text-2)' }}>State: {appState}</p>
        )}
      </main>
    </div>
  )
}

export default App
```

- [ ] **Step 4: Test in browser**

```bash
npm run dev
```

Test with the SVG files already in `test-plans/` (created during scaffolding):
- `test-plans/01-studio-lounge.svg` — simple 4-room layout
- `test-plans/02-padel-club.svg` — B'More Padel, 7 rooms
- `test-plans/03-coworking-space.svg` — complex 9-room layout

Verify: drag & drop works, file picker works, SVG files get rasterized, invalid files show error.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add UploadZone with drag & drop, SVG rasterization"
```

---

## Task 4: Claude Vision Floor Plan Analyzer

**Files:**
- Create: `src/services/floorPlanAnalyzer.ts`
- Create: `src/components/ApiKeyModal.tsx`

- [ ] **Step 1: Build the floor plan analyzer service**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import type { FloorPlan } from './types'

const ANALYSIS_PROMPT = `You are an architectural floor plan analyzer. Analyze this floor plan image and extract structured data about all rooms.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "name": "Name of the building/space (from title block or best guess)",
  "confidence": 0.0 to 1.0 (how confident you are in the room extraction accuracy),
  "rooms": [
    {
      "id": "room-1",
      "name": "Room Name",
      "label": "Room number/label if visible (e.g., '100-101')",
      "x": 0-100 (approximate left edge as percentage of total image width),
      "y": 0-100 (approximate top edge as percentage of total image height),
      "width": 0-100 (approximate width as percentage of total image width),
      "height": 0-100 (approximate height as percentage of total image height),
      "dimensions": "5.5m × 5.0m (from annotations, or estimate)",
      "materials": [
        {
          "name": "Material description (e.g., 'Walnut vertical paneling')",
          "surface": "floor" | "wall" | "ceiling" | "fixture",
          "color": "#hexcolor (approximate color for this material)"
        }
      ]
    }
  ]
}

Instructions:
- Extract ALL rooms visible in the floor plan
- Read room names, dimensions, and materials from labels, legends, and annotations
- Position percentages should approximate where each room sits in the overall image
- If materials are listed in a legend or key, map them to the correct rooms
- Include furniture annotations if visible (as fixture materials)
- Set confidence lower if the image is blurry, unlabeled, or hard to parse`

export function getApiKey(): string | null {
  return localStorage.getItem('spacewalk-api-key') || import.meta.env.VITE_ANTHROPIC_API_KEY || null
}

export function setApiKey(key: string): void {
  localStorage.setItem('spacewalk-api-key', key)
}

export async function analyzeFloorPlan(imageBase64: string): Promise<FloorPlan> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('No API key configured')

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  // Strip data URL prefix if present
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64
  const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' as const
    : imageBase64.startsWith('data:image/svg') ? 'image/png' as const // SVGs are rasterized to PNG
    : 'image/jpeg' as const

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data },
        },
        { type: 'text', text: ANALYSIS_PROMPT },
      ],
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON - Claude sometimes wraps in markdown code blocks
  let jsonStr = textBlock.text.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const parsed = JSON.parse(jsonStr) as Omit<FloorPlan, 'originalImage'>
  return {
    ...parsed,
    originalImage: imageBase64,
  }
}
```

- [ ] **Step 2: Build API key modal component**

```tsx
import { useState } from 'react'
import { getApiKey, setApiKey } from '../services/floorPlanAnalyzer'

interface ApiKeyModalProps {
  onKeySet: () => void
  onClose: () => void
}

export default function ApiKeyModal({ onKeySet, onClose }: ApiKeyModalProps) {
  const [key, setKey] = useState(getApiKey() || '')

  const handleSave = () => {
    if (key.trim()) {
      setApiKey(key.trim())
      onKeySet()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Anthropic API Key</h3>
        <p className="modal-desc">
          Required for floor plan analysis. Your key is stored locally and never sent to our servers.
        </p>
        <input
          type="password"
          className="modal-input"
          placeholder="sk-ant-..."
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
        />
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Key</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add modal styles to App.css**

```css
/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 28px;
  width: 420px;
  max-width: 90vw;
}

.modal h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.modal-desc {
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 16px;
  line-height: 1.5;
}

.modal-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  outline: none;
}

.modal-input:focus { border-color: var(--warm); }

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--warm);
  color: #0A0A0B;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--r-sm);
  border: none;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
}

.btn-primary:hover { background: var(--warm-2); }

.btn-secondary {
  padding: 10px 20px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  border-radius: var(--r-sm);
  border: 1px solid var(--border);
  cursor: pointer;
}

.btn-secondary:hover { border-color: var(--border-hover); color: var(--text); }
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Claude Vision analyzer service + API key modal"
```

---

## Task 5: Processing View

**Files:**
- Create: `src/components/ProcessingView.tsx`

- [ ] **Step 1: Build ProcessingView component**

```tsx
import type { ProcessingStep } from '../services/types'

interface ProcessingViewProps {
  imageUrl: string
  steps: ProcessingStep[]
}

export default function ProcessingView({ imageUrl, steps }: ProcessingViewProps) {
  return (
    <div className="processing-view">
      <div className="processing-left">
        <div className="processing-image-container">
          <img src={imageUrl} alt="Floor plan" className="processing-image" />
          <div className="scan-line" />
        </div>
      </div>
      <div className="processing-right">
        <h3 className="processing-title">Analyzing floor plan...</h3>
        <div className="processing-steps">
          {steps.map((step, i) => (
            <div key={i} className="processing-step">
              <div className={`step-dot step-${step.status}`}>
                {step.status === 'done' ? '✓' : step.status === 'active' ? '⋯' : i + 1}
              </div>
              <div className="step-text">
                <strong>{step.label}</strong>
                {step.detail && <br />}
                {step.detail && <span>{step.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add processing styles to App.css**

```css
/* Processing View */
.processing-view {
  flex: 1;
  display: flex;
}

.processing-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.processing-image-container {
  position: relative;
  max-width: 90%;
  max-height: 70vh;
  border-radius: var(--r-sm);
  overflow: hidden;
}

.processing-image {
  width: 100%;
  height: auto;
  display: block;
}

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--warm), transparent);
  animation: scan 2s ease-in-out infinite;
}

@keyframes scan {
  0% { top: 0; }
  50% { top: calc(100% - 3px); }
  100% { top: 0; }
}

.processing-right {
  width: 300px;
  border-left: 1px solid var(--border);
  padding: 28px;
}

.processing-title {
  font-size: 16px;
  margin-bottom: 24px;
}

.processing-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-done { background: var(--green-glow); color: var(--green); }
.step-active { background: var(--warm-glow); color: var(--warm); animation: pulse 1.5s infinite; }
.step-pending { background: rgba(255,255,255,0.05); color: var(--text-3); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.step-text {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}

.step-text strong {
  color: var(--text);
  font-weight: 500;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add ProcessingView with scan animation + step progress"
```

---

## Task 6: Render Generator Service

**Files:**
- Create: `src/services/renderGenerator.ts`

- [ ] **Step 1: Build the render generator**

```typescript
import type { Room } from './types'

function buildPrompt(room: Room): string {
  const materialsDesc = room.materials
    .map(m => `${m.name} (${m.surface})`)
    .join(', ')

  return `Photorealistic interior view of a ${room.name}, approximately ${room.dimensions}. ${materialsDesc}. Warm ambient lighting, architectural photography style, interior design magazine quality, high detail, natural materials visible. No people, no text overlays.`
}

export async function generateRoomRender(room: Room): Promise<string> {
  const prompt = buildPrompt(room)
  const encoded = encodeURIComponent(prompt)
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&nologo=true`

  // Pollinations returns the image directly at this URL
  // We fetch it to verify it loads, then return the URL
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Render failed for ${room.name}: ${response.status}`)
  }

  return url
}

export function getRenderPrompt(room: Room): string {
  return buildPrompt(room)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/renderGenerator.ts && git commit -m "feat: add Pollinations.ai render generator service"
```

---

## Task 7: 3D Dollhouse View

**Files:**
- Create: `src/components/DollhouseView.tsx`

- [ ] **Step 1: Build the Three.js dollhouse component**

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo } from 'react'
import type { Room } from '../services/types'
import * as THREE from 'three'

const WALL_HEIGHT = 8
const GRID_SIZE = 100

interface DollhouseViewProps {
  rooms: Room[]
  selectedRoomId: string | null
  onRoomClick: (roomId: string) => void
  onRoomHover: (roomId: string | null) => void
  hoveredRoomId: string | null
}

function RoomMesh({ room, isSelected, isHovered, onClick, onHover }: {
  room: Room
  isSelected: boolean
  isHovered: boolean
  onClick: () => void
  onHover: (hovered: boolean) => void
}) {
  const floorMaterial = room.materials.find(m => m.surface === 'floor')
  const wallMaterial = room.materials.find(m => m.surface === 'wall')
  const floorColor = floorMaterial?.color || '#2a2a30'
  const wallColor = wallMaterial?.color || '#4a4a55'

  const x = (room.x / 100) * GRID_SIZE
  const z = -(room.y / 100) * GRID_SIZE
  const w = (room.width / 100) * GRID_SIZE
  const d = (room.height / 100) * GRID_SIZE

  const centerX = x + w / 2
  const centerZ = z - d / 2

  const outlineColor = isSelected ? '#F0845C' : isHovered ? '#F7A87C' : null

  const wallGeometries = useMemo(() => {
    const walls: { pos: [number, number, number]; scale: [number, number, number] }[] = [
      // Back wall (top edge)
      { pos: [centerX, WALL_HEIGHT / 2, z], scale: [w, WALL_HEIGHT, 0.3] },
      // Front wall (bottom edge)
      { pos: [centerX, WALL_HEIGHT / 2, z - d], scale: [w, WALL_HEIGHT, 0.3] },
      // Left wall
      { pos: [x, WALL_HEIGHT / 2, centerZ], scale: [0.3, WALL_HEIGHT, d] },
      // Right wall
      { pos: [x + w, WALL_HEIGHT / 2, centerZ], scale: [0.3, WALL_HEIGHT, d] },
    ]
    return walls
  }, [centerX, centerZ, x, z, w, d])

  return (
    <group>
      {/* Floor */}
      <mesh
        position={[centerX, 0, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerEnter={() => onHover(true)}
        onPointerLeave={() => onHover(false)}
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>

      {/* Walls */}
      {wallGeometries.map((wall, i) => (
        <mesh key={i} position={wall.pos}>
          <boxGeometry args={wall.scale} />
          <meshStandardMaterial
            color={wallColor}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}

      {/* Selection outline */}
      {outlineColor && (
        <mesh position={[centerX, 0.1, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 1, d + 1]} />
          <meshBasicMaterial
            color={outlineColor}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

export default function DollhouseView({
  rooms, selectedRoomId, onRoomClick, onRoomHover, hoveredRoomId
}: DollhouseViewProps) {
  return (
    <div className="dollhouse-container">
      <Canvas
        camera={{
          position: [50, 60, 80],
          fov: 50,
          near: 0.1,
          far: 500,
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[30, 50, 30]} intensity={0.8} />

        {rooms.map(room => (
          <RoomMesh
            key={room.id}
            room={room}
            isSelected={room.id === selectedRoomId}
            isHovered={room.id === hoveredRoomId}
            onClick={() => onRoomClick(room.id)}
            onHover={(h) => onRoomHover(h ? room.id : null)}
          />
        ))}

        <OrbitControls
          enableDamping
          dampingFactor={0.1}
          maxPolarAngle={Math.PI / 2.2}
          minDistance={20}
          maxDistance={200}
        />
        <gridHelper args={[GRID_SIZE, 20, '#1a1a25', '#1a1a25']} />
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 2: Add dollhouse styles to App.css**

```css
/* Dollhouse */
.dollhouse-container {
  flex: 1;
  min-height: 500px;
}

.dollhouse-container canvas {
  background: var(--bg) !important;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Three.js DollhouseView with orbit controls + room interaction"
```

---

## Task 8: 2D Fallback Overlay

**Files:**
- Create: `src/components/FloorPlanOverlay.tsx`

- [ ] **Step 1: Build the 2D overlay component**

```tsx
import type { Room } from '../services/types'

interface FloorPlanOverlayProps {
  imageUrl: string
  rooms: Room[]
  selectedRoomId: string | null
  onRoomClick: (roomId: string) => void
  onRoomHover: (roomId: string | null) => void
  hoveredRoomId: string | null
}

export default function FloorPlanOverlay({
  imageUrl, rooms, selectedRoomId, onRoomClick, onRoomHover, hoveredRoomId
}: FloorPlanOverlayProps) {
  return (
    <div className="overlay-container">
      <div className="overlay-image-wrapper">
        <img src={imageUrl} alt="Floor plan" className="overlay-image" />
        {rooms.map(room => {
          const isSelected = room.id === selectedRoomId
          const isHovered = room.id === hoveredRoomId
          return (
            <div
              key={room.id}
              className={`overlay-room ${isSelected ? 'overlay-room--selected' : ''} ${isHovered ? 'overlay-room--hovered' : ''}`}
              style={{
                left: `${room.x}%`,
                top: `${room.y}%`,
                width: `${room.width}%`,
                height: `${room.height}%`,
              }}
              onClick={() => onRoomClick(room.id)}
              onMouseEnter={() => onRoomHover(room.id)}
              onMouseLeave={() => onRoomHover(null)}
            >
              <span className="overlay-room-name">{room.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add overlay styles to App.css**

```css
/* 2D Overlay */
.overlay-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.overlay-image-wrapper {
  position: relative;
  max-width: 90%;
  max-height: 80vh;
}

.overlay-image {
  width: 100%;
  height: auto;
  display: block;
  border-radius: var(--r-sm);
}

.overlay-room {
  position: absolute;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-room:hover,
.overlay-room--hovered {
  background: rgba(240, 132, 92, 0.1);
  border-color: rgba(240, 132, 92, 0.3);
}

.overlay-room--selected {
  background: rgba(240, 132, 92, 0.15);
  border-color: var(--warm);
  box-shadow: 0 0 20px rgba(240, 132, 92, 0.2);
}

.overlay-room-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--warm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0;
  transition: opacity 0.2s;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}

.overlay-room:hover .overlay-room-name,
.overlay-room--selected .overlay-room-name {
  opacity: 1;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add 2D FloorPlanOverlay fallback with interactive hotspots"
```

---

## Task 9: Room Panel + View Toggle

**Files:**
- Create: `src/components/RoomPanel.tsx`
- Create: `src/components/ViewToggle.tsx`

- [ ] **Step 1: Build RoomPanel component**

```tsx
import type { Room } from '../services/types'

interface RoomPanelProps {
  room: Room
  onClose: () => void
}

export default function RoomPanel({ room, onClose }: RoomPanelProps) {
  return (
    <div className="room-panel">
      <div className="room-panel-header">
        <div>
          <h3 className="room-panel-name">{room.name}</h3>
          <div className="room-panel-dims">
            {room.label && `${room.label} · `}{room.dimensions}
          </div>
        </div>
        <button className="room-panel-close" onClick={onClose}>✕</button>
      </div>

      <div className="room-panel-render">
        {room.renderUrl ? (
          <img src={room.renderUrl} alt={`${room.name} render`} className="room-render-image" />
        ) : (
          <div className="room-render-loading">
            <div className="render-spinner" />
            <span>Generating render...</span>
          </div>
        )}
      </div>

      <div className="room-panel-materials">
        <div className="materials-label">Materials</div>
        {room.materials.map((mat, i) => (
          <div key={i} className="material-item">
            <div
              className="material-swatch"
              style={{ background: mat.color || '#444' }}
            />
            <div className="material-info">
              <span className="material-name">{mat.name}</span>
              <span className="material-surface">{mat.surface}</span>
            </div>
          </div>
        ))}
      </div>

      {room.renderPrompt && (
        <details className="room-panel-prompt">
          <summary>AI Prompt</summary>
          <p>{room.renderPrompt}</p>
        </details>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build ViewToggle component**

```tsx
interface ViewToggleProps {
  view: '3d' | '2d'
  onToggle: (view: '3d' | '2d') => void
}

export default function ViewToggle({ view, onToggle }: ViewToggleProps) {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn ${view === '3d' ? 'active' : ''}`}
        onClick={() => onToggle('3d')}
      >
        3D Dollhouse
      </button>
      <button
        className={`view-toggle-btn ${view === '2d' ? 'active' : ''}`}
        onClick={() => onToggle('2d')}
      >
        2D Overlay
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add panel + toggle styles to App.css**

```css
/* Room Panel */
.room-panel {
  width: 360px;
  border-left: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.room-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--border);
}

.room-panel-name {
  font-size: 18px;
  margin: 0 0 4px;
}

.room-panel-dims {
  font-size: 12px;
  color: var(--text-3);
}

.room-panel-close {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
}

.room-panel-close:hover { color: var(--text); }

.room-panel-render {
  padding: 16px 20px;
}

.room-render-image {
  width: 100%;
  border-radius: var(--r-sm);
}

.room-render-loading {
  width: 100%;
  height: 200px;
  background: var(--bg-3);
  border-radius: var(--r-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-3);
  font-size: 13px;
}

.render-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--warm);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.room-panel-materials { padding: 0 20px 20px; }

.materials-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 10px;
}

.material-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.material-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.material-name { font-size: 13px; color: var(--text-2); }
.material-surface { font-size: 11px; color: var(--text-3); margin-left: 4px; }

.room-panel-prompt {
  padding: 0 20px 20px;
  font-size: 12px;
  color: var(--text-3);
}

.room-panel-prompt summary {
  cursor: pointer;
  color: var(--text-2);
  margin-bottom: 6px;
}

.room-panel-prompt p {
  line-height: 1.5;
  margin: 0;
}

/* View Toggle */
.view-toggle {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  overflow: hidden;
}

.view-toggle-btn {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  background: transparent;
  color: var(--text-3);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'DM Sans', sans-serif;
}

.view-toggle-btn.active {
  background: var(--surface);
  color: var(--text);
}

.view-toggle-btn:hover:not(.active) {
  color: var(--text-2);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add RoomPanel side panel + ViewToggle component"
```

---

## Task 10: Wire Everything Together in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement the full state machine in App.tsx**

```tsx
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
      // Get base64 from image URL
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

      // Analyze with Claude
      const plan = await analyzeFloorPlan(base64)
      setFloorPlan(plan)

      updateStep(1, { status: 'done', detail: `${plan.rooms.length} rooms found` })
      updateStep(2, { status: 'done', detail: 'Materials mapped' })
      updateStep(3, { status: 'done' })

      // Set view mode based on confidence
      setViewMode(plan.confidence > 0.7 ? '3d' : '2d')

      // Start rendering
      setAppState('rendering')
      updateStep(4, { status: 'active' })

      // Generate renders in parallel — each updates UI the moment it resolves
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
            // Render failure is non-fatal — room just won't have a render
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
      // Store previewUrl to resume after key is set
      setImageUrl(previewUrl)
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
```

- [ ] **Step 2: Add remaining layout styles to App.css**

```css
/* Explore View */
.explore-view {
  flex: 1;
  display: flex;
  position: relative;
}

.explore-main {
  flex: 1;
  position: relative;
}

/* Nav extras */
.nav-reset {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-3);
  padding: 4px 12px;
  border-radius: var(--r-sm);
  font-size: 12px;
  cursor: pointer;
  margin-left: 12px;
}

.nav-reset:hover { color: var(--text); border-color: var(--border-hover); }

.nav-settings {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
}

.nav-settings:hover { color: var(--text); }

/* Error banner */
.error-banner {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 107, 107, 0.15);
  border: 1px solid rgba(255, 107, 107, 0.3);
  color: var(--coral);
  padding: 10px 20px;
  border-radius: var(--r-sm);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 50;
}

.error-banner button {
  background: none;
  border: none;
  color: var(--coral);
  cursor: pointer;
}
```

- [ ] **Step 3: Test full flow**

```bash
npm run dev
```

Test: upload an SVG test plan → enter API key → watch processing → see 3D dollhouse → click rooms → see renders load.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: wire full app state machine - upload, analyze, explore"
```

---

## Task 11: Build Verification & Push

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 2: Test production build locally**

```bash
npm run preview
```

Verify the app loads and looks correct.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin HEAD:main
```

- [ ] **Step 4: Commit any final fixes**

If build revealed issues, fix and commit:
```bash
git add -A && git commit -m "fix: resolve build issues"
git push origin HEAD:main
```
