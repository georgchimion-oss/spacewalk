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
