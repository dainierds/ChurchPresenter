import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  BookOpen,
  Search,
  Star,
  Clock,
  Play,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Check,
  Grid,
  Palette,
  Edit2
} from 'lucide-react'
import {
  BibleSearchResult,
  BibleTranslationMeta,
  ServiceItem,
  SlideItem,
  ThemeConfig
} from '../../../shared/types'
import { BIBLE_BOOKS } from '../../../shared/bible-reference-parser'

interface BibleBrowserPanelProps {
  translations: BibleTranslationMeta[]
  primaryAbbrev: string
  secondaryAbbrev: string
  isDualActive: boolean
  dualLayout: 'stacked' | 'sideBySide'
  favorites: string[]
  recents: string[]
  directSlides: SlideItem[]
  currentReference: string
  themes?: ThemeConfig[]
  currentBibleThemeId?: string
  onLoadPassage: (reference: string, sendLiveImmediately?: boolean) => Promise<void>
  onSelectPrimary: (abbrev: string) => void
  onSelectSecondary: (abbrev: string) => void
  onToggleDual: (active: boolean) => void
  onChangeDualLayout: (layout: 'stacked' | 'sideBySide') => void
  onOpenBibleManager: () => void
  onOpenBibleImport: () => void
  onOpenThemeManager?: () => void
  onSelectBibleTheme?: (themeId: string) => void
  onGoLive: (slide: SlideItem, nextSlide?: SlideItem) => void
  onAddToService: (item: ServiceItem) => void
  onToggleFavorite?: (reference: string) => void
}

