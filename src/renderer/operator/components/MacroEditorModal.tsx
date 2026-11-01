import React, { useState, useEffect } from 'react'
import {
  X,
  Zap,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Radio,
  Calendar
} from 'lucide-react'
import {
  MacroItem,
  MacroAction,
  MacroActionType,
  PresentationTimer,
  PropItem
} from '../../../shared/types'

const MACRO_COLORS = [
  '#FF7A00', // ProPresenter Orange
  '#10b981', // Green
  '#38bdf8', // Light Blue
  '#a855f7', // Purple
  '#ef4444', // Red
  '#eab308'  // Yellow
]

const MACRO_ICONS = ['Zap', 'Play', 'Layers', 'RotateCcw', 'Clock', 'Volume2']

interface MacroEditorModalProps {
  macro: MacroItem | null
  timers: PresentationTimer[]
  propsList: PropItem[]
  allMacros: MacroItem[]
  onSave: (macro: MacroItem) => void
  onClose: () => void
  onTestStep?: (action: MacroAction) => void
}

export const MacroEditorModal: React.FC<MacroEditorModalProps> = ({
  macro,
  timers,
  propsList,
  allMacros,
  onSave,
  onClose
}) => {
  const [name, setName] = useState(macro?.name || 'Nueva Macro')
  const [color, setColor] = useState(macro?.color || '#FF7A00')
  const [icon, setIcon] = useState(macro?.icon || 'Zap')
  const [description] = useState(macro?.description || '')
  const [shortcut, setShortcut] = useState(macro?.shortcut || '')
  const [actions, setActions] = useState<MacroAction[]>(macro?.actions ? [...macro.actions] : [])

  // MIDI Trigger
  const [midiEnabled, setMidiEnabled] = useState(Boolean(macro?.midiTrigger?.enabled))
  const [midiType, setMidiType] = useState<'note_on' | 'control_change'>(macro?.midiTrigger?.type || 'note_on')
  const [midiChannel, setMidiChannel] = useState(macro?.midiTrigger?.channel || 1)
  const [midiNumber, setMidiNumber] = useState(macro?.midiTrigger?.number || 60)
  const [isLearningMidi, setIsLearningMidi] = useState(false)

  // Schedule Trigger
  const [scheduleEnabled, setScheduleEnabled] = useState(Boolean(macro?.scheduleTrigger?.enabled))
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly'>(macro?.scheduleTrigger?.type || 'weekly')
  const [scheduleTime, setScheduleTime] = useState(macro?.scheduleTrigger?.time || '10:00')

  // New action form
  const [newActionType, setNewActionType] = useState<MacroActionType>('go_to_item_slide')

  // MIDI Learning listener
  useEffect(() => {
    if (!isLearningMidi) return

    const handleMidiInput = (e: any) => {
      if (e.data && e.data.length >= 2) {
        const status = e.data[0]
        const num = e.data[1]
        // MIDI velocity / value
        const isNote = (status & 0xf0) === 0x90
        const isCC = (status & 0xf0) === 0xb0

        if (isNote || isCC) {
          setMidiType(isNote ? 'note_on' : 'control_change')
          setMidiChannel((status & 0x0f) + 1)
          setMidiNumber(num)
          setIsLearningMidi(false)
        }
      }
    }

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then((access) => {
        access.inputs.forEach((entry) => {
          entry.onmidimessage = handleMidiInput
        })
      }).catch(() => {
        // Fallback
      })
    }
  }, [isLearningMidi])

  const handleAddAction = () => {
    let defaultLabel = 'Acción'
    const newAct: MacroAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: newActionType,
      params: {}
    }

    if (newActionType === 'go_to_item_slide') {
      defaultLabel = 'Siguiente Diapositiva'
      newAct.params = { relative: 'next_slide' }
    } else if (newActionType === 'clear_layer') {
      defaultLabel = 'Limpiar Diapositiva'
      newAct.params = { layer: 'slide' }
    } else if (newActionType === 'emergency_control') {
      defaultLabel = 'Pantalla Negra'
      newAct.params = { emergencyType: 'black', active: true }
    } else if (newActionType === 'timer_control') {
      defaultLabel = 'Iniciar Temporizador'
      newAct.params = { timerId: timers[0]?.id || 'timer_countdown_service', timerAction: 'start' }
    } else if (newActionType === 'media_control') {
      defaultLabel = 'Pausar Video'
      newAct.params = { mediaAction: 'pause' }
    } else if (newActionType === 'display_message') {
      defaultLabel = 'Mostrar Mensaje'
      newAct.params = { messageAction: 'show', messageText: 'Aviso Importante', targetRole: 'all' }
    } else if (newActionType === 'prop_control') {
      defaultLabel = 'Mostrar Prop'
      newAct.params = { propId: propsList[0]?.id || 'prop_logo_corner', propAction: 'show' }
    } else if (newActionType === 'delay') {
      defaultLabel = 'Esperar 2 Segundos'
      newAct.params = { seconds: 2 }
    } else if (newActionType === 'trigger_macro') {
      defaultLabel = 'Lanzar Macro'
      newAct.params = { targetMacroId: allMacros.find((m) => m.id !== macro?.id)?.id || '' }
    }

    newAct.label = defaultLabel
    setActions([...actions, newAct])
  }

  const handleMoveAction = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= actions.length) return
    const reordered = [...actions]
    const temp = reordered[index]
    reordered[index] = reordered[targetIdx]
    reordered[targetIdx] = temp
    setActions(reordered)
  }

  const handleDeleteAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const handleUpdateActionParam = (index: number, paramKey: string, value: any) => {
    const updated = [...actions]
    updated[index] = {
      ...updated[index],
      params: {
        ...updated[index].params,
        [paramKey]: value
      }
    }
    setActions(updated)
  }

  const handleSave = () => {
    const updatedMacro: MacroItem = {
      id: macro?.id || `macro_${Date.now()}`,
      name: name.trim() || 'Macro Sin Nombre',
      color,
      icon,
      description: description.trim(),
      shortcut: shortcut.trim() || undefined,
      midiTrigger: midiEnabled
        ? {
            enabled: true,
            type: midiType,
            channel: Number(midiChannel),
            number: Number(midiNumber)
          }
        : undefined,
      scheduleTrigger: scheduleEnabled
        ? {
            enabled: true,
            type: scheduleType,
            time: scheduleTime
          }
        : undefined,
      actions,
      isBuiltIn: macro?.isBuiltIn || false,
      createdAt: macro?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    onSave(updatedMacro)
  }

  return (
    <div className="macro-modal-backdrop" onClick={onClose}>
      <div
        className="macro-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '720px',
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
                backgroundColor: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              <Zap size={16} />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {macro ? 'Editar Macro' : 'Nueva Macro'}
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

        {/* Content Scrollable */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Basic Info Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                NOMBRE DE LA MACRO
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
                ATAJO DE TECLADO
              </label>
              <input
                type="text"
                placeholder="Ej. Ctrl+Shift+1"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #27272a',
                  borderRadius: '6px',
                  color: '#38bdf8',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Color & Icon Pickers */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                COLOR DISTINTIVO
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {MACRO_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: color === c ? '2px solid #ffffff' : '2px solid transparent',
                      cursor: 'pointer',
                      transform: color === c ? 'scale(1.15)' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                ÍCONO
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {MACRO_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: icon === ic ? '#27272a' : '#181818',
                      border: icon === ic ? '1px solid #FF7A00' : '1px solid #27272a',
                      borderRadius: '6px',
                      color: icon === ic ? '#FF7A00' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Triggers: MIDI & Schedule */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#181818', padding: '14px', borderRadius: '8px', border: '1px solid #27272a' }}>
            {/* MIDI Trigger */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                  <Radio size={14} color="#10b981" />
                  <span>DISPARADOR MIDI</span>
                </div>
                <input
                  type="checkbox"
                  checked={midiEnabled}
                  onChange={(e) => setMidiEnabled(e.target.checked)}
                />
              </div>
              {midiEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                      value={midiType}
                      onChange={(e) => setMidiType(e.target.value as any)}
                      style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                    >
                      <option value="note_on">Nota (Note On)</option>
                      <option value="control_change">Controlador (CC)</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Canal (1-16)"
                      value={midiChannel}
                      onChange={(e) => setMidiChannel(Number(e.target.value))}
                      style={{ width: '60px', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                    />
                    <input
                      type="number"
                      placeholder="Número (0-127)"
                      value={midiNumber}
                      onChange={(e) => setMidiNumber(Number(e.target.value))}
                      style={{ width: '60px', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLearningMidi(!isLearningMidi)}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: isLearningMidi ? '#ea580c' : '#27272a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {isLearningMidi ? 'Presione tecla en controlador MIDI...' : 'Aprender MIDI'}
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Trigger */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>
                  <Calendar size={14} color="#38bdf8" />
                  <span>HORARIO AUTOMÁTICO</span>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                />
              </div>
              {scheduleEnabled && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value as any)}
                    style={{ padding: '6px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal (Domingos)</option>
                  </select>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '12px' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions List */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>
                SECUENCIA DE ACCIONES ({actions.length})
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={newActionType}
                  onChange={(e) => setNewActionType(e.target.value as any)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #27272a',
                    color: '#f8fafc',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                >
                  <option value="go_to_item_slide">Diapositiva / Elemento</option>
                  <option value="clear_layer">Limpiar Capa</option>
                  <option value="emergency_control">Negro / Logo / Congelar</option>
                  <option value="timer_control">Control de Temporizador</option>
                  <option value="media_control">Control de Video</option>
                  <option value="display_message">Mostrar Mensaje</option>
                  <option value="prop_control">Control de Prop</option>
                  <option value="delay">Esperar N Segundos</option>
                  <option value="trigger_macro">Lanzar Otra Macro</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddAction}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    backgroundColor: '#FF7A00',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={12} />
                  <span>Agregar Acción</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actions.map((act, idx) => (
                <div
                  key={act.id}
                  style={{
                    backgroundColor: '#181818',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '40px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF7A00' }}>#{idx + 1}</span>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveAction(idx, 'up')}
                      style={{ background: 'none', border: 'none', color: idx === 0 ? '#475569' : '#94a3b8', cursor: idx === 0 ? 'default' : 'pointer', padding: '2px' }}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === actions.length - 1}
                      onClick={() => handleMoveAction(idx, 'down')}
                      style={{ background: 'none', border: 'none', color: idx === actions.length - 1 ? '#475569' : '#94a3b8', cursor: idx === actions.length - 1 ? 'default' : 'pointer', padding: '2px' }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Action Config Fields */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', minWidth: '130px' }}>
                      {act.type === 'go_to_item_slide' && 'Diapositiva'}
                      {act.type === 'clear_layer' && 'Limpiar Capa'}
                      {act.type === 'emergency_control' && 'Control Emergencia'}
                      {act.type === 'timer_control' && 'Temporizador'}
                      {act.type === 'media_control' && 'Video'}
                      {act.type === 'display_message' && 'Mensaje'}
                      {act.type === 'prop_control' && 'Prop'}
                      {act.type === 'delay' && 'Pausa'}
                      {act.type === 'trigger_macro' && 'Lanzar Macro'}
                    </span>

                    {/* Params editor */}
                    {act.type === 'go_to_item_slide' && (
                      <select
                        value={act.params.relative || 'next_slide'}
                        onChange={(e) => handleUpdateActionParam(idx, 'relative', e.target.value)}
                        style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                      >
                        <option value="next_slide">Siguiente Diapositiva</option>
                        <option value="prev_slide">Diapositiva Anterior</option>
                        <option value="next_item">Siguiente Elemento</option>
                        <option value="prev_item">Elemento Anterior</option>
                      </select>
                    )}

                    {act.type === 'clear_layer' && (
                      <select
                        value={act.params.layer || 'slide'}
                        onChange={(e) => handleUpdateActionParam(idx, 'layer', e.target.value)}
                        style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                      >
                        <option value="all">Todas las Capas</option>
                        <option value="slide">Diapositiva</option>
                        <option value="background">Fondo</option>
                        <option value="audio">Audio</option>
                        <option value="message">Mensaje</option>
                        <option value="media">Video/Media</option>
                        <option value="props">Props</option>
                      </select>
                    )}

                    {act.type === 'emergency_control' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={act.params.emergencyType || 'black'}
                          onChange={(e) => handleUpdateActionParam(idx, 'emergencyType', e.target.value)}
                          style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                        >
                          <option value="black">Negro (F1)</option>
                          <option value="logo">Logo (F3)</option>
                          <option value="freeze">Congelar (F4)</option>
                        </select>
                        <select
                          value={act.params.active ? '1' : '0'}
                          onChange={(e) => handleUpdateActionParam(idx, 'active', e.target.value === '1')}
                          style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                        >
                          <option value="1">Activar</option>
                          <option value="0">Desactivar</option>
                        </select>
                      </div>
                    )}

                    {act.type === 'timer_control' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={act.params.timerId || timers[0]?.id || ''}
                          onChange={(e) => handleUpdateActionParam(idx, 'timerId', e.target.value)}
                          style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px', maxWidth: '140px' }}
                        >
                          {timers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <select
                          value={act.params.timerAction || 'start'}
                          onChange={(e) => handleUpdateActionParam(idx, 'timerAction', e.target.value)}
                          style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                        >
                          <option value="start">Iniciar</option>
                          <option value="pause">Pausar</option>
                          <option value="reset">Reiniciar</option>
                        </select>
                      </div>
                    )}

                    {act.type === 'prop_control' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={act.params.propId || propsList[0]?.id || ''}
                          onChange={(e) => handleUpdateActionParam(idx, 'propId', e.target.value)}
                          style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px', maxWidth: '140px' }}
                        >
                          {propsList.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={act.params.propAction || 'show'}
                          onChange={(e) => handleUpdateActionParam(idx, 'propAction', e.target.value)}
                          style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                        >
                          <option value="show">Mostrar</option>
                          <option value="hide">Ocultar</option>
                          <option value="toggle">Alternar</option>
                        </select>
                      </div>
                    )}

                    {act.type === 'delay' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="60"
                          value={act.params.seconds || 1}
                          onChange={(e) => handleUpdateActionParam(idx, 'seconds', parseFloat(e.target.value) || 1)}
                          style={{ width: '60px', padding: '4px 6px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                        />
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>segundos</span>
                      </div>
                    )}

                    {act.type === 'trigger_macro' && (
                      <select
                        value={act.params.targetMacroId || ''}
                        onChange={(e) => handleUpdateActionParam(idx, 'targetMacroId', e.target.value)}
                        style={{ padding: '4px 8px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#f8fafc', borderRadius: '4px', fontSize: '11px' }}
                      >
                        <option value="">-- Seleccionar Macro --</option>
                        {allMacros.filter((m) => m.id !== macro?.id).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteAction(idx)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    title="Eliminar acción"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {actions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px', border: '1px dashed #27272a', borderRadius: '6px' }}>
                  Sin acciones configuradas. Seleccione un tipo de acción y pulse "Agregar Acción".
                </div>
              )}
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
              backgroundColor: '#FF7A00',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Guardar Macro
          </button>
        </div>
      </div>
    </div>
  )
}
