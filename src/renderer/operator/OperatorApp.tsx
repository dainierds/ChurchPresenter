import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  DisplayInfo,
  PresenterState,
  RoleAssignment,
  STANDARD_OUTPUT_ROLES,
  SlideItem,
  AppShortcutsConfig,
  DEFAULT_SHORTCUTS,
  AppNotification,
  Song,
  GenericPresentation,
  ThemeConfig,
  ServicePlan,
  ServiceItem,
  BackgroundImageItem,
  SongGroup,
  DEFAULT_THEME,
  BibleTranslationMeta,
  BibleSearchResult,
  MediaItem,
  MediaType,
  RoleBibleConfigsMap,
  DEFAULT_ROLE_BIBLE_CONFIGS,
  IndependentAudioState
} from '../../shared/types'
import { formatDisplayTitle, matchDisplayByStableId } from '../../shared/display-utils'
import {
  parseLyricsToGroups,
  buildSlidesFromSong,
  splitGroupContentIntoSlides
} from '../../shared/song-parser'
import { searchItems } from '../../shared/search-utils'
import { createServiceFromTemplate, duplicateService } from '../../shared/service-utils'
import { parseBibleReference } from '../../shared/bible-reference-parser'
import {
  Monitor,
  Eye,
  Slash,
  Snowflake,
  ShieldCheck,
  Play,
  Settings,
  FolderOpen,
  X,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  Copy,
  ArrowUp,
  ArrowDown,
  Search,
  Music,
  FileText,
  Layers,
  Image as ImageIcon,
  Palette,
  Undo,
  Redo,
  Send,
  Minus,
  Sparkles,
  Download,
  Upload,
  BookOpen,
  Star,
  History,
  Book,
  Video,
  Volume2,
  VolumeX,
  Square,
  Pause,
  RotateCcw
} from 'lucide-react'
import './operator.css'

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec < 0) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const OperatorApp: React.FC = () => {
  // Screens & Assignments
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment>({})
  const [state, setState] = useState<PresenterState | null>(null)
  const [shortcuts, setShortcuts] = useState<AppShortcutsConfig>(DEFAULT_SHORTCUTS)
  const [appVersion, setAppVersion] = useState<string>('1.0.0')

  // Phase 3 & 4 Data Collections
  const [songs, setSongs] = useState<Song[]>([])
  const [presentations, setPresentations] = useState<GenericPresentation[]>([])
  const [themes, setThemes] = useState<ThemeConfig[]>([])
  const [services, setServices] = useState<ServicePlan[]>([])
  const [templates, setTemplates] = useState<ServicePlan[]>([])
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImageItem[]>([])

  // Bible State
  const [bibleTranslations, setBibleTranslations] = useState<BibleTranslationMeta[]>([])
  const [primaryBibleAbbrev, setPrimaryBibleAbbrev] = useState<string>('RVR1909')
  const [secondaryBibleAbbrev, setSecondaryBibleAbbrev] = useState<string>('KJV')
  const [isDualBibleActive, setIsDualBibleActive] = useState<boolean>(false)
  const [dualBibleLayout, setDualBibleLayout] = useState<'stacked' | 'sideBySide'>('stacked')
  const [bibleRefInput, setBibleRefInput] = useState<string>('Juan 3:16')
  const [currentLoadedBibleRef, setCurrentLoadedBibleRef] = useState<string>('Juan 3:16')
  const [bibleFavorites, setBibleFavorites] = useState<string[]>([])
  const [bibleRecentHistory, setBibleRecentHistory] = useState<string[]>([])
  const [bibleSearchMode, setBibleSearchMode] = useState<'reference' | 'text'>('reference')
  const [bibleTextQuery, setBibleTextQuery] = useState<string>('')
  const [bibleSearchResults, setBibleSearchResults] = useState<BibleSearchResult[]>([])
  const [bibleTestamentFilter, setBibleTestamentFilter] = useState<'ALL' | 'OT' | 'NT'>('ALL')
  const [bibleDirectSlides, setBibleDirectSlides] = useState<SlideItem[]>([])

  // Active Service & Current Selection
  const [currentService, setCurrentService] = useState<ServicePlan | null>(null)
  const [selectedServiceItemIndex, setSelectedServiceItemIndex] = useState<number>(0)
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | undefined>(undefined)

  // Slides & Live Projection
  const [previewSlideIndex, setPreviewSlideIndex] = useState<number>(0)
  const [liveSlideId, setLiveSlideId] = useState<string | null>(null)
  const [liveSourceId, setLiveSourceId] = useState<string | null>(null)
  const [isLiveDirty, setIsLiveDirty] = useState<boolean>(false)

  // Stage Message Bar
  const [stageMessageText, setStageMessageText] = useState<string>('')
  const [isStageMessageActive, setIsStageMessageActive] = useState<boolean>(false)

  // Zone 1 Library State ('songs' | 'presentations' | 'bible' | 'media')
  const [libraryTab, setLibraryTab] = useState<'songs' | 'presentations' | 'bible' | 'media'>('songs')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Phase 5A: Media Library State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [mediaFilterType, setMediaFilterType] = useState<MediaType | 'all'>('all')
  const [isMediaImportModalOpen, setIsMediaImportModalOpen] = useState<boolean>(false)
  const [importMediaFilePath, setImportMediaFilePath] = useState<string>('')
  const [importMediaTags, setImportMediaTags] = useState<string>('')

  // Role Bible Configs (Doble traducción por rol de salida)
  const [roleBibleConfigs, setRoleBibleConfigs] = useState<RoleBibleConfigsMap>({ ...DEFAULT_ROLE_BIBLE_CONFIGS })
  const [audioOutputRole, setAudioOutputRole] = useState<string>('main')

  // Video Transport State
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0)
  const [videoDuration, setVideoDuration] = useState<number>(0)
  const [videoVolume, setVideoVolume] = useState<number>(1.0)
  const [videoLoop, setVideoLoop] = useState<boolean>(false)
  const [videoInPoint, setVideoInPoint] = useState<number>(0)
  const [videoOutPoint, setVideoOutPoint] = useState<number>(0)
  const [videoEndAction, setVideoEndAction] = useState<'freeze' | 'background' | 'next'>('freeze')

  // Independent Background Audio State
  const [independentAudio, setIndependentAudio] = useState<IndependentAudioState>({
    isPlaying: false,
    mediaId: null,
    filePath: null,
    title: null,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isFadingOut: false
  })

  // PDF Page Navigation State
  const [pdfPageCount, setPdfPageCount] = useState<number>(1)
  const [pdfFitMode, setPdfFitMode] = useState<'contain' | 'cover' | 'center'>('contain')

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [isDisplaysModalOpen, setIsDisplaysModalOpen] = useState<boolean>(false)
  const [isSongEditorOpen, setIsSongEditorOpen] = useState<boolean>(false)
  const [isPresentationEditorOpen, setIsPresentationEditorOpen] = useState<boolean>(false)
  const [isThemesModalOpen, setIsThemesModalOpen] = useState<boolean>(false)
  const [isBackgroundsModalOpen, setIsBackgroundsModalOpen] = useState<boolean>(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false)
  const [isBibleImportModalOpen, setIsBibleImportModalOpen] = useState<boolean>(false)
  const [isBibleManagerModalOpen, setIsBibleManagerModalOpen] = useState<boolean>(false)
  const [showFirstLaunchModal, setShowFirstLaunchModal] = useState<boolean>(false)

  // Bible Import Form State
  const [importFormat, setImportFormat] = useState<'zefania' | 'osis' | 'usfm' | 'json'>('json')
  const [importName, setImportName] = useState<string>('')
  const [importAbbrev, setImportAbbrev] = useState<string>('')
  const [importLang, setImportLang] = useState<string>('es')
  const [importCopyright, setImportCopyright] = useState<string>('Dominio Público')
  const [importRawContent, setImportRawContent] = useState<string>('')
  const [importConsent, setImportConsent] = useState<boolean>(false)

  // Editing Song / Presentation State
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [editingSongLyricsRaw, setEditingSongLyricsRaw] = useState<string>('')
  const [songGroupsHistory, setSongGroupsHistory] = useState<SongGroup[][]>([])
  const [songHistoryIndex, setSongHistoryIndex] = useState<number>(-1)

  const [editingPresentation, setEditingPresentation] = useState<GenericPresentation | null>(null)
  const [tempShortcuts, setTempShortcuts] = useState<AppShortcutsConfig>(DEFAULT_SHORTCUTS)
  const [toasts, setToasts] = useState<AppNotification[]>([])

  // Load initial data
  const loadAllData = useCallback(async () => {
    try {
      const [
        disp,
        assigns,
        prsState,
        ver,
        sc,
        songList,
        presList,
        themeList,
        servList,
        tempList,
        bgList,
        bTranslations,
        bFavs,
        bRecents,
        mediaList,
        rbConfigs
      ] = await Promise.all([
        window.churchPresenterApi.getDisplays(),
        window.churchPresenterApi.getRoleAssignments(),
        window.churchPresenterApi.getState(),
        window.churchPresenterApi.getAppVersion(),
        window.churchPresenterApi.getShortcuts(),
        window.churchPresenterApi.getSongs(),
        window.churchPresenterApi.getPresentations(),
        window.churchPresenterApi.getThemes(),
        window.churchPresenterApi.getServices(),
        window.churchPresenterApi.getTemplates(),
        window.churchPresenterApi.getBackgroundImages(),
        window.churchPresenterApi.getBibleTranslations(),
        window.churchPresenterApi.getBibleFavorites(),
        window.churchPresenterApi.getBibleRecentHistory(),
        window.churchPresenterApi.getMediaItems(),
        window.churchPresenterApi.getRoleBibleConfigs()
      ])

      setDisplays(disp)
      setAssignments(assigns)
      setState(prsState)
      setAppVersion(ver)
      setShortcuts(sc)
      setTempShortcuts(sc)
      setSongs(songList)
      setPresentations(presList)
      setThemes(themeList)
      setServices(servList)
      setTemplates(tempList)
      setBackgroundImages(bgList)
      setBibleTranslations(bTranslations)
      setBibleFavorites(bFavs)
      setBibleRecentHistory(bRecents)
      setMediaItems(mediaList)
      if (rbConfigs) setRoleBibleConfigs(rbConfigs)

      if (servList.length > 0 && !currentService) {
        setCurrentService(servList[0])
      }

      // Check first launch demo prompt
      const seen = localStorage.getItem('cp_demo_prompt_seen')
      if (!seen) {
        setShowFirstLaunchModal(true)
      }
    } catch (err) {
      console.error('Failed to load initial data:', err)
    }
  }, [currentService])

  useEffect(() => {
    loadAllData()

    const unsubDisplays = window.churchPresenterApi.onDisplaysChanged((newDisplays) => {
      setDisplays(newDisplays)
      window.churchPresenterApi.getRoleAssignments().then(setAssignments)
    })

    const unsubState = window.churchPresenterApi.onStateUpdated((newState) => {
      setState(newState)
      if (newState.currentSlide?.id) {
        setLiveSlideId(newState.currentSlide.id)
      }
      if (newState.mediaSyncTick) {
        setVideoCurrentTime(newState.mediaSyncTick.currentTime)
        setVideoDuration(newState.mediaSyncTick.duration)
        setIsVideoPlaying(newState.mediaSyncTick.isPlaying)
      }
      if (newState.independentAudio) {
        setIndependentAudio(newState.independentAudio)
      }
      if (newState.roleBibleConfigs) {
        setRoleBibleConfigs(newState.roleBibleConfigs)
      }
    })

    const unsubNotif = window.churchPresenterApi.onNotification((notif) => {
      setToasts((prev) => [...prev, notif])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notif.id))
      }, 4500)
    })

    return () => {
      unsubDisplays()
      unsubState()
      unsubNotif()
    }
  }, [loadAllData])

  // Current service item
  const currentServiceItem: ServiceItem | undefined =
    currentService?.items[selectedServiceItemIndex]

  // Resolved current item data
  const currentSong = useMemo(() => {
    if (currentServiceItem?.type === 'song' && currentServiceItem.songId) {
      return songs.find((s) => s.id === currentServiceItem.songId)
    }
    return null
  }, [currentServiceItem, songs])

  const currentPresentation = useMemo(() => {
    if (currentServiceItem?.type === 'presentation' && currentServiceItem.presentationId) {
      return presentations.find((p) => p.id === currentServiceItem.presentationId)
    }
    return null
  }, [currentServiceItem, presentations])

  // Load Bible passage into direct Bible slides
  const loadBiblePassage = useCallback(
    async (reference: string, sendLiveImmediately: boolean = false) => {
      try {
        const secAbbrev = isDualBibleActive ? secondaryBibleAbbrev : undefined
        const res = await window.churchPresenterApi.getVersesByReference(
          reference,
          primaryBibleAbbrev,
          secAbbrev
        )

        setCurrentLoadedBibleRef(res.parsed.formattedReference)
        setBibleRefInput(res.parsed.formattedReference)

        const slides = await window.churchPresenterApi.generateBibleSlides(
          res.verses,
          res.secondaryVerses,
          dualBibleLayout
        )
        setBibleDirectSlides(slides)

        // Record recent history
        await window.churchPresenterApi.addBibleRecentHistory(res.parsed.formattedReference)
        const updatedRecents = await window.churchPresenterApi.getBibleRecentHistory()
        setBibleRecentHistory(updatedRecents)

        if (sendLiveImmediately && slides.length > 0) {
          handleGoLive(slides[0], slides[1])
        }
      } catch (err: any) {
        alert(err.message || 'Error al buscar referencia bíblica')
      }
    },
    [isDualBibleActive, secondaryBibleAbbrev, primaryBibleAbbrev, dualBibleLayout]
  )

  // Generated slides for the currently selected item in Zone 3
  const activeSlides: SlideItem[] = useMemo(() => {
    // If operator is on Bible tab and has searched/loaded a passage directly, prioritize Bible slides
    if (libraryTab === 'bible' && bibleDirectSlides.length > 0) {
      return bibleDirectSlides
    }

    if (!currentServiceItem) return []

    if (currentServiceItem.type === 'blank') {
      return [
        {
          id: `blank_${currentServiceItem.id}`,
          sourceId: currentServiceItem.id,
          sourceType: 'blank',
          groupLabel: 'En Blanco',
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          body: '',
          subtitle: ''
        }
      ]
    }

    if (currentServiceItem.type === 'header') {
      return [
        {
          id: `header_${currentServiceItem.id}`,
          sourceId: currentServiceItem.id,
          sourceType: 'blank',
          groupLabel: 'Separador',
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          body: currentServiceItem.notes || '',
          subtitle: 'Separador de Servicio'
        }
      ]
    }

    if (currentServiceItem.type === 'scripture' && currentServiceItem.scriptureRef) {
      if (bibleDirectSlides.length > 0) {
        return bibleDirectSlides
      }
      return [
        {
          id: `scr_${currentServiceItem.id}`,
          sourceId: currentServiceItem.id,
          sourceType: 'scripture',
          groupLabel: currentServiceItem.name,
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          body: 'Cargando pasaje bíblico...',
          subtitle: currentServiceItem.name
        }
      ]
    }

    if (currentSong) {
      const arrangementId =
        selectedArrangementId ||
        currentServiceItem.arrangementId ||
        currentSong.arrangements.find((a) => a.isDefault)?.id
      return buildSlidesFromSong(currentSong, arrangementId)
    }

    if (currentPresentation) {
      return currentPresentation.slides.map((s, idx) => ({
        id: s.id,
        sourceId: currentPresentation.id,
        sourceType: 'presentation' as const,
        groupLabel: `Diapositiva ${idx + 1}`,
        slideIndex: idx + 1,
        totalSlidesInGroup: currentPresentation.slides.length,
        title: s.title || currentPresentation.title,
        body: s.body,
        subtitle: s.subtitle,
        background: s.background
      }))
    }

    if (currentServiceItem.type === 'video') {
      const mItem = mediaItems.find(
        (m) => m.id === currentServiceItem.mediaId || m.originalName === currentServiceItem.name
      )
      return [
        {
          id: `vid_slide_${currentServiceItem.id}`,
          sourceId: currentServiceItem.id,
          sourceType: 'video',
          groupLabel: 'Video',
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          body: mItem
            ? `${mItem.container} (${mItem.codec || 'Video'}) • ${(mItem.fileSize / (1024 * 1024)).toFixed(1)} MB`
            : 'Reproducción de Video',
          subtitle: 'Clip de Video',
          mediaUrl: mItem?.filePath
        }
      ]
    }

    if (currentServiceItem.type === 'pdf') {
      const mItem = mediaItems.find(
        (m) => m.id === currentServiceItem.mediaId || m.originalName === currentServiceItem.name
      )
      const pages = Math.max(1, pdfPageCount || 1)
      return Array.from({ length: pages }).map((_, pIdx) => ({
        id: `pdf_${currentServiceItem.id}_p${pIdx + 1}`,
        sourceId: currentServiceItem.id,
        sourceType: 'pdf',
        groupLabel: `Página ${pIdx + 1}`,
        slideIndex: pIdx + 1,
        totalSlidesInGroup: pages,
        title: currentServiceItem.name,
        subtitle: `Página ${pIdx + 1} de ${pages}`,
        body: `Página ${pIdx + 1}`,
        mediaUrl: mItem?.filePath,
        pdfPage: pIdx + 1,
        pdfPageCount: pages,
        fitMode: pdfFitMode
      }))
    }

    if (currentServiceItem.type === 'image_presentation') {
      const mItem = mediaItems.find(
        (m) => m.id === currentServiceItem.mediaId || m.originalName === currentServiceItem.name
      )
      return [
        {
          id: `img_slide_${currentServiceItem.id}`,
          sourceId: currentServiceItem.id,
          sourceType: 'image',
          groupLabel: 'Imagen',
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          body: '',
          subtitle: 'Presentación de Imagen',
          mediaUrl: mItem?.filePath
        }
      ]
    }

    if (currentServiceItem.type === 'audio') {
      return [
        {
          id: `aud_slide_${currentServiceItem.id}`,
          sourceId: currentServiceItem.id,
          sourceType: 'blank',
          groupLabel: 'Audio',
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          body: 'Pista de Audio Independiente',
          subtitle: 'Audio'
        }
      ]
    }

    return []
  }, [
    libraryTab,
    bibleDirectSlides,
    currentServiceItem,
    currentSong,
    selectedArrangementId,
    currentPresentation,
    mediaItems,
    pdfPageCount,
    pdfFitMode
  ])

  // Clamp preview slide index when activeSlides change
  useEffect(() => {
    if (previewSlideIndex >= activeSlides.length) {
      setPreviewSlideIndex(Math.max(0, activeSlides.length - 1))
    }
  }, [activeSlides, previewSlideIndex])

  // When a service item of type 'scripture' is selected in Zone 2, load its verses
  useEffect(() => {
    if (currentServiceItem?.type === 'scripture' && currentServiceItem.scriptureRef) {
      loadBiblePassage(currentServiceItem.scriptureRef, false)
    }
  }, [currentServiceItem, loadBiblePassage])

  // When a service item of type 'pdf' is selected in Zone 2, fetch total page count
  useEffect(() => {
    if (currentServiceItem?.type === 'pdf') {
      const mItem = mediaItems.find(
        (m) => m.id === currentServiceItem.mediaId || m.originalName === currentServiceItem.name
      )
      if (mItem?.filePath) {
        window.churchPresenterApi
          .getPdfPageCount(mItem.filePath)
          .then((cnt) => setPdfPageCount(cnt))
          .catch(() => {})
      }
    }
  }, [currentServiceItem, mediaItems])

  // Project a slide live to main, lobby and stage
  const handleGoLive = useCallback(
    (slide: SlideItem, nextSlide?: SlideItem) => {
      // If video slide, start video master playback
      if (slide.sourceType === 'video' && currentServiceItem?.type === 'video') {
        const mItem = mediaItems.find(
          (m) => m.id === currentServiceItem.mediaId || m.originalName === currentServiceItem.name
        )
        if (mItem) {
          window.churchPresenterApi.playVideo({
            mediaId: mItem.id,
            mediaPath: mItem.filePath,
            loop: videoLoop,
            volume: videoVolume,
            inPoint: videoInPoint > 0 ? videoInPoint : undefined,
            outPoint: videoOutPoint > 0 ? videoOutPoint : undefined,
            endAction: videoEndAction,
            audioOutputRole: audioOutputRole || 'main'
          })
        }
      }

      window.churchPresenterApi.sendSlide(slide, ['main', 'lobby', 'stage'], nextSlide)
      setLiveSlideId(slide.id)
      setLiveSourceId(slide.sourceId)
      setIsLiveDirty(false)
    },
    [currentServiceItem, mediaItems, videoLoop, videoVolume, videoInPoint, videoOutPoint, videoEndAction, audioOutputRole]
  )

  // Send current preview slide to live
  const sendPreviewToLive = useCallback(() => {
    if (activeSlides.length > 0 && previewSlideIndex < activeSlides.length) {
      const current = activeSlides[previewSlideIndex]
      const next = activeSlides[previewSlideIndex + 1]
      handleGoLive(current, next)
    }
  }, [activeSlides, previewSlideIndex, handleGoLive])

  // Advance to next slide in live mode
  const handleNextSlide = useCallback(() => {
    if (previewSlideIndex < activeSlides.length - 1) {
      const nextIdx = previewSlideIndex + 1
      setPreviewSlideIndex(nextIdx)
      if (liveSlideId) {
        handleGoLive(activeSlides[nextIdx], activeSlides[nextIdx + 1])
      }
    }
  }, [previewSlideIndex, activeSlides, liveSlideId, handleGoLive])

  // Return to previous slide in live mode
  const handlePrevSlide = useCallback(() => {
    if (previewSlideIndex > 0) {
      const prevIdx = previewSlideIndex - 1
      setPreviewSlideIndex(prevIdx)
      if (liveSlideId) {
        handleGoLive(activeSlides[prevIdx], activeSlides[prevIdx + 1])
      }
    }
  }, [previewSlideIndex, activeSlides, liveSlideId, handleGoLive])

  // Next chapter for Bible passage (Key C)
  const handleNextChapter = useCallback(() => {
    const parsed = parseBibleReference(currentLoadedBibleRef)
    if (parsed) {
      const nextChap = parsed.startChapter + 1
      loadBiblePassage(`${parsed.bookName} ${nextChap}`, Boolean(liveSlideId))
    }
  }, [currentLoadedBibleRef, liveSlideId, loadBiblePassage])

  // Prev chapter for Bible passage (Key X)
  const handlePrevChapter = useCallback(() => {
    const parsed = parseBibleReference(currentLoadedBibleRef)
    if (parsed && parsed.startChapter > 1) {
      const prevChap = parsed.startChapter - 1
      loadBiblePassage(`${parsed.bookName} ${prevChap}`, Boolean(liveSlideId))
    }
  }, [currentLoadedBibleRef, liveSlideId, loadBiblePassage])

  // Next playlist item (PageDown or 'N')
  const handleNextPlaylistItem = useCallback(() => {
    if (!currentService) return
    if (selectedServiceItemIndex < currentService.items.length - 1) {
      const nextIdx = selectedServiceItemIndex + 1
      setSelectedServiceItemIndex(nextIdx)
      setPreviewSlideIndex(0)
    }
  }, [currentService, selectedServiceItemIndex])

  // Prev playlist item (PageUp or 'P')
  const handlePrevPlaylistItem = useCallback(() => {
    if (!currentService) return
    if (selectedServiceItemIndex > 0) {
      const prevIdx = selectedServiceItemIndex - 1
      setSelectedServiceItemIndex(prevIdx)
      setPreviewSlideIndex(0)
    }
  }, [currentService, selectedServiceItemIndex])

  // Global Keyboard Shortcuts (Strict: Window Focus Only, No Modifiers)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.ctrlKey || e.altKey || e.metaKey) {
        return
      }

      const key = e.key.toUpperCase()

      // Function keys shortcuts
      if (key === shortcuts.black.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('black')
        return
      } else if (key === shortcuts.clear.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('clear')
        return
      } else if (key === shortcuts.logo.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('logo')
        return
      } else if (key === shortcuts.freeze.toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('freeze')
        return
      }

      // Live Slides Navigation
      if (key === 'ARROWDOWN' || key === 'ARROWRIGHT' || key === ' ') {
        e.preventDefault()
        handleNextSlide()
      } else if (key === 'ARROWUP' || key === 'ARROWLEFT') {
        e.preventDefault()
        handlePrevSlide()
      } else if (key === 'PAGEDOWN' || key === 'N') {
        e.preventDefault()
        handleNextPlaylistItem()
      } else if (key === 'PAGEUP' || key === 'P') {
        e.preventDefault()
        handlePrevPlaylistItem()
      } else if (key === 'C') {
        e.preventDefault()
        handleNextChapter()
      } else if (key === 'X') {
        e.preventDefault()
        handlePrevChapter()
      } else if (key === 'ENTER') {
        e.preventDefault()
        sendPreviewToLive()
      }
    },
    [
      shortcuts,
      handleNextSlide,
      handlePrevSlide,
      handleNextPlaylistItem,
      handlePrevPlaylistItem,
      handleNextChapter,
      handlePrevChapter,
      sendPreviewToLive
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Filtered Library Items (Accent-insensitive & typo-tolerant)
  const filteredSongs = useMemo(() => {
    return searchItems(songs, searchQuery, (s) => [
      s.title,
      s.author,
      s.copyright,
      ...(s.tags || []),
      s.ccliNumber || '',
      ...s.groups.map((g) => g.content)
    ])
  }, [songs, searchQuery])

  const filteredPresentations = useMemo(() => {
    return searchItems(presentations, searchQuery, (p) => [
      p.title,
      p.description,
      ...p.slides.map((s) => s.body)
    ])
  }, [presentations, searchQuery])

  const filteredMediaItems = useMemo(() => {
    return mediaItems.filter((item) => {
      if (mediaFilterType !== 'all') {
        if (mediaFilterType === 'image') {
          if (item.mediaType !== 'image' && !item.originalName.toLowerCase().endsWith('.pdf')) {
            return false
          }
        } else if (item.mediaType !== mediaFilterType) {
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
  }, [mediaItems, mediaFilterType, searchQuery])

  // Bible Text Search Runner
  const handleRunBibleTextSearch = async () => {
    if (!bibleTextQuery.trim()) return
    const filter =
      bibleTestamentFilter === 'ALL'
        ? undefined
        : { testament: bibleTestamentFilter }
    const results = await window.churchPresenterApi.searchBibleText(
      bibleTextQuery.trim(),
      primaryBibleAbbrev,
      filter
    )
    setBibleSearchResults(results)
  }

  // Stage Message Handlers
  const handleSendStageMessage = async () => {
    if (!stageMessageText.trim()) return
    await window.churchPresenterApi.setOutputMessage('stage', stageMessageText.trim(), true)
    setIsStageMessageActive(true)
  }

  const handleClearStageMessage = async () => {
    await window.churchPresenterApi.setOutputMessage('stage', '', false)
    setIsStageMessageActive(false)
    setStageMessageText('')
  }

  // Live Update for Currently Live Item
  const handleUpdateLiveProjection = () => {
    if (activeSlides.length > 0) {
      const idx = Math.min(previewSlideIndex, activeSlides.length - 1)
      handleGoLive(activeSlides[idx], activeSlides[idx + 1])
    }
  }

  // Playlist Actions
  const handleAddItemToService = (
    type: any,
    id: string,
    name: string,
    scriptureRef?: string
  ) => {
    if (!currentService) return

    const newItem: ServiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      name,
      songId: type === 'song' ? id : undefined,
      presentationId: type === 'presentation' ? id : undefined,
      scriptureRef: type === 'scripture' ? scriptureRef || name : undefined,
      bibleTranslation: type === 'scripture' ? primaryBibleAbbrev : undefined,
      mediaId: ['video', 'audio', 'pdf', 'image_presentation'].includes(type) ? id : undefined
    }

    const updatedService: ServicePlan = {
      ...currentService,
      items: [...currentService.items, newItem],
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
    })
  }

  const handleAddBlankItem = () => {
    if (!currentService) return
    const newItem: ServiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'blank',
      name: 'Diapositiva en Blanco'
    }
    const updatedService: ServicePlan = {
      ...currentService,
      items: [...currentService.items, newItem],
      updatedAt: new Date().toISOString()
    }
    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
    })
  }

  const handleAddHeaderItem = () => {
    if (!currentService) return
    const title = prompt('Nombre del separador (ej. "Bienvenida", "Predicación"):', 'Separador')
    if (!title) return

    const newItem: ServiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'header',
      name: title
    }
    const updatedService: ServicePlan = {
      ...currentService,
      items: [...currentService.items, newItem],
      updatedAt: new Date().toISOString()
    }
    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
    })
  }

  const handleMovePlaylistItem = (index: number, direction: 'up' | 'down') => {
    if (!currentService) return
    const items = [...currentService.items]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= items.length) return

    const temp = items[index]
    items[index] = items[targetIdx]
    items[targetIdx] = temp

    const updatedService: ServicePlan = {
      ...currentService,
      items,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      setSelectedServiceItemIndex(targetIdx)
    })
  }

  const handleRemovePlaylistItem = (index: number) => {
    if (!currentService) return
    const items = currentService.items.filter((_, idx) => idx !== index)
    const updatedService: ServicePlan = {
      ...currentService,
      items,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      if (selectedServiceItemIndex >= items.length) {
        setSelectedServiceItemIndex(Math.max(0, items.length - 1))
      }
    })
  }

  const handleServiceArrangementChange = (index: number, arrangementId: string) => {
    if (!currentService) return
    const items = [...currentService.items]
    items[index] = { ...items[index], arrangementId }
    setSelectedArrangementId(arrangementId)

    const updatedService: ServicePlan = {
      ...currentService,
      items,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
    })
  }

  // Service Management
  const handleCreateNewService = () => {
    const name = prompt('Nombre del nuevo servicio:', 'Servicio Domingo')
    if (!name) return

    const newService: ServicePlan = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      date: new Date().toISOString().split('T')[0],
      items: [],
      isTemplate: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(newService).then((saved) => {
      setServices((prev) => [saved, ...prev])
      setCurrentService(saved)
      setSelectedServiceItemIndex(0)
    })
  }

  const handleDuplicateCurrentService = () => {
    if (!currentService) return
    const duplicated = duplicateService(currentService)
    window.churchPresenterApi.saveService(duplicated).then((saved) => {
      setServices((prev) => [saved, ...prev])
      setCurrentService(saved)
      setSelectedServiceItemIndex(0)
    })
  }

  const handleSaveAsTemplate = () => {
    if (!currentService) return
    const templateName = prompt('Nombre de la plantilla:', `${currentService.name} (Plantilla)`)
    if (!templateName) return

    const template: ServicePlan = {
      ...currentService,
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: templateName,
      isTemplate: true,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(template).then((saved) => {
      setTemplates((prev) => [saved, ...prev])
      alert('¡Plantilla guardada exitosamente!')
    })
  }

  const handleCreateFromTemplate = (template: ServicePlan) => {
    const newName = prompt('Nombre para el nuevo servicio:', template.name.replace(' (Plantilla)', ''))
    if (!newName) return

    const newService = createServiceFromTemplate(
      template,
      newName,
      new Date().toISOString().split('T')[0]
    )

    window.churchPresenterApi.saveService(newService).then((saved) => {
      setServices((prev) => [saved, ...prev])
      setCurrentService(saved)
      setSelectedServiceItemIndex(0)
      setIsTemplateModalOpen(false)
    })
  }

  // Presentation Editor Handlers
  const handleOpenPresentationEditor = (pres?: GenericPresentation) => {
    if (pres) {
      setEditingPresentation({ ...pres })
    } else {
      setEditingPresentation({
        id: `pres_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: 'Nueva Presentación',
        description: 'Anuncios y avisos',
        slides: [
          {
            id: `pslide_${Date.now()}_1`,
            title: 'Bienvenidos',
            body: 'Nos alegra tenerte con nosotros hoy.',
            subtitle: 'Iglesia de la Comunidad'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }
    setIsPresentationEditorOpen(true)
  }

  const handleSavePresentation = async () => {
    if (!editingPresentation || !editingPresentation.title.trim()) return
    const saved = await window.churchPresenterApi.savePresentation(editingPresentation)
    setPresentations((prev) => {
      const exists = prev.some((p) => p.id === saved.id)
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
    })
    setIsPresentationEditorOpen(false)
  }

  // Song Editor Handlers with Undo / Redo
  const handleOpenSongEditor = (song?: Song) => {
    if (song) {
      setEditingSong({ ...song })
      setEditingSongLyricsRaw(
        song.groups.map((g) => `[${g.label}]\n${g.content}`).join('\n\n')
      )
      setSongGroupsHistory([song.groups])
      setSongHistoryIndex(0)
    } else {
      const newSong: Song = {
        id: `song_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: '',
        author: '',
        copyright: 'Dominio Público',
        language: 'es',
        tags: ['Alabanza'],
        groups: [],
        arrangements: [
          {
            id: `arr_def_${Date.now()}`,
            songId: '',
            name: 'Predeterminado',
            groupIds: [],
            isDefault: true
          }
        ],
        linesPerSlide: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setEditingSong(newSong)
      setEditingSongLyricsRaw('')
      setSongGroupsHistory([[]])
      setSongHistoryIndex(0)
    }
    setIsSongEditorOpen(true)
  }

  const pushSongGroupsState = (groups: SongGroup[]) => {
    const nextHistory = songGroupsHistory.slice(0, songHistoryIndex + 1)
    nextHistory.push(groups)
    setSongGroupsHistory(nextHistory)
    setSongHistoryIndex(nextHistory.length - 1)
    if (editingSong) {
      setEditingSong({
        ...editingSong,
        groups,
        arrangements: [
          {
            id: editingSong.arrangements[0]?.id || `arr_${Date.now()}`,
            songId: editingSong.id,
            name: 'Predeterminado',
            groupIds: groups.map((g) => g.id),
            isDefault: true
          }
        ]
      })
    }
  }

  const handleAutoParseLyrics = () => {
    if (!editingSong || !editingSongLyricsRaw.trim()) return
    const parsedGroups = parseLyricsToGroups(editingSongLyricsRaw, editingSong.id)
    pushSongGroupsState(parsedGroups)
  }

  const handleUndoSong = () => {
    if (songHistoryIndex > 0) {
      const targetIdx = songHistoryIndex - 1
      const targetGroups = songGroupsHistory[targetIdx]
      setSongHistoryIndex(targetIdx)
      if (editingSong) {
        setEditingSong({
          ...editingSong,
          groups: targetGroups,
          arrangements: [
            {
              id: editingSong.arrangements[0]?.id || `arr_${Date.now()}`,
              songId: editingSong.id,
              name: 'Predeterminado',
              groupIds: targetGroups.map((g) => g.id),
              isDefault: true
            }
          ]
        })
      }
    }
  }

  const handleRedoSong = () => {
    if (songHistoryIndex < songGroupsHistory.length - 1) {
      const targetIdx = songHistoryIndex + 1
      const targetGroups = songGroupsHistory[targetIdx]
      setSongHistoryIndex(targetIdx)
      if (editingSong) {
        setEditingSong({
          ...editingSong,
          groups: targetGroups,
          arrangements: [
            {
              id: editingSong.arrangements[0]?.id || `arr_${Date.now()}`,
              songId: editingSong.id,
              name: 'Predeterminado',
              groupIds: targetGroups.map((g) => g.id),
              isDefault: true
            }
          ]
        })
      }
    }
  }

  const handleSaveSong = async () => {
    if (!editingSong || !editingSong.title.trim()) {
      alert('Por favor ingrese el título de la canción.')
      return
    }

    const saved = await window.churchPresenterApi.saveSong(editingSong)
    setSongs((prev) => {
      const exists = prev.some((s) => s.id === saved.id)
      return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev]
    })

    if (liveSourceId === saved.id) {
      setIsLiveDirty(true)
    }

    setIsSongEditorOpen(false)
  }

  const handleDeleteSong = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar definitivamente la canción "${title}"?`)) return
    await window.churchPresenterApi.deleteSong(id)
    setSongs((prev) => prev.filter((s) => s.id !== id))
  }

  // Library Export & Import
  const handleExportLibrary = async () => {
    const jsonStr = await window.churchPresenterApi.exportLibrary()
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ChurchPresenter_Biblioteca_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string
        const result = await window.churchPresenterApi.importLibrary(text)
        alert(
          `Importación exitosa: ${result.importedSongs} canciones y ${result.importedPresentations} presentaciones importadas.`
        )
        loadAllData()
      } catch {
        alert('Error al importar la biblioteca. Verifique el formato JSON.')
      }
    }
    reader.readAsText(file)
  }

  // Bible Import Handler
  const handleExecuteBibleImport = async () => {
    if (!importConsent) {
      alert('Debe aceptar la declaración de licencia y derechos de autor para continuar.')
      return
    }
    if (!importRawContent.trim()) {
      alert('Por favor pegue o cargue el contenido del archivo de la traducción bíblica.')
      return
    }

    try {
      const res = await window.churchPresenterApi.importBibleTranslation(
        importFormat,
        importRawContent,
        {
          name: importName.trim() || undefined,
          abbrev: importAbbrev.trim() || undefined,
          language: importLang.trim() || 'es',
          copyright: importCopyright.trim() || 'Dominio Público',
          isPublicDomain: true
        }
      )

      alert(`¡Traducción bíblica "${res.name}" (${res.abbrev}) importada exitosamente con ${res.verseCount} versículos!`)
      setIsBibleImportModalOpen(false)
      const updated = await window.churchPresenterApi.getBibleTranslations()
      setBibleTranslations(updated)
    } catch (err: any) {
      alert(`Error al importar traducción bíblica: ${err.message}`)
    }
  }

  // Theme preview in Song Editor
  const editorPreviewSlides = useMemo(() => {
    if (!editingSong || editingSong.groups.length === 0) return []
    const firstGroup = editingSong.groups[0]
    return splitGroupContentIntoSlides(
      firstGroup,
      editingSong.linesPerSlide || 4,
      editingSong.title
    )
  }, [editingSong])

  const activeTheme = state?.currentTheme || DEFAULT_THEME

  return (
    <div className="operator-workspace">
      {/* =========================================================
          TOP BAR: Controls, Quick Actions & Status
          ========================================================= */}
      <header className="operator-topbar">
        <div className="brand-section">
          <div className="app-logo-badge">CP</div>
          <div>
            <div className="app-title">ChurchPresenter</div>
            <div className="app-version">v{appVersion} | Modo Foco Seguro</div>
          </div>
        </div>

        {/* Global Action Controls: F1 to F4 */}
        <div className="global-controls-bar">
          <button
            className={`global-action-btn ${state?.controls.black ? 'active-black' : ''}`}
            onClick={() => window.churchPresenterApi.toggleGlobalControl('black')}
            title={`Negro (${shortcuts.black})`}
          >
            <Slash size={16} />
            <span>NEGRO [{shortcuts.black}]</span>
          </button>

          <button
            className={`global-action-btn ${state?.controls.clear ? 'active-clear' : ''}`}
            onClick={() => window.churchPresenterApi.toggleGlobalControl('clear')}
            title={`Limpiar (${shortcuts.clear})`}
          >
            <Eye size={16} />
            <span>LIMPIAR [{shortcuts.clear}]</span>
          </button>

          <button
            className={`global-action-btn ${state?.controls.logo ? 'active-logo' : ''}`}
            onClick={() => window.churchPresenterApi.toggleGlobalControl('logo')}
            title={`Logo (${shortcuts.logo})`}
          >
            <ShieldCheck size={16} />
            <span>LOGO [{shortcuts.logo}]</span>
          </button>

          <button
            className={`global-action-btn ${state?.controls.freeze ? 'active-freeze' : ''}`}
            onClick={() => window.churchPresenterApi.toggleGlobalControl('freeze')}
            title={`Congelar (${shortcuts.freeze})`}
          >
            <Snowflake size={16} />
            <span>CONGELAR [{shortcuts.freeze}]</span>
          </button>
        </div>

        {/* Stage Message Quick Bar */}
        <div className="stage-message-bar">
          <input
            type="text"
            className="stage-message-input"
            placeholder="Mensaje a escenario (ej. 'Baja el volumen')..."
            value={stageMessageText}
            onChange={(e) => setStageMessageText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendStageMessage()}
          />
          <button
            className={`stage-send-btn ${isStageMessageActive ? 'active' : ''}`}
            onClick={handleSendStageMessage}
            title="Enviar mensaje al monitor de escenario"
          >
            <Send size={14} />
            <span>Enviar</span>
          </button>
          {isStageMessageActive && (
            <button
              className="stage-clear-btn"
              onClick={handleClearStageMessage}
              title="Quitar mensaje de escenario"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Phase 5A: Independent Background Audio Player */}
        {independentAudio.mediaId && (
          <div className="independent-audio-bar">
            <Music size={13} className="audio-live-icon" />
            <span className="audio-track-title">{independentAudio.title}</span>
            <span className="audio-time-pill">{formatSeconds(independentAudio.currentTime)}</span>
            <button
              className="mini-audio-btn"
              onClick={() => {
                window.churchPresenterApi.controlIndependentAudio(
                  independentAudio.isPlaying ? 'pause' : 'play'
                )
              }}
              title={independentAudio.isPlaying ? 'Pausar' : 'Reanudar'}
            >
              {independentAudio.isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button
              className="mini-audio-btn fade"
              onClick={() => {
                window.churchPresenterApi.controlIndependentAudio('fade-out')
              }}
              title="Fundido suave de salida (Fade Out de 3s)"
            >
              Fundido
            </button>
            <button
              className="mini-audio-btn stop"
              onClick={() => {
                window.churchPresenterApi.controlIndependentAudio('stop')
              }}
              title="Detener audio ambiental"
            >
              <Square size={11} fill="currentColor" />
            </button>
          </div>
        )}

        {/* Utility Buttons */}
        <div className="topbar-actions">
          <button
            className="topbar-tool-btn"
            onClick={() => setIsDisplaysModalOpen(true)}
            title="Configuración de Pantallas Multi-salida"
          >
            <Monitor size={16} />
            <span>Pantallas ({displays.length})</span>
          </button>

          <button
            className="topbar-tool-btn"
            onClick={() => setIsThemesModalOpen(true)}
            title="Diseño y Temas de Salida"
          >
            <Palette size={16} />
            <span>Temas</span>
          </button>

          <button
            className="topbar-tool-btn"
            onClick={() => setIsBackgroundsModalOpen(true)}
            title="Fondos e Imágenes"
          >
            <ImageIcon size={16} />
            <span>Fondos</span>
          </button>

          <button
            className="topbar-tool-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Atajos, Datos de Demo y Respaldo"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* =========================================================
          MAIN 3-ZONE LAYOUT
          Zone 1: Library | Zone 2: Playlist | Zone 3: Slide Grid
          ========================================================= */}
      <main className="operator-main-zones">
        {/* =======================================================
            ZONE 1: BIBLIOTECA (Canciones, Presentaciones y Biblia)
            ======================================================= */}
        <section className="operator-zone zone-library">
          <div className="zone-header">
            <div className="zone-title">BIBLIOTECA</div>
            <div className="library-tabs">
              <button
                className={`tab-btn ${libraryTab === 'songs' ? 'active' : ''}`}
                onClick={() => setLibraryTab('songs')}
              >
                Canciones ({songs.length})
              </button>
              <button
                className={`tab-btn ${libraryTab === 'presentations' ? 'active' : ''}`}
                onClick={() => setLibraryTab('presentations')}
              >
                Avisos ({presentations.length})
              </button>
              <button
                className={`tab-btn ${libraryTab === 'bible' ? 'active' : ''}`}
                onClick={() => setLibraryTab('bible')}
              >
                Biblia
              </button>
              <button
                className={`tab-btn ${libraryTab === 'media' ? 'active' : ''}`}
                onClick={() => setLibraryTab('media')}
              >
                Medios ({mediaItems.length})
              </button>
            </div>
          </div>

          {/* TAB 1 & 2: Songs and Presentations */}
          {libraryTab === 'songs' || libraryTab === 'presentations' ? (
            <>
              {/* Real-time search input */}
              <div className="search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar título, letra, etiqueta o autor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Library Items List */}
              <div className="zone-content-list">
                {libraryTab === 'songs' ? (
                  filteredSongs.length > 0 ? (
                    filteredSongs.map((song) => (
                      <div key={song.id} className="library-item-card">
                        <div className="item-info">
                          <div className="item-title-row">
                            <Music size={14} className="item-icon song-icon" />
                            <span className="item-title">{song.title}</span>
                            {song.isDemo && <span className="demo-badge">DEMO</span>}
                          </div>
                          <div className="item-meta">
                            {song.author || 'Autor desconocido'} • {song.groups.length} partes
                          </div>
                        </div>
                        <div className="item-actions">
                          <button
                            className="item-action-btn add-btn"
                            onClick={() => handleAddItemToService('song', song.id, song.title)}
                            title="Añadir a la lista de servicio"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            className="item-action-btn edit-btn"
                            onClick={() => handleOpenSongEditor(song)}
                            title="Editar canción"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="item-action-btn delete-btn"
                            onClick={() => handleDeleteSong(song.id, song.title)}
                            title="Eliminar canción"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-list-notice">
                      No se encontraron canciones. Puede cargar himnos de demostración desde Configuración.
                    </div>
                  )
                ) : filteredPresentations.length > 0 ? (
                  filteredPresentations.map((pres) => (
                    <div key={pres.id} className="library-item-card">
                      <div className="item-info">
                        <div className="item-title-row">
                          <FileText size={14} className="item-icon pres-icon" />
                          <span className="item-title">{pres.title}</span>
                          {pres.isDemo && <span className="demo-badge">DEMO</span>}
                        </div>
                        <div className="item-meta">{pres.slides.length} diapositivas</div>
                      </div>
                      <div className="item-actions">
                        <button
                          className="item-action-btn add-btn"
                          onClick={() => handleAddItemToService('presentation', pres.id, pres.title)}
                          title="Añadir a la lista de servicio"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-list-notice">No se encontraron presentaciones.</div>
                )}
              </div>

              {/* Zone 1 Footer Actions */}
              <div className="zone-footer-actions">
                {libraryTab === 'songs' ? (
                  <button className="primary-action-btn" onClick={() => handleOpenSongEditor()}>
                    <Plus size={14} />
                    <span>Nueva Canción</span>
                  </button>
                ) : (
                  <button
                    className="primary-action-btn"
                    onClick={() => handleOpenPresentationEditor()}
                  >
                    <Plus size={14} />
                    <span>Nueva Presentación</span>
                  </button>
                )}

                <div className="secondary-actions-row">
                  <label className="secondary-action-btn file-upload-label" title="Importar Biblioteca JSON">
                    <Upload size={13} />
                    <span>Importar</span>
                    <input
                      type="file"
                      accept=".json,.txt"
                      style={{ display: 'none' }}
                      onChange={handleImportLibrary}
                    />
                  </label>

                  <button
                    className="secondary-action-btn"
                    onClick={handleExportLibrary}
                    title="Exportar toda la biblioteca a archivo JSON"
                  >
                    <Download size={13} />
                    <span>Exportar</span>
                  </button>
                </div>
              </div>
            </>
          ) : libraryTab === 'bible' ? (
            /* TAB 3: BIBLE CONTROLS & BROWSER */
            <div className="bible-tab-container">
              {/* Translation Selection Bar */}
              <div className="bible-translations-bar">
                <div className="bible-translation-select-group">
                  <label>Traducción:</label>
                  <select
                    className="bible-select"
                    value={primaryBibleAbbrev}
                    onChange={(e) => setPrimaryBibleAbbrev(e.target.value)}
                  >
                    {bibleTranslations.map((t) => (
                      <option key={t.id} value={t.abbrev}>
                        {t.name} ({t.abbrev})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dual translation toggle */}
                <div className="dual-translation-toggle-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={isDualBibleActive}
                      onChange={(e) => setIsDualBibleActive(e.target.checked)}
                    />
                    <span>Doble Traducción</span>
                  </label>

                  {isDualBibleActive && (
                    <>
                      <select
                        className="bible-select mini"
                        value={secondaryBibleAbbrev}
                        onChange={(e) => setSecondaryBibleAbbrev(e.target.value)}
                      >
                        {bibleTranslations.map((t) => (
                          <option key={t.id} value={t.abbrev}>
                            {t.abbrev}
                          </option>
                        ))}
                      </select>

                      <select
                        className="bible-select mini"
                        value={dualBibleLayout}
                        onChange={(e) => setDualBibleLayout(e.target.value as any)}
                        title="Disposición de doble traducción"
                      >
                        <option value="stacked">Apilado</option>
                        <option value="sideBySide">Lado a Lado</option>
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Mode Switch: Go to Reference vs Text Search */}
              <div className="bible-mode-switch">
                <button
                  className={`bible-mode-btn ${bibleSearchMode === 'reference' ? 'active' : ''}`}
                  onClick={() => setBibleSearchMode('reference')}
                >
                  <BookOpen size={13} />
                  <span>Ir a Referencia</span>
                </button>
                <button
                  className={`bible-mode-btn ${bibleSearchMode === 'text' ? 'active' : ''}`}
                  onClick={() => setBibleSearchMode('text')}
                >
                  <Search size={13} />
                  <span>Buscar Palabras</span>
                </button>
              </div>

              {/* REFERENCE MODE */}
              {bibleSearchMode === 'reference' ? (
                <div className="bible-reference-mode-box">
                  <div className="bible-go-to-bar">
                    <input
                      type="text"
                      className="bible-reference-input"
                      placeholder="ej. Juan 3:16, 1 Co 13:4-7, Salmos 23..."
                      value={bibleRefInput}
                      onChange={(e) => setBibleRefInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadBiblePassage(bibleRefInput, false)
                        }
                      }}
                    />
                    <button
                      className="bible-go-btn"
                      onClick={() => loadBiblePassage(bibleRefInput, false)}
                      title="Mostrar en Vista Previa (Enter)"
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Ir</span>
                    </button>
                  </div>

                  {/* Actions for current loaded passage */}
                  <div className="bible-passage-actions-row">
                    <button
                      className="secondary-action-btn mini-btn"
                      onClick={() => {
                        window.churchPresenterApi.toggleBibleFavorite(currentLoadedBibleRef).then(setBibleFavorites)
                      }}
                      title="Marcar / desmarcar como favorito"
                    >
                      <Star
                        size={12}
                        fill={bibleFavorites.includes(currentLoadedBibleRef) ? '#fbbf24' : 'none'}
                        color={bibleFavorites.includes(currentLoadedBibleRef) ? '#fbbf24' : '#94a3b8'}
                      />
                      <span>Favorito</span>
                    </button>

                    <button
                      className="primary-action-btn mini-btn"
                      onClick={() =>
                        handleAddItemToService('scripture', `scr_${Date.now()}`, currentLoadedBibleRef, currentLoadedBibleRef)
                      }
                      title="Añadir pasaje a la lista del servicio"
                    >
                      <Plus size={12} />
                      <span>Al Servicio</span>
                    </button>
                  </div>

                  {/* Favorites Quick Chips */}
                  {bibleFavorites.length > 0 && (
                    <div className="quick-references-section">
                      <div className="section-subtitle">
                        <Star size={11} color="#fbbf24" fill="#fbbf24" />
                        <span>Favoritos</span>
                      </div>
                      <div className="chips-cloud">
                        {bibleFavorites.map((fav) => (
                          <button
                            key={fav}
                            className="ref-chip"
                            onClick={() => loadBiblePassage(fav, false)}
                          >
                            {fav}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent History Quick Chips */}
                  {bibleRecentHistory.length > 0 && (
                    <div className="quick-references-section">
                      <div className="section-subtitle">
                        <History size={11} />
                        <span>Recientes</span>
                      </div>
                      <div className="chips-cloud">
                        {bibleRecentHistory.slice(0, 8).map((rec) => (
                          <button
                            key={rec}
                            className="ref-chip recent"
                            onClick={() => loadBiblePassage(rec, false)}
                          >
                            {rec}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* TEXT SEARCH MODE */
                <div className="bible-text-search-box">
                  <div className="search-box">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Buscar palabras (ej. amor mundo)..."
                      value={bibleTextQuery}
                      onChange={(e) => setBibleTextQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunBibleTextSearch()}
                    />
                    <button className="bible-go-btn" onClick={handleRunBibleTextSearch}>
                      Buscar
                    </button>
                  </div>

                  {/* Filters by Testament */}
                  <div className="bible-filters-row">
                    <button
                      className={`filter-pill ${bibleTestamentFilter === 'ALL' ? 'active' : ''}`}
                      onClick={() => setBibleTestamentFilter('ALL')}
                    >
                      Todos
                    </button>
                    <button
                      className={`filter-pill ${bibleTestamentFilter === 'OT' ? 'active' : ''}`}
                      onClick={() => setBibleTestamentFilter('OT')}
                    >
                      Antiguo Testamento
                    </button>
                    <button
                      className={`filter-pill ${bibleTestamentFilter === 'NT' ? 'active' : ''}`}
                      onClick={() => setBibleTestamentFilter('NT')}
                    >
                      Nuevo Testamento
                    </button>
                  </div>

                  {/* Search Results List */}
                  <div className="bible-search-results-list">
                    {bibleSearchResults.length > 0 ? (
                      bibleSearchResults.map((res, rIdx) => (
                        <div
                          key={rIdx}
                          className="bible-search-card"
                          onClick={() => {
                            loadBiblePassage(res.formattedReference, false)
                          }}
                        >
                          <div className="bible-card-ref">{res.formattedReference}</div>
                          <div
                            className="bible-card-text"
                            dangerouslySetInnerHTML={{ __html: res.highlightedText }}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="empty-list-notice">
                        {bibleTextQuery ? 'Sin resultados para la búsqueda.' : 'Escriba palabras para buscar en toda la Biblia.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bible Zone Footer Tools */}
              <div className="zone-footer-actions">
                <div className="secondary-actions-row">
                  <button
                    className="secondary-action-btn"
                    onClick={() => setIsBibleImportModalOpen(true)}
                    title="Importar traducción (Zefania, OSIS, USFM, JSON)"
                  >
                    <Upload size={13} />
                    <span>Importar Versión</span>
                  </button>
                  <button
                    className="secondary-action-btn"
                    onClick={() => setIsBibleManagerModalOpen(true)}
                    title="Ver traducciones instaladas"
                  >
                    <Book size={13} />
                    <span>Versiones ({bibleTranslations.length})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 4: MEDIA LIBRARY (Videos, Audios, Images, PDFs) */
            <div className="media-tab-container">
              {/* Media Filter Pills */}
              <div className="media-filters-bar">
                <button
                  className={`filter-pill ${mediaFilterType === 'all' ? 'active' : ''}`}
                  onClick={() => setMediaFilterType('all')}
                >
                  Todos ({mediaItems.length})
                </button>
                <button
                  className={`filter-pill ${mediaFilterType === 'video' ? 'active' : ''}`}
                  onClick={() => setMediaFilterType('video')}
                >
                  Videos
                </button>
                <button
                  className={`filter-pill ${mediaFilterType === 'audio' ? 'active' : ''}`}
                  onClick={() => setMediaFilterType('audio')}
                >
                  Audios
                </button>
                <button
                  className={`filter-pill ${mediaFilterType === 'image' ? 'active' : ''}`}
                  onClick={() => setMediaFilterType('image')}
                >
                  Imágenes / PDF
                </button>
              </div>

              {/* Media Search Input */}
              <div className="search-box">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar medios por nombre o etiqueta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>

              {/* Media Items List */}
              <div className="zone-content-list media-list">
                {filteredMediaItems.length > 0 ? (
                  filteredMediaItems.map((item) => (
                    <div key={item.id} className="library-item-card media-card">
                      <div className="item-info">
                        <div className="item-title-row">
                          {item.mediaType === 'video' ? (
                            <Video size={14} className="item-icon video-icon" />
                          ) : item.mediaType === 'audio' ? (
                            <Music size={14} className="item-icon audio-icon" />
                          ) : (
                            <ImageIcon size={14} className="item-icon image-icon" />
                          )}
                          <span className="item-title">{item.originalName}</span>
                          {item.isMissing && <span className="missing-badge">FALTANTE</span>}
                        </div>
                        <div className="item-meta">
                          {item.container} {item.codec ? `(${item.codec})` : ''} • {(item.fileSize / (1024 * 1024)).toFixed(1)} MB
                          {item.duration > 0 && ` • ${formatSeconds(item.duration)}`}
                        </div>
                      </div>

                      <div className="item-actions">
                        <button
                          className="item-action-btn add-btn"
                          title="Añadir a la lista del servicio"
                          onClick={() => {
                            if (item.mediaType === 'video') {
                              handleAddItemToService('video', item.id, item.originalName)
                            } else if (item.mediaType === 'audio') {
                              handleAddItemToService('audio', item.id, item.originalName)
                            } else if (item.originalName.toLowerCase().endsWith('.pdf')) {
                              handleAddItemToService('pdf', item.id, item.originalName)
                            } else {
                              handleAddItemToService('image_presentation', item.id, item.originalName)
                            }
                          }}
                        >
                          <Plus size={14} />
                        </button>

                        {item.mediaType === 'audio' && (
                          <button
                            className="item-action-btn play-audio-btn"
                            title="Reproducir música ambiental de fondo"
                            onClick={() => {
                              window.churchPresenterApi.playIndependentAudio(
                                item.id,
                                item.filePath,
                                item.originalName
                              )
                            }}
                          >
                            <Play size={13} />
                          </button>
                        )}

                        <button
                          className="item-action-btn delete-btn"
                          title="Eliminar medio"
                          onClick={async () => {
                            if (confirm(`¿Eliminar definitivamente el medio "${item.originalName}"?`)) {
                              await window.churchPresenterApi.deleteMediaItem(item.id)
                              loadAllData()
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-list-notice">
                    No se encontraron archivos de medios. Haga clic en "+ Importar Medio".
                  </div>
                )}
              </div>

              {/* Media Footer Actions */}
              <div className="zone-footer-actions">
                <button
                  className="primary-action-btn"
                  onClick={() => setIsMediaImportModalOpen(true)}
                >
                  <Plus size={14} />
                  <span>Importar Medio</span>
                </button>

                <button
                  className="secondary-action-btn"
                  onClick={async () => {
                    const res = await window.churchPresenterApi.checkMediaIntegrity()
                    if (res.missingCount === 0) {
                      alert('Todos los archivos de medios están íntegros y presentes en disco.')
                    } else {
                      alert(`Atención: Se detectaron ${res.missingCount} archivo(s) faltantes o dañados en disco.`)
                    }
                    loadAllData()
                  }}
                  title="Verificar si los archivos físicos existen en disco"
                >
                  <ShieldCheck size={13} />
                  <span>Comprobar Integridad</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* =======================================================
            ZONE 2: LISTA DEL SERVICIO (Service Playlist)
            ======================================================= */}
        <section className="operator-zone zone-playlist">
          <div className="zone-header">
            <div className="playlist-title-box">
              <div className="zone-title">SERVICIO</div>
              {services.length > 1 && (
                <select
                  className="service-selector-dropdown"
                  value={currentService?.id || ''}
                  onChange={(e) => {
                    const found = services.find((s) => s.id === e.target.value)
                    if (found) {
                      setCurrentService(found)
                      setSelectedServiceItemIndex(0)
                    }
                  }}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                className="service-name-input"
                value={currentService?.name || ''}
                onChange={(e) => {
                  if (currentService) {
                    setCurrentService({ ...currentService, name: e.target.value })
                  }
                }}
                onBlur={() => {
                  if (currentService) {
                    window.churchPresenterApi.saveService(currentService)
                  }
                }}
                placeholder="Nombre del Servicio"
              />
            </div>

            <div className="service-quick-actions">
              <button
                className="mini-icon-btn"
                onClick={handleCreateNewService}
                title="Nuevo servicio en blanco"
              >
                <Plus size={14} />
              </button>
              <button
                className="mini-icon-btn"
                onClick={handleDuplicateCurrentService}
                title="Duplicar servicio actual"
              >
                <Copy size={14} />
              </button>
              <button
                className="mini-icon-btn"
                onClick={handleSaveAsTemplate}
                title="Guardar como plantilla de servicio"
              >
                <Sparkles size={14} />
              </button>
              <button
                className="mini-icon-btn"
                onClick={() => setIsTemplateModalOpen(true)}
                title="Cargar desde plantilla"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </div>

          {/* Quick Add Separator / Blank bar */}
          <div className="playlist-add-helpers">
            <button className="helper-add-btn" onClick={handleAddBlankItem}>
              <Minus size={12} />
              <span>+ En Blanco</span>
            </button>
            <button className="helper-add-btn" onClick={handleAddHeaderItem}>
              <Layers size={12} />
              <span>+ Separador</span>
            </button>
          </div>

          {/* Playlist Items */}
          <div className="zone-content-list">
            {currentService && currentService.items.length > 0 ? (
              currentService.items.map((item, index) => {
                const isSelected = selectedServiceItemIndex === index
                const songData = item.type === 'song' ? songs.find((s) => s.id === item.songId) : null

                return (
                  <div
                    key={item.id}
                    className={`playlist-item-card ${isSelected ? 'selected' : ''} ${item.type === 'header' ? 'item-header-type' : ''} ${item.type === 'scripture' ? 'item-scripture-type' : ''}`}
                    onClick={() => {
                      setSelectedServiceItemIndex(index)
                      setPreviewSlideIndex(0)
                    }}
                  >
                    <div className="playlist-index">{index + 1}</div>

                    <div className="playlist-item-details">
                      <div className="playlist-item-title-row">
                        {item.type === 'song' ? (
                          <Music size={13} className="song-icon" />
                        ) : item.type === 'presentation' ? (
                          <FileText size={13} className="pres-icon" />
                        ) : item.type === 'scripture' ? (
                          <BookOpen size={13} className="scripture-icon" />
                        ) : item.type === 'header' ? (
                          <Layers size={13} className="header-icon" />
                        ) : (
                          <Minus size={13} className="blank-icon" />
                        )}
                        <span className="playlist-item-name">{item.name}</span>
                      </div>

                      {/* Song Arrangement Selector Dropdown */}
                      {songData && songData.arrangements.length > 1 && (
                        <div className="arrangement-selector-box" onClick={(e) => e.stopPropagation()}>
                          <label>Arreglo:</label>
                          <select
                            className="arrangement-select"
                            value={item.arrangementId || songData.arrangements.find((a) => a.isDefault)?.id}
                            onChange={(e) => handleServiceArrangementChange(index, e.target.value)}
                          >
                            {songData.arrangements.map((arr) => (
                              <option key={arr.id} value={arr.id}>
                                {arr.name} ({arr.groupIds.length} partes)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="playlist-item-controls" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="control-btn"
                        onClick={() => handleMovePlaylistItem(index, 'up')}
                        disabled={index === 0}
                        title="Subir"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        className="control-btn"
                        onClick={() => handleMovePlaylistItem(index, 'down')}
                        disabled={index === currentService.items.length - 1}
                        title="Bajar"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        className="control-btn delete-btn"
                        onClick={() => handleRemovePlaylistItem(index)}
                        title="Quitar de la lista"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="empty-list-notice">
                La lista de servicio está vacía. Añada canciones, pasajes bíblicos o avisos.
              </div>
            )}
          </div>
        </section>

        {/* =======================================================
            ZONE 3: CUADRÍCULA DE DIAPOSITIVAS Y MONITORES
            ======================================================= */}
        <section className="operator-zone zone-slides">
          {/* Header of Zone 3 */}
          <div className="zone-header">
            <div className="active-item-title-box">
              <div className="zone-title">DIAPOSITIVAS</div>
              <div className="active-item-name">
                {libraryTab === 'bible' && bibleDirectSlides.length > 0
                  ? currentLoadedBibleRef
                  : currentServiceItem?.name || 'Ningún elemento seleccionado'}
              </div>
            </div>

            <div className="slides-header-actions">
              {/* Alert if edited while live */}
              {isLiveDirty && (
                <button
                  className="update-live-btn"
                  onClick={handleUpdateLiveProjection}
                  title="Aplicar cambios de la canción en vivo"
                >
                  <AlertCircle size={14} />
                  <span>Actualizar en vivo</span>
                </button>
              )}

              {currentSong && (
                <button
                  className="secondary-action-btn"
                  onClick={() => handleOpenSongEditor(currentSong)}
                >
                  <Edit3 size={13} />
                  <span>Editar Canción</span>
                </button>
              )}
            </div>
          </div>

          {/* Dual Live / Preview Mini Monitors */}
          <div className="monitors-preview-bar">
            {/* Live Monitor */}
            <div className="mini-monitor-box live-box">
              <div className="monitor-header">
                <span className="live-pill">EN VIVO</span>
                <span className="monitor-label">Salida Principal</span>
              </div>
              <div className="monitor-screen">
                {state?.currentSlide?.mediaType === 'video' ? (
                  <div className="monitor-text" style={{ color: '#38bdf8' }}>
                    ▶ REPRODUCIENDO VIDEO: {state.currentSlide.title}
                  </div>
                ) : state?.currentSlide?.mediaType === 'pdf' ? (
                  <div className="monitor-text" style={{ color: '#fbbf24' }}>
                    📄 PDF: {state.currentSlide.title} (Pág {state.currentSlide.pdfPage})
                  </div>
                ) : state?.currentSlide?.body ? (
                  <div className="monitor-text">{state.currentSlide.body}</div>
                ) : (
                  <div className="monitor-empty">(Pantalla en blanco)</div>
                )}
              </div>
            </div>

            {/* Preview Monitor */}
            <div className="mini-monitor-box preview-box">
              <div className="monitor-header">
                <span className="preview-pill">VISTA PREVIA</span>
                <button className="send-to-live-btn" onClick={sendPreviewToLive}>
                  <Play size={12} fill="currentColor" />
                  <span>Proyectar (Enter)</span>
                </button>
              </div>
              <div className="monitor-screen">
                {activeSlides[previewSlideIndex]?.sourceType === 'video' ? (
                  <div className="monitor-text" style={{ color: '#38bdf8' }}>
                    VIDEO: {activeSlides[previewSlideIndex].title}
                  </div>
                ) : activeSlides[previewSlideIndex]?.sourceType === 'pdf' ? (
                  <div className="monitor-text" style={{ color: '#fbbf24' }}>
                    PDF: {activeSlides[previewSlideIndex].title} ({activeSlides[previewSlideIndex].subtitle})
                  </div>
                ) : activeSlides[previewSlideIndex]?.body ? (
                  <div className="monitor-text">{activeSlides[previewSlideIndex].body}</div>
                ) : (
                  <div className="monitor-empty">(Sin selección)</div>
                )}
              </div>
            </div>
          </div>

          {/* Phase 5A: Video Control Deck (shown when video item is active) */}
          {currentServiceItem?.type === 'video' && (
            <div className="video-control-deck">
              <div className="video-transport-bar">
                <button
                  className="transport-main-btn"
                  onClick={() => {
                    const action = isVideoPlaying ? 'pause' : 'play'
                    window.churchPresenterApi.controlVideo(action)
                    setIsVideoPlaying(!isVideoPlaying)
                  }}
                  title="Reproducir / Pausar (Espacio)"
                >
                  {isVideoPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  <span>{isVideoPlaying ? 'Pausar' : 'Reproducir'}</span>
                </button>

                <button
                  className="transport-sec-btn"
                  onClick={() => {
                    window.churchPresenterApi.controlVideo('stop')
                    setIsVideoPlaying(false)
                  }}
                  title="Detener video y volver al inicio"
                >
                  <Square size={13} fill="currentColor" />
                  <span>Detener</span>
                </button>

                <button
                  className="transport-sec-btn"
                  onClick={() => {
                    window.churchPresenterApi.controlVideo('seek', Math.max(0, videoCurrentTime - 10))
                  }}
                  title="Retroceder 10 segundos"
                >
                  <RotateCcw size={12} />
                  <span>-10s</span>
                </button>

                <button
                  className="transport-sec-btn"
                  onClick={() => {
                    window.churchPresenterApi.controlVideo('seek', videoCurrentTime + 10)
                  }}
                  title="Avanzar 10 segundos"
                >
                  <span>+10s</span>
                </button>

                {/* Scrubber time slider */}
                <div className="scrubber-container">
                  <span className="time-label">{formatSeconds(videoCurrentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    step={0.5}
                    value={videoCurrentTime}
                    onChange={(e) => {
                      const t = parseFloat(e.target.value)
                      setVideoCurrentTime(t)
                      window.churchPresenterApi.controlVideo('seek', t)
                    }}
                    className="time-slider"
                  />
                  <span className="time-label">{formatSeconds(videoDuration)}</span>
                </div>

                {/* Volume slider */}
                <div className="volume-slider-box">
                  {videoVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={videoVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setVideoVolume(v)
                      window.churchPresenterApi.controlIndependentAudio('volume', v)
                    }}
                    className="volume-slider"
                  />
                </div>
              </div>

              {/* Video Options & Routing */}
              <div className="video-options-grid">
                <div className="video-option-item">
                  <label>Punto Entrada (in):</label>
                  <input
                    type="number"
                    min={0}
                    value={videoInPoint}
                    onChange={(e) => setVideoInPoint(parseFloat(e.target.value) || 0)}
                    className="mini-num-input"
                  />
                  <span>seg</span>
                </div>

                <div className="video-option-item">
                  <label>Punto Salida (out):</label>
                  <input
                    type="number"
                    min={0}
                    value={videoOutPoint}
                    onChange={(e) => setVideoOutPoint(parseFloat(e.target.value) || 0)}
                    className="mini-num-input"
                  />
                  <span>seg</span>
                </div>

                <div className="video-option-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={videoLoop}
                      onChange={(e) => setVideoLoop(e.target.checked)}
                    />
                    <span>Bucle</span>
                  </label>
                </div>

                <div className="video-option-item">
                  <label>Fin del video:</label>
                  <select
                    value={videoEndAction}
                    onChange={(e) => setVideoEndAction(e.target.value as any)}
                    className="mini-select"
                  >
                    <option value="freeze">Congelar último fotograma</option>
                    <option value="background">Volver al fondo</option>
                    <option value="next">Avanzar al siguiente</option>
                  </select>
                </div>

                <div className="video-option-item">
                  <label>Audio por:</label>
                  <select
                    value={audioOutputRole}
                    onChange={(e) => setAudioOutputRole(e.target.value)}
                    className="mini-select"
                  >
                    <option value="main">Sala Principal (main)</option>
                    <option value="stage">Escenario (stage)</option>
                    <option value="lobby">Vestíbulo / Lobby</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Phase 5A: PDF Fit Mode Switcher (shown when PDF item is active) */}
          {currentServiceItem?.type === 'pdf' && (
            <div className="pdf-toolbar-bar">
              <span className="pdf-info-label">
                Documento PDF: {pdfPageCount} páginas detectadas
              </span>
              <div className="pdf-fit-mode-group">
                <label>Ajuste de página:</label>
                <button
                  className={`filter-pill ${pdfFitMode === 'contain' ? 'active' : ''}`}
                  onClick={() => setPdfFitMode('contain')}
                >
                  Encajar completo
                </button>
                <button
                  className={`filter-pill ${pdfFitMode === 'cover' ? 'active' : ''}`}
                  onClick={() => setPdfFitMode('cover')}
                >
                  Rellenar
                </button>
                <button
                  className={`filter-pill ${pdfFitMode === 'center' ? 'active' : ''}`}
                  onClick={() => setPdfFitMode('center')}
                >
                  Centrado
                </button>
              </div>
            </div>
          )}

          {/* Slide Cards Grid */}
          <div className="slides-grid-container">
            {activeSlides.length > 0 ? (
              activeSlides.map((slide, idx) => {
                const isSelected = previewSlideIndex === idx
                const isLive = liveSlideId === slide.id

                return (
                  <div
                    key={slide.id}
                    className={`slide-card ${isSelected ? 'selected-preview' : ''} ${isLive ? 'is-live' : ''}`}
                    onClick={() => setPreviewSlideIndex(idx)}
                    onDoubleClick={() => handleGoLive(slide, activeSlides[idx + 1])}
                  >
                    <div className="slide-card-header">
                      <span className="slide-group-label">{slide.groupLabel || `Diapositiva ${idx + 1}`}</span>
                      {isLive && <span className="live-badge">EN VIVO</span>}
                    </div>

                    <div className="slide-card-body">{slide.body || '(Diapositiva en blanco)'}</div>

                    <div className="slide-card-footer">
                      <span>#{idx + 1}</span>
                      <span className="hint-text">Doble clic para proyectar</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="empty-grid-notice">
                Seleccione un elemento del servicio o busque un pasaje bíblico para proyectar.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =========================================================
          FIRST-TIME LAUNCH DEMO PROMPT MODAL
          ========================================================= */}
      {showFirstLaunchModal && (
        <div className="modal-backdrop">
          <div className="modal-content first-launch-modal" style={{ maxWidth: 520, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: '#38bdf8' }}>
              ¡Bienvenido a ChurchPresenter!
            </div>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 20 }}>
              ¿Desea cargar los datos de demostración con himnos clásicos de dominio público (Martín Lutero, John Newton, Isaac Watts, etc.) para explorar la aplicación? Puede borrarlos en cualquier momento desde Configuración.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="secondary-action-btn"
                style={{ padding: '8px 16px' }}
                onClick={() => {
                  localStorage.setItem('cp_demo_prompt_seen', '1')
                  setShowFirstLaunchModal(false)
                }}
              >
                Comenzar en Blanco
              </button>
              <button
                className="primary-action-btn"
                style={{ padding: '8px 16px' }}
                onClick={async () => {
                  localStorage.setItem('cp_demo_prompt_seen', '1')
                  await window.churchPresenterApi.loadDemoData()
                  await loadAllData()
                  setShowFirstLaunchModal(false)
                }}
              >
                Cargar Datos de Demostración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          BIBLE IMPORT MODAL
          ========================================================= */}
      {isBibleImportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content bible-import-modal">
            <div className="modal-header">
              <div className="modal-title">Importar Traducción de la Biblia</div>
              <button className="modal-close-btn" onClick={() => setIsBibleImportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="license-warning-notice">
                <AlertCircle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Aviso de Propiedad Intelectual y Licencia:</strong>
                  <p>
                    ChurchPresenter respeta los derechos de autor. Solo importe traducciones que pertenezcan al <strong>Dominio Público</strong> o respecto de las cuales su congregación posea la licencia por escrito otorgada por los titulares o sociedades bíblicas. No incluya traducciones protegidas sin autorización.
                  </p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Formato de Archivo:</label>
                  <select
                    value={importFormat}
                    onChange={(e) => setImportFormat(e.target.value as any)}
                  >
                    <option value="json">JSON Estructurado ChurchPresenter</option>
                    <option value="zefania">Zefania XML (.xml)</option>
                    <option value="osis">OSIS XML (.osis / .xml)</option>
                    <option value="usfm">USFM (.usfm / .txt)</option>
                  </select>
                </div>

                <div className="form-group flex-2">
                  <label>Nombre de la Traducción *</label>
                  <input
                    type="text"
                    placeholder="ej. Reina-Valera 1909"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                  />
                </div>

                <div className="form-group flex-1">
                  <label>Abreviatura *</label>
                  <input
                    type="text"
                    placeholder="ej. RVR1909"
                    value={importAbbrev}
                    onChange={(e) => setImportAbbrev(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Idioma (ISO):</label>
                  <input
                    type="text"
                    value={importLang}
                    onChange={(e) => setImportLang(e.target.value)}
                  />
                </div>
                <div className="form-group flex-2">
                  <label>Texto de Derechos de Autor:</label>
                  <input
                    type="text"
                    placeholder="ej. Dominio Público"
                    value={importCopyright}
                    onChange={(e) => setImportCopyright(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Pegar o cargar contenido del archivo:</label>
                <textarea
                  className="raw-lyrics-textarea"
                  rows={8}
                  placeholder="Pegue aquí el texto JSON, Zefania XML, OSIS XML o USFM..."
                  value={importRawContent}
                  onChange={(e) => setImportRawContent(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="checkbox-label" style={{ fontSize: 12, color: '#f8fafc' }}>
                  <input
                    type="checkbox"
                    checked={importConsent}
                    onChange={(e) => setImportConsent(e.target.checked)}
                  />
                  <span>
                    Confirmo que esta traducción bíblica es de dominio público o cuenta con la licencia correspondiente.
                  </span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-action-btn"
                onClick={() => setIsBibleImportModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-action-btn" onClick={handleExecuteBibleImport}>
                Procesar e Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          BIBLE MANAGER MODAL (List installed versions)
          ========================================================= */}
      {isBibleManagerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content bible-manager-modal" style={{ width: 620 }}>
            <div className="modal-header">
              <div className="modal-title">Traducciones Bíblicas Instaladas</div>
              <button className="modal-close-btn" onClick={() => setIsBibleManagerModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="section-note">
                Cada traducción se almacena en su propio archivo SQLite independiente dentro de la carpeta de datos de la aplicación y se consulta bajo demanda.
              </p>

              <div className="translations-list">
                {bibleTranslations.map((bt) => (
                  <div key={bt.id} className="translation-item-card">
                    <div>
                      <div className="translation-name-row">
                        <strong>{bt.name}</strong>
                        <span className="trans-pill">{bt.abbrev}</span>
                        {bt.isDefault && <span className="default-pill">POR DEFECTO</span>}
                      </div>
                      <div className="trans-meta">
                        {bt.verseCount.toLocaleString()} versículos • {bt.language.toUpperCase()} • {bt.copyright}
                      </div>
                    </div>

                    {!bt.isDefault && (
                      <button
                        className="control-btn delete-btn"
                        onClick={async () => {
                          if (confirm(`¿Eliminar la traducción ${bt.name}?`)) {
                            await window.churchPresenterApi.deleteBibleTranslation(bt.id)
                            const updated = await window.churchPresenterApi.getBibleTranslations()
                            setBibleTranslations(updated)
                          }
                        }}
                        title="Eliminar traducción"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="primary-action-btn" onClick={() => setIsBibleManagerModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SONG EDITOR MODAL (Automatic section detection, Undo/Redo)
          ========================================================= */}
      {isSongEditorOpen && editingSong && (
        <div className="modal-backdrop">
          <div className="modal-content song-editor-modal">
            <div className="modal-header">
              <div className="modal-title">
                {editingSong.title ? `Editar Canción: ${editingSong.title}` : 'Nueva Canción'}
              </div>
              <button className="modal-close-btn" onClick={() => setIsSongEditorOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="song-editor-grid">
              {/* Left Column: Metadata & Paste Raw Lyrics */}
              <div className="editor-left-column">
                <div className="form-row">
                  <div className="form-group flex-2">
                    <label>Título de la Canción *</label>
                    <input
                      type="text"
                      value={editingSong.title}
                      onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                      placeholder="ej. Castillo Fuerte Es Nuestro Dios"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Autor / Compositor</label>
                    <input
                      type="text"
                      value={editingSong.author}
                      onChange={(e) => setEditingSong({ ...editingSong, author: e.target.value })}
                      placeholder="ej. Martín Lutero"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Copyright / CCLI</label>
                    <input
                      type="text"
                      value={editingSong.copyright}
                      onChange={(e) => setEditingSong({ ...editingSong, copyright: e.target.value })}
                      placeholder="ej. Dominio Público"
                    />
                  </div>
                  <div className="form-group">
                    <label>Líneas por Diapositiva</label>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={editingSong.linesPerSlide || 4}
                      onChange={(e) =>
                        setEditingSong({
                          ...editingSong,
                          linesPerSlide: parseInt(e.target.value, 10) || 4
                        })
                      }
                    />
                  </div>
                </div>

                {/* Paste Area */}
                <div className="form-group">
                  <div className="paste-area-header">
                    <label>Pegar Letra Completa con Encabezados (Verso 1, Coro, Puente, etc.):</label>
                    <button className="auto-detect-btn" onClick={handleAutoParseLyrics}>
                      <Sparkles size={14} />
                      <span>Detectar Grupos Automáticamente</span>
                    </button>
                  </div>
                  <textarea
                    className="raw-lyrics-textarea"
                    rows={12}
                    value={editingSongLyricsRaw}
                    onChange={(e) => setEditingSongLyricsRaw(e.target.value)}
                    placeholder={`[Verso 1]\nCastillo fuerte es nuestro Dios,\ndefensa y buen escudo...\n\n[Coro]\nLuchar no podemos por nuestra fuerza,\nmas por nosotros pelea el Rey...`}
                  />
                </div>
              </div>

              {/* Right Column: Groups Editor, Undo/Redo & Live Theme Preview */}
              <div className="editor-right-column">
                <div className="groups-toolbar">
                  <span className="groups-count-label">
                    Partes ({editingSong.groups.length})
                  </span>
                  <div className="history-buttons">
                    <button
                      className="history-btn"
                      onClick={handleUndoSong}
                      disabled={songHistoryIndex <= 0}
                      title="Deshacer (Ctrl+Z)"
                    >
                      <Undo size={14} />
                      <span>Deshacer</span>
                    </button>
                    <button
                      className="history-btn"
                      onClick={handleRedoSong}
                      disabled={songHistoryIndex >= songGroupsHistory.length - 1}
                      title="Rehacer (Ctrl+Y)"
                    >
                      <Redo size={14} />
                      <span>Rehacer</span>
                    </button>
                  </div>
                </div>

                {/* Groups List */}
                <div className="groups-editor-list">
                  {editingSong.groups.map((group, gIdx) => (
                    <div key={group.id} className="group-editor-card">
                      <div className="group-card-header">
                        <span className="group-type-badge">{group.label}</span>
                        <div className="group-card-actions">
                          <button
                            className="mini-btn"
                            disabled={gIdx === 0}
                            onClick={() => {
                              const updated = [...editingSong.groups]
                              const temp = updated[gIdx]
                              updated[gIdx] = updated[gIdx - 1]
                              updated[gIdx - 1] = temp
                              pushSongGroupsState(updated)
                            }}
                            title="Mover arriba"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            className="mini-btn"
                            disabled={gIdx === editingSong.groups.length - 1}
                            onClick={() => {
                              const updated = [...editingSong.groups]
                              const temp = updated[gIdx]
                              updated[gIdx] = updated[gIdx + 1]
                              updated[gIdx + 1] = temp
                              pushSongGroupsState(updated)
                            }}
                            title="Mover abajo"
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            className="mini-btn"
                            onClick={() => {
                              const cloned: SongGroup = {
                                ...group,
                                id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                label: `${group.label} (Copia)`
                              }
                              const updated = [...editingSong.groups]
                              updated.splice(gIdx + 1, 0, cloned)
                              pushSongGroupsState(updated)
                            }}
                            title="Duplicar parte"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            className="mini-btn delete"
                            onClick={() => {
                              const updated = editingSong.groups.filter((_, idx) => idx !== gIdx)
                              pushSongGroupsState(updated)
                            }}
                            title="Eliminar parte"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <textarea
                        className="group-content-input"
                        rows={3}
                        value={group.content}
                        onChange={(e) => {
                          const updated = [...editingSong.groups]
                          updated[gIdx] = { ...updated[gIdx], content: e.target.value }
                          setEditingSong({ ...editingSong, groups: updated })
                        }}
                        onBlur={() => pushSongGroupsState(editingSong.groups)}
                      />
                    </div>
                  ))}
                </div>

                {/* Live Preview with Theme */}
                <div className="live-preview-box-container">
                  <div className="preview-label">Vista Previa con Tema Activo:</div>
                  <div
                    className="theme-preview-card"
                    style={{
                      background: activeTheme.background.value,
                      fontFamily: activeTheme.fontFamily,
                      color: activeTheme.color,
                      textAlign: activeTheme.alignment
                    }}
                  >
                    <div className="preview-song-title">{editingSong.title || 'Título'}</div>
                    <div className="preview-song-body">
                      {editorPreviewSlides[0]?.body || 'Letra de ejemplo...'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-action-btn" onClick={() => setIsSongEditorOpen(false)}>
                Cancelar
              </button>
              <button className="primary-action-btn" onClick={handleSaveSong}>
                Guardar Canción
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          PRESENTATION EDITOR MODAL
          ========================================================= */}
      {isPresentationEditorOpen && editingPresentation && (
        <div className="modal-backdrop">
          <div className="modal-content song-editor-modal">
            <div className="modal-header">
              <div className="modal-title">
                {editingPresentation.title ? `Editar Presentación: ${editingPresentation.title}` : 'Nueva Presentación'}
              </div>
              <button className="modal-close-btn" onClick={() => setIsPresentationEditorOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="song-editor-grid">
              <div className="editor-left-column">
                <div className="form-group">
                  <label>Título de la Presentación *</label>
                  <input
                    type="text"
                    value={editingPresentation.title}
                    onChange={(e) =>
                      setEditingPresentation({ ...editingPresentation, title: e.target.value })
                    }
                    placeholder="ej. Avisos y Bienvenida"
                  />
                </div>

                <div className="form-group">
                  <label>Descripción / Propósito</label>
                  <input
                    type="text"
                    value={editingPresentation.description}
                    onChange={(e) =>
                      setEditingPresentation({ ...editingPresentation, description: e.target.value })
                    }
                    placeholder="ej. Anuncios para la congregación"
                  />
                </div>

                <div className="zone-footer-actions">
                  <button
                    className="primary-action-btn"
                    onClick={() => {
                      const newSlide = {
                        id: `pslide_${Date.now()}_${editingPresentation.slides.length + 1}`,
                        title: 'Título de la Diapositiva',
                        body: 'Texto principal del anuncio...',
                        subtitle: ''
                      }
                      setEditingPresentation({
                        ...editingPresentation,
                        slides: [...editingPresentation.slides, newSlide]
                      })
                    }}
                  >
                    <Plus size={14} />
                    <span>+ Agregar Diapositiva</span>
                  </button>
                </div>
              </div>

              <div className="editor-right-column">
                <div className="groups-toolbar">
                  <span className="groups-count-label">
                    Diapositivas ({editingPresentation.slides.length})
                  </span>
                </div>

                <div className="groups-editor-list">
                  {editingPresentation.slides.map((slide, sIdx) => (
                    <div key={slide.id} className="group-editor-card">
                      <div className="group-card-header">
                        <span className="group-type-badge">Diapositiva {sIdx + 1}</span>
                        <div className="group-card-actions">
                          <button
                            className="mini-btn delete"
                            disabled={editingPresentation.slides.length <= 1}
                            onClick={() => {
                              const updated = editingPresentation.slides.filter((_, idx) => idx !== sIdx)
                              setEditingPresentation({ ...editingPresentation, slides: updated })
                            }}
                            title="Eliminar diapositiva"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 4 }}>
                        <input
                          type="text"
                          placeholder="Título opcional..."
                          value={slide.title || ''}
                          onChange={(e) => {
                            const updated = [...editingPresentation.slides]
                            updated[sIdx] = { ...updated[sIdx], title: e.target.value }
                            setEditingPresentation({ ...editingPresentation, slides: updated })
                          }}
                        />
                      </div>

                      <textarea
                        className="group-content-input"
                        rows={3}
                        placeholder="Contenido principal..."
                        value={slide.body}
                        onChange={(e) => {
                          const updated = [...editingPresentation.slides]
                          updated[sIdx] = { ...updated[sIdx], body: e.target.value }
                          setEditingPresentation({ ...editingPresentation, slides: updated })
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-action-btn"
                onClick={() => setIsPresentationEditorOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-action-btn" onClick={handleSavePresentation}>
                Guardar Presentación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          DISPLAYS MODAL (Phase 2 Output Screen Manager)
          ========================================================= */}
      {isDisplaysModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content displays-modal">
            <div className="modal-header">
              <div className="modal-title">Configuración de Pantallas Multi-salida</div>
              <button className="modal-close-btn" onClick={() => setIsDisplaysModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="displays-section-info">
                Asigne cada rol de salida a un monitor físico detectado. Los roles no asignados
                permanecerán cerrados.
              </div>

              <div className="displays-roles-table">
                {STANDARD_OUTPUT_ROLES.filter((r) => r.id !== 'operator').map((role) => {
                  const assignedStableId = assignments[role.id]
                  const matchedDisplay = assignedStableId
                    ? matchDisplayByStableId(assignedStableId, displays)
                    : null
                  const isAssigned = !!assignedStableId
                  const isConnected = !!matchedDisplay

                  return (
                    <div key={role.id} className="role-assignment-row">
                      <div className="role-info">
                        <div className="role-name">{role.label}</div>
                        <div className="role-desc">{role.description}</div>
                        <div className="role-status">
                          {isAssigned ? (
                            isConnected ? (
                              <span className="status-pill connected">Conectada</span>
                            ) : (
                              <span className="status-pill disconnected">
                                Desconectada (Guardada)
                              </span>
                            )
                          ) : (
                            <span className="status-pill unassigned">Sin asignar</span>
                          )}
                        </div>
                      </div>

                      <div className="role-select-box">
                        <select
                          value={assignedStableId || 'none'}
                          onChange={async (e) => {
                            const val = e.target.value === 'none' ? null : e.target.value
                            await window.churchPresenterApi.assignRole(role.id, val)
                            const updated = await window.churchPresenterApi.getRoleAssignments()
                            setAssignments(updated)
                          }}
                        >
                          <option value="none">-- Sin asignar --</option>
                          {displays.map((d) => (
                            <option key={d.stableId} value={d.stableId}>
                              {formatDisplayTitle(d)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="displays-actions-row">
                <button
                  className="secondary-action-btn"
                  onClick={() => window.churchPresenterApi.identifyDisplays()}
                >
                  <Monitor size={14} />
                  <span>Identificar Pantallas (Overlay)</span>
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button className="primary-action-btn" onClick={() => setIsDisplaysModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SETTINGS & SHORTCUTS MODAL
          ========================================================= */}
      {isSettingsOpen && (
        <div className="modal-backdrop">
          <div className="modal-content settings-modal">
            <div className="modal-header">
              <div className="modal-title">Configuración del Sistema y Atajos</div>
              <button className="modal-close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Demo Data Management */}
              <div className="settings-section">
                <h3>Datos de Demostración</h3>
                <p className="section-note">
                  Cargue o elimine los himnos y cultos de demostración de dominio público (Martín Lutero, John Newton, Isaac Watts, etc.) sin afectar los datos reales de su iglesia.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="secondary-action-btn"
                    onClick={async () => {
                      const res = await window.churchPresenterApi.loadDemoData()
                      alert(`Se cargaron ${res.songsCount} canciones de demostración de dominio público y 1 plantilla.`)
                      loadAllData()
                    }}
                  >
                    <span>Cargar datos de demostración</span>
                  </button>
                  <button
                    className="secondary-action-btn"
                    style={{ borderColor: '#ef4444', color: '#f87171' }}
                    onClick={async () => {
                      if (confirm('¿Desea borrar todos los datos de demostración? Los datos reales no serán afectados.')) {
                        const res = await window.churchPresenterApi.clearDemoData()
                        alert(`Se eliminaron ${res.deletedSongs} canciones de demostración.`)
                        loadAllData()
                      }
                    }}
                  >
                    <span>Borrar datos de demostración</span>
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <h3>Atajos de Teclado Rápidos (Solo Foco de Ventana)</h3>
                <p className="section-note">
                  Por seguridad, las combinaciones con Ctrl (ej. Ctrl+C) no se interceptan.
                </p>

                <div className="shortcuts-grid">
                  <div className="shortcut-field">
                    <label>Pantalla a Negro:</label>
                    <input
                      type="text"
                      value={tempShortcuts.black}
                      onChange={(e) =>
                        setTempShortcuts({ ...tempShortcuts, black: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                  <div className="shortcut-field">
                    <label>Limpiar Texto:</label>
                    <input
                      type="text"
                      value={tempShortcuts.clear}
                      onChange={(e) =>
                        setTempShortcuts({ ...tempShortcuts, clear: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                  <div className="shortcut-field">
                    <label>Mostrar Logo:</label>
                    <input
                      type="text"
                      value={tempShortcuts.logo}
                      onChange={(e) =>
                        setTempShortcuts({ ...tempShortcuts, logo: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                  <div className="shortcut-field">
                    <label>Congelar Salidas:</label>
                    <input
                      type="text"
                      value={tempShortcuts.freeze}
                      onChange={(e) =>
                        setTempShortcuts({ ...tempShortcuts, freeze: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Copias de Seguridad Automáticas</h3>
                <p className="section-note">
                  El sistema genera copias de seguridad de la base de datos SQLite rotativas y
                  periódicas.
                </p>
                <button
                  className="secondary-action-btn"
                  onClick={() => window.churchPresenterApi.openBackupsFolder()}
                >
                  <FolderOpen size={14} />
                  <span>Abrir Carpeta de Copias de Seguridad</span>
                </button>
              </div>

              {/* Requirement A.1: Doble traducción por rol de salida */}
              <div className="settings-section">
                <h3>Doble Traducción por Pantalla de Salida</h3>
                <p className="section-note">
                  Configure de manera independiente para cada pantalla física (Sala Principal, Escenario, Lobby) qué versión o versiones bíblicas proyectará y si se mostrarán en una sola traducción, apiladas o lado a lado.
                </p>

                <div className="role-bible-configs-table">
                  {STANDARD_OUTPUT_ROLES.map((r) => {
                    const config = roleBibleConfigs[r.id] || { role: r.id, mode: 'single', primaryTranslation: 'RVR1909' }
                    return (
                      <div key={r.id} className="role-bible-config-row">
                        <div className="role-meta">
                          <strong>{r.label} ({r.id})</strong>
                          <span className="role-desc">{r.description}</span>
                        </div>

                        <div className="role-fields">
                          <label>Modo:</label>
                          <select
                            value={config.mode}
                            onChange={(e) => {
                              const updated = { ...config, mode: e.target.value as any }
                              setRoleBibleConfigs({ ...roleBibleConfigs, [r.id]: updated })
                            }}
                          >
                            <option value="single">Una traducción</option>
                            <option value="stacked">Doble traducción apilada</option>
                            <option value="sideBySide">Doble traducción lado a lado</option>
                          </select>

                          <label>Principal:</label>
                          <select
                            value={config.primaryTranslation}
                            onChange={(e) => {
                              const updated = { ...config, primaryTranslation: e.target.value }
                              setRoleBibleConfigs({ ...roleBibleConfigs, [r.id]: updated })
                            }}
                          >
                            {bibleTranslations.map((t) => (
                              <option key={t.id} value={t.abbrev}>
                                {t.name} ({t.abbrev})
                              </option>
                            ))}
                          </select>

                          {config.mode !== 'single' && (
                            <>
                              <label>Secundaria:</label>
                              <select
                                value={config.secondaryTranslation || 'KJV'}
                                onChange={(e) => {
                                  const updated = { ...config, secondaryTranslation: e.target.value }
                                  setRoleBibleConfigs({ ...roleBibleConfigs, [r.id]: updated })
                                }}
                              >
                                {bibleTranslations.map((t) => (
                                  <option key={t.id} value={t.abbrev}>
                                    {t.name} ({t.abbrev})
                                  </option>
                                ))}
                              </select>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Requirement B.4: Salida de Audio Designada */}
              <div className="settings-section">
                <h3>Salida de Audio para Videos y Medios</h3>
                <p className="section-note">
                  El sonido de los videos solo sonará por una salida física designada (mesa de sonido o HDMI de la sala). Las demás pantallas irán en silencio.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label>Salida de Audio activa:</label>
                  <select
                    value={audioOutputRole}
                    onChange={(e) => setAudioOutputRole(e.target.value)}
                    className="bible-select"
                  >
                    <option value="main">Sala Principal (main) - HDMI / Mesa de Sonido</option>
                    <option value="stage">Escenario (stage)</option>
                    <option value="lobby">Vestíbulo / Lobby</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="secondary-action-btn" onClick={() => setIsSettingsOpen(false)}>
                Cancelar
              </button>
              <button
                className="primary-action-btn"
                onClick={async () => {
                  await window.churchPresenterApi.saveShortcuts(tempShortcuts)
                  setShortcuts(tempShortcuts)
                  for (const rId of Object.keys(roleBibleConfigs)) {
                    await window.churchPresenterApi.saveRoleBibleConfig(roleBibleConfigs[rId])
                  }
                  setIsSettingsOpen(false)
                }}
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          MEDIA IMPORT MODAL
          ========================================================= */}
      {isMediaImportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Importar Archivo de Medio</div>
              <button className="modal-close-btn" onClick={() => setIsMediaImportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="section-note">
                Soporta videos MP4 (H.264/AAC), WebM (VP8/VP9), audios MP3/WAV/AAC/OGG, imágenes y documentos PDF. Los archivos se copian a la carpeta de medios de la app (detectando duplicados por hash SHA-256).
              </p>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Ruta completa del archivo en este equipo *</label>
                <input
                  type="text"
                  placeholder="ej. C:\Videos\intro.mp4 o D:\Avisos.pdf"
                  value={importMediaFilePath}
                  onChange={(e) => setImportMediaFilePath(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Etiquetas (opcionales, separadas por coma):</label>
                <input
                  type="text"
                  placeholder="ej. intro, culto, fondo, navidad"
                  value={importMediaTags}
                  onChange={(e) => setImportMediaTags(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-action-btn" onClick={() => setIsMediaImportModalOpen(false)}>
                Cancelar
              </button>
              <button
                className="primary-action-btn"
                onClick={async () => {
                  if (!importMediaFilePath.trim()) {
                    alert('Ingrese la ruta del archivo')
                    return
                  }
                  try {
                    const tags = importMediaTags.split(',').map((t) => t.trim()).filter(Boolean)
                    const imported = await window.churchPresenterApi.importMediaFile(importMediaFilePath.trim(), tags)
                    alert(`Medio importado con éxito: ${imported.originalName} (${(imported.fileSize / (1024 * 1024)).toFixed(1)} MB)`)
                    setIsMediaImportModalOpen(false)
                    setImportMediaFilePath('')
                    setImportMediaTags('')
                    loadAllData()
                  } catch (err: any) {
                    alert(`Error al importar: ${err.message}`)
                  }
                }}
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          TEMPLATES MODAL
          ========================================================= */}
      {isTemplateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content templates-modal">
            <div className="modal-header">
              <div className="modal-title">Plantillas de Servicio Disponibles</div>
              <button className="modal-close-btn" onClick={() => setIsTemplateModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {templates.length > 0 ? (
                templates.map((tmpl) => (
                  <div key={tmpl.id} className="template-card">
                    <div>
                      <div className="template-name">{tmpl.name}</div>
                      <div className="template-meta">{tmpl.items.length} elementos estructurados</div>
                    </div>
                    <button
                      className="primary-action-btn"
                      onClick={() => handleCreateFromTemplate(tmpl)}
                    >
                      Usar Plantilla
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-list-notice">
                  No hay plantillas guardadas. Guarde un servicio como plantilla para reutilizarlo.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="secondary-action-btn" onClick={() => setIsTemplateModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          THEMES MODAL
          ========================================================= */}
      {isThemesModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content themes-modal">
            <div className="modal-header">
              <div className="modal-title">Gestión de Temas y Tipografía</div>
              <button className="modal-close-btn" onClick={() => setIsThemesModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="themes-list-grid">
                {themes.map((th) => (
                  <div
                    key={th.id}
                    className={`theme-card ${th.isDefault ? 'is-active-theme' : ''}`}
                    style={{ background: th.background.value }}
                  >
                    <div className="theme-card-content">
                      <div className="theme-title">{th.name}</div>
                      <div className="theme-meta">Fuente: {th.fontFamily}</div>
                    </div>

                    <div className="theme-actions">
                      {!th.isDefault && (
                        <button
                          className="primary-action-btn"
                          onClick={async () => {
                            await window.churchPresenterApi.setDefaultTheme(th.id)
                            const updatedThemes = await window.churchPresenterApi.getThemes()
                            setThemes(updatedThemes)
                          }}
                        >
                          Usar por Defecto
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="primary-action-btn" onClick={() => setIsThemesModalOpen(false)}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          BACKGROUNDS MODAL
          ========================================================= */}
      {isBackgroundsModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content backgrounds-modal">
            <div className="modal-header">
              <div className="modal-title">Biblioteca de Imágenes de Fondo</div>
              <button className="modal-close-btn" onClick={() => setIsBackgroundsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="backgrounds-grid">
                {backgroundImages.map((bg) => (
                  <div key={bg.id} className="bg-card">
                    <img src={bg.url || bg.filePath} alt={bg.name} className="bg-thumbnail" />
                    <div className="bg-info">
                      <span className="bg-name">{bg.name}</span>
                      <button
                        className="bg-delete-btn"
                        onClick={async () => {
                          if (confirm(`¿Eliminar fondo ${bg.name}?`)) {
                            await window.churchPresenterApi.deleteBackgroundImage(bg.id)
                            setBackgroundImages((prev) => prev.filter((b) => b.id !== bg.id))
                          }
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="primary-action-btn" onClick={() => setIsBackgroundsModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toasts-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-card toast-${toast.type}`}>
            <AlertCircle size={16} />
            <div>
              <div className="toast-title">{toast.title}</div>
              <div className="toast-msg">{toast.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
