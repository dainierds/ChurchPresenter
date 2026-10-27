import React, { useState, useEffect } from 'react'
import { X, Copy, Trash2, Check, Monitor } from 'lucide-react'
import { StageLayoutConfig, StageLayoutElement } from '../../../shared/types'

interface StageLayoutEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onAssignedChange?: () => void
}

export const StageLayoutEditorModal: React.FC<StageLayoutEditorModalProps> = ({
  isOpen,
  onClose,
  onAssignedChange
}) => {
  const [layouts, setLayouts] = useState<StageLayoutConfig[]>([])
  const [assignedId, setAssignedId] = useState<string>('')
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('')
  const [editedLayout, setEditedLayout] = useState<StageLayoutConfig | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      if (window.churchPresenterApi?.getStageLayouts) {
        const all = await window.churchPresenterApi.getStageLayouts()
        const assigned = await window.churchPresenterApi.getAssignedStageLayout()
        setLayouts(all)
        setAssignedId(assigned.id)
        const initial = all.find((l) => l.id === assigned.id) || all[0]
        if (initial) {
          setSelectedLayoutId(initial.id)
          setEditedLayout(JSON.parse(JSON.stringify(initial)))
        }
      }
    } catch (err) {
      console.error('Error loading stage layouts:', err)
    }
  }

  const handleSelectLayout = (layout: StageLayoutConfig) => {
    setSelectedLayoutId(layout.id)
    setEditedLayout(JSON.parse(JSON.stringify(layout)))
  }

  const handleSetAssigned = async (layoutId: string) => {
    try {
      await window.churchPresenterApi.setAssignedStageLayout(layoutId)
      setAssignedId(layoutId)
      onAssignedChange?.()
      setStatusMsg({ text: 'Diseño asignado a la pantalla de escenario.', type: 'success' })
      setTimeout(() => setStatusMsg(null), 2500)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al asignar.', type: 'error' })
    }
  }

  const handleSaveLayout = async () => {
    if (!editedLayout) return
    try {
      const saved = await window.churchPresenterApi.saveStageLayout(editedLayout)
      const all = await window.churchPresenterApi.getStageLayouts()
      setLayouts(all)
      setEditedLayout(JSON.parse(JSON.stringify(saved)))
      setStatusMsg({ text: `Diseño '${saved.name}' guardado exitosamente.`, type: 'success' })
      setTimeout(() => setStatusMsg(null), 2500)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al guardar.', type: 'error' })
    }
  }

  const handleDuplicate = async () => {
    if (!editedLayout) return
    const newId = `stage_layout_${Date.now()}`
    const duplicated: StageLayoutConfig = {
      ...JSON.parse(JSON.stringify(editedLayout)),
      id: newId,
      name: `${editedLayout.name} (Copia)`,
      isBuiltIn: false
    }
    try {
      const saved = await window.churchPresenterApi.saveStageLayout(duplicated)
      const all = await window.churchPresenterApi.getStageLayouts()
      setLayouts(all)
      setSelectedLayoutId(saved.id)
      setEditedLayout(saved)
      setStatusMsg({ text: `Diseño duplicado como '${saved.name}'.`, type: 'success' })
      setTimeout(() => setStatusMsg(null), 2500)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al duplicar.', type: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!editedLayout || editedLayout.isBuiltIn) return
    if (!confirm(`¿Eliminar el diseño "${editedLayout.name}"?`)) return
    try {
      await window.churchPresenterApi.deleteStageLayout(editedLayout.id)
      const all = await window.churchPresenterApi.getStageLayouts()
      setLayouts(all)
      const next = all[0]
      if (next) {
        setSelectedLayoutId(next.id)
        setEditedLayout(JSON.parse(JSON.stringify(next)))
      }
      setStatusMsg({ text: 'Diseño eliminado.', type: 'success' })
      setTimeout(() => setStatusMsg(null), 2500)
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error al eliminar.', type: 'error' })
    }
  }

  const updateElement = (elId: string, partial: Partial<StageLayoutElement>) => {
    if (!editedLayout) return
    const updatedElements = (editedLayout.elements || []).map((el) => {
      if (el.id === elId) {
        return { ...el, ...partial }
      }
      return el
    })
    setEditedLayout({ ...editedLayout, elements: updatedElements })
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" style={{ zIndex: 99999 }}>
      <div
        className="modal-content stage-layout-modal"
        style={{
          width: '92vw',
          maxWidth: '1240px',
          height: '88vh',
          maxHeight: '840px',
          backgroundColor: '#121212',
          border: '1px solid #2e2e2e',
          borderRadius: 10,
          color: '#f3f4f6',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            backgroundColor: '#181818',
            borderBottom: '1px solid #262626'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Monitor size={18} color="#f97316" />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.4px' }}>
              DISEÑOS DE PANTALLA DE ESCENARIO
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

        {/* 3 Columns Layout */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Column 1: Layouts List */}
          <div
            style={{
              width: '280px',
              backgroundColor: '#161616',
              borderRight: '1px solid #262626',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '12px', borderBottom: '1px solid #262626', display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleDuplicate}
                className="secondary-action-btn"
                style={{ flex: 1, padding: '6px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Copy size={13} />
                <span>Duplicar</span>
              </button>
              {editedLayout && !editedLayout.isBuiltIn && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="secondary-action-btn"
                  style={{ borderColor: '#ef4444', color: '#ef4444', padding: '6px 10px' }}
                  title="Eliminar diseño"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {layouts.map((l) => {
                const isSelected = selectedLayoutId === l.id
                const isAssigned = assignedId === l.id
                return (
                  <div
                    key={l.id}
                    onClick={() => handleSelectLayout(l)}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: isSelected ? '#222' : '#1a1a1a',
                      border: `1px solid ${isSelected ? '#f97316' : '#282828'}`,
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: '#f3f4f6' }}>{l.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {l.isBuiltIn ? 'De fábrica' : 'Personalizado'}
                      </div>
                    </div>
                    {isAssigned && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          backgroundColor: '#22c55e',
                          color: '#000',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}
                      >
                        ACTIVO
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Column 2: 16:9 Canvas Preview */}
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d' }}>
            <div
              style={{
                width: '100%',
                maxWidth: '680px',
                aspectRatio: '16/9',
                backgroundColor: editedLayout?.backgroundColor || '#000000',
                border: '2px solid #333',
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 15px 35px rgba(0,0,0,0.8)'
              }}
            >
              {(editedLayout?.elements || []).filter((e) => e.visible).map((el) => {
                let sampleContent = ''
                if (el.type === 'current-slide') sampleContent = 'Sublime gracia del Señor,\nque a un pecador salvó.'
                else if (el.type === 'next-slide') sampleContent = 'Fui ciego mas hoy veo yo...'
                else if (el.type === 'clock') sampleContent = '10:45 AM'
                else if (el.type === 'timers') sampleContent = '24:18'
                else if (el.type === 'notes') sampleContent = 'Énfasis en Romanos 8:1'
                else if (el.type === 'messages') sampleContent = 'Aviso: Músicos listos'

                return (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.width}%`,
                      height: `${el.height}%`,
                      border: '1px dashed rgba(249, 115, 22, 0.4)',
                      padding: '4px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {el.showLabel && el.label && (
                      <div style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                        {el.label}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: `${Math.max(10, (el.fontSizeVmin || 4) * 2.2)}px`,
                        color: el.fontColor || '#ffffff',
                        fontWeight: (el.fontWeight as any) || '700',
                        textAlign: el.alignment || 'left',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.2
                      }}
                    >
                      {sampleContent}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Action Bar Under Canvas */}
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              {editedLayout && assignedId !== editedLayout.id && (
                <button
                  type="button"
                  onClick={() => handleSetAssigned(editedLayout.id)}
                  className="primary-action-btn"
                  style={{ fontSize: 13, padding: '8px 18px' }}
                >
                  <Check size={14} style={{ marginRight: 6 }} />
                  <span>Usar como Pantalla de Escenario Activa</span>
                </button>
              )}
              {editedLayout && !editedLayout.isBuiltIn && (
                <button
                  type="button"
                  onClick={handleSaveLayout}
                  className="secondary-action-btn"
                  style={{ fontSize: 13, padding: '8px 18px', borderColor: '#22c55e', color: '#22c55e' }}
                >
                  Guardar Cambios
                </button>
              )}
            </div>

            {statusMsg && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: statusMsg.type === 'success' ? '#22c55e' : '#ef4444',
                  backgroundColor: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  padding: '6px 14px',
                  borderRadius: 6
                }}
              >
                {statusMsg.text}
              </div>
            )}
          </div>

          {/* Column 3: Elements Property Panel */}
          <div
            style={{
              width: '320px',
              backgroundColor: '#161616',
              borderLeft: '1px solid #262626',
              padding: '16px',
              overflowY: 'auto'
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 12 }}>
              Elementos Visibles en Pantalla:
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(editedLayout?.elements || []).map((el) => {
                return (
                  <div
                    key={el.id}
                    style={{
                      backgroundColor: '#202020',
                      border: '1px solid #2d2d2d',
                      borderRadius: 6,
                      padding: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{el.label || el.type}</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={el.visible}
                          onChange={(e) => updateElement(el.id, { visible: e.target.checked })}
                        />
                        <span>Visible</span>
                      </label>
                    </div>

                    {el.visible && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tamaño (vmin):</label>
                          <input
                            type="number"
                            step="0.5"
                            min="2"
                            max="14"
                            value={el.fontSizeVmin || 5}
                            onChange={(e) => updateElement(el.id, { fontSizeVmin: parseFloat(e.target.value) || 5 })}
                            style={{ width: '100%', background: '#111', border: '1px solid #333', color: '#fff', padding: '4px', borderRadius: 4, fontSize: 12 }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Color:</label>
                          <input
                            type="color"
                            value={el.fontColor || '#ffffff'}
                            onChange={(e) => updateElement(el.id, { fontColor: e.target.value })}
                            style={{ width: '100%', height: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
