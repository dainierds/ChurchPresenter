import React from 'react'
import {
  Search,
  Type,
  Palette,
  Eye,
  Slash,
  ShieldCheck,
  Snowflake,
  Tv,
  BookOpen,
  Edit3,
  Sliders
} from 'lucide-react'
import { PresenterState, DisplayInfo, RoleAssignment } from '../../../shared/types'

interface ProToolbarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  activeMode: 'show' | 'edit' | 'bible' | 'youtube' | 'more'
  onModeChange: (mode: 'show' | 'edit' | 'bible' | 'youtube' | 'more') => void
  onAddTextSlide: () => void
  onOpenThemeModal: () => void
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
  }
  isMediaDrawerOpen?: boolean
  onToggleMediaDrawer?: () => void
  onOpenOutputPreviewOrSettings?: (role: string) => void
}

export const ProToolbar: React.FC<ProToolbarProps> = ({
  searchQuery,
  onSearchChange,
  activeMode,
  onModeChange,
  onAddTextSlide,
  onOpenThemeModal,
  state,
  displays,
  assignments,
  shortcuts,
  panelLabels,
  isMediaDrawerOpen,
  onToggleMediaDrawer,
  onOpenOutputPreviewOrSettings
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

  const isMediaActive = Boolean(state?.currentSlide?.mediaUrl || state?.mediaSyncTick?.isPlaying)

  return (
    <div className="pro-toolbar">
      {/* Left: Quick Search */}
      <div className="pro-toolbar-search-box">
        <Search size={14} className="pro-search-icon" />
        <input
          type="text"
          className="pro-search-input"
          placeholder="Buscar en biblioteca..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="pro-search-clear" onClick={() => onSearchChange('')}>
            ✕
          </button>
        )}
      </div>

      {/* Quick Creation Buttons: Texto, Tema */}
      <div className="pro-toolbar-tools">
        <button className="pro-tool-btn" onClick={onAddTextSlide} title="Agregar diapositiva de texto">
          <Type size={14} />
          <span>Texto</span>
        </button>
        <button className="pro-tool-btn" onClick={onOpenThemeModal} title="Configuración de Tema y Estilos">
          <Palette size={14} />
          <span>Tema</span>
        </button>
      </div>

      {/* Center: Mode Switcher [Mostrar, Editar, Biblia, Más...] */}
      <div className="pro-mode-segmented-control">
        <button
          className={`pro-mode-btn ${activeMode === 'show' ? 'active' : ''}`}
          onClick={() => onModeChange('show')}
          title="Modo Mostrar / Presentación"
        >
          <Tv size={14} />
          <span>Mostrar</span>
        </button>
        <button
          className={`pro-mode-btn ${activeMode === 'edit' ? 'active' : ''}`}
          onClick={() => onModeChange('edit')}
          title="Modo Editor de Diapositivas"
        >
          <Edit3 size={14} />
          <span>Editar</span>
        </button>
        <button
          className={`pro-mode-btn ${activeMode === 'bible' ? 'active' : ''}`}
          onClick={() => onModeChange('bible')}
          title="Modo Biblia y Pasajes"
        >
          <BookOpen size={14} />
          <span>Biblia</span>
        </button>
        <button
          className={`pro-mode-btn ${activeMode === 'youtube' ? 'active pro-mode-yt' : ''}`}
          onClick={() => onModeChange('youtube')}
          title="Navegador y Proyector de YouTube"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={activeMode === 'youtube' ? '#ef4444' : 'currentColor'}>
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span>YouTube</span>
        </button>
        <button
          className={`pro-mode-btn ${activeMode === 'more' ? 'active' : ''}`}
          onClick={() => onModeChange('more')}
          title="Configuración y Más Herramientas"
        >
          <Sliders size={14} />
          <span>Más</span>
        </button>
      </div>

      {/* Screen Status Pills & Media Drawer Button */}
      <div className="pro-screen-status-pills">
        <button
          className={`pro-status-pill-btn ${isMediaDrawerOpen ? 'drawer-open' : ''} ${isMediaActive ? 'online' : 'idle'}`}
          onClick={onToggleMediaDrawer}
          title="Abrir o cerrar el cajón inferior de medios"
        >
          <span className={`pro-status-dot ${isMediaActive ? 'dot-active' : 'dot-idle'}`} />
          <span>{panelLabels?.media || 'Media'}</span>
        </button>
        <button
          className={`pro-status-pill-btn ${audienceStatusClass}`}
          onClick={() => onOpenOutputPreviewOrSettings?.('main')}
          title={
            !isMainAssigned
              ? 'Audiencia: No asignado (clic para configurar pantallas)'
              : isMainConnected
              ? 'Audiencia: Asignado y conectado (clic para vista previa)'
              : 'Audiencia: Asignado pero desconectado (clic para configurar)'
          }
        >
          <span className={`pro-status-dot dot-${audienceStatusClass}`} />
          <span>{panelLabels?.audience || 'Audience'}</span>
        </button>
        <button
          className={`pro-status-pill-btn ${stageStatusClass}`}
          onClick={() => onOpenOutputPreviewOrSettings?.('stage')}
          title={
            !isStageAssigned
              ? 'Escenario: No asignado (clic para configurar pantallas)'
              : isStageConnected
              ? 'Escenario: Asignado y conectado (clic para vista previa)'
              : 'Escenario: Asignado pero desconectado (clic para configurar)'
          }
        >
          <span className={`pro-status-dot dot-${stageStatusClass}`} />
          <span>{panelLabels?.stage || 'Stage'}</span>
        </button>
      </div>

      {/* Right: Global Emergency Actions (F1 - F4) */}
      <div className="pro-global-actions">
        <button
          className={`pro-action-btn ${state?.controls.black ? 'active-black' : ''}`}
          onClick={() => window.churchPresenterApi?.toggleGlobalControl('black')}
          title={`Negro (${shortcuts.black})`}
        >
          <Slash size={14} />
          <span>Negro</span>
        </button>
        <button
          className={`pro-action-btn ${state?.controls.clear ? 'active-clear' : ''}`}
          onClick={() => window.churchPresenterApi?.toggleGlobalControl('clear')}
          title={`Limpiar (${shortcuts.clear})`}
        >
          <Eye size={14} />
          <span>Limpiar</span>
        </button>
        <button
          className={`pro-action-btn ${state?.controls.logo ? 'active-logo' : ''}`}
          onClick={() => window.churchPresenterApi?.toggleGlobalControl('logo')}
          title={`Logo (${shortcuts.logo})`}
        >
          <ShieldCheck size={14} />
          <span>Logo</span>
        </button>
        <button
          className={`pro-action-btn ${state?.controls.freeze ? 'active-freeze' : ''}`}
          onClick={() => window.churchPresenterApi?.toggleGlobalControl('freeze')}
          title={`Congelar (${shortcuts.freeze})`}
        >
          <Snowflake size={14} />
          <span>Congelar</span>
        </button>
      </div>
    </div>
  )
}
