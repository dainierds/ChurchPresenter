import React, { useState, useEffect } from 'react'
import {
  Folder,
  Music,
  FileText,
  Video,
  History,
  Plus,
  Trash2,
  Edit2,
  Search,
  Layers,
  ChevronUp,
  ChevronDown,
  BookOpen,
  Film
} from 'lucide-react'
import {
  UserLibrary,
  LibraryItemReference,
  Song,
  GenericPresentation,
  MediaItem,
  YouTubeItem
} from '../../../shared/types'

interface LibraryPanelProps {
  libraries: UserLibrary[]
  activeLibraryId: string
  onSelectLibrary: (id: string) => void
  onCreateLibrary: (name: string) => void
  onRenameLibrary?: (id: string, newName: string) => void
  onReorderLibraries?: (orderedIds: string[]) => void
  onDeleteLibrary: (id: string) => void
  onMoveItem?: (itemRefId: string, targetLibraryId: string) => void
  songs: Song[]
  presentations: GenericPresentation[]
  mediaItems: MediaItem[]
  youtubeItems?: YouTubeItem[]
  onItemSelect: (itemType: string, itemId: string) => void
  onAddItemToPlaylist: (itemType: string, itemId: string, name: string) => void
  panelLabels?: {
    library: string
    playlist: string
    media: string
    audience: string
    stage: string
  }
  height?: number
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  libraries,
  activeLibraryId,
  onSelectLibrary,
  onCreateLibrary,
  onRenameLibrary,
  onReorderLibraries,
  onDeleteLibrary,
  onMoveItem,
  songs,
  presentations,
  mediaItems,
  youtubeItems,
  onItemSelect,
  onAddItemToPlaylist,
  panelLabels,
  height
}) => {
  const [isCreating, setIsCreating] = useState(false)
  const [newLibName, setNewLibName] = useState('')
  const [editingLibId, setEditingLibId] = useState<string | null>(null)
  const [editingLibName, setEditingLibName] = useState('')
  const [filterQuery, setFilterQuery] = useState('')
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current')
  const [libraryItemRefs, setLibraryItemRefs] = useState<LibraryItemReference[]>([])

  // Load item references for active library
  useEffect(() => {
    let isMounted = true
    if (window.churchPresenterApi?.getLibraryItems) {
      window.churchPresenterApi.getLibraryItems(activeLibraryId).then((refs) => {
        if (isMounted) setLibraryItemRefs(refs || [])
      }).catch(() => {})
    }
    return () => {
      isMounted = false
    }
  }, [activeLibraryId])

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newLibName.trim()) {
      onCreateLibrary(newLibName.trim())
      setNewLibName('')
      setIsCreating(false)
    }
  }

  const handleRenameSubmit = (id: string) => {
    if (editingLibName.trim() && onRenameLibrary) {
      onRenameLibrary(id, editingLibName.trim())
    }
    setEditingLibId(null)
  }

  const handleMoveLibOrder = (fromIdx: number, direction: 'up' | 'down') => {
    if (!onReorderLibraries) return
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1
    if (toIdx < 0 || toIdx >= libraries.length) return
    const updated = [...libraries]
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    onReorderLibraries(updated.map((l) => l.id))
  }

  // Build items list
  interface DisplayItem {
    id: string
    refId?: string
    type: string
    title: string
    subtitle?: string
    libraryId?: string
  }

  let itemsToDisplay: DisplayItem[] = []

  if (searchScope === 'all') {
    // Collect all items across all collections
    const songItems: DisplayItem[] = songs.map((s) => ({
      id: s.id,
      type: 'song',
      title: s.title,
      subtitle: s.author ? `Himno • ${s.author}` : 'Himno',
      libraryId: 'lib_songs'
    }))
    const presItems: DisplayItem[] = presentations.map((p) => ({
      id: p.id,
      type: 'presentation',
      title: p.title,
      subtitle: `Presentación • ${p.slides?.length || 0} diapos`,
      libraryId: 'lib_presentations'
    }))
    const mediaList: DisplayItem[] = mediaItems.map((m) => ({
      id: m.id,
      type: m.mediaType,
      title: m.originalName,
      subtitle: `${m.mediaType.toUpperCase()} • ${m.container || ''}`,
      libraryId: 'lib_videos'
    }))
    const ytList: DisplayItem[] = (youtubeItems || []).map((y) => ({
      id: y.id,
      type: 'youtube',
      title: y.title,
      subtitle: `YouTube • ${y.channelTitle || ''}`,
      libraryId: 'lib_youtube'
    }))
    itemsToDisplay = [...songItems, ...presItems, ...mediaList, ...ytList]
  } else {
    // Current library
    if (activeLibraryId === 'lib_songs') {
      itemsToDisplay = songs.map((s) => ({
        id: s.id,
        type: 'song',
        title: s.title,
        subtitle: s.author || 'Sin autor'
      }))
    } else if (activeLibraryId === 'lib_presentations') {
      itemsToDisplay = presentations.map((p) => ({
        id: p.id,
        type: 'presentation',
        title: p.title,
        subtitle: `${p.slides?.length || 0} diapositivas`
      }))
    } else if (activeLibraryId === 'lib_videos') {
      itemsToDisplay = mediaItems
        .filter((m) => m.mediaType === 'video')
        .map((m) => ({
          id: m.id,
          type: 'media',
          title: m.originalName,
          subtitle: `${Math.round(m.duration || 0)}s • ${m.container}`
        }))
    } else if (activeLibraryId === 'lib_youtube') {
      itemsToDisplay = (youtubeItems || []).map((y) => ({
        id: y.id,
        type: 'youtube',
        title: y.title,
        subtitle: y.channelTitle || 'YouTube'
      }))
    } else {
      // Custom user library or "Sin clasificar" or "Playlist anterior"
      if (libraryItemRefs.length > 0) {
        itemsToDisplay = libraryItemRefs.map((ref) => ({
          id: ref.itemId,
          refId: ref.id,
          type: ref.itemType,
          title: ref.name,
          subtitle: ref.subtitle || ref.itemType
        }))
      } else {
        // Fallback demo items if any
        itemsToDisplay = songs
          .slice(0, 3)
          .map((s) => ({ id: s.id, type: 'song', title: s.title, subtitle: s.author }))
      }
    }
  }

  const filteredItems = itemsToDisplay.filter(
    (item) =>
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'song':
        return <Music size={12} className="pro-lib-icon song" />
      case 'presentation':
      case 'powerpoint':
        return <FileText size={12} className="pro-lib-icon pres" />
      case 'pdf':
        return <BookOpen size={12} className="pro-lib-icon bible" />
      case 'video':
      case 'media':
        return <Video size={12} className="pro-lib-icon vid" />
      case 'image':
        return <Film size={12} className="pro-lib-icon vid" />
      case 'youtube':
        return (
          <span
            style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 800,
              padding: '1px 3px',
              borderRadius: 3,
              marginRight: 4
            }}
          >
            YT
          </span>
        )
      default:
        return <Folder size={12} className="pro-lib-icon custom" />
    }
  }

  const getLibraryFolderIcon = (id: string) => {
    switch (id) {
      case 'lib_songs':
        return <Music size={13} className="pro-lib-icon song" />
      case 'lib_presentations':
        return <FileText size={13} className="pro-lib-icon pres" />
      case 'lib_videos':
        return <Video size={13} className="pro-lib-icon vid" />
      case 'lib_recent':
        return <History size={13} className="pro-lib-icon hist" />
      default:
        return <Folder size={13} className="pro-lib-icon custom" />
    }
  }

  return (
    <div
      className="pro-library-panel zone-library"
      style={height ? { height: `${height}px`, flex: 'none' } : undefined}
    >
      {/* Library Collections Header */}
      <div className="pro-panel-header">
        <div className="pro-header-title-box">
          <Layers size={13} />
          <span className="pro-header-title">
            {panelLabels?.library ? panelLabels.library.toUpperCase() : 'LIBRARY'}
          </span>
        </div>
        <button
          className="pro-header-add-btn"
          onClick={() => setIsCreating(true)}
          title="Crear nueva biblioteca"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Creation Row */}
      {isCreating && (
        <form onSubmit={handleCreateSubmit} className="pro-lib-create-form">
          <input
            type="text"
            className="pro-lib-create-input"
            placeholder="Nombre de biblioteca..."
            autoFocus
            value={newLibName}
            onChange={(e) => setNewLibName(e.target.value)}
          />
          <button type="submit" className="pro-lib-btn-save" title="Guardar">
            ✓
          </button>
          <button
            type="button"
            className="pro-lib-btn-cancel"
            onClick={() => setIsCreating(false)}
            title="Cancelar"
          >
            ✕
          </button>
        </form>
      )}

      {/* Library Collections Tabs List */}
      <div className="pro-lib-folders-list">
        {libraries.map((lib, idx) => {
          const isActive = activeLibraryId === lib.id
          const isEditing = editingLibId === lib.id

          return (
            <div
              key={lib.id}
              className={`pro-lib-folder-row ${isActive ? 'active' : ''}`}
              onClick={() => onSelectLibrary(lib.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json'))
                  if (data?.refId && onMoveItem) {
                    onMoveItem(data.refId, lib.id)
                  }
                } catch {
                  // Ignore invalid drag payload
                }
              }}
            >
              <div className="pro-lib-folder-label">
                {getLibraryFolderIcon(lib.id)}
                {isEditing ? (
                  <input
                    type="text"
                    className="pro-lib-inline-rename-input"
                    value={editingLibName}
                    autoFocus
                    onChange={(e) => setEditingLibName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(lib.id)
                      if (e.key === 'Escape') setEditingLibId(null)
                    }}
                    onBlur={() => handleRenameSubmit(lib.id)}
                  />
                ) : (
                  <span>{lib.name}</span>
                )}
              </div>

              {!lib.isSpecial && (
                <div className="pro-lib-folder-actions" onClick={(e) => e.stopPropagation()}>
                  {idx > 0 && onReorderLibraries && (
                    <button
                      className="pro-lib-mini-btn"
                      onClick={() => handleMoveLibOrder(idx, 'up')}
                      title="Mover arriba"
                    >
                      <ChevronUp size={11} />
                    </button>
                  )}
                  {idx < libraries.length - 1 && onReorderLibraries && (
                    <button
                      className="pro-lib-mini-btn"
                      onClick={() => handleMoveLibOrder(idx, 'down')}
                      title="Mover abajo"
                    >
                      <ChevronDown size={11} />
                    </button>
                  )}
                  <button
                    className="pro-lib-mini-btn"
                    onClick={() => {
                      setEditingLibId(lib.id)
                      setEditingLibName(lib.name)
                    }}
                    title="Renombrar biblioteca"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    className="pro-lib-delete-btn"
                    onClick={() => {
                      if (
                        confirm(
                          `¿Está seguro de eliminar la biblioteca "${lib.name}"?\n\nLos elementos contenidos no se perderán y se moverán a "Sin clasificar".`
                        )
                      ) {
                        onDeleteLibrary(lib.id)
                      }
                    }}
                    title="Eliminar biblioteca (elementos pasan a Sin clasificar)"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Items list inside active library */}
      <div className="pro-lib-items-section">
        {/* Search Bar + Scope Selector */}
        <div className="pro-lib-search-bar-row">
          <div className="pro-lib-search-bar">
            <Search size={11} />
            <input
              type="text"
              className="search-input"
              placeholder={searchScope === 'all' ? 'Buscar en todas...' : 'Buscar en colección...'}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>
          <select
            className="pro-lib-scope-select"
            value={searchScope}
            onChange={(e) => setSearchScope(e.target.value as 'current' | 'all')}
            title="Ámbito de búsqueda"
          >
            <option value="current">Esta</option>
            <option value="all">Todas</option>
          </select>
        </div>

        <div className="pro-lib-items-list">
          {filteredItems.map((item) => (
            <div
              key={`${item.type}_${item.id}`}
              className="pro-lib-item-row library-item-card"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/json',
                  JSON.stringify({
                    type: item.type,
                    id: item.id,
                    refId: item.refId,
                    name: item.title
                  })
                )
              }}
              onClick={() => onItemSelect(item.type, item.id)}
              onDoubleClick={() => onAddItemToPlaylist(item.type, item.id, item.title)}
            >
              <div className="pro-lib-item-left">
                {getItemIcon(item.type)}
                <div className="pro-lib-item-text item-main-info">
                  <span className="pro-lib-item-title item-title">{item.title}</span>
                  {item.subtitle && <span className="pro-lib-item-sub item-meta">{item.subtitle}</span>}
                </div>
              </div>

              <div className="pro-lib-item-actions-right">
                {item.refId && onMoveItem && libraries.length > 1 && (
                  <select
                    className="pro-lib-move-select"
                    defaultValue=""
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      if (e.target.value && onMoveItem && item.refId) {
                        onMoveItem(item.refId, e.target.value)
                      }
                    }}
                    title="Mover elemento a otra biblioteca"
                  >
                    <option value="" disabled>
                      Mover a...
                    </option>
                    {libraries
                      .filter((l) => l.id !== activeLibraryId)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                )}
                <button
                  className="pro-lib-add-to-service-btn add-btn item-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddItemToPlaylist(item.type, item.id, item.title)
                  }}
                  title="Agregar a la Playlist de servicio"
                >
                  +
                </button>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="pro-lib-empty">
              {filterQuery ? 'No se encontraron coincidencias' : 'Sin elementos en esta colección'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
