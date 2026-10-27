import React, { useState } from 'react'
import { X, Layers } from 'lucide-react'
import { PropItem, PropType, OutputRole } from '../../../shared/types'

interface PropEditorModalProps {
  prop: PropItem | null
  onSave: (prop: PropItem) => void
  onClose: () => void
}

export const PropEditorModal: React.FC<PropEditorModalProps> = ({ prop, onSave, onClose }) => {
  const [name, setName] = useState(prop?.name || 'Nuevo Prop')
  const [type, setType] = useState<PropType>(prop?.type || 'lower_third')
  const [text, setText] = useState(prop?.content.text || '')
  const [subtitle, setSubtitle] = useState(prop?.content.subtitle || '')
  const [countdownSeconds, setCountdownSeconds] = useState(prop?.content.countdownSeconds || 300)
  const [imageUrl, setImageUrl] = useState(prop?.content.imageUrl || '')

  // Position & Alignment
  const [alignment, setAlignment] = useState(prop?.position.alignment || 'bottom-center')
  const [posX, setPosX] = useState(prop?.position.x ?? 10)
  const [posY, setPosY] = useState(prop?.position.y ?? 78)
  const [posWidth, setPosWidth] = useState(prop?.position.width ?? 80)
  const [posHeight, setPosHeight] = useState(prop?.position.height ?? 16)

  // Style
  const [opacity, setOpacity] = useState(prop?.style.opacity ?? 0.95)
  const [fontSizeVmin, setFontSizeVmin] = useState(prop?.style.fontSizeVmin ?? 3.2)
  const [fontColor, setFontColor] = useState(prop?.style.fontColor || '#ffffff')
  const [backgroundColor, setBackgroundColor] = useState(prop?.style.backgroundColor || '#181818')
  const [borderRadiusPx, setBorderRadiusPx] = useState(prop?.style.borderRadiusPx ?? 8)

  // Transition
  const [inType, setInType] = useState<'cut' | 'fade' | 'slide_up' | 'slide_down' | 'zoom'>(prop?.transition.inType || 'slide_up')
  const [durationMs, setDurationMs] = useState(prop?.transition.durationMs || 400)

  // Target Roles
  const [targetRoles, setTargetRoles] = useState<OutputRole[]>(prop?.targetRoles || ['main'])

  const handleRoleToggle = (role: OutputRole) => {
    if (targetRoles.includes(role)) {
      setTargetRoles(targetRoles.filter((r) => r !== role))
    } else {
      setTargetRoles([...targetRoles, role])
    }
  }

  const handleApplyPresetAlignment = (align: any) => {
    setAlignment(align)
    if (align === 'bottom-center') {
      setPosX(10)
      setPosY(78)
      setPosWidth(80)
      setPosHeight(16)
    } else if (align === 'top-right') {
      setPosX(88)
      setPosY(5)
      setPosWidth(8)
      setPosHeight(8)
    } else if (align === 'bottom-right') {
      setPosX(74)
      setPosY(82)
      setPosWidth(22)
      setPosHeight(12)
    } else if (align === 'center') {
      setPosX(20)
      setPosY(25)
      setPosWidth(60)
      setPosHeight(50)
    }
  }

  const handleSave = () => {
    const updatedProp: PropItem = {
      id: prop?.id || `prop_${Date.now()}`,
      name: name.trim() || 'Prop',
      type,
      content: {
        text: text.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        countdownSeconds: Number(countdownSeconds) || 300,
        imageUrl: imageUrl.trim() || undefined
      },
      position: {
        alignment,
        x: Number(posX),
        y: Number(posY),
        width: Number(posWidth),
        height: Number(posHeight)
      },
      style: {
        opacity: Number(opacity),
        fontSizeVmin: Number(fontSizeVmin),
        fontColor,
        backgroundColor,
        borderRadiusPx: Number(borderRadiusPx)
      },
      transition: {
        inType,
        outType: inType === 'slide_up' ? 'slide_down' : inType,
        durationMs: Number(durationMs)
      },
      targetRoles: targetRoles.length > 0 ? targetRoles : ['main'],
      isActive: prop?.isActive || false,
      createdAt: prop?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    onSave(updatedProp)
  }

  return (
    <div className="macro-modal-backdrop" onClick={onClose}>
      <div
        className="macro-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '680px',
          maxHeight: '90vh',
          backgroundColor: '#121212',
          border: '1px solid #27272a',
          borderRadius: '12px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#181818'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Layers size={16} />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {prop ? 'Editar Prop' : 'Nuevo Prop / Superposición'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Row 1: Name and Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                NOMBRE DEL PROP
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                TIPO DE ELEMENTO
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              >
                <option value="lower_third">Tercio Inferior</option>
                <option value="logo">Logo / Marca de Agua</option>
                <option value="countdown">Cuenta Regresiva</option>
                <option value="text">Texto Flotante</option>
                <option value="image">Imagen</option>
              </select>
            </div>
          </div>

          {/* Row 2: Content fields based on type */}
          <div style={{ backgroundColor: '#181818', padding: '14px', borderRadius: '8px', border: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>CONTENIDO DEL ELEMENTO</span>

            {type !== 'image' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Texto Principal
                </label>
                <input
                  type="text"
                  placeholder="Ej. Tiempo de Diezmos y Ofrendas..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {type === 'lower_third' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Subtítulo / Detalles Adicionales
                </label>
                <input
                  type="text"
                  placeholder="Ej. Banco Nacional | Cta: 123-456..."
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {type === 'countdown' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Duración de Cuenta Regresiva (Segundos)
                </label>
                <input
                  type="number"
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(Number(e.target.value))}
                  style={{ width: '120px', padding: '6px 10px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '4px', color: '#38bdf8', fontSize: '13px' }}
                />
              </div>
            )}

            {(type === 'image' || type === 'logo') && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                  Ruta o URL de Imagen (Opcional si usa texto de logo)
                </label>
                <input
                  type="text"
                  placeholder="file:///... o https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', borderRadius: '4px', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>

          {/* Row 3: Position, Alignment & Size */}
          <div style={{ backgroundColor: '#181818', padding: '14px', borderRadius: '8px', border: '1px solid #27272a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>POSICIÓN Y DIMENSIONES</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleApplyPresetAlignment('top-right')}
                  style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#27272a', border: 'none', borderRadius: '4px', color: '#f8fafc', cursor: 'pointer' }}
                >
                  Arriba-Der
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetAlignment('bottom-center')}
                  style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#27272a', border: 'none', borderRadius: '4px', color: '#f8fafc', cursor: 'pointer' }}
                >
                  Abajo-Centro
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPresetAlignment('bottom-right')}
                  style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#27272a', border: 'none', borderRadius: '4px', color: '#f8fafc', cursor: 'pointer' }}
                >
                  Abajo-Der
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>X (%)</label>
                <input
                  type="number"
                  value={posX}
                  onChange={(e) => setPosX(Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Y (%)</label>
                <input
                  type="number"
                  value={posY}
                  onChange={(e) => setPosY(Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Ancho (%)</label>
                <input
                  type="number"
                  value={posWidth}
                  onChange={(e) => setPosWidth(Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Alto (%)</label>
                <input
                  type="number"
                  value={posHeight}
                  onChange={(e) => setPosHeight(Number(e.target.value))}
                  style={{ width: '100%', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>

          {/* Row 4: Styling & Transition */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ backgroundColor: '#181818', padding: '14px', borderRadius: '8px', border: '1px solid #27272a' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '10px' }}>ESTILO Y OPACIDAD</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8' }}>Opacidad: {opacity}</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', minWidth: '80px' }}>Fondo:</label>
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    style={{ flex: 1, padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', minWidth: '80px' }}>Color Texto:</label>
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    style={{ width: '32px', height: '24px', background: 'none', border: 'none', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', color: '#f8fafc' }}>{fontColor}</span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#181818', padding: '14px', borderRadius: '8px', border: '1px solid #27272a' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '10px' }}>TRANSICIÓN Y PANTALLAS</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', minWidth: '70px' }}>Animación:</label>
                  <select
                    value={inType}
                    onChange={(e) => setInType(e.target.value as any)}
                    style={{ flex: 1, padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                  >
                    <option value="fade">Fundido (Fade)</option>
                    <option value="slide_up">Deslizar Arriba</option>
                    <option value="slide_down">Deslizar Abajo</option>
                    <option value="zoom">Zoom Suave</option>
                    <option value="cut">Corte Directo</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f8fafc', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={targetRoles.includes('main')}
                      onChange={() => handleRoleToggle('main')}
                    />
                    <span>Sala (Auditorio)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f8fafc', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={targetRoles.includes('lobby')}
                      onChange={() => handleRoleToggle('lobby')}
                    />
                    <span>Lobby</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f8fafc', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={targetRoles.includes('stage')}
                      onChange={() => handleRoleToggle('stage')}
                    />
                    <span>Escenario</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: '#181818'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#27272a',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 20px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Guardar Prop
          </button>
        </div>
      </div>
    </div>
  )
}
