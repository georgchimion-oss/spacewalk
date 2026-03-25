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
