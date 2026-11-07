import React, { useState, useEffect } from 'react'
import { X, Send, Plus, AlertCircle } from 'lucide-react'
import { PresentationMessage } from '../../../shared/types'

interface MessageModalProps {
  isOpen: boolean
  onClose: () => void
  activeMessage: PresentationMessage | null | undefined
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  activeMessage
}) => {
  const [text, setText] = useState<string>('')
  const [target, setTarget] = useState<'stage' | 'audience' | 'both'>('stage')
  const [duration, setDuration] = useState<number>(30)
  const [presets, setPresets] = useState<string[]>([])
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadPresets()
      if (activeMessage?.text && !text) {
        setText(activeMessage.text)
      }
      if (activeMessage?.target) {
        setTarget(activeMessage.target)
      }
    }
  }, [isOpen, activeMessage])

  const loadPresets = async () => {
    try {
      if (window.churchPresenterApi?.getMessagePresets) {
        const p = await window.churchPresenterApi.getMessagePresets()
        setPresets(p || [])
      }
    } catch (err) {
      console.error('Error loading message presets:', err)
    }
  }

  const handleSendMessage = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setStatusMsg({ text: 'Por favor escriba el texto del mensaje.', type: 'error' })
      return
    }

    try {
      await window.churchPresenterApi.sendMessage({
        text: trimmed,
        target,
        durationSeconds: duration > 0 ? duration : undefined
      })
      setStatusMsg({ text: 'Mensaje publicado exitosamente.', type: 'success' })
      setText('')
      setTimeout(() => setStatusMsg(null), 2500)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al enviar mensaje.', type: 'error' })
    }
  }

  const handleClearMessage = async () => {
    try {
      await window.churchPresenterApi.clearMessage()
      setStatusMsg({ text: 'Mensaje eliminado de las pantallas.', type: 'success' })
      setTimeout(() => setStatusMsg(null), 2500)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al quitar mensaje.', type: 'error' })
    }
  }

  const handleAddPreset = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      const updated = await window.churchPresenterApi.saveMessagePreset(trimmed)
      setPresets(updated)
      setStatusMsg({ text: 'Plantilla guardada.', type: 'success' })
      setTimeout(() => setStatusMsg(null), 2000)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al guardar plantilla.', type: 'error' })
    }
  }

  const handleDeletePreset = async (presetText: string) => {
    try {
      const updated = await window.churchPresenterApi.deleteMessagePreset(presetText)
      setPresets(updated)
    } catch (err) {
      console.error('Error deleting preset:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" style={{ zIndex: 99999 }}>
      <div
        className="modal-content message-modal"
        style={{
          width: '580px',
          maxWidth: '92vw',
          backgroundColor: '#141414',
          border: '1px solid #2e2e2e',
          borderRadius: 10,
          color: '#f3f4f6',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #262626'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.4px' }}>
              ENVIAR MENSAJE A PANTALLAS
            </span>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Message Banner if any */}
          {activeMessage && (
            <div
              style={{
                backgroundColor: '#261b14',
                border: '1px solid #f97316',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <AlertCircle size={18} color="#f97316" style={{ flexShrink: 0 }} />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase' }}>
                    MENSAJE ACTIVO EN VIVO ({activeMessage.target === 'both' ? 'Audiencia y Escenario' : activeMessage.target === 'audience' ? 'Audiencia' : 'Escenario'})
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    "{activeMessage.text}"
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearMessage}
                style={{
                  backgroundColor: '#b91c1c',
                  border: '1px solid #ef4444',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                Quitar de pantalla
              </button>
            </div>
          )}

          {/* Text Area */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Texto del Mensaje:
            </label>
            <textarea
              rows={3}
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Escriba aquí el aviso para el predicador, músicos o congregación (Ctrl+Enter para proyectar)..."
              style={{
                width: '100%',
                backgroundColor: '#0d0d0d',
                border: '1px solid #333',
                borderRadius: 8,
                padding: '12px',
                color: '#ffffff',
                fontSize: 14,
                lineHeight: 1.4,
                resize: 'none',
                outline: 'none'
              }}
            />
          </div>

          {/* Target & Duration Selectors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Destino:
              </label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as any)}
                style={{
                  width: '100%',
                  backgroundColor: '#202020',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '10px',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none'
                }}
              >
                <option value="stage">Solo Escenario (Monitor de retorno)</option>
                <option value="audience">Solo Audiencia (Sobreimpreso sala)</option>
                <option value="both">Ambos (Escenario y Audiencia)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Duración:
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                style={{
                  width: '100%',
                  backgroundColor: '#202020',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '10px',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none'
                }}
              >
                <option value={0}>Manual (Hasta que se quite)</option>
                <option value={15}>15 segundos</option>
                <option value={30}>30 segundos</option>
                <option value={60}>1 minuto</option>
                <option value={120}>2 minutos</option>
              </select>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
                Plantillas Rápidas:
              </span>
              {text.trim() && (
                <button
                  type="button"
                  onClick={handleAddPreset}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Plus size={12} />
                  <span>Guardar texto como plantilla</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {presets.map((preset) => (
                <div
                  key={preset}
                  style={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #2e2e2e',
                    borderRadius: 6,
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setText(preset)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#d1d5db',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {preset}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset)}
                    title="Eliminar plantilla"
                    style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div
              style={{
                fontSize: 12,
                color: statusMsg.type === 'success' ? '#22c55e' : '#ef4444',
                backgroundColor: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                padding: '8px 12px',
                borderRadius: 6
              }}
            >
              {statusMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '14px 20px',
            backgroundColor: '#1a1a1a',
            borderTop: '1px solid #262626'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="secondary-action-btn"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSendMessage}
            className="primary-action-btn"
            style={{ padding: '8px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={14} />
            <span>Proyectar Mensaje</span>
          </button>
        </div>
      </div>
    </div>
  )
}
