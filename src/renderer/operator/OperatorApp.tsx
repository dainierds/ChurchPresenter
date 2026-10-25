import React, { useEffect, useState, useCallback } from 'react'
import {
  DisplayInfo,
  GlobalControls,
  PresenterState,
  RoleAssignment,
  STANDARD_OUTPUT_ROLES,
  TestSlide
} from '../../shared/types'
import { INITIAL_TEST_SLIDES } from '../../shared/test-slides'
import { formatDisplayTitle } from '../../shared/display-utils'
import {
  Monitor,
  Eye,
  Slash,
  Snowflake,
  ShieldCheck,
  Activity,
  Play,
  RotateCcw
} from 'lucide-react'
import './operator.css'

export const OperatorApp: React.FC = () => {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment>({})
  const [state, setState] = useState<PresenterState | null>(null)
  const [appVersion, setAppVersion] = useState<string>('1.0.0')

  // Load initial data
  useEffect(() => {
    window.churchPresenterApi.getDisplays().then(setDisplays)
    window.churchPresenterApi.getRoleAssignments().then(setAssignments)
    window.churchPresenterApi.getState().then(setState)
    window.churchPresenterApi.getAppVersion().then(setAppVersion)

    // Subscriptions
    const unsubDisplays = window.churchPresenterApi.onDisplaysChanged((newDisplays) => {
      setDisplays(newDisplays)
      window.churchPresenterApi.getRoleAssignments().then(setAssignments)
    })

    const unsubState = window.churchPresenterApi.onStateUpdated((newState) => {
      setState(newState)
    })

    return () => {
      unsubDisplays()
      unsubState()
    }
  }, [])

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // F1 or Ctrl+B: Negro
      if (e.key === 'F1' || (e.ctrlKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('black')
      }
      // F2 or Ctrl+C: Limpiar
      else if (e.key === 'F2' || (e.ctrlKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('clear')
      }
      // F3 or Ctrl+L: Logo
      else if (e.key === 'F3' || (e.ctrlKey && e.key.toLowerCase() === 'l')) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('logo')
      }
      // F4 or Ctrl+F: Congelar
      else if (e.key === 'F4' || (e.ctrlKey && e.key.toLowerCase() === 'f')) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('freeze')
      }
    },
    []
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const toggleControl = (control: keyof GlobalControls) => {
    window.churchPresenterApi.toggleGlobalControl(control)
  }

  const handleRoleChange = async (role: string, displayIdStr: string) => {
    const displayId = displayIdStr === 'none' ? null : Number(displayIdStr)
    await window.churchPresenterApi.assignRole(role, displayId)
    const updated = await window.churchPresenterApi.getRoleAssignments()
    setAssignments(updated)
  }

  const handleIdentifyDisplays = () => {
    window.churchPresenterApi.identifyDisplays()
  }

  const handleSendSlide = (slide: TestSlide) => {
    window.churchPresenterApi.sendSlide(slide, ['main', 'lobby'])
  }

  const handleToggleStressTest = () => {
    if (!state) return
    window.churchPresenterApi.setStressTestMode(!state.stressTestMode)
  }

  const controls = state?.controls || {
    black: false,
    clear: false,
    logo: false,
    freeze: false
  }

  return (
    <div className="operator-container">
      {/* Top Header */}
      <header className="operator-header">
        <div className="operator-header-title">
          <Monitor size={24} color="#3b82f6" />
          <h1>ChurchPresenter</h1>
          <span className="badge-live">
            <span className="badge-live-dot"></span>
            EN VIVO
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>v{appVersion}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className={`btn-secondary ${state?.stressTestMode ? 'active-black' : ''}`}
            onClick={handleToggleStressTest}
            title="Activa el patrón de prueba animado para detectar parpadeo y caídas de FPS"
          >
            <Activity size={16} />
            {state?.stressTestMode ? 'Detener Prueba de Estrés' : 'Modo Prueba de Estrés'}
          </button>
        </div>
      </header>

      {/* Global Controls Bar */}
      <div className="controls-bar">
        <button
          className={`control-btn ${controls.black ? 'active-black' : ''}`}
          onClick={() => toggleControl('black')}
          title="Apagado instantáneo de todas las salidas"
        >
          <Slash size={20} />
          <span>NEGRO</span>
          <span className="shortcut">F1 / Ctrl+B</span>
        </button>

        <button
          className={`control-btn ${controls.clear ? 'active-clear' : ''}`}
          onClick={() => toggleControl('clear')}
          title="Quita el contenido y deja visible el fondo"
        >
          <RotateCcw size={20} />
          <span>LIMPIAR</span>
          <span className="shortcut">F2 / Ctrl+C</span>
        </button>

        <button
          className={`control-btn ${controls.logo ? 'active-logo' : ''}`}
          onClick={() => toggleControl('logo')}
          title="Muestra el logotipo de la iglesia"
        >
          <ShieldCheck size={20} />
          <span>LOGO</span>
          <span className="shortcut">F3 / Ctrl+L</span>
        </button>

        <button
          className={`control-btn ${controls.freeze ? 'active-freeze' : ''}`}
          onClick={() => toggleControl('freeze')}
          title="Congela la imagen actual en las pantallas"
        >
          <Snowflake size={20} />
          <span>CONGELAR</span>
          <span className="shortcut">F4 / Ctrl+F</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="operator-main-content">
        {/* Left Side: Displays & Role Mapping */}
        <aside className="panel-displays">
          <div className="section-title">
            <span>Salidas y Pantallas</span>
            <button className="btn-secondary" onClick={handleIdentifyDisplays}>
              <Eye size={14} />
              Identificar (3s)
            </button>
          </div>

          {/* Role assignments list */}
          {STANDARD_OUTPUT_ROLES.map((role) => {
            const assignedDisplayId = assignments[role.id]
            const targetDisplay = displays.find((d) => d.id === assignedDisplayId)

            return (
              <div key={role.id} className="role-card">
                <div className="role-card-header">
                  <span className="role-name">{role.label}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: assignedDisplayId ? '#4ade80' : '#94a3b8',
                      fontWeight: 600
                    }}
                  >
                    {assignedDisplayId ? `Pantalla #${assignedDisplayId}` : 'Sin Asignar'}
                  </span>
                </div>

                <select
                  className="role-select"
                  value={assignedDisplayId ?? 'none'}
                  onChange={(e) => handleRoleChange(role.id, e.target.value)}
                >
                  <option value="none">-- Sin Pantalla Asignada --</option>
                  {displays.map((disp) => (
                    <option key={disp.id} value={disp.id}>
                      {formatDisplayTitle(disp)}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {role.description}
                </div>

                {targetDisplay && (
                  <div className="display-badge">
                    <span>{targetDisplay.bounds.width}x{targetDisplay.bounds.height}</span>
                    <span>Pos: {targetDisplay.bounds.x},{targetDisplay.bounds.y}</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Physical Displays Summary */}
          <div style={{ marginTop: '10px' }}>
            <div className="section-title">
              <span>Hardware Detectado ({displays.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {displays.map((disp) => (
                <div
                  key={disp.id}
                  style={{
                    fontSize: '12px',
                    padding: '8px 10px',
                    background: '#15171d',
                    borderRadius: '6px',
                    border: '1px solid #282d38',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                    {disp.name}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    Resolución: {disp.bounds.width} x {disp.bounds.height} | Escala: {disp.scaleFactor * 100}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Side: Slides Grid & Presentation Controls */}
        <main className="panel-slides">
          {state?.stressTestMode && (
            <div className="stress-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} color="#ef4444" />
                <span>
                  <strong>MODO DE PRUEBA DE ESTRÉS ACTIVO:</strong> Las salidas están mostrando el patrón animado de diagnóstico con monitoreo de FPS.
                </span>
              </div>
              <button
                className="btn-secondary"
                style={{ background: '#7f1d1d', borderColor: '#b91c1c', color: 'white' }}
                onClick={handleToggleStressTest}
              >
                Desactivar
              </button>
            </div>
          )}

          <div className="section-title">
            <span>Diapositivas de Prueba (Haz clic para enviar a Main y Lobby)</span>
            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 500 }}>
              6 diapositivas precargadas
            </span>
          </div>

          <div className="slides-grid">
            {INITIAL_TEST_SLIDES.map((slide) => {
              const isActive = state?.currentSlide?.id === slide.id

              return (
                <div
                  key={slide.id}
                  className={`slide-card ${isActive ? 'active-slide' : ''}`}
                  style={{ background: slide.background.value }}
                  onClick={() => handleSendSlide(slide)}
                >
                  {isActive && (
                    <div className="slide-badge-active">
                      <Play size={10} style={{ display: 'inline', marginRight: '4px' }} />
                      EN PANTALLA
                    </div>
                  )}
                  <div className="slide-title">{slide.title}</div>
                  <div className="slide-body-preview">{slide.body}</div>
                  <div className="slide-subtitle">{slide.subtitle}</div>
                </div>
              )
            })}
          </div>

          {/* Current Live Preview Summary */}
          <div
            style={{
              marginTop: 'auto',
              background: '#181b22',
              border: '1px solid #2c3240',
              borderRadius: '10px',
              padding: '16px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
              ESTADO ACTUAL EN TRANSMISIÓN
            </div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Diapositiva en vivo: </span>
                <strong style={{ color: '#f8fafc' }}>
                  {state?.currentSlide?.title || 'Ninguna diapositiva seleccionada'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Controles activos: </span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {controls.black && <span style={{ color: '#ef4444', marginRight: '8px' }}>[NEGRO]</span>}
                  {controls.clear && <span style={{ color: '#f59e0b', marginRight: '8px' }}>[LIMPIAR]</span>}
                  {controls.logo && <span style={{ color: '#3b82f6', marginRight: '8px' }}>[LOGO]</span>}
                  {controls.freeze && <span style={{ color: '#14b8a6', marginRight: '8px' }}>[CONGELADO]</span>}
                  {!controls.black && !controls.clear && !controls.logo && !controls.freeze && (
                    <span style={{ color: '#4ade80' }}>Normal</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
