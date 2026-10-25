import React, { useState, useEffect } from 'react'
import { Tv, Monitor, Pin, PinOff } from 'lucide-react'
import { OutputApp } from '../../output/OutputApp'
import '../operator.css'

export const FloatingPreviewApp: React.FC = () => {
  // Read initial role from URL query params (e.g. ?role=stage)
  const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '')
  const initialRole = (urlParams.get('role') as 'main' | 'stage' | 'lobby') || 'main'

  const [activeRole, setActiveRole] = useState<'main' | 'stage' | 'lobby'>(initialRole)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)

  const handleToggleAlwaysOnTop = async () => {
    const nextVal = !isAlwaysOnTop
    setIsAlwaysOnTop(nextVal)
    if (window.churchPresenterApi?.setFloatingPreviewAlwaysOnTop) {
      await window.churchPresenterApi.setFloatingPreviewAlwaysOnTop(nextVal)
    }
  }

  // Keyboard shortcut ESC to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.churchPresenterApi?.closeFloatingPreview?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="pro-floating-preview-container">
      {/* Top Header / Control Toolbar */}
      <div className="pro-floating-header">
        <div className="pro-floating-brand">
          <Tv size={15} className="pro-floating-icon" />
          <span className="pro-floating-title">Vista Previa Flotante</span>
          <span className="pro-floating-badge-169">16:9</span>
        </div>

        {/* Output Selector (Audience, Stage, Lobby) */}
        <div className="pro-floating-role-tabs">
          <button
            type="button"
            className={`pro-floating-tab ${activeRole === 'main' ? 'active' : ''}`}
            onClick={() => setActiveRole('main')}
            title="Previsualizar Salida Principal (Audiencia)"
          >
            <Monitor size={12} />
            <span>Audiencia</span>
          </button>
          <button
            type="button"
            className={`pro-floating-tab ${activeRole === 'stage' ? 'active' : ''}`}
            onClick={() => setActiveRole('stage')}
            title="Previsualizar Monitor de Escenario (Stage)"
          >
            <span>Escenario</span>
          </button>
          <button
            type="button"
            className={`pro-floating-tab ${activeRole === 'lobby' ? 'active' : ''}`}
            onClick={() => setActiveRole('lobby')}
            title="Previsualizar Salida de Vestíbulo (Lobby)"
          >
            <span>Lobby</span>
          </button>
        </div>

        {/* Pin Always on Top Toggle */}
        <div className="pro-floating-actions">
          <button
            type="button"
            className={`pro-floating-btn-pin ${isAlwaysOnTop ? 'pinned' : ''}`}
            onClick={handleToggleAlwaysOnTop}
            title={isAlwaysOnTop ? 'Desactivar Siempre al frente' : 'Mantener ventana Siempre al frente'}
          >
            {isAlwaysOnTop ? <Pin size={13} fill="currentColor" /> : <PinOff size={13} />}
            <span>{isAlwaysOnTop ? 'Fijado' : 'Fijar'}</span>
          </button>
        </div>
      </div>

      {/* Main 16:9 Scalable Preview Screen */}
      <div className="pro-floating-viewport">
        <div className="pro-floating-aspect-box">
          <OutputApp role={activeRole} />
        </div>
      </div>
    </div>
  )
}
