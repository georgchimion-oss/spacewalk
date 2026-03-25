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
    return [
      { pos: [centerX, WALL_HEIGHT / 2, z] as [number, number, number], scale: [w, WALL_HEIGHT, 0.3] as [number, number, number] },
      { pos: [centerX, WALL_HEIGHT / 2, z - d] as [number, number, number], scale: [w, WALL_HEIGHT, 0.3] as [number, number, number] },
      { pos: [x, WALL_HEIGHT / 2, centerZ] as [number, number, number], scale: [0.3, WALL_HEIGHT, d] as [number, number, number] },
      { pos: [x + w, WALL_HEIGHT / 2, centerZ] as [number, number, number], scale: [0.3, WALL_HEIGHT, d] as [number, number, number] },
    ]
  }, [centerX, centerZ, x, z, w, d])

  return (
    <group>
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

      {wallGeometries.map((wall, i) => (
        <mesh key={i} position={wall.pos}>
          <boxGeometry args={wall.scale} />
          <meshStandardMaterial color={wallColor} transparent opacity={0.7} />
        </mesh>
      ))}

      {outlineColor && (
        <mesh position={[centerX, 0.1, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 1, d + 1]} />
          <meshBasicMaterial color={outlineColor} transparent opacity={0.15} side={THREE.DoubleSide} />
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
      <Canvas camera={{ position: [50, 60, 80], fov: 50, near: 0.1, far: 500 }}>
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
