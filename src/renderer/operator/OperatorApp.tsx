import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  DisplayInfo,
  PresenterState,
  RoleAssignment,
  STANDARD_OUTPUT_ROLES,
  SlideItem,
  AppShortcutsConfig,
  DEFAULT_SHORTCUTS,
  ShortcutProfile,
  PanelNaming,
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
  BibleImportResult,
  MediaItem,
  RoleBibleConfigsMap,
  DEFAULT_ROLE_BIBLE_CONFIGS,
  PptConverterInfo,
  PptConverterType,
  PptPresentationManifest,
  FfmpegStatus,
  UserLibrary,
  PresentationTimer,
  FileChangedEvent,
  YouTubeItem,
  RemoteServerConfig,
  RemoteServerStatus,
  RemoteNetworkInterface,
  StageLayoutConfig,
  ChurchBrandingConfig,
  DEFAULT_CHURCH_BRANDING,
  TypeDefaultThemesMap
} from '../../shared/types'
import { toMediaUrl } from '../../shared/media-url'
import { TopMenuBar } from './components/TopMenuBar'
import { ProToolbar } from './components/ProToolbar'
import { LibraryPanel } from './components/LibraryPanel'
import { PlaylistPanel } from './components/PlaylistPanel'
import { SlideGridPanel } from './components/SlideGridPanel'
import { MediaDrawer } from './components/MediaDrawer'
import { RightSidePanel } from './components/RightSidePanel'
import { FileDropOverlay } from './components/FileDropOverlay'
import { FileWatcherToast } from './components/FileWatcherToast'
import { YouTubeBrowserPanel } from './components/YouTubeBrowserPanel'
import { YouTubeVerifyModal } from './components/YouTubeVerifyModal'
import { BibleBrowserPanel } from './components/BibleBrowserPanel'
import { ThemeManagerModal } from './components/ThemeManagerModal'
import { MessageModal } from './components/MessageModal'
import { StageLayoutEditorModal } from './components/StageLayoutEditorModal'
import { SessionRecoveryModal } from './components/SessionRecoveryModal'
import { ChecklistModal } from './components/ChecklistModal'
import { DiagnosticsModal } from './components/DiagnosticsModal'
import { OutputHealthModal } from './components/OutputHealthModal'
import { RehearsalSummaryModal } from './components/RehearsalSummaryModal'
import { MacroEditorModal } from './components/MacroEditorModal'
import { PropEditorModal } from './components/PropEditorModal'
import { BroadcastStudioPanel } from './components/BroadcastStudioPanel'
import { BroadcastSettingsModal } from './components/BroadcastSettingsModal'
import { ObsBridgeModal } from './components/ObsBridgeModal'
import { SongImportModal } from './components/SongImportModal'
import { SongUsageReportModal } from './components/SongUsageReportModal'
import { LibrarySyncModal } from './components/LibrarySyncModal'
import { LiveSubtitlesModal } from './components/LiveSubtitlesModal'
import { AiAssistantModal } from './components/AiAssistantModal'
import { SecondaryBackupModal } from './components/SecondaryBackupModal'
import { CameraSettingsSection } from './components/CameraSettingsSection'
import { SessionSnapshot, RehearsalSummary, SystemMetrics, MacroItem, PropItem, LoopStatus, BroadcastStatus } from '../../shared/types'
import { ErrorBoundary } from './components/ErrorBoundary'
import { formatDisplayTitle, matchDisplayByStableId } from '../../shared/display-utils'
import {
  parseLyricsToGroups,
  buildSlidesFromSong,
  splitGroupContentIntoSlides
} from '../../shared/song-parser'
import { searchItems } from '../../shared/search-utils'
import { createServiceFromTemplate } from '../../shared/service-utils'
import { parseBibleReference } from '../../shared/bible-reference-parser'
import {
  Monitor,
  FolderOpen,
  X,
  AlertCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Sliders,
  Copy,
  ArrowUp,
  ArrowDown,
  Undo,
  Redo,
  Sparkles,
  Upload,
  BookOpen,
  Star,
  CheckCircle,
  Volume2,
  Film,
  ChevronRight,
  ChevronLeft,
  Settings,
  Wifi,
  Camera,
  Radio,
  Keyboard,
  Database,
  HardDrive,
  Cpu,
  Image as ImageIcon
} from 'lucide-react'
import './operator.css'

