# SpaceWalk — Design Spec

> Turn floor plan blueprints into interactive 3D walkthroughs for real estate and venue visualization.

## Problem

Venue owners (e.g., a padel club building a members lounge) have professionally made floor plans with materials specs, and they want to show prospective members what the space will look like. Current AI tools produce poor results because they try to generate entire walkthroughs from a single image prompt instead of decomposing the problem.

## Solution

SpaceWalk takes a floor plan image, uses AI to extract room data and materials, builds an interactive 3D dollhouse model, and generates photorealistic AI renders for each room. Users click rooms on the 3D model to see what each space will look like.

## User Flow

1. **Upload** — User drops a floor plan image (PNG, JPG, or SVG). SVGs are rasterized to PNG via offscreen canvas before processing.
2. **Processing** — AI analyzes the image:
   - Claude Vision extracts rooms (name, position, dimensions, materials)
   - Returns a confidence score for the extraction
   - Generates interior design prompts per room
   - Sends prompts to Pollinations.ai for photorealistic renders
3. **Explore** — Interactive result view:
   - **Primary**: Three.js 3D dollhouse (orbit/zoom/pan) — renders if confidence > 0.7
   - **Fallback**: 2D interactive overlay on original image — renders if confidence ≤ 0.7
   - User can manually toggle between 3D and 2D views
   - Click a room → side panel slides out with AI render + room details + materials list

## Architecture

```
src/
├── components/
│   ├── UploadZone.tsx        — drag & drop, file validation (PNG/JPG/SVG), SVG→PNG rasterization
│   ├── ProcessingView.tsx    — floor plan preview + scan animation + step progress
│   ├── DollhouseView.tsx     — Three.js 3D model via @react-three/fiber
│   ├── FloorPlanOverlay.tsx  — 2D fallback: hotspot zones over original image
│   ├── RoomPanel.tsx         — side panel: AI render, room name, dims, materials
│   └── ViewToggle.tsx        — switch 3D ↔ 2D
├── services/
│   ├── floorPlanAnalyzer.ts  — Claude Vision API: image → structured room data
│   ├── renderGenerator.ts    — builds prompts + calls Pollinations.ai
│   └── types.ts              — Room, Material, FloorPlan, AnalysisResult interfaces
├── App.tsx                   — state machine: upload → processing → explore
├── index.css                 — Georg design system (already set up)
└── main.tsx
```

## Data Model

```typescript
interface FloorPlan {
  name: string;                  // e.g., "B'More Padel — Members Lounge"
  confidence: number;            // 0-1, from Claude's analysis
  rooms: Room[];
  originalImage: string;         // base64 or object URL of uploaded image
}

interface Room {
  id: string;
  name: string;                  // e.g., "Reception & Waiting"
  label: string;                 // e.g., "100-101"
  x: number;                     // percentage of image width (0-100)
  y: number;                     // percentage of image height (0-100)
  width: number;                 // percentage
  height: number;                // percentage
  dimensions: string;            // e.g., "5.5m × 5.0m"
  materials: Material[];
  renderUrl?: string;            // Pollinations result (loaded async)
  renderPrompt?: string;         // the prompt used to generate the render
}

interface Material {
  name: string;                  // e.g., "Walnut vertical paneling"
  surface: 'floor' | 'wall' | 'ceiling' | 'fixture';
  color?: string;                // hex, for 3D model tinting
}
```

## Key Technical Decisions

### Claude Vision Analysis
- Single API call with structured prompt requesting JSON output
- Prompt includes: extract all rooms, their approximate positions as percentages, dimensions, all materials mentioned, and a confidence score
- The prompt explicitly asks Claude to identify materials from legends, annotations, and labels in the blueprint
- Returns structured JSON matching the FloorPlan interface

### 3D Dollhouse (Three.js)
- Uses `@react-three/fiber` + `@react-three/drei` for React integration
- **Coordinate mapping**: Floor plan is a 100×100 world-unit grid. Room `x%` maps to `x` world units on X axis, `y%` maps to `-y` world units on Z axis (Three.js convention). Wall height is fixed at 8 world units for all rooms.
- Walls: extruded rectangles (8 units tall)
- Floors: planes textured/colored based on material data
- OrbitControls for rotation, zoom, pan
- Highlighted room (hover/click) gets a `#F0845C` (warm CTA) outline glow
- Camera starts at a ~45° elevated angle looking down

### 2D Fallback
- Original uploaded image displayed at full size
- Room boundaries overlaid as semi-transparent colored rectangles (positioned by percentage data from Claude)
- Hover: room highlights with name tooltip
- Click: same side panel behavior as 3D view

### AI Render Generation
- Claude generates detailed interior design prompts per room, incorporating:
  - Room name and purpose
  - Dimensions
  - All materials (floors, walls, ceiling, fixtures)
  - Furniture hints if detected
  - Style: "architectural photography, interior design magazine, warm ambient lighting"
- Pollinations.ai endpoint: `https://image.pollinations.ai/prompt/{encoded_prompt}`
  - Free, no API key
  - Returns a PNG image URL
  - ~5-15 seconds per render
- Renders load asynchronously — rooms show a skeleton/loading state, renders appear as they complete

### API Key Handling (Prototype)
- Anthropic SDK initialized with `dangerouslyAllowBrowser: true` — acceptable for portfolio prototype, not for production
- API key entered by user in a settings modal, stored in localStorage
- `.env` file with `VITE_ANTHROPIC_API_KEY` for dev convenience (fallback if no localStorage key)
- **Production upgrade path**: add a Vite dev proxy or minimal Express backend to avoid exposing the key

## App States

```
IDLE → UPLOADING → ANALYZING → RENDERING → READY
                                              ↓
                                         (user clicks room)
                                              ↓
                                         ROOM_SELECTED
```

- **IDLE**: Upload zone visible
- **UPLOADING**: File validation + preview
- **ANALYZING**: Claude Vision call in progress, scan animation, step progress
- **RENDERING**: 3D model built, AI renders generating asynchronously
- **READY**: Full explore view, all renders loaded (or loading)
- **ROOM_SELECTED**: Side panel open with room details

## Dependencies

```json
{
  "three": "latest",
  "@react-three/fiber": "latest",
  "@react-three/drei": "latest",
  "@anthropic-ai/sdk": "latest"
}
```

Pollinations.ai requires no SDK — plain fetch to their image endpoint.

## Test Data

Three SVG floor plans in `test-plans/`:
- `01-studio-lounge.svg` — 4 rooms, simple layout
- `02-padel-club.svg` — 7 rooms, modeled after B'More Padel
- `03-coworking-space.svg` — 9 rooms, complex multi-zone layout

**Note**: SVG test files must be rasterized to PNG before sending to Claude Vision. The `UploadZone` component handles this automatically via offscreen canvas rendering.

## Out of Scope (v1)

- Guided tour / auto-advance mode
- Multiple angle renders per room
- PDF upload (would require pdf.js for rasterization — add in v2 if needed)
- User accounts / saving projects
- Backend server (prototype uses `dangerouslyAllowBrowser`)
- Furniture placement in 3D model (basic silhouettes only)
