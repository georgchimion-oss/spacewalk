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
