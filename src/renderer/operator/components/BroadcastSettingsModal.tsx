import React, { useState, useEffect } from 'react'
import {
  X,
  Radio,
  HardDrive,
  Cpu,
  Shield,
  Eye,
  EyeOff,
  Check,
  AlertTriangle
} from 'lucide-react'
import { BroadcastSettings } from '../../../shared/types'

interface BroadcastSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const RTMP_PRESETS = [
  { name: 'YouTube Live', url: 'rtmp://a.rtmp.youtube.com/live2' },
  { name: 'Facebook Live', url: 'rtmps://live-api-s.facebook.com:443/rtmp/' },
  { name: 'Twitch', url: 'rtmp://live.twitch.tv/app/' },
  { name: 'Personalizado / Restream', url: '' }
]

export const BroadcastSettingsModal: React.FC<BroadcastSettingsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [settings, setSettings] = useState<BroadcastSettings>({
    rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
    rtmpKey: '',
    qualityPreset: '1080p30',
    recordLocal: true,
    recordingFormat: 'mp4',
    autoReconnect: true,
    encoderPreference: 'nvenc',
    audioDelayMs: 0
  })

  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    loadSettings()
  }, [isOpen])

  const loadSettings = async () => {
    try {
      const data = await window.churchPresenterApi.getBroadcastSettings()
      if (data) {
        setSettings(data)
      }
    } catch (err: any) {
      setErrorMessage(`Error al cargar configuración: ${err?.message || err}`)
    }
  }

  if (!isOpen) return null

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setErrorMessage(null)
      await window.churchPresenterApi.saveBroadcastSettings(settings)
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onClose()
      }, 1000)
    } catch (err: any) {
      setErrorMessage(`Error al guardar: ${err?.message || err}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectPreset = (presetUrl: string) => {
    if (presetUrl) {
      setSettings((prev) => ({ ...prev, rtmpUrl: presetUrl }))
    }
  }

  return (
    <div
      className="pro-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="pro-modal-container"
        style={{
          width: 620,
          maxHeight: '90vh',
          backgroundColor: '#121212',
          border: '1px solid #2E2E2E',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #222222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#181818'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={20} color="#FF7A00" />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                Configuración de Transmisión y Grabación
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#9CA3AF' }}>
                Codificación por hardware NVENC / FFmpeg, RTMP y guardado local
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 13
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Section 1: RTMP Destination */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio size={14} /> Destino RTMP / Plataforma de Streaming
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {RTMP_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset.url)}
                  style={{
                    backgroundColor: settings.rtmpUrl === preset.url && preset.url !== '' ? 'rgba(255, 122, 0, 0.2)' : '#1C1C1C',
                    border: settings.rtmpUrl === preset.url && preset.url !== '' ? '1px solid #FF7A00' : '1px solid #2E2E2E',
                    color: settings.rtmpUrl === preset.url && preset.url !== '' ? '#FF7A00' : '#D1D5DB',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>URL del Servidor RTMP / RTMPS:</span>
              <input
                type="text"
                value={settings.rtmpUrl}
                onChange={(e) => setSettings({ ...settings, rtmpUrl: e.target.value })}
                placeholder="rtmp://a.rtmp.youtube.com/live2"
                style={{
                  backgroundColor: '#161616',
                  border: '1px solid #2E2E2E',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#FFFFFF',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Clave de Transmisión (Stream Key):</span>
                <span style={{ fontSize: 11, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={11} /> Cifrado seguro DPAPI
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.rtmpKey || ''}
                  onChange={(e) => setSettings({ ...settings, rtmpKey: e.target.value })}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: '#161616',
                    border: '1px solid #2E2E2E',
                    borderRadius: 6,
                    padding: '8px 38px 8px 12px',
                    color: '#FFFFFF',
                    fontSize: 13,
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    padding: 4
                  }}
                  title={showKey ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Video Encoder & Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={14} /> Codificador y Calidad de Video
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Preset de Resolución y FPS:</span>
                <select
                  value={settings.qualityPreset}
                  onChange={(e) => setSettings({ ...settings, qualityPreset: e.target.value as any })}
                  style={{
                    backgroundColor: '#161616',
                    border: '1px solid #2E2E2E',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#FFFFFF',
                    fontSize: 13,
                    outline: 'none'
                  }}
                >
                  <option value="1080p30">1080p 30fps (4500 kbps - Recomendado)</option>
                  <option value="720p30">720p 30fps (2500 kbps - Conexión lenta)</option>
                  <option value="1080p60">1080p 60fps (6000 kbps - Movimiento fluido)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Motor de Codificación:</span>
                <select
                  value={settings.encoderPreference}
                  onChange={(e) => setSettings({ ...settings, encoderPreference: e.target.value as any })}
                  style={{
                    backgroundColor: '#161616',
                    border: '1px solid #2E2E2E',
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: '#FFFFFF',
                    fontSize: 13,
                    outline: 'none'
                  }}
                >
                  <option value="nvenc">NVIDIA NVENC (GPU Hardware - Ultrarrápido)</option>
                  <option value="x264">x264 (Software CPU Fallback)</option>
                </select>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
                color: '#D1D5DB',
                marginTop: 4
              }}
            >
              <input
                type="checkbox"
                checked={settings.autoReconnect}
                onChange={(e) => setSettings({ ...settings, autoReconnect: e.target.checked })}
                style={{ accentColor: '#FF7A00', width: 16, height: 16 }}
              />
              <span>Reconexión automática con retroceso exponencial ante caídas de red</span>
            </label>
          </div>

          {/* Section 3: Local Recording */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <HardDrive size={14} /> Grabación Local Simultánea
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#D1D5DB' }}>
                <input
                  type="checkbox"
                  checked={settings.recordLocal}
                  onChange={(e) => setSettings({ ...settings, recordLocal: e.target.checked })}
                  style={{ accentColor: '#FF7A00', width: 16, height: 16 }}
                />
                <span>Grabar archivo maestro en disco al transmitir</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>Formato:</span>
                <select
                  value={settings.recordingFormat}
                  onChange={(e) => setSettings({ ...settings, recordingFormat: e.target.value as any })}
                  disabled={!settings.recordLocal}
                  style={{
                    backgroundColor: '#161616',
                    border: '1px solid #2E2E2E',
                    borderRadius: 6,
                    padding: '6px 8px',
                    color: '#FFFFFF',
                    fontSize: 12,
                    outline: 'none',
                    opacity: settings.recordLocal ? 1 : 0.5
                  }}
                >
                  <option value="mp4">MP4 (Estándar rápido)</option>
                  <option value="mkv">MKV (Tolerante a apagones)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: CCLI & Legal Notice */}
          <div
            style={{
              backgroundColor: 'rgba(255, 122, 0, 0.08)',
              border: '1px solid rgba(255, 122, 0, 0.25)',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              gap: 10
            }}
          >
            <AlertTriangle size={18} color="#FF7A00" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: '#D1D5DB', lineHeight: 1.4 }}>
              <strong style={{ color: '#FF7A00' }}>Aviso de Derechos de Autor y Licencia CCLI:</strong>
              <br />
              La transmisión por internet de alabanzas y canciones en vivo requiere una licencia válida de transmisión (p. ej. CCLI Streaming License). Asegúrese de incluir su número de licencia en las diapositivas o en la descripción de la transmisión.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #222222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#181818'
          }}
        >
          <div>
            {saveSuccess && (
              <span style={{ color: '#22c55e', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={16} /> Ajustes guardados correctamente
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #3F3F46',
                color: '#D1D5DB',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: '#FF7A00',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: 6,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(255, 122, 0, 0.4)'
              }}
            >
              {isSaving ? 'Guardando...' : 'Guardar Ajustes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
