import React from 'react'
import {
  Search,
  Type,
  Palette,
  ShieldCheck,
  Tv,
  BookOpen,
  Edit3,
  Sliders,
  Monitor,
  MessageSquare,
  Smartphone,
  Activity,
  RotateCcw,
  Radio
} from 'lucide-react'
import { PresenterState, DisplayInfo, RoleAssignment, RemoteServerStatus, SystemMetrics, LoopStatus, BroadcastStatus } from '../../../shared/types'

interface ProToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeMode: 'show' | 'edit' | 'bible' | 'youtube' | 'more' | 'broadcast'
  onModeChange: (mode: 'show' | 'edit' | 'bible' | 'youtube' | 'more' | 'broadcast') => void
  onAddTextSlide: () => void
  onOpenThemeModal: () => void
  onOpenMessageModal?: () => void
  onOpenChecklistModal?: () => void
  onOpenOutputHealthModal?: () => void
  isRehearsalActive?: boolean
  onToggleRehearsal?: () => void
  isEmergencyActive?: boolean
  onToggleEmergency?: () => void
  systemMetrics?: SystemMetrics | null
  broadcastStatus?: BroadcastStatus | null
  state: PresenterState | null
  displays: DisplayInfo[]
  assignments: RoleAssignment
  shortcuts: {
    black: string
    clear: string
    logo: string
    freeze: string
    [key: string]: any
  }
  panelLabels?: {
    library: string
    playlist: string
    media: string
    audience: string
    stage: string
    lobby?: string
  }
  isMediaDrawerOpen?: boolean
  onToggleMediaDrawer?: () => void
  onOpenOutputPreviewOrSettings?: (role: string) => void
  onOpenDisplaysModal?: () => void
  remoteStatus?: RemoteServerStatus | null
  onOpenRemoteSettings?: () => void
  loopStatus?: LoopStatus | null
  onStopLoop?: () => void
}

