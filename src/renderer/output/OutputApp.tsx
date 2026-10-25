import React, { useEffect, useState, useRef, useLayoutEffect } from 'react'
import {
  PresenterState,
  DEFAULT_THEME,
  ThemeConfig,
  LayerBackground,
  PresentationTimer,
  YouTubeSyncTick
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

function toMediaUrl(raw?: string): string {
  if (!raw) return ''
  if (
    raw.startsWith('file://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:') ||
    raw.startsWith('http://') ||
    raw.startsWith('https://')
  ) {
    return raw
  }
  return `file:///${raw.replace(/\\/g, '/')}`
}

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
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null)
  const lastSyncTimeRef = useRef<number>(0)
  const lastPlayStateRef = useRef<boolean | null>(null)

  useEffect(() => {
    const unsub = window.churchPresenterApi?.onYouTubeSyncTick?.((tick) => {
      setLiveYtSync(tick)

      const iframe = ytIframeRef.current
      if (!iframe || !iframe.contentWindow) return

      // Mirror Play / Pause
      if (lastPlayStateRef.current !== tick.isPlaying) {
        lastPlayStateRef.current = tick.isPlaying
        if (tick.isPlaying) {
          if (Math.abs(tick.currentTime - lastSyncTimeRef.current) > 1.0) {
            lastSyncTimeRef.current = tick.currentTime
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'seekTo', args: [tick.currentTime, true] }),
              '*'
            )
          }
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*')
        } else {
          iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*')
          lastSyncTimeRef.current = tick.currentTime
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [tick.currentTime, true] }),
            '*'
          )
        }
      } else if (!tick.isPlaying) {
        // Paused state scrubbing
        if (Math.abs(tick.currentTime - lastSyncTimeRef.current) > 0.5) {
          lastSyncTimeRef.current = tick.currentTime
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [tick.currentTime, true] }),
            '*'
          )
        }
      } else {
        // Playing state: ONLY seek on major jump / manual scrub (> 2.5s) to avoid buffer stutter
        if (Math.abs(tick.currentTime - lastSyncTimeRef.current) > 2.5) {
          lastSyncTimeRef.current = tick.currentTime
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [tick.currentTime, true] }),
            '*'
          )
        } else {
          lastSyncTimeRef.current = tick.currentTime
        }
      }
    })
    return () => unsub?.()
  }, [])

  // Master Clock Video Sync effect
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
  }, [displayState?.currentSlide?.mediaUrl])

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
  const baseTheme: ThemeConfig = displayState.currentTheme || DEFAULT_THEME
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
    roleLayerState?.background || effectiveTheme.background || {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
    }

  const getBackgroundStyle = (bg: LayerBackground): React.CSSProperties => {
    if (bg.type === 'color') {
      return { backgroundColor: bg.value }
    }
    if (bg.type === 'image') {
      return {
        backgroundImage: `url(${bg.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    }
    return { background: bg.value }
  }

  // Blackout: pitch black
  if (visibility.isBlackout) {
    return <div className="output-viewport layer-blackout" />
  }

  const isStage = role === 'stage'

  return (
    <div className="output-viewport">
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

        {/* STAGE MONITOR VIEW */}
        {isStage ? (
          <div className="stage-monitor-container">
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
                  backgroundColor: '#0f172a',
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
            {visibility.showContent && (content || liveYtSync?.videoId) && (
              content?.mediaType === 'video' && content?.mediaUrl && !hasMediaError ? (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#000000', overflow: 'hidden' }}>
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
                    onError={() => {
                      setHasMediaError(true)
                      window.churchPresenterApi.logMediaError(
                        role,
                        content.mediaUrl || '',
                        'Error al decodificar formato de video'
                      )
                    }}
                  />
                </div>
              ) : (content?.mediaType === 'youtube' || Boolean(liveYtSync?.videoId)) ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 20,
                    backgroundColor: '#000000',
                    overflow: 'hidden'
                  }}
                >
                  {(() => {
                    const ytId =
                      liveYtSync?.videoId ||
                      content?.youtubeId ||
                      (content?.mediaUrl ? parseYouTubeUrl(content.mediaUrl).videoId : null)
                    if (!ytId) return null
                    const isMuted = liveYtSync?.isBrowserSource || role !== (displayState?.mediaSyncTick?.audioOutputRole || 'main')
                    return (
                      <iframe
                        ref={ytIframeRef}
                        key={ytId}
                        src={`https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&autoplay=1&mute=${
                          isMuted ? '1' : '0'
                        }&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0`}
                        title="YouTube Output"
                        allow="autoplay; encrypted-media"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          pointerEvents: 'none'
                        }}
                      />
                    )
                  })()}
                </div>
              ) : content?.mediaType === 'pdf' && content?.mediaUrl ? (
                <PdfPageView
                  pdfUrl={content.mediaUrl}
                  pageNumber={content.pdfPage || 1}
                  fitMode={content.fitMode || 'contain'}
                />
              ) : content && (content.mediaType === 'image' || content.mediaType === 'powerpoint') && content.mediaUrl ? (
                <div style={{ width: '100%', height: '100%', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  className="layer-content"
                  ref={contentBoxRef}
                  style={{
                    paddingTop: `${effectiveTheme.safeMarginsPercent.top * 10.8}px`,
                    paddingBottom: `${effectiveTheme.safeMarginsPercent.bottom * 10.8}px`,
                    paddingLeft: `${effectiveTheme.safeMarginsPercent.left * 19.2}px`,
                    paddingRight: `${effectiveTheme.safeMarginsPercent.right * 19.2}px`,
                    textAlign: effectiveTheme.alignment
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
                    {content.title && (
                      <div
                        className="content-title"
                        style={{
                          fontFamily: effectiveTheme.fontFamily,
                          color: effectiveTheme.color
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
                          WebkitTextStroke:
                            effectiveTheme.outlineWidthPx > 0
                              ? `${effectiveTheme.outlineWidthPx}px ${effectiveTheme.outlineColor}`
                              : 'none',
                          textShadow:
                            effectiveTheme.shadowBlurPx > 0
                              ? `0 4px ${effectiveTheme.shadowBlurPx}px ${effectiveTheme.shadowColor}`
                              : 'none'
                        }}
                      >
                        {content.body}
                      </div>
                    )}

                    {content.subtitle && (
                      <div
                        className="content-subtitle"
                        style={{
                          fontFamily: effectiveTheme.fontFamily
                        }}
                      >
                        {content.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              ) : null
            )}

            {/* Layer 3: Overlay (Logo) */}
            {visibility.showOverlay && (
              <div className="layer-overlay">
                <div className="church-logo-badge">
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
                  <div className="church-logo-text">CHURCH PRESENTER</div>
                </div>
              </div>
            )}

            {/* Layer 4: Operator message overlay */}
            {visibility.showMessage && roleLayerState?.message?.visible && (
              <div className="layer-message">{roleLayerState.message.text}</div>
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
