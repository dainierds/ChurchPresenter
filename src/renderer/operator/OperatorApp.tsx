import React, { useEffect, useState, useCallback } from 'react'
import {
  DisplayInfo,
  GlobalControls,
  PresenterState,
  RoleAssignment,
  STANDARD_OUTPUT_ROLES,
  TestSlide,
  AppShortcutsConfig,
  DEFAULT_SHORTCUTS,
  AppNotification
} from '../../shared/types'
import { INITIAL_TEST_SLIDES } from '../../shared/test-slides'
import { formatDisplayTitle, matchDisplayByStableId } from '../../shared/display-utils'
import {
  Monitor,
  Eye,
  Slash,
  Snowflake,
  ShieldCheck,
  Activity,
  Play,
  RotateCcw,
  Settings,
  FolderOpen,
  X,
  AlertCircle
} from 'lucide-react'
import './operator.css'

export const OperatorApp: React.FC = () => {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment>({})
  const [state, setState] = useState<PresenterState | null>(null)
  const [shortcuts, setShortcuts] = useState<AppShortcutsConfig>(DEFAULT_SHORTCUTS)
  const [appVersion, setAppVersion] = useState<string>('1.0.0')

  // Settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [tempShortcuts, setTempShortcuts] = useState<AppShortcutsConfig>(DEFAULT_SHORTCUTS)

  // Notifications
  const [toasts, setToasts] = useState<AppNotification[]>([])

  // Load initial data
  useEffect(() => {
    window.churchPresenterApi.getDisplays().then(setDisplays)
    window.churchPresenterApi.getRoleAssignments().then(setAssignments)
    window.churchPresenterApi.getState().then(setState)
    window.churchPresenterApi.getAppVersion().then(setAppVersion)
    window.churchPresenterApi.getShortcuts().then((s) => {
      setShortcuts(s)
      setTempShortcuts(s)
    })

    // Subscriptions
    const unsubDisplays = window.churchPresenterApi.onDisplaysChanged((newDisplays) => {
      setDisplays(newDisplays)
      window.churchPresenterApi.getRoleAssignments().then(setAssignments)
    })

    const unsubState = window.churchPresenterApi.onStateUpdated((newState) => {
      setState(newState)
    })

    const unsubNotif = window.churchPresenterApi.onNotification((notif) => {
      setToasts((prev) => [...prev, notif])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notif.id))
      }, 4500)
    })

    return () => {
      unsubDisplays()
      unsubState()
      unsubNotif()
    }
  }, [])

  // Local Keyboard shortcuts handler
  // STRICT REQUIREMENT: Only fires when app window has focus.
  // NO CTRL / MODIFIERS: Ctrl+C, Ctrl+B, etc. are NOT hijacked!
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Do not process if Ctrl, Alt or Meta is pressed
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return
      }

      const key = e.key.toUpperCase()

      if (key === shortcuts.black.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('black')
      } else if (key === shortcuts.clear.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('clear')
      } else if (key === shortcuts.logo.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('logo')
      } else if (key === shortcuts.freeze.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('freeze')
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const toggleControl = (control: keyof GlobalControls) => {
    window.churchPresenterApi.toggleGlobalControl(control)
  }

  const handleRoleChange = async (role: string, stableIdStr: string) => {
    const stableId = stableIdStr === 'none' ? null : stableIdStr
    await window.churchPresenterApi.assignRole(role, stableId)
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

  const handleSaveSettings = async () => {
    await window.churchPresenterApi.saveShortcuts(tempShortcuts)
    setShortcuts(tempShortcuts)
    setIsSettingsOpen(false)
  }

  const handleOpenBackups = () => {
    window.churchPresenterApi.openBackupsFolder()
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

          <button
            className="btn-secondary"
            onClick={() => {
              setTempShortcuts(shortcuts)
              setIsSettingsOpen(true)
            }}
            title="Configuración de atajos y almacenamiento"
          >
            <Settings size={16} />
            Configuración
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
          <span className="shortcut">{shortcuts.black} (con foco)</span>
        </button>

        <button
          className={`control-btn ${controls.clear ? 'active-clear' : ''}`}
          onClick={() => toggleControl('clear')}
          title="Quita el contenido y deja visible el fondo"
        >
          <RotateCcw size={20} />
          <span>LIMPIAR</span>
          <span className="shortcut">{shortcuts.clear} (con foco)</span>
        </button>

        <button
          className={`control-btn ${controls.logo ? 'active-logo' : ''}`}
          onClick={() => toggleControl('logo')}
          title="Muestra el logotipo de la iglesia"
        >
          <ShieldCheck size={20} />
          <span>LOGO</span>
          <span className="shortcut">{shortcuts.logo} (con foco)</span>
        </button>

        <button
          className={`control-btn ${controls.freeze ? 'active-freeze' : ''}`}
          onClick={() => toggleControl('freeze')}
          title="Congela la imagen actual en las pantallas"
        >
          <Snowflake size={20} />
          <span>CONGELAR</span>
          <span className="shortcut">{shortcuts.freeze} (con foco)</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="operator-main-content">
        {/* Left Side: Displays & Roles */}
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
            const assignedStableId = assignments[role.id]
            const targetDisplay = assignedStableId
              ? matchDisplayByStableId(assignedStableId, displays)
              : undefined
            const isOffline = assignedStableId && !targetDisplay

            return (
              <div key={role.id} className="role-card">
                <div className="role-card-header">
                  <span className="role-name">{role.label}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: isOffline ? '#fbbf24' : targetDisplay ? '#4ade80' : '#94a3b8',
                      fontWeight: 600
                    }}
                  >
                    {isOffline
                      ? 'Desconectada (guardada)'
                      : targetDisplay
                      ? `Pantalla #${targetDisplay.id}`
                      : 'Sin Asignar'}
                  </span>
                </div>

                <select
                  className="role-select"
                  value={targetDisplay ? targetDisplay.stableId : isOffline ? assignedStableId! : 'none'}
                  onChange={(e) => handleRoleChange(role.id, e.target.value)}
                >
                  <option value="none">-- Sin Pantalla Asignada --</option>
                  {isOffline && (
                    <option value={assignedStableId!}>
                      ⚠️ [Desconectada] {assignedStableId}
                    </option>
                  )}
                  {displays.map((disp) => (
                    <option key={disp.stableId} value={disp.stableId}>
                      {formatDisplayTitle(disp)}
                    </option>
                  ))}
                </select>

                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {role.description}
                </div>

                {isOffline && (
                  <div className="display-badge-offline">
                    <AlertCircle size={14} />
                    <span>Pantalla guardada no detectada. Se restaurará sola al reconectar.</span>
                  </div>
                )}

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
                  key={disp.stableId}
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
                    #{disp.id} - {disp.name}
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    Resolución: {disp.bounds.width} x {disp.bounds.height} | Escala: {disp.scaleFactor * 100}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', wordBreak: 'break-all' }}>
                    ID Estable: {disp.stableId}
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
                  <strong>MODO DE PRUEBA DE ESTRÉS ACTIVO:</strong> Las salidas están mostrando el patrón animado con monitoreo continuo de FPS.
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

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Configuración de ChurchPresenter</div>
              <button className="modal-close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>
                Atajos de Teclado Locales (Solo con foco en la app)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Atajo para NEGRO</label>
                  <input
                    className="form-input"
                    value={tempShortcuts.black}
                    onChange={(e) => setTempShortcuts({ ...tempShortcuts, black: e.target.value.toUpperCase() })}
                    placeholder="F1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Atajo para LIMPIAR</label>
                  <input
                    className="form-input"
                    value={tempShortcuts.clear}
                    onChange={(e) => setTempShortcuts({ ...tempShortcuts, clear: e.target.value.toUpperCase() })}
                    placeholder="F2"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Atajo para LOGO</label>
                  <input
                    className="form-input"
                    value={tempShortcuts.logo}
                    onChange={(e) => setTempShortcuts({ ...tempShortcuts, logo: e.target.value.toUpperCase() })}
                    placeholder="F3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Atajo para CONGELAR</label>
                  <input
                    className="form-input"
                    value={tempShortcuts.freeze}
                    onChange={(e) => setTempShortcuts({ ...tempShortcuts, freeze: e.target.value.toUpperCase() })}
                    placeholder="F4"
                  />
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={tempShortcuts.enableGlobalFShortcuts}
                    onChange={(e) =>
                      setTempShortcuts({
                        ...tempShortcuts,
                        enableGlobalFShortcuts: e.target.checked
                      })
                    }
                  />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                    Activar atajos globales para teclas F (F1 - F12)
                  </span>
                </label>
              </div>

              {tempShortcuts.enableGlobalFShortcuts && (
                <div className="warning-callout">
                  ⚠️ <strong>ADVERTENCIA:</strong> Al activar los atajos globales, las teclas de función (F1 a F12)
                  actuarán en ChurchPresenter incluso si la aplicación está en segundo plano o minimizada.
                  No se permite el uso de modificadores (Ctrl, Alt, Shift) para evitar conflictos con otras aplicaciones.
                </div>
              )}

              <hr style={{ borderColor: '#2f3646', margin: '8px 0' }} />

              <div style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>
                Copias de Seguridad y Base de Datos
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                Las copias de seguridad automáticas se rotan en disco (máximo 10). En caso de corrupción,
                el sistema restaura automáticamente la copia más reciente.
              </div>

              <div>
                <button className="btn-secondary" onClick={handleOpenBackups}>
                  <FolderOpen size={16} />
                  Abrir carpeta de copias de seguridad
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button className="btn-secondary" onClick={() => setIsSettingsOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn-secondary"
                style={{ background: '#2563eb', borderColor: '#3b82f6', color: '#ffffff' }}
                onClick={handleSaveSettings}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discreet Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
