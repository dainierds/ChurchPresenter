import React, { useEffect } from 'react'
import { X, Sparkles, Monitor, BookOpen, Volume2, Video, Keyboard } from 'lucide-react'
import appLogo from '../../assets/icon.png'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenShortcuts?: () => void
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  onOpenShortcuts
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="pro-modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        className="pro-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          backgroundColor: '#16181d',
          border: '1px solid #2d3139',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 1px 1px rgba(249, 115, 22, 0.2)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#1a1d24',
            borderBottom: '1px solid #282c35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="#f97316" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.3px' }}>
              Acerca de ChurchPresenter
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              transition: 'all 0.15s ease'
            }}
            title="Cerrar (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hero Section */}
        <div
          style={{
            padding: '24px 20px 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            background: 'radial-gradient(ellipse at top, rgba(249, 115, 22, 0.08) 0%, rgba(22, 24, 29, 0) 70%)',
            borderBottom: '1px solid #232730'
          }}
        >
          <img
            src={appLogo}
            alt="ChurchPresenter Logo"
            style={{
              width: 68,
              height: 68,
              borderRadius: 14,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              marginBottom: 12
            }}
          />
          <h2
            style={{
              margin: '0 0 4px',
              fontSize: 20,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.5px'
            }}
          >
            ChurchPresenter <span style={{ color: '#f97316' }}>Pro</span>
          </h2>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              color: '#94a3b8',
              fontWeight: 500
            }}
          >
            Software Profesional de Presentación y Proyección para Iglesias
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.35)',
                borderRadius: 20,
                padding: '2px 10px'
              }}
            >
              Versión 1.4.3
            </span>
            <span
              style={{
                fontSize: 11,
                color: '#64748b',
                backgroundColor: '#1e222a',
                borderRadius: 20,
                padding: '2px 8px'
              }}
            >
              64-bit Windows
            </span>
            <span
              style={{
                fontSize: 11,
                color: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: 20,
                padding: '2px 8px'
              }}
            >
              ● Sistema Estable
            </span>
          </div>
        </div>

        {/* Feature Grid */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8
            }}
          >
            <div
              style={{
                backgroundColor: '#1b1e26',
                border: '1px solid #272c36',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}
            >
              <Monitor size={16} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Multi-Pantalla</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>
                  Audiencia, Escenario de confianza y Vestíbulo independientes.
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#1b1e26',
                border: '1px solid #272c36',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}
            >
              <BookOpen size={16} color="#fbbf24" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Biblia & Canciones</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>
                  RVR1909, temas dinámicos, editor rápido y biblioteca Pro.
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#1b1e26',
                border: '1px solid #272c36',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}
            >
              <Volume2 size={16} color="#4ade80" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Audio de Cabina</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>
                  Enrutamiento de hardware con setSinkId y monitor de operador.
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#1b1e26',
                border: '1px solid #272c36',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}
            >
              <Video size={16} color="#a855f7" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>Transmisión & OctoStream</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3 }}>
                  Recepción de cámaras RTMP en vivo y compatibilidad con OBS.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#181b22',
              borderRadius: 6,
              border: '1px solid #242832',
              fontSize: 11,
              color: '#64748b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>Motor: Electron 45 • Chromium 132 • SQLite</span>
            <span>ChurchPresenter Team © 2026</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#1a1d24',
            borderTop: '1px solid #282c35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          {onOpenShortcuts ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenShortcuts()
              }}
              style={{
                backgroundColor: '#232730',
                border: '1px solid #333844',
                color: '#cbd5e1',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <Keyboard size={14} color="#94a3b8" />
              <span>Atajos de Teclado</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#f97316',
              border: 'none',
              color: '#ffffff',
              padding: '6px 20px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)',
              transition: 'all 0.15s ease'
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
