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
  IndependentAudioState,
  PptConverterInfo,
  PptConverterType,
  PptPresentationManifest,
  FfmpegStatus,
  UserLibrary,
  LibraryItemReference,
  PresentationTimer,
  FileChangedEvent
} from '../../shared/types'
import { TopMenuBar } from './components/TopMenuBar'
import { ProToolbar } from './components/ProToolbar'
import { LibraryPanel } from './components/LibraryPanel'
import { PlaylistPanel } from './components/PlaylistPanel'
import { SlideGridPanel } from './components/SlideGridPanel'
import { MediaDrawer } from './components/MediaDrawer'
import { RightSidePanel } from './components/RightSidePanel'
import { FileDropOverlay } from './components/FileDropOverlay'
import { FileWatcherToast } from './components/FileWatcherToast'
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
  RotateCcw,
  FolderPlus,
  ExternalLink,
  Film,
  RefreshCw
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

  // ProPresenter 7 Workspace States
  const [userLibraries, setUserLibraries] = useState<UserLibrary[]>([])
  const [activeUserLibraryId, setActiveUserLibraryId] = useState<string>('lib_songs')
  const [presentationTimers, setPresentationTimers] = useState<PresentationTimer[]>([])
  const [slideZoom, setSlideZoom] = useState<number>(() => {
    const saved = localStorage.getItem('cp_slide_zoom')
    return saved ? Number(saved) : 40
  })
  const [slideViewMode, setSlideViewMode] = useState<'grid' | 'list'>('grid')
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState<boolean>(false)
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false)
  const [fileWatcherEvent, setFileWatcherEvent] = useState<FileChangedEvent | null>(null)
  const [activeToolbarMode, setActiveToolbarMode] = useState<'show' | 'edit' | 'bible' | 'more'>('show')
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState<boolean>(false)

  // Save slide zoom preference
  useEffect(() => {
    localStorage.setItem('cp_slide_zoom', String(slideZoom))
  }, [slideZoom])

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

  // Dev Environment State (Requirement A.6)
  const [isDev, setIsDev] = useState<boolean>(false)
  const [userDataPath, setUserDataPath] = useState<string>('')

  // Audio Output Devices (Requirement A.2)
  const [audioDevices, setAudioDevices] = useState<{ deviceId: string; label: string }[]>([])
  const [audioDeviceVideo, setAudioDeviceVideo] = useState<string>(localStorage.getItem('cp_audio_device_video') || '')
  const [audioDeviceAmbient, setAudioDeviceAmbient] = useState<string>(localStorage.getItem('cp_audio_device_ambient') || '')

  // Video Fade Controls (Requirement A.3)
  const [videoFadeInSec, setVideoFadeInSec] = useState<number>(0)
  const [videoFadeOutSec, setVideoFadeOutSec] = useState<number>(0)

  // Media Library Search & Tags (Requirement A.3)
  const [selectedMediaTag, setSelectedMediaTag] = useState<string>('all')
  const [isFolderImportModalOpen, setIsFolderImportModalOpen] = useState<boolean>(false)
  const [importFolderPath, setImportFolderPath] = useState<string>('')
  const [exportIncludeMedia, setExportIncludeMedia] = useState<boolean>(false)

  // FFmpeg State (Requirement A.5)
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus>({ available: false, path: null, version: null })
  const [isFfmpegModalOpen, setIsFfmpegModalOpen] = useState<boolean>(false)
  const [ffmpegInputPath, setFfmpegInputPath] = useState<string>('')
  const [ffmpegProgress, setFfmpegProgress] = useState<number>(0)
  const [isConvertingFfmpeg, setIsConvertingFfmpeg] = useState<boolean>(false)

  // PowerPoint State (Fase 5B)
  const [pptConverters, setPptConverters] = useState<PptConverterInfo[]>([])
  const [preferredPptConverter, setPreferredPptConverter] = useState<PptConverterType>('powerpoint_com')
  const [isPptImportModalOpen, setIsPptImportModalOpen] = useState<boolean>(false)
  const [importPptPath, setImportPptPath] = useState<string>('')
  const [pptJobId, setPptJobId] = useState<string | null>(null)
  const [isPptConverting, setIsPptConverting] = useState<boolean>(false)
  const [pptConvertStep, setPptConvertStep] = useState<string>('')
  const [pptManifests, setPptManifests] = useState<Record<string, PptPresentationManifest>>({})

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

      if (window.churchPresenterApi.getLibraries) {
        try {
          const libs = await window.churchPresenterApi.getLibraries()
          setUserLibraries(libs || [])
        } catch {
          // ignore
        }
      }

      if (window.churchPresenterApi.getTimers) {
        try {
          const tmrs = await window.churchPresenterApi.getTimers()
          setPresentationTimers(tmrs || [])
        } catch {
          // ignore
        }
      }

      if (window.churchPresenterApi.getEnvInfo) {
        try {
          const env = await window.churchPresenterApi.getEnvInfo()
          setIsDev(env.isDev)
          setUserDataPath(env.userDataPath)
        } catch {
          // ignore
        }
      }

      if (window.churchPresenterApi.detectFfmpeg) {
        try {
          const ff = await window.churchPresenterApi.detectFfmpeg()
          setFfmpegStatus(ff)
        } catch {
          // ignore
        }
      }

      if (window.churchPresenterApi.detectPptConverters) {
        try {
          const convs = await window.churchPresenterApi.detectPptConverters()
          setPptConverters(convs)
          if (convs.some((c) => c.type === 'powerpoint_com' && c.isAvailable)) {
            setPreferredPptConverter('powerpoint_com')
          } else if (convs.some((c) => c.type === 'libreoffice' && c.isAvailable)) {
            setPreferredPptConverter('libreoffice')
          } else {
            setPreferredPptConverter('manual')
          }
        } catch {
          // ignore
        }
      }

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devs = await navigator.mediaDevices.enumerateDevices()
          const outs = devs
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || `Dispositivo de Audio (${d.deviceId.slice(0, 5)}...)`
            }))
          setAudioDevices(outs)
        } catch {
          // ignore
        }
      }

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

    const onDeviceChange = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devs = await navigator.mediaDevices.enumerateDevices()
          const outs = devs
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || `Dispositivo de Audio (${d.deviceId.slice(0, 5)}...)`
            }))
          setAudioDevices(outs)

          if (audioDeviceVideo && !outs.some((o) => o.deviceId === audioDeviceVideo)) {
            setAudioDeviceVideo('')
            localStorage.removeItem('cp_audio_device_video')
            setToasts((prev) => [
              ...prev,
              {
                id: `aud_disc_${Date.now()}`,
                title: 'Dispositivo de Audio Desconectado',
                message: 'El dispositivo de audio para video se ha desconectado. Se usará el predeterminado.',
                type: 'warn',
                timestamp: Date.now()
              }
            ])
          }

          if (audioDeviceAmbient && !outs.some((o) => o.deviceId === audioDeviceAmbient)) {
            setAudioDeviceAmbient('')
            localStorage.removeItem('cp_audio_device_ambient')
            setToasts((prev) => [
              ...prev,
              {
                id: `aud_disc_amb_${Date.now()}`,
                title: 'Dispositivo de Audio Desconectado',
                message: 'El dispositivo de audio ambiental se ha desconectado. Se usará el predeterminado.',
                type: 'warn',
                timestamp: Date.now()
              }
            ])
          }
        } catch {
          // ignore
        }
      }
    }

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)

    let unsubTimers: () => void = () => {}
    if (window.churchPresenterApi.onTimersTick) {
      unsubTimers = window.churchPresenterApi.onTimersTick((t) => {
        setPresentationTimers(t || [])
      })
    }

    let unsubFileWatcher: () => void = () => {}
    if (window.churchPresenterApi.onFileChanged) {
      unsubFileWatcher = window.churchPresenterApi.onFileChanged((evt) => {
        setFileWatcherEvent(evt)
      })
    }

    return () => {
      unsubDisplays()
      unsubState()
      unsubNotif()
      unsubTimers()
      unsubFileWatcher()
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
    }
  }, [loadAllData, audioDeviceVideo, audioDeviceAmbient])

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

    if (currentServiceItem.type === 'powerpoint') {
      const manifest =
        (currentServiceItem.powerpointConfig?.hash && pptManifests[currentServiceItem.powerpointConfig.hash]) ||
        (currentServiceItem.powerpointConfig?.originalPath && pptManifests[currentServiceItem.powerpointConfig.originalPath])

      if (manifest && manifest.slides && manifest.slides.length > 0) {
        return manifest.slides.map((s) => ({
          id: `ppt_${currentServiceItem.id}_slide_${s.index}`,
          sourceId: currentServiceItem.id,
          sourceType: 'powerpoint' as const,
          groupLabel: `Diapositiva ${s.index}`,
          slideIndex: s.index,
          totalSlidesInGroup: manifest.slideCount,
          title: currentServiceItem.name,
          subtitle: `Diapositiva ${s.index} de ${manifest.slideCount}`,
          body: s.speakerNotes || '',
          mediaUrl: s.imagePath,
          speakerNotes: s.speakerNotes,
          warnings: s.warnings
        }))
      }

      return [
        {
          id: `ppt_${currentServiceItem.id}_empty`,
          sourceId: currentServiceItem.id,
          sourceType: 'powerpoint' as const,
          groupLabel: 'PowerPoint',
          slideIndex: 1,
          totalSlidesInGroup: 1,
          title: currentServiceItem.name,
          subtitle: 'Presentación PowerPoint',
          body: 'Cargando diapositivas...',
          speakerNotes: ''
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
    pdfFitMode,
    pptManifests
  ])

  // Automatically load PowerPoint manifest if selected item is powerpoint
  useEffect(() => {
    if (
      currentServiceItem?.type === 'powerpoint' &&
      currentServiceItem.powerpointConfig?.originalPath
    ) {
      const key = currentServiceItem.powerpointConfig.hash || currentServiceItem.powerpointConfig.originalPath
      if (!pptManifests[key]) {
        window.churchPresenterApi
          .importPowerPoint(currentServiceItem.powerpointConfig.originalPath)
          .then((manifest) => {
            setPptManifests((prev) => ({
              ...prev,
              [manifest.hash]: manifest,
              [manifest.originalPath]: manifest
            }))
          })
          .catch((err) => console.warn('Could not load PowerPoint manifest:', err))
      }
    }
  }, [currentServiceItem, pptManifests])

  // Audio test chime helper
  const playTestAudioChime = async (deviceId?: string) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (deviceId && typeof (audioCtx as any).setSinkId === 'function') {
        await (audioCtx as any).setSinkId(deviceId)
      }
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime) // C5
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15) // E5
      osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3) // G5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6)
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.start()
      osc.stop(audioCtx.currentTime + 0.6)
    } catch (err: any) {
      console.warn('Audio test chime error:', err)
      alert(`Prueba de audio: ${err.message || 'No se pudo reproducir en este dispositivo'}`)
    }
  }

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
            fadeInSeconds: videoFadeInSec > 0 ? videoFadeInSec : undefined,
            fadeOutSeconds: videoFadeOutSec > 0 ? videoFadeOutSec : undefined,
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
    [currentServiceItem, mediaItems, videoLoop, videoVolume, videoInPoint, videoOutPoint, videoFadeInSec, videoFadeOutSec, videoEndAction, audioOutputRole]
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

  const allMediaTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const item of mediaItems) {
      if (item.tags) {
        for (const t of item.tags) {
          if (t.trim()) tagSet.add(t.trim())
        }
      }
    }
    return Array.from(tagSet)
  }, [mediaItems])

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
      if (selectedMediaTag !== 'all') {
        if (!item.tags || !item.tags.includes(selectedMediaTag)) {
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
  }, [mediaItems, mediaFilterType, selectedMediaTag, searchQuery])

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
    const jsonStr = await window.churchPresenterApi.exportLibrary(exportIncludeMedia)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ChurchPresenter_Biblioteca_${new Date().toISOString().split('T')[0]}.cpr`
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

  // ProPresenter 7 User Action Handlers
  const handleNativeImportPpt = async () => {
    const result = await window.churchPresenterApi.openFileDialog({
      title: 'Seleccionar Presentación PowerPoint',
      filters: [{ name: 'PowerPoint (*.pptx, *.ppt)', extensions: ['pptx', 'ppt', 'pptm', 'ppsx'] }],
      properties: ['openFile']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      setIsImportingPpt(true)
      try {
        const manifest = await window.churchPresenterApi.importPpt(selectedPath)
        await loadAllData()
        if (currentService) {
          const newItem: ServiceItem = {
            id: `item_p_${Date.now()}`,
            type: 'presentation',
            name: manifest.fileName,
            presentationId: manifest.presentationId
          }
          const updated = { ...currentService, items: [...currentService.items, newItem] }
          await window.churchPresenterApi.saveService(updated)
          setCurrentService(updated)
        }
      } catch (err: any) {
        alert(`Error al importar presentación: ${err.message}`)
      } finally {
        setIsImportingPpt(false)
      }
    }
  }

  const handleNativeImportMedia = async () => {
    const result = await window.churchPresenterApi.openFileDialog({
      title: 'Seleccionar Archivos de Medios',
      filters: [
        { name: 'Todos los Medios', extensions: ['mp4', 'webm', 'mov', 'mkv', 'jpg', 'jpeg', 'png', 'mp3', 'wav', 'pdf'] },
        { name: 'Videos', extensions: ['mp4', 'webm', 'mov', 'mkv'] },
        { name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac'] },
        { name: 'PDF', extensions: ['pdf'] }
      ],
      properties: ['openFile', 'multiSelections']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      for (const p of result.filePaths) {
        await window.churchPresenterApi.importMediaFile(p)
      }
      await loadAllData()
    }
  }

  const handleNativeImportFolder = async () => {
    const result = await window.churchPresenterApi.openFolderDialog({
      title: 'Seleccionar Carpeta de Medios'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      await window.churchPresenterApi.importMediaFolder(result.filePaths[0])
      await loadAllData()
    }
  }

  const handleCreateUserLibrary = async (name: string) => {
    const newLib: UserLibrary = {
      id: `lib_custom_${Date.now()}`,
      name,
      isSpecial: false,
      sortOrder: userLibraries.length
    }
    await window.churchPresenterApi.saveLibrary(newLib)
    const updated = await window.churchPresenterApi.getLibraries()
    setUserLibraries(updated || [])
    setActiveUserLibraryId(newLib.id)
  }

  const handleDeleteUserLibrary = async (id: string) => {
    await window.churchPresenterApi.deleteLibrary(id)
    const updated = await window.churchPresenterApi.getLibraries()
    setUserLibraries(updated || [])
    setActiveUserLibraryId('lib_songs')
  }

  const handleReorderPlaylistItem = (fromIdx: number, toIdx: number) => {
    if (!currentService) return
    const newItems = [...currentService.items]
    const [moved] = newItems.splice(fromIdx, 1)
    newItems.splice(toIdx, 0, moved)
    const updated = { ...currentService, items: newItems }
    setCurrentService(updated)
    setSelectedServiceItemIndex(toIdx)
    window.churchPresenterApi.saveService(updated)
  }

  const handleDeletePlaylistItem = (idx: number) => {
    if (!currentService) return
    const newItems = currentService.items.filter((_, i) => i !== idx)
    const updated = { ...currentService, items: newItems }
    setCurrentService(updated)
    setSelectedServiceItemIndex(Math.max(0, idx - 1))
    window.churchPresenterApi.saveService(updated)
  }

  const handleDuplicatePlaylistItem = (idx: number) => {
    if (!currentService) return
    const orig = currentService.items[idx]
    const dup: ServiceItem = {
      ...orig,
      id: `item_${Date.now()}`,
      name: `${orig.name} (Copia)`
    }
    const newItems = [...currentService.items]
    newItems.splice(idx + 1, 0, dup)
    const updated = { ...currentService, items: newItems }
    setCurrentService(updated)
    setSelectedServiceItemIndex(idx + 1)
    window.churchPresenterApi.saveService(updated)
  }

  const handleAddSlideToCurrent = () => {
    if (!currentSong) {
      handleAddBlankItem()
      return
    }
    const newGroup: SongGroup = {
      id: `group_${Date.now()}`,
      label: `Verso ${currentSong.groups.length + 1}`,
      content: 'Nueva letra...'
    }
    const updatedSong: Song = {
      ...currentSong,
      groups: [...currentSong.groups, newGroup]
    }
    window.churchPresenterApi.saveSong(updatedSong).then(() => {
      loadAllData()
    })
  }

  const handleIdentifyDisplays = () => {
    window.churchPresenterApi.openPreviewOutputWindow('main')
    window.churchPresenterApi.openPreviewOutputWindow('stage')
    window.churchPresenterApi.openPreviewOutputWindow('lobby')
  }

  // HTML5 Drag and Drop Handlers for Window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFiles(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.relatedTarget === null) {
      setIsDraggingFiles(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFiles(false)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const nativePath = window.churchPresenterApi.getPathForFile(file)
      if (!nativePath) continue

      const ext = nativePath.split('.').pop()?.toLowerCase()
      if (ext === 'pptx' || ext === 'ppt') {
        try {
          setIsImportingPpt(true)
          const manifest = await window.churchPresenterApi.importPpt(nativePath)
          await loadAllData()
          if (currentService) {
            const newItem: ServiceItem = {
              id: `item_p_${Date.now()}_${i}`,
              type: 'presentation',
              name: manifest.fileName || file.name,
              presentationId: manifest.presentationId
            }
            const updated = { ...currentService, items: [...currentService.items, newItem] }
            await window.churchPresenterApi.saveService(updated)
            setCurrentService(updated)
          }
        } catch (err: any) {
          alert(`Error al importar PowerPoint: ${err.message}`)
        } finally {
          setIsImportingPpt(false)
        }
      } else if (['mp4', 'webm', 'mov', 'mkv', 'jpg', 'png', 'jpeg', 'mp3', 'wav', 'pdf'].includes(ext || '')) {
        try {
          const item = await window.churchPresenterApi.importMediaFile(nativePath)
          await loadAllData()
          if (currentService) {
            const newItem: ServiceItem = {
              id: `item_m_${Date.now()}_${i}`,
              type: 'media',
              name: item.originalName,
              mediaId: item.id
            }
            const updated = { ...currentService, items: [...currentService.items, newItem] }
            await window.churchPresenterApi.saveService(updated)
            setCurrentService(updated)
          }
        } catch (err: any) {
          alert(`Error al importar archivo: ${err.message}`)
        }
      }
    }
  }

  const activeTheme = state?.currentTheme || DEFAULT_THEME

  return (
    <div
      className="pro-operator-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 1. ProPresenter Top Menu Bar */}
      <TopMenuBar
        onNewService={handleCreateNewService}
        onImportPpt={handleNativeImportPpt}
        onImportMedia={handleNativeImportMedia}
        onImportFolder={handleNativeImportFolder}
        onExportService={handleExportLibrary}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onLoadDemoData={async () => {
          await window.churchPresenterApi.loadDemoData()
          await loadAllData()
          alert('Datos de demostración cargados exitosamente.')
        }}
        onClearDemoData={async () => {
          await window.churchPresenterApi.clearDemoData()
          await loadAllData()
          alert('Datos de demostración eliminados.')
        }}
        onToggleMediaDrawer={() => setIsMediaDrawerOpen(!isMediaDrawerOpen)}
        onIdentifyDisplays={handleIdentifyDisplays}
        onZoomIn={() => setSlideZoom((z) => Math.min(100, z + 15))}
        onZoomOut={() => setSlideZoom((z) => Math.max(0, z - 15))}
        onToggleViewMode={() => setSlideViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
        onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
      />

      {/* 2. ProPresenter Toolbar */}
      <ProToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeMode={activeToolbarMode}
        onModeChange={(m) => {
          setActiveToolbarMode(m)
          if (m === 'edit' && currentSong) {
            handleOpenSongEditor(currentSong)
          } else if (m === 'bible') {
            setIsBibleImportModalOpen(false)
          } else if (m === 'more') {
            setIsSettingsModalOpen(true)
          }
        }}
        onAddTextSlide={handleAddBlankItem}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        state={state}
        displays={displays}
        assignments={assignments}
        shortcuts={shortcuts}
      />

      {/* 3. Main Workspace: 3 Columns Layout */}
      <div className="pro-main-columns-layout">
        {/* Left Column: Library Collections (Top) + Service Playlist (Bottom) */}
        <aside className="pro-left-column">
          <LibraryPanel
            libraries={userLibraries}
            activeLibraryId={activeUserLibraryId}
            onSelectLibrary={setActiveUserLibraryId}
            onCreateLibrary={handleCreateUserLibrary}
            onDeleteLibrary={handleDeleteUserLibrary}
            songs={filteredSongs}
            presentations={filteredPresentations}
            mediaItems={mediaItems}
            onItemSelect={(type, id) => {
              if (type === 'song') {
                const s = songs.find((x) => x.id === id)
                if (s && currentService) {
                  const item = {
                    id: `item_s_${Date.now()}`,
                    type: 'song',
                    name: s.title,
                    songId: s.id
                  }
                  const updated = { ...currentService, items: [...currentService.items, item] }
                  setCurrentService(updated)
                  setSelectedServiceItemIndex(updated.items.length - 1)
                  window.churchPresenterApi.saveService(updated)
                }
              }
            }}
            onAddItemToPlaylist={(type, id, name) => {
              if (currentService) {
                const newItem = {
                  id: `item_${Date.now()}`,
                  type,
                  name,
                  songId: type === 'song' ? id : undefined,
                  presentationId: type === 'presentation' ? id : undefined,
                  mediaId: type === 'media' ? id : undefined
                }
                const updated = { ...currentService, items: [...currentService.items, newItem] }
                setCurrentService(updated)
                window.churchPresenterApi.saveService(updated)
              }
            }}
          />

          <PlaylistPanel
            currentService={currentService}
            services={services}
            onSelectService={(sid) => {
              const found = services.find((s) => s.id === sid)
              if (found) {
                setCurrentService(found)
                setSelectedServiceItemIndex(0)
              }
            }}
            onNewService={handleCreateNewService}
            selectedItemIndex={selectedServiceItemIndex}
            onSelectItemIndex={setSelectedServiceItemIndex}
            liveItemIndex={
              currentService && liveSourceId
                ? currentService.items.findIndex(
                    (it) =>
                      it.songId === liveSourceId ||
                      it.presentationId === liveSourceId ||
                      it.id === liveSourceId
                  )
                : null
            }
            onReorderItem={handleReorderPlaylistItem}
            onDeleteItem={handleDeletePlaylistItem}
            onDuplicateItem={handleDuplicatePlaylistItem}
            onAddHeader={(headerName) => {
              if (currentService) {
                const newHeader = {
                  id: `header_${Date.now()}`,
                  type: 'header',
                  name: headerName
                }
                const updated = { ...currentService, items: [...currentService.items, newHeader] }
                setCurrentService(updated)
                window.churchPresenterApi.saveService(updated)
              }
            }}
            onAddBlankItem={handleAddBlankItem}
          />
        </aside>

        {/* Center Column: Slide Thumbnails Grid & Bottom Media Drawer */}
        <section className="pro-center-column">
          <SlideGridPanel
            title={currentServiceItem?.name || currentSong?.title || 'Diapositivas'}
            subtitle={currentSong?.author}
            slides={activeSlides}
            selectedSlideIndex={previewSlideIndex}
            onSelectSlideIndex={setPreviewSlideIndex}
            liveSlideId={liveSlideId}
            onGoLive={handleGoLive}
            zoomLevel={slideZoom}
            onZoomChange={setSlideZoom}
            viewMode={slideViewMode}
            onViewModeChange={setSlideViewMode}
            onAddSlide={handleAddSlideToCurrent}
            onOpenEditor={() => {
              if (currentSong) handleOpenSongEditor(currentSong)
            }}
            theme={activeTheme}
            arrangements={currentSong?.arrangements}
            selectedArrangementId={selectedArrangementId}
            onSelectArrangement={setSelectedArrangementId}
          />

          {/* Collapsible Media Drawer */}
          <MediaDrawer
            isOpen={isMediaDrawerOpen}
            onToggle={() => setIsMediaDrawerOpen(!isMediaDrawerOpen)}
            mediaItems={mediaItems}
            onImportFile={handleNativeImportMedia}
            onImportFolder={handleNativeImportFolder}
            onPlayMedia={(item) => {
              window.churchPresenterApi.playVideo({
                mediaId: item.id,
                mediaPath: item.filePath,
                loop: true,
                volume: 1.0,
                endAction: 'freeze',
                audioOutputRole: 'main'
              })
            }}
            onSetAsBackground={(item) => {
              window.churchPresenterApi.setBackground({
                type: item.mediaType === 'video' ? 'video' : 'image',
                value: item.filePath
              })
            }}
          />
        </section>

        {/* Right Column: Preview, Audio VU, Layers, Transport & Timers */}
        <aside className="pro-right-panel">
          <RightSidePanel
            state={state}
            currentSlide={activeSlides[previewSlideIndex] || null}
            timers={presentationTimers}
            onControlTimer={async (id, action) => {
              await window.churchPresenterApi.controlTimer(id, action)
            }}
            onSaveTimer={async (timer) => {
              await window.churchPresenterApi.saveTimer(timer)
              const updated = await window.churchPresenterApi.getTimers()
              setPresentationTimers(updated || [])
            }}
            onDeleteTimer={async (id) => {
              await window.churchPresenterApi.deleteTimer(id)
              const updated = await window.churchPresenterApi.getTimers()
              setPresentationTimers(updated || [])
            }}
            onClearLayer={(layer) => {
              if (layer === 'all') {
                window.churchPresenterApi.toggleGlobalControl('clear')
              } else if (layer === 'background') {
                window.churchPresenterApi.clearBackground()
              } else if (layer === 'slide') {
                window.churchPresenterApi.clearSlide()
              } else if (layer === 'audio') {
                window.churchPresenterApi.controlIndependentAudio('stop')
              } else if (layer === 'media') {
                window.churchPresenterApi.controlVideo('stop')
              } else if (layer === 'message') {
                handleClearStageMessage()
              }
            }}
            onControlVideo={(action, time) => {
              window.churchPresenterApi.controlVideo(action, time)
            }}
          />
        </aside>
      </div>

      {/* Drag & Drop Overlay */}
      <FileDropOverlay isDragging={isDraggingFiles} />

      {/* External File Watcher Toast */}
      <FileWatcherToast
        event={fileWatcherEvent}
        onRefresh={async (evt) => {
          try {
            if (evt.type === 'powerpoint') {
              await window.churchPresenterApi.importPpt(evt.filePath)
            } else {
              await window.churchPresenterApi.importMediaFile(evt.filePath)
            }
            await loadAllData()
            setToasts((prev) => [
              ...prev,
              {
                id: `watcher_ref_${Date.now()}`,
                title: 'Archivo Actualizado',
                message: 'El contenido externo se ha sincronizado correctamente.',
                type: 'info',
                timestamp: Date.now()
              }
            ])
          } catch (err) {
            alert(`Error al actualizar archivo: ${err.message}`)
          }
          setFileWatcherEvent(null)
        }}
        onDismiss={() => setFileWatcherEvent(null)}
      />

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

              {/* Requirement B.4 & A.2: Salidas y Dispositivos de Audio Físicos */}
              <div className="settings-section">
                <h3>Salida y Dispositivos de Audio</h3>
                <p className="section-note">
                  Configure la pantalla que reproducirá el audio del video, y asigne los dispositivos físicos de audio para medios y música ambiental.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ minWidth: 200 }}>Pantalla con audio activo:</label>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ minWidth: 200 }}>Dispositivo de Audio (Video):</label>
                    <select
                      value={audioDeviceVideo}
                      onChange={(e) => {
                        setAudioDeviceVideo(e.target.value)
                        localStorage.setItem('cp_audio_device_video', e.target.value)
                      }}
                      className="bible-select"
                      style={{ flex: 1 }}
                    >
                      <option value="">Predeterminado del Sistema</option>
                      {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="sound-test-btn"
                      onClick={() => playTestAudioChime(audioDeviceVideo)}
                      title="Probar sonido en este dispositivo"
                    >
                      <Volume2 size={13} />
                      <span>Probar Sonido</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ minWidth: 200 }}>Dispositivo Música Ambiental:</label>
                    <select
                      value={audioDeviceAmbient}
                      onChange={(e) => {
                        setAudioDeviceAmbient(e.target.value)
                        localStorage.setItem('cp_audio_device_ambient', e.target.value)
                      }}
                      className="bible-select"
                      style={{ flex: 1 }}
                    >
                      <option value="">Predeterminado del Sistema</option>
                      {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="sound-test-btn"
                      onClick={() => playTestAudioChime(audioDeviceAmbient)}
                      title="Probar sonido en este dispositivo"
                    >
                      <Volume2 size={13} />
                      <span>Probar Sonido</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Requirement A.6: Información del Entorno y Copia de Biblioteca */}
              <div className="settings-section">
                <h3>Información de Entorno y Datos</h3>
                <p className="section-note">
                  Versión instalada: <strong>v{appVersion}</strong> {isDev ? '(Modo Desarrollo Activo)' : '(Producción)'}
                  <br />
                  Carpeta de datos: <code>{userDataPath || 'Predeterminada'}</code>
                </p>
                {isDev && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="secondary-action-btn"
                      id="copy-prod-btn"
                      onClick={async () => {
                        if (
                          confirm(
                            '¿Copiar la biblioteca real de producción a este entorno de desarrollo?\n\n' +
                            'Esta acción reemplazará la base de datos y archivos de prueba locales con los datos reales para depuración segura. Los datos reales nunca serán modificados.'
                          )
                        ) {
                          try {
                            const res = await window.churchPresenterApi.copyProdLibraryToDev()
                            if (res.success) {
                              alert(res.message)
                              loadAllData()
                            } else {
                              alert(`No se pudo copiar: ${res.message}`)
                            }
                          } catch (err: any) {
                            alert(`Error: ${err.message}`)
                          }
                        }
                      }}
                    >
                      <Copy size={13} />
                      <span>Copiar Biblioteca Real a Desarrollo</span>
                    </button>
                  </div>
                )}
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

              <div style={{ marginTop: 12, padding: 8, background: '#1e293b', borderRadius: 4 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                  ¿Tiene un video en formato no compatible (MKV, AVI, MOV, HEVC)?
                </div>
                <button
                  type="button"
                  className="secondary-action-btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setIsMediaImportModalOpen(false)
                    setFfmpegInputPath(importMediaFilePath)
                    setIsFfmpegModalOpen(true)
                  }}
                >
                  <Film size={13} />
                  <span>Convertir a MP4 (H.264/AAC) con FFmpeg</span>
                </button>
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
          FOLDER IMPORT MODAL (Requirement A.3)
          ========================================================= */}
      {isFolderImportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Importar Carpeta de Imágenes</div>
              <button className="modal-close-btn" onClick={() => setIsFolderImportModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="section-note">
                Seleccione o ingrese la ruta de una carpeta que contenga imágenes (JPG, PNG, WebP). Todas las imágenes serán importadas automáticamente a la biblioteca de medios.
              </p>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Ruta de la carpeta en este equipo *</label>
                <input
                  type="text"
                  placeholder="ej. C:\Imagenes\FondosCulto"
                  value={importFolderPath}
                  onChange={(e) => setImportFolderPath(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-action-btn" onClick={() => setIsFolderImportModalOpen(false)}>
                Cancelar
              </button>
              <button
                className="primary-action-btn"
                onClick={async () => {
                  if (!importFolderPath.trim()) {
                    alert('Ingrese la ruta de la carpeta')
                    return
                  }
                  try {
                    const imported = await window.churchPresenterApi.importImageFolder(importFolderPath.trim())
                    alert(`Se importaron ${imported.length} imágenes exitosamente.`)
                    setIsFolderImportModalOpen(false)
                    setImportFolderPath('')
                    loadAllData()
                  } catch (err: any) {
                    alert(`Error al importar carpeta: ${err.message}`)
                  }
                }}
              >
                Importar Carpeta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          POWERPOINT IMPORT MODAL (Phase 5B)
          ========================================================= */}
      {isPptImportModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">Importar Presentación PowerPoint (.pptx)</div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  if (!isPptConverting) setIsPptImportModalOpen(false)
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="section-note">
                Convierte presentaciones PowerPoint a diapositivas en alta resolución (1080p/4K) extrayendo notas del orador para el monitor de escenario y analizando fidelidad (animaciones, transiciones, fuentes).
              </p>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Ruta completa del archivo .pptx *</label>
                <input
                  type="text"
                  placeholder="ej. C:\Sermones\Mensaje_Domingo.pptx"
                  value={importPptPath}
                  disabled={isPptConverting}
                  onChange={(e) => setImportPptPath(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Motor de Conversión:</label>
                <select
                  value={preferredPptConverter}
                  disabled={isPptConverting}
                  onChange={(e) => setPreferredPptConverter(e.target.value as any)}
                  className="bible-select"
                >
                  {pptConverters.map((c) => (
                    <option key={c.type} value={c.type}>
                      {c.name} {c.isAvailable ? '(Disponible)' : '(No instalado)'}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  {pptConverters.find((c) => c.type === preferredPptConverter)?.description}
                </div>
              </div>

              {isPptConverting && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#38bdf8' }}>
                    <span>{pptConvertStep || 'Procesando presentación...'}</span>
                  </div>
                  <div className="progress-bar-box">
                    <div className="progress-bar-fill" style={{ width: '80%' }} />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {isPptConverting ? (
                <button
                  className="secondary-action-btn"
                  onClick={async () => {
                    if (pptJobId) {
                      await window.churchPresenterApi.cancelPowerPointJob(pptJobId)
                    }
                    setIsPptConverting(false)
                  }}
                >
                  Cancelar Conversión
                </button>
              ) : (
                <>
                  <button className="secondary-action-btn" onClick={() => setIsPptImportModalOpen(false)}>
                    Cancelar
                  </button>
                  <button
                    className="primary-action-btn"
                    onClick={async () => {
                      if (!importPptPath.trim()) {
                        alert('Por favor ingrese la ruta del archivo PowerPoint')
                        return
                      }
                      try {
                        const jobId = `ppt_job_${Date.now()}`
                        setPptJobId(jobId)
                        setIsPptConverting(true)
                        setPptConvertStep('Iniciando conversión de diapositivas...')
                        const manifest = await window.churchPresenterApi.importPowerPoint(importPptPath.trim())
                        setPptManifests((prev) => ({
                          ...prev,
                          [manifest.hash]: manifest,
                          [manifest.originalPath]: manifest
                        }))

                        // Add to current service if active
                        if (currentService) {
                          const pptItem: ServiceItem = {
                            id: `ppt_item_${Date.now()}`,
                            type: 'powerpoint',
                            name: manifest.originalName.replace(/\.pptx?$/i, ''),
                            powerpointConfig: {
                              originalPath: manifest.originalPath,
                              hash: manifest.hash
                            }
                          }
                          const updatedService: ServicePlan = {
                            ...currentService,
                            items: [...currentService.items, pptItem],
                            updatedAt: new Date().toISOString()
                          }
                          const saved = await window.churchPresenterApi.saveService(updatedService)
                          setCurrentService(saved)
                          setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
                        }

                        alert(`PowerPoint importado con éxito: ${manifest.slideCount} diapositivas listas para proyectar.`)
                        setIsPptImportModalOpen(false)
                        setImportPptPath('')
                      } catch (err: any) {
                        alert(`Error al importar PowerPoint: ${err.message}`)
                      } finally {
                        setIsPptConverting(false)
                        setPptConvertStep('')
                      }
                    }}
                  >
                    Importar y Convertir
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          FFMPEG CONVERSION MODAL (Requirement A.5)
          ========================================================= */}
      {isFfmpegModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-title">Conversión de Video con FFmpeg</div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  if (!isConvertingFfmpeg) setIsFfmpegModalOpen(false)
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p className="section-note">
                Convierte contenedores y códecs incompatibles (MKV, AVI, MOV, HEVC, WMV) a MP4 estándar (H.264 / AAC) con aceleración rápida, garantizando reproducción fluida y libre de saltos en las 3 salidas de video.
              </p>

              {ffmpegStatus.available ? (
                <div style={{ marginTop: 10, padding: 8, background: '#064e3b', borderRadius: 4, fontSize: 12, color: '#a7f3d0' }}>
                  ✓ FFmpeg detectado en el sistema: <code>{ffmpegStatus.version || ffmpegStatus.path}</code>
                </div>
              ) : (
                <div style={{ marginTop: 10, padding: 8, background: '#7f1d1d', borderRadius: 4, fontSize: 12, color: '#fecaca' }}>
                  ⚠ FFmpeg no está instalado en el sistema.
                  <br />
                  Para habilitar la conversión automática, instálelo abriendo PowerShell como Administrador:
                  <div style={{ margin: '6px 0', padding: 4, background: '#450a0a', borderRadius: 3, fontFamily: 'monospace' }}>
                    winget install Gyan.FFmpeg
                  </div>
                  o descargue los binarios desde ffmpeg.org y agréguelos al PATH de Windows.
                </div>
              )}

              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Archivo de Video a convertir *</label>
                <input
                  type="text"
                  placeholder="ej. C:\Videos\incompatible.mkv"
                  value={ffmpegInputPath}
                  disabled={isConvertingFfmpeg}
                  onChange={(e) => setFfmpegInputPath(e.target.value)}
                />
              </div>

              {isConvertingFfmpeg && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>Convirtiendo a MP4 (H.264/AAC)...</span>
                    <span>{ffmpegProgress}%</span>
                  </div>
                  <div className="progress-bar-box">
                    <div className="progress-bar-fill" style={{ width: `${ffmpegProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {isConvertingFfmpeg ? (
                <button
                  className="secondary-action-btn"
                  onClick={async () => {
                    await window.churchPresenterApi.cancelFfmpegJob('current_ffmpeg_job')
                    setIsConvertingFfmpeg(false)
                    setFfmpegProgress(0)
                  }}
                >
                  Cancelar Conversión
                </button>
              ) : (
                <>
                  <button className="secondary-action-btn" onClick={() => setIsFfmpegModalOpen(false)}>
                    Cerrar
                  </button>
                  <button
                    className="primary-action-btn"
                    disabled={!ffmpegStatus.available}
                    onClick={async () => {
                      if (!ffmpegInputPath.trim()) {
                        alert('Ingrese la ruta del video a convertir')
                        return
                      }
                      try {
                        setIsConvertingFfmpeg(true)
                        setFfmpegProgress(10)
                        const outPath = ffmpegInputPath.trim().replace(/\.[^/.]+$/, '') + '_convertido.mp4'
                        const res = await window.churchPresenterApi.convertVideoFfmpeg(
                          'current_ffmpeg_job',
                          ffmpegInputPath.trim(),
                          outPath
                        )
                        setFfmpegProgress(100)
                        alert(`Conversión completada con éxito:\n${res.outputPath}`)
                        setIsFfmpegModalOpen(false)
                        setFfmpegInputPath('')
                        await window.churchPresenterApi.importMediaFile(res.outputPath, ['convertido'])
                        loadAllData()
                      } catch (err: any) {
                        alert(`Error en conversión: ${err.message}`)
                      } finally {
                        setIsConvertingFfmpeg(false)
                        setFfmpegProgress(0)
                      }
                    }}
                  >
                    Iniciar Conversión
                  </button>
                </>
              )}
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
