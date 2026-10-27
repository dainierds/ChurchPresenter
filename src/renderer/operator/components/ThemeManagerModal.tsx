import React, { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Download,
  Upload,
  Check,
  Type,
  Maximize2,
  Layers,
  Image as ImageIcon,
  Sparkles,
  HelpCircle,
  Sliders
} from 'lucide-react'
import {
  ThemeConfig,
  ThemeContentType,
  TypeDefaultThemesMap,
  CustomFontItem,
  DEFAULT_THEME,
  BackgroundImageItem
} from '../../../shared/types'

interface ThemeManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onThemeSaved?: (theme: ThemeConfig) => void
}

const CONTENT_TYPES: { key: ThemeContentType; label: string }[] = [
  { key: 'songs', label: 'Canciones' },
  { key: 'bible', label: 'Biblia' },
  { key: 'announcements', label: 'Anuncios' },
  { key: 'messages', label: 'Mensajes' },
  { key: 'timer', label: 'Temporizador' }
]

const STANDARD_FONTS = [
  'Inter, system-ui, sans-serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  'Impact, Charcoal, sans-serif',
  'Consolas, monospace',
  'Times New Roman, serif',
  'Verdana, Geneva, sans-serif'
]

export const ThemeManagerModal: React.FC<ThemeManagerModalProps> = ({
  isOpen,
  onClose,
  onThemeSaved
}) => {
  const [themes, setThemes] = useState<ThemeConfig[]>([])
  const [selectedThemeId, setSelectedThemeId] = useState<string>('')
  const [editedTheme, setEditedTheme] = useState<ThemeConfig | null>(null)
  const [typeDefaults, setTypeDefaults] = useState<TypeDefaultThemesMap>({
    songs: 'theme-factory-songs-dark',
    bible: 'theme-factory-bible-classic',
    announcements: 'theme-factory-announce-warm',
    messages: 'theme-factory-msg-amber',
    timer: 'theme-factory-timer-neon'
  })
  const [customFonts, setCustomFonts] = useState<CustomFontItem[]>([])
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImageItem[]>([])

  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activePropertyTab, setActivePropertyTab] = useState<'text' | 'effects' | 'background' | 'specific' | 'watermark' | 'fonts' | 'defaults'>('text')
  const [previewRole, setPreviewRole] = useState<'audience' | 'stage'>('audience')
  const [previewContentType, setPreviewContentType] = useState<ThemeContentType>('songs')
  const [showSafeMarginsGuides, setShowSafeMarginsGuides] = useState<boolean>(true)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [includeFontsInExport, setIncludeFontsInExport] = useState<boolean>(false)
  const [isRenaming, setIsRenaming] = useState<boolean>(false)
  const [renameInput, setRenameInput] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      loadInitialData()
    }
  }, [isOpen])

  const loadInitialData = async () => {
    try {
      const [allThemes, defaults, fonts, bgs] = await Promise.all([
        window.churchPresenterApi.getThemes(),
        window.churchPresenterApi.getTypeDefaultThemes(),
        window.churchPresenterApi.getCustomFonts(),
        window.churchPresenterApi.getBackgroundImages()
      ])
      setThemes(allThemes)
      setTypeDefaults(defaults)
      setCustomFonts(fonts || [])
      setBackgroundImages(bgs || [])

      if (allThemes.length > 0) {
        const initial = allThemes.find((t) => t.isDefault) || allThemes[0]
        setSelectedThemeId(initial.id)
        setEditedTheme(JSON.parse(JSON.stringify(initial)))
      }
    } catch (err) {
      console.error('Error loading themes data:', err)
    }
  }

  const handleSelectTheme = (theme: ThemeConfig) => {
    setSelectedThemeId(theme.id)
    setEditedTheme(JSON.parse(JSON.stringify(theme)))
    setIsRenaming(false)
  }

  const handleCreateNewTheme = async () => {
    const newId = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newTheme: ThemeConfig = {
      ...DEFAULT_THEME,
      id: newId,
      name: `Nuevo Tema (${themes.length + 1})`,
      isDefault: false,
      isBuiltIn: false,
      targetContentType: activeFilter !== 'all' ? (activeFilter as ThemeContentType) : 'songs'
    }

    try {
      const saved = await window.churchPresenterApi.saveTheme(newTheme)
      const updated = await window.churchPresenterApi.getThemes()
      setThemes(updated)
      setSelectedThemeId(saved.id)
      setEditedTheme(JSON.parse(JSON.stringify(saved)))
      setStatusMessage({ text: `Tema '${saved.name}' creado exitosamente.`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al crear tema.', type: 'error' })
    }
  }

  const handleDuplicateTheme = async () => {
    if (!editedTheme) return
    try {
      const duplicated = await window.churchPresenterApi.duplicateTheme(editedTheme.id)
      const updated = await window.churchPresenterApi.getThemes()
      setThemes(updated)
      setSelectedThemeId(duplicated.id)
      setEditedTheme(JSON.parse(JSON.stringify(duplicated)))
      setStatusMessage({ text: `Tema duplicado como '${duplicated.name}'.`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al duplicar tema.', type: 'error' })
    }
  }

  const handleDeleteTheme = async () => {
    if (!editedTheme) return
    if (editedTheme.isBuiltIn) {
      setStatusMessage({ text: 'Los temas de fábrica no pueden ser eliminados.', type: 'warn' })
      return
    }

    if (!confirm(`¿Eliminar definitivamente el tema '${editedTheme.name}'?\nLos elementos asignados usarán el tema predeterminado.`)) {
      return
    }

    try {
      const res = await window.churchPresenterApi.deleteTheme(editedTheme.id)
      const [updatedThemes, updatedDefaults] = await Promise.all([
        window.churchPresenterApi.getThemes(),
        window.churchPresenterApi.getTypeDefaultThemes()
      ])
      setThemes(updatedThemes)
      setTypeDefaults(updatedDefaults)

      const fallback = updatedThemes[0] || DEFAULT_THEME
      setSelectedThemeId(fallback.id)
      setEditedTheme(JSON.parse(JSON.stringify(fallback)))

      setStatusMessage({
        text: `Tema eliminado. Se reasignaron ${res.reassignedCount} elementos.`,
        type: 'success'
      })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al eliminar tema.', type: 'error' })
    }
  }

  const handleRenameTheme = async () => {
    if (!editedTheme || !renameInput.trim()) return
    const updated = { ...editedTheme, name: renameInput.trim() }
    try {
      const saved = await window.churchPresenterApi.saveTheme(updated)
      const all = await window.churchPresenterApi.getThemes()
      setThemes(all)
      setEditedTheme(saved)
      setIsRenaming(false)
      setStatusMessage({ text: 'Tema renombrado exitosamente.', type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al renombrar.', type: 'error' })
    }
  }

  const handleSaveCurrentTheme = async () => {
    if (!editedTheme) return
    try {
      const saved = await window.churchPresenterApi.saveTheme(editedTheme)
      const all = await window.churchPresenterApi.getThemes()
      setThemes(all)
      setEditedTheme(JSON.parse(JSON.stringify(saved)))
      onThemeSaved?.(saved)
      setStatusMessage({ text: `Cambios guardados en '${saved.name}'.`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al guardar tema.', type: 'error' })
    }
  }

  const handleSetGeneralDefault = async () => {
    if (!editedTheme) return
    try {
      await window.churchPresenterApi.setDefaultTheme(editedTheme.id)
      const all = await window.churchPresenterApi.getThemes()
      setThemes(all)
      const updated = all.find((t) => t.id === editedTheme.id)
      if (updated) setEditedTheme(JSON.parse(JSON.stringify(updated)))
      setStatusMessage({ text: `'${editedTheme.name}' marcado como predeterminado general.`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al definir predeterminado.', type: 'error' })
    }
  }

  const handleSetTypeDefault = async (type: ThemeContentType, themeId: string) => {
    try {
      await window.churchPresenterApi.setTypeDefaultTheme(type, themeId)
      const updatedDefaults = await window.churchPresenterApi.getTypeDefaultThemes()
      setTypeDefaults(updatedDefaults)
      setStatusMessage({ text: `Tema predeterminado para ${type} actualizado.`, type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al actualizar tipo.', type: 'error' })
    }
  }

  const handleExportThemePackage = async () => {
    if (!editedTheme) return
    try {
      const res = await window.churchPresenterApi.exportTheme(editedTheme.id, undefined, includeFontsInExport)
      if (res.success) {
        setStatusMessage({ text: `Tema exportado: ${res.filePath}`, type: 'success' })
        setIsExporting(false)
      } else if (res.error) {
        setStatusMessage({ text: res.error, type: 'warn' })
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error en exportación.', type: 'error' })
    }
  }

  const handleImportThemePackage = async () => {
    try {
      const res = await window.churchPresenterApi.importThemePackage()
      if (res.success && res.theme) {
        const all = await window.churchPresenterApi.getThemes()
        setThemes(all)
        setSelectedThemeId(res.theme.id)
        setEditedTheme(JSON.parse(JSON.stringify(res.theme)))
        let msg = `Tema '${res.theme.name}' importado con éxito.`
        if (res.warnings && res.warnings.length > 0) {
          msg += ` (Aviso: ${res.warnings.join(' ')})`
        }
        setStatusMessage({ text: msg, type: res.warnings?.length ? 'warn' : 'success' })
      } else if (res.error) {
        setStatusMessage({ text: res.error, type: 'error' })
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al importar tema.', type: 'error' })
    }
  }

  const handleUploadCustomFont = async () => {
    try {
      const res = await window.churchPresenterApi.importCustomFont()
      if (res) {
        const fonts = await window.churchPresenterApi.getCustomFonts()
        setCustomFonts(fonts)
        if (editedTheme) {
          setEditedTheme({ ...editedTheme, fontFamily: res.name })
        }
        setStatusMessage({ text: `Fuente tipográfica '${res.name}' registrada.`, type: 'success' })
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al cargar fuente.', type: 'error' })
    }
  }

  const handleDeleteCustomFont = async (fontId: string) => {
    if (!confirm('¿Eliminar esta fuente personalizada?')) return
    try {
      await window.churchPresenterApi.deleteCustomFont(fontId)
      const fonts = await window.churchPresenterApi.getCustomFonts()
      setCustomFonts(fonts)
      setStatusMessage({ text: 'Fuente eliminada.', type: 'success' })
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al eliminar fuente.', type: 'error' })
    }
  }

  const handleUploadBackground = async () => {
    try {
      const res = await window.churchPresenterApi.uploadThemeBackground()
      if (res) {
        const bgs = await window.churchPresenterApi.getBackgroundImages()
        setBackgroundImages(bgs)
        if (editedTheme) {
          const isVideo = res.filePath.match(/\.(mp4|webm|mov)$/i)
          setEditedTheme({
            ...editedTheme,
            background: {
              type: isVideo ? 'video' : 'image',
              value: res.url || res.filePath
            }
          })
        }
        setStatusMessage({ text: `Fondo '${res.name}' cargado exitosamente.`, type: 'success' })
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Error al subir fondo.', type: 'error' })
    }
  }

  // Filtered themes list
  const filteredThemes = themes.filter((t) => {
    if (activeFilter !== 'all' && t.targetContentType && t.targetContentType !== activeFilter && t.targetContentType !== 'all') {
      return false
    }
    if (searchQuery.trim()) {
      return t.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  // Sample text based on content type
  const getSampleText = () => {
    if (previewContentType === 'bible') {
      return {
        title: '',
        body: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
        subtitle: 'Juan 3:16 (RVR1909)'
      }
    }
    if (previewContentType === 'announcements') {
      return {
        title: 'REUNIÓN GENERAL DE JÓVENES',
        body: 'Este sábado a las 18:00 hrs en el auditorio principal.\nInvitamos a toda la congregación a sumarse a este tiempo de alabanza y edificación especial.',
        subtitle: 'Comunidad & Oración'
      }
    }
    if (previewContentType === 'messages') {
      return {
        title: 'AVISO PASTORAL',
        body: 'Favor de mover el vehículo patente AB-1234 que obstruye el acceso principal.',
        subtitle: 'Seguridad'
      }
    }
    if (previewContentType === 'timer') {
      return {
        title: 'TIEMPO RESTANTE DE PREDICACIÓN',
        body: '14:59',
        subtitle: 'En Vivo'
      }
    }
    return {
      title: 'Sublime Gracia',
      body: 'Sublime gracia del Señor\nQue a un pecador salvó;\nFui ciego mas hoy veo yo,\nPerdido y Él me halló.',
      subtitle: '[Verso 1]'
    }
  }

  const sample = getSampleText()

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" style={{ zIndex: 99999 }}>
      <div
        className="modal-content themes-manager-pro theme-manager-modal"
        style={{
          width: '94vw',
          maxWidth: '1420px',
          height: '90vh',
          maxHeight: '920px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#121212',
          border: '1px solid #2e2e2e',
          color: '#f3f4f6',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          borderRadius: '8px'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid #262626',
            backgroundColor: '#181818'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={18} color="#f97316" />
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.4px' }}>
              EDITOR Y GESTIÓN DE TEMAS
            </span>
            <span
              style={{
                fontSize: '11px',
                backgroundColor: '#262626',
                color: '#38bdf8',
                border: '1px solid #333333',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 600
              }}
            >
              Dark UI Pro
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {statusMessage && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color:
                    statusMessage.type === 'success'
                      ? '#22c55e'
                      : statusMessage.type === 'warn'
                        ? '#f97316'
                        : '#ef4444'
                }}
              >
                {statusMessage.text}
              </span>
            )}
            <button
              className="modal-close-btn pro-modal-btn-close"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '4px'
              }}
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body Layout: 3 Columns (Theme List, Live Preview Canvas, Properties Panel) */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Column 1: Theme List & Filters (310px) */}
          <div
            style={{
              width: '320px',
              borderRight: '1px solid #262626',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#161616'
            }}
          >
            {/* Type Filter Pills */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                padding: '8px 10px',
                borderBottom: '1px solid #262626',
                overflowX: 'auto',
                backgroundColor: '#141414'
              }}
            >
              {['all', 'songs', 'bible', 'announcements', 'messages', 'timer'].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: activeFilter === f ? '#f97316' : '#2a2a2a',
                    backgroundColor: activeFilter === f ? '#281a10' : '#1e1e1e',
                    color: activeFilter === f ? '#f97316' : '#9ca3af',
                    cursor: 'pointer',
                    fontWeight: activeFilter === f ? 700 : 500,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f === 'all'
                    ? 'Todos'
                    : f === 'songs'
                      ? 'Canciones'
                      : f === 'bible'
                        ? 'Biblia'
                        : f === 'announcements'
                          ? 'Anuncios'
                          : f === 'messages'
                            ? 'Mensajes'
                            : 'Reloj'}
                </button>
              ))}
            </div>

            {/* Search and Add Action */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid #262626', display: 'flex', gap: '6px' }}>
              <input
                type="text"
                placeholder="Buscar tema..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: '#1e1e1e',
                  border: '1px solid #2a2a2a',
                  color: '#ffffff',
                  fontSize: '12px',
                  padding: '5px 8px',
                  borderRadius: '4px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleCreateNewTheme}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Crear nuevo tema"
              >
                <Plus size={13} />
                <span>Nuevo</span>
              </button>
            </div>

            {/* Themes Scroll List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {filteredThemes.map((th) => {
                const isSelected = th.id === selectedThemeId
                const isGeneralDefault = th.isDefault
                return (
                  <div
                    key={th.id}
                    onClick={() => handleSelectTheme(th)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isSelected ? '#f97316' : '#262626',
                      backgroundColor: isSelected ? '#221a14' : '#1a1a1a',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Thumbnail preview */}
                    <div
                      style={{
                        width: '42px',
                        height: '28px',
                        borderRadius: '3px',
                        background:
                          th.background.type === 'image'
                            ? `url(${th.background.value}) center/cover no-repeat`
                            : th.background.value,
                        border: '1px solid #333333',
                        flexShrink: 0
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: isSelected ? '#ffffff' : '#e5e7eb',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {th.name}
                      </div>

                      <div style={{ display: 'flex', gap: '4px', marginTop: '3px', alignItems: 'center' }}>
                        {isGeneralDefault && (
                          <span
                            style={{
                              fontSize: '9px',
                              backgroundColor: '#15803d',
                              color: '#dcfce7',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              fontWeight: 700
                            }}
                          >
                            Default
                          </span>
                        )}
                        {th.isBuiltIn && (
                          <span
                            style={{
                              fontSize: '9px',
                              backgroundColor: '#262626',
                              color: '#9ca3af',
                              border: '1px solid #383838',
                              padding: '1px 4px',
                              borderRadius: '3px'
                            }}
                          >
                            Fábrica
                          </span>
                        )}
                        {th.targetContentType && th.targetContentType !== 'all' && (
                          <span
                            style={{
                              fontSize: '9px',
                              backgroundColor: '#1e293b',
                              color: '#38bdf8',
                              padding: '1px 4px',
                              borderRadius: '3px'
                            }}
                          >
                            {th.targetContentType}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bottom Actions for List */}
            <div
              style={{
                padding: '10px',
                borderTop: '1px solid #262626',
                display: 'flex',
                gap: '6px',
                backgroundColor: '#141414'
              }}
            >
              <button
                onClick={handleImportThemePackage}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333333',
                  color: '#38bdf8',
                  padding: '6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Importar paquete .cptheme desde archivo"
              >
                <Upload size={13} />
                <span>Importar</span>
              </button>

              <button
                onClick={() => setIsExporting(true)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333333',
                  color: '#22c55e',
                  padding: '6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Exportar tema seleccionado como archivo .cptheme"
              >
                <Download size={13} />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          {/* Column 2: Center Live 16:9 Preview Canvas */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#121212',
              borderRight: '1px solid #262626',
              padding: '14px',
              minWidth: 0
            }}
          >
            {/* Top Toolbar of Preview: Samples & Role Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>Vista Previa:</span>
                <select
                  value={previewContentType}
                  onChange={(e) => setPreviewContentType(e.target.value as ThemeContentType)}
                  style={{
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #333333',
                    color: '#ffffff',
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    outline: 'none'
                  }}
                >
                  <option value="songs">Canción (Letra de Himno)</option>
                  <option value="bible">Biblia (Juan 3:16)</option>
                  <option value="announcements">Anuncio (Jóvenes)</option>
                  <option value="messages">Mensaje (Aviso Pastoral)</option>
                  <option value="timer">Temporizador (14:59)</option>
                </select>

                <div
                  style={{
                    display: 'flex',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #2e2e2e',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onClick={() => setPreviewRole('audience')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      border: 'none',
                      backgroundColor: previewRole === 'audience' ? '#f97316' : 'transparent',
                      color: previewRole === 'audience' ? '#ffffff' : '#9ca3af',
                      fontWeight: previewRole === 'audience' ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    Audiencia
                  </button>
                  <button
                    onClick={() => setPreviewRole('stage')}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      border: 'none',
                      backgroundColor: previewRole === 'stage' ? '#f97316' : 'transparent',
                      color: previewRole === 'stage' ? '#ffffff' : '#9ca3af',
                      fontWeight: previewRole === 'stage' ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    Escenario / Retorno
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    color: '#9ca3af',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showSafeMarginsGuides}
                    onChange={(e) => setShowSafeMarginsGuides(e.target.checked)}
                  />
                  <span>Límites seguros</span>
                </label>
              </div>
            </div>

            {/* 16:9 Canvas Box Container */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0a0a0a',
                borderRadius: '6px',
                border: '1px solid #222222',
                padding: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {editedTheme && (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    maxWidth: '820px',
                    borderRadius: '4px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                    border: '1px solid #333333',
                    background:
                      previewRole === 'stage'
                        ? '#000000'
                        : editedTheme.background.type === 'image'
                          ? `url(${editedTheme.background.value}) center/cover no-repeat`
                          : editedTheme.background.value
                  }}
                >
                  {/* Theme Darkening Overlay */}
                  {previewRole !== 'stage' && editedTheme.overlayColor && (editedTheme.overlayOpacity || 0) > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: editedTheme.overlayColor,
                        opacity: editedTheme.overlayOpacity,
                        pointerEvents: 'none',
                        zIndex: 2
                      }}
                    />
                  )}

                  {/* Watermark preview */}
                  {previewRole !== 'stage' && editedTheme.watermarkUrl && (editedTheme.watermarkOpacity || 0) > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: editedTheme.watermarkPosition?.startsWith('top') ? '5%' : undefined,
                        bottom: editedTheme.watermarkPosition?.startsWith('bottom') ? '5%' : undefined,
                        left: editedTheme.watermarkPosition?.endsWith('left') ? '5%' : undefined,
                        right: editedTheme.watermarkPosition?.endsWith('right') ? '5%' : undefined,
                        width: `${editedTheme.watermarkSizePercent || 10}%`,
                        opacity: editedTheme.watermarkOpacity,
                        zIndex: 3,
                        pointerEvents: 'none'
                      }}
                    >
                      <img src={editedTheme.watermarkUrl} alt="Watermark" style={{ width: '100%', objectFit: 'contain' }} />
                    </div>
                  )}

                  {/* Safe Margins Guide Layer */}
                  {showSafeMarginsGuides && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: `${editedTheme.safeMarginsPercent.top}% ${editedTheme.safeMarginsPercent.right}% ${editedTheme.safeMarginsPercent.bottom}% ${editedTheme.safeMarginsPercent.left}%`,
                        border: '1px dashed rgba(249, 115, 22, 0.45)',
                        pointerEvents: 'none',
                        zIndex: 10
                      }}
                    />
                  )}

                  {/* Text Layer Box */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 5,
                      flex: 1,
                      padding: `${editedTheme.safeMarginsPercent.top}% ${editedTheme.safeMarginsPercent.right}% ${editedTheme.safeMarginsPercent.bottom}% ${editedTheme.safeMarginsPercent.left}%`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent:
                        previewRole === 'stage'
                          ? 'flex-start'
                          : editedTheme.verticalAlign === 'top'
                            ? 'flex-start'
                            : editedTheme.verticalAlign === 'bottom'
                              ? 'flex-end'
                              : 'center',
                      textAlign: (previewRole === 'stage' ? 'left' : editedTheme.alignment) as any
                    }}
                  >
                    {/* Bible reference at top if configured */}
                    {previewContentType === 'bible' && editedTheme.bibleRefPosition === 'top' && (
                      <div
                        style={{
                          fontFamily: editedTheme.fontFamily,
                          color: previewRole === 'stage' ? '#38bdf8' : editedTheme.color,
                          fontSize: `${(editedTheme.bibleRefFontSizeVmin || 3.4) * 0.75}vmin`,
                          fontWeight: 700,
                          marginBottom: '6px'
                        }}
                      >
                        {sample.subtitle}
                      </div>
                    )}

                    {sample.title && (
                      <div
                        style={{
                          fontFamily: editedTheme.fontFamily,
                          color: previewRole === 'stage' ? '#38bdf8' : editedTheme.color,
                          fontSize: '13px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          marginBottom: '6px',
                          textTransform: editedTheme.textTransform || 'none'
                        }}
                      >
                        {sample.title}
                      </div>
                    )}

                    <div
                      style={{
                        fontFamily: editedTheme.fontFamily,
                        color: previewRole === 'stage' ? '#fbbf24' : editedTheme.color,
                        fontSize: previewRole === 'stage' ? '18px' : `${(editedTheme.fontSizeVmin || 4.8) * 0.75}vmin`,
                        fontWeight: editedTheme.fontWeight || 'normal',
                        fontStyle: editedTheme.fontStyle || 'normal',
                        textTransform: editedTheme.textTransform || 'none',
                        lineHeight: editedTheme.lineHeight || 1.3,
                        letterSpacing: `${editedTheme.letterSpacing || 0}px`,
                        whiteSpace: 'pre-line',
                        WebkitTextStroke:
                          previewRole !== 'stage' && editedTheme.outlineWidthPx > 0
                            ? `${editedTheme.outlineWidthPx}px ${editedTheme.outlineColor}`
                            : 'none',
                        textShadow:
                          previewRole !== 'stage' && editedTheme.shadowBlurPx > 0
                            ? `${editedTheme.shadowOffsetX || 0}px ${editedTheme.shadowOffsetY || 4}px ${editedTheme.shadowBlurPx}px ${editedTheme.shadowColor}`
                            : 'none'
                      }}
                    >
                      {sample.body}
                    </div>

                    {/* Bible reference at bottom or standard subtitle */}
                    {sample.subtitle && (previewContentType !== 'bible' || editedTheme.bibleRefPosition !== 'top') && (
                      <div
                        style={{
                          fontFamily: editedTheme.fontFamily,
                          color: previewRole === 'stage' ? '#9ca3af' : editedTheme.color,
                          fontSize:
                            previewContentType === 'bible'
                              ? `${(editedTheme.bibleRefFontSizeVmin || 3.4) * 0.75}vmin`
                              : '12px',
                          marginTop: '8px',
                          opacity: 0.9,
                          fontStyle: 'italic'
                        }}
                      >
                        {sample.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bar of Center Column: Theme Name, Duplicate, Delete, Save */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '12px',
                borderTop: '1px solid #262626',
                marginTop: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isRenaming ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="text"
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      style={{
                        backgroundColor: '#1e1e1e',
                        border: '1px solid #f97316',
                        color: '#ffffff',
                        fontSize: '13px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleRenameTheme}
                      style={{
                        backgroundColor: '#22c55e',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setIsRenaming(false)}
                      style={{
                        backgroundColor: '#2a2a2a',
                        color: '#9ca3af',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '5px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f3f4f6' }}>
                      {editedTheme?.name}
                    </span>
                    <button
                      onClick={() => {
                        setRenameInput(editedTheme?.name || '')
                        setIsRenaming(true)
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Renombrar tema"
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleDuplicateTheme}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #333333',
                    color: '#f3f4f6',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                  title="Duplicar tema"
                >
                  <Copy size={13} />
                  <span>Duplicar</span>
                </button>

                {!editedTheme?.isBuiltIn && (
                  <button
                    onClick={handleDeleteTheme}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: '#201111',
                      border: '1px solid #7f1d1d',
                      color: '#f87171',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                    title="Eliminar tema"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                )}

                {!editedTheme?.isDefault && (
                  <button
                    onClick={handleSetGeneralDefault}
                    style={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    title="Usar como tema general por defecto"
                  >
                    Marcar Default General
                  </button>
                )}

                <button
                  onClick={handleSaveCurrentTheme}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#f97316',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Guardar cambios del tema"
                >
                  <Check size={14} />
                  <span>Guardar Tema</span>
                </button>
              </div>
            </div>
          </div>

          {/* Column 3: Properties Panel (380px) */}
          <div
            style={{
              width: '390px',
              backgroundColor: '#161616',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Property Tabs Header */}
            <div
              style={{
                display: 'flex',
                gap: '2px',
                padding: '8px',
                borderBottom: '1px solid #262626',
                overflowX: 'auto',
                backgroundColor: '#141414'
              }}
            >
              {[
                { id: 'text', label: 'Texto', icon: Type },
                { id: 'effects', label: 'Efectos', icon: Sparkles },
                { id: 'background', label: 'Fondo', icon: ImageIcon },
                { id: 'specific', label: 'Tipo', icon: Sliders },
                { id: 'watermark', label: 'Logo', icon: Maximize2 },
                { id: 'fonts', label: 'Fuentes', icon: Type },
                { id: 'defaults', label: 'Defaults', icon: Layers }
              ].map((tab) => {
                const IconComponent = tab.icon
                const isActive = activePropertyTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePropertyTab(tab.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid',
                      borderColor: isActive ? '#f97316' : 'transparent',
                      backgroundColor: isActive ? '#281a10' : 'transparent',
                      color: isActive ? '#f97316' : '#9ca3af',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <IconComponent size={12} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Tab Contents Scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', fontSize: '12px' }}>
              {editedTheme && (
                <>
                  {/* TAB 1: TEXT PROPERTIES */}
                  {activePropertyTab === 'text' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px', fontWeight: 600 }}>
                          Familia Tipográfica
                        </label>
                        <select
                          value={editedTheme.fontFamily}
                          onChange={(e) => setEditedTheme({ ...editedTheme, fontFamily: e.target.value })}
                          style={{
                            width: '100%',
                            backgroundColor: '#1e1e1e',
                            border: '1px solid #333333',
                            color: '#ffffff',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            outline: 'none',
                            fontSize: '12px'
                          }}
                        >
                          <optgroup label="Fuentes del Sistema">
                            {STANDARD_FONTS.map((f) => (
                              <option key={f} value={f}>
                                {f.split(',')[0]}
                              </option>
                            ))}
                          </optgroup>
                          {customFonts.length > 0 && (
                            <optgroup label="Fuentes Personalizadas Instaladas">
                              {customFonts.map((cf) => (
                                <option key={cf.id} value={cf.name}>
                                  ★ {cf.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Font Size & AutoFit */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#9ca3af', fontWeight: 600 }}>Tamaño Base ({editedTheme.fontSizeVmin} vmin)</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editedTheme.autoFit !== false}
                              onChange={(e) => setEditedTheme({ ...editedTheme, autoFit: e.target.checked })}
                            />
                            <span style={{ fontSize: '11px', color: '#f97316' }}>Auto-ajuste</span>
                          </label>
                        </div>
                        <input
                          type="range"
                          min="2.5"
                          max="12.0"
                          step="0.1"
                          value={editedTheme.fontSizeVmin}
                          onChange={(e) => setEditedTheme({ ...editedTheme, fontSizeVmin: parseFloat(e.target.value) })}
                          style={{ width: '100%', accentColor: '#f97316' }}
                        />
                      </div>

                      {/* Font Weight & Style */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Grosor / Peso</label>
                          <select
                            value={editedTheme.fontWeight || 'normal'}
                            onChange={(e) => setEditedTheme({ ...editedTheme, fontWeight: e.target.value as any })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e1e1e',
                              border: '1px solid #333333',
                              color: '#ffffff',
                              padding: '5px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="300">300 (Ligera)</option>
                            <option value="400">400 (Normal)</option>
                            <option value="600">600 (Seminegrita)</option>
                            <option value="700">700 (Negrita)</option>
                          </select>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Estilo</label>
                          <select
                            value={editedTheme.fontStyle || 'normal'}
                            onChange={(e) => setEditedTheme({ ...editedTheme, fontStyle: e.target.value as any })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e1e1e',
                              border: '1px solid #333333',
                              color: '#ffffff',
                              padding: '5px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="normal">Normal</option>
                            <option value="italic">Cursiva</option>
                          </select>
                        </div>
                      </div>

                      {/* Text Color & Transform */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Color Texto</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="color"
                              value={editedTheme.color}
                              onChange={(e) => setEditedTheme({ ...editedTheme, color: e.target.value })}
                              style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
                            />
                            <input
                              type="text"
                              value={editedTheme.color}
                              onChange={(e) => setEditedTheme({ ...editedTheme, color: e.target.value })}
                              style={{
                                width: '70px',
                                backgroundColor: '#1e1e1e',
                                border: '1px solid #333333',
                                color: '#ffffff',
                                padding: '4px',
                                fontSize: '11px',
                                borderRadius: '4px'
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Caja</label>
                          <select
                            value={editedTheme.textTransform || 'none'}
                            onChange={(e) => setEditedTheme({ ...editedTheme, textTransform: e.target.value as any })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e1e1e',
                              border: '1px solid #333333',
                              color: '#ffffff',
                              padding: '5px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="none">Normal</option>
                            <option value="uppercase">MAYÚSCULAS</option>
                            <option value="lowercase">minúsculas</option>
                          </select>
                        </div>
                      </div>

                      {/* Alignment Horizontal & Vertical */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Alineación Horizontal</label>
                          <select
                            value={editedTheme.alignment}
                            onChange={(e) => setEditedTheme({ ...editedTheme, alignment: e.target.value as any })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e1e1e',
                              border: '1px solid #333333',
                              color: '#ffffff',
                              padding: '5px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="center">Centro</option>
                            <option value="left">Izquierda</option>
                            <option value="right">Derecha</option>
                            <option value="justify">Justificado</option>
                          </select>
                        </div>

                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Alineación Vertical</label>
                          <select
                            value={editedTheme.verticalAlign || 'middle'}
                            onChange={(e) => setEditedTheme({ ...editedTheme, verticalAlign: e.target.value as any })}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e1e1e',
                              border: '1px solid #333333',
                              color: '#ffffff',
                              padding: '5px',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="middle">Centro</option>
                            <option value="top">Arriba</option>
                            <option value="bottom">Abajo</option>
                          </select>
                        </div>
                      </div>

                      {/* Line Height & Letter Spacing */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>Interlineado ({editedTheme.lineHeight || 1.3})</span>
                          <input
                            type="range"
                            min="1.0"
                            max="2.0"
                            step="0.05"
                            value={editedTheme.lineHeight || 1.3}
                            onChange={(e) => setEditedTheme({ ...editedTheme, lineHeight: parseFloat(e.target.value) })}
                            style={{ width: '100%', accentColor: '#f97316' }}
                          />
                        </div>

                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>Espaciado ({editedTheme.letterSpacing || 0} px)</span>
                          <input
                            type="range"
                            min="-1"
                            max="6"
                            step="0.5"
                            value={editedTheme.letterSpacing || 0}
                            onChange={(e) => setEditedTheme({ ...editedTheme, letterSpacing: parseFloat(e.target.value) })}
                            style={{ width: '100%', accentColor: '#f97316' }}
                          />
                        </div>
                      </div>

                      {/* Safe Margins */}
                      <div>
                        <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>
                          Márgenes Seguros (% lienzo)
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: '#71717a' }}>Arriba</span>
                            <input
                              type="number"
                              min="0"
                              max="25"
                              value={editedTheme.safeMarginsPercent.top}
                              onChange={(e) =>
                                setEditedTheme({
                                  ...editedTheme,
                                  safeMarginsPercent: {
                                    ...editedTheme.safeMarginsPercent,
                                    top: parseInt(e.target.value) || 0
                                  }
                                })
                              }
                              style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '4px', fontSize: '11px', borderRadius: '4px' }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: '#71717a' }}>Abajo</span>
                            <input
                              type="number"
                              min="0"
                              max="25"
                              value={editedTheme.safeMarginsPercent.bottom}
                              onChange={(e) =>
                                setEditedTheme({
                                  ...editedTheme,
                                  safeMarginsPercent: {
                                    ...editedTheme.safeMarginsPercent,
                                    bottom: parseInt(e.target.value) || 0
                                  }
                                })
                              }
                              style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '4px', fontSize: '11px', borderRadius: '4px' }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: '#71717a' }}>Izq.</span>
                            <input
                              type="number"
                              min="0"
                              max="25"
                              value={editedTheme.safeMarginsPercent.left}
                              onChange={(e) =>
                                setEditedTheme({
                                  ...editedTheme,
                                  safeMarginsPercent: {
                                    ...editedTheme.safeMarginsPercent,
                                    left: parseInt(e.target.value) || 0
                                  }
                                })
                              }
                              style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '4px', fontSize: '11px', borderRadius: '4px' }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: '#71717a' }}>Der.</span>
                            <input
                              type="number"
                              min="0"
                              max="25"
                              value={editedTheme.safeMarginsPercent.right}
                              onChange={(e) =>
                                setEditedTheme({
                                  ...editedTheme,
                                  safeMarginsPercent: {
                                    ...editedTheme.safeMarginsPercent,
                                    right: parseInt(e.target.value) || 0
                                  }
                                })
                              }
                              style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '4px', fontSize: '11px', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: OUTLINE & SHADOW EFFECTS */}
                  {activePropertyTab === 'effects' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #282828' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>Contorno de Texto</span>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>Color</label>
                            <input
                              type="color"
                              value={editedTheme.outlineColor}
                              onChange={(e) => setEditedTheme({ ...editedTheme, outlineColor: e.target.value })}
                              style={{ width: '100%', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                            />
                          </div>
                          <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>
                              Grosor ({editedTheme.outlineWidthPx} px)
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="8"
                              step="1"
                              value={editedTheme.outlineWidthPx}
                              onChange={(e) => setEditedTheme({ ...editedTheme, outlineWidthPx: parseInt(e.target.value) || 0 })}
                              style={{ width: '100%', accentColor: '#f97316' }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #282828' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>Sombra Proyectada</span>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>Color Sombra</label>
                            <input
                              type="color"
                              value={editedTheme.shadowColor.startsWith('#') ? editedTheme.shadowColor : '#000000'}
                              onChange={(e) => setEditedTheme({ ...editedTheme, shadowColor: e.target.value })}
                              style={{ width: '100%', height: '30px', border: 'none', background: 'none', cursor: 'pointer' }}
                            />
                          </div>
                          <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>
                              Desenfoque ({editedTheme.shadowBlurPx} px)
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="30"
                              step="1"
                              value={editedTheme.shadowBlurPx}
                              onChange={(e) => setEditedTheme({ ...editedTheme, shadowBlurPx: parseInt(e.target.value) || 0 })}
                              style={{ width: '100%', accentColor: '#38bdf8' }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Desplazamiento X ({editedTheme.shadowOffsetX || 0} px)</span>
                            <input
                              type="range"
                              min="-15"
                              max="15"
                              value={editedTheme.shadowOffsetX || 0}
                              onChange={(e) => setEditedTheme({ ...editedTheme, shadowOffsetX: parseInt(e.target.value) || 0 })}
                              style={{ width: '100%', accentColor: '#38bdf8' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>Desplazamiento Y ({editedTheme.shadowOffsetY || 4} px)</span>
                            <input
                              type="range"
                              min="-15"
                              max="15"
                              value={editedTheme.shadowOffsetY || 4}
                              onChange={(e) => setEditedTheme({ ...editedTheme, shadowOffsetY: parseInt(e.target.value) || 0 })}
                              style={{ width: '100%', accentColor: '#38bdf8' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: BACKGROUND & OVERLAY */}
                  {activePropertyTab === 'background' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', color: '#9ca3af', marginBottom: '5px', fontWeight: 600 }}>Tipo de Fondo</label>
                        <select
                          value={editedTheme.background.type}
                          onChange={(e) =>
                            setEditedTheme({
                              ...editedTheme,
                              background: {
                                type: e.target.value as any,
                                value:
                                  e.target.value === 'color'
                                    ? '#181818'
                                    : e.target.value === 'gradient'
                                      ? 'linear-gradient(135deg, #181818 0%, #242424 100%)'
                                      : backgroundImages[0]?.url || ''
                              }
                            })
                          }
                          style={{
                            width: '100%',
                            backgroundColor: '#1e1e1e',
                            border: '1px solid #333333',
                            color: '#ffffff',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <option value="gradient">Degradado Moderno CSS</option>
                          <option value="color">Color Sólido</option>
                          <option value="image">Imagen de Fondo</option>
                          <option value="video">Video en Bucle (Sin Audio)</option>
                        </select>
                      </div>

                      {/* Value Input depending on type */}
                      {editedTheme.background.type === 'color' && (
                        <div>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Color de Fondo</label>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="color"
                              value={editedTheme.background.value}
                              onChange={(e) =>
                                setEditedTheme({
                                  ...editedTheme,
                                  background: { ...editedTheme.background, value: e.target.value }
                                })
                              }
                              style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }}
                            />
                            <input
                              type="text"
                              value={editedTheme.background.value}
                              onChange={(e) =>
                                setEditedTheme({
                                  ...editedTheme,
                                  background: { ...editedTheme.background, value: e.target.value }
                                })
                              }
                              style={{ flex: 1, backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '5px', borderRadius: '4px' }}
                            />
                          </div>
                        </div>
                      )}

                      {editedTheme.background.type === 'gradient' && (
                        <div>
                          <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>CSS Linear Gradient</label>
                          <input
                            type="text"
                            value={editedTheme.background.value}
                            onChange={(e) =>
                              setEditedTheme({
                                ...editedTheme,
                                background: { ...editedTheme.background, value: e.target.value }
                              })
                            }
                            style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '6px', fontSize: '11px', borderRadius: '4px' }}
                          />
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                            {[
                              { label: 'Carbón', val: 'linear-gradient(135deg, #181818 0%, #242424 100%)' },
                              { label: 'Esmeralda', val: 'linear-gradient(135deg, #06241c 0%, #0c382b 100%)' },
                              { label: 'Cálido', val: 'linear-gradient(135deg, #18110b 0%, #291b10 100%)' }
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                onClick={() =>
                                  setEditedTheme({
                                    ...editedTheme,
                                    background: { type: 'gradient', value: preset.val }
                                  })
                                }
                                style={{
                                  fontSize: '10px',
                                  backgroundColor: '#262626',
                                  color: '#e5e7eb',
                                  border: '1px solid #383838',
                                  padding: '3px 6px',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {['image', 'video'].includes(editedTheme.background.type) && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label style={{ color: '#9ca3af', fontWeight: 600 }}>Seleccionar Archivo</label>
                            <button
                              onClick={handleUploadBackground}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: '#f97316',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                cursor: 'pointer'
                              }}
                            >
                              <Plus size={12} />
                              <span>Cargar Fondo...</span>
                            </button>
                          </div>

                          <select
                            value={editedTheme.background.value}
                            onChange={(e) =>
                              setEditedTheme({
                                ...editedTheme,
                                background: { ...editedTheme.background, value: e.target.value }
                              })
                            }
                            style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                          >
                            <option value="">-- Seleccionar fondo de biblioteca --</option>
                            {backgroundImages.map((bg) => (
                              <option key={bg.id} value={bg.url || bg.filePath}>
                                {bg.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Darkening Overlay Section */}
                      <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #282828', marginTop: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>
                          Capa de Oscurecimiento (Contraste)
                        </span>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', alignItems: 'center' }}>
                          <div>
                            <input
                              type="color"
                              value={editedTheme.overlayColor || '#000000'}
                              onChange={(e) => setEditedTheme({ ...editedTheme, overlayColor: e.target.value })}
                              style={{ width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                              <span>Opacidad</span>
                              <span>{Math.round((editedTheme.overlayOpacity || 0) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={editedTheme.overlayOpacity || 0}
                              onChange={(e) => setEditedTheme({ ...editedTheme, overlayOpacity: parseFloat(e.target.value) })}
                              style={{ width: '100%', accentColor: '#f97316' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SPECIFIC SETTINGS (BIBLE & SONGS) */}
                  {activePropertyTab === 'specific' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Bible Settings */}
                      <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #282828' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8' }}>Específico de Biblia</span>

                        <div style={{ marginTop: '8px' }}>
                          <label style={{ display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>Posición de Referencia</label>
                          <select
                            value={editedTheme.bibleRefPosition || 'bottom'}
                            onChange={(e) => setEditedTheme({ ...editedTheme, bibleRefPosition: e.target.value as any })}
                            style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '5px', borderRadius: '4px', fontSize: '12px' }}
                          >
                            <option value="bottom">Abajo del pasaje</option>
                            <option value="top">Arriba del pasaje</option>
                          </select>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>Tamaño Referencia ({editedTheme.bibleRefFontSizeVmin || 3.4} vmin)</span>
                          <input
                            type="range"
                            min="2.0"
                            max="6.0"
                            step="0.1"
                            value={editedTheme.bibleRefFontSizeVmin || 3.4}
                            onChange={(e) => setEditedTheme({ ...editedTheme, bibleRefFontSizeVmin: parseFloat(e.target.value) })}
                            style={{ width: '100%', accentColor: '#38bdf8' }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#e5e7eb', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editedTheme.bibleShowVersionTag !== false}
                              onChange={(e) => setEditedTheme({ ...editedTheme, bibleShowVersionTag: e.target.checked })}
                            />
                            <span>Mostrar sigla de versión (ej. RVR1909)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#e5e7eb', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editedTheme.bibleShowVerseNumbers !== false}
                              onChange={(e) => setEditedTheme({ ...editedTheme, bibleShowVerseNumbers: e.target.checked })}
                            />
                            <span>Mostrar números de versículo</span>
                          </label>
                        </div>
                      </div>

                      {/* Song Settings */}
                      <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', border: '1px solid #282828' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>Específico de Canciones</span>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#e5e7eb', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editedTheme.songShowTitleOnFirstSlide !== false}
                              onChange={(e) => setEditedTheme({ ...editedTheme, songShowTitleOnFirstSlide: e.target.checked })}
                            />
                            <span>Mostrar título en la primera diapositiva</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#e5e7eb', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={editedTheme.songShowCopyrightOnLastSlide !== false}
                              onChange={(e) => setEditedTheme({ ...editedTheme, songShowCopyrightOnLastSlide: e.target.checked })}
                            />
                            <span>Mostrar derechos de autor / CCLI al final</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: WATERMARK / LOGO */}
                  {activePropertyTab === 'watermark' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', color: '#9ca3af', marginBottom: '4px' }}>Imagen de Logo o Marca de Agua</label>
                        <select
                          value={editedTheme.watermarkUrl || ''}
                          onChange={(e) => setEditedTheme({ ...editedTheme, watermarkUrl: e.target.value })}
                          style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
                        >
                          <option value="">-- Sin marca de agua --</option>
                          {backgroundImages.map((bg) => (
                            <option key={bg.id} value={bg.url || bg.filePath}>
                              {bg.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {editedTheme.watermarkUrl && (
                        <>
                          <div>
                            <label style={{ display: 'block', color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>Posición</label>
                            <select
                              value={editedTheme.watermarkPosition || 'bottom-right'}
                              onChange={(e) => setEditedTheme({ ...editedTheme, watermarkPosition: e.target.value as any })}
                              style={{ width: '100%', backgroundColor: '#1e1e1e', border: '1px solid #333333', color: '#ffffff', padding: '5px', borderRadius: '4px', fontSize: '12px' }}
                            >
                              <option value="top-left">Esquina Superior Izquierda</option>
                              <option value="top-right">Esquina Superior Derecha</option>
                              <option value="bottom-left">Esquina Inferior Izquierda</option>
                              <option value="bottom-right">Esquina Inferior Derecha</option>
                            </select>
                          </div>

                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>Tamaño ({editedTheme.watermarkSizePercent || 10}%)</span>
                            <input
                              type="range"
                              min="3"
                              max="30"
                              value={editedTheme.watermarkSizePercent || 10}
                              onChange={(e) => setEditedTheme({ ...editedTheme, watermarkSizePercent: parseInt(e.target.value) || 10 })}
                              style={{ width: '100%', accentColor: '#f97316' }}
                            />
                          </div>

                          <div>
                            <span style={{ color: '#9ca3af', fontSize: '11px' }}>Opacidad ({Math.round((editedTheme.watermarkOpacity || 0.5) * 100)}%)</span>
                            <input
                              type="range"
                              min="0.05"
                              max="1.0"
                              step="0.05"
                              value={editedTheme.watermarkOpacity ?? 0.5}
                              onChange={(e) => setEditedTheme({ ...editedTheme, watermarkOpacity: parseFloat(e.target.value) })}
                              style={{ width: '100%', accentColor: '#f97316' }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 6: CUSTOM FONTS */}
                  {activePropertyTab === 'fonts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#f3f4f6' }}>Fuentes Personalizadas</span>
                        <button
                          onClick={handleUploadCustomFont}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#f97316',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={13} />
                          <span>Importar fuente...</span>
                        </button>
                      </div>

                      <div
                        style={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333333',
                          borderRadius: '6px',
                          padding: '10px',
                          fontSize: '11px',
                          color: '#9ca3af',
                          lineHeight: 1.4
                        }}
                      >
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', color: '#f97316', fontWeight: 600, marginBottom: '4px' }}>
                          <HelpCircle size={14} />
                          <span>Aviso de Licencia</span>
                        </div>
                        Asegúrate de contar con la licencia requerida para usar y proyectar esta fuente tipográfica en tu congregación. Formatos admitidos: .ttf, .otf, .woff, .woff2.
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {customFonts.length === 0 ? (
                          <div style={{ color: '#71717a', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>
                            No hay fuentes personalizadas importadas.
                          </div>
                        ) : (
                          customFonts.map((font) => (
                            <div
                              key={font.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                backgroundColor: '#1a1a1a',
                                borderRadius: '4px',
                                border: '1px solid #282828'
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 600, color: '#ffffff', fontFamily: font.name }}>
                                  {font.name}
                                </div>
                                <div style={{ fontSize: '10px', color: '#71717a' }}>
                                  {font.fileName} ({font.format})
                                </div>
                              </div>

                              <button
                                onClick={() => handleDeleteCustomFont(font.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  padding: '4px'
                                }}
                                title="Eliminar fuente"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 7: TYPE DEFAULTS MAPPING */}
                  {activePropertyTab === 'defaults' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <span style={{ fontWeight: 700, color: '#f3f4f6' }}>Tema Predeterminado por Tipo</span>
                      <p style={{ color: '#9ca3af', fontSize: '11px', margin: 0 }}>
                        Asigna un tema por defecto independiente para cada categoría de contenido:
                      </p>

                      {CONTENT_TYPES.map((ct) => (
                        <div key={ct.key} style={{ padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #282828' }}>
                          <label style={{ display: 'block', color: '#f97316', fontWeight: 600, marginBottom: '4px' }}>
                            {ct.label}
                          </label>
                          <select
                            value={typeDefaults[ct.key] || ''}
                            onChange={(e) => handleSetTypeDefault(ct.key, e.target.value)}
                            style={{
                              width: '100%',
                              backgroundColor: '#1e1e1e',
                              border: '1px solid #333333',
                              color: '#ffffff',
                              padding: '5px',
                              borderRadius: '4px',
                              fontSize: '11px'
                            }}
                          >
                            {themes.map((th) => (
                              <option key={th.id} value={th.id}>
                                {th.name} {th.id === typeDefaults[ct.key] ? '(Actual)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Export Theme Modal Sub-Dialog */}
        {isExporting && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000
            }}
          >
            <div
              style={{
                width: '420px',
                backgroundColor: '#181818',
                border: '1px solid #333333',
                borderRadius: '8px',
                padding: '18px',
                color: '#f3f4f6',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9)'
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#f97316', fontWeight: 700 }}>
                Exportar Tema (.cptheme)
              </h3>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: 1.4 }}>
                Se empaquetará el tema <strong>{editedTheme?.name}</strong> con sus fondos en un archivo único portable.
              </p>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  margin: '14px 0',
                  padding: '10px',
                  backgroundColor: '#201810',
                  border: '1px solid #451a03',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#fdba74',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={includeFontsInExport}
                  onChange={(e) => setIncludeFontsInExport(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <strong>Incluir fuentes tipográficas en el paquete</strong>
                  <div style={{ marginTop: '2px', color: '#fed7aa', fontSize: '10px' }}>
                    Confirmo que tengo autorización de licencia para compartir y redistribuir los archivos tipográficos.
                  </div>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  onClick={() => setIsExporting(false)}
                  style={{
                    backgroundColor: '#262626',
                    border: '1px solid #383838',
                    color: '#9ca3af',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExportThemePackage}
                  style={{
                    backgroundColor: '#f97316',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Confirmar y Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
