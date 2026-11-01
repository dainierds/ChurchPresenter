import React, { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { X } from 'lucide-react'
import {
  PresenterState,
  DEFAULT_THEME,
  ThemeConfig,
  LayerBackground,
  PresentationTimer,
  YouTubeSyncTick,
  CustomFontItem,
  StageLayoutConfig
} from '../../shared/types'
import { computeLayerVisibility } from '../../shared/state-utils'
import { parseYouTubeUrl } from '../../shared/youtube-utils'
import { PdfPageView } from '../components/PdfPageView'
import './output.css'

const formatSeconds = (sec: number): string => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const formatTimerDisplay = (seconds: number, isOvertime?: boolean): string => {
  const abs = Math.abs(seconds)
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = Math.floor(abs % 60)
  const sign = isOvertime ? '-' : ''
  if (h > 0) {
    return `${sign}${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

import { toMediaUrl } from '../../shared/media-url'

interface OutputAppProps {
  role: string
}

export const OutputApp: React.FC<OutputAppProps> = ({ role }) => {
  const [displayState, setDisplayState] = useState<PresenterState | null>(null)
  const [hasMediaError, setHasMediaError] = useState<boolean>(false)
  const isFrozenRef = useRef<boolean>(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // YouTube Mirror Sync State & Control
  const [liveYtSync, setLiveYtSync] = useState<YouTubeSyncTick | null>(null)

  useEffect(() => {
    const unsub = window.churchPresenterApi?.onYouTubeSyncTick?.((tick) => {
      setLiveYtSync(tick)
    })
    return () => unsub?.()
  }, [])

  // Instantaneous Master Clock Video Sync from media:sync-tick
  useEffect(() => {
    const unsub = window.churchPresenterApi?.onMediaSyncTick?.((tick) => {
      const video = videoRef.current
      if (!tick || !video) return

      const shouldPlayAudio = role === (tick.audioOutputRole || 'main')
      video.muted = !shouldPlayAudio
      if (shouldPlayAudio) {
        video.volume = tick.volume ?? 1.0
      }

      if (tick.isPlaying && video.paused) {
        video.play().catch(() => {})
      } else if (!tick.isPlaying && !video.paused) {
        video.pause()
      }

      const drift = Math.abs(video.currentTime - tick.currentTime)
      if (drift > 0.25) {
        video.currentTime = tick.currentTime
      }
    })
    return () => unsub?.()
  }, [role])

  // Master Clock Video Sync effect from displayState
  useEffect(() => {
    const tick = displayState?.mediaSyncTick
    const video = videoRef.current
    if (!tick || !video) return

    // Dedicated audio role check: only unmuted on designated role!
    const shouldPlayAudio = role === (tick.audioOutputRole || 'main')
    video.muted = !shouldPlayAudio
    if (shouldPlayAudio) {
      video.volume = tick.volume ?? 1.0
    }

    if (tick.isPlaying && video.paused) {
      video.play().catch(() => {})
    } else if (!tick.isPlaying && !video.paused) {
      video.pause()
    }

    const drift = Math.abs(video.currentTime - tick.currentTime)
    if (drift > 0.15) {
      video.currentTime = tick.currentTime
    }
  }, [displayState?.mediaSyncTick, role])

  // Reset media error flag on url change
  useEffect(() => {
    setHasMediaError(false)
  }, [displayState?.currentSlide?.mediaUrl, displayState?.activeLayers])

  // Viewport 1920x1080 canvas scaling
  const [canvasScale, setCanvasScale] = useState<number>(1)

  // Real-time clock for Stage Monitor
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')

  // Text auto-fit state
  const contentBoxRef = useRef<HTMLDivElement | null>(null)
  const textBoxRef = useRef<HTMLDivElement | null>(null)
  const [autoScale, setAutoScale] = useState<number>(1)

  // Stress test states
  const [fps, setFps] = useState<number>(60)
  const [frameCount, setFrameCount] = useState<number>(0)
  const [clockStr, setClockStr] = useState<string>('')
  const [squarePos, setSquarePos] = useState<number>(0)

  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(performance.now())
  const frameTimesRef = useRef<number[]>([])

  // Floating Hover Close Button State
  const [showCloseButton, setShowCloseButton] = useState<boolean>(false)
  const hideCloseTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseMove = () => {
    setShowCloseButton(true)
    if (hideCloseTimerRef.current) {
      clearTimeout(hideCloseTimerRef.current)
    }
    hideCloseTimerRef.current = setTimeout(() => {
      setShowCloseButton(false)
    }, 2500)
  }

  const handleMouseLeave = () => {
    if (hideCloseTimerRef.current) {
      clearTimeout(hideCloseTimerRef.current)
    }
    setShowCloseButton(false)
  }

  const handleCloseWindow = async () => {
    try {
      if (window.churchPresenterApi?.closeOutputWindow) {
        await window.churchPresenterApi.closeOutputWindow(role)
      }
    } catch (err) {
      console.error('Error closing output window via API:', err)
    } finally {
      try {
        window.close()
      } catch {
        // ignore
      }
    }
  }

  // Keyboard shortcut to close output window on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseWindow()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [role])
  const lastFpsDropLogRef = useRef<number>(0)
  const framesRenderedRef = useRef<number>(0)

  // Update canvas scale to maintain 1920x1080 aspect ratio
  useEffect(() => {
    const handleResize = () => {
      const sx = window.innerWidth / 1920
      const sy = window.innerHeight / 1080
      setCanvasScale(Math.min(sx, sy))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Clock tick for stage monitor
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTimeStr(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Phase 7: Periodic Health Heartbeat to Main Process
  useEffect(() => {
    const heartbeatTimer = setInterval(() => {
      if (window.churchPresenterApi?.sendOutputHeartbeat) {
        window.churchPresenterApi.sendOutputHeartbeat({
          role,
          fps: Math.round(fps || 60),
          timestamp: Date.now()
        })
      }
    }, 1500)
    return () => clearInterval(heartbeatTimer)
  }, [role, fps])

  // Load state and subscribe
  useEffect(() => {
    window.churchPresenterApi.getState().then((s) => {
      setDisplayState(s)
      isFrozenRef.current = s.controls.freeze
    })

    const unsubState = window.churchPresenterApi.onStateUpdated((newState) => {
      if (newState.controls.freeze) {
        isFrozenRef.current = true
        setDisplayState((prev) => (prev ? { ...prev, controls: newState.controls } : newState))
      } else {
        isFrozenRef.current = false
        setDisplayState(newState)
      }
    })

    return () => unsubState()
  }, [])

  // Presentation Timers synchronization
  const [timers, setTimers] = useState<PresentationTimer[]>([])
  const [assignedStageLayout, setAssignedStageLayout] = useState<StageLayoutConfig | null>(null)

  useEffect(() => {
    if (role === 'stage' && window.churchPresenterApi?.getAssignedStageLayout) {
      window.churchPresenterApi.getAssignedStageLayout(role).then((l) => setAssignedStageLayout(l)).catch(() => {})
    }
  }, [role, displayState?.activeStageLayout])

  useEffect(() => {
    if (window.churchPresenterApi?.getTimers) {
      window.churchPresenterApi.getTimers().then((t) => setTimers(t || [])).catch(() => {})
    }
    if (window.churchPresenterApi?.onTimersTick) {
      const unsubTimers = window.churchPresenterApi.onTimersTick((t) => setTimers(t || []))
      return () => unsubTimers()
    }
    return undefined
  }, [])

  // Dynamic Font Registration for Output Windows
  useEffect(() => {
    const updateFontStyles = (fonts: CustomFontItem[]) => {
      let styleTag = document.getElementById('cp-injected-fonts') as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = 'cp-injected-fonts'
        document.head.appendChild(styleTag)
      }
      const cssRules = (fonts || [])
        .map(
          (f) => `
        @font-face {
          font-family: '${f.name}';
          src: url('${f.url}') format('${f.format}');
          font-weight: normal;
          font-style: normal;
        }
      `
        )
        .join('\n')
      styleTag.textContent = cssRules
    }

    if (window.churchPresenterApi?.getCustomFonts) {
      window.churchPresenterApi.getCustomFonts().then(updateFontStyles).catch(() => {})
    }
    if (window.churchPresenterApi?.onFontsChanged) {
      const unsubFonts = window.churchPresenterApi.onFontsChanged(updateFontStyles)
      return () => unsubFonts()
    }
    return undefined
  }, [])

  // Auto-fit text calculation: shrink text if it overflows safe margins
  useLayoutEffect(() => {
    if (!contentBoxRef.current || !textBoxRef.current) {
      setAutoScale(1)
      return
    }

    // Reset scale to measure unscaled dimensions
    textBoxRef.current.style.transform = 'none'
    const boxH = contentBoxRef.current.clientHeight
    const boxW = contentBoxRef.current.clientWidth
    const textH = textBoxRef.current.scrollHeight
    const textW = textBoxRef.current.scrollWidth

    if (textH > boxH || textW > boxW) {
      const scaleH = boxH > 0 && textH > 0 ? boxH / textH : 1
      const scaleW = boxW > 0 && textW > 0 ? boxW / textW : 1
      const fitScale = Math.min(scaleH, scaleW, 1) * 0.95
      setAutoScale(fitScale)
    } else {
      setAutoScale(1)
    }
  }, [displayState?.currentSlide?.body, displayState?.currentSlide?.title, canvasScale])

  // Stress Test Animation Loop (RAF)
  useEffect(() => {
    const isStressMode = displayState?.stressTestMode ?? false

    if (!isStressMode) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    let running = true

    const loop = (time: number) => {
      if (!running) return

      const delta = time - lastTimeRef.current
      lastTimeRef.current = time
      framesRenderedRef.current += 1

      frameTimesRef.current.push(delta)
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift()
      }

      const avgDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      const currentFps = avgDelta > 0 ? 1000 / avgDelta : 60

      if (framesRenderedRef.current % 5 === 0) {
        setFps(currentFps)
        setFrameCount(framesRenderedRef.current)

        const now = new Date()
        const ms = String(now.getMilliseconds()).padStart(3, '0')
        setClockStr(`${now.toTimeString().split(' ')[0]}.${ms}`)

        const cycle = (time / 1500) % (Math.PI * 2)
        const posPercent = ((Math.sin(cycle) + 1) / 2) * 88
        setSquarePos(posPercent)

        if (currentFps < 45 && framesRenderedRef.current > 120) {
          const nowMs = Date.now()
          if (nowMs - lastFpsDropLogRef.current > 10000) {
            lastFpsDropLogRef.current = nowMs
            window.churchPresenterApi.logFpsDrop(role, currentFps)
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop)
    }

    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      running = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [displayState?.stressTestMode, role])

  if (!displayState) {
    return <div className="output-viewport" />
  }

  const controls = displayState.controls
  const visibility = computeLayerVisibility(role, controls)
  const roleLayerState = displayState.activeLayers[role] || displayState.activeLayers['main']
  const content = roleLayerState?.content || displayState.currentSlide

  // Resolve Effective Theme with Role Overrides
  const baseTheme: ThemeConfig = roleLayerState?.theme || displayState.currentTheme || DEFAULT_THEME
  const roleOverride = baseTheme.roleOverrides?.[role] || {}
  const effectiveTheme: ThemeConfig = {
    ...baseTheme,
    ...roleOverride,
    safeMarginsPercent: {
      ...baseTheme.safeMarginsPercent,
      ...(roleOverride.safeMarginsPercent || {})
    }
  }

  const background: LayerBackground =
    roleLayerState?.background ||
    effectiveTheme.background ||
    displayState?.churchBranding?.defaultBackground || {
      type: 'gradient',
      value: 'linear-gradient(135deg, #181818 0%, #242424 100%)'
    }

  const getBackgroundStyle = (bg: LayerBackground): React.CSSProperties => {
    if (bg.type === 'color') {
      return { backgroundColor: bg.value }
    }
    if (bg.type === 'image') {
      return {
        backgroundImage: `url(${toMediaUrl(bg.value)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    }
    return { background: bg.value }
  }

  // Blackout: pitch black
  if (visibility.isBlackout) {
    return (
      <div
        className="output-viewport layer-blackout"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div
          onMouseEnter={() => {
            setShowCloseButton(true)
            if (hideCloseTimerRef.current) {
              clearTimeout(hideCloseTimerRef.current)
            }
          }}
          style={{
            position: 'fixed',
            top: 14,
            right: 14,
            zIndex: 99999,
            opacity: showCloseButton ? 1 : 0,
            pointerEvents: showCloseButton ? 'auto' : 'none',
            transition: 'opacity 0.25s ease, transform 0.2s ease',
            transform: showCloseButton ? 'translateY(0)' : 'translateY(-6px)'
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleCloseWindow()
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              handleCloseWindow()
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              handleCloseWindow()
            }}
            onTouchStart={(e) => {
              e.stopPropagation()
              handleCloseWindow()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(18, 18, 18, 0.92)',
              backdropFilter: 'blur(10px)',
              color: '#F3F4F6',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
              userSelect: 'none'
            }}
            title={`Cerrar pantalla de salida (${role === 'stage' ? 'Retorno / Escenario' : 'Audiencia'})`}
          >
            <X size={15} color="#EF4444" />
            <span>Cerrar</span>
          </button>
        </div>
      </div>
    )
  }

  const isStage = role === 'stage'

  return (
    <div
      className="output-viewport"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Floating Hover Close Button in Top-Right Corner */}
      <div
        onMouseEnter={() => {
          setShowCloseButton(true)
          if (hideCloseTimerRef.current) {
            clearTimeout(hideCloseTimerRef.current)
          }
        }}
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 99999,
          opacity: showCloseButton ? 1 : 0,
          pointerEvents: showCloseButton ? 'auto' : 'none',
          transition: 'opacity 0.25s ease, transform 0.2s ease',
          transform: showCloseButton ? 'translateY(0)' : 'translateY(-6px)'
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleCloseWindow()
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            handleCloseWindow()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            handleCloseWindow()
          }}
          onTouchStart={(e) => {
            e.stopPropagation()
            handleCloseWindow()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(18, 18, 18, 0.92)',
            backdropFilter: 'blur(10px)',
            color: '#F3F4F6',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            padding: '8px 16px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
            userSelect: 'none'
          }}
          title={`Cerrar pantalla de salida (${role === 'stage' ? 'Retorno / Escenario' : 'Audiencia'})`}
        >
          <X size={15} color="#EF4444" />
          <span>Cerrar</span>
        </button>
      </div>
      {/* 1920x1080 Scaled Canvas */}
      <div
        className={`output-canvas ${isStage ? 'stage-mode' : ''}`}
        style={{
          transform: `scale(${canvasScale})`
        }}
      >
        {/* Layer 1: Fondo (Background) */}
        {visibility.showBackground && (
          background?.type === 'video' && !isStage ? (
            <video
              src={toMediaUrl(background.value)}
              autoPlay
              loop
              muted
              playsInline
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div
              className="layer-background"
              style={
                isStage
                  ? { backgroundColor: '#000000' }
                  : getBackgroundStyle(background)
              }
            />
          )
        )}

        {/* Layer 1.5: Theme Darkening Overlay for Contrast & Readability */}
        {visibility.showBackground && !isStage && effectiveTheme.overlayColor && (effectiveTheme.overlayOpacity || 0) > 0 && (
          <div
            className="layer-theme-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: effectiveTheme.overlayColor,
              opacity: effectiveTheme.overlayOpacity,
              pointerEvents: 'none',
              zIndex: 3
            }}
          />
        )}

        {/* Watermark / Logo */}
        {!isStage && effectiveTheme.watermarkUrl && (effectiveTheme.watermarkOpacity || 0) > 0 && (
          <div
            className="layer-theme-watermark"
            style={{
              position: 'absolute',
              top: effectiveTheme.watermarkPosition?.startsWith('top') ? '5%' : undefined,
              bottom: effectiveTheme.watermarkPosition?.startsWith('bottom') ? '5%' : undefined,
              left: effectiveTheme.watermarkPosition?.endsWith('left') ? '5%' : undefined,
              right: effectiveTheme.watermarkPosition?.endsWith('right') ? '5%' : undefined,
              width: `${effectiveTheme.watermarkSizePercent || 10}%`,
              opacity: effectiveTheme.watermarkOpacity,
              pointerEvents: 'none',
              zIndex: 4
            }}
          >
            <img src={effectiveTheme.watermarkUrl} alt="Watermark" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
          </div>
        )}

        {/* STAGE MONITOR VIEW */}
        {isStage ? (
          <div className="stage-monitor-container" data-layout-id={assignedStageLayout?.id || 'classic'}>
            {/* Stage Active Message Banner */}
            {displayState?.activeMessage && (displayState.activeMessage.target === 'stage' || displayState.activeMessage.target === 'both') && (
              <div
                className="stage-active-message-banner"
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '4%',
                  right: '4%',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '10px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.85)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 900, backgroundColor: '#ffffff', color: '#dc2626', padding: '4px 10px', borderRadius: '4px' }}>
                  AVISO
                </div>
                <div style={{ fontSize: '30px', fontWeight: 800, flex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
                  {displayState.activeMessage.text}
                </div>
              </div>
            )}

            {/* Stage Header: Clock, Song Title & Operator Alert */}
            <div className="stage-header-bar">
              <div className="stage-badge">RETORNO / ESCENARIO</div>
              {content?.title && <div className="stage-song-title">{content.title}</div>}
              <div className="stage-clock">{currentTimeStr}</div>
            </div>

            {/* Stage Operator Banner Alert */}
            {roleLayerState?.message?.visible && roleLayerState.message.text && (
              <div className="stage-operator-alert">
                <span className="alert-icon">🔔</span>
                <span className="alert-text">{roleLayerState.message.text}</span>
              </div>
            )}

            {/* Requirement B.10: During video or YouTube playback, show elapsed and remaining time */}
            {content?.mediaType === 'video' || content?.mediaType === 'youtube' ? (
              <div
                className="stage-video-panel"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 24,
                  backgroundColor: '#181818',
                  border: '2px solid #334155',
                  borderRadius: 12,
                  margin: 20,
                  padding: 30
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      backgroundColor: displayState?.mediaSyncTick?.isPlaying ? '#10b981' : '#f59e0b',
                      color: '#000000',
                      padding: '4px 12px',
                      borderRadius: 6
                    }}
                  >
                    {displayState?.mediaSyncTick?.isPlaying ? '▶ EN REPRODUCCIÓN' : '⏸ EN PAUSA'}
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>
                    {content.title || 'Video en vivo'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 60, marginTop: 10 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: 4 }}>
                      TRANSCURRIDO
                    </div>
                    <div style={{ fontSize: 72, fontWeight: 900, fontFamily: 'monospace', color: '#38bdf8' }}>
                      {formatSeconds(displayState?.mediaSyncTick?.currentTime || 0)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: 4 }}>
                      RESTANTE
                    </div>
                    <div style={{ fontSize: 72, fontWeight: 900, fontFamily: 'monospace', color: '#f43f5e' }}>
                      -{formatSeconds(
                        Math.max(
                          0,
                          (displayState?.mediaSyncTick?.duration || 0) - (displayState?.mediaSyncTick?.currentTime || 0)
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Split View: Current Slide vs Next Slide */
              <div className="stage-split-panels">
                {/* Left/Main Panel: Current Slide (En Pantalla) */}
                <div className="stage-panel stage-panel-current">
                  <div className="stage-panel-label">EN PANTALLA</div>
                  <div className="stage-panel-body">
                    {visibility.showContent && content?.body ? (
                      <div className="stage-lyrics-current">{content.body}</div>
                    ) : (
                      <div className="stage-lyrics-empty">(Sin texto en vivo)</div>
                    )}
                  </div>
                </div>

                {/* Right Panel: Next Slide Preview */}
                <div className="stage-panel stage-panel-next">
                  <div className="stage-panel-label">
                    SIGUIENTE
                    {content?.nextSlideTitle && ` - ${content.nextSlideTitle}`}
                  </div>
                  <div className="stage-panel-body">
                    {content?.nextSlideBody ? (
                      <div className="stage-lyrics-next">{content.nextSlideBody}</div>
                    ) : (
                      <div className="stage-lyrics-empty">(Fin de la canción / diapositiva)</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Phase 5B: Speaker Notes for Stage Monitor */}
            {isStage && visibility.showContent && content?.speakerNotes && (
              <div
                style={{
                  marginTop: 16,
                  padding: '12px 20px',
                  backgroundColor: 'rgba(30, 41, 59, 0.95)',
                  border: '2px solid #f59e0b',
                  borderRadius: 10,
                  maxWidth: '92%'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24', letterSpacing: '0.08em', marginBottom: 4 }}>
                  NOTAS DEL ORADOR:
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#f8fafc', lineHeight: 1.4 }}>
                  {content.speakerNotes}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* STANDARD AUDIENCE VIEW (Main / Lobby) */
          <>
            {(() => {
              const isMediaVideo =
                content?.mediaType === 'video' && content?.mediaUrl && !hasMediaError
              const isMediaYouTube =
                content?.mediaType !== 'video' &&
                ((content as any)?.mediaType === 'youtube' ||
                  (Boolean(liveYtSync?.videoId) && (!content || (content as any).mediaType === 'youtube'))) &&
                Boolean(
                  liveYtSync?.videoId ||
                    content?.youtubeId ||
                    (content?.mediaUrl ? parseYouTubeUrl(content.mediaUrl).videoId : null)
                )

              return (
                <>
                  {/* Local Video Layer: persistently mounted, visibility toggled via display */}
                  {isMediaVideo && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: '#000000',
                        overflow: 'hidden',
                        zIndex: 15,
                        display: visibility.showContent ? 'block' : 'none'
                      }}
                    >
                      <video
                        ref={videoRef}
                        src={toMediaUrl(content.mediaUrl)}
                        autoPlay
                        playsInline
                        muted={role !== (displayState?.mediaSyncTick?.audioOutputRole || 'main')}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: (content.fitMode as any) || 'contain'
                        }}
                        onLoadedMetadata={(e) => {
                          const v = e.currentTarget
                          if (v.duration && isFinite(v.duration)) {
                            window.churchPresenterApi.updateVideoDuration?.(v.duration)
                          }
                        }}
                        onError={(e) => {
                          const target = e.currentTarget as HTMLVideoElement
                          const errCode = target.error ? target.error.code : 'unknown'
                          const errMsg = target.error ? target.error.message : 'unknown'
                          console.error(`[OutputApp] Video playback error (${errCode}): ${errMsg}`)
                          setHasMediaError(true)
                          window.churchPresenterApi.logMediaError(
                            role,
                            content.mediaUrl || '',
                            `Error al reproducir video (${errMsg || 'formato o esquema no soportado'})`
                          )
                        }}
                      />
                    </div>
                  )}

                  {/* YouTube Live Player Layer: Dedicated native WebContentsView is attached directly by YouTubeOutputManager */}
                  {isMediaYouTube && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 20,
                        backgroundColor: '#000000',
                        overflow: 'hidden',
                        display: visibility.showContent ? 'block' : 'none'
                      }}
                    />
                  )}

                  {visibility.showContent && !isMediaVideo && !isMediaYouTube && (
                    <>
                      {content?.mediaType === 'pdf' && content?.mediaUrl ? (
                        <PdfPageView
                          pdfUrl={content.mediaUrl}
                          pageNumber={content.pdfPage || 1}
                          fitMode={content.fitMode || 'contain'}
                        />
                      ) : content &&
                        (content.mediaType === 'image' || content.mediaType === 'powerpoint') &&
                        content.mediaUrl ? (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#000000',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <img
                            src={toMediaUrl(content.mediaUrl)}
                            alt={content.title || ''}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: (content.fitMode as any) || 'contain'
                            }}
                          />
                        </div>
                      ) : content ? (
                        <div
                          className={`layer-content ${displayState?.disableTransitions ? '' : `anim-${effectiveTheme?.slideTransition?.type || 'fade'}`}`}
                          key={content.id}
                          ref={contentBoxRef}
                          style={{
                            paddingTop: `${effectiveTheme.safeMarginsPercent.top * 10.8}px`,
                            paddingBottom: `${effectiveTheme.safeMarginsPercent.bottom * 10.8}px`,
                            paddingLeft: `${effectiveTheme.safeMarginsPercent.left * 19.2}px`,
                            paddingRight: `${effectiveTheme.safeMarginsPercent.right * 19.2}px`,
                            textAlign: effectiveTheme.alignment,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent:
                              effectiveTheme.verticalAlign === 'top'
                                ? 'flex-start'
                                : effectiveTheme.verticalAlign === 'bottom'
                                  ? 'flex-end'
                                  : 'center'
                          }}
                        >
                          <div
                            ref={textBoxRef}
                            className="content-inner-box"
                            style={{
                              transform: autoScale < 1 ? `scale(${autoScale})` : 'none',
                              transformOrigin:
                                effectiveTheme.alignment === 'center'
                                  ? 'center center'
                                  : effectiveTheme.alignment === 'left'
                                    ? 'left center'
                                    : 'right center'
                            }}
                          >
                            {/* If Bible and refPosition === 'top', show reference on top */}
                            {content.scripturePayload &&
                              effectiveTheme.bibleRefPosition === 'top' && (
                                <div
                                  className="content-bible-ref-top"
                                  style={{
                                    fontFamily: effectiveTheme.fontFamily,
                                    color: effectiveTheme.color,
                                    fontSize: `${effectiveTheme.bibleRefFontSizeVmin || 3.4}vmin`,
                                    fontWeight: 700,
                                    marginBottom: '1.2vmin',
                                    opacity: 0.95
                                  }}
                                >
                                  {content.subtitle || content.scripturePayload.reference}
                                </div>
                              )}

                            {content.title &&
                              effectiveTheme.songShowTitleOnFirstSlide !== false && (
                                <div
                                  className="content-title"
                                  style={{
                                    fontFamily: effectiveTheme.fontFamily,
                                    color: effectiveTheme.color,
                                    textTransform: effectiveTheme.textTransform || 'none'
                                  }}
                                >
                                  {content.title}
                                </div>
                              )}

                            {content.body && (
                              <div
                                className="content-body"
                                style={{
                                  fontFamily: effectiveTheme.fontFamily,
                                  color: effectiveTheme.color,
                                  fontWeight: effectiveTheme.fontWeight || 'normal',
                                  fontStyle: effectiveTheme.fontStyle || 'normal',
                                  textTransform: effectiveTheme.textTransform || 'none',
                                  lineHeight: effectiveTheme.lineHeight || 1.3,
                                  letterSpacing: `${effectiveTheme.letterSpacing || 0}px`,
                                  WebkitTextStroke:
                                    effectiveTheme.outlineWidthPx > 0
                                      ? `${effectiveTheme.outlineWidthPx}px ${effectiveTheme.outlineColor}`
                                      : 'none',
                                  textShadow:
                                    effectiveTheme.shadowBlurPx > 0
                                      ? `${effectiveTheme.shadowOffsetX || 0}px ${effectiveTheme.shadowOffsetY || 4}px ${effectiveTheme.shadowBlurPx}px ${effectiveTheme.shadowColor}`
                                      : 'none'
                                }}
                              >
                                {content.body}
                              </div>
                            )}

                            {content.subtitle &&
                              (!content.scripturePayload ||
                                effectiveTheme.bibleRefPosition !== 'top') && (
                                <div
                                  className="content-subtitle"
                                  style={{
                                    fontFamily: effectiveTheme.fontFamily,
                                    fontSize: content.scripturePayload
                                      ? `${effectiveTheme.bibleRefFontSizeVmin || 3.4}vmin`
                                      : undefined
                                  }}
                                >
                                  {content.subtitle}
                                </div>
                              )}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )
            })()}

            {/* Layer 3: Overlay (Logo) */}
            {visibility.showOverlay && (
              <div className="layer-overlay">
                <div
                  className="church-logo-badge"
                  style={{
                    flexDirection:
                      displayState?.churchBranding?.logoTextPosition === 'right' ? 'row' : 'column'
                  }}
                >
                  {displayState?.churchBranding?.logoUrl ? (
                    <img
                      src={toMediaUrl(displayState.churchBranding.logoUrl)}
                      alt={displayState.churchBranding.churchName || 'Logo de la Iglesia'}
                      className="church-logo-custom-img"
                      style={{
                        maxHeight: `${displayState.churchBranding.logoWidthVmin || 22}vmin`,
                        maxWidth: `${(displayState.churchBranding.logoWidthVmin || 22) * 2}vmin`,
                        objectFit: 'contain',
                        opacity: displayState.churchBranding.logoOpacity ?? 1,
                        filter: 'drop-shadow(0 12px 32px rgba(0, 0, 0, 0.85))'
                      }}
                    />
                  ) : (
                    <svg
                      className="church-logo-icon"
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="50" cy="50" r="46" stroke="#ffffff" strokeWidth="4" />
                      <path
                        d="M50 20 V80 M32 40 H68"
                        stroke="#ffffff"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  {displayState?.churchBranding?.logoTextPosition !== 'none' && (
                    <div className="church-logo-text">
                      {displayState?.churchBranding?.churchName || 'CHURCH PRESENTER'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Layer 4: Operator message overlay */}
            {visibility.showMessage && roleLayerState?.message?.visible && (
              <div className="layer-message">{roleLayerState.message.text}</div>
            )}

            {/* Phase 6: Audience Active Message Overlay Banner */}
            {!isStage && displayState?.activeMessage && (displayState.activeMessage.target === 'audience' || displayState.activeMessage.target === 'both') && (
              <div
                className="layer-audience-message"
                style={{
                  position: 'absolute',
                  bottom: '36px',
                  left: '5%',
                  right: '5%',
                  backgroundColor: 'rgba(18, 18, 18, 0.95)',
                  border: '2px solid #f97316',
                  borderRadius: '12px',
                  padding: '16px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 20px 45px rgba(0, 0, 0, 0.9)',
                  zIndex: 9999
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: '#f97316',
                    flexShrink: 0
                  }}
                />
                <div
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1.3,
                    flex: 1
                  }}
                >
                  {displayState.activeMessage.text}
                </div>
              </div>
            )}

            {/* Phase 8: Active Props Layer (Superpuestos encima de contenidos) */}
            {visibility.showContent && !displayState?.controls?.black && displayState?.activeProps && displayState.activeProps.length > 0 && (
              <div className="output-props-layer">
                {displayState.activeProps
                  .filter((p) => p.isActive && p.targetRoles.includes(role))
                  .map((prop) => (
                    <div
                      key={prop.id}
                      className={`output-prop-item output-prop-${prop.type} ${prop.transition?.inType === 'cut' ? '' : `anim-${prop.transition?.inType || 'fade'}`}`}
                      style={{
                        position: 'absolute',
                        left: `${prop.position.x}%`,
                        top: `${prop.position.y}%`,
                        width: `${prop.position.width}%`,
                        height: `${prop.position.height}%`,
                        opacity: prop.style.opacity ?? 1,
                        backgroundColor: prop.style.backgroundColor || 'transparent',
                        borderRadius: `${prop.style.borderRadiusPx || 0}px`,
                        padding: `${prop.style.paddingPx || 0}px`,
                        color: prop.style.fontColor || '#ffffff',
                        zIndex: 48,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: prop.position.alignment.includes('bottom')
                          ? 'flex-end'
                          : prop.position.alignment.includes('center')
                            ? 'center'
                            : 'flex-start',
                        alignItems: prop.position.alignment.includes('right')
                          ? 'flex-end'
                          : prop.position.alignment.includes('center')
                            ? 'center'
                            : 'flex-start',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        pointerEvents: 'none'
                      }}
                    >
                      {prop.type === 'logo' && (
                        <div className="output-prop-logo-content" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {prop.content.imageUrl ? (
                            <img src={toMediaUrl(prop.content.imageUrl)} alt={prop.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                          ) : (
                            <div style={{ fontSize: `${prop.style.fontSizeVmin || 2.5}vmin`, fontWeight: 800, letterSpacing: '2px', color: prop.style.fontColor || '#FF7A00' }}>
                              {prop.content.text || 'CHURCH'}
                            </div>
                          )}
                        </div>
                      )}

                      {prop.type === 'lower_third' && (
                        <div
                          className="output-prop-lower-third-card"
                          style={{
                            width: '100%',
                            backgroundColor: prop.style.backgroundColor || '#181818',
                            borderLeft: '5px solid #FF7A00',
                            borderRadius: `${prop.style.borderRadiusPx || 6}px`,
                            padding: '12px 24px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.85)'
                          }}
                        >
                          <div style={{ fontSize: `${prop.style.fontSizeVmin || 3}vmin`, fontWeight: 700, color: prop.style.fontColor || '#ffffff', lineHeight: 1.2 }}>
                            {prop.content.text}
                          </div>
                          {prop.content.subtitle && (
                            <div style={{ fontSize: `${(prop.style.fontSizeVmin || 3) * 0.65}vmin`, color: '#94a3b8', marginTop: '4px' }}>
                              {prop.content.subtitle}
                            </div>
                          )}
                        </div>
                      )}

                      {prop.type === 'countdown' && (
                        <div
                          className="output-prop-countdown-card"
                          style={{
                            backgroundColor: prop.style.backgroundColor || 'rgba(0,0,0,0.8)',
                            borderRadius: `${prop.style.borderRadiusPx || 6}px`,
                            padding: '8px 16px',
                            border: '1px solid #38bdf8',
                            textAlign: 'center'
                          }}
                        >
                          {prop.content.text && (
                            <div style={{ fontSize: `${(prop.style.fontSizeVmin || 2.5) * 0.6}vmin`, color: '#94a3b8' }}>
                              {prop.content.text}
                            </div>
                          )}
                          <div style={{ fontSize: `${prop.style.fontSizeVmin || 3.2}vmin`, fontWeight: 800, color: '#38bdf8', letterSpacing: '1px' }}>
                            {formatSeconds(prop.content.countdownSeconds || 300)}
                          </div>
                        </div>
                      )}

                      {prop.type === 'text' && (
                        <div style={{ fontSize: `${prop.style.fontSizeVmin || 3.5}vmin`, fontWeight: 600, color: prop.style.fontColor || '#ffffff' }}>
                          {prop.content.text}
                        </div>
                      )}

                      {prop.type === 'image' && prop.content.imageUrl && (
                        <img src={toMediaUrl(prop.content.imageUrl)} alt={prop.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Layer 5: Active Presentation Timers on Stage & Audience */}
            {isStage && (
              <div className="stage-active-timers-strip">
                {timers
                  .filter((t) => t.showOnStage && (t.isRunning || t.isOvertime || t.isOverrun))
                  .map((t) => (
                    <div
                      key={t.id}
                      className={`stage-timer-badge ${
                        (t.isOvertime || t.isOverrun) ? 'overtime' : (t.remainingSeconds ?? t.currentSeconds) <= 60 ? 'urgent' : ''
                      }`}
                    >
                      <span className="stage-timer-title">{t.name}</span>
                      <span className="stage-timer-digits">
                        {formatTimerDisplay(t.remainingSeconds ?? t.currentSeconds, t.isOvertime || t.isOverrun)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {!isStage && (
              <div className="audience-active-timers-strip">
                {timers
                  .filter((t) => t.showOnAudience && t.isRunning)
                  .map((t) => (
                    <div key={t.id} className="audience-timer-pill">
                      <span className="audience-timer-title">{t.name}:</span>
                      <span className="audience-timer-digits">
                        {formatTimerDisplay(t.remainingSeconds ?? t.currentSeconds, t.isOvertime || t.isOverrun)}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Phase 10: Real-Time Subtitles & Translation Layer */}
            {visibility.showContent && !displayState?.controls?.black && displayState?.activeSubtitle && (() => {
              const sub = displayState.activeSubtitle
              const cfg = displayState.subtitlesConfig || {
                enabled: true,
                position: 'bottom',
                fontSizeVmin: 3.5,
                maxLines: 2,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                textColor: '#FFFFFF',
                fadeDurationMs: 300,
                autoClearDelaySec: 5,
                targetRoles: ['main', 'lobby', 'program', 'audience']
              }
              const isTargeted =
                !cfg.targetRoles ||
                cfg.targetRoles.length === 0 ||
                cfg.targetRoles.includes(role) ||
                (role === 'main' && cfg.targetRoles.includes('audience')) ||
                (role === 'audience' && cfg.targetRoles.includes('main'))

              if (!isTargeted) return null

              return (
                <div
                  className={`output-subtitles-layer output-subtitles-${cfg.position || 'bottom'}`}
                  style={{
                    position: 'absolute',
                    left: '4%',
                    right: '4%',
                    [cfg.position === 'top' ? 'top' : 'bottom']: '4%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    zIndex: 95,
                    transition: `opacity ${cfg.fadeDurationMs || 300}ms ease`
                  }}
                >
                  <div
                    className="output-subtitle-bubble"
                    style={{
                      backgroundColor: cfg.backgroundColor || 'rgba(0, 0, 0, 0.85)',
                      color: cfg.textColor || '#FFFFFF',
                      fontSize: `${cfg.fontSizeVmin || 3.5}vmin`,
                      lineHeight: 1.3,
                      padding: '0.6em 1.4em',
                      borderRadius: '8px',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                      maxWidth: '92%',
                      wordBreak: 'break-word',
                      display: '-webkit-box',
                      WebkitLineClamp: cfg.maxLines || 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="output-subtitle-text">{sub.text}</div>
                    {sub.translation && (
                      <div
                        className="output-subtitle-translation"
                        style={{
                          color: '#38bdf8',
                          fontSize: `${(cfg.fontSizeVmin || 3.5) * 0.85}vmin`,
                          marginTop: '0.3em',
                          fontStyle: 'italic'
                        }}
                      >
                        {sub.translation}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* Stress Test Diagnostics Overlay */}
        {displayState.stressTestMode && (
          <div className="stress-test-overlay">
            <div className="stress-header">
              <div>
                <div className="stress-title">MODO DE PRUEBA DE ESTRÉS</div>
                <div className="stress-role">
                  ROL: {role.toUpperCase()} | PANTALLA ACTIVA
                </div>
              </div>

              <div className="stress-stats">
                <div className="stat-box">
                  <div className="stat-label">FPS EN VIVO</div>
                  <div className={`stat-value ${fps < 45 ? 'fps-alert' : ''}`}>
                    {fps.toFixed(1)}
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">FOTOGRAMAS</div>
                  <div className="stat-value">{frameCount}</div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">RELOJ ALTA RESOLUCIÓN</div>
                  <div className="stat-value">{clockStr}</div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">RESOLUCIÓN REAL</div>
                  <div className="stat-value">
                    {window.innerWidth} x {window.innerHeight}
                  </div>
                </div>
              </div>
            </div>

            <div className="stress-animation-track">
              <div
                className="stress-moving-square"
                style={{
                  left: `${squarePos}%`
                }}
              >
                SYNC
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
