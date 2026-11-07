import React, { useState, useRef, useEffect } from 'react'
import appLogo from '../../assets/icon.png'

interface TopMenuBarProps {
  onNewService: () => void
  onImportPpt: () => void
  onImportMedia: () => void
  onImportFolder: () => void
  onImportLibrary?: () => void
  onExportService: () => void
  onOpenSettings: () => void
  onLoadDemoData: () => void
  onClearDemoData: () => void
  onToggleMediaDrawer: () => void
  onIdentifyDisplays: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onToggleViewMode: () => void
  onOpenShortcutsHelp: () => void
  onResetLayout?: () => void
  onToggleLeftPanel?: () => void
  onToggleRightPanel?: () => void
  onOpenFloatingPreview?: () => void
  onOpenDisplaysModal?: () => void
  onOpenThemeModal?: () => void
  onOpenChecklistModal?: () => void
  onOpenOutputHealthModal?: () => void
  onOpenDiagnosticsModal?: () => void
  onUndo?: () => void
  onRedo?: () => void
  onOpenSongImport?: () => void
  onOpenLibrarySync?: () => void
  onOpenSongUsage?: () => void
  onOpenSubtitles?: () => void
  onOpenAiAssistant?: () => void
  onOpenSecondaryBackup?: () => void
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  onNewService,
  onImportPpt,
  onImportMedia,
  onImportFolder,
  onImportLibrary,
  onExportService,
  onOpenSettings,
  onLoadDemoData,
  onClearDemoData,
  onToggleMediaDrawer,
  onIdentifyDisplays,
  onZoomIn,
  onZoomOut,
  onToggleViewMode,
  onOpenShortcutsHelp,
  onResetLayout,
  onToggleLeftPanel,
  onToggleRightPanel,
  onOpenFloatingPreview,
  onOpenDisplaysModal,
  onOpenThemeModal,
  onOpenChecklistModal,
  onOpenOutputHealthModal,
  onOpenDiagnosticsModal,
  onUndo,
  onRedo,
  onOpenSongImport,
  onOpenLibrarySync,
  onOpenSongUsage,
  onOpenSubtitles,
  onOpenAiAssistant,
  onOpenSecondaryBackup
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const menuBarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName)
  }

  const handleMouseEnter = (menuName: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menuName)
    }
  }

  const closeMenu = () => setActiveMenu(null)

  return (
    <div className="pro-top-menubar" ref={menuBarRef}>
      <div className="pro-menu-left">
        <img
          src={appLogo}
          alt="ChurchPresenter"
          title="ChurchPresenter v1.2"
          style={{ width: 18, height: 18, borderRadius: 4, marginRight: 8, display: 'inline-block', verticalAlign: 'middle', objectFit: 'contain' }}
        />

        {/* Archivo */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'file' ? 'active' : ''}`}
            onClick={() => handleMenuClick('file')}
            onMouseEnter={() => handleMouseEnter('file')}
          >
            Archivo
          </button>
          {activeMenu === 'file' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onNewService()
                }}
              >
                <span>Nuevo Servicio</span>
                <span className="pro-dropdown-shortcut">Ctrl+N</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onImportPpt()
                }}
              >
                <span>Importar PowerPoint (.pptx)...</span>
                <span className="pro-dropdown-shortcut">Ctrl+O</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onImportMedia()
                }}
              >
                <span>Importar Medios (Video/Audio/Imagen/PDF)...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onImportFolder()
                }}
              >
                <span>Importar Carpeta de Medios...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSongImport?.()
                }}
              >
                <span>Importar Canciones (Texto, ChordPro, CSV, OpenLyrics, Pro6)...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onImportLibrary?.()
                }}
              >
                <span>Importar Paquete de Biblioteca (.cpr)...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  window.churchPresenterApi?.openWorkspaceFolder?.()
                }}
              >
                <span>Abrir Carpeta de Medios y Biblioteca en el Explorador...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={async () => {
                  closeMenu()
                  const res = await window.churchPresenterApi?.chooseWorkspaceFolder?.()
                  if (res) {
                    alert(`Carpeta principal actualizada a:\n${res.rootPath}\n\nSe han creado las carpetas de las secciones automáticamente.`)
                  }
                }}
              >
                <span>Cambiar Ubicación de Carpeta de Biblioteca...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSettings()
                }}
              >
                <span>Identidad de la Iglesia (Logo y Fondo)...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenLibrarySync?.()
                }}
              >
                <span>Sincronización de Biblioteca entre Computadoras...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSecondaryBackup?.()
                }}
              >
                <span>Copia de Seguridad Secundaria (USB / Disco externo)...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onExportService()
                }}
              >
                <span>Exportar Servicio / Biblioteca...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onLoadDemoData()
                }}
              >
                <span>Cargar Datos de Demostración</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onClearDemoData()
                }}
              >
                <span>Borrar Datos de Demostración</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSettings()
                }}
              >
                <span>Configuración y Preferencias...</span>
                <span className="pro-dropdown-shortcut">Ctrl+,</span>
              </button>
            </div>
          )}
        </div>

        {/* Editar */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'edit' ? 'active' : ''}`}
            onClick={() => handleMenuClick('edit')}
            onMouseEnter={() => handleMouseEnter('edit')}
          >
            Editar
          </button>
          {activeMenu === 'edit' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  if (onUndo) onUndo()
                  else alert('Deshacer está disponible al editar canciones en el Editor (Ctrl+Z)')
                }}
                title="Deshacer última acción"
              >
                <span>Deshacer</span>
                <span className="pro-dropdown-shortcut">Ctrl+Z</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  if (onRedo) onRedo()
                  else alert('Rehacer está disponible al editar canciones en el Editor (Ctrl+Y)')
                }}
                title="Rehacer última acción"
              >
                <span>Rehacer</span>
                <span className="pro-dropdown-shortcut">Ctrl+Y</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  window.churchPresenterApi?.toggleGlobalControl('clear')
                }}
              >
                <span>Limpiar Diapositiva Actual</span>
                <span className="pro-dropdown-shortcut">F2</span>
              </button>
            </div>
          )}
        </div>

        {/* Presentación */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'pres' ? 'active' : ''}`}
            onClick={() => handleMenuClick('pres')}
            onMouseEnter={() => handleMouseEnter('pres')}
          >
            Presentación
          </button>
          {activeMenu === 'pres' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  window.churchPresenterApi?.toggleGlobalControl('black')
                }}
              >
                <span>Negro Total</span>
                <span className="pro-dropdown-shortcut">F1</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  window.churchPresenterApi?.toggleGlobalControl('logo')
                }}
              >
                <span>Logo de Iglesia</span>
                <span className="pro-dropdown-shortcut">F3</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSettings()
                }}
              >
                <span>Configurar Logo y Fondo de la Iglesia...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  window.churchPresenterApi?.toggleGlobalControl('freeze')
                }}
              >
                <span>Congelar Pantalla</span>
                <span className="pro-dropdown-shortcut">F4</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  if (onOpenThemeModal) onOpenThemeModal()
                }}
              >
                <span>Gestión de Temas y Tipografía...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSubtitles?.()
                }}
              >
                <span>Subtítulos y Traducción en Vivo...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSongUsage?.()
                }}
              >
                <span>Reporte de Uso de Canciones (CCLI)...</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenAiAssistant?.()
                }}
              >
                <span>Asistente de Contenido y Diapositivas (IA)...</span>
              </button>
            </div>
          )}
        </div>

        {/* Pantallas */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'screens' ? 'active' : ''}`}
            onClick={() => handleMenuClick('screens')}
            onMouseEnter={() => handleMouseEnter('screens')}
          >
            Pantallas
          </button>
          {activeMenu === 'screens' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onIdentifyDisplays()
                }}
              >
                <span>Identificar Pantallas Físicas</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  if (onOpenDisplaysModal) {
                    onOpenDisplaysModal()
                  } else {
                    onOpenSettings()
                  }
                }}
              >
                <span>Configurar Asignación de Roles...</span>
              </button>
            </div>
          )}
        </div>

        {/* Ver */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'view' ? 'active' : ''}`}
            onClick={() => handleMenuClick('view')}
            onMouseEnter={() => handleMouseEnter('view')}
          >
            Ver
          </button>
          {activeMenu === 'view' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onToggleViewMode()
                }}
              >
                <span>Alternar Cuadrícula / Lista</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onZoomIn()
                }}
              >
                <span>Aumentar Zoom Miniaturas</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onZoomOut()
                }}
              >
                <span>Disminuir Zoom Miniaturas</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onToggleMediaDrawer()
                }}
              >
                <span>Mostrar/Ocultar Panel de Medios</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onResetLayout?.()
                }}
              >
                <span><strong>Restablecer diseño</strong></span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onToggleLeftPanel?.()
                }}
              >
                <span>Colapsar/Expandir panel izquierdo</span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onToggleRightPanel?.()
                }}
              >
                <span>Colapsar/Expandir panel derecho</span>
              </button>
            </div>
          )}
        </div>

        {/* Ventana */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'window' ? 'active' : ''}`}
            onClick={() => handleMenuClick('window')}
            onMouseEnter={() => handleMouseEnter('window')}
          >
            Ventana
          </button>
          {activeMenu === 'window' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenFloatingPreview?.()
                }}
              >
                <span><strong>Abrir Vista Previa Flotante...</strong></span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenOutputHealthModal?.()
                }}
              >
                <span>Salud y Rendimiento de Salidas...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenSettings()
                }}
              >
                <span>Configurar Pantallas y Salidas...</span>
              </button>
            </div>
          )}
        </div>

        {/* Ayuda */}
        <div className="pro-menu-item-wrapper">
          <button
            className={`pro-menu-trigger ${activeMenu === 'help' ? 'active' : ''}`}
            onClick={() => handleMenuClick('help')}
            onMouseEnter={() => handleMouseEnter('help')}
          >
            Ayuda
          </button>
          {activeMenu === 'help' && (
            <div className="pro-dropdown-menu">
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenChecklistModal?.()
                }}
              >
                <span><strong>Verificar Servicio Previo al Culto...</strong></span>
              </button>
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenDiagnosticsModal?.()
                }}
              >
                <span>Visor de Registros y Diagnóstico...</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  onOpenShortcutsHelp()
                }}
              >
                <span>Atajos de Teclado</span>
              </button>
              <div className="pro-dropdown-divider" />
              <button
                className="pro-dropdown-item"
                onClick={() => {
                  closeMenu()
                  alert('ChurchPresenter - Software Profesional de Presentación para Iglesias\nVersión 1.1.0 (Fase 7: Estabilidad y Operación Segura)')
                }}
              >
                <span>Acerca de ChurchPresenter</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="pro-menu-right">
        <span className="pro-menu-title-tag">ChurchPresenter</span>
      </div>
    </div>
  )
}