export const ProToolbar: React.FC<ProToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeMode,
  onModeChange,
  onAddTextSlide,
  onOpenThemeModal,
  onOpenMessageModal,
  onOpenChecklistModal,
  onOpenOutputHealthModal,
  isRehearsalActive,
  onToggleRehearsal,
  isEmergencyActive,
  onToggleEmergency,
  systemMetrics,
  broadcastStatus,
  state,
  displays,
  assignments,
  shortcuts,
  panelLabels,
  isMediaDrawerOpen,
  onToggleMediaDrawer,
  onOpenOutputPreviewOrSettings,
  onOpenDisplaysModal,
  remoteStatus,
  onOpenRemoteSettings,
  loopStatus,
  onStopLoop
}) => {
  const isMainAssigned = Boolean(assignments.main)
  const isMainConnected =
    isMainAssigned &&
    displays.some((d) => d.stableId === assignments.main || String(d.id) === assignments.main)
  const audienceStatusClass = !isMainAssigned
    ? 'unassigned'
    : isMainConnected
    ? 'connected'
    : 'disconnected'

  const isStageAssigned = Boolean(assignments.stage)
  const isStageConnected =
    isStageAssigned &&
    displays.some((d) => d.stableId === assignments.stage || String(d.id) === assignments.stage)
  const stageStatusClass = !isStageAssigned
    ? 'unassigned'
    : isStageConnected
    ? 'connected'
    : 'disconnected'

  const isLobbyAssigned = Boolean(assignments.lobby)
  const isLobbyConnected =
    isLobbyAssigned &&
    displays.some((d) => d.stableId === assignments.lobby || String(d.id) === assignments.lobby)
  const lobbyStatusClass = !isLobbyAssigned
    ? 'unassigned'
    : isLobbyConnected
    ? 'connected'
    : 'disconnected'

  const isMediaActive = Boolean(state?.currentSlide?.mediaUrl || state?.mediaSyncTick?.isPlaying)

  return (
    <div className="pro-toolbar">
      {/* Left: Tools & Modes Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Quick Creation Buttons: Texto, Tema, Pantallas */}
        <div className="pro-toolbar-tools">
          <button className="pro-tool-btn" onClick={onAddTextSlide} title="Agregar diapositiva de texto">
            <Type size={13} />
            <span>Texto</span>
          </button>
          <button className="pro-tool-btn" onClick={onOpenThemeModal} title="Configuración de Tema y Estilos">
            <Palette size={13} />
            <span>Tema</span>
          </button>
          <button className="pro-tool-btn" onClick={onOpenDisplaysModal} title="Configurar asignación de pantallas físicas y roles de salida">
            <Monitor size={13} />
            <span>Pantallas</span>
          </button>
        </div>

        {/* Subtle Separator */}
        <div className="pro-toolbar-divider" />

        {/* Center: Mode Switcher [Mostrar, Editar, Biblia, Más...] */}
        <div className="pro-mode-segmented-control">
          <button
            className={`pro-mode-btn ${activeMode === 'show' ? 'active' : ''}`}
            onClick={() => onModeChange('show')}
            title="Modo Mostrar / Presentación"
          >
            <Tv size={13} />
            <span>Mostrar</span>
          </button>
          <button
            className={`pro-mode-btn ${activeMode === 'edit' ? 'active' : ''}`}
            onClick={() => onModeChange('edit')}
            title="Modo Editor de Diapositivas"
          >
            <Edit3 size={13} />
            <span>Editar</span>
          </button>
          <button
            className={`pro-mode-btn ${activeMode === 'bible' ? 'active' : ''}`}
            onClick={() => onModeChange('bible')}
            title="Modo Biblia y Pasajes"
          >
            <BookOpen size={13} />
            <span>Biblia</span>
          </button>
          <button
            className={`pro-mode-btn ${activeMode === 'youtube' ? 'active pro-mode-yt' : ''}`}
            onClick={() => onModeChange('youtube')}
            title="Navegador y Proyector de YouTube"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={activeMode === 'youtube' ? '#FF7A00' : 'currentColor'}>
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span>YouTube</span>
          </button>
          <button
            className={`pro-mode-btn ${activeMode === 'broadcast' ? 'active pro-mode-broadcast' : ''}`}
            onClick={() => onModeChange('broadcast')}
            title="Estudio de Transmisión en Vivo, Grabación y Mezclador"
          >
            <Radio size={13} color={activeMode === 'broadcast' ? '#FF7A00' : 'currentColor'} />
            <span>Transmisión</span>
          </button>
          <button
            className={`pro-mode-btn ${activeMode === 'more' ? 'active' : ''}`}
            onClick={() => onModeChange('more')}
            title="Configuración y Más Herramientas"
          >
            <Sliders size={13} />
            <span>Más</span>
          </button>
        </div>

        {/* Compact Search box for Library (preserves search functionality) */}
        {searchQuery ? (
          <div className="pro-toolbar-search-box" style={{ marginLeft: 6 }}>
            <Search size={12} className="pro-search-icon" />
            <input
              type="text"
              className="pro-search-input"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
            <button className="pro-search-clear" onClick={() => onSearchChange('')}>
              ✕
            </button>
          </div>
        ) : null}
      </div>

      {/* Right: Chips + Divider + Global Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Screen Status Buttons & Chips */}
        <div className="pro-screen-status-pills">
          <button
            type="button"
            className={`pro-status-pill-btn ${audienceStatusClass}`}
            onClick={() => {
              if (!isMainAssigned && onOpenDisplaysModal) {
                onOpenDisplaysModal()
              } else {
                onOpenOutputPreviewOrSettings?.('main')
              }
            }}
            title={
              !isMainAssigned
                ? 'Audiencia: No asignado (clic para configurar pantallas)'
                : isMainConnected
                ? 'Audiencia: Asignado y conectado (clic para vista previa)'
                : 'Audiencia: Asignado pero desconectado (clic para configurar)'
            }
          >
            <span className="pro-status-dot" />
            <span>Audiencia</span>
          </button>
          <button
            type="button"
            className={`pro-status-pill-btn ${stageStatusClass}`}
            onClick={() => {
              if (!isStageAssigned && onOpenDisplaysModal) {
                onOpenDisplaysModal()
              } else {
                onOpenOutputPreviewOrSettings?.('stage')
              }
            }}
            title={
              !isStageAssigned
                ? 'Escenario: No asignado (clic para configurar pantallas)'
                : isStageConnected
                ? 'Escenario: Asignado y conectado (clic para vista previa)'
                : 'Escenario: Asignado pero desconectado (clic para configurar)'
            }
          >
            <span className="pro-status-dot" />
            <span>Escenario</span>
          </button>
          <button
            type="button"
            className={`pro-status-pill-btn ${lobbyStatusClass}`}
            onClick={() => {
              if (!isLobbyAssigned && onOpenDisplaysModal) {
                onOpenDisplaysModal()
              } else {
                onOpenOutputPreviewOrSettings?.('lobby')
              }
            }}
            title={
              !isLobbyAssigned
                ? 'Vestíbulo: No asignado (clic para configurar pantallas)'
                : isLobbyConnected
                ? 'Vestíbulo: Asignado y conectado (clic para vista previa)'
                : 'Vestíbulo: Asignado pero desconectado (clic para configurar)'
            }
          >
            <span className="pro-status-dot" />
            <span>Vestíbulo</span>
          </button>

          {/* Live Stream / Recording Status Pill */}
          {(broadcastStatus?.isStreaming || broadcastStatus?.isRecording) && (
            <button
              type="button"
              className="pro-status-pill-btn pro-live-pill"
              onClick={() => onModeChange('broadcast')}
              title="Transmisión o Grabación en curso. Clic para ir al Estudio."
            >
              <span className="pro-status-dot dot-red" />
              <span>EN VIVO</span>
            </button>
          )}

          {/* Remote Server Active Status Pill */}
          {remoteStatus?.running && (
            <button
              type="button"
              className="pro-status-pill-btn"
              onClick={onOpenRemoteSettings}
              title={`Control Remoto Activo en puerto ${remoteStatus.port} (${remoteStatus.connectedClients?.length || 0} dispositivos conectados).`}
              style={{
                borderColor: 'rgba(34, 197, 94, 0.45)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                color: '#4ade80'
              }}
            >
              <span className="pro-status-dot dot-green" />
              <Smartphone size={11} style={{ marginRight: 2 }} />
              <span>Remoto: {remoteStatus.connectedClients?.length || 0}</span>
            </button>
          )}

          {/* Loop Status Badge */}
          {loopStatus?.isActive && (
            <button
              type="button"
              className="pro-status-pill-btn"
              onClick={onStopLoop}
              title="Presentación en bucle automático activa. Clic para detener."
              style={{
                borderColor: 'rgba(56, 189, 248, 0.4)',
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8'
              }}
            >
              <RotateCcw size={11} />
              <span>Bucle ({loopStatus.nextAdvanceInSeconds}s)</span>
            </button>
          )}

          {/* Rehearsal Mode Badge (Visible only when actively running rehearsal) */}
          {isRehearsalActive && (
            <button
              type="button"
              className="pro-status-pill-btn"
              onClick={onToggleRehearsal}
              title="MODO ENSAYO ACTIVO: Clic para finalizar y ver resumen"
              style={{
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                color: '#f97316',
                fontWeight: 700
              }}
            >
              <span className="pro-status-dot dot-orange" />
              <span>ENSAYO ACTIVO</span>
            </button>
          )}

          {/* Output Health Button & Real-time System Metrics */}
          <button
            type="button"
            className="pro-status-pill-btn pro-cpu-pill"
            onClick={onOpenOutputHealthModal}
            title={
              systemMetrics
                ? `CPU: ${systemMetrics.cpuPercent.toFixed(0)}% | RAM: ${systemMetrics.memory.percentUsed.toFixed(0)}% | Disco: ${systemMetrics.disk.freeGb.toFixed(1)} GB libres`
                : 'Ver salud y rendimiento de salidas (FPS, memoria, incidentes)'
            }
          >
            <Activity size={12} color="#38bdf8" />
            <span>{systemMetrics ? `CPU ${systemMetrics.cpuPercent.toFixed(0)}%` : 'CPU'}</span>
          </button>
        </div>

        {/* Subtle Separator */}
        <div className="pro-toolbar-divider" />

        {/* Right: Acciones Globales: Logo y Mensaje */}
        <div className="pro-global-actions">
          <button
            className={`pro-action-btn ${state?.controls.logo ? 'active-logo' : ''}`}
            onClick={() => window.churchPresenterApi?.toggleGlobalControl('logo')}
            title={`Logo (${shortcuts.logo})`}
          >
            <ShieldCheck size={14} />
            <span>Logo</span>
          </button>
          <button
            type="button"
            className={`pro-action-btn pro-action-btn-message ${state?.activeMessage ? 'active-message' : ''}`}
            onClick={onOpenMessageModal}
            title="Editar y Proyectar Mensaje en Pantallas"
          >
            <MessageSquare size={14} />
            <span>Mensaje</span>
            {state?.activeMessage && (
              <span className="pro-message-live-indicator" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
