import React, { useEffect, useState, useRef } from 'react'
import { PresenterState } from '../../shared/types'
import { computeLayerVisibility } from '../../shared/state-utils'
import './output.css'

interface OutputAppProps {
  role: string
}

export const OutputApp: React.FC<OutputAppProps> = ({ role }) => {
  const [displayState, setDisplayState] = useState<PresenterState | null>(null)
  const isFrozenRef = useRef<boolean>(false)

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

  // Load state and subscribe
  useEffect(() => {
    window.churchPresenterApi.getState().then((s) => {
      setDisplayState(s)
      isFrozenRef.current = s.controls.freeze
    })

    const unsubState = window.churchPresenterApi.onStateUpdated((newState) => {
      // If freeze just got activated, keep current displayState
      if (newState.controls.freeze) {
        isFrozenRef.current = true
        // Only update controls part so black/clear can still work or stay frozen
        setDisplayState((prev) => (prev ? { ...prev, controls: newState.controls } : newState))
      } else {
        isFrozenRef.current = false
        setDisplayState(newState)
      }
    })

    return () => unsubState()
  }, [])

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

      // Track rolling FPS
      frameTimesRef.current.push(delta)
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift()
      }

      const avgDelta =
        frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
      const currentFps = avgDelta > 0 ? 1000 / avgDelta : 60

      // Only update React state every 5 frames to avoid React render churn
      if (framesRenderedRef.current % 5 === 0) {
        setFps(currentFps)
        setFrameCount(framesRenderedRef.current)

        const now = new Date()
        const ms = String(now.getMilliseconds()).padStart(3, '0')
        setClockStr(`${now.toTimeString().split(' ')[0]}.${ms}`)

        // Calculate moving square position (smooth oscillation between 0% and 88%)
        const cycle = (time / 1500) % (Math.PI * 2)
        const posPercent = ((Math.sin(cycle) + 1) / 2) * 88
        setSquarePos(posPercent)

        // Log FPS drop if below 45 FPS (throttled to once every 10 seconds)
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
  const background = roleLayerState?.background || {
    type: 'gradient',
    value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
  }

  // Blackout: pitch black
  if (visibility.isBlackout) {
    return <div className="output-viewport layer-blackout" />
  }

  return (
    <div className={`output-viewport ${role === 'stage' ? 'stage-mode' : ''}`}>
      {/* Layer 1: Fondo (Background) */}
      {visibility.showBackground && (
        <div
          className="layer-background"
          style={{
            background: background.value
          }}
        />
      )}

      {/* Layer 2: Contenido (Content) */}
      {visibility.showContent && content && (
        <div className="layer-content">
          {content.title && <div className="content-title">{content.title}</div>}
          {content.body && <div className="content-body">{content.body}</div>}
          {content.subtitle && <div className="content-subtitle">{content.subtitle}</div>}
        </div>
      )}

      {/* Layer 3: Superpuesto (Overlay / Logo) */}
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

      {/* Layer 4: Mensaje (Message Layer) */}
      {visibility.showMessage && roleLayerState?.message?.visible && (
        <div className="layer-message">{roleLayerState.message.text}</div>
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

          {/* Smooth moving test square */}
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
  )
}
