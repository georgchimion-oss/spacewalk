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

  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64
  const mediaType: 'image/png' | 'image/jpeg' = imageBase64.startsWith('data:image/png')
    ? 'image/png'
    : 'image/jpeg'

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
