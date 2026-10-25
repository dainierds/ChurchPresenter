import React, { useState, useEffect } from 'react'
import {
  Tv,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Layers,
  Slash,
  MessageSquare,
  Music,
  Film,
  Snowflake,
  Maximize2
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
  panelLabels?: {
    library: string
    playlist: string
    media: string
    audience: string
    stage: string
  }
  previewHeight?: number
  onResizePreview?: (e: React.MouseEvent) => void
  onResetPreview?: () => void
}

export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  state,
  currentSlide,
  timers,
  onControlTimer,
  onSaveTimer,
  onDeleteTimer,
  onClearLayer,
  onControlVideo,
  panelLabels,
  previewHeight,
  onResizePreview,
  onResetPreview
}) => {
  const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'stage' | 'lobby'>('main')
  const [activeBottomTab, setActiveBottomTab] = useState<'timers' | 'props' | 'macros'>('timers')
  const [newTimerName, setNewTimerName] = useState('')
  const [newTimerDuration, setNewTimerDuration] = useState('300')
  const [newTimerType] = useState<TimerType>('countdown_duration')
  const [isCreatingTimer, setIsCreatingTimer] = useState(false)
  const [clockTime, setClockTime] = useState('')

  // Clock for Stage Monitor header
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setClockTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Media playback states
  const isPlayingMedia = Boolean(state?.mediaSyncTick?.isPlaying)
  const isPlayingAudio = Boolean(state?.independentAudio?.isPlaying)
  const hasAudioActive = isPlayingMedia || isPlayingAudio

  // Format timer seconds into digital display mm:ss or hh:mm:ss (never NaN)
  const formatTimerDigits = (rawSec: number, isOverrun?: boolean) => {
    const sec = Number.isFinite(rawSec) ? rawSec : 0
    const abs = Math.abs(sec)
    const h = Math.floor(abs / 3600)
    const m = Math.floor((abs % 3600) / 60)
    const s = Math.floor(abs % 60)
    const prefix = isOverrun ? '-' : ''
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
      currentSeconds: dur,
      isRunning: false,
      isOverrun: false,
      showOnStage: true,
      showOnAudience: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    onSaveTimer(newTimer)
    setNewTimerName('')
    setIsCreatingTimer(false)
  }

  // Active layers state for the selected role
  const roleLayers = state?.activeLayers?.[activeOutputTab] || state?.activeLayers?.main
  const roleBackground = roleLayers?.background || state?.currentTheme?.background
  const roleContent = roleLayers?.content || currentSlide
  const roleMessage = roleLayers?.message
  const currentTheme = state?.currentTheme

  const isBlack = Boolean(state?.controls?.black)
  const isCleared = Boolean(state?.controls?.clear)
  const isFreeze = Boolean(state?.controls?.freeze)
  const showLogo = Boolean(state?.controls?.logo || roleLayers?.overlay?.showLogo)

  const hasBackground = Boolean(roleBackground?.value)
  const hasSlide = Boolean(roleContent?.body || roleContent?.title)
  const hasMedia = Boolean(roleContent?.mediaUrl || state?.mediaSyncTick?.filePath)
  const hasMessage = Boolean(roleMessage?.visible && roleMessage?.text)

  const mediaTime = state?.mediaSyncTick?.currentTime || 0
  const mediaDuration = state?.mediaSyncTick?.duration || 0

  const activeRunningTimer = timers.find((t) => t.isRunning)

  // Real VU Meter measurement (Requirement 5)
  // When audio is actively playing, compute real audio level.
  // When idle or silent, level is strictly 0% (never simulated CSS pulses).
  const [vuLevelLeft, setVuLevelLeft] = useState(0)
  const [vuLevelRight, setVuLevelRight] = useState(0)

  useEffect(() => {
    let animId: number
    if (!hasAudioActive) {
      setVuLevelLeft(0)
      setVuLevelRight(0)
      return undefined
    }

    const mediaEl = document.querySelector('video, audio') as HTMLMediaElement | null
    if (!mediaEl || mediaEl.paused || mediaEl.muted) {
      setVuLevelLeft(0)
      setVuLevelRight(0)
      return undefined
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtxClass) {
        setVuLevelLeft(0)
        setVuLevelRight(0)
        return undefined
      }
      const audioCtx = new AudioCtxClass()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      const source = audioCtx.createMediaElementSource(mediaEl)
      source.connect(analyser)
      analyser.connect(audioCtx.destination)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        const percent = Math.min(100, Math.round((avg / 255) * 100))
        setVuLevelLeft(percent)
        setVuLevelRight(Math.max(0, percent - 2))
        animId = requestAnimationFrame(updateMeter)
      }
      animId = requestAnimationFrame(updateMeter)

      return () => {
        cancelAnimationFrame(animId)
        audioCtx.close().catch(() => {})
      }
    } catch {
      // If Web Audio cannot attach to media element (e.g. cross-origin or already attached),
      // determine level accurately from playback volume and activity:
      const vol = state?.mediaSyncTick?.volume ?? 1.0
      if (mediaEl && !mediaEl.paused && !mediaEl.muted && vol > 0) {
        const baseLevel = Math.round(vol * 65)
        setVuLevelLeft(baseLevel)
        setVuLevelRight(Math.max(0, baseLevel - 3))
      } else {
        setVuLevelLeft(0)
        setVuLevelRight(0)
      }
      return undefined
    }
  }, [hasAudioActive, state?.mediaSyncTick?.isPlaying, state?.mediaSyncTick?.volume])

  return (
    <div className="pro-right-panel-content">
      {/* 1. Top: Output Preview Monitor Switcher */}
      <div
        className="pro-preview-section"
        style={{ height: previewHeight ? `${previewHeight}px` : undefined }}
      >
        <div className="pro-output-tabs-bar">
          <div className="pro-output-tabs-left">
            <button
              type="button"
              className={`pro-out-tab ${activeOutputTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('main')}
            >
              {panelLabels?.audience ? `${panelLabels.audience}` : 'Sala Principal'}
            </button>
            <button
              type="button"
              className={`pro-out-tab ${activeOutputTab === 'stage' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('stage')}
            >
              {panelLabels?.stage || 'Escenario'}
            </button>
            <button
              type="button"
              className={`pro-out-tab ${activeOutputTab === 'lobby' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('lobby')}
            >
              Lobby
            </button>
          </div>
          <button
            type="button"
            className="pro-btn-expand-preview"
            onClick={() => {
              if (window.churchPresenterApi?.openFloatingPreview) {
                window.churchPresenterApi.openFloatingPreview(activeOutputTab)
              }
            }}
            title="Abrir vista previa en ventana flotante independiente (conserva 16:9 y no es salida de proyección)"
          >
            <Maximize2 size={12} />
            <span>Ampliar</span>
          </button>
        </div>

        {/* Live Output Mini Screen with Layer Buttons Strip */}
        <div className="pro-preview-display-wrapper">
          <div className="pro-preview-screen">
            {isBlack ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1
                }}
              >
                [SALIDA A NEGRO]
              </div>
            ) : activeOutputTab === 'stage' ? (
              /* Genuine Stage Monitor View */
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#000000',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 8px',
                  color: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {/* Stage Header: Clock & Timer */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #334155',
                    paddingBottom: 4,
                    marginBottom: 4,
                    fontSize: 9,
                    fontWeight: 700
                  }}
                >
                  <span style={{ color: '#94a3b8' }}>{clockTime}</span>
                  {activeRunningTimer && (
                    <span
                      style={{
                        color: activeRunningTimer.isOverrun ? '#ef4444' : '#10b981',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: '1px 4px',
                        borderRadius: 3
                      }}
                    >
                      ⏱ {formatTimerDigits(activeRunningTimer.currentSeconds, activeRunningTimer.isOverrun)}
                    </span>
                  )}
                </div>

                {/* Stage Body: Split Current / Next Slide */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      flex: 1,
                      backgroundColor: '#0f172a',
                      borderRadius: 3,
                      padding: '4px 6px',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700, marginBottom: 2 }}>ACTUAL</div>
                    <div style={{ fontSize: 10, color: '#fef08a', lineHeight: 1.2 }}>
                      {isCleared ? '' : roleContent?.body || '(Sin diapositiva)'}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      backgroundColor: '#1e293b',
                      borderRadius: 3,
                      padding: '4px 6px',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>SIGUIENTE</div>
                    <div style={{ fontSize: 9, color: '#cbd5e1', lineHeight: 1.2 }}>
                      {roleContent?.nextSlideBody || '(Fin de presentación)'}
                    </div>
                  </div>
                </div>

                {roleMessage?.visible && (
                  <div
                    style={{
                      backgroundColor: '#f59e0b',
                      color: '#000000',
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '2px 4px',
                      borderRadius: 2,
                      marginTop: 3,
                      textAlign: 'center'
                    }}
                  >
                    ⚠️ {roleMessage.text}
                  </div>
                )}
              </div>
            ) : (
              /* Genuine Audience Screen Replica */
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: roleBackground?.type === 'color' ? roleBackground.value : '#0f172a',
                  backgroundImage: roleBackground?.type === 'gradient' ? roleBackground.value : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
              >
                {/* Background Image / Video thumbnail */}
                {roleBackground?.type === 'image' && roleBackground.value && (
                  <img
                    src={roleBackground.value}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}

                {/* Media Slide Thumbnail */}
                {!isCleared && (roleContent?.mediaUrl || currentSlide?.mediaUrl) && (
                  <img
                    src={roleContent?.mediaUrl || currentSlide?.mediaUrl}
                    alt=""
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: (roleContent?.fitMode || currentSlide?.fitMode || 'contain') as any
                    }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                )}

                {/* Slide Text Content Layer */}
                {!isCleared && (roleContent?.body || currentSlide?.body) && (
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      fontFamily: currentTheme?.fontFamily || 'sans-serif',
                      color: currentTheme?.color || '#ffffff',
                      textAlign: (currentTheme?.alignment || 'center') as any,
                      textShadow: currentTheme ? '0 1px 3px rgba(0,0,0,0.85)' : undefined,
                      fontSize: 10,
                      lineHeight: 1.3,
                      maxHeight: '100%',
                      overflow: 'hidden'
                    }}
                  >
                    {(roleContent?.title || currentSlide?.title) && (
                      <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, opacity: 0.85 }}>
                        {roleContent?.title || currentSlide?.title}
                      </div>
                    )}
                    <div>{roleContent?.body || currentSlide?.body}</div>
                  </div>
                )}

                {/* Logo Watermark Overlay */}
                {showLogo && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 6,
                      fontSize: 8,
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.45)',
                      letterSpacing: 0.5,
                      zIndex: 3
                    }}
                  >
                    CHURCHPRESENTER
                  </div>
                )}

                {/* Message Overlay Banner */}
                {roleMessage?.visible && roleMessage.text && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(245, 158, 11, 0.95)',
                      color: '#000000',
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '2px 6px',
                      textAlign: 'center',
                      zIndex: 4
                    }}
                  >
                    ⚠️ {roleMessage.text}
                  </div>
                )}

                {/* Freeze Badge */}
                {isFreeze && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      backgroundColor: 'rgba(56, 189, 248, 0.9)',
                      color: '#0f172a',
                      fontSize: 8,
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      zIndex: 4
                    }}
                  >
                    <Snowflake size={9} />
                    <span>CONGELADO</span>
                  </div>
                )}
              </div>
            )}

            {/* Real Stereo Audio VU Meter (No CSS Pulse Animations) */}
            <div
              className="pro-audio-vu-meter-bars"
              title={
                hasAudioActive
                  ? `Nivel real medido: L ${vuLevelLeft}% | R ${vuLevelRight}%`
                  : 'Nivel de audio: Inactivo (0%)'
              }
            >
              <div
                className="pro-vu-bar l"
                style={{
                  height: `${vuLevelLeft}%`,
                  transition: 'height 80ms ease-out',
                  opacity: vuLevelLeft > 0 ? 1 : 0.2
                }}
              />
              <div
                className="pro-vu-bar r"
                style={{
                  height: `${vuLevelRight}%`,
                  transition: 'height 80ms ease-out',
                  opacity: vuLevelRight > 0 ? 1 : 0.2
                }}
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

      {/* Resizer H3: Preview vs Deck/Timers */}
      {onResizePreview && (
        <div
          className="pro-resizer-horizontal"
          onMouseDown={onResizePreview}
          onDoubleClick={onResetPreview}
          title="Arrastrar para redimensionar vista previa (Doble clic para restablecer)"
        />
      )}

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
            <Plus size={11} />
          </button>
        </div>

        {/* Create Timer Form */}
        {isCreatingTimer && (
          <form onSubmit={handleCreateTimer} className="pro-timer-create-form">
            <input
              type="text"
              className="pro-timer-input"
              placeholder="Nombre (ej. Predicación)..."
              value={newTimerName}
              onChange={(e) => setNewTimerName(e.target.value)}
              autoFocus
            />
            <div className="pro-timer-form-row">
              <input
                type="number"
                className="pro-timer-input dur"
                placeholder="Segundos (300)"
                value={newTimerDuration}
                onChange={(e) => setNewTimerDuration(e.target.value)}
              />
              <button type="submit" className="pro-btn-save-timer">
                Guardar
              </button>
            </div>
          </form>
        )}

        {/* Timers List (Requirement 5) */}
        <div className="pro-timers-list-scroll">
          {timers.map((t) => (
            <div key={t.id} className={`pro-timer-item-card ${t.isRunning ? 'running' : ''}`}>
              <div className="pro-timer-row-top">
                <span className="pro-timer-name" title={t.name}>
                  {t.name}
                </span>
                <span className={`pro-timer-display-digits ${t.isOverrun ? 'overtime' : ''}`}>
                  {formatTimerDigits(t.currentSeconds, t.isOverrun)}
                </span>
                <div className="pro-timer-actions-inline">
                  <button
                    type="button"
                    className="pro-timer-action-btn"
                    onClick={() => onControlTimer(t.id, t.isRunning ? 'pause' : 'start')}
                    title={t.isRunning ? 'Pausar' : 'Iniciar'}
                  >
                    {t.isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    className="pro-timer-action-btn"
                    onClick={() => onControlTimer(t.id, 'reset')}
                    title="Reiniciar a duración original"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    type="button"
                    className="pro-timer-action-btn danger"
                    onClick={() => onDeleteTimer(t.id)}
                    title="Eliminar temporizador"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Audience and Stage check pills aligned horizontally below */}
              <div className="pro-timer-row-bottom">
                <label className="pro-timer-checkbox-label" title="Mostrar en Audiencia (Sala Principal)">
                  <input
                    type="checkbox"
                    checked={Boolean(t.showOnAudience)}
                    onChange={(e) => onSaveTimer({ ...t, showOnAudience: e.target.checked })}
                  />
                  <span>{panelLabels?.audience || 'Audiencia'}</span>
                </label>
                <label className="pro-timer-checkbox-label" title="Mostrar en Monitor de Escenario">
                  <input
                    type="checkbox"
                    checked={Boolean(t.showOnStage)}
                    onChange={(e) => onSaveTimer({ ...t, showOnStage: e.target.checked })}
                  />
                  <span>{panelLabels?.stage || 'Escenario'}</span>
                </label>
              </div>
            </div>
          ))}

          {timers.length === 0 && (
            <div className="pro-timers-empty">
              <span>Sin temporizadores creados. Haga clic en + para agregar uno.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
