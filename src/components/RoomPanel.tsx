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
