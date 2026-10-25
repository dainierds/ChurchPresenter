import React, { useState } from 'react'
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
  ChevronRight,
  BookOpen
} from 'lucide-react'
import { UserLibrary, LibraryItemReference, Song, GenericPresentation, MediaItem, YouTubeItem } from '../../../shared/types'

interface LibraryPanelProps {
  libraries: UserLibrary[]
  activeLibraryId: string
  onSelectLibrary: (id: string) => void
  onCreateLibrary: (name: string) => void
  onDeleteLibrary: (id: string) => void
  songs: Song[]
  presentations: GenericPresentation[]
  mediaItems: MediaItem[]
  youtubeItems?: YouTubeItem[]
  onItemSelect: (itemType: string, itemId: string) => void
  onAddItemToPlaylist: (itemType: string, itemId: string, name: string) => void
}

export const LibraryPanel: React.FC<LibraryPanelProps> = ({
  libraries,
  activeLibraryId,
  onSelectLibrary,
  onCreateLibrary,
  onDeleteLibrary,
  songs,
  presentations,
  mediaItems,
  youtubeItems,
  onItemSelect,
  onAddItemToPlaylist
}) => {
  const [isCreating, setIsCreating] = useState(false)
  const [newLibName, setNewLibName] = useState('')
  const [filterQuery, setFilterQuery] = useState('')

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newLibName.trim()) {
      onCreateLibrary(newLibName.trim())
      setNewLibName('')
      setIsCreating(false)
    }
  }

  // Get active items based on active library
  let itemsToDisplay: { id: string; type: string; title: string; subtitle?: string }[] = []

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
    // Custom user library
    itemsToDisplay = songs
      .slice(0, 5)
      .map((s) => ({ id: s.id, type: 'song', title: s.title, subtitle: s.author }))
  }

  const filteredItems = itemsToDisplay.filter(
    (item) =>
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(filterQuery.toLowerCase()))
  )

  const getLibraryIcon = (id: string) => {
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
    <div className="pro-library-panel zone-library">
      {/* Library Collections Header */}
      <div className="pro-panel-header">
        <div className="pro-header-title-box">
          <Layers size={13} />
          <span className="pro-header-title">BIBLIOTECA</span>
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
          <button type="submit" className="pro-lib-btn-save">
            ✓
          </button>
          <button
            type="button"
            className="pro-lib-btn-cancel"
            onClick={() => setIsCreating(false)}
          >
            ✕
          </button>
        </form>
      )}

      {/* Library Collections Tabs List */}
      <div className="pro-lib-folders-list">
        {libraries.map((lib) => {
          const isActive = activeLibraryId === lib.id
          return (
            <div
              key={lib.id}
              className={`pro-lib-folder-row ${isActive ? 'active' : ''}`}
              onClick={() => onSelectLibrary(lib.id)}
            >
              <div className="pro-lib-folder-label">
                {getLibraryIcon(lib.id)}
                <span>{lib.name}</span>
              </div>
              {!lib.isSpecial && (
                <button
                  className="pro-lib-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`¿Eliminar la biblioteca "${lib.name}"?`)) {
                      onDeleteLibrary(lib.id)
                    }
                  }}
                  title="Eliminar biblioteca"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Items list inside active library */}
      <div className="pro-lib-items-section">
        <div className="pro-lib-search-bar">
          <Search size={11} />
          <input
            type="text"
            className="search-input"
            placeholder="Filtrar colección..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>

        <div className="pro-lib-items-list zone-content-list">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="pro-lib-item-row library-item-card"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  'application/json',
                  JSON.stringify({
                    type: item.type,
                    id: item.id,
                    name: item.title
                  })
                )
              }}
              onClick={() => onItemSelect(item.type, item.id)}
              onDoubleClick={() => onAddItemToPlaylist(item.type, item.id, item.title)}
            >
              <div className="pro-lib-item-text item-main-info">
                <span className="pro-lib-item-title item-title">{item.title}</span>
                {item.subtitle && <span className="pro-lib-item-sub item-meta">{item.subtitle}</span>}
              </div>
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
          ))}
          {filteredItems.length === 0 && (
            <div className="pro-lib-empty">Sin elementos en esta colección</div>
          )}
        </div>
      </div>
    </div>
  )
}
