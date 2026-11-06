import React, { useState, useEffect, useCallback } from 'react'
import {
  Camera,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  Radio,
  Play,
  Square,
  Smartphone
} from 'lucide-react'
import { OctoStreamSlot, PhoneCameraDevice } from '../../../shared/types'

export const CameraSettingsSection: React.FC = () => {
  const [slots, setSlots] = useState<OctoStreamSlot[]>([])
  const [phoneCameras, setPhoneCameras] = useState<PhoneCameraDevice[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedQrSlot, setSelectedQrSlot] = useState<OctoStreamSlot | null>(null)
  const [loadingSlotId, setLoadingSlotId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const loadSlots = useCallback(async () => {
    try {
      if (window.churchPresenterApi?.getOctoStreamSlots) {
        const data = await window.churchPresenterApi.getOctoStreamSlots()
        setSlots(data || [])
      }
      if (window.churchPresenterApi?.getConnectedPhoneCameras) {
        const devs = await window.churchPresenterApi.getConnectedPhoneCameras()
        setPhoneCameras(devs || [])
      }
    } catch (err) {
      console.error('Error loading OctoStream slots:', err)
    }
  }, [])

  useEffect(() => {
    loadSlots()
    const interval = setInterval(loadSlots, 4000)
    return () => clearInterval(interval)
  }, [loadSlots])

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2500)
  }

  const handleToggleSlot = async (slot: OctoStreamSlot) => {
    setLoadingSlotId(slot.id)
    try {
      if (slot.enabled) {
        await window.churchPresenterApi.stopOctoStreamSlot(slot.id)
      } else {
        await window.churchPresenterApi.startOctoStreamSlot(slot.id)
      }
      await loadSlots()
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error al cambiar estado de la ranura.' })
    } finally {
      setLoadingSlotId(null)
    }
  }

  const handleModeChange = async (slot: OctoStreamSlot, newMode: 'rtmp' | 'rtsp') => {
    try {
      await window.churchPresenterApi.saveOctoStreamSlot({ id: slot.id, mode: newMode })
      await loadSlots()
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error al actualizar modo.' })
    }
  }

  const handleRtspUrlChange = async (slot: OctoStreamSlot, newUrl: string) => {
    try {
      await window.churchPresenterApi.saveOctoStreamSlot({ id: slot.id, rtspUrl: newUrl })
    } catch (err: any) {
      console.error('Error saving RTSP URL:', err)
    }
  }

  const handleNameChange = async (slot: OctoStreamSlot, newName: string) => {
    try {
      await window.churchPresenterApi.saveOctoStreamSlot({ id: slot.id, name: newName })
      await loadSlots()
    } catch (err: any) {
      console.error('Error updating name:', err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #222', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Camera size={22} color="#00D2FF" />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#fff' }}>
              Cámaras Móviles de Teléfono (OctoStream - iOS / Android)
            </h2>
          </div>
          <button
            onClick={() => loadSlots()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#d1d5db',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            <RefreshCw size={13} /> Refrescar
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
          Conecte hasta 4 iPhones simultáneos usando la app nativa <strong>OctoStream</strong> en 720p/1080p a 30 FPS.
          Transmisión directa por RTMP/RTSP en red local o por Tailscale, <strong>sin necesidad de páginas web ni certificados SSL</strong>.
        </p>
      </div>

      {/* Guide Banner */}
      <div
        style={{
          backgroundColor: 'rgba(0, 210, 255, 0.08)',
          border: '1px solid rgba(0, 210, 255, 0.25)',
          borderRadius: 8,
          padding: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00D2FF', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
          <Smartphone size={16} /> Cómo conectar tu iPhone con OctoStream en 3 pasos:
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#e5e7eb', lineHeight: 1.6 }}>
          <li>
            Instala la app gratuita <strong>RTSP & RTMP Cam - OctoStream</strong> (Krusade LLC) en la App Store de tu iPhone.
          </li>
          <li>
            En OctoStream, selecciona el modo <strong>RTMP</strong> y escanea el código QR de la cámara correspondiente (o copia la URL RTMP).
          </li>
          <li>
            Toca el botón <strong>Start / Transmitir</strong> en la app. ChurchPresenter detectará la señal automáticamente y la verás en vivo en el Estudio de Transmisión.
          </li>
        </ol>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: 12,
            backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            color: statusMessage.type === 'error' ? '#fca5a5' : '#86efac',
            border: `1px solid ${statusMessage.type === 'error' ? '#ef4444' : '#22c55e'}`
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Camera Slots Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        {slots.map((slot) => {
          const liveCam = phoneCameras.find((c) => c.id === slot.id)
          const isLive = Boolean(slot.isStreaming || (liveCam && liveCam.isStreaming))

          return (
            <div
              key={slot.id}
              style={{
                backgroundColor: '#11141a',
                border: isLive ? '1px solid #10b981' : slot.enabled ? '1px solid #2e384d' : '1px solid #222',
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              {/* Slot Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: isLive ? '#10b981' : slot.enabled ? '#eab308' : '#6b7280',
                      boxShadow: isLive ? '0 0 8px #10b981' : 'none'
                    }}
                  />
                  <input
                    type="text"
                    defaultValue={slot.name}
                    onBlur={(e) => handleNameChange(slot, e.target.value)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: '1px dashed #4b5563',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      padding: '2px 4px',
                      outline: 'none'
                    }}
                    title="Haga clic para editar el nombre de la cámara"
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 4,
                      backgroundColor: isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isLive ? '#10b981' : '#9ca3af',
                      border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.4)' : '#333'}`
                    }}
                  >
                    {isLive ? `● EN VIVO (${slot.actualFps || 30} FPS)` : slot.enabled ? 'ESPERANDO SEÑAL' : 'DESACTIVADA'}
                  </span>
                  <button
                    onClick={() => handleToggleSlot(slot)}
                    disabled={loadingSlotId === slot.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      backgroundColor: slot.enabled ? '#ef4444' : '#10b981',
                      border: 'none',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    {slot.enabled ? <Square size={11} /> : <Play size={11} />}
                    {slot.enabled ? 'Detener' : 'Activar'}
                  </button>
                </div>
              </div>

              {/* Mode Selector */}
              <div style={{ display: 'flex', gap: 6, backgroundColor: '#0d0f14', padding: 4, borderRadius: 6 }}>
                <button
                  type="button"
                  onClick={() => handleModeChange(slot, 'rtmp')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 4,
                    border: 'none',
                    backgroundColor: slot.mode === 'rtmp' ? '#FF7A00' : 'transparent',
                    color: slot.mode === 'rtmp' ? '#000' : '#9ca3af',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Radio size={12} /> RTMP Push (OctoStream)
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange(slot, 'rtsp')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 4,
                    border: 'none',
                    backgroundColor: slot.mode === 'rtsp' ? '#FF7A00' : 'transparent',
                    color: slot.mode === 'rtsp' ? '#000' : '#9ca3af',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Camera size={12} /> RTSP Pull
                </button>
              </div>

              {/* Mode Details */}
              {slot.mode === 'rtmp' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 11 }}>
                  {/* Primary Complete URL for OctoStream (Local Wi-Fi) */}
                  <div style={{ backgroundColor: '#0f172a', padding: 8, borderRadius: 6, border: '1px solid #1e293b' }}>
                    <div style={{ color: '#38bdf8', marginBottom: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📱 URL Completa para OctoStream (Wi-Fi Local):</span>
                      <span style={{ fontSize: 9, color: '#10b981', backgroundColor: 'rgba(16,185,129,0.15)', padding: '1px 6px', borderRadius: 10 }}>Pega esta URL en OctoStream</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        readOnly
                        value={slot.rtmpUrl || `rtmp://127.0.0.1:${slot.rtmpPort}/live/${slot.rtmpStreamKey}`}
                        style={{
                          flex: 1,
                          backgroundColor: '#020617',
                          border: '1px solid #38bdf8',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#fff',
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      />
                      <button
                        onClick={() => copyToClipboard(slot.rtmpUrl || '', `local_${slot.id}`)}
                        title="Copiar URL para OctoStream"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: copiedKey === `local_${slot.id}` ? '#10b981' : '#0284c7',
                          border: 'none',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '0 10px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700
                        }}
                      >
                        {copiedKey === `local_${slot.id}` ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKey === `local_${slot.id}` ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>

                  {/* Tailscale URL */}
                  {slot.tailscaleRtmpUrl && (
                    <div style={{ backgroundColor: '#0b1329', padding: 8, borderRadius: 6, border: '1px solid #1e3a8a' }}>
                      <div style={{ color: '#93c5fd', marginBottom: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>🌐 Acceso Remoto por Tailscale (Datos Móviles / Fuera de Iglesia):</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          readOnly
                          value={slot.tailscaleRtmpUrl}
                          style={{
                            flex: 1,
                            backgroundColor: '#020617',
                            border: '1px solid #3b82f6',
                            borderRadius: 4,
                            padding: '6px 8px',
                            color: '#bfdbfe',
                            fontFamily: 'monospace',
                            fontSize: 11
                          }}
                        />
                        <button
                          onClick={() => copyToClipboard(slot.tailscaleRtmpUrl || '', `ts_${slot.id}`)}
                          title="Copiar URL de Tailscale"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: copiedKey === `ts_${slot.id}` ? '#10b981' : '#1d4ed8',
                            border: 'none',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '0 10px',
                            cursor: 'pointer',
                            fontSize: 11,
                            fontWeight: 700
                          }}
                        >
                          {copiedKey === `ts_${slot.id}` ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === `ts_${slot.id}` ? 'Copiado' : 'Copiar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Two separate fields for apps like OBS that separate Server and Key */}
                  <details style={{ marginTop: 2, color: '#6b7280', fontSize: 10 }}>
                    <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                      ⚙️ Solo para apps con Servidor y Clave separados (ej. OBS Studio)
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                      <div>
                        <div style={{ color: '#9ca3af', marginBottom: 2, fontWeight: 600 }}>1. Server URL:</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            readOnly
                            value={slot.rtmpServerBase || `rtmp://127.0.0.1:${slot.rtmpPort}/live`}
                            style={{
                              flex: 1,
                              backgroundColor: '#0a0c10',
                              border: '1px solid #2e384d',
                              borderRadius: 4,
                              padding: '5px 7px',
                              color: '#58a6ff',
                              fontFamily: 'monospace',
                              fontSize: 10
                            }}
                          />
                          <button
                            onClick={() => copyToClipboard(slot.rtmpServerBase || '', `srv_${slot.id}`)}
                            title="Copiar Server URL"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              backgroundColor: copiedKey === `srv_${slot.id}` ? '#10b981' : '#1f2937',
                              border: '1px solid #374151',
                              color: '#fff',
                              borderRadius: 4,
                              padding: '0 6px',
                              cursor: 'pointer'
                            }}
                          >
                            {copiedKey === `srv_${slot.id}` ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div style={{ color: '#9ca3af', marginBottom: 2, fontWeight: 600 }}>2. Stream Key:</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            readOnly
                            value={slot.rtmpStreamKey || slot.id}
                            style={{
                              flex: 1,
                              backgroundColor: '#0a0c10',
                              border: '1px solid #2e384d',
                              borderRadius: 4,
                              padding: '5px 7px',
                              color: '#ff7a00',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              fontSize: 10
                            }}
                          />
                          <button
                            onClick={() => copyToClipboard(slot.rtmpStreamKey || slot.id, `key_${slot.id}`)}
                            title="Copiar Stream Key"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              backgroundColor: copiedKey === `key_${slot.id}` ? '#10b981' : '#1f2937',
                              border: '1px solid #374151',
                              color: '#fff',
                              borderRadius: 4,
                              padding: '0 6px',
                              cursor: 'pointer'
                            }}
                          >
                            {copiedKey === `key_${slot.id}` ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* QR Code Action */}
                  {slot.qrDataUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ color: '#9ca3af' }}>Escanear QR con iPhone para abrir en Safari:</span>
                      <button
                        onClick={() => setSelectedQrSlot(slot)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '4px 10px',
                          cursor: 'pointer',
                          fontSize: 11
                        }}
                      >
                        <QrCode size={12} /> Ver Código QR
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                  <div>
                    <div style={{ color: '#9ca3af', marginBottom: 2 }}>URL RTSP de la cámara (mostrada en la app OctoStream):</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        defaultValue={slot.rtspUrl}
                        placeholder="rtsp://192.168.1.50:8554/live"
                        onBlur={(e) => handleRtspUrlChange(slot, e.target.value)}
                        style={{
                          flex: 1,
                          backgroundColor: '#0a0c10',
                          border: '1px solid #2e384d',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#fff',
                          fontFamily: 'monospace',
                          fontSize: 11
                        }}
                      />
                      <button
                        onClick={() => handleToggleSlot(slot)}
                        style={{
                          backgroundColor: '#10b981',
                          border: 'none',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '0 10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 11
                        }}
                      >
                        Conectar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* QR Code Modal */}
      {selectedQrSlot && (
        <div
          onClick={() => setSelectedQrSlot(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#161a22',
              border: '1px solid #30363d',
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: '92%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14
            }}
          >
            <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>{selectedQrSlot.name}</h3>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: 12, textAlign: 'center', lineHeight: 1.4 }}>
              Apunta la cámara de tu iPhone a este código QR para abrir la página en <strong>Safari</strong> y copiar los parámetros con un toque:
            </p>
            {selectedQrSlot.qrDataUrl && (
              <img
                src={selectedQrSlot.qrDataUrl}
                alt="QR Code"
                style={{ width: 200, height: 200, borderRadius: 8, backgroundColor: '#fff', padding: 8 }}
              />
            )}

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ color: '#38bdf8', fontWeight: 700 }}>URL Completa para OctoStream:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  value={selectedQrSlot.rtmpUrl || `rtmp://127.0.0.1:${selectedQrSlot.rtmpPort}/live/${selectedQrSlot.rtmpStreamKey}`}
                  style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #38bdf8', borderRadius: 4, padding: '6px 8px', color: '#58a6ff', fontFamily: 'monospace', fontSize: 11 }}
                />
                <button
                  onClick={() => copyToClipboard(selectedQrSlot.rtmpUrl || '', 'modal_srv')}
                  style={{ backgroundColor: copiedKey === 'modal_srv' ? '#10b981' : '#0284c7', border: 'none', color: '#fff', padding: '0 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                >
                  {copiedKey === 'modal_srv' ? '✓ Copiado' : 'Copiar URL'}
                </button>
              </div>

              {selectedQrSlot.tailscaleRtmpUrl && (
                <>
                  <div style={{ color: '#93c5fd', fontWeight: 600, marginTop: 4 }}>URL Tailscale (Remoto):</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      readOnly
                      value={selectedQrSlot.tailscaleRtmpUrl}
                      style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #30363d', borderRadius: 4, padding: '6px 8px', color: '#93c5fd', fontFamily: 'monospace', fontSize: 11 }}
                    />
                    <button
                      onClick={() => copyToClipboard(selectedQrSlot.tailscaleRtmpUrl || '', 'modal_ts')}
                      style={{ backgroundColor: copiedKey === 'modal_ts' ? '#10b981' : '#1d4ed8', border: 'none', color: '#fff', padding: '0 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                    >
                      {copiedKey === 'modal_ts' ? '✓ Copiado' : 'Copiar Tailscale'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setSelectedQrSlot(null)}
              style={{
                backgroundColor: '#FF7A00',
                border: 'none',
                color: '#000',
                fontWeight: 700,
                padding: '8px 24px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                marginTop: 4
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
