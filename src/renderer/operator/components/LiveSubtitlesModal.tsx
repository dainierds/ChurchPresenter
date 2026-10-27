import React, { useState, useEffect } from 'react'
import { LiveSubtitlesConfig } from '../../../shared/types'

interface LiveSubtitlesModalProps {
  isOpen: boolean
  onClose: () => void
}

export const LiveSubtitlesModal: React.FC<LiveSubtitlesModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<LiveSubtitlesConfig>({
    enabled: true,
    position: 'bottom',
    fontSizeVmin: 3.5,
    maxLines: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    textColor: '#FFFFFF',
    fadeDurationMs: 300,
    autoClearDelaySec: 5,
    targetRoles: ['main', 'lobby', 'program']
  })

  const [testText, setTestText] = useState('')
  const [testTranslation, setTestTranslation] = useState('')
  const [testDuration, setTestDuration] = useState(5)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      const cfg = await window.churchPresenterApi.getSubtitlesConfig()
      setConfig(cfg)
    } catch {
      // ignore
    }
  }

  const handleSaveConfig = async (updated: Partial<LiveSubtitlesConfig>) => {
    const merged = { ...config, ...updated }
    setConfig(merged)
    try {
      await window.churchPresenterApi.saveSubtitlesConfig(merged)
      setStatusMessage('Configuración de subtítulos guardada.')
    } catch {
      setStatusMessage('Error al guardar configuración.')
    }
  }

  const handleSendSubtitle = async () => {
    if (!testText.trim()) return
    try {
      await window.churchPresenterApi.sendLiveSubtitle({
        text: testText.trim(),
        translation: testTranslation.trim() || undefined,
        targetRoles: config.targetRoles,
        durationSec: testDuration
      })
      setStatusMessage('✅ Subtítulo enviado a pantalla.')
      setTestText('')
      setTestTranslation('')
    } catch (err: any) {
      setStatusMessage('Error al enviar subtítulo: ' + err?.message)
    }
  }

  const handleClearSubtitle = async () => {
    try {
      await window.churchPresenterApi.clearLiveSubtitle()
      setStatusMessage('Subtítulo limpiado de pantalla.')
    } catch {
      // ignore
    }
  }

  const toggleRole = (role: string) => {
    const cur = config.targetRoles || []
    const updated = cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]
    handleSaveConfig({ targetRoles: updated })
  }

  if (!isOpen) return null

  return (
    <div
      className="pro-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        className="pro-modal-box"
        style={{
          width: '90%',
          maxWidth: '750px',
          maxHeight: '90vh',
          backgroundColor: '#121212',
          border: '1px solid #262626',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
          color: '#F8FAFC'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #262626',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.25rem' }}>💬</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#38BDF8' }}>
              Subtítulos y Traducción en Vivo
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* On/Off Switch */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#171717',
              borderRadius: 8,
              border: '1px solid #262626',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Capa de Subtítulos en Pantalla</div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Habilita el renderizado de subtítulos y traducciones en tiempo real
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleSaveConfig({ enabled: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: '#22C55E' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: config.enabled ? '#22C55E' : '#94A3B8' }}>
                {config.enabled ? 'Habilitado' : 'Desactivado'}
              </span>
            </label>
          </div>

          {/* Manual Operator Subtitle Box */}
          <div
            style={{
              backgroundColor: '#0A0A0A',
              border: '1px solid #262626',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38BDF8' }}>
              ⌨️ Enviar Subtítulo Manualmente
            </div>

            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Escriba la frase a proyectar..."
              rows={2}
              style={{
                width: '100%',
                background: '#141414',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#FFF',
                fontSize: '0.95rem',
                outline: 'none',
                resize: 'none'
              }}
            />

            <input
              type="text"
              value={testTranslation}
              onChange={(e) => setTestTranslation(e.target.value)}
              placeholder="Traducción en segundo idioma (Opcional, e.g. English translation)..."
              style={{
                width: '100%',
                background: '#141414',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#FFF',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Duración (seg):</label>
                <input
                  type="number"
                  value={testDuration}
                  onChange={(e) => setTestDuration(Number(e.target.value) || 5)}
                  min={1}
                  max={60}
                  style={{
                    width: 60,
                    background: '#141414',
                    border: '1px solid #333',
                    borderRadius: 4,
                    padding: '4px 8px',
                    color: '#FFF',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button
                  onClick={handleClearSubtitle}
                  style={{
                    background: '#FF7A00',
                    color: '#0A0A0A',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Limpiar
                </button>
                <button
                  onClick={handleSendSubtitle}
                  disabled={!testText.trim()}
                  style={{
                    background: '#22C55E',
                    color: '#0A0A0A',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 20px',
                    fontWeight: 700,
                    cursor: !testText.trim() ? 'not-allowed' : 'pointer',
                    opacity: !testText.trim() ? 0.5 : 1
                  }}
                >
                  Proyectar Subtítulo
                </button>
              </div>
            </div>
          </div>

          {/* Config Settings Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              background: '#161616',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #262626'
            }}
          >
            {/* Position */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Posición en Pantalla:</label>
              <select
                value={config.position}
                onChange={(e) => handleSaveConfig({ position: e.target.value as any })}
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: '0.85rem'
                }}
              >
                <option value="bottom">Abajo (Inferior)</option>
                <option value="top">Arriba (Superior)</option>
              </select>
            </div>

            {/* Max lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Líneas Máximas:</label>
              <select
                value={config.maxLines}
                onChange={(e) => handleSaveConfig({ maxLines: Number(e.target.value) })}
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: '0.85rem'
                }}
              >
                <option value={1}>1 línea</option>
                <option value={2}>2 líneas</option>
                <option value={3}>3 líneas</option>
                <option value={4}>4 líneas</option>
              </select>
            </div>

            {/* Font size vmin */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Tamaño de Fuente (vmin):</label>
              <input
                type="number"
                step="0.5"
                min="2"
                max="8"
                value={config.fontSizeVmin}
                onChange={(e) => handleSaveConfig({ fontSizeVmin: Number(e.target.value) })}
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Auto clear silence timeout */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Auto-limpieza por Silencio (seg):</label>
              <input
                type="number"
                min="2"
                max="30"
                value={config.autoClearDelaySec}
                onChange={(e) => handleSaveConfig({ autoClearDelaySec: Number(e.target.value) })}
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          {/* Role Assignments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8' }}>
              Destino por Salidas (Roles):
            </label>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.targetRoles.includes('main') || config.targetRoles.includes('audience')}
                  onChange={() => toggleRole('main')}
                  style={{ accentColor: '#22C55E' }}
                />
                Audiencia Principal
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.targetRoles.includes('program')}
                  onChange={() => toggleRole('program')}
                  style={{ accentColor: '#38BDF8' }}
                />
                Programa / Transmisión
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={config.targetRoles.includes('stage')}
                  onChange={() => toggleRole('stage')}
                  style={{ accentColor: '#FF7A00' }}
                />
                Escenario (Músicos/Pastor)
              </label>
            </div>
          </div>

          {/* Web Transcriber Link info */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#161616',
              borderRadius: 6,
              border: '1px solid #262626',
              fontSize: '0.8rem',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>🌐</span>
            <span>
              Acceso web para transcriptor remoto en red local: navegue a{' '}
              <strong style={{ color: '#38BDF8' }}>http://[IP-SERVIDOR]:8080/subtitles</strong>
            </span>
          </div>

          {/* Status Alert */}
          {statusMessage && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #38BDF8',
                borderRadius: 4,
                fontSize: '0.85rem',
                color: '#38BDF8'
              }}
            >
              {statusMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #262626',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#262626',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
