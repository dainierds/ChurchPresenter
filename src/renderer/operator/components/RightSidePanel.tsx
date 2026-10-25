import React, { useState, useEffect } from 'react'
import {
  Tv,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Sliders,
  Sparkles,
  Layers,
  Eye,
  Slash,
  MessageSquare,
  Music,
  Film
} from 'lucide-react'
import {
  PresenterState,
  PresentationTimer,
  SlideItem,
  TimerType
} from '../../../shared/types'

interface RightSidePanelProps {
  state: PresenterState | null
  currentSlide: SlideItem | null
  timers: PresentationTimer[]
  onControlTimer: (id: string, action: 'start' | 'pause' | 'reset') => void
  onSaveTimer: (timer: PresentationTimer) => void
  onDeleteTimer: (id: string) => void
  onClearLayer: (layer: 'audio' | 'background' | 'slide' | 'message' | 'media' | 'all') => void
  onControlVideo: (action: 'play' | 'pause' | 'stop' | 'seek', time?: number) => void
}

export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  state,
  currentSlide,
  timers,
  onControlTimer,
  onSaveTimer,
  onDeleteTimer,
  onClearLayer,
  onControlVideo
}) => {
  const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'stage' | 'lobby'>('main')
  const [activeBottomTab, setActiveBottomTab] = useState<'timers' | 'props' | 'macros'>('timers')
  const [newTimerName, setNewTimerName] = useState('')
  const [newTimerDuration, setNewTimerDuration] = useState('300')
  const [newTimerType, setNewTimerType] = useState<TimerType>('countdown_duration')
  const [isCreatingTimer, setIsCreatingTimer] = useState(false)

  // Simulated audio VU meter activity for visual feedback
  const isPlayingMedia = Boolean(state?.mediaSyncTick?.isPlaying)
  const isPlayingAudio = Boolean(state?.independentAudio?.isPlaying)
  const hasAudioActive = isPlayingMedia || isPlayingAudio

  // Format timer seconds into digital display mm:ss or hh:mm:ss
  const formatTimerDigits = (sec: number, isOvertime?: boolean) => {
    const abs = Math.abs(sec)
    const h = Math.floor(abs / 3600)
    const m = Math.floor((abs % 3600) / 60)
    const s = Math.floor(abs % 60)
    const prefix = isOvertime ? '-' : ''
    if (h > 0) {
      return `${prefix}${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${prefix}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Handle timer form creation
  const handleCreateTimer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTimerName.trim()) return
    const dur = parseInt(newTimerDuration, 10) || 300
    const newTimer: PresentationTimer = {
      id: `timer_${Date.now()}`,
      name: newTimerName.trim(),
      type: newTimerType,
      durationSeconds: dur,
      remainingSeconds: dur,
      isRunning: false,
      isOvertime: false,
      showOnStage: true,
      showOnAudience: false
    }
    onSaveTimer(newTimer)
    setNewTimerName('')
    setIsCreatingTimer(false)
  }

  // Active layers state
  const hasBackground = Boolean(state?.currentBackground)
  const hasSlide = Boolean(state?.currentSlide?.body || state?.currentSlide?.title)
  const hasMedia = Boolean(state?.currentSlide?.mediaUrl || state?.mediaSyncTick?.mediaPath)
  const hasMessage = Boolean(state?.layers?.main?.message?.visible && state?.layers?.main?.message?.text)

  const mediaTime = state?.mediaSyncTick?.currentTime || 0
  const mediaDuration = state?.mediaSyncTick?.duration || 0

  return (
    <div className="pro-right-panel">
      {/* 1. Top: Output Preview Monitor Switcher */}
      <div className="pro-preview-section">
        <div className="pro-output-tabs-bar">
          <button
            className={`pro-out-tab ${activeOutputTab === 'main' ? 'active' : ''}`}
            onClick={() => setActiveOutputTab('main')}
          >
            Sala Principal
          </button>
          <button
            className={`pro-out-tab ${activeOutputTab === 'stage' ? 'active' : ''}`}
            onClick={() => setActiveOutputTab('stage')}
          >
            Escenario
          </button>
          <button
            className={`pro-out-tab ${activeOutputTab === 'lobby' ? 'active' : ''}`}
            onClick={() => setActiveOutputTab('lobby')}
          >
            Lobby
          </button>
        </div>

        {/* Live Output Mini Screen with Layer Buttons Strip */}
        <div className="pro-preview-display-wrapper">
          <div className="pro-preview-screen">
            {activeOutputTab === 'stage' ? (
              <div className="pro-preview-stage-box">
                <span className="pro-stage-box-tag">RETORNO ESCENARIO</span>
                <div className="pro-stage-box-body">
                  {currentSlide?.body || '(Sin contenido en escenario)'}
                </div>
              </div>
            ) : (
              <div className="pro-preview-screen-content">
                {currentSlide?.mediaUrl && (
                  <div className="pro-preview-bg-indicator">
                    <Film size={20} />
                  </div>
                )}
                <div className="pro-preview-text-box">
                  {currentSlide?.body || '(Pantalla sin proyección activa)'}
                </div>
              </div>
            )}

            {/* Simulated Stereo Audio VU Meter */}
            <div className="pro-audio-vu-meter-bars" title="Nivel de salida de audio">
              <div
                className={`pro-vu-bar l ${hasAudioActive ? 'active-pulse' : ''}`}
                style={{ height: hasAudioActive ? '75%' : '8%' }}
              />
              <div
                className={`pro-vu-bar r ${hasAudioActive ? 'active-pulse' : ''}`}
                style={{ height: hasAudioActive ? '70%' : '8%' }}
              />
            </div>
          </div>

          {/* Vertical Strip of Clear Buttons by Layer */}
          <div className="pro-clear-layers-strip">
            <button
              className={`pro-layer-btn ${hasAudioActive ? 'has-content' : ''}`}
              onClick={() => onClearLayer('audio')}
              title="Limpiar capa de Audio"
            >
              <Music size={12} />
              <span>Audio</span>
            </button>
            <button
              className={`pro-layer-btn ${hasBackground ? 'has-content' : ''}`}
              onClick={() => onClearLayer('background')}
              title="Limpiar Fondo"
            >
              <Film size={12} />
              <span>Fondo</span>
            </button>
            <button
              className={`pro-layer-btn ${hasSlide ? 'has-content' : ''}`}
              onClick={() => onClearLayer('slide')}
              title="Limpiar Diapositiva"
            >
              <Layers size={12} />
              <span>Diapo</span>
            </button>
            <button
              className={`pro-layer-btn ${hasMessage ? 'has-content' : ''}`}
              onClick={() => onClearLayer('message')}
              title="Limpiar Mensaje"
            >
              <MessageSquare size={12} />
              <span>Mensaje</span>
            </button>
            <button
              className={`pro-layer-btn ${hasMedia ? 'has-content' : ''}`}
              onClick={() => onClearLayer('media')}
              title="Limpiar Medios"
            >
              <Tv size={12} />
              <span>Medios</span>
            </button>
            <button
              className="pro-layer-btn clear-all"
              onClick={() => onClearLayer('all')}
              title="Limpiar Todo"
            >
              <Slash size={12} />
              <span>Todo</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Center: Media Transport Deck Controls */}
      <div className="pro-media-transport-deck">
        <div className="pro-transport-buttons">
          <button
            className="pro-transport-btn"
            onClick={() => onControlVideo('seek', Math.max(0, mediaTime - 15))}
            title="Retroceder 15 segundos"
          >
            -15s
          </button>
          <button
            className="pro-transport-btn play-pause"
            onClick={() => onControlVideo(isPlayingMedia ? 'pause' : 'play')}
            title={isPlayingMedia ? 'Pausar' : 'Reproducir'}
          >
            {isPlayingMedia ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
          </button>
          <button
            className="pro-transport-btn"
            onClick={() => onControlVideo('seek', Math.min(mediaDuration, mediaTime + 15))}
            title="Adelantar 15 segundos"
          >
            +15s
          </button>
        </div>

        {/* Video Scrubber */}
        <div className="pro-transport-scrubber-row">
          <span className="pro-transport-time">
            {Math.floor(mediaTime / 60)}:
            {Math.floor(mediaTime % 60)
              .toString()
              .padStart(2, '0')}
          </span>
          <input
            type="range"
            min="0"
            max={mediaDuration || 100}
            value={mediaTime}
            onChange={(e) => onControlVideo('seek', Number(e.target.value))}
            className="pro-scrubber-slider"
          />
          <span className="pro-transport-time remaining">
            -{Math.floor(Math.max(0, mediaDuration - mediaTime) / 60)}:
            {Math.floor(Math.max(0, mediaDuration - mediaTime) % 60)
              .toString()
              .padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 3. Bottom Tabs: Temporizadores (default), Props, Macros */}
      <div className="pro-bottom-tabs-section">
        <div className="pro-bottom-tabs-header">
          <button
            className={`pro-tab-trigger ${activeBottomTab === 'timers' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('timers')}
          >
            <Clock size={12} />
            <span>TEMPORIZADORES</span>
          </button>
          <button
            className="pro-tab-trigger disabled"
            disabled
            title="Próximamente en Fase Futura"
          >
            <span>Props</span>
            <span className="pro-badge-soon">Próx.</span>
          </button>
          <button
            className="pro-tab-trigger disabled"
            disabled
            title="Próximamente en Fase Futura"
          >
            <span>Macros</span>
            <span className="pro-badge-soon">Próx.</span>
          </button>

          <button
            className="pro-btn-add-timer"
            onClick={() => setIsCreatingTimer(!isCreatingTimer)}
            title="Nuevo Temporizador"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* New Timer creation form */}
        {isCreatingTimer && (
          <form onSubmit={handleCreateTimer} className="pro-new-timer-form">
            <input
              type="text"
              placeholder="Nombre del temporizador..."
              value={newTimerName}
              onChange={(e) => setNewTimerName(e.target.value)}
              className="pro-timer-name-input"
              autoFocus
            />
            <div className="pro-timer-form-row">
              <select
                value={newTimerType}
                onChange={(e) => setNewTimerType(e.target.value as TimerType)}
                className="pro-timer-type-select"
              >
                <option value="countdown_duration">Cuenta Regresiva (Segundos)</option>
                <option value="countdown_time_of_day">Hora del Día</option>
                <option value="stopwatch_count_up">Cronómetro (Hacia Arriba)</option>
              </select>
              <input
                type="number"
                placeholder="Segundos (ej. 300)"
                value={newTimerDuration}
                onChange={(e) => setNewTimerDuration(e.target.value)}
                className="pro-timer-sec-input"
              />
            </div>
            <div className="pro-timer-form-actions">
              <button type="submit" className="pro-btn-save-sm">
                Guardar
              </button>
              <button
                type="button"
                className="pro-btn-cancel-sm"
                onClick={() => setIsCreatingTimer(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Timers List */}
        <div className="pro-timers-scroll-list">
          {timers.map((timer) => (
            <div key={timer.id} className="pro-timer-card">
              <div className="pro-timer-card-top">
                <span className="pro-timer-title">{timer.name}</span>
                <button
                  className="pro-timer-del-btn"
                  onClick={() => onDeleteTimer(timer.id)}
                  title="Eliminar temporizador"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              <div
                className={`pro-timer-digits-display ${
                  timer.isOvertime ? 'overtime' : timer.remainingSeconds <= 60 ? 'urgent' : ''
                }`}
              >
                {formatTimerDigits(timer.remainingSeconds, timer.isOvertime)}
              </div>

              {/* Transport buttons for this timer */}
              <div className="pro-timer-controls-row">
                <button
                  className={`pro-timer-action-btn ${timer.isRunning ? 'running' : ''}`}
                  onClick={() =>
                    onControlTimer(timer.id, timer.isRunning ? 'pause' : 'start')
                  }
                  title={timer.isRunning ? 'Pausar' : 'Iniciar'}
                >
                  {timer.isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
                </button>
                <button
                  className="pro-timer-action-btn"
                  onClick={() => onControlTimer(timer.id, 'reset')}
                  title="Reiniciar a tiempo inicial"
                >
                  <RotateCcw size={12} />
                </button>

                {/* Audience and Stage assignment toggles */}
                <div className="pro-timer-toggles">
                  <label className="pro-toggle-label" title="Mostrar en Monitor de Escenario">
                    <input
                      type="checkbox"
                      checked={timer.showOnStage}
                      onChange={(e) =>
                        onSaveTimer({ ...timer, showOnStage: e.target.checked })
                      }
                    />
                    <span>Escenario</span>
                  </label>
                  <label className="pro-toggle-label" title="Mostrar en Pantallas de Audiencia">
                    <input
                      type="checkbox"
                      checked={timer.showOnAudience}
                      onChange={(e) =>
                        onSaveTimer({ ...timer, showOnAudience: e.target.checked })
                      }
                    />
                    <span>Audiencia</span>
                  </label>
                </div>
              </div>
            </div>
          ))}

          {timers.length === 0 && (
            <div className="pro-timers-empty">
              <span>Sin temporizadores configurados. Haga clic en + para agregar uno.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