export const OperatorApp: React.FC = () => {
  // Screens & Assignments
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [assignments, setAssignments] = useState<RoleAssignment>({})
  const [state, setState] = useState<PresenterState | null>(null)
  const [shortcuts, setShortcuts] = useState<AppShortcutsConfig>(DEFAULT_SHORTCUTS)
  const [appVersion, setAppVersion] = useState<string>('1.0.0')

  // Panel naming configuration (Requirement 1: ProPresenter names by default, Spanish option in Settings)
  const [panelNaming, setPanelNaming] = useState<PanelNaming>(() => {
    return (localStorage.getItem('cp_panel_naming') as PanelNaming) || 'spanish'
  })

  const panelLabels = useMemo(() => {
    return panelNaming === 'spanish'
      ? { library: 'Biblioteca', playlist: 'Playlist', media: 'Medios', audience: 'Audiencia', stage: 'Escenario', lobby: 'Vestíbulo' }
      : { library: 'Library', playlist: 'Playlist', media: 'Media', audience: 'Audiencia', stage: 'Escenario', lobby: 'Vestíbulo' }
  }, [panelNaming])

  // Layout persistence & dimensions (Requirements 1, 2 & 5)
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem('cp_layout_left_width')
    return saved ? parseInt(saved, 10) || 280 : 280
  })
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem('cp_layout_right_width')
    return saved ? parseInt(saved, 10) || 340 : 340
  })
  const [libHeight, setLibHeight] = useState<number>(() => {
    const saved = localStorage.getItem('cp_layout_lib_height')
    const parsed = saved ? parseInt(saved, 10) : 0
    if (!parsed || parsed > 380 || parsed < 260) return 340
    return parsed
  })
  const [mediaDrawerHeight, setMediaDrawerHeight] = useState<number>(() => {
    const saved = localStorage.getItem('cp_layout_media_drawer_height')
    return saved ? parseInt(saved, 10) || 220 : 220
  })
  const [previewHeight, setPreviewHeight] = useState<number>(() => {
    const saved = localStorage.getItem('cp_layout_preview_height')
    return saved ? parseInt(saved, 10) || 260 : 260
  })
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('cp_layout_left_collapsed') === 'true'
  })
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('cp_layout_right_collapsed') === 'true'
  })

  // Appearance theme colors (Requirement 6)
  const [accentPrimary, setAccentPrimary] = useState<string>(() => {
    return localStorage.getItem('cp_theme_accent_primary') || '#FF7A00'
  })
  const [accentLive, setAccentLive] = useState<string>(() => {
    return localStorage.getItem('cp_theme_accent_live') || '#22C55E'
  })
  const [accentPreview, setAccentPreview] = useState<string>(() => {
    return localStorage.getItem('cp_theme_accent_preview') || '#2D9CFF'
  })
  const [accentDanger, setAccentDanger] = useState<string>(() => {
    return localStorage.getItem('cp_theme_accent_danger') || '#EF4444'
  })

  // Apply theme CSS variables to :root
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent-primary', accentPrimary)
    root.style.setProperty('--accent-live', accentLive)
    root.style.setProperty('--accent-preview', accentPreview)
    root.style.setProperty('--accent-danger', accentDanger)
    localStorage.setItem('cp_theme_accent_primary', accentPrimary)
    localStorage.setItem('cp_theme_accent_live', accentLive)
    localStorage.setItem('cp_theme_accent_preview', accentPreview)
    localStorage.setItem('cp_theme_accent_danger', accentDanger)
  }, [accentPrimary, accentLive, accentPreview, accentDanger])

  // Save layout state to localStorage
  useEffect(() => {
    localStorage.setItem('cp_layout_left_width', leftWidth.toString())
    localStorage.setItem('cp_layout_right_width', rightWidth.toString())
    localStorage.setItem('cp_layout_lib_height', libHeight.toString())
    localStorage.setItem('cp_layout_media_drawer_height', mediaDrawerHeight.toString())
    localStorage.setItem('cp_layout_preview_height', previewHeight.toString())
    localStorage.setItem('cp_layout_left_collapsed', isLeftCollapsed ? 'true' : 'false')
    localStorage.setItem('cp_layout_right_collapsed', isRightCollapsed ? 'true' : 'false')
  }, [leftWidth, rightWidth, libHeight, mediaDrawerHeight, previewHeight, isLeftCollapsed, isRightCollapsed])

  // Reset layout handler (Ver -> Restablecer diseño)
  const handleResetLayout = useCallback(() => {
    setLeftWidth(280)
    setRightWidth(340)
    setLibHeight(340)
    setMediaDrawerHeight(220)
    setPreviewHeight(260)
    setIsLeftCollapsed(false)
    setIsRightCollapsed(false)
  }, [])

  // Draggable divider handlers
  const handleMouseDownV1 = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = leftWidth
    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      const maxW = Math.max(300, Math.round(window.innerWidth * 0.4))
      const newW = Math.min(Math.max(200, startW + delta), maxW)
      setLeftWidth(newW)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [leftWidth])

  const handleMouseDownV2 = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightWidth
    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const maxW = Math.max(400, Math.round(window.innerWidth * 0.5))
      const newW = Math.min(Math.max(260, startW + delta), maxW)
      setRightWidth(newW)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [rightWidth])

  const handleMouseDownH1 = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = libHeight
    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY
      const newH = Math.min(Math.max(120, startH + delta), 800)
      setLibHeight(newH)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [libHeight])

  const handleMouseDownH2 = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = mediaDrawerHeight
    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      const maxH = Math.max(300, Math.round(window.innerHeight * 0.6))
      const newH = Math.min(Math.max(120, startH + delta), maxH)
      setMediaDrawerHeight(newH)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [mediaDrawerHeight])

  const handleMouseDownH3 = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = previewHeight
    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY
      const maxH = Math.max(350, Math.round(window.innerHeight * 0.65))
      const newH = Math.min(Math.max(160, startH + delta), maxH)
      setPreviewHeight(newH)
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [previewHeight])

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
  const [currentLoadedBibleRef, setCurrentLoadedBibleRef] = useState<string>('Juan 3:16')
  const [bibleFavorites, setBibleFavorites] = useState<string[]>([])
  const [bibleRecentHistory, setBibleRecentHistory] = useState<string[]>([])
  const [bibleDirectSlides, setBibleDirectSlides] = useState<SlideItem[]>([])
  const [typeDefaults, setTypeDefaults] = useState<Partial<TypeDefaultThemesMap>>({})
  const [currentBibleThemeId, setCurrentBibleThemeId] = useState<string>('')

  // Active Service & Current Selection
  const [currentService, setCurrentService] = useState<ServicePlan | null>(null)
  const [selectedServiceItemIndex, setSelectedServiceItemIndex] = useState<number>(0)
  const [selectedArrangementId, setSelectedArrangementId] = useState<string | undefined>(undefined)

  // Slides & Live Projection
  const [previewSlideIndex, setPreviewSlideIndex] = useState<number>(0)
  const [liveSlideId, setLiveSlideId] = useState<string | null>(null)
  const [liveSourceId, setLiveSourceId] = useState<string | null>(null)
  const [isLiveDirty, setIsLiveDirty] = useState<boolean>(false)

  // Search & Library Import
  const [searchQuery, setSearchQuery] = useState<string>('')
  const libraryFileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Phase 5A: Media Library State
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [isMediaImportModalOpen, setIsMediaImportModalOpen] = useState<boolean>(false)
  const [importMediaFilePath, setImportMediaFilePath] = useState<string>('')
  const [importMediaTags, setImportMediaTags] = useState<string>('')
  const [isImportingPpt, setIsImportingPpt] = useState<boolean>(false)

  // Role Bible Configs (Doble traducción por rol de salida)
  const [roleBibleConfigs, setRoleBibleConfigs] = useState<RoleBibleConfigsMap>({ ...DEFAULT_ROLE_BIBLE_CONFIGS })
  const [audioOutputRole, setAudioOutputRole] = useState<string>('main')

  // Church Branding (Logo & Background)
  const [_churchBranding, setChurchBranding] = useState<ChurchBrandingConfig>(DEFAULT_CHURCH_BRANDING)
  const [tempChurchBranding, setTempChurchBranding] = useState<ChurchBrandingConfig>(DEFAULT_CHURCH_BRANDING)
  const [brandingStatusMsg, setBrandingStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // ProPresenter 7 Workspace States
  const [userLibraries, setUserLibraries] = useState<UserLibrary[]>([])
  const [activeUserLibraryId, setActiveUserLibraryId] = useState<string>(() => {
    return localStorage.getItem('cp_layout_active_library_id') || 'lib_songs'
  })
  const [presentationTimers, setPresentationTimers] = useState<PresentationTimer[]>([])
  const [slideZoom, setSlideZoom] = useState<number>(() => {
    const saved = localStorage.getItem('cp_slide_zoom')
    return saved ? Number(saved) : 40
  })
  const [slideViewMode, setSlideViewMode] = useState<'grid' | 'list'>(() => {
    const s = localStorage.getItem('cp_layout_slide_view_mode')
    return s === 'list' ? 'list' : 'grid'
  })
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState<boolean>(() => {
    return localStorage.getItem('cp_layout_media_drawer_open') === 'true'
  })
  const [isDraggingFiles, setIsDraggingFiles] = useState<boolean>(false)
  const [fileWatcherEvent, setFileWatcherEvent] = useState<FileChangedEvent | null>(null)
  const [activeToolbarMode, setActiveToolbarMode] = useState<'show' | 'edit' | 'bible' | 'youtube' | 'more' | 'broadcast'>(() => {
    const s = localStorage.getItem('cp_layout_active_mode')
    if (s && ['show', 'edit', 'bible', 'youtube', 'more', 'broadcast'].includes(s)) {
      return s as any
    }
    return 'show'
  })
  const [youtubeItems, setYoutubeItems] = useState<YouTubeItem[]>([])
  const [isYouTubeVerifyOpen, setIsYouTubeVerifyOpen] = useState<boolean>(false)
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState<boolean>(false)
  const [isBroadcastSettingsOpen, setIsBroadcastSettingsOpen] = useState<boolean>(false)
  const [isObsBridgeOpen, setIsObsBridgeOpen] = useState<boolean>(false)
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastStatus | null>(null)

  // Save layout & view preferences
  useEffect(() => {
    localStorage.setItem('cp_layout_active_library_id', activeUserLibraryId)
    localStorage.setItem('cp_layout_slide_view_mode', slideViewMode)
    localStorage.setItem('cp_layout_media_drawer_open', isMediaDrawerOpen.toString())
    localStorage.setItem('cp_layout_active_mode', activeToolbarMode)
  }, [activeUserLibraryId, slideViewMode, isMediaDrawerOpen, activeToolbarMode])

  // Phase 9: Broadcast Engine Telemetry Listener
  useEffect(() => {
    const unsub = window.churchPresenterApi.onBroadcastStatusChanged?.((st) => {
      setBroadcastStatus(st)
    })
    window.churchPresenterApi.getBroadcastStatus?.().then((st) => {
      if (st) setBroadcastStatus(st)
    }).catch(() => {})
    return () => {
      if (unsub) unsub()
    }
  }, [])

  // Save slide zoom preference
  useEffect(() => {
    localStorage.setItem('cp_slide_zoom', String(slideZoom))
  }, [slideZoom])

  // Dynamic Font Registration for Operator Workspace
  useEffect(() => {
    const updateFontStyles = (fonts: any[]) => {
      let styleTag = document.getElementById('cp-injected-fonts') as HTMLStyleElement | null
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = 'cp-injected-fonts'
        document.head.appendChild(styleTag)
      }
      const cssRules = (fonts || [])
        .map(
          (f) => `
        @font-face {
          font-family: '${f.name}';
          src: url('${f.url}') format('${f.format}');
          font-weight: normal;
          font-style: normal;
        }
      `
        )
        .join('\n')
      styleTag.textContent = cssRules
    }

    if (window.churchPresenterApi?.getCustomFonts) {
      window.churchPresenterApi.getCustomFonts().then(updateFontStyles).catch(() => {})
    }
    if (window.churchPresenterApi?.onFontsChanged) {
      const unsubFonts = window.churchPresenterApi.onFontsChanged(updateFontStyles)
      return () => unsubFonts()
    }
    return undefined
  }, [])

  // PDF Page Navigation State
  const [pdfPageCount, setPdfPageCount] = useState<number>(1)

  // Dev Environment State (Requirement A.6)
  const [isDev, setIsDev] = useState<boolean>(false)
  const [userDataPath, setUserDataPath] = useState<string>('')

  // Audio Output Devices (Requirement A.2)
  const [audioDevices, setAudioDevices] = useState<{ deviceId: string; label: string }[]>([])
  const [audioDeviceVideo, setAudioDeviceVideo] = useState<string>(localStorage.getItem('cp_audio_device_video') || '')
  const [audioDeviceAmbient, setAudioDeviceAmbient] = useState<string>(localStorage.getItem('cp_audio_device_ambient') || '')

  // Media Library Search & Tags (Requirement A.3)
  const [isFolderImportModalOpen, setIsFolderImportModalOpen] = useState<boolean>(false)
  const [importFolderPath, setImportFolderPath] = useState<string>('')

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
  const [settingsCategory, setSettingsCategory] = useState<string>('general')

  const SETTINGS_CATEGORIES = [
    {
      id: 'general',
      label: 'General',
      subtitle: 'Identidad, Nombres de Paneles',
      icon: Settings
    },
    {
      id: 'displays',
      label: 'Pantallas',
      subtitle: 'Monitores, Diseño de Pantalla de Escenario',
      icon: Monitor
    },
    {
      id: 'audio',
      label: 'Audio',
      subtitle: 'Salida y Dispositivos de Audio',
      icon: Volume2
    },
    {
      id: 'remote',
      label: 'Red y Remoto',
      subtitle: 'Control Remoto desde Celular y Tablet',
      icon: Wifi
    },
    {
      id: 'cameras',
      label: 'Cámaras',
      subtitle: 'Teléfonos PWA, WebRTC y Cloudflare',
      icon: Camera
    },
    {
      id: 'broadcast',
      label: 'Transmisión',
      subtitle: 'Estudio RTMP, OBS y Grabación',
      icon: Radio
    },
    {
      id: 'bibles',
      label: 'Biblias',
      subtitle: 'Traducciones Bíblicas y Versiones, Doble Traducción por Pantalla',
      icon: BookOpen
    },
    {
      id: 'keyboard',
      label: 'Teclado',
      subtitle: 'Atajos de Teclado y Perfiles',
      icon: Keyboard
    },
    {
      id: 'data',
      label: 'Datos y Respaldo',
      subtitle: 'Workspace, Copias de Seguridad, Datos de Demostración',
      icon: Database
    },
    {
      id: 'appearance',
      label: 'Apariencia',
      subtitle: 'Apariencia y Paleta ProPresenter',
      icon: Sliders
    },
    {
      id: 'advanced',
      label: 'Avanzado',
      subtitle: 'YouTube, Diagnóstico, Entorno',
      icon: Cpu
    }
  ]
  const [isDisplaysModalOpen, setIsDisplaysModalOpen] = useState<boolean>(false)
  const [isSongEditorOpen, setIsSongEditorOpen] = useState<boolean>(false)
  const [isPresentationEditorOpen, setIsPresentationEditorOpen] = useState<boolean>(false)
  const [isThemesModalOpen, setIsThemesModalOpen] = useState<boolean>(false)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState<boolean>(false)
  const [isStageLayoutModalOpen, setIsStageLayoutModalOpen] = useState<boolean>(false)
  const [remoteConfig, setRemoteConfig] = useState<RemoteServerConfig | null>(null)
  const [remoteStatus, setRemoteStatus] = useState<RemoteServerStatus | null>(null)
  const [networkInterfaces, setNetworkInterfaces] = useState<RemoteNetworkInterface[]>([])
  const [assignedStageLayout, setAssignedStageLayout] = useState<StageLayoutConfig | null>(null)
  const [isBackgroundsModalOpen, setIsBackgroundsModalOpen] = useState<boolean>(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState<boolean>(false)
  const [isBibleImportModalOpen, setIsBibleImportModalOpen] = useState<boolean>(false)
  const [isBibleManagerModalOpen, setIsBibleManagerModalOpen] = useState<boolean>(false)
  const [showFirstLaunchModal, setShowFirstLaunchModal] = useState<boolean>(false)

  // Phase 7: Stability, Recovery, Checklist, Diagnostics & Rehearsal States
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState<boolean>(false)
  const [recoverySnapshot, setRecoverySnapshot] = useState<SessionSnapshot | null>(null)
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false)
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState<boolean>(false)
  const [isOutputHealthModalOpen, setIsOutputHealthModalOpen] = useState<boolean>(false)
  const [isRehearsalSummaryModalOpen, setIsRehearsalSummaryModalOpen] = useState<boolean>(false)
  const [rehearsalSummary, setRehearsalSummary] = useState<RehearsalSummary | null>(null)
  const [isRehearsalActive, setIsRehearsalActive] = useState<boolean>(false)
  const [isEmergencyActive, setIsEmergencyActive] = useState<boolean>(false)
  const [isSafeMode, setIsSafeMode] = useState<boolean>(false)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)

  // Phase 8: Automation, Macros, Props, Loops & Transitions
  const [macros, setMacros] = useState<MacroItem[]>([])
  const [propsList, setPropsList] = useState<PropItem[]>([])
  const [isMacroEditorOpen, setIsMacroEditorOpen] = useState<boolean>(false)
  const [editingMacro, setEditingMacro] = useState<MacroItem | null>(null)
  const [isPropEditorOpen, setIsPropEditorOpen] = useState<boolean>(false)
  const [editingProp, setEditingProp] = useState<PropItem | null>(null)
  const [loopStatus, setLoopStatus] = useState<LoopStatus | null>(null)

  // Phase 10: Extras Modals
  const [isSongImportModalOpen, setIsSongImportModalOpen] = useState<boolean>(false)
  const [isSongUsageModalOpen, setIsSongUsageModalOpen] = useState<boolean>(false)
  const [isLibrarySyncModalOpen, setIsLibrarySyncModalOpen] = useState<boolean>(false)
  const [isLiveSubtitlesModalOpen, setIsLiveSubtitlesModalOpen] = useState<boolean>(false)
  const [isAiAssistantModalOpen, setIsAiAssistantModalOpen] = useState<boolean>(false)
  const [isSecondaryBackupModalOpen, setIsSecondaryBackupModalOpen] = useState<boolean>(false)
  const [newPlaylistModal, setNewPlaylistModal] = useState<{
    isOpen: boolean
    mode: 'create' | 'template' | 'from_template'
    title: string
    initialValue: string
    templateToUse?: ServicePlan
  }>({
    isOpen: false,
    mode: 'create',
    title: 'Crear Nueva Playlist de Culto',
    initialValue: ''
  })

  // Check if any modal is currently visible on screen
  const isAnyModalOpen = Boolean(
    isDisplaysModalOpen ||
    isSettingsOpen ||
    newPlaylistModal.isOpen ||
    isSongEditorOpen ||
    isPresentationEditorOpen ||
    isThemesModalOpen ||
    isBackgroundsModalOpen ||
    isTemplateModalOpen ||
    isBibleImportModalOpen ||
    isBibleManagerModalOpen ||
    isYouTubeVerifyOpen ||
    isShortcutsHelpOpen ||
    isFolderImportModalOpen ||
    isMediaImportModalOpen ||
    isFfmpegModalOpen ||
    isPptImportModalOpen ||
    showFirstLaunchModal ||
    isRecoveryModalOpen ||
    isChecklistModalOpen ||
    isDiagnosticsModalOpen ||
    isOutputHealthModalOpen ||
    isRehearsalSummaryModalOpen ||
    isMacroEditorOpen ||
    isPropEditorOpen ||
    isSongImportModalOpen ||
    isSongUsageModalOpen ||
    isLibrarySyncModalOpen ||
    isLiveSubtitlesModalOpen ||
    isAiAssistantModalOpen ||
    isSecondaryBackupModalOpen
  )

  // Prevent native WebContentsView (YouTube) from covering modal overlays or staying visible on other tabs
  useEffect(() => {
    if (activeToolbarMode === 'youtube') {
      window.churchPresenterApi?.setYouTubeBrowserVisible?.(!isAnyModalOpen)
    } else {
      window.churchPresenterApi?.setYouTubeBrowserVisible?.(false)
    }
  }, [isAnyModalOpen, activeToolbarMode])

  // Bible Import Form State
  const [importFormat, setImportFormat] = useState<'zefania' | 'osis' | 'usfm' | 'json' | 'sqlite'>('json')
  const [importFilePath, setImportFilePath] = useState<string>('')
  const [importFileName, setImportFileName] = useState<string>('')
  const [importName, setImportName] = useState<string>('')
  const [importAbbrev, setImportAbbrev] = useState<string>('')
  const [importLang, setImportLang] = useState<string>('es')
  const [importCopyright, setImportCopyright] = useState<string>('Dominio Público')
  const [importRawContent, setImportRawContent] = useState<string>('')
  const [importConsent, setImportConsent] = useState<boolean>(false)
  const [isImportingBible, setIsImportingBible] = useState<boolean>(false)
  const [importValidationSummary, setImportValidationSummary] = useState<BibleImportResult | null>(null)
  const [importBibleError, setImportBibleError] = useState<string | null>(null)
  const [isDraggingBibleFile, setIsDraggingBibleFile] = useState<boolean>(false)

  const resetBibleImportForm = () => {
    setImportFormat('json')
    setImportFilePath('')
    setImportFileName('')
    setImportName('')
    setImportAbbrev('')
    setImportLang('es')
    setImportCopyright('Dominio Público')
    setImportRawContent('')
    setImportConsent(false)
    setIsImportingBible(false)
    setImportValidationSummary(null)
    setImportBibleError(null)
    setIsDraggingBibleFile(false)
  }

  // Editing Song / Presentation State
  const [editingSong, setEditingSong] = useState<Song | null>(null)
  const [editingSongLyricsRaw, setEditingSongLyricsRaw] = useState<string>('')
  const [songGroupsHistory, setSongGroupsHistory] = useState<SongGroup[][]>([])
  const [songHistoryIndex, setSongHistoryIndex] = useState<number>(-1)

  const [editingPresentation, setEditingPresentation] = useState<GenericPresentation | null>(null)
  const [tempShortcuts, setTempShortcuts] = useState<AppShortcutsConfig>(DEFAULT_SHORTCUTS)
  const [toasts, setToasts] = useState<AppNotification[]>([])
  const [workspacePath, setWorkspacePath] = useState<string>('')

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
        rbConfigs,
        brandingRes,
        typeDefs
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
        window.churchPresenterApi.getRoleBibleConfigs(),
        window.churchPresenterApi.getChurchBranding?.(),
        window.churchPresenterApi.getTypeDefaultThemes?.()
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
      if (typeDefs) {
        setTypeDefaults(typeDefs)
        if (typeDefs.bible) setCurrentBibleThemeId(typeDefs.bible)
      }
      setServices(servList)
      setTemplates(tempList)
      setBackgroundImages(bgList)
      setBibleTranslations(bTranslations)
      setBibleFavorites(bFavs)
      setBibleRecentHistory(bRecents)
      setMediaItems(mediaList)
      if (rbConfigs) setRoleBibleConfigs(rbConfigs)
      if (brandingRes) {
        setChurchBranding(brandingRes)
        setTempChurchBranding(brandingRes)
      }

      try {
        const wsInfo = await window.churchPresenterApi.getWorkspaceInfo?.()
        if (wsInfo?.rootPath) {
          setWorkspacePath(wsInfo.rootPath)
        }
      } catch {
        // ignore
      }

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

      if (window.churchPresenterApi.getYouTubeItems) {
        try {
          const yts = await window.churchPresenterApi.getYouTubeItems()
          setYoutubeItems(yts || [])
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

      if (window.churchPresenterApi.getMacros) {
        try {
          const m = await window.churchPresenterApi.getMacros()
          setMacros(m || [])
        } catch {
          // ignore
        }
      }

      if (window.churchPresenterApi.getProps) {
        try {
          const p = await window.churchPresenterApi.getProps()
          setPropsList(p || [])
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
      if (newState.roleBibleConfigs) {
        setRoleBibleConfigs(newState.roleBibleConfigs)
      }
      if (newState.churchBranding) {
        setChurchBranding(newState.churchBranding)
        setTempChurchBranding(newState.churchBranding)
      }
    })

    const unsubNotif = window.churchPresenterApi.onNotification((notif) => {
      setToasts((prev) => {
        if (prev.some((t) => t.id === notif.id || (t.title === notif.title && t.message === notif.message))) {
          return prev
        }
        return [...prev.slice(-3), notif]
      })
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notif.id))
      }, 4500)
    })

    const unsubYtErr = window.churchPresenterApi.onYouTubeError?.((err) => {
      const notifId = `yt_err_${err.videoId || err.code}`
      setToasts((prev) => {
        // Prevent duplicate toasts if an identical error or one for this video is already displayed
        const isDuplicate = prev.some(
          (t) =>
            t.type === 'error' &&
            (t.id === notifId ||
              t.title.includes(err.code) ||
              (err.videoId && t.message.includes(err.videoId)) ||
              t.title.includes('YouTube [Error'))
        )
        if (isDuplicate) return prev

        const errNotif = {
          id: notifId,
          type: 'error' as const,
          title: `YouTube [Error ${err.code}]`,
          message: `${err.message}. La salida de proyección mantiene el fondo seguro.`,
          timestamp: Date.now()
        }
        return [...prev.slice(-3), errNotif]
      })

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== notifId))
      }, 7000)
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

    // Phase 7: Initial Checks (Session Recovery, Safe Mode, Emergency & Rehearsal)
    if (window.churchPresenterApi?.checkSessionRecovery) {
      window.churchPresenterApi.checkSessionRecovery().then((res) => {
        if (res && res.hasPendingRecovery && res.snapshot) {
          setRecoverySnapshot(res.snapshot)
          setIsRecoveryModalOpen(true)
        }
      }).catch(() => {})
    }

    if (window.churchPresenterApi?.isSafeModeActive) {
      window.churchPresenterApi.isSafeModeActive().then(setIsSafeMode).catch(() => {})
    }

    if (window.churchPresenterApi?.isEmergencyModeActive) {
      window.churchPresenterApi.isEmergencyModeActive().then(setIsEmergencyActive).catch(() => {})
    }

    if (window.churchPresenterApi?.getRehearsalStatus) {
      window.churchPresenterApi.getRehearsalStatus().then((st) => {
        if (st) setIsRehearsalActive(st.active)
      }).catch(() => {})
    }

    let unsubRehearsal: () => void = () => {}
    if (window.churchPresenterApi?.onRehearsalModeChanged) {
      unsubRehearsal = window.churchPresenterApi.onRehearsalModeChanged(setIsRehearsalActive)
    }

    let unsubMetrics: () => void = () => {}
    if (window.churchPresenterApi?.onSystemMetricsTick) {
      unsubMetrics = window.churchPresenterApi.onSystemMetricsTick(setSystemMetrics)
    }

    let unsubMacros: () => void = () => {}
    if (window.churchPresenterApi?.onMacroStatusChanged) {
      unsubMacros = window.churchPresenterApi.onMacroStatusChanged(() => {
        window.churchPresenterApi.getMacros?.().then(setMacros).catch(() => {})
      })
    }

    let unsubProps: () => void = () => {}
    if (window.churchPresenterApi?.onPropsActiveChanged) {
      unsubProps = window.churchPresenterApi.onPropsActiveChanged((activeList: any[]) => {
        setPropsList((prev) =>
          prev.map((p) => ({
            ...p,
            isActive: activeList.some((ap) => ap.id === p.id)
          }))
        )
      })
    }

    let unsubLoop: () => void = () => {}
    if (window.churchPresenterApi?.onLoopStatusChanged) {
      unsubLoop = window.churchPresenterApi.onLoopStatusChanged((status: any) => {
        setLoopStatus(status)
      })
    }

    return () => {
      unsubDisplays()
      unsubState()
      unsubNotif()
      unsubYtErr?.()
      unsubTimers()
      unsubFileWatcher()
      unsubRehearsal()
      unsubMetrics()
      unsubMacros()
      unsubProps()
      unsubLoop()
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

  const handleToggleBibleFavorite = async (reference: string) => {
    if (window.churchPresenterApi?.toggleBibleFavorite) {
      try {
        const updated = await window.churchPresenterApi.toggleBibleFavorite(reference)
        setBibleFavorites(updated || [])
      } catch (err) {
        console.error('Error toggling Bible favorite:', err)
      }
    }
  }

  const handleAddBibleToService = async (item: ServiceItem) => {
    if (currentService) {
      const updated: ServicePlan = {
        ...currentService,
        items: [...currentService.items, item],
        updatedAt: new Date().toISOString()
      }
      setCurrentService(updated)
      await window.churchPresenterApi.saveService(updated)
      setSelectedServiceItemIndex(updated.items.length - 1)
    }
  }

  // Generated slides for the currently selected item in Zone 3
  const activeSlides: SlideItem[] = useMemo(() => {
    // If operator is on Bible tab and has searched/loaded a passage directly, prioritize Bible slides
    if (activeToolbarMode === 'bible' && bibleDirectSlides.length > 0) {
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
      return []
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

    if (currentServiceItem.type === 'video' || currentServiceItem.type === 'media') {
      const mItem = mediaItems.find(
        (m) =>
          m.id === currentServiceItem.mediaId ||
          m.originalName === currentServiceItem.name ||
          m.filePath === currentServiceItem.notes
      )
      const vPath = mItem?.filePath || currentServiceItem.notes || ''
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
            ? `${mItem.container || 'MP4'} (${mItem.codec || 'Video'}) • ${(mItem.fileSize / (1024 * 1024)).toFixed(1)} MB`
            : 'Clip de Video',
          subtitle: 'Clip de Video',
          mediaUrl: vPath,
          thumbnailUrl: mItem?.thumbnailPath,
          mediaType: 'video'
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
        fitMode: 'contain'
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
    activeToolbarMode,
    bibleDirectSlides,
    currentServiceItem,
    currentSong,
    selectedArrangementId,
    currentPresentation,
    mediaItems,
    pdfPageCount,
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
      const isVideoItem =
        slide.sourceType === 'video' ||
        slide.mediaType === 'video' ||
        currentServiceItem?.type === 'video' ||
        (currentServiceItem?.type === 'media' &&
          mediaItems.find((m) => m.id === currentServiceItem.mediaId)?.mediaType === 'video')

      if (isVideoItem) {
        const mItem = mediaItems.find(
          (m) =>
            m.id === currentServiceItem?.mediaId ||
            m.filePath === slide.mediaUrl ||
            m.originalName === currentServiceItem?.name ||
            m.originalName === slide.title
        )
        const videoPath = mItem?.filePath || slide.mediaUrl
        if (videoPath) {
          window.churchPresenterApi.playVideo({
            mediaId: mItem?.id || slide.id,
            mediaPath: videoPath,
            loop: false,
            volume: 1.0,
            endAction: 'freeze',
            audioOutputRole: audioOutputRole || 'main'
          })
        }
      } else {
        // Automatically stop any playing video or YouTube when presenting Bible, songs, or text slides!
        window.churchPresenterApi?.controlVideo?.('stop')
        window.churchPresenterApi?.controlYouTube?.('stop')
      }

      // For Bible scripture slides, ensure themeId is set if not already present
      const effectiveSlide = { ...slide }
      if (effectiveSlide.sourceType === 'scripture' && !effectiveSlide.themeId) {
        effectiveSlide.themeId = currentBibleThemeId || typeDefaults.bible
      }
      const effectiveNext = nextSlide ? { ...nextSlide } : undefined
      if (effectiveNext && effectiveNext.sourceType === 'scripture' && !effectiveNext.themeId) {
        effectiveNext.themeId = currentBibleThemeId || typeDefaults.bible
      }

      window.churchPresenterApi.sendSlide(effectiveSlide, ['main', 'lobby', 'stage'], effectiveNext)
      setLiveSlideId(effectiveSlide.id)
      setLiveSourceId(effectiveSlide.sourceId)
      setIsLiveDirty(false)

      // Phase 8: Trigger Macro on Slide Enter
      if (effectiveSlide.macroTrigger?.onEnterMacroId) {
        window.churchPresenterApi.runMacro?.(effectiveSlide.macroTrigger.onEnterMacroId).catch(() => {})
      }
    },
    [currentServiceItem, mediaItems, audioOutputRole, currentBibleThemeId, typeDefaults.bible]
  )

  const handleSelectBibleTheme = useCallback(
    async (themeId: string) => {
      try {
        await window.churchPresenterApi.setTypeDefaultTheme('bible', themeId)
        const updatedDefs = await window.churchPresenterApi.getTypeDefaultThemes()
        if (updatedDefs) setTypeDefaults(updatedDefs)
        setCurrentBibleThemeId(themeId)

        // If a scripture slide is currently live, re-project it with the updated theme
        if (liveSlideId && (liveSlideId.startsWith('bible_') || activeToolbarMode === 'bible')) {
          const targetSlide = bibleDirectSlides.find((s) => s.id === liveSlideId)
          if (targetSlide) {
            handleGoLive({ ...targetSlide, themeId })
          }
        }
      } catch (err) {
        console.error('Error selecting Bible theme:', err)
      }
    },
    [liveSlideId, activeToolbarMode, bibleDirectSlides, handleGoLive]
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
      handleGoLive(activeSlides[nextIdx], activeSlides[nextIdx + 1])
    } else if (activeSlides.length > 0) {
      // Al terminar la canción: vuelve automáticamente al inicio la vista en miniatura principal (índice 0)
      // esperando por si se quiere reproducir/proyectar de nuevo, pero sin reproducirse automáticamente
      setPreviewSlideIndex(0)
    }
  }, [previewSlideIndex, activeSlides, handleGoLive])

  // Return to previous slide in live mode
  const handlePrevSlide = useCallback(() => {
    if (previewSlideIndex > 0) {
      const prevIdx = previewSlideIndex - 1
      setPreviewSlideIndex(prevIdx)
      handleGoLive(activeSlides[prevIdx], activeSlides[prevIdx + 1])
    } else if (activeSlides.length > 0) {
      const lastIdx = activeSlides.length - 1
      setPreviewSlideIndex(lastIdx)
      handleGoLive(activeSlides[lastIdx], undefined)
    }
  }, [previewSlideIndex, activeSlides, handleGoLive])

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

  const handleClearLayer = useCallback(
    (layer: 'audio' | 'background' | 'slide' | 'message' | 'media' | 'all' | 'props') => {
      if (layer === 'all') {
        window.churchPresenterApi.toggleGlobalControl('clear')
      } else if (layer === 'background') {
        window.churchPresenterApi.sendSlide({
          id: 'slide_clear_bg',
          title: '',
          body: '',
          subtitle: '',
          background: { type: 'color', value: '#000000' }
        })
      } else if (layer === 'slide') {
        window.churchPresenterApi.toggleGlobalControl('clear')
      } else if (layer === 'audio') {
        window.churchPresenterApi.controlIndependentAudio('stop')
      } else if (layer === 'media') {
        window.churchPresenterApi.controlVideo('stop')
      } else if (layer === 'props') {
        window.churchPresenterApi.getActiveProps?.().then((activeProps) => {
          activeProps.forEach((p) => window.churchPresenterApi.toggleProp(p.id, false))
        })
      } else if (layer === 'message') {
        window.churchPresenterApi.setOutputMessage('stage', '', false)
        window.churchPresenterApi.setOutputMessage('main', '', false)
        window.churchPresenterApi.setOutputMessage('lobby', '', false)
      }
    },
    []
  )

  // Phase 8: Macro & Prop Handlers
  const handleRunMacro = useCallback(async (id: string) => {
    try {
      const res = await window.churchPresenterApi.runMacro(id)
      if (!res.success) {
        setToasts((prev) => [...prev, { id: `err_${Date.now()}`, type: 'error', title: 'Error en Macro', message: res.error || 'Error desconocido', timestamp: Date.now() }])
      }
    } catch (err: any) {
      setToasts((prev) => [...prev, { id: `err_${Date.now()}`, type: 'error', title: 'Fallo al Ejecutar Macro', message: err?.message || String(err), timestamp: Date.now() }])
    }
  }, [])

  const handleRunMacroStep = useCallback(async (id: string, stepIdx: number) => {
    try {
      const res = await window.churchPresenterApi.runMacroStep(id, stepIdx)
      if (!res.success) {
        setToasts((prev) => [...prev, { id: `err_${Date.now()}`, type: 'error', title: 'Error en Paso de Macro', message: res.error || 'Error desconocido', timestamp: Date.now() }])
      }
    } catch (err: any) {
      setToasts((prev) => [...prev, { id: `err_${Date.now()}`, type: 'error', title: 'Fallo en Paso', message: err?.message || String(err), timestamp: Date.now() }])
    }
  }, [])

  const handleStopAllMacros = useCallback(async () => {
    await window.churchPresenterApi.stopAllMacros()
    setToasts((prev) => [...prev, { id: `stop_${Date.now()}`, type: 'info', title: 'Macros Detenidas', message: 'Se detuvieron todas las ejecuciones de macros', timestamp: Date.now() }])
  }, [])

  const handleSaveMacro = useCallback(async (macro: MacroItem) => {
    await window.churchPresenterApi.saveMacro(macro)
    const updated = await window.churchPresenterApi.getMacros()
    setMacros(updated || [])
    setIsMacroEditorOpen(false)
  }, [])

  const handleDeleteMacro = useCallback(async (id: string) => {
    await window.churchPresenterApi.deleteMacro(id)
    const updated = await window.churchPresenterApi.getMacros()
    setMacros(updated || [])
  }, [])

  const handleDuplicateMacro = useCallback(async (id: string) => {
    await window.churchPresenterApi.duplicateMacro(id)
    const updated = await window.churchPresenterApi.getMacros()
    setMacros(updated || [])
  }, [])

  const handleToggleProp = useCallback(async (id: string, active?: boolean) => {
    await window.churchPresenterApi.toggleProp(id, active)
    const updated = await window.churchPresenterApi.getProps()
    setPropsList(updated || [])
  }, [])

  const handleSaveProp = useCallback(async (prop: PropItem) => {
    await window.churchPresenterApi.saveProp(prop)
    const updated = await window.churchPresenterApi.getProps()
    setPropsList(updated || [])
    setIsPropEditorOpen(false)
  }, [])

  const handleDeleteProp = useCallback(async (id: string) => {
    await window.churchPresenterApi.deleteProp(id)
    const updated = await window.churchPresenterApi.getProps()
    setPropsList(updated || [])
  }, [])

  const handleClearProps = useCallback(async () => {
    const active = propsList.filter((p) => p.isActive)
    for (const p of active) {
      await window.churchPresenterApi.toggleProp(p.id, false)
    }
    const updated = await window.churchPresenterApi.getProps()
    setPropsList(updated || [])
  }, [propsList])

  // Global Keyboard Shortcuts (Strict: Window Focus Only)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Phase 8: Check Macro Shortcuts first
      for (const m of macros) {
        if (m.shortcut && m.shortcut.trim()) {
          const combo = `${e.ctrlKey ? 'CTRL+' : ''}${e.shiftKey ? 'SHIFT+' : ''}${e.altKey ? 'ALT+' : ''}${e.key.toUpperCase()}`
          if (combo === m.shortcut.trim().toUpperCase()) {
            e.preventDefault()
            window.churchPresenterApi.runMacro(m.id).catch(() => {})
            return
          }
        }
      }

      const key = e.key.toUpperCase()

      // Modifiers
      if (e.ctrlKey || e.metaKey) {
        if (key === 'Y') {
          e.preventDefault()
          setActiveToolbarMode('youtube')
          return
        }
        if (key === 'M') {
          e.preventDefault()
          setIsMediaDrawerOpen((prev) => !prev)
          return
        }
        if (key === 'F') {
          e.preventDefault()
          const searchInput = document.querySelector('.pro-search-input') as HTMLInputElement | null
          searchInput?.focus()
          return
        }
        if (e.key === ',' || e.key === '<') {
          e.preventDefault()
          setIsSettingsOpen(true)
          return
        }
      }

      if (e.altKey) {
        return
      }

      // Action mappings from shortcuts configuration:
      if (key === (shortcuts.black || 'F1').toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('black')
        return
      } else if (
        key === (shortcuts.clearAll || shortcuts.clear || 'F2').toUpperCase()
      ) {
        e.preventDefault()
        handleClearLayer('all')
        return
      } else if (key === (shortcuts.logo || 'F3').toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('logo')
        return
      } else if (key === (shortcuts.freeze || 'F4').toUpperCase()) {
        e.preventDefault()
        window.churchPresenterApi.toggleGlobalControl('freeze')
        return
      } else if (key === (shortcuts.clearAudio || 'F5').toUpperCase()) {
        e.preventDefault()
        handleClearLayer('audio')
        return
      } else if (key === (shortcuts.clearBackground || 'F6').toUpperCase()) {
        e.preventDefault()
        handleClearLayer('background')
        return
      } else if (key === (shortcuts.clearSlide || 'F7').toUpperCase()) {
        e.preventDefault()
        handleClearLayer('slide')
        return
      } else if (key === (shortcuts.clearMessage || 'F8').toUpperCase()) {
        e.preventDefault()
        handleClearLayer('message')
        return
      } else if (key === (shortcuts.clearMedia || 'F9').toUpperCase()) {
        e.preventDefault()
        handleClearLayer('media')
        return
      }

      // Live Slides Navigation (Next/Prev slide)
      const nextSlideKey = (shortcuts.nextSlide || 'ArrowRight').toUpperCase()
      const prevSlideKey = (shortcuts.prevSlide || 'ArrowLeft').toUpperCase()

      if (
        key === nextSlideKey ||
        key === ' ' ||
        key === 'ARROWRIGHT' ||
        (nextSlideKey === 'ARROWRIGHT' && e.key === 'ArrowRight')
      ) {
        e.preventDefault()
        handleNextSlide()
        return
      } else if (
        key === prevSlideKey ||
        key === 'ARROWLEFT' ||
        (prevSlideKey === 'ARROWLEFT' && e.key === 'ArrowLeft')
      ) {
        e.preventDefault()
        handlePrevSlide()
        return
      }

      // Playlist Item Navigation
      const nextItemKey = (shortcuts.nextPlaylistItem || 'ArrowDown').toUpperCase()
      const prevItemKey = (shortcuts.prevPlaylistItem || 'ArrowUp').toUpperCase()

      if (
        key === nextItemKey ||
        key === 'PAGEDOWN' ||
        key === 'N' ||
        (nextItemKey === 'ARROWDOWN' && e.key === 'ArrowDown')
      ) {
        e.preventDefault()
        handleNextPlaylistItem()
        return
      } else if (
        key === prevItemKey ||
        key === 'PAGEUP' ||
        key === 'P' ||
        (prevItemKey === 'ARROWUP' && e.key === 'ArrowUp')
      ) {
        e.preventDefault()
        handlePrevPlaylistItem()
        return
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
      sendPreviewToLive,
      handleClearLayer
    ]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Phase 6: Remote Control Action Listener
  useEffect(() => {
    if (window.churchPresenterApi?.onRemoteActionDispatch) {
      const unsub = window.churchPresenterApi.onRemoteActionDispatch((action) => {
        if (action.type === 'next-slide') {
          handleNextSlide()
        } else if (action.type === 'prev-slide') {
          handlePrevSlide()
        } else if (action.type === 'select-slide') {
          const idx = typeof (action as any).index === 'number' ? (action as any).index : 0
          if (activeSlides[idx]) {
            setPreviewSlideIndex(idx)
            handleGoLive(activeSlides[idx], activeSlides[idx + 1])
          }
        } else if (action.type === 'next-item') {
          handleNextPlaylistItem()
        } else if (action.type === 'prev-item') {
          handlePrevPlaylistItem()
        } else if (action.type === 'select-item') {
          const idx = typeof (action as any).index === 'number' ? (action as any).index : 0
          if (currentService && currentService.items[idx]) {
            setSelectedServiceItemIndex(idx)
            setPreviewSlideIndex(0)
          }
        } else if (action.type === 'clear-layer') {
          handleClearLayer((action as any).layer)
        }
      })
      return () => unsub()
    }
    return undefined
  }, [handleNextSlide, handlePrevSlide, handleNextPlaylistItem, handlePrevPlaylistItem, handleClearLayer, activeSlides, handleGoLive, currentService])

  const loadRemoteSettings = useCallback(async () => {
    try {
      if (window.churchPresenterApi?.getRemoteConfig) {
        const [cfg, status, ifaces, stage] = await Promise.all([
          window.churchPresenterApi.getRemoteConfig(),
          window.churchPresenterApi.getRemoteStatus(),
          window.churchPresenterApi.getNetworkInterfaces(),
          window.churchPresenterApi.getAssignedStageLayout()
        ])
        setRemoteConfig(cfg)
        setRemoteStatus(status)
        setNetworkInterfaces(ifaces || [])
        setAssignedStageLayout(stage)
      }
    } catch (err) {
      console.error('Error loading remote settings:', err)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      if (window.churchPresenterApi?.getRemoteStatus) {
        try {
          const st = await window.churchPresenterApi.getRemoteStatus()
          if (mounted) setRemoteStatus(st)
        } catch {
          // ignore
        }
      }
    }
    poll()
    const timer = setInterval(poll, 4000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (isSettingsOpen) {
      loadRemoteSettings()
      window.churchPresenterApi.getChurchBranding?.().then((cb) => {
        if (cb) {
          setChurchBranding(cb)
          setTempChurchBranding(cb)
        }
      })
    }
  }, [isSettingsOpen, loadRemoteSettings])

  const handleToggleRemoteEnabled = async (enabled: boolean) => {
    if (!remoteConfig) return
    const updated = await window.churchPresenterApi.saveRemoteConfig({ enabled })
    setRemoteConfig(updated)
    const status = await window.churchPresenterApi.getRemoteStatus()
    setRemoteStatus(status)
  }

  const handleRegeneratePin = async () => {
    const newPin = await window.churchPresenterApi.regenerateRemotePin()
    if (remoteConfig) setRemoteConfig({ ...remoteConfig, pin: newPin })
    const status = await window.churchPresenterApi.getRemoteStatus()
    setRemoteStatus(status)
  }

  const handleRegenerateRemoteOperatorPin = async () => {
    if (!window.churchPresenterApi?.regenerateRemoteOperatorPin) return
    const newPin = await window.churchPresenterApi.regenerateRemoteOperatorPin()
    if (remoteConfig) setRemoteConfig({ ...remoteConfig, remoteOperatorPin: newPin })
    const status = await window.churchPresenterApi.getRemoteStatus()
    setRemoteStatus(status)
  }

  const handleKickClient = async (clientId: string) => {
    await window.churchPresenterApi.kickRemoteClient(clientId)
    const status = await window.churchPresenterApi.getRemoteStatus()
    setRemoteStatus(status)
  }

  const handleUploadLogo = async () => {
    try {
      const res = await window.churchPresenterApi.uploadChurchLogo?.()
      if (res && res.success && res.filePath) {
        const updated: ChurchBrandingConfig = {
          ...tempChurchBranding,
          logoUrl: res.filePath
        }
        setTempChurchBranding(updated)
        setChurchBranding(updated)
        await window.churchPresenterApi.saveChurchBranding?.(updated)
        setBrandingStatusMsg({ text: 'Logo de la iglesia cargado y aplicado a todas las pantallas.', type: 'success' })
      }
    } catch (err: any) {
      setBrandingStatusMsg({ text: err.message || 'Error al cargar logo', type: 'error' })
    }
  }

  const handleRemoveLogo = async () => {
    const updated: ChurchBrandingConfig = {
      ...tempChurchBranding,
      logoUrl: ''
    }
    setTempChurchBranding(updated)
    setChurchBranding(updated)
    await window.churchPresenterApi.saveChurchBranding?.(updated)
    setBrandingStatusMsg({ text: 'Logo personalizado eliminado (usando icono de cruz por defecto).', type: 'success' })
  }

  const handleUploadBackgroundImage = async () => {
    try {
      const res = await window.churchPresenterApi.uploadChurchBackground?.()
      if (res && res.success && res.filePath) {
        const updated: ChurchBrandingConfig = {
          ...tempChurchBranding,
          defaultBackground: {
            type: 'image',
            value: res.filePath
          }
        }
        setTempChurchBranding(updated)
        setChurchBranding(updated)
        await window.churchPresenterApi.saveChurchBranding?.(updated)
        setBrandingStatusMsg({ text: 'Fondo de imagen cargado y aplicado a todas las pantallas.', type: 'success' })
      }
    } catch (err: any) {
      setBrandingStatusMsg({ text: err.message || 'Error al cargar imagen de fondo', type: 'error' })
    }
  }

  const handleUploadBackgroundVideo = async () => {
    try {
      const res = await window.churchPresenterApi.uploadChurchBackground?.()
      if (res && res.success && res.filePath) {
        const updated: ChurchBrandingConfig = {
          ...tempChurchBranding,
          defaultBackground: {
            type: 'video',
            value: res.filePath
          }
        }
        setTempChurchBranding(updated)
        setChurchBranding(updated)
        await window.churchPresenterApi.saveChurchBranding?.(updated)
        setBrandingStatusMsg({ text: 'Video de fondo en bucle cargado y aplicado a todas las pantallas.', type: 'success' })
      }
    } catch (err: any) {
      setBrandingStatusMsg({ text: err.message || 'Error al cargar video de fondo', type: 'error' })
    }
  }

  const handleApplyPresetGradient = async (gradientValue: string, name: string) => {
    const updated: ChurchBrandingConfig = {
      ...tempChurchBranding,
      defaultBackground: {
        type: 'gradient',
        value: gradientValue
      }
    }
    setTempChurchBranding(updated)
    setChurchBranding(updated)
    await window.churchPresenterApi.saveChurchBranding?.(updated)
    setBrandingStatusMsg({ text: `Degradado '${name}' aplicado como fondo.`, type: 'success' })
  }

  const handleApplySolidColor = async (colorHex: string) => {
    const updated: ChurchBrandingConfig = {
      ...tempChurchBranding,
      defaultBackground: {
        type: 'color',
        value: colorHex
      }
    }
    setTempChurchBranding(updated)
    setChurchBranding(updated)
    await window.churchPresenterApi.saveChurchBranding?.(updated)
    setBrandingStatusMsg({ text: `Color sólido '${colorHex}' aplicado como fondo.`, type: 'success' })
  }

  const handleSaveAllBranding = async () => {
    try {
      await window.churchPresenterApi.saveChurchBranding?.(tempChurchBranding)
      setChurchBranding(tempChurchBranding)
      setBrandingStatusMsg({ text: 'Identidad y configuración de la iglesia guardada exitosamente.', type: 'success' })
    } catch (err: any) {
      setBrandingStatusMsg({ text: err.message || 'Error al guardar identidad', type: 'error' })
    }
  }

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


  // Live Update for Currently Live Item
  const handleUpdateLiveProjection = () => {
    if (activeSlides.length > 0) {
      const idx = Math.min(previewSlideIndex, activeSlides.length - 1)
      handleGoLive(activeSlides[idx], activeSlides[idx + 1])
      setIsLiveDirty(false)
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

    let actualType = type
    let targetMediaId: string | undefined = undefined

    if (type === 'video' || type === 'media' || type === 'audio' || type === 'pdf' || type === 'image_presentation') {
      targetMediaId = id
      const m = mediaItems.find((x) => x.id === id)
      if (m?.mediaType === 'video') actualType = 'video'
      else if (m?.mediaType === 'audio') actualType = 'audio'
    }

    const newItem: ServiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: actualType,
      name,
      songId: type === 'song' ? id : undefined,
      presentationId: type === 'presentation' || type === 'powerpoint' ? id : undefined,
      scriptureRef: type === 'scripture' ? scriptureRef || name : undefined,
      bibleTranslation: type === 'scripture' ? primaryBibleAbbrev : undefined,
      mediaId: targetMediaId
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

  // Service Management
  const handleCreateNewService = () => {
    const defaultName = `Culto ${new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}`
    setNewPlaylistModal({
      isOpen: true,
      mode: 'create',
      title: 'Crear Nueva Playlist de Culto',
      initialValue: defaultName
    })
  }

  const handleSaveAsTemplate = () => {
    if (!currentService) return
    setNewPlaylistModal({
      isOpen: true,
      mode: 'template',
      title: 'Guardar como Plantilla de Servicio',
      initialValue: `${currentService.name} (Plantilla)`
    })
  }

  const handleCreateFromTemplate = (template: ServicePlan) => {
    setNewPlaylistModal({
      isOpen: true,
      mode: 'from_template',
      title: 'Nuevo Servicio desde Plantilla',
      initialValue: template.name.replace(' (Plantilla)', ''),
      templateToUse: template
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

  const handleDeleteMediaItem = async (mediaId: string, name?: string) => {
    if (!confirm(`¿Está seguro de eliminar definitivamente "${name || 'este archivo de medios'}"?\n\nEsta acción no se puede deshacer.`)) return
    try {
      await window.churchPresenterApi.deleteMediaItem(mediaId)
      setMediaItems((prev) => prev.filter((m) => m.id !== mediaId))
      setToasts((prev) => [
        ...prev,
        {
          id: `del_med_${Date.now()}`,
          type: 'info',
          title: 'Medio Eliminado',
          message: `Se ha eliminado "${name || 'el archivo de medios'}" de la biblioteca.`,
          timestamp: Date.now()
        }
      ])
    } catch (err: any) {
      alert(`Error al eliminar medio: ${err.message}`)
    }
  }

  const handleDeleteLibraryItem = async (type: string, id: string, title: string) => {
    if (type === 'video' || type === 'media' || type === 'audio' || type === 'image' || type === 'pdf') {
      await handleDeleteMediaItem(id, title)
    } else if (type === 'song') {
      await handleDeleteSong(id, title)
    } else if (type === 'youtube') {
      if (!confirm(`¿Eliminar definitivamente el video de YouTube "${title}" de la biblioteca?`)) return
      await window.churchPresenterApi.deleteYouTubeItem(id)
      setYoutubeItems((prev) => prev.filter((y) => y.id !== id))
    } else if (type === 'presentation' || type === 'powerpoint') {
      if (!confirm(`¿Eliminar definitivamente la presentación "${title}"?`)) return
      await window.churchPresenterApi.deletePresentation(id)
      setPresentations((prev) => prev.filter((p) => p.id !== id))
    }
  }

  // Library Export & Import
  const handleExportLibrary = async () => {
    const jsonStr = await window.churchPresenterApi.exportLibrary(false)
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

  // Bible Import Handlers
  const handleSelectBibleFile = (filePath: string) => {
    setImportFilePath(filePath)
    const base = filePath.split(/[/\\]/).pop() || ''
    setImportFileName(base)
    const ext = base.split('.').pop()?.toLowerCase() || ''
    if (ext === 'sqlite' || ext === 'db' || ext === 'bible') {
      setImportFormat('sqlite')
    } else if (ext === 'osis') {
      setImportFormat('osis')
    } else if (ext === 'usfm') {
      setImportFormat('usfm')
    } else if (ext === 'xml') {
      setImportFormat('zefania')
    } else if (ext === 'json') {
      setImportFormat('json')
    }
    const cleanBase = base.replace(/\.[^/.]+$/, '').trim()
    if (!importName) {
      if (/RVR1960/i.test(cleanBase)) {
        setImportName('Reina-Valera 1960')
      } else if (/RVA2015/i.test(cleanBase)) {
        setImportName('Reina Valera Actualizada 2015')
      } else {
        setImportName(cleanBase)
      }
    }
    if (!importAbbrev) {
      if (/RVR1960/i.test(cleanBase)) {
        setImportAbbrev('RVR60')
      } else if (/RVA2015/i.test(cleanBase)) {
        setImportAbbrev('RVA15')
      } else {
        setImportAbbrev(cleanBase.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase() || 'BIB')
      }
    }
    setImportBibleError(null)
  }

  const handlePickBibleFileNative = async () => {
    try {
      const res = await window.churchPresenterApi.openFileDialog({
        title: 'Seleccionar Archivo de Traducción Bíblica',
        filters: [
          {
            name: 'Traducciones Bíblicas (*.sqlite, *.db, *.bible, *.json, *.xml, *.osis, *.usfm, *.txt)',
            extensions: ['sqlite', 'db', 'bible', 'json', 'xml', 'osis', 'usfm', 'txt']
          }
        ]
      })
      if (res && res.length > 0) {
        handleSelectBibleFile(res[0])
      }
    } catch (err: any) {
      setImportBibleError(`Error al abrir selector de archivos: ${err.message}`)
    }
  }

  const handleBibleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingBibleFile(false)
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const filePath = window.churchPresenterApi?.getPathForFile?.(file) || (file as any).path
      if (filePath) {
        handleSelectBibleFile(filePath)
      } else {
        const reader = new FileReader()
        reader.onload = (evt) => {
          const content = String(evt.target?.result || '')
          setImportRawContent(content)
          setImportFileName(file.name)
          const cleanBase = file.name.replace(/\.[^/.]+$/, '').trim()
          if (!importName) setImportName(cleanBase)
          if (!importAbbrev) setImportAbbrev(cleanBase.substring(0, 8).toUpperCase())
        }
        reader.readAsText(file)
      }
    }
  }

  const handleExecuteBibleImport = async () => {
    if (!importConsent) {
      setImportBibleError('Debe marcar la casilla obligatoria de confirmación de derechos o licencia.')
      return
    }
    if (!importFilePath && !importRawContent.trim()) {
      setImportBibleError('Debe seleccionar un archivo (.sqlite, .db, .bible, .json, .xml, .osis, .usfm) o pegar el contenido.')
      return
    }

    setIsImportingBible(true)
    setImportBibleError(null)

    try {
      let res: BibleImportResult
      if (importFilePath) {
        res = await window.churchPresenterApi.importBibleFile(importFilePath, {
          name: importName.trim() || undefined,
          abbrev: importAbbrev.trim() || undefined,
          language: importLang.trim() || 'es',
          copyright: importCopyright.trim() || 'Dominio Público',
          isPublicDomain: true
        })
      } else {
        res = await window.churchPresenterApi.importBibleTranslation(
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
      }

      setImportValidationSummary(res)
      const updated = await window.churchPresenterApi.getBibleTranslations()
      setBibleTranslations(updated)
      if (res.translation && res.translation.abbrev) {
        setPrimaryBibleAbbrev(res.translation.abbrev)
      }
    } catch (err: any) {
      setImportBibleError(`Error al procesar e importar traducción bíblica: ${err.message}`)
    } finally {
      setIsImportingBible(false)
    }
  }

  const handleSetDefaultBible = async (abbrev: string) => {
    try {
      await window.churchPresenterApi.setBibleDefault(abbrev)
      const updated = await window.churchPresenterApi.getBibleTranslations()
      setBibleTranslations(updated)
      setPrimaryBibleAbbrev(abbrev)
    } catch (err: any) {
      alert(`Error al establecer traducción predeterminada: ${err.message}`)
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
      filters: [{ name: 'PowerPoint (*.pptx, *.ppt)', extensions: ['pptx', 'ppt', 'pptm', 'ppsx'] }]
    })
    if (result && result.length > 0) {
      const selectedPath = result[0]
      setIsImportingPpt(true)
      try {
        const manifest = await window.churchPresenterApi.importPowerPoint(selectedPath)
        await loadAllData()
        if (currentService) {
          const newItem: ServiceItem = {
            id: `item_p_${Date.now()}`,
            type: 'presentation',
            name: manifest.originalName || manifest.id,
            presentationId: manifest.id
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
      multiSelections: true
    })
    if (result && result.length > 0) {
      for (const p of result) {
        await window.churchPresenterApi.importMediaFile(p)
      }
      await loadAllData()
    }
  }

  const handleNativeImportFolder = async () => {
    const folderPath = await window.churchPresenterApi.openFolderDialog({
      title: 'Seleccionar Carpeta de Medios'
    })
    if (folderPath) {
      await window.churchPresenterApi.importImageFolder(folderPath)
      await loadAllData()
    }
  }

  const handleCreateUserLibrary = async (name: string) => {
    const now = new Date().toISOString()
    const newLib: UserLibrary = {
      id: `lib_custom_${Date.now()}`,
      name,
      isSpecial: false,
      sortOrder: userLibraries.length,
      createdAt: now,
      updatedAt: now
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

  const handleRenameUserLibrary = async (id: string, newName: string) => {
    await window.churchPresenterApi.renameLibrary(id, newName)
    const updated = await window.churchPresenterApi.getLibraries()
    setUserLibraries(updated || [])
  }

  const handleReorderUserLibraries = async (orderedIds: string[]) => {
    await window.churchPresenterApi.reorderLibraries(orderedIds)
    const updated = await window.churchPresenterApi.getLibraries()
    setUserLibraries(updated || [])
  }

  const handleMoveLibraryItem = async (itemRefId: string, targetLibraryId: string) => {
    await window.churchPresenterApi.moveLibraryItem(itemRefId, targetLibraryId)
    const updated = await window.churchPresenterApi.getLibraries()
    setUserLibraries(updated || [])
  }

  const handleRenameService = async (serviceId: string, newName: string) => {
    const serv = services.find((s) => s.id === serviceId)
    if (!serv) return
    const updated = { ...serv, name: newName, updatedAt: new Date().toISOString() }
    await window.churchPresenterApi.saveService(updated)
    const all = await window.churchPresenterApi.getServices()
    setServices(all)
    if (currentService?.id === serviceId) {
      setCurrentService(updated)
    }
  }

  const handleDuplicateService = async (serviceId: string) => {
    const dup = await window.churchPresenterApi.duplicateService(serviceId)
    const all = await window.churchPresenterApi.getServices()
    setServices(all)
    setCurrentService(dup)
    setSelectedServiceItemIndex(0)
  }

  const handleDeleteService = async (serviceId: string) => {
    await window.churchPresenterApi.deleteService(serviceId)
    const all = await window.churchPresenterApi.getServices()
    setServices(all)
    if (all.length > 0) {
      setCurrentService(all[0])
      setSelectedServiceItemIndex(0)
    }
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

  const handleMoveServiceSection = (headerIndex: number, direction: 'up' | 'down') => {
    if (!currentService) return
    const items = [...currentService.items]
    if (items[headerIndex]?.type !== 'header') return

    interface SectionGroup {
      headerIdx: number
      items: ServiceItem[]
    }
    const leadingItems: ServiceItem[] = []
    const sections: SectionGroup[] = []
    let currentGroup: SectionGroup | null = null

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.type === 'header') {
        if (currentGroup) sections.push(currentGroup)
        currentGroup = { headerIdx: i, items: [it] }
      } else {
        if (currentGroup) currentGroup.items.push(it)
        else leadingItems.push(it)
      }
    }
    if (currentGroup) sections.push(currentGroup)

    const secIdx = sections.findIndex((s) => s.headerIdx === headerIndex)
    if (secIdx === -1) return

    const targetSecIdx = direction === 'up' ? secIdx - 1 : secIdx + 1
    if (targetSecIdx < 0 || targetSecIdx >= sections.length) return

    const temp = sections[secIdx]
    sections[secIdx] = sections[targetSecIdx]
    sections[targetSecIdx] = temp

    const newItems: ServiceItem[] = [
      ...leadingItems,
      ...sections.flatMap((s) => s.items)
    ]

    const updatedService: ServicePlan = {
      ...currentService,
      items: newItems,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      const newHeaderIdx = newItems.findIndex((it) => it.id === items[headerIndex].id)
      if (newHeaderIdx !== -1) setSelectedServiceItemIndex(newHeaderIdx)
    })
  }

  const handleReorderSectionByDrag = (fromHeaderIdx: number, toHeaderIdx: number) => {
    if (!currentService || fromHeaderIdx === toHeaderIdx) return
    const items = [...currentService.items]
    if (items[fromHeaderIdx]?.type !== 'header' || items[toHeaderIdx]?.type !== 'header') return

    const leadingItems: ServiceItem[] = []
    const sections: { headerIdx: number; items: ServiceItem[] }[] = []
    let currentGroup: { headerIdx: number; items: ServiceItem[] } | null = null

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.type === 'header') {
        if (currentGroup) sections.push(currentGroup)
        currentGroup = { headerIdx: i, items: [it] }
      } else {
        if (currentGroup) currentGroup.items.push(it)
        else leadingItems.push(it)
      }
    }
    if (currentGroup) sections.push(currentGroup)

    const fromSecIdx = sections.findIndex((s) => s.headerIdx === fromHeaderIdx)
    const toSecIdx = sections.findIndex((s) => s.headerIdx === toHeaderIdx)
    if (fromSecIdx === -1 || toSecIdx === -1) return

    const [moved] = sections.splice(fromSecIdx, 1)
    sections.splice(toSecIdx, 0, moved)

    const newItems: ServiceItem[] = [
      ...leadingItems,
      ...sections.flatMap((s) => s.items)
    ]

    const updatedService: ServicePlan = {
      ...currentService,
      items: newItems,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      const newHeaderIdx = newItems.findIndex((it) => it.id === items[fromHeaderIdx].id)
      if (newHeaderIdx !== -1) setSelectedServiceItemIndex(newHeaderIdx)
    })
  }

  const handleDropItemToPlaylist = (data: any, targetIndex: number) => {
    if (!currentService || !data) return

    let actualType = data.type || 'media'
    let mediaId: string | undefined = undefined
    let songId: string | undefined = undefined
    let presentationId: string | undefined = undefined
    const name = data.name || 'Nuevo Elemento'

    if (
      data.source === 'media_drawer' ||
      actualType === 'video' ||
      actualType === 'audio' ||
      actualType === 'image' ||
      actualType === 'pdf'
    ) {
      mediaId = data.id
      const m = mediaItems.find((x) => x.id === data.id)
      if (m?.mediaType) {
        actualType = m.mediaType
      }
    } else if (actualType === 'song') {
      songId = data.id
    } else if (actualType === 'presentation' || actualType === 'powerpoint') {
      presentationId = data.id
    }

    const newItem: ServiceItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: actualType,
      name,
      songId,
      presentationId,
      mediaId,
      notes: data.filePath || undefined
    }

    const newItems = [...currentService.items]
    const clampedIndex = Math.max(0, Math.min(targetIndex, newItems.length))
    newItems.splice(clampedIndex, 0, newItem)

    const updatedService: ServicePlan = {
      ...currentService,
      items: newItems,
      updatedAt: new Date().toISOString()
    }

    window.churchPresenterApi.saveService(updatedService).then((saved) => {
      setCurrentService(saved)
      setServices((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
      setSelectedServiceItemIndex(clampedIndex)
      setToasts((prev) => [
        ...prev.slice(-3),
        {
          id: `added_${Date.now()}`,
          type: 'info',
          title: 'Elemento Agregado',
          message: `"${name}" se agregó a la sección.`,
          timestamp: Date.now()
        }
      ])
    })
  }

  const handleAddSlideToCurrent = () => {
    if (!currentSong) {
      handleAddBlankItem()
      return
    }
    const newGroup: SongGroup = {
      id: `group_${Date.now()}`,
      songId: currentSong.id,
      label: `Verso ${currentSong.groups.length + 1}`,
      groupType: 'verse',
      groupNumber: currentSong.groups.length + 1,
      content: 'Nueva letra...',
      sortOrder: currentSong.groups.length
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
          const manifest = await window.churchPresenterApi.importPowerPoint(nativePath)
          await loadAllData()
          if (currentService) {
            const newItem: ServiceItem = {
              id: `item_p_${Date.now()}_${i}`,
              type: 'presentation',
              name: manifest.originalName || file.name,
              presentationId: manifest.id
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

  const effectiveDisplayTheme = useMemo(() => {
    const itemThemeId = currentServiceItem?.themeId || currentSong?.themeId || currentPresentation?.themeId
    if (itemThemeId) {
      const found = themes.find((t) => t.id === itemThemeId)
      if (found) return found
    }
    return state?.currentTheme || DEFAULT_THEME
  }, [currentServiceItem?.themeId, currentSong?.themeId, currentPresentation?.themeId, themes, state?.currentTheme])

  const handleAssignThemeToCurrentElement = async (themeId: string) => {
    const chosenThemeId = themeId || undefined
    if (currentService && selectedServiceItemIndex >= 0 && currentService.items[selectedServiceItemIndex]) {
      const newItems = [...currentService.items]
      newItems[selectedServiceItemIndex] = {
        ...newItems[selectedServiceItemIndex],
        themeId: chosenThemeId
      }
      const updated = { ...currentService, items: newItems }
      setCurrentService(updated)
      await window.churchPresenterApi.saveService(updated)

      const isLiveItem = liveSourceId && (
        newItems[selectedServiceItemIndex].id === liveSourceId ||
        newItems[selectedServiceItemIndex].songId === liveSourceId ||
        newItems[selectedServiceItemIndex].presentationId === liveSourceId
      )
      if (isLiveItem) {
        setIsLiveDirty(true)
      }
      return
    }

    if (currentSong) {
      const updated = { ...currentSong, themeId: chosenThemeId }
      await window.churchPresenterApi.saveSong(updated)
      const allSongs = await window.churchPresenterApi.getSongs()
      setSongs(allSongs)
      if (liveSourceId === currentSong.id) {
        setIsLiveDirty(true)
      }
      return
    }

    if (currentPresentation) {
      const updated = { ...currentPresentation, themeId: chosenThemeId }
      await window.churchPresenterApi.savePresentation(updated)
      const allPres = await window.churchPresenterApi.getPresentations()
      setPresentations(allPres)
      if (liveSourceId === currentPresentation.id) {
        setIsLiveDirty(true)
      }
    }
  }

  const activeTheme = effectiveDisplayTheme

  // Phase 7: Stability Handlers (Session Recovery, Emergency, Rehearsal)
  const handleResumeSession = async () => {
    if (!recoverySnapshot) return
    try {
      await window.churchPresenterApi.dismissSessionRecovery()
      setIsRecoveryModalOpen(false)

      if (recoverySnapshot.activePlanId) {
        const foundPlan = services.find((s) => s.id === recoverySnapshot.activePlanId)
        if (foundPlan) {
          setCurrentService(foundPlan)
        }
      }

      if (typeof recoverySnapshot.activeItemIndex === 'number') {
        setSelectedServiceItemIndex(recoverySnapshot.activeItemIndex)
      }
      if (typeof recoverySnapshot.activeSlideIndex === 'number') {
        setPreviewSlideIndex(recoverySnapshot.activeSlideIndex)
      }

      setToasts((prev) => [
        ...prev,
        {
          id: `rec_success_${Date.now()}`,
          title: 'Sesión Anterior Recuperada',
          message: 'Tu área de trabajo y selección de diapositivas han sido restauradas. La proyección en vivo permanece segura.',
          type: 'success',
          timestamp: Date.now()
        }
      ])
    } catch (err) {
      console.error('Error resuming session:', err)
    }
  }

  const handleDismissSession = async () => {
    try {
      await window.churchPresenterApi.dismissSessionRecovery()
    } catch (err) {
      console.error('Error dismissing session recovery:', err)
    } finally {
      setIsRecoveryModalOpen(false)
      setRecoverySnapshot(null)
    }
  }

  const handleToggleEmergency = async () => {
    try {
      if (isEmergencyActive) {
        await window.churchPresenterApi.deactivateEmergencyMode()
        setIsEmergencyActive(false)
      } else {
        await window.churchPresenterApi.activateEmergencyMode()
        setIsEmergencyActive(true)
      }
    } catch (err) {
      console.error('Error toggling emergency mode:', err)
    }
  }

  const handleToggleRehearsal = async () => {
    try {
      if (isRehearsalActive) {
        await window.churchPresenterApi.setRehearsalMode(false)
        setIsRehearsalActive(false)
        const summary = await window.churchPresenterApi.getRehearsalSummary()
        if (summary) {
          setRehearsalSummary(summary)
          setIsRehearsalSummaryModalOpen(true)
        }
      } else {
        await window.churchPresenterApi.setRehearsalMode(true)
        setIsRehearsalActive(true)
        setToasts((prev) => [
          ...prev,
          {
            id: `rehearsal_${Date.now()}`,
            title: 'Modo Ensayo Iniciado',
            message: 'Las operaciones se registrarán en un archivo de auditoría dedicado.',
            type: 'info',
            timestamp: Date.now()
          }
        ])
      }
    } catch (err) {
      console.error('Error toggling rehearsal mode:', err)
    }
  }

  return (
    <div
      className="pro-operator-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file input for full library package import (.cpr, .json) */}
      <input
        type="file"
        ref={libraryFileInputRef}
        style={{ display: 'none' }}
        accept=".cpr,.json"
        onChange={handleImportLibrary}
      />

      {/* 1. ProPresenter Top Menu Bar */}
      <TopMenuBar
        onNewService={handleCreateNewService}
        onImportPpt={handleNativeImportPpt}
        onImportMedia={handleNativeImportMedia}
        onImportFolder={handleNativeImportFolder}
        onImportLibrary={() => libraryFileInputRef.current?.click()}
        onExportService={handleExportLibrary}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
        onResetLayout={handleResetLayout}
        onToggleLeftPanel={() => setIsLeftCollapsed((c) => !c)}
        onToggleRightPanel={() => setIsRightCollapsed((c) => !c)}
        onOpenFloatingPreview={() => window.churchPresenterApi.openFloatingPreview('main')}
        onOpenDisplaysModal={() => setIsDisplaysModalOpen(true)}
        onOpenThemeModal={() => setIsThemesModalOpen(true)}
        onOpenChecklistModal={() => setIsChecklistModalOpen(true)}
        onOpenOutputHealthModal={() => setIsOutputHealthModalOpen(true)}
        onOpenDiagnosticsModal={() => setIsDiagnosticsModalOpen(true)}
        onUndo={handleUndoSong}
        onRedo={handleRedoSong}
        onOpenSongImport={() => setIsSongImportModalOpen(true)}
        onOpenLibrarySync={() => setIsLibrarySyncModalOpen(true)}
        onOpenSongUsage={() => setIsSongUsageModalOpen(true)}
        onOpenSubtitles={() => setIsLiveSubtitlesModalOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantModalOpen(true)}
        onOpenSecondaryBackup={() => setIsSecondaryBackupModalOpen(true)}
      />

      {/* 2. ProPresenter Toolbar */}
      <ProToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeMode={activeToolbarMode}
        onModeChange={(m) => {
          setActiveToolbarMode(m)
        }}
        onAddTextSlide={handleAddBlankItem}
        onOpenThemeModal={() => setIsThemesModalOpen(true)}
        onOpenMessageModal={() => setIsMessageModalOpen(true)}
        onOpenChecklistModal={() => setIsChecklistModalOpen(true)}
        onOpenOutputHealthModal={() => setIsOutputHealthModalOpen(true)}
        isRehearsalActive={isRehearsalActive}
        onToggleRehearsal={handleToggleRehearsal}
        isEmergencyActive={isEmergencyActive}
        onToggleEmergency={handleToggleEmergency}
        systemMetrics={systemMetrics}
        broadcastStatus={broadcastStatus}
        state={state}
        displays={displays}
        assignments={assignments}
        shortcuts={shortcuts}
        panelLabels={panelLabels}
        isMediaDrawerOpen={isMediaDrawerOpen}
        onToggleMediaDrawer={() => setIsMediaDrawerOpen(!isMediaDrawerOpen)}
        onOpenDisplaysModal={() => setIsDisplaysModalOpen(true)}
        onOpenOutputPreviewOrSettings={(role) => {
          window.churchPresenterApi.openPreviewOutputWindow(role)
        }}
        remoteStatus={remoteStatus}
        onOpenRemoteSettings={() => setIsSettingsOpen(true)}
        loopStatus={loopStatus}
        onStopLoop={() => window.churchPresenterApi.stopPresentationLoop?.()}
      />

      {/* Phase 7: Safe Mode Diagnostic Warning Banner */}
      {isSafeMode && (
        <div
          style={{
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            borderBottom: '1px solid rgba(234, 179, 8, 0.35)',
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 600,
            color: '#fde047',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          <AlertTriangle size={15} color="#eab308" />
          <span>MODO SEGURO ACTIVO: YouTube, servidor remoto y vigilante de archivos desactivados para diagnóstico.</span>
        </div>
      )}

      {/* Phase 7: Emergency Mode Active Banner */}
      {isEmergencyActive && (
        <div
          style={{
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} />
            <span>MODO DE EMERGENCIA ACTIVO: Todas las pantallas de salida muestran fondo seguro y los medios están en pausa.</span>
          </div>
          <button
            type="button"
            onClick={handleToggleEmergency}
            style={{
              backgroundColor: '#ffffff',
              color: '#ef4444',
              border: 'none',
              padding: '4px 14px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Reanudar Salidas
          </button>
        </div>
      )}

      {/* 3. Main Workspace: 3 Columns Layout */}
      <div className="pro-main-columns-layout">
        {/* Left Column: Library Collections (Top) + Service Playlist (Bottom) */}
        {!isLeftCollapsed ? (
          <>
            <aside className="pro-left-column" style={{ width: `${leftWidth}px` }}>
              <ErrorBoundary panelName="Biblioteca y Playlist">
                <LibraryPanel
                libraries={userLibraries}
                activeLibraryId={activeUserLibraryId}
                onSelectLibrary={setActiveUserLibraryId}
                onCreateLibrary={handleCreateUserLibrary}
                onRenameLibrary={handleRenameUserLibrary}
                onReorderLibraries={handleReorderUserLibraries}
                onDeleteLibrary={handleDeleteUserLibrary}
                onMoveItem={handleMoveLibraryItem}
                songs={filteredSongs}
                presentations={filteredPresentations}
                mediaItems={mediaItems}
                youtubeItems={youtubeItems}
                panelLabels={panelLabels}
                height={libHeight}
                onItemSelect={(type, id) => {
                  if (type === 'song') {
                    const s = songs.find((x) => x.id === id)
                    if (s && currentService) {
                      const item: ServiceItem = {
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
                  } else if (type === 'youtube') {
                    const y = youtubeItems.find((x) => x.id === id)
                    if (y && currentService) {
                      const item: ServiceItem = {
                        id: `item_yt_${Date.now()}`,
                        type: 'youtube',
                        name: y.title,
                        youtubeConfig: {
                          youtubeId: y.youtubeId,
                          url: y.url,
                          title: y.title,
                          channelTitle: y.channelTitle,
                          thumbnailUrl: y.thumbnailUrl,
                          duration: y.duration,
                          inPoint: y.inPoint,
                          outPoint: y.outPoint,
                          targetRoles: y.targetRoles,
                          audioRole: y.audioRole,
                          endAction: y.endAction,
                          availabilityStatus: y.availabilityStatus
                        }
                      }
                      const updated = { ...currentService, items: [...currentService.items, item] }
                      setCurrentService(updated)
                      setSelectedServiceItemIndex(updated.items.length - 1)
                      window.churchPresenterApi.saveService(updated)
                    }
                  } else if (type === 'video' || type === 'media') {
                    const m = mediaItems.find((x) => x.id === id)
                    if (m && currentService) {
                      const item: ServiceItem = {
                        id: `item_v_${Date.now()}`,
                        type: m.mediaType === 'video' ? 'video' : 'media',
                        name: m.originalName,
                        mediaId: m.id
                      }
                      const updated = { ...currentService, items: [...currentService.items, item] }
                      setCurrentService(updated)
                      setSelectedServiceItemIndex(updated.items.length - 1)
                      window.churchPresenterApi.saveService(updated)
                    }
                  } else if (type === 'presentation' || type === 'powerpoint') {
                    const p = presentations.find((x) => x.id === id)
                    if (p && currentService) {
                      const item: ServiceItem = {
                        id: `item_p_${Date.now()}`,
                        type: type === 'powerpoint' ? 'powerpoint' : 'presentation',
                        name: p.title,
                        presentationId: p.id
                      }
                      const updated = { ...currentService, items: [...currentService.items, item] }
                      setCurrentService(updated)
                      setSelectedServiceItemIndex(updated.items.length - 1)
                      window.churchPresenterApi.saveService(updated)
                    }
                  }
                }}
                onAddItemToPlaylist={(type, id, name) => {
                  handleAddItemToService(type, id, name)
                }}
                onDeleteItem={handleDeleteLibraryItem}
              />

              {/* Horizontal Resizer H1: Library vs Playlist */}
              <div
                className="pro-resizer-horizontal"
                onMouseDown={handleMouseDownH1}
                onDoubleClick={() => setLibHeight(340)}
                title="Arrastrar para redimensionar biblioteca (Doble clic para restablecer)"
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
                onRenameService={handleRenameService}
                onDuplicateService={handleDuplicateService}
                onSaveAsTemplate={handleSaveAsTemplate}
                onDeleteService={handleDeleteService}
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
                onMoveSection={handleMoveServiceSection}
                onDropItemToPlaylist={handleDropItemToPlaylist}
                onReorderSectionByDrag={handleReorderSectionByDrag}
                onDeleteItem={handleDeletePlaylistItem}
                onDuplicateItem={handleDuplicatePlaylistItem}
                onAddHeader={(headerName, color) => {
                  if (currentService) {
                    const newHeader: ServiceItem = {
                      id: `header_${Date.now()}`,
                      type: 'header',
                      name: headerName,
                      notes: color || '#FF7A00'
                    }
                    const updated = { ...currentService, items: [...currentService.items, newHeader] }
                    setCurrentService(updated)
                    window.churchPresenterApi.saveService(updated)
                  }
                }}
                onRenameHeader={(idx, newTitle, newColor) => {
                  if (currentService && currentService.items[idx]) {
                    const newItems = [...currentService.items]
                    newItems[idx] = {
                      ...newItems[idx],
                      name: newTitle,
                      notes: newColor || newItems[idx].notes || '#FF7A00'
                    }
                    const updated = { ...currentService, items: newItems }
                    setCurrentService(updated)
                    window.churchPresenterApi.saveService(updated)
                  }
                }}
                onAddBlankItem={handleAddBlankItem}
                onVerifyPlaylist={() => setIsYouTubeVerifyOpen(true)}
                allThemes={themes}
                onAssignItemTheme={(idx, themeId) => {
                  if (currentService && currentService.items[idx]) {
                    const newItems = [...currentService.items]
                    newItems[idx] = {
                      ...newItems[idx],
                      themeId: themeId || undefined
                    }
                    const updated = { ...currentService, items: newItems }
                    setCurrentService(updated)
                    window.churchPresenterApi.saveService(updated)
                    if (selectedServiceItemIndex === idx && liveSourceId) {
                      setIsLiveDirty(true)
                    }
                  }
                }}
                onApplyThemeToScope={async (themeId, scope) => {
                  await window.churchPresenterApi.applyThemeToScope(themeId, scope, currentService?.id)
                  const [updatedServices, updatedSongs] = await Promise.all([
                    window.churchPresenterApi.getServices(),
                    window.churchPresenterApi.getSongs()
                  ])
                  setServices(updatedServices)
                  setSongs(updatedSongs)
                  if (currentService) {
                    const found = updatedServices.find((s) => s.id === currentService.id)
                    if (found) setCurrentService(found)
                  }
                }}
                panelLabels={panelLabels}
              />
            </ErrorBoundary>
          </aside>

            {/* Vertical Resizer V1: Left Column vs Center Column */}
            <div
              className="pro-resizer-vertical"
              onMouseDown={handleMouseDownV1}
              onDoubleClick={() => setLeftWidth(280)}
              title="Arrastrar para redimensionar panel izquierdo (Doble clic para restablecer)"
            />
          </>
        ) : (
          <div
            className="pro-collapsed-column-strip"
            onClick={() => setIsLeftCollapsed(false)}
            title="Mostrar panel izquierdo (Library / Playlist)"
          >
            <ChevronRight size={14} />
            <span className="pro-collapsed-strip-label">{panelLabels.library}</span>
          </div>
        )}

        {/* Center Column: Slide Thumbnails Grid & Bottom Media Drawer OR YouTube/Bible Panels */}
        <section className="pro-center-column">
          <ErrorBoundary panelName="Área Central">
            <div
              style={{
                display: activeToolbarMode === 'youtube' ? 'flex' : 'none',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                height: '100%'
              }}
            >
              <YouTubeBrowserPanel
                isVisible={activeToolbarMode === 'youtube' && !isAnyModalOpen}
                onAddToPlaylist={(item) => {
                  if (currentService) {
                    const updated = { ...currentService, items: [...currentService.items, item] }
                    setCurrentService(updated)
                    window.churchPresenterApi.saveService(updated)
                  }
                }}
                onProjectNow={async (item) => {
                  if (item.youtubeConfig) {
                    await window.churchPresenterApi.controlYouTube('prepare', item.youtubeConfig)
                    await window.churchPresenterApi.controlYouTube('go-live')
                    const slide: SlideItem = {
                      id: `yt_slide_${item.youtubeConfig.youtubeId}`,
                      sourceId: item.youtubeConfig.youtubeId,
                      sourceType: 'presentation',
                      slideIndex: 0,
                      totalSlidesInGroup: 1,
                      title: item.youtubeConfig.title,
                      body: `▶ YouTube: ${item.youtubeConfig.title}\nCanal: ${item.youtubeConfig.channelTitle || 'YouTube'}`,
                      mediaType: 'youtube',
                      mediaUrl: item.youtubeConfig.url,
                      youtubeId: item.youtubeConfig.youtubeId,
                      youtubeDuration: item.youtubeConfig.duration
                    }
                    await window.churchPresenterApi.sendSlide(slide, item.youtubeConfig.targetRoles)
                  }
                }}
              />
            </div>
            {activeToolbarMode === 'broadcast' ? (
              <BroadcastStudioPanel
                onOpenSettings={() => setIsBroadcastSettingsOpen(true)}
                onOpenObsBridge={() => setIsObsBridgeOpen(true)}
              />
            ) : activeToolbarMode === 'youtube' ? null : activeToolbarMode === 'bible' ? (
              <BibleBrowserPanel
                translations={bibleTranslations}
                primaryAbbrev={primaryBibleAbbrev}
                secondaryAbbrev={secondaryBibleAbbrev}
                isDualActive={isDualBibleActive}
                dualLayout={dualBibleLayout}
                favorites={bibleFavorites}
                recents={bibleRecentHistory}
                directSlides={bibleDirectSlides}
                currentReference={currentLoadedBibleRef}
                themes={themes}
                currentBibleThemeId={currentBibleThemeId || typeDefaults.bible}
                onSelectBibleTheme={handleSelectBibleTheme}
                onOpenThemeManager={() => setIsThemesModalOpen(true)}
                onLoadPassage={loadBiblePassage}
                onSelectPrimary={setPrimaryBibleAbbrev}
                onSelectSecondary={setSecondaryBibleAbbrev}
                onToggleDual={setIsDualBibleActive}
                onChangeDualLayout={setDualBibleLayout}
                onOpenBibleManager={() => setIsBibleManagerModalOpen(true)}
                onOpenBibleImport={() => setIsBibleImportModalOpen(true)}
                onGoLive={(slide, next) => handleGoLive(slide, next)}
                onAddToService={handleAddBibleToService}
                onToggleFavorite={handleToggleBibleFavorite}
              />
            ) : activeToolbarMode === 'edit' && !isSongEditorOpen && !isPresentationEditorOpen ? (
              <div
                className="pro-edit-mode-hub"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  padding: 32,
                  textAlign: 'center',
                  color: '#D1D5DB',
                  backgroundColor: '#121212'
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    color: '#3B82F6'
                  }}
                >
                  <Edit3 size={28} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px', color: '#FFFFFF' }}>
                  Modo Editor de Diapositivas
                </h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', maxWidth: 460, margin: '0 0 24px', lineHeight: 1.5 }}>
                  {currentSong
                    ? `Está seleccionado el himno "${currentSong.title}". Puede modificar su letra, estructura y arreglos musicales, o crear una nueva canción.`
                    : currentPresentation
                    ? `Está seleccionada la presentación "${currentPresentation.title}". Puede modificar sus avisos y diapositivas.`
                    : 'No hay ninguna canción o presentación seleccionada en este momento. Puede crear una nueva canción o volver a la vista de presentación.'}
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    type="button"
                    className="primary-action-btn"
                    onClick={() => {
                      if (currentSong) {
                        handleOpenSongEditor(currentSong)
                      } else if (currentPresentation) {
                        handleOpenPresentationEditor(currentPresentation)
                      } else {
                        handleOpenSongEditor()
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 18px',
                      fontSize: 13,
                      backgroundColor: '#2563EB',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    <Edit3 size={14} />
                    <span>
                      {currentSong
                        ? `Editar "${currentSong.title}"`
                        : currentPresentation
                        ? `Editar "${currentPresentation.title}"`
                        : 'Crear Nueva Canción'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="secondary-action-btn"
                    onClick={() => setActiveToolbarMode('show')}
                    style={{
                      padding: '8px 18px',
                      fontSize: 13,
                      backgroundColor: '#262626',
                      color: '#D1D5DB',
                      border: '1px solid #3A3A3A',
                      borderRadius: 6,
                      cursor: 'pointer'
                    }}
                  >
                    Volver a Mostrar
                  </button>
                </div>
              </div>
            ) : activeToolbarMode === 'more' ? (
              <div
                className="pro-more-mode-hub"
                style={{
                  padding: 28,
                  color: '#D1D5DB',
                  height: '100%',
                  overflowY: 'auto',
                  backgroundColor: '#121212'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <Sliders size={20} color="#3B82F6" />
                  <h2 style={{ fontSize: 18, margin: 0, color: '#FFFFFF', fontWeight: 600 }}>
                    Herramientas y Configuración
                  </h2>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                    gap: 14
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #2E2E2E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Preferencias Generales</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Idiomas de paneles, audio, respaldo y atajos</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDisplaysModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #2E2E2E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Pantallas y Salidas</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Asignar monitores físicos para Audiencia y Escenario</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsThemesModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #2E2E2E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Temas y Estilos</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Fuentes, colores, sombras y márgenes de proyección</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBibleManagerModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #2E2E2E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Biblias y Traducciones</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Gestionar versiones, establecer predeterminada</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetBibleImportForm()
                      setIsBibleImportModalOpen(true)
                    }}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #3B82F6',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#60A5FA' }}>Importar Traducción Bíblica</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>SQLite (.db/.sqlite/.bible), JSON genérico, XML o USFM</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsShortcutsHelpOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #2E2E2E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Atajos de Teclado (F1)</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Guía de teclas rápidas de operador</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveToolbarMode('broadcast')}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #FF7A00',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#FF7A00' }}>Estudio de Transmisión</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Previo/Programa, escenas, transiciones y audio mixer</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBroadcastSettingsOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #38BDF8',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#38BDF8' }}>Ajustes de Transmisión (RTMP/NVENC)</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Destinos de streaming, codificación por hardware y grabación local</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsObsBridgeOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #22c55e',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#22c55e' }}>Puente con OBS Studio</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Conexión obs-websocket v5 y fuentes de navegador transparentes</div>
                  </button>

                  {/* Verificación de Servicio Previo al Culto */}
                  <button
                    type="button"
                    onClick={() => setIsChecklistModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #22C55E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#22C55E' }}>Verificar Servicio (Checklist)</span>
                      <CheckCircle size={16} color="#22C55E" />
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Inspección previa de medios, pantallas, biblias y hardware</div>
                  </button>

                  {/* Modo Ensayo */}
                  <button
                    type="button"
                    onClick={handleToggleRehearsal}
                    style={{
                      background: isRehearsalActive ? 'rgba(249, 115, 22, 0.16)' : '#1A1A1A',
                      border: `1px solid ${isRehearsalActive ? '#F97316' : '#EAB308'}`,
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: isRehearsalActive ? '#F97316' : '#FACC15' }}>
                        Modo Ensayo {isRehearsalActive ? '(ACTIVO)' : ''}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          backgroundColor: isRehearsalActive ? '#F97316' : '#2A2A2A',
                          color: '#FFFFFF',
                          padding: '2px 8px',
                          borderRadius: 4
                        }}
                      >
                        {isRehearsalActive ? 'ENCENDIDO' : 'APAGADO'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {isRehearsalActive
                        ? 'Ensayo en curso: la salida real no se modifica. Clic para desactivar y ver resumen.'
                        : 'Practicar y cambiar diapositivas libremente sin proyectar en las salidas en vivo'}
                    </div>
                  </button>

                  {/* Phase 10: Extras Cards */}
                  <button
                    type="button"
                    onClick={() => setIsLibrarySyncModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #38BDF8',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#38BDF8' }}>Sincronización entre Computadoras</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Sincronizar canciones, listas, temas y macros por carpeta compartida o USB sin nube obligatoria</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSongImportModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #FF7A00',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#FF7A00' }}>Importar Canciones de Otros Programas</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Texto plano, ChordPro, CSV por lotes, OpenLyrics XML y ProPresenter 6 (.pro6)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSongUsageModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #22C55E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#22C55E' }}>Reporte de Uso de Canciones (CCLI)</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Registro de proyecciones en vivo, filtros de fecha y exportación a CSV oficial</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLiveSubtitlesModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #38BDF8',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#38BDF8' }}>Subtítulos y Traducción en Vivo</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Capa de subtítulos en pantalla con servidor WebSocket /ws, transcriptor web y estilos</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAiAssistantModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #22C55E',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#22C55E' }}>Asistente de Contenido y Diapositivas</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Armar bosquejos, sugerir pasajes bíblicos y dividir texto con estricta revisión humana</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSecondaryBackupModalOpen(true)}
                    style={{
                      background: '#1A1A1A',
                      border: '1px solid #FF7A00',
                      borderRadius: 8,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: '#FFF'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: '#FF7A00' }}>Copias de Seguridad Secundarias (USB)</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>Duplicación de respaldo a carpeta externa o memoria USB con verificación SHA-256</div>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {currentServiceItem?.type === 'youtube' && currentServiceItem.youtubeConfig && (
                  <div
                    className="pro-yt-active-control-card"
                    style={{
                      backgroundColor: 'var(--bg-surface-raised, #181818)',
                      border: '1px solid var(--border-color, #2A2A2A)',
                      borderRadius: 8,
                      padding: 16,
                      margin: '12px 16px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16
                    }}
                  >
                    <img
                      src={
                        currentServiceItem.youtubeConfig.thumbnailUrl ||
                        `https://i.ytimg.com/vi/${currentServiceItem.youtubeConfig.youtubeId}/hqdefault.jpg`
                      }
                      alt=""
                      style={{
                        width: 140,
                        height: 80,
                        objectFit: 'cover',
                        borderRadius: 6,
                        backgroundColor: '#000'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            backgroundColor: 'var(--accent-danger, #ef4444)',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4
                          }}
                        >
                          YOUTUBE
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>
                          {currentServiceItem.youtubeConfig.title}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', marginBottom: 8 }}>
                        {currentServiceItem.youtubeConfig.channelTitle || 'YouTube'} • In:{' '}
                        {currentServiceItem.youtubeConfig.inPoint || 0}s
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="pro-btn-secondary"
                          onClick={async () => {
                            if (currentServiceItem.youtubeConfig) {
                              await window.churchPresenterApi.controlYouTube(
                                'prepare',
                                currentServiceItem.youtubeConfig
                              )
                            }
                          }}
                          style={{ fontSize: 12, padding: '5px 12px' }}
                        >
                          Preparar en Salidas
                        </button>
                        <button
                          className="pro-btn-primary"
                          onClick={async () => {
                            if (currentServiceItem.youtubeConfig) {
                              await window.churchPresenterApi.controlYouTube(
                                'prepare',
                                currentServiceItem.youtubeConfig
                              )
                              await window.churchPresenterApi.controlYouTube('go-live')
                              const slide: SlideItem = {
                                id: `yt_slide_${currentServiceItem.youtubeConfig.youtubeId}`,
                                sourceId: currentServiceItem.youtubeConfig.youtubeId,
                                sourceType: 'presentation',
                                slideIndex: 0,
                                totalSlidesInGroup: 1,
                                title: currentServiceItem.youtubeConfig.title,
                                body: `▶ YouTube: ${currentServiceItem.youtubeConfig.title}\nCanal: ${
                                  currentServiceItem.youtubeConfig.channelTitle || 'YouTube'
                                }`,
                                mediaType: 'youtube',
                                mediaUrl: currentServiceItem.youtubeConfig.url,
                                youtubeId: currentServiceItem.youtubeConfig.youtubeId,
                                youtubeDuration: currentServiceItem.youtubeConfig.duration
                              }
                              await window.churchPresenterApi.sendSlide(
                                slide,
                                currentServiceItem.youtubeConfig.targetRoles
                              )
                            }
                          }}
                          style={{ fontSize: 12, padding: '5px 14px', backgroundColor: 'var(--accent-danger, #ef4444)' }}
                        >
                          ▶ Proyectar En Vivo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isLiveDirty && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      backgroundColor: '#261609',
                      borderBottom: '1px solid #f97316',
                      color: '#ffedd5',
                      fontSize: '12px'
                    }}
                  >
                    <span>⚠️ El tema de este elemento se modificó pero aún no se ha proyectado en vivo.</span>
                    <button
                      onClick={handleUpdateLiveProjection}
                      style={{
                        backgroundColor: '#f97316',
                        color: '#ffffff',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Actualizar en vivo
                    </button>
                  </div>
                )}

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
                    if (currentSong) {
                      handleOpenSongEditor(currentSong)
                    } else if (currentPresentation) {
                      handleOpenPresentationEditor(currentPresentation)
                    } else {
                      handleOpenSongEditor()
                    }
                  }}
                  theme={activeTheme}
                  allThemes={themes}
                  elementThemeId={currentServiceItem?.themeId || currentSong?.themeId || currentPresentation?.themeId}
                  onSelectTheme={handleAssignThemeToCurrentElement}
                  arrangements={currentSong?.arrangements}
                  selectedArrangementId={selectedArrangementId}
                  onSelectArrangement={setSelectedArrangementId}
                />

                {/* Resizer H2 between Slides and Media Drawer */}
                {isMediaDrawerOpen && (
                  <div
                    className="pro-resizer-horizontal"
                    onMouseDown={handleMouseDownH2}
                    onDoubleClick={() => setMediaDrawerHeight(220)}
                    title="Arrastrar para redimensionar cajón de medios (Doble clic para restablecer)"
                  />
                )}

                {/* Collapsible Media Drawer */}
                <MediaDrawer
                  isOpen={isMediaDrawerOpen}
                  onToggle={() => setIsMediaDrawerOpen(!isMediaDrawerOpen)}
                  mediaItems={mediaItems}
                  onImportFile={handleNativeImportMedia}
                  onImportFolder={handleNativeImportFolder}
                  panelLabels={panelLabels}
                  height={mediaDrawerHeight}
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
                    const bgType = item.mediaType === 'video' ? 'video' : 'image'
                    window.churchPresenterApi.sendSlide({
                      id: `bg_${item.id}_${Date.now()}`,
                      title: '',
                      body: '',
                      subtitle: '',
                      background: { type: bgType as any, value: item.filePath }
                    })
                    setToasts((prev) => [
                      ...prev.slice(-3),
                      {
                        id: `bg_${Date.now()}`,
                        type: 'info',
                        title: 'Fondo Establecido',
                        message: `"${item.originalName}" establecido como fondo activo.`,
                        timestamp: Date.now()
                      }
                    ])
                  }}
                  onDeleteMedia={(item) => {
                    handleDeleteMediaItem(item.id, item.originalName)
                  }}
                />
              </>
            )}
          </ErrorBoundary>
        </section>

        {/* Right Column: Preview, Audio VU, Layers, Transport & Timers */}
        {!isRightCollapsed ? (
          <>
            {/* Vertical Resizer V2: Center Column vs Right Column */}
            <div
              className="pro-resizer-vertical"
              onMouseDown={handleMouseDownV2}
              onDoubleClick={() => setRightWidth(340)}
              title="Arrastrar para redimensionar panel derecho (Doble clic para restablecer)"
            />

            <aside className="pro-right-panel" style={{ width: `${rightWidth}px` }}>
              <ErrorBoundary panelName="Monitores y Salidas">
                <RightSidePanel
                  state={state}
                  currentSlide={activeSlides[previewSlideIndex] || null}
                  timers={presentationTimers}
                  macros={macros}
                  propsList={propsList}
                  onRunMacro={handleRunMacro}
                  onRunMacroStep={handleRunMacroStep}
                  onStopAllMacros={handleStopAllMacros}
                  onOpenMacroEditor={(m) => {
                    setEditingMacro(m || null)
                    setIsMacroEditorOpen(true)
                  }}
                  onDeleteMacro={handleDeleteMacro}
                  onDuplicateMacro={handleDuplicateMacro}
                  onToggleProp={handleToggleProp}
                  onOpenPropEditor={(p) => {
                    setEditingProp(p || null)
                    setIsPropEditorOpen(true)
                  }}
                  onDeleteProp={handleDeleteProp}
                  onClearProps={handleClearProps}
                  panelLabels={panelLabels}
                  previewHeight={previewHeight}
                  onResizePreview={handleMouseDownH3}
                  onResetPreview={() => setPreviewHeight(260)}
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
                  onClearLayer={handleClearLayer}
                  onControlVideo={(action, time) => {
                    window.churchPresenterApi.controlVideo(action, time)
                  }}
                />
              </ErrorBoundary>
            </aside>
          </>
        ) : (
          <div
            className="pro-collapsed-column-strip"
            onClick={() => setIsRightCollapsed(false)}
            title="Mostrar panel derecho (Vista previa / Temporizadores)"
          >
            <ChevronLeft size={14} />
            <span className="pro-collapsed-strip-label">PREVIEW</span>
          </div>
        )}
      </div>

      {/* Drag & Drop Overlay */}
      <FileDropOverlay isDragging={isDraggingFiles} />

      {/* External File Watcher Toast */}
      <FileWatcherToast
        event={fileWatcherEvent}
        onRefresh={async (evt) => {
          try {
            if (evt.type === 'powerpoint') {
              await window.churchPresenterApi.importPowerPoint(evt.filePath)
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
          } catch (err: any) {
            alert(`Error al actualizar archivo: ${err?.message || err}`)
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
          <div className="modal-content bible-import-modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} color="#3B82F6" />
                <span>Importar Traducción de la Biblia</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => {
                  resetBibleImportForm()
                  setIsBibleImportModalOpen(false)
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {importValidationSummary ? (
                /* Verification & Summary Card upon completion */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      backgroundColor: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: 8
                    }}
                  >
                    <CheckCircle size={24} color="#22c55e" style={{ flexShrink: 0 }} />
                    <div>
                      <strong style={{ color: '#4ade80', fontSize: 14 }}>
                        ¡Traducción importada y validada con éxito!
                      </strong>
                      <div style={{ color: '#cbd5e1', fontSize: 12 }}>
                        La base de datos SQLite fue creada y optimizada con índice FTS4 para búsquedas instantáneas.
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                      backgroundColor: '#1E1E1E',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 13
                    }}
                  >
                    <div>
                      <span style={{ color: '#9CA3AF' }}>Nombre:</span> <strong>{importValidationSummary.translation.name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#9CA3AF' }}>Abreviatura:</span>{' '}
                      <span className="trans-pill">{importValidationSummary.translation.abbrev}</span>
                    </div>
                    <div>
                      <span style={{ color: '#9CA3AF' }}>Libros contenidos:</span>{' '}
                      <strong>{importValidationSummary.bookCount} de 66</strong>
                    </div>
                    <div>
                      <span style={{ color: '#9CA3AF' }}>Versículos totales:</span>{' '}
                      <strong>{importValidationSummary.verseCount.toLocaleString()}</strong>
                    </div>
                  </div>

                  {importValidationSummary.missingBooks.length > 0 && (
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#fbbf24'
                      }}
                    >
                      <strong>Nota de completitud:</strong> Faltan {importValidationSummary.missingBooks.length} libros
                      para el canon completo de 66 (por ej. si es una edición solo del Nuevo Testamento).
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F3F4F6', marginBottom: 8 }}>
                      Muestras de Verificación (Génesis 1:1, Salmos 23:1, Juan 3:16):
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {importValidationSummary.sampleVerses.map((sv, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: '#18181B',
                            border: '1px solid #27272A',
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#60A5FA', marginBottom: 2 }}>{sv.reference}</div>
                          <div style={{ color: '#E4E4E7', fontStyle: 'italic' }}>"{sv.text}"</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Import Configuration Form */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="license-warning-notice">
                    <AlertCircle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <div>
                      <strong>Aviso de Propiedad Intelectual y Licencia:</strong>
                      <p>
                        ChurchPresenter respeta los derechos de autor. Solo importe traducciones que pertenezcan al{' '}
                        <strong>Dominio Público</strong> o respecto de las cuales su congregación posea la licencia por
                        escrito otorgada por los titulares o sociedades bíblicas.
                      </p>
                    </div>
                  </div>

                  {/* Drag & Drop File Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDraggingBibleFile(true)
                    }}
                    onDragLeave={() => setIsDraggingBibleFile(false)}
                    onDrop={handleBibleFileDrop}
                    style={{
                      border: isDraggingBibleFile ? '2px dashed #3B82F6' : '1px dashed #3F3F46',
                      backgroundColor: isDraggingBibleFile ? 'rgba(59, 130, 246, 0.08)' : '#18181B',
                      borderRadius: 8,
                      padding: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={handlePickBibleFileNative}
                  >
                    <Upload size={24} color={isDraggingBibleFile ? '#3B82F6' : '#9CA3AF'} style={{ margin: '0 auto 8px' }} />
                    {importFilePath ? (
                      <div>
                        <div style={{ color: '#38BDF8', fontWeight: 600, fontSize: 13 }}>
                          Archivo seleccionado: {importFileName}
                        </div>
                        <div style={{ color: '#71717A', fontSize: 11, marginTop: 4 }}>
                          {importFilePath} (Haga clic para cambiar)
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ color: '#F4F4F5', fontSize: 13, fontWeight: 500 }}>
                          Arrastre aquí su archivo o haga clic para examinar
                        </div>
                        <div style={{ color: '#A1A1AA', fontSize: 11, marginTop: 4 }}>
                          Formatos compatibles: SQLite (.sqlite, .db, .bible), JSON (ChurchPresenter o Genérico), Zefania XML (.xml), OSIS XML (.osis), USFM (.usfm, .txt)
                        </div>
                      </div>
                    )}
                  </div>

                  {importBibleError && (
                    <div
                      style={{
                        padding: '10px 14px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 6,
                        color: '#f87171',
                        fontSize: 12
                      }}
                    >
                      {importBibleError}
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group flex-1">
                      <label>Formato:</label>
                      <select
                        value={importFormat}
                        onChange={(e) => setImportFormat(e.target.value as any)}
                      >
                        <option value="sqlite">Base de Datos SQLite (.sqlite, .db, .bible)</option>
                        <option value="json">JSON (ChurchPresenter o Genérico)</option>
                        <option value="zefania">Zefania / Standard Bible XML (.xml)</option>
                        <option value="osis">OSIS XML (.osis / .xml)</option>
                        <option value="usfm">USFM (.usfm / .txt)</option>
                      </select>
                    </div>

                    <div className="form-group flex-2">
                      <label>Nombre de la Traducción *</label>
                      <input
                        type="text"
                        placeholder="ej. Reina-Valera 1960"
                        value={importName}
                        onChange={(e) => setImportName(e.target.value)}
                      />
                    </div>

                    <div className="form-group flex-1">
                      <label>Abreviatura *</label>
                      <input
                        type="text"
                        placeholder="ej. RVR60"
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
                        placeholder="ej. Dominio Público / Sociedades Bíblicas Unidas"
                        value={importCopyright}
                        onChange={(e) => setImportCopyright(e.target.value)}
                      />
                    </div>
                  </div>

                  {!importFilePath && (
                    <div className="form-group">
                      <label>O pegue el contenido del archivo de texto directamente:</label>
                      <textarea
                        className="raw-lyrics-textarea"
                        rows={5}
                        placeholder="Pegue aquí el texto JSON, Zefania XML, OSIS XML o USFM..."
                        value={importRawContent}
                        onChange={(e) => setImportRawContent(e.target.value)}
                      />
                    </div>
                  )}

                  <div>
                    <label className="checkbox-label" style={{ fontSize: 12, color: '#f8fafc', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={importConsent}
                        onChange={(e) => setImportConsent(e.target.checked)}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Confirmo que tengo derecho a usar esta traducción en mi iglesia</strong> (pertenece al dominio público o mi congregación cuenta con la licencia correspondiente).
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {importValidationSummary ? (
                <>
                  <button
                    className="secondary-action-btn"
                    onClick={() => {
                      if (importValidationSummary.translation.abbrev) {
                        handleSetDefaultBible(importValidationSummary.translation.abbrev)
                      }
                      resetBibleImportForm()
                      setIsBibleImportModalOpen(false)
                    }}
                  >
                    Establecer como Predeterminada y Salir
                  </button>
                  <button
                    className="primary-action-btn"
                    onClick={() => {
                      resetBibleImportForm()
                      setIsBibleImportModalOpen(false)
                    }}
                  >
                    Aceptar y Finalizar
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="secondary-action-btn"
                    onClick={() => {
                      resetBibleImportForm()
                      setIsBibleImportModalOpen(false)
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="primary-action-btn"
                    disabled={!importConsent || (!importFilePath && !importRawContent.trim()) || isImportingBible}
                    onClick={handleExecuteBibleImport}
                    style={{
                      opacity: !importConsent || (!importFilePath && !importRawContent.trim()) || isImportingBible ? 0.5 : 1
                    }}
                  >
                    {isImportingBible ? 'Procesando e Importando...' : 'Procesar e Importar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          BIBLE MANAGER MODAL (List installed versions)
          ========================================================= */}
      {isBibleManagerModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content bible-manager-modal" style={{ width: 680 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} color="#3B82F6" />
                <span>Traducciones Bíblicas Instaladas</span>
              </div>
              <button className="modal-close-btn" onClick={() => setIsBibleManagerModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p className="section-note" style={{ margin: 0 }}>
                  Cada traducción se almacena en su propio archivo SQLite independiente dentro de la carpeta de datos de la aplicación.
                </p>
                <button
                  type="button"
                  className="primary-action-btn"
                  onClick={() => {
                    setIsBibleManagerModalOpen(false)
                    resetBibleImportForm()
                    setIsBibleImportModalOpen(true)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
                >
                  <Upload size={14} />
                  <span>Importar traducción...</span>
                </button>
              </div>

              {/* Drag & drop dropzone on the manager dialog */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDraggingBibleFile(true)
                }}
                onDragLeave={() => setIsDraggingBibleFile(false)}
                onDrop={(e) => {
                  setIsBibleManagerModalOpen(false)
                  resetBibleImportForm()
                  setIsBibleImportModalOpen(true)
                  handleBibleFileDrop(e)
                }}
                style={{
                  border: isDraggingBibleFile ? '2px dashed #3B82F6' : '1px dashed #374151',
                  backgroundColor: isDraggingBibleFile ? 'rgba(59, 130, 246, 0.08)' : '#18181B',
                  borderRadius: 6,
                  padding: '10px',
                  textAlign: 'center',
                  marginBottom: 12,
                  fontSize: 12,
                  color: '#9CA3AF'
                }}
              >
                Arrastre y suelte un archivo (.sqlite, .db, .bible, .json, .xml, .osis, .usfm) aquí para importarlo de inmediato
              </div>

              <div className="translations-list">
                {bibleTranslations.map((bt) => (
                  <div key={bt.id} className="translation-item-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="translation-name-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong>{bt.name}</strong>
                        <span className="trans-pill">{bt.abbrev}</span>
                        {bt.isDefault && (
                          <span className="default-pill" style={{ backgroundColor: '#262626', color: '#38bdf8', border: '1px solid #38bdf8', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            PREDETERMINADA
                          </span>
                        )}
                      </div>
                      <div className="trans-meta" style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                        {bt.verseCount.toLocaleString()} versículos • {bt.language.toUpperCase()} • {bt.copyright}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!bt.isDefault && (
                        <button
                          className="control-btn"
                          onClick={() => handleSetDefaultBible(bt.abbrev)}
                          title="Establecer como traducción predeterminada"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            fontSize: 11,
                            backgroundColor: '#262626',
                            border: '1px solid #3F3F46',
                            borderRadius: 4,
                            color: '#E4E4E7',
                            cursor: 'pointer'
                          }}
                        >
                          <Star size={12} color="#FBBF24" />
                          <span>Hacer default</span>
                        </button>
                      )}

                      {!bt.isDefault && bt.abbrev !== 'RVR1909' && bt.abbrev !== 'KJV' ? (
                        <button
                          className="control-btn delete-btn"
                          onClick={async () => {
                            if (confirm(`¿Eliminar la traducción ${bt.name} (${bt.abbrev})?`)) {
                              await window.churchPresenterApi.deleteBibleTranslation(bt.id)
                              const updated = await window.churchPresenterApi.getBibleTranslations()
                              setBibleTranslations(updated)
                            }
                          }}
                          title="Eliminar traducción"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span
                          title="Traducción de fábrica o predeterminada protegida contra eliminación"
                          style={{ fontSize: 11, color: '#6B7280', padding: '4px 6px' }}
                        >
                          Protegida
                        </span>
                      )}
                    </div>
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

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {editingSong.id ? (
                  <button
                    type="button"
                    className="danger-action-btn"
                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: '13px' }}
                    onClick={() => handleDeleteSong(editingSong.id, editingSong.title)}
                  >
                    Eliminar Canción
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary-action-btn" onClick={() => setIsSongEditorOpen(false)}>
                  Cancelar
                </button>
                <button className="primary-action-btn" onClick={handleSaveSong}>
                  Guardar Canción
                </button>
              </div>
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
          NEW PLAYLIST / TEMPLATE MODAL
          ========================================================= */}
      {newPlaylistModal.isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setNewPlaylistModal((prev) => ({ ...prev, isOpen: false }))}
        >
          <div
            className="modal-content"
            style={{ maxWidth: 440, backgroundColor: '#18191c', border: '1px solid #334155' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title">{newPlaylistModal.title}</div>
              <button
                className="modal-close-btn"
                onClick={() => setNewPlaylistModal((prev) => ({ ...prev, isOpen: false }))}
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const formEl = e.currentTarget
                const inputEl = formEl.elements.namedItem('playlistName') as HTMLInputElement | null
                const input = inputEl?.value?.trim()
                if (!input) return

                if (newPlaylistModal.mode === 'create') {
                  const newService: ServicePlan = {
                    id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    name: input,
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
                } else if (newPlaylistModal.mode === 'template' && currentService) {
                  const template: ServicePlan = {
                    ...currentService,
                    id: `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    name: input,
                    isTemplate: true,
                    updatedAt: new Date().toISOString()
                  }
                  window.churchPresenterApi.saveService(template).then((saved) => {
                    setTemplates((prev) => [saved, ...prev])
                  })
                } else if (newPlaylistModal.mode === 'from_template' && newPlaylistModal.templateToUse) {
                  const newService = createServiceFromTemplate(
                    newPlaylistModal.templateToUse,
                    input,
                    new Date().toISOString().split('T')[0]
                  )
                  window.churchPresenterApi.saveService(newService).then((saved) => {
                    setServices((prev) => [saved, ...prev])
                    setCurrentService(saved)
                    setSelectedServiceItemIndex(0)
                  })
                }
                setNewPlaylistModal((prev) => ({ ...prev, isOpen: false }))
              }}
            >
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                  Nombre del servicio o playlist:
                </label>
                <input
                  name="playlistName"
                  type="text"
                  autoFocus
                  defaultValue={newPlaylistModal.initialValue}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#1e2229',
                    border: '1px solid #334155',
                    borderRadius: 4,
                    color: '#f8fafc',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div
                className="modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px' }}
              >
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setNewPlaylistModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-action-btn"
                  style={{ backgroundColor: '#FF7A00', borderColor: '#FF7A00', color: '#FFFFFF' }}
                >
                  {newPlaylistModal.mode === 'template' ? 'Guardar Plantilla' : 'Crear Playlist'}
                </button>
              </div>
            </form>
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

            {/* Selector desplegable en pantallas pequeñas (< 900px) */}
            <div className="settings-mobile-nav">
              <select
                className="settings-mobile-select"
                value={settingsCategory}
                onChange={(e) => setSettingsCategory(e.target.value)}
              >
                {SETTINGS_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-modal-body">
              {/* Columna Izquierda: Barra Lateral con Categorías (220px fija) */}
              <div className="settings-sidebar">
                {SETTINGS_CATEGORIES.map((cat) => {
                  const Icon = cat.icon
                  const isActive = settingsCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`settings-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setSettingsCategory(cat.id)}
                    >
                      <div className="settings-nav-header">
                        <Icon size={16} />
                        <span>{cat.label}</span>
                      </div>
                      <div className="settings-nav-subtitle">
                        {cat.subtitle}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Columna Derecha: Contenido de la Categoría Seleccionada */}
              <div className="settings-content-area">
                {/* =========================================================
                    1. GENERAL
                    ========================================================= */}
                {settingsCategory === 'general' && (
                  <>
                    {/* Church Branding & Background Section: Identidad de la Iglesia */}
                    <div className="settings-section" style={{ borderLeft: '4px solid #FF7A00', paddingLeft: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>Identidad de la Iglesia: Logo y Fondo Predeterminado</span>
                          </h3>
                          <p className="section-note" style={{ margin: '4px 0 0 0' }}>
                            Personalice el logo de su iglesia para la pantalla de bloqueo/logo (F3) y configure el fondo predeterminado (imagen, video en bucle o degradado) para todas las salidas.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => window.churchPresenterApi.toggleGlobalControl('logo')}
                          title="Alterna la pantalla de logo en vivo (F3)"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }}
                        >
                          <span>Probar Logo (F3)</span>
                        </button>
                      </div>

                      {brandingStatusMsg && (
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 4,
                            marginBottom: 12,
                            fontSize: 12,
                            backgroundColor: brandingStatusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${brandingStatusMsg.type === 'success' ? '#22c55e' : '#ef4444'}`,
                            color: brandingStatusMsg.type === 'success' ? '#4ade80' : '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span>{brandingStatusMsg.text}</span>
                          <button
                            type="button"
                            onClick={() => setBrandingStatusMsg(null)}
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 12 }}>
                        {/* Panel Izquierdo: LOGO DE LA IGLESIA */}
                        <div
                          style={{
                            background: '#15171c',
                            border: '1px solid #282d37',
                            borderRadius: 8,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>1. Logo de la Iglesia</span>
                            {tempChurchBranding.logoUrl && (
                              <span style={{ fontSize: 10, padding: '1px 6px', background: '#22c55e', color: '#fff', borderRadius: 3, fontWeight: 700 }}>
                                Personalizado
                              </span>
                            )}
                          </div>

                          {/* Previsualización del Logo */}
                          <div
                            style={{
                              height: 120,
                              backgroundColor: '#0a0a0c',
                              border: '1px solid #334155',
                              borderRadius: 6,
                              display: 'flex',
                              flexDirection: tempChurchBranding.logoTextPosition === 'right' ? 'row' : 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10,
                              padding: 10,
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            {tempChurchBranding.logoUrl ? (
                              <img
                                src={toMediaUrl(tempChurchBranding.logoUrl)}
                                alt="Logo de la Iglesia"
                                style={{
                                  maxHeight: 64,
                                  maxWidth: 120,
                                  objectFit: 'contain',
                                  opacity: tempChurchBranding.logoOpacity ?? 1,
                                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))'
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: '50%',
                                  border: '2px solid rgba(255,255,255,0.7)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontWeight: 900,
                                  fontSize: 22
                                }}
                              >
                                ✝
                              </div>
                            )}
                            {tempChurchBranding.logoTextPosition !== 'none' && (
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 900,
                                  color: '#ffffff',
                                  letterSpacing: 1.5,
                                  textTransform: 'uppercase',
                                  textAlign: 'center',
                                  maxWidth: '90%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                                }}
                              >
                                {tempChurchBranding.churchName || 'CHURCH PRESENTER'}
                              </div>
                            )}
                          </div>

                          {/* Botones de acción del logo */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="primary-action-btn"
                              onClick={handleUploadLogo}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}
                            >
                              <Upload size={14} />
                              <span>{tempChurchBranding.logoUrl ? 'Cambiar Imagen de Logo...' : 'Cargar Imagen de Logo...'}</span>
                            </button>
                            {tempChurchBranding.logoUrl && (
                              <button
                                type="button"
                                className="secondary-action-btn"
                                onClick={handleRemoveLogo}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, color: '#f87171' }}
                              >
                                <Trash2 size={14} />
                                <span>Quitar Logo</span>
                              </button>
                            )}
                          </div>

                          {/* Configuración de nombre y texto */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1' }}>Nombre de la Iglesia:</label>
                            <input
                              type="text"
                              value={tempChurchBranding.churchName}
                              onChange={(e) => setTempChurchBranding({ ...tempChurchBranding, churchName: e.target.value })}
                              placeholder="Ej. Iglesia Bautista de la Gracia"
                              style={{
                                padding: '6px 10px',
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: 4,
                                color: '#f8fafc',
                                fontSize: 12
                              }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 4 }}>
                                Posición del Texto:
                              </label>
                              <select
                                value={tempChurchBranding.logoTextPosition || 'bottom'}
                                onChange={(e) =>
                                  setTempChurchBranding({
                                    ...tempChurchBranding,
                                    logoTextPosition: e.target.value as any
                                  })
                                }
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: 4,
                                  color: '#f8fafc',
                                  fontSize: 12
                                }}
                              >
                                <option value="bottom">Debajo del Logo</option>
                                <option value="right">A la derecha del Logo</option>
                                <option value="none">Sin texto (Solo Logo)</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: 4 }}>
                                Tamaño en Pantalla ({tempChurchBranding.logoWidthVmin || 22}vmin):
                              </label>
                              <input
                                type="range"
                                min={12}
                                max={36}
                                value={tempChurchBranding.logoWidthVmin || 22}
                                onChange={(e) =>
                                  setTempChurchBranding({
                                    ...tempChurchBranding,
                                    logoWidthVmin: Number(e.target.value)
                                  })
                                }
                                style={{ width: '100%', accentColor: '#FF7A00', cursor: 'pointer' }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Panel Derecho: FONDO PREDETERMINADO */}
                        <div
                          style={{
                            background: '#15171c',
                            border: '1px solid #282d37',
                            borderRadius: 8,
                            padding: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>2. Fondo Predeterminado de la Iglesia</span>
                            <span style={{ fontSize: 10, padding: '1px 6px', background: '#3b82f6', color: '#fff', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>
                              {tempChurchBranding.defaultBackground?.type || 'gradient'}
                            </span>
                          </div>

                          {/* Previsualización del Fondo */}
                          <div
                            style={{
                              height: 120,
                              backgroundColor: tempChurchBranding.defaultBackground?.type === 'color' ? tempChurchBranding.defaultBackground.value : '#000000',
                              backgroundImage: tempChurchBranding.defaultBackground?.type === 'gradient' ? tempChurchBranding.defaultBackground.value : undefined,
                              border: '1px solid #334155',
                              borderRadius: 6,
                              position: 'relative',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {tempChurchBranding.defaultBackground?.type === 'image' && (
                              <img
                                src={toMediaUrl(tempChurchBranding.defaultBackground.value)}
                                alt="Fondo de imagen"
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                            {tempChurchBranding.defaultBackground?.type === 'video' && (
                              <video
                                src={toMediaUrl(tempChurchBranding.defaultBackground.value)}
                                autoPlay
                                loop
                                muted
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            )}
                            <div
                              style={{
                                position: 'relative',
                                zIndex: 2,
                                background: 'rgba(0,0,0,0.65)',
                                backdropFilter: 'blur(4px)',
                                padding: '4px 10px',
                                borderRadius: 4,
                                fontSize: 11,
                                color: '#fff',
                                fontWeight: 600
                              }}
                            >
                              {tempChurchBranding.defaultBackground?.type === 'image' && '🖼️ Imagen de Fondo'}
                              {tempChurchBranding.defaultBackground?.type === 'video' && '🎬 Video en Bucle'}
                              {tempChurchBranding.defaultBackground?.type === 'gradient' && '🎨 Degradado Pro'}
                              {tempChurchBranding.defaultBackground?.type === 'color' && '⬛ Color Sólido'}
                            </div>
                          </div>

                          {/* Botones de Carga de Medios */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              className="secondary-action-btn"
                              onClick={handleUploadBackgroundImage}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 8px', fontSize: 12 }}
                            >
                              <ImageIcon size={14} />
                              <span>Cargar Imagen...</span>
                            </button>
                            <button
                              type="button"
                              className="secondary-action-btn"
                              onClick={handleUploadBackgroundVideo}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '6px 8px', fontSize: 12 }}
                            >
                              <Film size={14} />
                              <span>Cargar Video...</span>
                            </button>
                          </div>

                          {/* Presets de Degradados y Color Sólido */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#cbd5e1', marginBottom: 6 }}>
                              Degradados y Colores Rápidos:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleApplyPresetGradient('linear-gradient(135deg, #181818 0%, #242424 100%)', 'Carbón')}
                                title="Carbón Elegante"
                                style={{
                                  height: 26,
                                  background: 'linear-gradient(135deg, #181818 0%, #242424 100%)',
                                  border: '1px solid #475569',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyPresetGradient('linear-gradient(135deg, #091e3a 0%, #1e3a8a 50%, #030712 100%)', 'Azul Celestial')}
                                title="Azul Celestial"
                                style={{
                                  height: 26,
                                  background: 'linear-gradient(135deg, #091e3a 0%, #1e3a8a 50%, #030712 100%)',
                                  border: '1px solid #475569',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyPresetGradient('linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #090214 100%)', 'Púrpura Sacro')}
                                title="Púrpura Sacro"
                                style={{
                                  height: 26,
                                  background: 'linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #090214 100%)',
                                  border: '1px solid #475569',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyPresetGradient('linear-gradient(135deg, #431407 0%, #7c2d12 50%, #0c0a09 100%)', 'Cálido')}
                                title="Cálido Crepúsculo"
                                style={{
                                  height: 26,
                                  background: 'linear-gradient(135deg, #431407 0%, #7c2d12 50%, #0c0a09 100%)',
                                  border: '1px solid #475569',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleApplyPresetGradient('linear-gradient(135deg, #022c22 0%, #064e3b 50%, #02110c 100%)', 'Esmeralda')}
                                title="Esmeralda Solemne"
                                style={{
                                  height: 26,
                                  background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #02110c 100%)',
                                  border: '1px solid #475569',
                                  borderRadius: 4,
                                  cursor: 'pointer'
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <label style={{ fontSize: 11, color: '#94a3b8' }}>Color Sólido:</label>
                              <input
                                type="color"
                                value={tempChurchBranding.defaultBackground?.type === 'color' ? tempChurchBranding.defaultBackground.value : '#000000'}
                                onChange={(e) => handleApplySolidColor(e.target.value)}
                                style={{ width: 34, height: 26, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                              />
                              <button
                                type="button"
                                className="secondary-action-btn"
                                onClick={() => handleApplySolidColor('#000000')}
                                style={{ fontSize: 11, padding: '3px 8px' }}
                              >
                                Negro Puro
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          type="button"
                          className="primary-action-btn"
                          onClick={handleSaveAllBranding}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, backgroundColor: '#FF7A00' }}
                        >
                          <span>Guardar y Aplicar Identidad a Todas las Pantallas</span>
                        </button>
                      </div>
                    </div>

                    {/* Requirement 1: Nombres de Paneles (Estilo ProPresenter vs Español) */}
                    <div className="settings-section">
                      <h3>Nombres de Paneles y Botones</h3>
                      <p className="section-note">
                        Elija la terminología utilizada en la interfaz del operador. Por defecto se usan los nombres estándar de ProPresenter 7 ("Library", "Playlist", "Media", "Audience", "Stage") para facilitar el flujo de trabajo del equipo audiovisual. Los textos de ayuda, diálogos y mensajes del sistema permanecen en español.
                      </p>
                      <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="radio"
                            name="panelNaming"
                            value="propresenter"
                            checked={panelNaming === 'propresenter'}
                            onChange={() => {
                              setPanelNaming('propresenter')
                              localStorage.setItem('cp_panel_naming', 'propresenter')
                            }}
                          />
                          <span><strong>ProPresenter por Defecto:</strong> Library, Playlist, Media, Audience, Stage</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="radio"
                            name="panelNaming"
                            value="spanish"
                            checked={panelNaming === 'spanish'}
                            onChange={() => {
                              setPanelNaming('spanish')
                              localStorage.setItem('cp_panel_naming', 'spanish')
                            }}
                          />
                          <span><strong>Español:</strong> Biblioteca, Playlist, Medios, Audiencia, Escenario</span>
                        </label>
                      </div>
                    </div>

                    {/* Información General de la Aplicación */}
                    <div className="settings-section">
                      <h3>Información de la Aplicación y Versión</h3>
                      <p className="section-note">
                        ChurchPresenter Pro 7 — Software profesional para presentación de alabanza, multimedia y transmisión en vivo.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 10 }}>
                        <div style={{ background: '#12141a', border: '1px solid #1f242e', borderRadius: 6, padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Versión Instalada:</span>
                          <strong style={{ fontSize: 14, color: '#f8fafc' }}>v{appVersion}</strong>
                        </div>
                        <div style={{ background: '#12141a', border: '1px solid #1f242e', borderRadius: 6, padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Entorno de Ejecución:</span>
                          <strong style={{ fontSize: 13, color: isDev ? '#38bdf8' : '#22c55e' }}>
                            {isDev ? 'Modo Desarrollo (Dev)' : 'Producción (Estable)'}
                          </strong>
                        </div>
                        <div style={{ background: '#12141a', border: '1px solid #1f242e', borderRadius: 6, padding: '10px 14px' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Carpeta de Datos:</span>
                          <strong style={{ fontSize: 11, color: '#cbd5e1', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                            {userDataPath || 'Predeterminada'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* =========================================================
                    2. PANTALLAS (DISPLAYS & STAGE)
                    ========================================================= */}
                {settingsCategory === 'displays' && (
                  <>
                    <div className="settings-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <h3>Asignación de Roles a Monitores Físicos</h3>
                          <p className="section-note" style={{ margin: 0 }}>
                            Asigne cada rol de salida (Sala Principal, Escenario, Lobby) a una pantalla o proyector detectado por el sistema.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => window.churchPresenterApi.identifyDisplays()}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                        >
                          <Monitor size={14} />
                          <span>Identificar Pantallas (Overlay)</span>
                        </button>
                      </div>

                      <div className="displays-roles-table" style={{ marginTop: 12 }}>
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
                    </div>

                    {/* Phase 6: Diseño de Pantalla de Escenario */}
                    <div className="settings-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3>Diseño de Pantalla de Escenario (Stage Monitor)</h3>
                          <p className="section-note" style={{ margin: 0 }}>
                            Personalice los elementos visibles para los predicadores y músicos (diapositiva actual, siguiente, reloj, notas, temporizadores).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsStageLayoutModalOpen(true)}
                          className="secondary-action-btn"
                          style={{ borderColor: '#38bdf8', color: '#38bdf8', fontSize: 12 }}
                        >
                          Editar Diseños de Escenario...
                        </button>
                      </div>
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Diseño activo asignado:</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', backgroundColor: '#1a1a1a', padding: '4px 10px', borderRadius: 6, border: '1px solid #333' }}>
                          {assignedStageLayout?.name || 'Escenario - Clásico Pro'}
                        </span>
                      </div>
                    </div>

                    {/* Monitor de Salud de Salidas */}
                    <div className="settings-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3>Diagnóstico y Salud de Pantallas</h3>
                          <p className="section-note" style={{ margin: 0 }}>
                            Monitoree la frecuencia de actualización, memoria de video, resolución activa y latencia de cada monitor físico.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => setIsOutputHealthModalOpen(true)}
                          style={{ fontSize: 12 }}
                        >
                          <span>Ver Monitor de Salud de Pantallas</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* =========================================================
                    3. AUDIO
                    ========================================================= */}
                {settingsCategory === 'audio' && (
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
                )}

                {/* =========================================================
                    4. RED Y ACCESO REMOTO
                    ========================================================= */}
                {settingsCategory === 'remote' && (
                  <div className="settings-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3>Control Remoto desde Celular y Tablet</h3>
                        <p className="section-note" style={{ margin: 0 }}>
                          Opere la presentación y pantallas desde cualquier teléfono o tableta conectado a la red Wi-Fi local mediante navegador web.
                        </p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(remoteConfig?.enabled)}
                          onChange={(e) => handleToggleRemoteEnabled(e.target.checked)}
                        />
                        <span style={{ color: remoteConfig?.enabled ? '#22c55e' : '#9ca3af' }}>
                          {remoteConfig?.enabled ? 'ACTIVADO' : 'DESACTIVADO'}
                        </span>
                      </label>
                    </div>

                    {remoteConfig?.enabled && (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {remoteStatus?.portConflictWarning && (
                          <div style={{ backgroundColor: '#7c2d12', border: '1px solid #ea580c', color: '#ffedd5', padding: '10px 14px', borderRadius: 6, fontSize: 13 }}>
                            ⚠️ <strong>Conflicto de puerto:</strong> {remoteStatus.portConflictWarning}
                          </div>
                        )}
                        {remoteStatus?.isWindowsPublicNetwork && (
                          <div style={{ backgroundColor: '#451a03', border: '1px solid #d97706', color: '#fef3c7', padding: '10px 14px', borderRadius: 6, fontSize: 13 }}>
                            ⚠️ <strong>Perfil de red de Windows detectado como "Público":</strong> El Firewall de Windows suele bloquear conexiones entrantes en redes públicas. Si los dispositivos no pueden conectarse, configure la conexión como "Red privada" en Windows &gt; Configuración &gt; Red e Internet.
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Interfaz de Red (IP Local):</label>
                            <select
                              value={remoteConfig.selectedIp || '0.0.0.0'}
                              onChange={async (e) => {
                                const updated = await window.churchPresenterApi.saveRemoteConfig({ selectedIp: e.target.value })
                                setRemoteConfig(updated)
                                const status = await window.churchPresenterApi.getRemoteStatus()
                                setRemoteStatus(status)
                              }}
                              style={{ width: '100%', backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '8px', borderRadius: 6, fontSize: 13, marginTop: 4 }}
                            >
                              {networkInterfaces.map((ni) => (
                                <option key={ni.ip} value={ni.ip}>{ni.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Puerto HTTP:</label>
                            <input
                              type="number"
                              value={remoteConfig.port || 8080}
                              onChange={async (e) => {
                                const port = parseInt(e.target.value, 10) || 8080
                                const updated = await window.churchPresenterApi.saveRemoteConfig({ port })
                                setRemoteConfig(updated)
                              }}
                              style={{ width: '100%', backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#fff', padding: '8px', borderRadius: 6, fontSize: 13, marginTop: 4 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>PIN Control Local (8080):</label>
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#f97316', backgroundColor: '#1a1a1a', border: '1px solid #333', padding: '6px 10px', borderRadius: 6, flex: 1, textAlign: 'center' }}>
                                {remoteConfig.pin || '------'}
                              </span>
                              <button
                                type="button"
                                onClick={handleRegeneratePin}
                                className="secondary-action-btn"
                                title="Regenerar PIN numérico de control local"
                                style={{ padding: '6px 8px', fontSize: 11 }}
                              >
                                ↻
                              </button>
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>PIN Operador Remoto (Tailscale 8443):</label>
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'monospace', color: '#38bdf8', backgroundColor: '#1a1a1a', border: '1px solid #333', padding: '6px 10px', borderRadius: 6, flex: 1, textAlign: 'center' }}>
                                {remoteConfig.remoteOperatorPin || '888888'}
                              </span>
                              <button
                                type="button"
                                onClick={handleRegenerateRemoteOperatorPin}
                                className="secondary-action-btn"
                                title="Regenerar PIN de operador remoto"
                                style={{ padding: '6px 8px', fontSize: 11 }}
                              >
                                ↻
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Operador Remoto desde Casa (Tailscale VPN) Banner */}
                        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 8, padding: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f97316', textTransform: 'uppercase' }}>
                              💻 Panel de Operador Remoto desde Casa (Tailscale)
                            </div>
                            <span style={{ fontSize: 10, backgroundColor: 'rgba(249, 115, 22, 0.2)', color: '#f97316', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                              HTTPS 8443
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#e5e7eb', marginBottom: 4 }}>
                            Acceso directo para la laptop del operador: <code style={{ color: '#38bdf8', backgroundColor: '#000', padding: '2px 6px', borderRadius: 4 }}>https://100.73.59.102:8443/operator</code>
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            Permite monitoreo de programa, conmutación de escenas de estudio, control de cámaras, diapositivas y transmisión en vivo desde casa. Requiere conexión activa a Tailscale.
                          </div>
                        </div>

                        {/* QR Code and URLs: Operator & Stage */}
                        {remoteStatus?.addresses && remoteStatus.addresses.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            {/* Operator Remote Card */}
                            <div style={{ display: 'flex', gap: 14, backgroundColor: '#181818', border: '1px solid #282828', borderRadius: 8, padding: 14, alignItems: 'center' }}>
                              {remoteStatus.addresses[0].qrDataUrl && (
                                <img
                                  src={remoteStatus.addresses[0].qrDataUrl}
                                  alt="Código QR de Conexión Remota Operador"
                                  style={{ width: 100, height: 100, borderRadius: 6, border: '1px solid #444', backgroundColor: '#fff', padding: 4 }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', marginBottom: 4 }}>
                                  📱 Control Remoto (Operador)
                                </div>
                                {remoteStatus.addresses.map((addr) => (
                                  <div key={addr.url} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                                      {addr.url}
                                    </span>
                                  </div>
                                ))}
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                  Permite operar diapositivas, playlist y temporizadores (requiere PIN).
                                </div>
                              </div>
                            </div>

                            {/* Stage Viewer Card */}
                            <div style={{ display: 'flex', gap: 14, backgroundColor: '#181818', border: '1px solid #282828', borderRadius: 8, padding: 14, alignItems: 'center' }}>
                              {remoteStatus.addresses[0].stageQrDataUrl && (
                                <img
                                  src={remoteStatus.addresses[0].stageQrDataUrl}
                                  alt="Código QR para Pantalla de Escenario"
                                  style={{ width: 100, height: 100, borderRadius: 6, border: '1px solid #444', backgroundColor: '#fff', padding: 4 }}
                                />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 4 }}>
                                  🎭 Pantalla de Escenario (Tablets)
                                </div>
                                {remoteStatus.addresses.map((addr) => (
                                  <div key={addr.stageUrl || addr.url} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                                      {addr.stageUrl || `${addr.url}/stage`}
                                    </span>
                                  </div>
                                ))}
                                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                                  Visor de escenario para músicos y orador (QR incluye token de solo lectura).
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Stage Without PIN option */}
                        <div style={{ padding: '10px 12px', backgroundColor: '#181818', border: '1px solid #282828', borderRadius: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                            <input
                              type="checkbox"
                              checked={Boolean(remoteConfig?.allowReadOnlyWithoutPin)}
                              onChange={async (e) => {
                                const updated = await window.churchPresenterApi.saveRemoteConfig({ allowReadOnlyWithoutPin: e.target.checked })
                                setRemoteConfig(updated)
                                const status = await window.churchPresenterApi.getRemoteStatus()
                                setRemoteStatus(status)
                              }}
                            />
                            <span style={{ color: '#fff', fontWeight: 600 }}>Permitir visor de Escenario (/stage) sin código PIN</span>
                          </label>
                          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                            ⚠️ <strong>Advertencia:</strong> Si se activa, cualquier dispositivo en la red local podrá ver la pantalla de retorno sin ingresar el PIN. Manténgalo desactivado si desea exigir autorización por PIN o código QR.
                          </div>
                        </div>

                        {/* Connected Devices Table */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>
                            Dispositivos Conectados ({remoteStatus?.connectedClients?.length || 0}):
                          </div>
                          {(remoteStatus?.connectedClients?.length || 0) === 0 ? (
                            <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', padding: '6px 0' }}>
                              No hay dispositivos remotos conectados actualmente.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {remoteStatus?.connectedClients.map((client) => (
                                <div
                                  key={client.id}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid #2e2e2e',
                                    borderRadius: 6,
                                    padding: '8px 12px'
                                  }}
                                >
                                  <div>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{client.name}</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>({client.ip})</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: client.role === 'operator' ? '#f97316' : '#38bdf8', color: '#000', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>
                                      {client.role === 'operator' ? 'CONTROL TOTAL' : 'SOLO LECTURA'}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleKickClient(client.id)}
                                    style={{ backgroundColor: '#ef4444', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, cursor: 'pointer' }}
                                  >
                                    Expulsar
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* =========================================================
                    5. CÁMARAS
                    ========================================================= */}
                {settingsCategory === 'cameras' && (
                  <div className="settings-section">
                    <CameraSettingsSection />
                  </div>
                )}

                {/* =========================================================
                    6. TRANSMISIÓN
                    ========================================================= */}
                {settingsCategory === 'broadcast' && (
                  <>
                    <div className="settings-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <h3>Estudio de Transmisión y Grabación (RTMP)</h3>
                          <p className="section-note" style={{ margin: 0 }}>
                            Configure las claves de stream (YouTube Live, Facebook Live, Twitch), resolución de salida, bitrate y carpeta local de grabación.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="primary-action-btn"
                          onClick={() => setIsBroadcastSettingsOpen(true)}
                          style={{ fontSize: 12 }}
                        >
                          Configurar Transmisión y Grabación...
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 12 }}>
                        <div style={{ background: '#12141a', border: '1px solid #1f242e', borderRadius: 8, padding: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc', marginBottom: 4 }}>
                            🎥 Salida RTMP
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            Transmita la salida de programa directamente a su plataforma de video en 1080p o 720p.
                          </div>
                        </div>
                        <div style={{ background: '#12141a', border: '1px solid #1f242e', borderRadius: 8, padding: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc', marginBottom: 4 }}>
                            ⚡ Codificación Hardware (NVENC)
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            Aprovecha la aceleración por hardware de tarjetas NVIDIA RTX para 0% de sobrecarga en CPU.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="settings-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <h3>Puente con OBS Studio</h3>
                          <p className="section-note" style={{ margin: 0 }}>
                            Conecte ChurchPresenter con OBS Studio a través de obs-websocket v5 y use fuentes de navegador transparentes.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => setIsObsBridgeOpen(true)}
                          style={{ borderColor: '#22c55e', color: '#4ade80', fontSize: 12 }}
                        >
                          Abrir Puente con OBS Studio...
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', background: '#12141a', border: '1px solid #1f242e', borderRadius: 8, padding: 14 }}>
                        Permite cambiar escenas automáticamente en OBS al avanzar diapositivas, sincronizar inicio y fin de stream, y recibir títulos con transparencia alfa para tercios inferiores.
                      </div>
                    </div>
                  </>
                )}

                {/* =========================================================
                    7. BIBLIAS
                    ========================================================= */}
                {settingsCategory === 'bibles' && (
                  <>
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

                    {/* Requirement 0: Gestión e Importación de Traducciones Bíblicas */}
                    <div className="settings-section">
                      <h3>Traducciones Bíblicas y Versiones</h3>
                      <p className="section-note">
                        El sistema cuenta con {bibleTranslations.length} traducciones instaladas ({bibleTranslations.map((b) => b.abbrev).join(', ')}). Cada versión se indexa de forma independiente en SQLite con búsqueda de texto instantánea.
                      </p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                        <button
                          type="button"
                          className="primary-action-btn"
                          onClick={() => {
                            setIsSettingsOpen(false)
                            resetBibleImportForm()
                            setIsBibleImportModalOpen(true)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <Upload size={14} />
                          <span>Importar traducción...</span>
                        </button>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => {
                            setIsSettingsOpen(false)
                            setIsBibleManagerModalOpen(true)
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <BookOpen size={14} />
                          <span>Administrar traducciones instaladas</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* =========================================================
                    8. TECLADO
                    ========================================================= */}
                {settingsCategory === 'keyboard' && (
                  <div className="settings-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <h3>Atajos de Teclado y Perfiles</h3>
                        <p className="section-note" style={{ margin: 0 }}>
                          Configure las teclas para las acciones primarias de la iglesia o seleccione el perfil por defecto de ProPresenter.
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <label style={{ fontSize: 12, color: '#94a3b8' }}>Perfil:</label>
                        <select
                          value={tempShortcuts.profile || 'propresenter'}
                          onChange={(e) => {
                            const prof = e.target.value as ShortcutProfile
                            if (prof === 'propresenter') {
                              setTempShortcuts({ ...DEFAULT_SHORTCUTS, profile: 'propresenter' })
                            } else {
                              setTempShortcuts({ ...tempShortcuts, profile: 'custom' })
                            }
                          }}
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 3,
                            padding: '3px 8px',
                            fontSize: 12
                          }}
                        >
                          <option value="propresenter">ProPresenter por Defecto</option>
                          <option value="custom">Personalizado</option>
                        </select>
                        <button
                          className="secondary-action-btn"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => setTempShortcuts(DEFAULT_SHORTCUTS)}
                          title="Restablecer todos los atajos al perfil original de ProPresenter"
                        >
                          Restablecer
                        </button>
                      </div>
                    </div>

                    <div className="shortcuts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
                      <div className="shortcut-field">
                        <label>Siguiente Diapositiva:</label>
                        <input
                          type="text"
                          value={tempShortcuts.nextSlide || 'ArrowRight'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, nextSlide: e.target.value, profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Anterior Diapositiva:</label>
                        <input
                          type="text"
                          value={tempShortcuts.prevSlide || 'ArrowLeft'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, prevSlide: e.target.value, profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Siguiente Ítem Playlist:</label>
                        <input
                          type="text"
                          value={tempShortcuts.nextPlaylistItem || 'ArrowDown'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, nextPlaylistItem: e.target.value, profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Anterior Ítem Playlist:</label>
                        <input
                          type="text"
                          value={tempShortcuts.prevPlaylistItem || 'ArrowUp'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, prevPlaylistItem: e.target.value, profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Pantalla a Negro (Black):</label>
                        <input
                          type="text"
                          value={tempShortcuts.black || 'F1'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, black: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Limpiar Todo (Clear All):</label>
                        <input
                          type="text"
                          value={tempShortcuts.clearAll || tempShortcuts.clear || 'F2'}
                          onChange={(e) =>
                            setTempShortcuts({
                              ...tempShortcuts,
                              clearAll: e.target.value.toUpperCase(),
                              clear: e.target.value.toUpperCase(),
                              profile: 'custom'
                            })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Mostrar Logo:</label>
                        <input
                          type="text"
                          value={tempShortcuts.logo || 'F3'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, logo: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Congelar Salidas (Freeze):</label>
                        <input
                          type="text"
                          value={tempShortcuts.freeze || 'F4'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, freeze: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Limpiar Capa Audio:</label>
                        <input
                          type="text"
                          value={tempShortcuts.clearAudio || 'F5'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, clearAudio: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Limpiar Fondo (Fondo):</label>
                        <input
                          type="text"
                          value={tempShortcuts.clearBackground || 'F6'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, clearBackground: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Limpiar Diapo (Slide):</label>
                        <input
                          type="text"
                          value={tempShortcuts.clearSlide || 'F7'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, clearSlide: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Limpiar Mensaje:</label>
                        <input
                          type="text"
                          value={tempShortcuts.clearMessage || 'F8'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, clearMessage: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Limpiar Medios (Media):</label>
                        <input
                          type="text"
                          value={tempShortcuts.clearMedia || 'F9'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, clearMedia: e.target.value.toUpperCase(), profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Alternar Cajón Medios:</label>
                        <input
                          type="text"
                          value={tempShortcuts.toggleMedia || 'Ctrl+M'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, toggleMedia: e.target.value, profile: 'custom' })
                          }
                        />
                      </div>
                      <div className="shortcut-field">
                        <label>Foco a Búsqueda:</label>
                        <input
                          type="text"
                          value={tempShortcuts.focusSearch || 'Ctrl+F'}
                          onChange={(e) =>
                            setTempShortcuts({ ...tempShortcuts, focusSearch: e.target.value, profile: 'custom' })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    9. DATOS Y RESPALDO
                    ========================================================= */}
                {settingsCategory === 'data' && (
                  <>
                    {/* User Workspace & Auto-created Category Folders */}
                    <div className="settings-section">
                      <h3>Carpeta de Medios y Biblioteca (Workspace)</h3>
                      <p className="section-note">
                        ChurchPresenter crea y organiza automáticamente las subcarpetas de todas las secciones (Videos, Imágenes, Audios, Cuentas Regresivas, Presentaciones, Documentos PDF, Canciones, Biblias, Cultos y Copias de Seguridad). Puede colocar esta carpeta en sus Documentos o en cualquier otra unidad de disco de su preferencia.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="text"
                            readOnly
                            value={workspacePath || 'Cargando ubicación...'}
                            style={{
                              flex: 1,
                              padding: '7px 10px',
                              background: '#1e2229',
                              border: '1px solid #334155',
                              borderRadius: 4,
                              color: '#f8fafc',
                              fontSize: 12,
                              fontFamily: 'monospace'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            className="secondary-action-btn"
                            onClick={async () => {
                              const res = await window.churchPresenterApi.chooseWorkspaceFolder?.()
                              if (res) {
                                setWorkspacePath(res.rootPath)
                              }
                            }}
                          >
                            <span>Cambiar Carpeta...</span>
                          </button>
                          <button
                            className="secondary-action-btn"
                            onClick={() => {
                              window.churchPresenterApi.openWorkspaceFolder?.()
                            }}
                          >
                            <span>Abrir en Explorador de Windows</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Copias de Seguridad Automáticas */}
                    <div className="settings-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <h3>Copias de Seguridad y Respaldo</h3>
                          <p className="section-note" style={{ margin: 0 }}>
                            El sistema genera copias de seguridad de la base de datos SQLite rotativas y periódicas con verificación SHA-256.
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            className="secondary-action-btn"
                            onClick={() => window.churchPresenterApi.openBackupsFolder()}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                          >
                            <FolderOpen size={14} />
                            <span>Abrir Carpeta de Backups</span>
                          </button>
                          <button
                            type="button"
                            className="secondary-action-btn"
                            onClick={() => setIsSecondaryBackupModalOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                          >
                            <HardDrive size={14} />
                            <span>Respaldos en USB / Disco Externo...</span>
                          </button>
                          <button
                            type="button"
                            className="secondary-action-btn"
                            onClick={() => setIsLibrarySyncModalOpen(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                          >
                            <Database size={14} />
                            <span>Sincronización de Biblioteca...</span>
                          </button>
                        </div>
                      </div>
                    </div>

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
                  </>
                )}

                {/* =========================================================
                    10. APARIENCIA
                    ========================================================= */}
                {settingsCategory === 'appearance' && (
                  <div className="settings-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <h3>Apariencia y Paleta ProPresenter</h3>
                        <p className="section-note" style={{ margin: 0 }}>
                          Paleta oscura profesional con contraste WCAG AA. Personalice los colores de acento principales del operador.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="secondary-action-btn"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => {
                          setAccentPrimary('#FF7A00')
                          setAccentLive('#22C55E')
                          setAccentPreview('#2D9CFF')
                          setAccentDanger('#EF4444')
                        }}
                        title="Restablecer paleta a valores predeterminados de ProPresenter"
                      >
                        Restablecer Colores
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 10 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Acento Primario (Naranja Pro):</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <input
                            type="color"
                            value={accentPrimary}
                            onChange={(e) => setAccentPrimary(e.target.value)}
                            style={{ width: 36, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{accentPrimary}</span>
                        </div>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>En Vivo (Verde Pro):</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <input
                            type="color"
                            value={accentLive}
                            onChange={(e) => setAccentLive(e.target.value)}
                            style={{ width: 36, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{accentLive}</span>
                        </div>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Vista Previa (Azul Pro):</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <input
                            type="color"
                            value={accentPreview}
                            onChange={(e) => setAccentPreview(e.target.value)}
                            style={{ width: 36, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{accentPreview}</span>
                        </div>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Peligro / Salida Desconectada:</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <input
                            type="color"
                            value={accentDanger}
                            onChange={(e) => setAccentDanger(e.target.value)}
                            style={{ width: 36, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{accentDanger}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* =========================================================
                    11. AVANZADO
                    ========================================================= */}
                {settingsCategory === 'advanced' && (
                  <>
                    {/* Requirement 1: YouTube Session & Privacy */}
                    <div className="settings-section">
                      <h3>Sesión y Privacidad de YouTube</h3>
                      <p className="section-note">
                        La sesión de YouTube se almacena de forma aislada en la partición persistente <code>persist:youtube</code>. La aplicación nunca lee ni guarda sus contraseñas.
                      </p>
                      <div style={{ marginTop: 8 }}>
                        <button
                          className="secondary-action-btn"
                          style={{ borderColor: '#f59e0b', color: '#fbbf24' }}
                          onClick={async () => {
                            if (confirm('¿Desea cerrar la sesión y borrar todas las cookies y almacenamiento de YouTube?')) {
                              await window.churchPresenterApi.clearYouTubeSession()
                              alert('Sesión de YouTube cerrada y datos borrados con éxito.')
                            }
                          }}
                        >
                          <span>Cerrar sesión / borrar datos de YouTube</span>
                        </button>
                      </div>
                    </div>

                    {/* Requirement A.6: Información del Entorno y Copia de Biblioteca */}
                    <div className="settings-section">
                      <h3>Entorno de Desarrollo y Datos</h3>
                      <p className="section-note">
                        Herramientas avanzadas para pruebas seguras con datos reales sin alterar la producción.
                      </p>
                      {isDev ? (
                        <div style={{ marginTop: 8 }}>
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
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <Copy size={13} />
                            <span>Copiar Biblioteca Real a Desarrollo</span>
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          Modo Producción activo. Las herramientas de clonación de desarrollo están restringidas.
                        </div>
                      )}
                    </div>

                    {/* Diagnóstico y Herramientas del Sistema */}
                    <div className="settings-section">
                      <h3>Diagnóstico y Herramientas del Sistema</h3>
                      <p className="section-note">
                        Verifique el rendimiento de hardware, logs de depuración, checklists de culto y ensayos.
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => setIsDiagnosticsModalOpen(true)}
                          style={{ fontSize: 12 }}
                        >
                          <span>Diagnóstico del Sistema y Logs...</span>
                        </button>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => setIsChecklistModalOpen(true)}
                          style={{ fontSize: 12 }}
                        >
                          <span>Lista de Verificación (Checklist)...</span>
                        </button>
                        <button
                          type="button"
                          className="secondary-action-btn"
                          onClick={() => setIsRehearsalSummaryModalOpen(true)}
                          style={{ fontSize: 12 }}
                        >
                          <span>Resumen de Ensayo...</span>
                        </button>
                      </div>
                    </div>
                  </>
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
                  await window.churchPresenterApi.saveChurchBranding?.(tempChurchBranding)
                  setChurchBranding(tempChurchBranding)
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
      {isImportingPpt && (
        <div className="modal-backdrop" style={{ zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#181818', padding: '24px 32px', borderRadius: 8, border: '1px solid #333', textAlign: 'center' }}>
            <div style={{ color: '#FF7A00', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Importando Presentación PowerPoint...</div>
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Convirtiendo diapositivas de alta resolución, por favor espere.</div>
          </div>
        </div>
      )}

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

              <div style={{ marginTop: 12, padding: 8, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 3 }}>
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
          THEMES MANAGER PRO MODAL
          ========================================================= */}
      <ThemeManagerModal
        isOpen={isThemesModalOpen}
        onClose={() => setIsThemesModalOpen(false)}
        onThemeSaved={async () => {
          const updatedThemes = await window.churchPresenterApi.getThemes()
          setThemes(updatedThemes)
          const updatedDefs = await window.churchPresenterApi.getTypeDefaultThemes?.()
          if (updatedDefs) {
            setTypeDefaults(updatedDefs)
            if (updatedDefs.bible) setCurrentBibleThemeId(updatedDefs.bible)
          }
        }}
      />

      {/* =========================================================
          MESSAGE MODAL (Phase 6)
          ========================================================= */}
      <MessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        activeMessage={state?.activeMessage}
      />

      {/* =========================================================
          STAGE LAYOUT EDITOR MODAL (Phase 6)
          ========================================================= */}
      <StageLayoutEditorModal
        isOpen={isStageLayoutModalOpen}
        onClose={() => setIsStageLayoutModalOpen(false)}
        onAssignedChange={loadAllData}
      />

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
                    <img src={toMediaUrl(bg.url || bg.filePath)} alt={bg.name} className="bg-thumbnail" />
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

      {/* YouTube Playlist Pre-Service Verification Modal */}
      <YouTubeVerifyModal
        isOpen={isYouTubeVerifyOpen}
        items={currentService?.items || []}
        onClose={() => setIsYouTubeVerifyOpen(false)}
      />

      {/* =========================================================
          PHASE 7: STABILITY & SAFE OPERATION MODALS
          ========================================================= */}
      {/* 1. Session Crash Recovery Modal */}
      <SessionRecoveryModal
        isOpen={isRecoveryModalOpen}
        snapshot={recoverySnapshot}
        onResume={handleResumeSession}
        onDismiss={handleDismissSession}
      />

      {/* 2. Pre-Service Checklist Modal */}
      <ChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => setIsChecklistModalOpen(false)}
        activePlan={currentService}
        onOpenDisplaysModal={() => setIsDisplaysModalOpen(true)}
        onOpenBibleManager={() => setIsBibleManagerModalOpen(true)}
      />

      {/* 3. Diagnostics & Log Viewer Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
      />

      {/* 4. Output Health & Incidents Modal */}
      <OutputHealthModal
        isOpen={isOutputHealthModalOpen}
        onClose={() => setIsOutputHealthModalOpen(false)}
        onOpenDisplaysModal={() => setIsDisplaysModalOpen(true)}
      />

      {/* 5. Rehearsal Summary Modal */}
      <RehearsalSummaryModal
        isOpen={isRehearsalSummaryModalOpen}
        summary={rehearsalSummary}
        onClose={() => setIsRehearsalSummaryModalOpen(false)}
      />

      {/* =========================================================
          PHASE 8: AUTOMATION, MACROS & PROPS MODALS
          ========================================================= */}
      {/* 1. Macro Editor Modal */}
      {isMacroEditorOpen && (
        <MacroEditorModal
          macro={editingMacro}
          timers={presentationTimers}
          propsList={propsList}
          allMacros={macros}
          onSave={handleSaveMacro}
          onClose={() => setIsMacroEditorOpen(false)}
        />
      )}

      {/* 2. Prop Editor Modal */}
      {isPropEditorOpen && (
        <PropEditorModal
          prop={editingProp}
          onSave={handleSaveProp}
          onClose={() => setIsPropEditorOpen(false)}
        />
      )}

      {/* =========================================================
          PHASE 9: BROADCAST & OBS BRIDGE MODALS
          ========================================================= */}
      <BroadcastSettingsModal
        isOpen={isBroadcastSettingsOpen}
        onClose={() => setIsBroadcastSettingsOpen(false)}
        onOpenObsBridge={() => setIsObsBridgeOpen(true)}
      />

      <ObsBridgeModal
        isOpen={isObsBridgeOpen}
        onClose={() => setIsObsBridgeOpen(false)}
        remotePort={remoteStatus?.port || 8080}
      />

      {/* =========================================================
          PHASE 10: EXTRAS MODALS (Sync, Import, CCLI, Subtitles, AI, Backups)
          ========================================================= */}
      <SongImportModal
        isOpen={isSongImportModalOpen}
        onClose={() => setIsSongImportModalOpen(false)}
        libraries={userLibraries}
        onImportComplete={() => {
          loadAllData()
        }}
      />

      <SongUsageReportModal
        isOpen={isSongUsageModalOpen}
        onClose={() => setIsSongUsageModalOpen(false)}
      />

      <LibrarySyncModal
        isOpen={isLibrarySyncModalOpen}
        onClose={() => setIsLibrarySyncModalOpen(false)}
        onSyncCompleted={() => {
          loadAllData()
        }}
      />

      <LiveSubtitlesModal
        isOpen={isLiveSubtitlesModalOpen}
        onClose={() => setIsLiveSubtitlesModalOpen(false)}
      />

      <AiAssistantModal
        isOpen={isAiAssistantModalOpen}
        onClose={() => setIsAiAssistantModalOpen(false)}
        onAddToLibrary={(slides) => {
          // Add as a new presentation
          const now = new Date().toISOString()
          const newPresentation: GenericPresentation = {
            id: `pres_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: slides[0]?.title || 'Presentación Generada',
            description: 'Generada por Asistente de IA',
            slides: slides.map((s, idx) => ({
              id: `slide_${idx + 1}`,
              title: s.title,
              body: s.body
            })),
            createdAt: now,
            updatedAt: now
          }
          window.churchPresenterApi.savePresentation(newPresentation).then(() => {
            loadAllData()
            setIsAiAssistantModalOpen(false)
          })
        }}
      />

      <SecondaryBackupModal
        isOpen={isSecondaryBackupModalOpen}
        onClose={() => setIsSecondaryBackupModalOpen(false)}
      />

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
