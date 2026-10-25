import React, { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { PresenterState, DEFAULT_THEME, ThemeConfig, LayerBackground } from '../../shared/types'
import { computeLayerVisibility } from '../../shared/state-utils'
import './output.css'

interface OutputAppProps {
  role: string
}

export const OutputApp: React.FC<OutputAppProps> = ({ role }) => {
  const [displayState, setDisplayState] = useState<PresenterState | null>(null)
  const isFrozenRef = useRef<boolean>(false)

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
          <div
            className="layer-background"
            style={
              isStage
                ? { backgroundColor: '#000000' }
                : getBackgroundStyle(background)
            }
          />
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

            {/* Split View: Current Slide vs Next Slide */}
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
          </div>
        ) : (
          /* STANDARD AUDIENCE VIEW (Main / Lobby) */
          <>
            {visibility.showContent && content && (
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
