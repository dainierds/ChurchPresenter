import React from 'react'
import {
  Grid,
  List,
  Plus,
  Edit3,
  ZoomIn,
  ZoomOut,
  Radio
} from 'lucide-react'
import { SlideItem, ThemeConfig } from '../../../shared/types'
import { toMediaUrl } from '../../../shared/media-url'

interface SlideGridPanelProps {
  title: string
  subtitle?: string
  slides: SlideItem[]
  selectedSlideIndex: number
  onSelectSlideIndex: (index: number) => void
  liveSlideId: string | null
  onGoLive: (slide: SlideItem, nextSlide?: SlideItem) => void
  zoomLevel: number
  onZoomChange: (zoom: number) => void
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onAddSlide: () => void
  onOpenEditor: () => void
  theme: ThemeConfig
  allThemes?: ThemeConfig[]
  elementThemeId?: string
  onSelectTheme?: (themeId: string) => void
  arrangements?: { id: string; name: string }[]
  selectedArrangementId?: string
  onSelectArrangement?: (id: string) => void
}

export const SlideGridPanel: React.FC<SlideGridPanelProps> = ({
  title,
  subtitle,
  slides,
  selectedSlideIndex,
  onSelectSlideIndex,
  liveSlideId,
  onGoLive,
  zoomLevel,
  onZoomChange,
  viewMode,
  onViewModeChange,
  onAddSlide,
  onOpenEditor,
  theme,
  allThemes,
  elementThemeId,
  onSelectTheme,
  arrangements,
  selectedArrangementId,
  onSelectArrangement
}) => {
  // Helper to give distinct badges per group type
  const getGroupBadgeClass = (label?: string) => {
    if (!label) return 'default'
    const l = label.toLowerCase()
    if (l.includes('verso') || l.includes('verse')) return 'verse'
    if (l.includes('coro') || l.includes('chorus')) return 'chorus'
    if (l.includes('puente') || l.includes('bridge')) return 'bridge'
    if (l.includes('intro') || l.includes('intro')) return 'intro'
    if (l.includes('final') || l.includes('outro')) return 'outro'
    return 'default'
  }

  // Calculate slide thumbnail width based on zoom slider (range 140px to 380px)
  const cardWidth = Math.round(140 + (zoomLevel / 100) * 240)
  const cardHeight = Math.round(cardWidth * 0.5625) // 16:9 ratio

  return (
    <div className="pro-slide-panel zone-slides">
      {/* Slide Header Toolbar */}
      <div className="pro-slide-header-bar">
        <div className="pro-slide-title-area">
          <h2 className="pro-slide-main-title" title={title || 'Sin elemento seleccionado'}>
            {title || 'Sin elemento seleccionado'}
          </h2>
          {subtitle && (
            <span className="pro-slide-subtitle" title={subtitle}>
              {subtitle}
            </span>
          )}
        </div>

        {/* Arrangements switcher if available */}
        {arrangements && arrangements.length > 0 && onSelectArrangement && (
          <div className="pro-arrangement-selector">
            <span className="pro-arr-label">Arreglo:</span>
            <select
              value={selectedArrangementId || ''}
              onChange={(e) => onSelectArrangement(e.target.value)}
              className="pro-arr-select"
            >
              <option value="">Por defecto</option>
              {arrangements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Element Theme Selector */}
        {allThemes && allThemes.length > 0 && onSelectTheme && (
          <div className="pro-arrangement-selector" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="pro-arr-label" style={{ color: '#f97316', fontWeight: 600 }}>Tema:</span>
            <select
              value={elementThemeId || ''}
              onChange={(e) => onSelectTheme(e.target.value)}
              className="pro-arr-select"
              title="Tema asignado a este elemento específico"
            >
              <option value="">(Predeterminado del tipo)</option>
              {allThemes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pro-slide-tools-right">
          <button className="pro-btn-secondary" onClick={onAddSlide} title="Agregar Diapositiva">
            <Plus size={13} />
            <span>Diapositiva</span>
          </button>
          <button className="pro-btn-secondary" onClick={onOpenEditor} title="Editar Contenido">
            <Edit3 size={13} />
            <span>Editar</span>
          </button>

          {/* View Mode Switcher */}
          <div className="pro-view-mode-toggle">
            <button
              className={`pro-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => onViewModeChange('grid')}
              title="Vista en Cuadrícula"
            >
              <Grid size={13} />
            </button>
            <button
              className={`pro-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => onViewModeChange('list')}
              title="Vista en Lista"
            >
              <List size={13} />
            </button>
          </div>

          {/* Zoom Slider */}
          <div className="pro-zoom-controls" title="Zoom de miniaturas">
            <ZoomOut size={12} />
            <input
              type="range"
              min="0"
              max="100"
              value={zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="pro-zoom-slider"
            />
            <ZoomIn size={12} />
          </div>
        </div>
      </div>

      {/* Slides Presentation Container */}
      <div className="pro-slide-scroll-area">
        {viewMode === 'grid' ? (
          <div className="pro-slide-grid">
            {slides.map((slide, idx) => {
              const isSelected = selectedSlideIndex === idx
              const isLive = liveSlideId === slide.id
              const badgeClass = getGroupBadgeClass(slide.groupLabel)

              return (
                <div
                  key={slide.id}
                  className={`pro-slide-card slide-card ${isSelected ? 'selected selected-preview' : ''} ${
                    isLive ? 'is-live' : ''
                  }`}
                  style={{ width: cardWidth }}
                  onClick={() => onSelectSlideIndex(idx)}
                  onDoubleClick={() => onGoLive(slide, slides[idx + 1])}
                >
                  {/* Card Header (Group & Slide Number) */}
                  <div className="pro-slide-card-header">
                    <span
                      className={`pro-slide-badge ${badgeClass}`}
                      title={slide.groupLabel || `Diapositiva ${idx + 1}`}
                    >
                      {slide.groupLabel || `Diapositiva ${idx + 1}`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {(slide.macroTrigger?.onEnterMacroId || slide.macroTrigger?.onExitMacroId) && (
                        <span style={{ fontSize: '9px', backgroundColor: '#FF7A00', color: '#ffffff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }} title="Tiene macro asignada">
                          ⚡ M
                        </span>
                      )}
                      <span className="pro-slide-index-number">{idx + 1}</span>
                    </div>
                  </div>

                  {/* 16:9 Thumbnail Body */}
                  <div
                    className="pro-slide-thumbnail-box"
                    style={{
                      height: cardHeight,
                      fontFamily: theme.fontFamily || 'sans-serif',
                      background:
                        slide.background?.type === 'image'
                          ? `url(${slide.background.value}) center/cover no-repeat`
                          : slide.background?.value ||
                            (theme.background?.type === 'image'
                              ? `url(${theme.background.value}) center/cover no-repeat`
                              : theme.background?.value || '#181818')
                    }}
                  >
                    {slide.mediaUrl && slide.mediaType === 'image' && (
                      <img src={toMediaUrl(slide.mediaUrl)} alt="" className="pro-slide-thumb-img" />
                    )}
                    <div
                      className="pro-slide-text-preview"
                      style={{
                        fontFamily: theme.fontFamily || 'sans-serif',
                        color: theme.color || '#ffffff',
                        textAlign: (theme.alignment || 'center') as any
                      }}
                    >
                      {slide.body}
                    </div>

                    {isLive && (
                      <div className="pro-slide-live-overlay">
                        <span className="pro-live-tag">
                          <Radio size={11} /> EN VIVO
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="pro-slide-list">
            {slides.map((slide, idx) => {
              const isSelected = selectedSlideIndex === idx
              const isLive = liveSlideId === slide.id
              const badgeClass = getGroupBadgeClass(slide.groupLabel)

              return (
                <div
                  key={slide.id}
                  className={`pro-slide-list-row ${isSelected ? 'selected' : ''} ${
                    isLive ? 'is-live' : ''
                  }`}
                  onClick={() => onSelectSlideIndex(idx)}
                  onDoubleClick={() => onGoLive(slide, slides[idx + 1])}
                >
                  <span className="pro-list-idx">{idx + 1}</span>
                  {(slide.macroTrigger?.onEnterMacroId || slide.macroTrigger?.onExitMacroId) && (
                    <span style={{ fontSize: '9px', backgroundColor: '#FF7A00', color: '#ffffff', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }} title="Tiene macro asignada">
                      ⚡ M
                    </span>
                  )}
                  <span
                    className={`pro-slide-badge ${badgeClass}`}
                    title={slide.groupLabel || 'Diapositiva'}
                  >
                    {slide.groupLabel || 'Diapositiva'}
                  </span>
                  <div className="pro-list-text">{slide.body}</div>
                  {isLive && (
                    <span className="pro-live-tag">
                      <Radio size={11} /> EN VIVO
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {slides.length === 0 && (
          <div className="pro-slide-empty-state">
            <span>
              {title
                ? `Sección "${title}": Arrastre aquí videos, canciones o medios para agregar a esta sección.`
                : 'Seleccione un elemento del servicio para previsualizar sus diapositivas.'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
