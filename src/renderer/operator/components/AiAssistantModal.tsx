import React, { useState, useEffect } from 'react'
import { AiAssistantConfig, AiTaskType } from '../../../shared/types'

interface AiAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onAddToLibrary?: (slides: { title: string; body: string }[]) => void
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onAddToLibrary
}) => {
  const [config, setConfig] = useState<AiAssistantConfig>({
    enabled: false,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini'
  })

  const [task, setTask] = useState<AiTaskType>('sermon_to_slides')
  const [inputContent, setInputContent] = useState('')
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')

  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  // Strict human review results
  const [generatedSlides, setGeneratedSlides] = useState<{ title: string; body: string }[]>([])
  const [scriptureSuggestions, setScriptureSuggestions] = useState<{ reference: string; text: string; explanation?: string }[]>([])

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      const cfg = await window.churchPresenterApi.getAiAssistantConfig()
      setConfig(cfg)
      setApiKeyInput(cfg.apiKey || '')
    } catch {
      // ignore
    }
  }

  const handleSaveConfig = async () => {
    try {
      const updated = await window.churchPresenterApi.saveAiAssistantConfig({
        enabled: config.enabled,
        provider: config.provider,
        apiKey: apiKeyInput,
        model: config.model
      })
      setConfig(updated)
      setShowConfigPanel(false)
      setStatusMessage('Configuración de Asistente guardada exitosamente.')
    } catch (err: any) {
      setStatusMessage('Error al guardar configuración: ' + err?.message)
    }
  }

  const handleProcessTask = async () => {
    if (!inputContent.trim()) {
      setStatusMessage('El texto a procesar no puede estar vacío.')
      return
    }

    setIsProcessing(true)
    setStatusMessage('')
    setGeneratedSlides([])
    setScriptureSuggestions([])

    try {
      const res = await window.churchPresenterApi.executeAiTask({
        task,
        inputContent: inputContent.trim()
      })

      if (res.success) {
        if (res.slides && res.slides.length > 0) {
          setGeneratedSlides(res.slides)
          setStatusMessage(`✅ Se generaron ${res.slides.length} diapositivas. Revise y edite antes de guardar.`)
        } else if (res.scriptureSuggestions && res.scriptureSuggestions.length > 0) {
          setScriptureSuggestions(res.scriptureSuggestions)
          setStatusMessage(`✅ Se encontraron ${res.scriptureSuggestions.length} lecturas bíblicas recomendadas.`)
        }
      } else {
        setStatusMessage('⚠️ ' + (res.error || 'No se pudo completar la tarea.'))
      }
    } catch (err: any) {
      setStatusMessage('Error al procesar: ' + err?.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSlideChange = (index: number, field: 'title' | 'body', value: string) => {
    const updated = [...generatedSlides]
    updated[index] = { ...updated[index], [field]: value }
    setGeneratedSlides(updated)
  }

  const handleDeleteSlide = (index: number) => {
    setGeneratedSlides(generatedSlides.filter((_, i) => i !== index))
  }

  const handleAddBlankSlide = () => {
    setGeneratedSlides([
      ...generatedSlides,
      { title: `Nueva Diapositiva ${generatedSlides.length + 1}`, body: '' }
    ])
  }

  const handleSaveAllToLibrary = () => {
    if (generatedSlides.length === 0) return
    if (onAddToLibrary) {
      onAddToLibrary(generatedSlides)
    }
    setStatusMessage(`✅ Se agregaron ${generatedSlides.length} diapositivas a la biblioteca.`)
  }

  const handleAddScripturesAsSlides = () => {
    const slides = scriptureSuggestions.map((s) => ({
      title: s.reference,
      body: s.text
    }))
    setGeneratedSlides(slides)
    setScriptureSuggestions([])
    setStatusMessage(`✅ Convertidas ${slides.length} lecturas a diapositivas editables.`)
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
          width: '92%',
          maxWidth: '900px',
          maxHeight: '92vh',
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
            <span style={{ fontSize: '1.25rem' }}>✨</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#38BDF8' }}>
              Asistente de Contenido y Diapositivas (Opcional)
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              style={{
                background: '#1A1A1A',
                border: '1px solid #333',
                color: '#CBD5E1',
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              ⚙️ {showConfigPanel ? 'Ocultar Ajustes' : 'Ajustes API'}
            </button>
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
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Config Drawer (Encrypted Key) */}
          {showConfigPanel && (
            <div
              style={{
                padding: '14px',
                background: '#181818',
                borderRadius: 8,
                border: '1px solid #FF7A00',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#FF7A00' }}>
                Configuración del Proveedor de IA (Almacenamiento Cifrado con safeStorage)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Proveedor:</label>
                  <select
                    value={config.provider}
                    onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
                    style={{
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      color: '#FFF',
                      padding: '6px 8px',
                      borderRadius: 4
                    }}
                  >
                    <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="custom">Endpoint Personalizado / Local</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Clave de API (Cifrada):</label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-..."
                    style={{
                      background: '#0A0A0A',
                      border: '1px solid #333',
                      color: '#FFF',
                      padding: '6px 8px',
                      borderRadius: 4
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={handleSaveConfig}
                  style={{
                    background: '#22C55E',
                    color: '#0A0A0A',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Guardar Clave Cifrada
                </button>
              </div>
            </div>
          )}

          {/* Task Selector */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setTask('sermon_to_slides')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 6,
                border: task === 'sermon_to_slides' ? '1px solid #38BDF8' : '1px solid #262626',
                background: task === 'sermon_to_slides' ? '#1E293B' : '#141414',
                color: task === 'sermon_to_slides' ? '#38BDF8' : '#94A3B8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              📖 Bosquejo de Sermón a Diapositivas
            </button>
            <button
              onClick={() => setTask('split_text')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 6,
                border: task === 'split_text' ? '1px solid #38BDF8' : '1px solid #262626',
                background: task === 'split_text' ? '#1E293B' : '#141414',
                color: task === 'split_text' ? '#38BDF8' : '#94A3B8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              ✂️ Dividir Texto en Diapositivas (2-4 líneas)
            </button>
            <button
              onClick={() => setTask('suggest_scriptures')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 6,
                border: task === 'suggest_scriptures' ? '1px solid #38BDF8' : '1px solid #262626',
                background: task === 'suggest_scriptures' ? '#1E293B' : '#141414',
                color: task === 'suggest_scriptures' ? '#38BDF8' : '#94A3B8',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              🔍 Sugerir Pasajes Bíblicos por Tema
            </button>
          </div>

          {/* Input Text Box with Pre-send Verification */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1' }}>
                {task === 'suggest_scriptures'
                  ? 'Tema o palabra clave (ej: Fe, Perdón, Esperanza, Gratitud):'
                  : 'Texto o bosquejo a procesar:'}
              </label>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                {inputContent.length} caracteres | 100% revisión humana antes de guardar
              </span>
            </div>
            <textarea
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              placeholder={
                task === 'sermon_to_slides'
                  ? 'Título: El Poder de la Oración\nI. La oración nos acerca al Padre (Santiago 4:8)\nII. La oración vence la ansiedad (Filipenses 4:6)...'
                  : task === 'suggest_scriptures'
                  ? 'Ej: Salvación, Fe, Paz, Esperanza, Alabanza'
                  : 'Pegue aquí párrafos o texto extenso para dividirlo automáticamente en pantallas de 2 a 4 líneas sin cortar oraciones...'
              }
              rows={task === 'suggest_scriptures' ? 2 : 5}
              style={{
                width: '100%',
                background: '#0A0A0A',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '10px 12px',
                color: '#FFF',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Strict Human-in-the-loop Pre-send Banner */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#161616',
              borderRadius: 6,
              border: '1px solid #262626',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              🔒 <strong>Garantía de Privacidad y Control Humano:</strong> Ningún dato se envía sin su confirmación
              explícita mediante el botón.
            </div>
            <button
              onClick={handleProcessTask}
              disabled={isProcessing || !inputContent.trim()}
              style={{
                background: '#22C55E',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                fontWeight: 700,
                cursor: isProcessing || !inputContent.trim() ? 'not-allowed' : 'pointer',
                opacity: isProcessing || !inputContent.trim() ? 0.5 : 1
              }}
            >
              {isProcessing ? 'Procesando...' : 'Procesar con Asistente'}
            </button>
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

          {/* Scripture Suggestions Output */}
          {scriptureSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38BDF8' }}>
                Pasajes Bíblicos Recomendados:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '220px', overflowY: 'auto' }}>
                {scriptureSuggestions.map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      background: '#161616',
                      borderRadius: 6,
                      border: '1px solid #262626'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#38BDF8', marginBottom: 2 }}>{s.reference}</div>
                    <div style={{ fontSize: '0.85rem', color: '#F1F5F9', fontStyle: 'italic' }}>"{s.text}"</div>
                    {s.explanation && (
                      <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: 4 }}>{s.explanation}</div>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddScripturesAsSlides}
                style={{
                  background: '#38BDF8',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  alignSelf: 'flex-start'
                }}
              >
                Convertir a Diapositivas Editables
              </button>
            </div>
          )}

          {/* Editable Slides Review Table */}
          {generatedSlides.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#22C55E' }}>
                  Tabla Editable de Diapositivas ({generatedSlides.length} pantallas generadas):
                </div>
                <button
                  onClick={handleAddBlankSlide}
                  style={{
                    background: '#1E1E1E',
                    border: '1px solid #333',
                    color: '#38BDF8',
                    padding: '4px 10px',
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  + Agregar Diapositiva
                </button>
              </div>

              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid #262626',
                  borderRadius: 6,
                  background: '#0A0A0A',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                {generatedSlides.map((slide, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      background: '#161616',
                      borderRadius: 6,
                      border: '1px solid #262626',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94A3B8', width: 24 }}>#{i + 1}</span>
                      <input
                        type="text"
                        value={slide.title}
                        onChange={(e) => handleSlideChange(i, 'title', e.target.value)}
                        placeholder="Título de la diapositiva..."
                        style={{
                          flex: 1,
                          background: '#0A0A0A',
                          border: '1px solid #333',
                          borderRadius: 4,
                          padding: '4px 8px',
                          color: '#38BDF8',
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      />
                      <button
                        onClick={() => handleDeleteSlide(i)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#EF4444',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          padding: '0 6px'
                        }}
                        title="Eliminar diapositiva"
                      >
                        🗑️
                      </button>
                    </div>
                    <textarea
                      value={slide.body}
                      onChange={(e) => handleSlideChange(i, 'body', e.target.value)}
                      rows={2}
                      style={{
                        width: '100%',
                        background: '#0A0A0A',
                        border: '1px solid #333',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: '0.85rem',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                ))}
              </div>
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
          {generatedSlides.length > 0 && (
            <button
              onClick={handleSaveAllToLibrary}
              style={{
                background: '#22C55E',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 6,
                padding: '8px 24px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Guardar Diapositivas Revisadas
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
