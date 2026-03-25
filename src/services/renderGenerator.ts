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

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Render failed for ${room.name}: ${response.status}`)
  }

  return url
}

export function getRenderPrompt(room: Room): string {
  return buildPrompt(room)
}