export const BibleBrowserPanel: React.FC<BibleBrowserPanelProps> = ({
  translations,
  primaryAbbrev,
  secondaryAbbrev,
  isDualActive,
  dualLayout,
  favorites,
  recents,
  directSlides,
  currentReference,
  themes,
  currentBibleThemeId,
  onLoadPassage,
  onSelectPrimary,
  onSelectSecondary,
  onToggleDual,
  onChangeDualLayout,
  onOpenBibleManager,
  onOpenBibleImport,
  onOpenThemeManager,
  onSelectBibleTheme,
  onGoLive,
  onAddToService,
  onToggleFavorite
}) => {
  const [searchMode, setSearchMode] = useState<'reference' | 'text' | 'picker'>('picker')
  const [refInput, setRefInput] = useState<string>(currentReference || 'Juan 3:16')
  const [textQuery, setTextQuery] = useState<string>('')
  const [testamentFilter, setTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL')
  const [isSearchingText, setIsSearchingText] = useState<boolean>(false)
  const [textResults, setTextResults] = useState<BibleSearchResult[]>([])
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number>(0)
  const [addedToast, setAddedToast] = useState<boolean>(false)
  const targetVerseNumRef = useRef<number | null>(null)

  // Auto-select and focus target verse slide when slides are loaded
  useEffect(() => {
    if (targetVerseNumRef.current !== null && directSlides.length > 0) {
      const vNum = targetVerseNumRef.current
      targetVerseNumRef.current = null
      const regex = new RegExp(`:${vNum}(\\b|-)`)
      let matchIdx = directSlides.findIndex((s) => regex.test(s.title || ''))
      if (matchIdx === -1) {
        matchIdx = directSlides.findIndex((s) => s.id?.includes(`_${vNum}_`) || regex.test(s.groupLabel || ''))
      }
      if (matchIdx !== -1) {
        setSelectedSlideIndex(matchIdx)
      } else if (vNum - 1 < directSlides.length && vNum - 1 >= 0) {
        setSelectedSlideIndex(vNum - 1)
      } else {
        setSelectedSlideIndex(0)
      }
    }
  }, [directSlides])

  // Scroll active slide into view smoothly
  useEffect(() => {
    if (searchMode === 'reference' && selectedSlideIndex >= 0) {
      const cardEl = document.getElementById(`bible-slide-card-${selectedSlideIndex}`)
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [selectedSlideIndex, searchMode])

  // Book & Chapter Picker states
  const [pickerTestament, setPickerTestament] = useState<'OT' | 'NT'>('NT')
  const [selectedBookNumber, setSelectedBookNumber] = useState<number>(40) // Default to Mateo
  const [selectedChapter, setSelectedChapter] = useState<number>(5)
  const [chapterVerseCount, setChapterVerseCount] = useState<number>(48)

  const currentBook = useMemo(() => {
    return BIBLE_BOOKS.find((b) => b.number === selectedBookNumber) || BIBLE_BOOKS[39]
  }, [selectedBookNumber])

  // Sync verse count for selected chapter in picker
  useEffect(() => {
    if (searchMode === 'picker' && currentBook && window.churchPresenterApi?.getVersesByReference) {
      window.churchPresenterApi
        .getVersesByReference(`${currentBook.name} ${selectedChapter}`, primaryAbbrev)
        .then((res: any) => {
          if (res?.verses && res.verses.length > 0) {
            setChapterVerseCount(res.verses.length)
          } else {
            setChapterVerseCount(35)
          }
        })
        .catch(() => {
          setChapterVerseCount(35)
        })
    }
  }, [searchMode, selectedBookNumber, selectedChapter, primaryAbbrev, currentBook])

  // Keep refInput in sync with active reference
  useEffect(() => {
    if (currentReference) {
      setRefInput(currentReference)
    }
  }, [currentReference])

  // Initial load if no slides yet
  useEffect(() => {
    if (directSlides.length === 0) {
      onLoadPassage(refInput || 'Juan 3:16', false)
    }
  }, [])

  const isCurrentFavorite = useMemo(() => {
    return favorites.includes(currentReference || refInput)
  }, [favorites, currentReference, refInput])

  const handleSearchReference = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!refInput.trim()) return
    await onLoadPassage(refInput.trim(), false)
  }

  const handleRunTextSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!textQuery.trim() || !window.churchPresenterApi?.searchBibleText) return
    setIsSearchingText(true)
    try {
      const filter = testamentFilter === 'ALL' ? undefined : { testament: testamentFilter }
      const results = await window.churchPresenterApi.searchBibleText(
        textQuery.trim(),
        primaryAbbrev,
        filter
      )
      setTextResults(results)
    } catch (err: any) {
      console.error('Error in Bible text search:', err)
    } finally {
      setIsSearchingText(false)
    }
  }

  const handleNavigateChapter = async (direction: 'prev' | 'next') => {
    const match = (currentReference || refInput).match(/^(\d?\s?[A-Za-zÁ-ú]+)\s+(\d+)/)
    if (match) {
      const book = match[1].trim()
      let chapter = parseInt(match[2], 10)
      if (direction === 'prev' && chapter > 1) {
        chapter -= 1
      } else if (direction === 'next') {
        chapter += 1
      }
      const newRef = `${book} ${chapter}`
      setRefInput(newRef)
      await onLoadPassage(newRef, false)
    }
  }

  const handleAddPassageToService = () => {
    const activeRef = currentReference || refInput || 'Lectura Bíblica'
    const item: ServiceItem = {
      id: `scripture_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'scripture',
      name: activeRef,
      scriptureRef: activeRef,
      bibleTranslation: primaryAbbrev,
      notes: `Traducción: ${primaryAbbrev}${isDualActive ? ` / ${secondaryAbbrev}` : ''}`
    }
    onAddToService(item)
    setAddedToast(true)
    setTimeout(() => setAddedToast(false), 2500)
  }

  return (
    <div
      className="pro-bible-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-base, #121212)',
        color: '#E0E0E0',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Toolbar: Mode selector, Translations, Admin */}
      <div
        className="pro-bible-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color, #262626)',
          backgroundColor: 'var(--bg-surface, #1A1A1A)',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} color="#3B82F6" />
            <span style={{ fontWeight: 600, fontSize: '14px', letterSpacing: '0.5px' }}>
              BIBLIA
            </span>
          </div>

          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#121212',
              borderRadius: '6px',
              padding: '3px',
              border: '1px solid #333333',
              gap: '4px'
            }}
          >
            {/* 1º SELECTOR DE LIBROS (Principal, llamativo y prioritario) */}
            <button
              type="button"
              className="bible-mode-picker-btn"
              onClick={() => setSearchMode('picker')}
              style={{
                background:
                  searchMode === 'picker'
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                    : 'rgba(56, 189, 248, 0.15)',
                color: searchMode === 'picker' ? '#FFFFFF' : '#38BDF8',
                border:
                  searchMode === 'picker'
                    ? '1px solid #38BDF8'
                    : '1px solid rgba(56, 189, 248, 0.45)',
                borderRadius: '5px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow:
                  searchMode === 'picker'
                    ? '0 0 12px rgba(56, 189, 248, 0.5)'
                    : 'none',
                transition: 'all 0.15s ease'
              }}
              title="Seleccionar visualmente Libro, Capítulo y Versículo"
            >
              <Grid size={13} color={searchMode === 'picker' ? '#FFFFFF' : '#38BDF8'} />
              <span>Selector de Libros</span>
            </button>

            {/* 2º IR A REFERENCIA */}
            <button
              type="button"
              className="bible-mode-ref-btn"
              onClick={() => setSearchMode('reference')}
              style={{
                background: searchMode === 'reference' ? '#2A2A2A' : 'transparent',
                color: searchMode === 'reference' ? '#FFFFFF' : '#888888',
                border: searchMode === 'reference' ? '1px solid #3F3F46' : '1px solid transparent',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Ir a Referencia
            </button>

            {/* 3º BÚSQUEDA DE TEXTO */}
            <button
              type="button"
              className="bible-mode-text-btn"
              onClick={() => setSearchMode('text')}
              style={{
                background: searchMode === 'text' ? '#2A2A2A' : 'transparent',
                color: searchMode === 'text' ? '#FFFFFF' : '#888888',
                border: searchMode === 'text' ? '1px solid #3F3F46' : '1px solid transparent',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Search size={12} />
              <span>Búsqueda de Texto</span>
            </button>
          </div>
        </div>

        {/* Translation Controls & Manager */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <span style={{ color: '#9CA3AF' }}>Traducción:</span>
            <select
              value={primaryAbbrev}
              onChange={(e) => onSelectPrimary(e.target.value)}
              style={{
                backgroundColor: '#262626',
                color: '#FFFFFF',
                border: '1px solid #3A3A3A',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {translations.map((t) => (
                <option key={t.id || t.abbrev} value={t.abbrev}>
                  {t.name} ({t.abbrev})
                </option>
              ))}
            </select>
          </div>

          {/* Dual Translation Toggle */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <input
              type="checkbox"
              checked={isDualActive}
              onChange={(e) => onToggleDual(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span style={{ color: '#D1D5DB' }}>Doble traducción</span>
          </label>

          {isDualActive && (
            <>
              <select
                value={secondaryAbbrev}
                onChange={(e) => onSelectSecondary(e.target.value)}
                style={{
                  backgroundColor: '#262626',
                  color: '#FFFFFF',
                  border: '1px solid #3A3A3A',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {translations.map((t) => (
                  <option key={`sec_${t.id || t.abbrev}`} value={t.abbrev}>
                    {t.abbrev}
                  </option>
                ))}
              </select>

              <select
                value={dualLayout}
                onChange={(e) => onChangeDualLayout(e.target.value as 'stacked' | 'sideBySide')}
                style={{
                  backgroundColor: '#262626',
                  color: '#FFFFFF',
                  border: '1px solid #3A3A3A',
                  borderRadius: '4px',
                  padding: '4px 6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
                title="Disposición de doble traducción"
              >
                <option value="stacked">Apilada</option>
                <option value="sideBySide">Lado a Lado</option>
              </select>
            </>
          )}

          <button
            type="button"
            onClick={onOpenBibleImport}
            className="pro-tool-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#262626',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 500
            }}
            title="Importar traducción bíblica (.sqlite, .db, .json, .xml, .osis, .usfm)"
          >
            <Plus size={13} />
            <span>Importar...</span>
          </button>

          <button
            type="button"
            onClick={onOpenBibleManager}
            className="pro-tool-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#262626',
              border: '1px solid #3A3A3A',
              color: '#D1D5DB',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Administrar traducciones de la Biblia"
          >
            <Sliders size={13} />
            <span>Administrar Biblias...</span>
          </button>

          {/* Bible Theme Selector */}
          {themes && themes.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#202024',
                border: '1px solid #3A3A3A',
                borderRadius: '4px',
                padding: '3px 8px'
              }}
              title="Tema visual y fondo utilizado para proyectar la Biblia"
            >
              <Palette size={13} color="#F97316" />
              <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>Tema:</span>
              <select
                value={currentBibleThemeId || ''}
                onChange={(e) => onSelectBibleTheme?.(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#F97316',
                  fontWeight: 700,
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {themes.map((th) => (
                  <option key={th.id} value={th.id} style={{ backgroundColor: '#1E1E1E', color: '#FFFFFF' }}>
                    {th.name} {th.id === currentBibleThemeId ? '✓' : ''}
                  </option>
                ))}
              </select>
              {onOpenThemeManager && (
                <button
                  type="button"
                  onClick={onOpenThemeManager}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Abrir editor de temas"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Mode Sub-Bar: Reference Input OR Text Search Bar */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-color, #262626)',
          backgroundColor: '#161616',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {searchMode === 'reference' ? (
          <form
            onSubmit={handleSearchReference}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => handleNavigateChapter('prev')}
                style={{
                  backgroundColor: '#262626',
                  border: '1px solid #3A3A3A',
                  color: '#D1D5DB',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Capítulo anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleNavigateChapter('next')}
                style={{
                  backgroundColor: '#262626',
                  border: '1px solid #3A3A3A',
                  color: '#D1D5DB',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Capítulo siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
              <input
                type="text"
                className="bible-reference-input"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="ej. Juan 3:16, Salmos 23, Génesis 1:1-5"
                style={{
                  width: '100%',
                  backgroundColor: '#202020',
                  color: '#FFFFFF',
                  border: '1px solid #3A3A3A',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              className="bible-go-btn"
              style={{
                backgroundColor: '#2563EB',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Ir a Pasaje
            </button>

            <button
              type="button"
              className="bible-open-picker-quick-btn"
              onClick={() => setSearchMode('picker')}
              style={{
                backgroundColor: '#262626',
                border: '1px solid #38BDF8',
                color: '#38BDF8',
                borderRadius: '4px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Abrir selector visual de libros, capítulos y versículos"
            >
              <Grid size={13} />
              <span>Explorar Libros...</span>
            </button>

            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(currentReference || refInput)}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #3A3A3A',
                  color: isCurrentFavorite ? '#F59E0B' : '#6B7280',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={isCurrentFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
              >
                <Star size={15} fill={isCurrentFavorite ? '#F59E0B' : 'none'} />
              </button>
            )}
          </form>
        ) : searchMode === 'text' ? (
          <form
            onSubmit={handleRunTextSearch}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
          >
            <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
              <input
                type="text"
                className="bible-text-input"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                placeholder="Buscar palabras o frases (ej. amor, salvación, luz)..."
                style={{
                  width: '100%',
                  backgroundColor: '#202020',
                  color: '#FFFFFF',
                  border: '1px solid #3A3A3A',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Testament Filter Pills */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                backgroundColor: '#121212',
                padding: '2px',
                borderRadius: '4px',
                border: '1px solid #333333'
              }}
            >
              <button
                type="button"
                onClick={() => setTestamentFilter('ALL')}
                style={{
                  background: testamentFilter === 'ALL' ? '#333333' : 'transparent',
                  color: testamentFilter === 'ALL' ? '#FFFFFF' : '#888888',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTestamentFilter('OT')}
                style={{
                  background: testamentFilter === 'OT' ? '#333333' : 'transparent',
                  color: testamentFilter === 'OT' ? '#FFFFFF' : '#888888',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                AT
              </button>
              <button
                type="button"
                onClick={() => setTestamentFilter('NT')}
                style={{
                  background: testamentFilter === 'NT' ? '#333333' : 'transparent',
                  color: testamentFilter === 'NT' ? '#FFFFFF' : '#888888',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                NT
              </button>
            </div>

            <button
              type="submit"
              className="bible-text-search-btn"
              disabled={isSearchingText}
              style={{
                backgroundColor: '#2563EB',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '4px',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {isSearchingText ? 'Buscando...' : 'Buscar'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: '#9CA3AF' }}>Navegador de Libros:</span>
              <strong style={{ color: '#FF7A00', fontSize: '14px' }}>{currentBook?.name}</strong>
              <span style={{ color: '#6B7280' }}>/</span>
              <strong style={{ color: '#38BDF8', fontSize: '14px' }}>Capítulo {selectedChapter}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setSearchMode('reference')}
                style={{
                  backgroundColor: '#262626',
                  color: '#D1D5DB',
                  border: '1px solid #3A3A3A',
                  borderRadius: '4px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Ver Diapositivas
              </button>
            </div>
          </div>
        )}

        {/* Quick Action Buttons for the Loaded Passage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              if (directSlides.length > 0) {
                const targetIdx =
                  selectedSlideIndex >= 0 && selectedSlideIndex < directSlides.length
                    ? selectedSlideIndex
                    : 0
                const s1 = directSlides[targetIdx]
                const s2 = directSlides[targetIdx + 1]
                onGoLive(
                  currentBibleThemeId ? { ...s1, themeId: currentBibleThemeId } : s1,
                  s2 && currentBibleThemeId ? { ...s2, themeId: currentBibleThemeId } : s2
                )
              }
            }}
            disabled={directSlides.length === 0}
            style={{
              backgroundColor: directSlides.length > 0 ? '#10B981' : '#2A2A2A',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: directSlides.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Proyectar inmediatamente el versículo seleccionado en la salida principal"
          >
            <Play size={13} fill="#FFFFFF" />
            <span>En Vivo</span>
          </button>

          <button
            type="button"
            onClick={handleAddPassageToService}
            disabled={directSlides.length === 0}
            style={{
              backgroundColor: '#374151',
              color: '#FFFFFF',
              border: '1px solid #4B5563',
              borderRadius: '4px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: directSlides.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Agregar esta lectura bíblica a la lista del servicio actual"
          >
            {addedToast ? <Check size={14} color="#10B981" /> : <Plus size={14} />}
            <span>{addedToast ? '¡Agregado!' : 'Al Servicio'}</span>
          </button>
        </div>
      </div>

      {/* 3. Favorites & Recent History Pills */}
      <div
        style={{
          padding: '6px 16px',
          borderBottom: '1px solid var(--border-color, #262626)',
          backgroundColor: '#141414',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          overflowX: 'auto',
          fontSize: '12px'
        }}
      >
        {favorites.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Star size={11} fill="#F59E0B" /> Favoritos:
            </span>
            {favorites.slice(0, 5).map((fav) => (
              <button
                key={`fav_${fav}`}
                type="button"
                onClick={() => {
                  setRefInput(fav)
                  onLoadPassage(fav, false)
                }}
                style={{
                  backgroundColor: '#262626',
                  border: '1px solid #3A3A3A',
                  color: '#E5E7EB',
                  borderRadius: '3px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {fav}
              </button>
            ))}
          </div>
        )}

        {recents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} /> Recientes:
            </span>
            {recents.slice(0, 6).map((rec) => (
              <button
                key={`rec_${rec}`}
                type="button"
                onClick={() => {
                  setRefInput(rec)
                  onLoadPassage(rec, false)
                }}
                style={{
                  backgroundColor: '#202020',
                  border: '1px solid #333333',
                  color: '#9CA3AF',
                  borderRadius: '3px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {rec}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4. Main Body: Split or Results list + Slides Grid OR Book Picker */}
      {searchMode === 'picker' ? (
        <div
          className="bible-book-picker-container"
          style={{
            display: 'grid',
            gridTemplateColumns: '320px 240px 1fr',
            flex: 1,
            overflow: 'hidden',
            backgroundColor: '#121212'
          }}
        >
          {/* Column 1: Books */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid #262626',
              backgroundColor: '#161616',
              overflow: 'hidden'
            }}
          >
            {/* Testament Switcher */}
            <div
              style={{
                display: 'flex',
                padding: '8px',
                gap: '6px',
                borderBottom: '1px solid #262626',
                backgroundColor: '#1A1A1A'
              }}
            >
              <button
                type="button"
                onClick={() => setPickerTestament('OT')}
                style={{
                  flex: 1,
                  padding: '7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: pickerTestament === 'OT' ? '#FF7A00' : '#222222',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Antiguo Testamento (39)
              </button>
              <button
                type="button"
                onClick={() => setPickerTestament('NT')}
                style={{
                  flex: 1,
                  padding: '7px',
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: pickerTestament === 'NT' ? '#38BDF8' : '#222222',
                  color: pickerTestament === 'NT' ? '#0A0A0A' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Nuevo Testamento (27)
              </button>
            </div>

            {/* List of Books */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {BIBLE_BOOKS.filter((b) => b.testament === pickerTestament).map((b) => {
                const isSelected = selectedBookNumber === b.number
                return (
                  <button
                    key={b.number}
                    type="button"
                    onClick={() => {
                      setSelectedBookNumber(b.number)
                      setSelectedChapter(1)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '3px',
                      borderRadius: '5px',
                      border: isSelected ? '1px solid #38BDF8' : '1px solid transparent',
                      textAlign: 'left',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                      color: isSelected ? '#38BDF8' : '#D1D5DB',
                      fontWeight: isSelected ? 700 : 400,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <span>{b.name}</span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>{b.chapterCount} caps</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Column 2: Chapters */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid #262626',
              backgroundColor: '#181818',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#9CA3AF',
                borderBottom: '1px solid #262626',
                backgroundColor: '#1A1A1A'
              }}
            >
              Capítulos de <strong style={{ color: '#FFFFFF' }}>{currentBook?.name}</strong>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                alignContent: 'start'
              }}
            >
              {Array.from({ length: currentBook?.chapterCount || 1 }, (_, i) => i + 1).map((cap) => {
                const isSelected = selectedChapter === cap
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setSelectedChapter(cap)}
                    style={{
                      padding: '10px 0',
                      borderRadius: '5px',
                      border: isSelected ? '1px solid #38BDF8' : '1px solid #2D2D2D',
                      backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.2)' : '#222222',
                      color: isSelected ? '#38BDF8' : '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {cap}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Column 3: Verses */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#141414',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#9CA3AF',
                borderBottom: '1px solid #262626',
                backgroundColor: '#1A1A1A',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                Versículos de <strong style={{ color: '#FF7A00' }}>{currentBook?.name} {selectedChapter}</strong>
              </div>
              <span style={{ fontSize: '11px', color: '#6B7280' }}>
                Selecciona un versículo para cargarlo y proyectarlo
              </span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))',
                gap: '8px',
                alignContent: 'start'
              }}
            >
              {Array.from({ length: chapterVerseCount > 0 ? chapterVerseCount : 35 }, (_, i) => i + 1).map((vNum) => (
                <button
                  key={vNum}
                  type="button"
                  onClick={async () => {
                    const bookName = currentBook?.name || 'Mateo'
                    const chapterRef = `${bookName} ${selectedChapter}`
                    targetVerseNumRef.current = vNum
                    setRefInput(`${chapterRef}:${vNum}`)
                    await onLoadPassage(chapterRef, false)
                    setSearchMode('reference')
                  }}
                  style={{
                    padding: '12px 0',
                    borderRadius: '5px',
                    border: '1px solid #2D2D2D',
                    backgroundColor: '#1E1E1E',
                    color: '#E5E7EB',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FF7A00'
                    e.currentTarget.style.color = '#FFFFFF'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#1E1E1E'
                    e.currentTarget.style.color = '#E5E7EB'
                  }}
                  title={`Cargar ${currentBook?.name} ${selectedChapter} y señalar versículo ${vNum}`}
                >
                  {vNum}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {/* If text search active and has results, show sidebar */}
        {searchMode === 'text' && textResults.length > 0 && (
          <div
            style={{
              width: '320px',
              borderRight: '1px solid #262626',
              backgroundColor: '#171717',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '8px 12px',
                fontSize: '11px',
                color: '#9CA3AF',
                borderBottom: '1px solid #262626',
                fontWeight: 600
              }}
            >
              {textResults.length} RESULTADOS ENCONTRADOS
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {textResults.map((res, i) => (
                <div
                  key={`res_${i}_${res.formattedReference}`}
                  className="bible-search-result-item"
                  onClick={() => {
                    setRefInput(res.formattedReference)
                    onLoadPassage(res.formattedReference, false)
                  }}
                  style={{
                    padding: '8px 10px',
                    backgroundColor: '#202020',
                    border: '1px solid #2D2D2D',
                    borderRadius: '4px',
                    marginBottom: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: '12px',
                      color: '#60A5FA',
                      marginBottom: '2px'
                    }}
                  >
                    {res.formattedReference}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#D1D5DB',
                      lineHeight: '1.4'
                    }}
                  >
                    {res.highlightedText || res.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slides Grid for the Loaded Scripture Passage */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#121212',
            overflow: 'hidden'
          }}
        >
          {/* Subheader with passage title */}
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid #222222',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#181818'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#F3F4F6' }}>
                {currentReference || refInput}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  backgroundColor: '#262626',
                  color: '#9CA3AF',
                  padding: '2px 6px',
                  borderRadius: '3px'
                }}
              >
                {primaryAbbrev}
                {isDualActive ? ` + ${secondaryAbbrev}` : ''}
              </span>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>
                ({directSlides.length} diapositiva{directSlides.length !== 1 ? 's' : ''})
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280' }}>
              Doble clic para proyectar en vivo • Clic para seleccionar
            </div>
          </div>

          {/* Cards Grid */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '14px',
              alignContent: 'start'
            }}
          >
            {directSlides.length === 0 ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  padding: '60px 20px',
                  textAlign: 'center',
                  color: '#6B7280'
                }}
              >
                <BookOpen size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <div style={{ fontSize: '15px', color: '#9CA3AF' }}>
                  No hay pasaje cargado
                </div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  Escriba una referencia arriba (ej. "Salmos 23") y presione Enter o "Ir a Pasaje".
                </div>
              </div>
            ) : (
              directSlides.map((slide, index) => {
                const isSelected = selectedSlideIndex === index
                return (
                  <div
                    key={slide.id || `slide_${index}`}
                    id={`bible-slide-card-${index}`}
                    className={`pro-bible-slide-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setSelectedSlideIndex(index)
                      const s2 = directSlides[index + 1]
                      onGoLive(
                        currentBibleThemeId ? { ...slide, themeId: currentBibleThemeId } : slide,
                        s2 && currentBibleThemeId ? { ...s2, themeId: currentBibleThemeId } : s2
                      )
                    }}
                    onDoubleClick={() => {
                      setSelectedSlideIndex(index)
                      const s2 = directSlides[index + 1]
                      onGoLive(
                        currentBibleThemeId ? { ...slide, themeId: currentBibleThemeId } : slide,
                        s2 && currentBibleThemeId ? { ...s2, themeId: currentBibleThemeId } : s2
                      )
                    }}
                    style={{
                      aspectRatio: '16 / 9',
                      backgroundColor: isSelected ? '#122338' : '#1E1E1E',
                      borderRadius: '6px',
                      border: isSelected
                        ? '2px solid #38BDF8'
                        : '1px solid #333333',
                      boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.45)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '12px',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isSelected ? '#38BDF8' : '#60A5FA',
                            textTransform: 'uppercase'
                          }}
                        >
                          {slide.title || `Versículo ${index + 1}`}
                        </span>
                        {isSelected && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              backgroundColor: '#0284C7',
                              color: '#FFFFFF',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              letterSpacing: '0.5px'
                            }}
                          >
                            SELECCIONADO
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          color: isSelected ? '#93C5FD' : '#6B7280',
                          backgroundColor: isSelected ? '#0B1726' : '#141414',
                          padding: '1px 5px',
                          borderRadius: '3px'
                        }}
                      >
                        {index + 1} / {directSlides.length}
                      </span>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        fontSize: '12px',
                        lineHeight: '1.4',
                        color: '#E5E7EB',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {slide.body}
                    </div>

                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '10px',
                        color: '#9CA3AF',
                        textAlign: 'right'
                      }}
                    >
                      {slide.subtitle || primaryAbbrev}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
