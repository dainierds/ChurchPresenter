import React, { useState } from 'react'
import {
  Calendar,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Music,
  FileText,
  BookOpen,
  Video,
  ListOrdered,
  Radio,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Edit2,
  Search,
  Palette,
  Film
} from 'lucide-react'
import { ServicePlan, ServiceItem, ThemeConfig } from '../../../shared/types'

const HEADER_PRESET_COLORS = [
  '#2D9CFF', // Light Vivid Blue (Preludio / Bienvenida)
  '#FF7A00', // Orange (Adoración)
  '#22C55E', // Green (Ofrenda / Gratitud)
  '#A855F7', // Purple (Mensaje / Palabra)
  '#EAB308', // Amber / Gold (Ministración / Despedida)
  '#EC4899', // Pink
  '#14B8A6'  // Teal
]

interface PlaylistPanelProps {
  currentService: ServicePlan | null
  services: ServicePlan[]
  onSelectService: (serviceId: string) => void
  onNewService: () => void
  onRenameService?: (serviceId: string, newName: string) => void
  onDuplicateService?: (serviceId: string) => void
  onDeleteService?: (serviceId: string) => void
  selectedItemIndex: number
  onSelectItemIndex: (index: number) => void
  liveItemIndex: number | null
  onReorderItem: (fromIndex: number, toIndex: number) => void
  onDeleteItem: (index: number) => void
  onDuplicateItem: (index: number) => void
  onAddHeader: (title: string, color?: string) => void
  onRenameHeader?: (index: number, newTitle: string, newColor?: string) => void
  onAddBlankItem: () => void
  onVerifyPlaylist?: () => void
  allThemes?: ThemeConfig[]
  onAssignItemTheme?: (itemIndex: number, themeId: string | null) => void
  onApplyThemeToScope?: (themeId: string, scope: 'playlist' | 'library' | 'all_songs') => void
  panelLabels?: {
    library: string
    playlist: string
    media: string
    audience: string
    stage: string
  }
}

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  currentService,
  services,
  onSelectService,
  onNewService,
  onRenameService,
  onDuplicateService,
  onDeleteService,
  selectedItemIndex,
  onSelectItemIndex,
  liveItemIndex,
  onReorderItem,
  onDeleteItem,
  onDuplicateItem,
  onAddHeader,
  onRenameHeader,
  onAddBlankItem,
  onVerifyPlaylist,
  allThemes,
  onAssignItemTheme,
  onApplyThemeToScope,
  panelLabels
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [headerInput, setHeaderInput] = useState('')
  const [headerColor, setHeaderColor] = useState('#FF7A00')
  const [isAddingHeader, setIsAddingHeader] = useState(false)
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(null)
  const [editingHeaderName, setEditingHeaderName] = useState('')
  const [collapsedHeaders, setCollapsedHeaders] = useState<Record<string, boolean>>({})
  const [filterQuery, setFilterQuery] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [isEditingServiceName, setIsEditingServiceName] = useState(false)
  const [serviceNameInput, setServiceNameInput] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    itemIndex: number
    item: ServiceItem
  } | null>(null)

  const items = currentService?.items || []

  const toggleHeader = (headerId: string) => {
    setCollapsedHeaders((prev) => ({
      ...prev,
      [headerId]: !prev[headerId]
    }))
  }

  const handleHeaderSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (headerInput.trim()) {
      onAddHeader(headerInput.trim(), headerColor)
      setHeaderInput('')
      setIsAddingHeader(false)
    }
  }

  const handleHeaderRenameSubmit = (idx: number, currentItem: ServiceItem) => {
    if (editingHeaderName.trim() && onRenameHeader) {
      onRenameHeader(idx, editingHeaderName.trim(), currentItem.notes || '#3b82f6')
    }
    setEditingHeaderIndex(null)
  }

  const cycleHeaderColor = (idx: number, currentItem: ServiceItem) => {
    if (!onRenameHeader) return
    const curColor = (currentItem.notes && currentItem.notes.startsWith('#'))
      ? currentItem.notes
      : HEADER_PRESET_COLORS[0]
    const curIndex = HEADER_PRESET_COLORS.indexOf(curColor)
    const nextColor = HEADER_PRESET_COLORS[(curIndex + 1) % HEADER_PRESET_COLORS.length]
    onRenameHeader(idx, currentItem.name, nextColor)
  }

  const handleServiceNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentService && serviceNameInput.trim() && onRenameService) {
      onRenameService(currentService.id, serviceNameInput.trim())
    }
    setIsEditingServiceName(false)
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'song':
        return <Music size={12} className="pro-item-type-icon song" />
      case 'presentation':
      case 'powerpoint':
        return <FileText size={12} className="pro-item-type-icon pres" />
      case 'scripture':
        return <BookOpen size={12} className="pro-item-type-icon bible" />
      case 'video':
      case 'media':
        return <Video size={12} className="pro-item-type-icon media" />
      case 'image':
      case 'image_presentation':
        return <Film size={12} className="pro-item-type-icon media" />
      case 'youtube':
        return (
          <span
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 800,
              padding: '1px 4px',
              borderRadius: 3,
              marginRight: 6
            }}
          >
            YT
          </span>
        )
      default:
        return <ListOrdered size={12} className="pro-item-type-icon generic" />
    }
  }

  // Calculate items under headers for collapsible logic
  let isCurrentHeaderCollapsed = false
  let headerSectionCounter = 0

  return (
    <div className="pro-playlist-panel zone-service-playlist">
      {/* Service Header Bar */}
      <div className="pro-playlist-header">
        <div className="pro-service-selector-box">
          <Calendar size={13} className="pro-cal-icon" />
          {isEditingServiceName ? (
            <form onSubmit={handleServiceNameSubmit} className="pro-service-rename-form">
              <input
                type="text"
                className="pro-service-rename-input"
                autoFocus
                value={serviceNameInput}
                onChange={(e) => setServiceNameInput(e.target.value)}
                onBlur={() => setIsEditingServiceName(false)}
              />
              <button type="submit" className="pro-btn-confirm">✓</button>
            </form>
          ) : (
            <select
              className="pro-service-select"
              value={currentService?.id || ''}
              onChange={(e) => onSelectService(e.target.value)}
              title={`Seleccionar ${panelLabels?.playlist || 'Playlist'} de Servicio`}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.date || 'Culto'})
                </option>
              ))}
            </select>
          )}

          {/* Quick Playlist Operations */}
          <div className="pro-service-quick-ops">
            <button
              className="pro-service-op-btn"
              onClick={onNewService}
              title="Crear nueva playlist"
            >
              <Plus size={11} />
            </button>
            {currentService && onRenameService && (
              <button
                className="pro-service-op-btn"
                onClick={() => {
                  setServiceNameInput(currentService.name)
                  setIsEditingServiceName(true)
                }}
                title="Renombrar playlist actual"
              >
                <Edit2 size={10} />
              </button>
            )}
            {currentService && onDuplicateService && (
              <button
                className="pro-service-op-btn"
                onClick={() => onDuplicateService(currentService.id)}
                title="Duplicar playlist actual"
              >
                <Copy size={10} />
              </button>
            )}
            {currentService && onDeleteService && services.length > 1 && (
              <button
                className="pro-service-op-btn danger"
                onClick={() => {
                  if (confirm(`¿Eliminar la playlist "${currentService.name}"?`)) {
                    onDeleteService(currentService.id)
                  }
                }}
                title="Eliminar playlist actual"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>

        <div className="pro-playlist-count-row">
          {onVerifyPlaylist && (
            <button
              className="pro-btn-verify-playlist"
              onClick={onVerifyPlaylist}
              title="Verificar disponibilidad de videos de YouTube en la playlist antes del culto"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ShieldCheck size={11} />
              <span>Verificar</span>
            </button>
          )}
          <span className="pro-items-count-badge">{items.length} ITEMS</span>
          <div className="pro-add-item-wrapper">
            <button
              className="pro-btn-add-item"
              onClick={() => setShowAddMenu(!showAddMenu)}
              title="Agregar encabezado o diapositiva en blanco"
            >
              <Plus size={13} />
            </button>
            {showAddMenu && (
              <div className="pro-playlist-add-dropdown">
                <button
                  className="pro-dropdown-action"
                  onClick={() => {
                    setShowAddMenu(false)
                    setIsAddingHeader(true)
                  }}
                >
                  + Encabezado de Sección (Música, Mensaje...)
                </button>
                <button
                  className="pro-dropdown-action"
                  onClick={() => {
                    setShowAddMenu(false)
                    onAddBlankItem()
                  }}
                >
                  + Diapositiva en Blanco
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header creation inline input */}
      {isAddingHeader && (
        <form onSubmit={handleHeaderSubmit} className="pro-header-create-form">
          <input
            type="text"
            className="pro-header-create-input"
            placeholder="Nombre de sección (ej. MÚSICA)..."
            autoFocus
            value={headerInput}
            onChange={(e) => setHeaderInput(e.target.value)}
          />
          <div className="pro-header-color-pills">
            {HEADER_PRESET_COLORS.map((c) => (
              <span
                key={c}
                className={`pro-color-dot ${headerColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setHeaderColor(c)}
              />
            ))}
          </div>
          <button type="submit" className="pro-btn-confirm" title="Crear sección">
            ✓
          </button>
          <button
            type="button"
            className="pro-btn-dismiss"
            onClick={() => setIsAddingHeader(false)}
            title="Cancelar"
          >
            ✕
          </button>
        </form>
      )}

      {/* Playlist Items List */}
      <div className="pro-playlist-items-scroll">
        {items.map((item, index) => {
          const isHeader = item.type === 'header'
          const isSelected = selectedItemIndex === index
          const isLive = liveItemIndex === index

          // Filter check
          if (
            filterQuery &&
            !item.name.toLowerCase().includes(filterQuery.toLowerCase()) &&
            !isHeader
          ) {
            return null
          }

          if (isHeader) {
            isCurrentHeaderCollapsed = Boolean(collapsedHeaders[item.id])
            const fallbackColor = HEADER_PRESET_COLORS[headerSectionCounter % HEADER_PRESET_COLORS.length]
            headerSectionCounter++
            const headerColorTag = (item.notes && item.notes.startsWith('#')) ? item.notes : fallbackColor
            const isEditing = editingHeaderIndex === index

            return (
              <div
                key={item.id}
                className={`pro-playlist-header-row ${isSelected ? 'selected' : ''}`}
                style={{
                  borderLeft: `4px solid ${headerColorTag}`,
                  background: isSelected
                    ? 'var(--bg-card-selected)'
                    : `linear-gradient(90deg, ${headerColorTag}18 0%, rgba(23, 24, 29, 0.95) 75%)`
                }}
                onClick={() => {
                  toggleHeader(item.id)
                  onSelectItemIndex(index)
                }}
              >
                <div className="pro-header-title-row">
                  {collapsedHeaders[item.id] ? (
                    <ChevronRight size={13} style={{ color: headerColorTag }} />
                  ) : (
                    <ChevronDown size={13} style={{ color: headerColorTag }} />
                  )}
                  {isEditing ? (
                    <input
                      type="text"
                      className="pro-header-rename-input"
                      value={editingHeaderName}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingHeaderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleHeaderRenameSubmit(index, item)
                        if (e.key === 'Escape') setEditingHeaderIndex(null)
                      }}
                      onBlur={() => handleHeaderRenameSubmit(index, item)}
                    />
                  ) : (
                    <span className="pro-header-text" style={{ color: headerColorTag }}>{item.name}</span>
                  )}
                </div>

                <div className="pro-item-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="pro-item-mini-btn"
                    onClick={() => cycleHeaderColor(index, item)}
                    title="Cambiar color de sección"
                  >
                    <Palette size={11} style={{ color: headerColorTag }} />
                  </button>
                  <button
                    className="pro-item-mini-btn"
                    onClick={() => {
                      setEditingHeaderIndex(index)
                      setEditingHeaderName(item.name)
                    }}
                    title="Renombrar sección"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    className="pro-item-mini-btn danger"
                    onClick={() => onDeleteItem(index)}
                    title="Eliminar sección"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          }

          if (isCurrentHeaderCollapsed) {
            return null // Hide child items when section header is collapsed
          }

          return (
            <div
              key={item.id}
              className={`pro-playlist-item-row playlist-item-card ${isSelected ? 'selected' : ''} ${
                isLive ? 'is-live' : ''
              }`}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedIndex !== null && draggedIndex !== index) {
                  onReorderItem(draggedIndex, index)
                  setDraggedIndex(null)
                }
              }}
              onClick={() => onSelectItemIndex(index)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  itemIndex: index,
                  item
                })
              }}
            >
              <div className="pro-item-left">
                {item.type === 'youtube' && item.youtubeConfig?.thumbnailUrl ? (
                  <img
                    src={item.youtubeConfig.thumbnailUrl}
                    alt=""
                    style={{ width: 34, height: 22, objectFit: 'cover', borderRadius: 3, marginRight: 6 }}
                  />
                ) : (
                  getItemIcon(item.type)
                )}
                <div className="pro-item-title-col">
                  <span className="pro-item-name">{item.name}</span>
                  {item.notes && item.type !== 'header' && (
                    <span className="pro-item-notes">{item.notes}</span>
                  )}
                </div>
              </div>

              <div className="pro-item-right">
                {item.type === 'youtube' && item.youtubeConfig?.availabilityStatus && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 3,
                      marginRight: 4,
                      backgroundColor:
                        item.youtubeConfig.availabilityStatus === 'ok'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : item.youtubeConfig.availabilityStatus === 'unembeddable'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                      color:
                        item.youtubeConfig.availabilityStatus === 'ok'
                          ? '#10b981'
                          : item.youtubeConfig.availabilityStatus === 'unembeddable'
                          ? '#f59e0b'
                          : '#ef4444'
                    }}
                  >
                    {item.youtubeConfig.availabilityStatus.toUpperCase()}
                  </span>
                )}
                {isLive && (
                  <span className="pro-live-pill" title="Actualmente proyectándose en vivo">
                    <Radio size={10} className="pro-live-pulse-icon" />
                    LIVE
                  </span>
                )}
                <div className="pro-item-hover-actions">
                  {index > 0 && (
                    <button
                      className="pro-item-mini-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onReorderItem(index, index - 1)
                      }}
                      title="Mover arriba"
                    >
                      <ArrowUp size={10} />
                    </button>
                  )}
                  {index < items.length - 1 && (
                    <button
                      className="pro-item-mini-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onReorderItem(index, index + 1)
                      }}
                      title="Mover abajo"
                    >
                      <ArrowDown size={10} />
                    </button>
                  )}
                  <button
                    className="pro-item-mini-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDuplicateItem(index)
                    }}
                    title="Duplicar elemento"
                  >
                    <Copy size={10} />
                  </button>
                  <button
                    className="pro-item-mini-btn danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteItem(index)
                    }}
                    title="Eliminar de servicio"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="pro-playlist-empty">
            <span>Servicio vacío. Arrastre canciones desde la biblioteca o haga clic en +</span>
          </div>
        )}
      </div>

      {/* Bottom Filter Input */}
      <div className="pro-playlist-filter-bar">
        <Search size={12} className="pro-playlist-filter-icon" />
        <input
          type="text"
          className="pro-playlist-filter-input"
          placeholder="Filtrar en playlist..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        {filterQuery && (
          <button
            className="pro-search-clear"
            onClick={() => setFilterQuery('')}
            title="Limpiar filtro"
          >
            ✕
          </button>
        )}
      </div>
      {/* Item Context Menu Popover */}
      {contextMenu?.visible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999
          }}
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu(null)
          }}
        >
          <div
            style={{
              position: 'fixed',
              top: Math.min(contextMenu.y, window.innerHeight - 250),
              left: Math.min(contextMenu.x, window.innerWidth - 260),
              backgroundColor: '#181818',
              border: '1px solid #333333',
              borderRadius: '6px',
              padding: '6px',
              minWidth: '240px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8)',
              fontSize: '12px',
              color: '#f3f4f6'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '4px 8px', fontSize: '11px', color: '#9ca3af', borderBottom: '1px solid #282828' }}>
              Elemento: <strong style={{ color: '#ffffff' }}>{contextMenu.item.name}</strong>
            </div>

            {/* Change Theme */}
            {allThemes && allThemes.length > 0 && onAssignItemTheme && (
              <div style={{ padding: '6px 8px' }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#f97316', marginBottom: '4px', fontWeight: 600 }}>
                  Tema Específico:
                </span>
                <select
                  value={contextMenu.item.themeId || ''}
                  onChange={(e) => {
                    const chosen = e.target.value || null
                    onAssignItemTheme(contextMenu.itemIndex, chosen)
                    setContextMenu(null)
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #383838',
                    color: '#ffffff',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}
                >
                  <option value="">(Usar predeterminado de tipo)</option>
                  {allThemes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {contextMenu.item.themeId && onAssignItemTheme && (
              <button
                onClick={() => {
                  onAssignItemTheme(contextMenu.itemIndex, null)
                  setContextMenu(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '6px 8px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#262626')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Quitar tema específico
              </button>
            )}

            {allThemes && onApplyThemeToScope && (
              <>
                <div style={{ height: '1px', backgroundColor: '#282828', margin: '4px 0' }} />
                <button
                  onClick={() => {
                    const themeToApply = contextMenu.item.themeId || (allThemes[0] ? allThemes[0].id : '')
                    if (confirm(`¿Aplicar este tema a todos los elementos de la playlist actual?`)) {
                      onApplyThemeToScope(themeToApply, 'playlist')
                    }
                    setContextMenu(null)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '6px 8px',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#262626')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Aplicar tema a toda la playlist...
                </button>

                <button
                  onClick={() => {
                    const themeToApply = contextMenu.item.themeId || (allThemes[0] ? allThemes[0].id : '')
                    if (confirm(`¿Aplicar este tema a TODAS las canciones de la biblioteca?`)) {
                      onApplyThemeToScope(themeToApply, 'all_songs')
                    }
                    setContextMenu(null)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '6px 8px',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#262626')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Aplicar a toda la biblioteca de canciones...
                </button>
              </>
            )}

            <div style={{ height: '1px', backgroundColor: '#282828', margin: '4px 0' }} />

            <button
              onClick={() => {
                onDuplicateItem(contextMenu.itemIndex)
                setContextMenu(null)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '6px 8px',
                color: '#e5e7eb',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '11px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#262626')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Duplicar elemento
            </button>

            <button
              onClick={() => {
                onDeleteItem(contextMenu.itemIndex)
                setContextMenu(null)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                padding: '6px 8px',
                color: '#f87171',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '11px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3b1212')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Eliminar de la playlist
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
