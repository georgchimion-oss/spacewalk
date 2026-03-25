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
