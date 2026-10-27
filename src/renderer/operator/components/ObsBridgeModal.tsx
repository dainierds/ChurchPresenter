import React, { useState, useEffect } from 'react'
import { X, Radio, Video, Play, Square, Check, Copy, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react'
import { ObsConfig, ObsStatus } from '../../../shared/types'

interface ObsBridgeModalProps {
  isOpen: boolean
  onClose: () => void
  remotePort?: number
}

export const ObsBridgeModal: React.FC<ObsBridgeModalProps> = ({ isOpen, onClose, remotePort = 8080 }) => {
  const [config, setConfig] = useState<ObsConfig>({
    host: 'localhost',
    port: 4455,
    password: '',
    autoConnect: false
  })

  const [status, setStatus] = useState<ObsStatus>({
    connected: false,
    streaming: false,
    recording: false,
    currentScene: '',
    scenes: []
  })

  const [showPassword, setShowPassword] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    loadData()

    const unsub = window.churchPresenterApi.onObsStatusChanged?.((st) => {
      setStatus(st)
      if (st.connected) {
        setIsConnecting(false)
      }
    })

    return () => {
      if (unsub) unsub()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const cfg = await window.churchPresenterApi.getObsConfig()
      setConfig(cfg)
      const st = await window.churchPresenterApi.getObsStatus()
      setStatus(st)
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  if (!isOpen) return null

  const handleSave = async () => {
    try {
      await window.churchPresenterApi.saveObsConfig(config)
      setSuccessMsg('Configuración guardada correctamente con cifrado seguro.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setErrorMsg(null)
    try {
      await window.churchPresenterApi.saveObsConfig(config)
      const res = await window.churchPresenterApi.connectObs({
        host: config.host,
        port: config.port,
        password: config.password
      })
      if (!res.success) {
        setErrorMsg(res.error || 'No se pudo conectar a OBS')
      } else {
        setSuccessMsg('Conexión con OBS Studio establecida.')
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await window.churchPresenterApi.disconnectObs()
      setStatus((prev) => ({ ...prev, connected: false, streaming: false, recording: false }))
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  const handleSwitchScene = async (sceneName: string) => {
    try {
      const res = await window.churchPresenterApi.setObsScene(sceneName)
      if (!res.success) setErrorMsg(res.error || 'Error cambiando escena')
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  const handleToggleStream = async () => {
    try {
      if (status.streaming) {
        await window.churchPresenterApi.stopObsStream()
      } else {
        await window.churchPresenterApi.startObsStream()
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  const handleToggleRecord = async () => {
    try {
      if (status.recording) {
        await window.churchPresenterApi.stopObsRecord()
      } else {
        await window.churchPresenterApi.startObsRecord()
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    }
  }

  const browserSourceUrl = `http://localhost:${remotePort}/outputs/program?transparent=true`

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(browserSourceUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2500)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        className="pro-modal-box pro-modal-container"
        style={{
          width: '740px',
          maxHeight: '90vh',
          backgroundColor: '#121212',
          border: '1px solid #2A2A2A',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          color: '#f3f4f6',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#181818',
            borderBottom: '1px solid #2A2A2A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={18} color="#FF7A00" />
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              Puente con OBS Studio (obs-websocket v5)
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid #22c55e',
                borderRadius: '6px',
                padding: '10px 14px',
                color: '#4ade80',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Check size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Section 1: Browser Source Guide for OBS */}
          <div
            style={{
              backgroundColor: '#181818',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              padding: '14px 16px'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
              Fuente de Navegador para OBS Studio (Fondo Transparente)
            </div>
            <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.5, margin: 0, marginBottom: '10px' }}>
              En OBS Studio, agregue una <strong>Fuente de Navegador (Browser Source)</strong> con resolución 1920x1080. Las diapositivas, versículos bíblicos y tercios inferiores se superpondrán con canal alfa transparente directamente sobre sus cámaras.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={browserSourceUrl}
                style={{
                  flex: 1,
                  backgroundColor: '#0A0A0A',
                  border: '1px solid #333333',
                  color: '#38bdf8',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}
              />
              <button
                onClick={handleCopyUrl}
                style={{
                  backgroundColor: copiedUrl ? '#22c55e' : '#FF7A00',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedUrl ? 'Copiado' : 'Copiar URL'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Connection Parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                Servidor / Host de OBS
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="localhost o IP en la red"
                style={{
                  width: '100%',
                  backgroundColor: '#0A0A0A',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                Puerto
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 4455 })}
                style={{
                  width: '100%',
                  backgroundColor: '#0A0A0A',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                  padding: '8px 12px',
                  borderRadius: '6px'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
              Contraseña de obs-websocket (Almacenada con cifrado seguro safeStorage)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={config.password || ''}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="Deje en blanco si no tiene contraseña configurada en OBS"
                style={{
                  width: '100%',
                  backgroundColor: '#0A0A0A',
                  border: '1px solid #333',
                  color: '#fff',
                  fontSize: '13px',
                  padding: '8px 38px 8px 12px',
                  borderRadius: '6px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={config.autoConnect}
                onChange={(e) => setConfig({ ...config, autoConnect: e.target.checked })}
              />
              <span>Conectar automáticamente a OBS al iniciar ChurchPresenter</span>
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  backgroundColor: '#222',
                  border: '1px solid #333',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Guardar
              </button>
              {status.connected ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  style={{
                    backgroundColor: '#ef4444',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  style={{
                    backgroundColor: '#FF7A00',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: isConnecting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isConnecting && <RefreshCw size={14} className="spin" />}
                  <span>{isConnecting ? 'Conectando...' : 'Conectar a OBS'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Live OBS State & Scene Control */}
          <div
            style={{
              backgroundColor: '#181818',
              border: '1px solid #2A2A2A',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: status.connected ? '#22c55e' : '#ef4444'
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 700 }}>
                  Estado OBS: {status.connected ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              {status.connected && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleToggleStream}
                    style={{
                      backgroundColor: status.streaming ? '#ef4444' : '#222',
                      border: '1px solid #333',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Radio size={12} />
                    <span>{status.streaming ? 'DETENER STREAM' : 'TRANSMITIR'}</span>
                  </button>
                  <button
                    onClick={handleToggleRecord}
                    style={{
                      backgroundColor: status.recording ? '#ef4444' : '#222',
                      border: '1px solid #333',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Video size={12} />
                    <span>{status.recording ? 'DETENER REC' : 'GRABAR'}</span>
                  </button>
                </div>
              )}
            </div>

            {status.connected ? (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Cambiar Escena Activa de OBS Studio:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(status.scenes || []).map((sceneName) => {
                    const isCur = sceneName === status.currentScene
                    return (
                      <button
                        key={sceneName}
                        onClick={() => handleSwitchScene(sceneName)}
                        style={{
                          backgroundColor: isCur ? '#FF7A00' : '#222',
                          border: isCur ? '1px solid #FF7A00' : '1px solid #333',
                          color: '#fff',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: isCur ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {sceneName}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                Conéctese a OBS Studio para sincronizar y cambiar escenas desde ChurchPresenter.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#181818',
            borderTop: '1px solid #2A2A2A',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#FF7A00',
              border: 'none',
              color: '#fff',
              borderRadius: '6px',
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
