import React, { useState } from 'react'
import {
  Folder,
  Video,
  Image as ImageIcon,
  Music,
  FileText,
  Upload,
  Search,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  Repeat,
  Play
} from 'lucide-react'
import { MediaItem, MediaType } from '../../../shared/types'

interface MediaDrawerProps {
  isOpen: boolean
  onToggle: () => void
  mediaItems: MediaItem[]
  onImportFile: () => void
  onImportFolder: () => void
  onPlayMedia: (item: MediaItem) => void
  onSetAsBackground: (item: MediaItem) => void
  panelLabels?: {
    library: string
    playlist: string
    media: string
    audience: string
    stage: string
  }
}

export const MediaDrawer: React.FC<MediaDrawerProps> = ({
  isOpen,
  onToggle,
  mediaItems,
  onImportFile,
  onImportFolder,
  onPlayMedia,
  onSetAsBackground,
  panelLabels
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [filterType, setFilterType] = useState<MediaType | 'all' | 'pdf'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [mediaZoom, setMediaZoom] = useState(40)

  const mediaLabel = panelLabels?.media ? panelLabels.media.toUpperCase() : 'MEDIOS'

  if (!isOpen) {
    return (
      <div className="pro-media-drawer-collapsed">
        <button className="pro-media-toggle-btn" onClick={onToggle}>
          <ChevronUp size={14} />
          <span>{mediaLabel}</span>
        </button>
      </div>
    )
  }

  // Filter media items
  const filtered = mediaItems.filter((item) => {
    if (filterType !== 'all' && item.mediaType !== filterType) return false
    if (selectedFolder === 'countdown') {
      if (!item.tags?.includes('cuenta_regresiva') && !item.originalName.toLowerCase().includes('conteo')) {
        return false
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.originalName.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  const thumbSize = Math.round(110 + (mediaZoom / 100) * 120)

  return (
    <div className="pro-media-drawer-expanded">
      {/* Drawer Control Bar */}
      <div className="pro-media-bar-top">
        <div className="pro-media-left-ctrls">
          <button className="pro-media-toggle-btn active" onClick={onToggle}>
            <ChevronDown size={14} />
            <span>MEDIOS</span>
          </button>
          <div className="pro-media-breadcrumb">
            <span>Biblioteca</span>
            <span>/</span>
            <span className="pro-bc-current">
              {selectedFolder === 'all'
                ? 'Todos los Medios'
                : selectedFolder === 'countdown'
                  ? 'Cuenta Regresiva'
                  : selectedFolder}
            </span>
          </div>
        </div>

        <div className="pro-media-actions-right">
          <button className="pro-btn-secondary" onClick={onImportFile} title="Importar archivos nativos">
            <Upload size={13} />
            <span>Importar Archivo</span>
          </button>
          <button className="pro-btn-secondary" onClick={onImportFolder} title="Importar carpeta completa">
            <Folder size={13} />
            <span>Importar Carpeta</span>
          </button>

          <div className="pro-zoom-controls">
            <ZoomOut size={11} />
            <input
              type="range"
              min="0"
              max="100"
              value={mediaZoom}
              onChange={(e) => setMediaZoom(Number(e.target.value))}
              className="pro-zoom-slider"
            />
            <ZoomIn size={11} />
          </div>
        </div>
      </div>

      {/* Main Drawer Body: Split Folder Tree & Media Grid */}
      <div className="pro-media-drawer-body">
        {/* Left Folder Tree */}
        <div className="pro-media-folder-tree">
          <div
            className={`pro-folder-node ${selectedFolder === 'all' ? 'active' : ''}`}
            onClick={() => {
              setSelectedFolder('all')
              setFilterType('all')
            }}
          >
            <Folder size={13} />
            <span>Todos los Medios ({mediaItems.length})</span>
          </div>
          <div
            className={`pro-folder-node ${filterType === 'video' ? 'active' : ''}`}
            onClick={() => {
              setSelectedFolder('videos')
              setFilterType('video')
            }}
          >
            <Video size={13} />
            <span>Videos de Fondo</span>
          </div>
          <div
            className={`pro-folder-node ${selectedFolder === 'countdown' ? 'active' : ''}`}
            onClick={() => {
              setSelectedFolder('countdown')
              setFilterType('all')
            }}
          >
            <Repeat size={13} />
            <span>Cuentas Regresivas</span>
          </div>
          <div
            className={`pro-folder-node ${filterType === 'image' ? 'active' : ''}`}
            onClick={() => {
              setSelectedFolder('images')
              setFilterType('image')
            }}
          >
            <ImageIcon size={13} />
            <span>Imágenes</span>
          </div>
          <div
            className={`pro-folder-node ${filterType === 'audio' ? 'active' : ''}`}
            onClick={() => {
              setSelectedFolder('audio')
              setFilterType('audio')
            }}
          >
            <Music size={13} />
            <span>Música Ambiental</span>
          </div>
          <div
            className={`pro-folder-node ${filterType === 'pdf' ? 'active' : ''}`}
            onClick={() => {
              setSelectedFolder('pdf')
              setFilterType('pdf')
            }}
          >
            <FileText size={13} />
            <span>Documentos PDF</span>
          </div>
        </div>

        {/* Right Thumbnails Grid */}
        <div className="pro-media-thumbs-pane">
          <div className="pro-media-filter-row">
            <Search size={12} className="pro-filter-icon" />
            <input
              type="text"
              placeholder="Buscar medios por nombre o etiqueta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pro-media-search-input"
            />
          </div>

          <div className="pro-media-grid">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="pro-media-card"
                style={{ width: thumbSize }}
                onDoubleClick={() => onPlayMedia(item)}
              >
                <div className="pro-media-thumb-box" style={{ height: Math.round(thumbSize * 0.6) }}>
                  {item.thumbnailPath ? (
                    <img src={`file:///${item.thumbnailPath.replace(/\\/g, '/')}`} alt="" />
                  ) : item.mediaType === 'video' ? (
                    <Video size={28} className="placeholder-icon" />
                  ) : item.mediaType === 'image' ? (
                    <ImageIcon size={28} className="placeholder-icon" />
                  ) : item.mediaType === 'audio' ? (
                    <Music size={28} className="placeholder-icon" />
                  ) : (
                    <FileText size={28} className="placeholder-icon" />
                  )}

                  {/* Duration badge if video or audio */}
                  {item.duration > 0 && (
                    <span className="pro-media-duration-badge">
                      {Math.floor(item.duration / 60)}:
                      {Math.floor(item.duration % 60)
                        .toString()
                        .padStart(2, '0')}
                    </span>
                  )}

                  {/* Action overlay on hover */}
                  <div className="pro-media-hover-overlay">
                    <button
                      className="pro-thumb-play-btn"
                      onClick={() => onPlayMedia(item)}
                      title="Reproducir / Proyectar"
                    >
                      <Play size={12} fill="currentColor" />
                    </button>
                    {(item.mediaType === 'video' || item.mediaType === 'image') && (
                      <button
                        className="pro-thumb-bg-btn"
                        onClick={() => onSetAsBackground(item)}
                        title="Enviar como fondo"
                      >
                        Fondo
                      </button>
                    )}
                  </div>
                </div>

                <div className="pro-media-card-name" title={item.originalName}>
                  {item.originalName}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="pro-media-empty">
                <span>No hay medios en esta categoría. Use "Importar" para añadir archivos.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
