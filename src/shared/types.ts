/**
 * Output roles supported by ChurchPresenter.
 * Easily extensible for future roles (e.g. 'nursery', 'recording', 'confidence').
 */
export type OutputRole = 'operator' | 'main' | 'stage' | 'lobby' | string

export const STANDARD_OUTPUT_ROLES: { id: string; label: string; description: string }[] = [
  { id: 'main', label: 'Sala Principal', description: 'Pantalla de congregación (duplicada por splitter)' },
  { id: 'stage', label: 'Escenario', description: 'Monitor de confianza con diapositiva actual y siguiente' },
  { id: 'lobby', label: 'Vestíbulo / Lobby', description: 'Pantalla de bienvenida y avisos generales' }
]

/**
 * Normalized physical display information from Electron Screen API,
 * enriched with a deterministic stableId.
 */
export interface DisplayInfo {
  id: number
  stableId: string
  name: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  workArea: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
  isPrimary: boolean
  isInternal?: boolean
}

/**
 * Mapping between an output role and stable display ID (null means unassigned).
 */
export type RoleAssignment = Record<string, string | null>

/**
 * Bible translation and layout configuration per output role.
 */
export interface RoleBibleConfig {
  role: OutputRole
  mode: 'single' | 'stacked' | 'sideBySide'
  primaryTranslation: string
  secondaryTranslation?: string
}

export type RoleBibleConfigsMap = Record<string, RoleBibleConfig>

export const DEFAULT_ROLE_BIBLE_CONFIGS: RoleBibleConfigsMap = {
  main: { role: 'main', mode: 'single', primaryTranslation: 'RVR1909' },
  lobby: { role: 'lobby', mode: 'single', primaryTranslation: 'RVR1909' },
  stage: { role: 'stage', mode: 'stacked', primaryTranslation: 'RVR1909', secondaryTranslation: 'KJV' }
}

/**
 * Presentation layers for each output.
 */
export interface LayerContent {
  id: string
  title?: string
  body: string
  subtitle?: string
  nextSlideBody?: string // For Stage Monitor (Escenario)
  nextSlideTitle?: string
  mediaUrl?: string
  mediaType?: 'video' | 'image' | 'pdf' | 'powerpoint' | 'youtube'
  pdfPage?: number
  pdfPageCount?: number
  fitMode?: 'contain' | 'cover' | 'center'
  speakerNotes?: string
  warnings?: string[]
  videoPlaying?: boolean
  videoTime?: number
  videoDuration?: number
  youtubeId?: string
  youtubePlaying?: boolean
  youtubeTime?: number
  youtubeDuration?: number
  youtubeAudioMuted?: boolean
  youtubeAvailability?: 'ok' | 'unembeddable' | 'unavailable' | 'requires_auth' | 'offline' | 'checking'
  activeTimer?: {
    id: string
    name: string
    formattedTime: string
    isOverrun?: boolean
  }
}

export interface LayerBackground {
  type: 'color' | 'gradient' | 'image' | 'video'
  value: string
}

export interface LayerOverlay {
  showLogo: boolean
  logoUrl?: string
  text?: string
}

export interface LayerMessage {
  text: string
  visible: boolean
}

export interface OutputLayersState {
  background: LayerBackground
  content: LayerContent | null
  overlay: LayerOverlay
  message: LayerMessage | null
  theme?: ThemeConfig
}

/**
 * Global control states that apply instantaneously across all outputs.
 */
export interface GlobalControls {
  black: boolean
  clear: boolean
  logo: boolean
  freeze: boolean
}

/**
 * Configurable keyboard shortcuts and global toggle.
 */
export interface AppShortcutsConfig {
  black: string // default 'F1'
  clear: string // default 'F2'
  logo: string // default 'F3'
  freeze: string // default 'F4'
  enableGlobalFShortcuts: boolean // default false
}

export const DEFAULT_SHORTCUTS: AppShortcutsConfig = {
  black: 'F1',
  clear: 'F2',
  logo: 'F3',
  freeze: 'F4',
  enableGlobalFShortcuts: false
}

/**
 * Song group section types.
 */
export type SongGroupType =
  | 'verse'
  | 'chorus'
  | 'bridge'
  | 'pre_chorus'
  | 'ending'
  | 'intro'
  | 'interlude'

export interface SongGroup {
  id: string
  songId: string
  groupType: SongGroupType
  groupNumber: number
  label: string
  content: string // lyrics text
  sortOrder: number
}

export interface SongArrangement {
  id: string
  songId: string
  name: string
  groupIds: string[]
  isDefault: boolean
}

export interface Song {
  id: string
  title: string
  author: string
  copyright: string
  ccliNumber?: string
  language: string
  tags: string[]
  groups: SongGroup[]
  arrangements: SongArrangement[]
  linesPerSlide?: number
  isDemo?: boolean
  createdAt: string
  updatedAt: string
}

export interface PresentationSlide {
  id: string
  title?: string
  body: string
  subtitle?: string
  background?: LayerBackground
}

export interface GenericPresentation {
  id: string
  title: string
  description: string
  slides: PresentationSlide[]
  isDemo?: boolean
  createdAt: string
  updatedAt: string
}

export interface ThemeConfig {
  id: string
  name: string
  isDefault: boolean
  fontFamily: string
  fontSizeVmin: number
  color: string
  outlineColor: string
  outlineWidthPx: number
  shadowBlurPx: number
  shadowColor: string
  alignment: 'left' | 'center' | 'right'
  safeMarginsPercent: {
    top: number
    bottom: number
    left: number
    right: number
  }
  background: LayerBackground
  roleOverrides?: Record<string, Partial<ThemeConfig>>
}

export const DEFAULT_THEME: ThemeConfig = {
  id: 'default-theme',
  name: 'Predeterminado Elegante',
  isDefault: true,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSizeVmin: 4.8,
  color: '#ffffff',
  outlineColor: '#000000',
  outlineWidthPx: 2,
  shadowBlurPx: 12,
  shadowColor: 'rgba(0,0,0,0.85)',
  alignment: 'center',
  safeMarginsPercent: {
    top: 6,
    bottom: 6,
    left: 8,
    right: 8
  },
  background: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
  },
  roleOverrides: {
    stage: {
      fontSizeVmin: 5.5,
      color: '#fbbf24',
      alignment: 'left',
      background: {
        type: 'color',
        value: '#000000'
      }
    }
  }
}

export interface BackgroundImageItem {
  id: string
  name: string
  originalFilename: string
  filePath: string
  url?: string
  createdAt: string
}

export type ServiceItemType =
  | 'song'
  | 'presentation'
  | 'blank'
  | 'header'
  | 'scripture'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'image_presentation'
  | 'powerpoint'
  | 'youtube'

export type YouTubeAvailabilityStatus = 'ok' | 'unembeddable' | 'unavailable' | 'requires_auth' | 'offline' | 'checking'

export interface YouTubeItemConfig {
  youtubeId: string
  url: string
  title: string
  channelTitle?: string
  thumbnailUrl?: string
  duration: number // seconds
  inPoint?: number // seconds
  outPoint?: number // seconds
  targetRoles: OutputRole[]
  audioRole: OutputRole
  endAction: 'freeze' | 'background' | 'next'
  availabilityStatus?: YouTubeAvailabilityStatus
}

export interface YouTubeItem {
  id: string
  youtubeId: string
  url: string
  title: string
  channelTitle?: string
  thumbnailUrl?: string
  duration: number
  inPoint?: number
  outPoint?: number
  targetRoles: OutputRole[]
  audioRole: OutputRole
  endAction: 'freeze' | 'background' | 'next'
  availabilityStatus: YouTubeAvailabilityStatus
  createdAt: string
  updatedAt: string
}

export interface ServiceItem {
  id: string
  type: ServiceItemType
  name: string
  songId?: string
  arrangementId?: string
  presentationId?: string
  scriptureRef?: string
  bibleTranslation?: string
  mediaId?: string
  videoConfig?: VideoItemConfig
  pdfConfig?: PdfItemConfig
  imageConfig?: ImagePresentationConfig
  powerpointConfig?: { manifestPath?: string; originalPath: string; hash: string }
  youtubeConfig?: YouTubeItemConfig
  notes?: string
}

export interface VideoItemConfig {
  mediaId: string
  mediaPath: string
  loop: boolean
  volume: number // 0.0 to 1.0
  inPoint?: number // seconds
  outPoint?: number // seconds
  fadeInSeconds?: number
  fadeOutSeconds?: number
  endAction: 'freeze' | 'background' | 'next'
  audioOutputRole?: OutputRole // Role where audio will play unmuted (default: 'main')
}

export interface PdfItemConfig {
  mediaId: string
  mediaPath: string
  pageCount: number
  currentPage: number
  fitMode: 'contain' | 'cover' | 'center'
}

export interface ImagePresentationConfig {
  images: { mediaId: string; filePath: string; name: string }[]
  currentIndex: number
  fitMode: 'contain' | 'cover' | 'center'
}

export type PptConverterType = 'powerpoint_com' | 'libreoffice' | 'manual'

export interface PptConverterInfo {
  type: PptConverterType
  name: string
  isAvailable: boolean
  description: string
  version?: string
}

export interface PptConversionSlide {
  index: number
  imagePath: string
  speakerNotes?: string
  warnings?: string[]
}

export interface PptPresentationManifest {
  id: string
  hash: string
  originalPath: string
  originalName: string
  fileSize: number
  slideCount: number
  targetWidth: number
  targetHeight: number
  converterUsed: PptConverterType
  convertedAt: string
  slides: PptConversionSlide[]
  analysis?: any
  isModifiedExternally?: boolean
}

export interface FfmpegStatus {
  available: boolean
  path: string | null
  version: string | null
}

export type MediaType = 'video' | 'audio' | 'image'

export interface MediaItem {
  id: string
  hash: string
  fileName: string
  originalName: string
  filePath: string
  mediaType: MediaType
  fileSize: number
  duration: number
  width: number
  height: number
  codec?: string
  container?: string
  tags: string[]
  thumbnailPath?: string
  isMissing?: boolean
  createdAt: string
}

export interface MediaSyncTick {
  mediaId: string
  mediaType: 'video' | 'audio'
  filePath: string
  isPlaying: boolean
  currentTime: number
  duration: number
  loop: boolean
  volume: number
  audioOutputRole: OutputRole
  inPoint?: number
  outPoint?: number
  timestamp: number
}

export interface IndependentAudioState {
  isPlaying: boolean
  mediaId: string | null
  filePath: string | null
  title: string | null
  currentTime: number
  duration: number
  volume: number
  isFadingOut: boolean
}

export interface ServicePlan {
  id: string
  name: string
  date: string
  items: ServiceItem[]
  isTemplate: boolean
  isDemo?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * ProPresenter 7 Style Library Collections
 */
export type LibraryItemType = 'song' | 'presentation' | 'pdf' | 'powerpoint' | 'video' | 'image' | 'audio' | 'scripture'

export interface LibraryItemReference {
  id: string
  libraryId: string
  itemType: LibraryItemType
  itemId: string
  name: string
  subtitle?: string
  metadata?: string
  sortOrder: number
  addedAt: string
}

export interface UserLibrary {
  id: string
  name: string
  isSpecial?: boolean // e.g. "Playlist anterior"
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * Timers (Fase 6 adelantada)
 */
export type TimerType = 'countdown_to_time' | 'countdown_duration' | 'stopwatch'

export interface PresentationTimer {
  id: string
  name: string
  type: TimerType
  targetTime?: string // "HH:MM:SS" or "HH:MM"
  durationSeconds: number
  currentSeconds: number
  isRunning: boolean
  isOverrun?: boolean
  showOnStage: boolean
  showOnAudience: boolean
  createdAt: string
  updatedAt: string
}

export interface OpenFileDialogOptions {
  title?: string
  defaultPath?: string
  buttonLabel?: string
  filters?: { name: string; extensions: string[] }[]
  multiSelections?: boolean
}

export interface FileChangedEvent {
  filePath: string
  fileName: string
  type: 'powerpoint' | 'media'
}

/**
 * Slide resolved and ready for projection / presentation.
 */
export interface SlideItem {
  id: string
  sourceId: string
  sourceType: 'song' | 'presentation' | 'blank' | 'scripture' | 'video' | 'pdf' | 'image' | 'powerpoint'
  groupLabel?: string
  slideIndex: number
  totalSlidesInGroup: number
  title?: string
  body: string
  subtitle?: string
  background?: LayerBackground
  mediaUrl?: string
  pdfPage?: number
  pdfPageCount?: number
  fitMode?: 'contain' | 'cover' | 'center'
  speakerNotes?: string
  warnings?: string[]
  scripturePayload?: {
    reference: string
    bookNumber: number
    chapter: number
    verseStart: number
    verseEnd: number
    primaryText: string
    secondaryText?: string
  }
}

export interface LibraryExportData {
  version: number
  exportedAt: string
  songs: Song[]
  presentations: GenericPresentation[]
  themes: ThemeConfig[]
  services?: ServicePlan[]
  media?: MediaItem[]
}

/**
 * Phase 4: Bible Architecture & Types
 */
export interface BibleBook {
  number: number // 1 to 66
  name: string // "Génesis", "Juan"
  englishName: string // "Genesis", "John"
  abbrev: string // "Gén", "Jn"
  testament: 'OT' | 'NT'
  chapterCount: number
}

export interface BibleVerse {
  bookNumber: number
  bookName: string
  chapter: number
  verse: number
  text: string
  translationAbbrev: string
}

export interface BibleTranslationMeta {
  id: string
  name: string
  abbrev: string
  language: string
  copyright: string
  licenseNotice: string
  isPublicDomain: boolean
  verseCount: number
  filePath: string
  isDefault?: boolean
}

export interface BibleReferenceParsed {
  rawInput: string
  bookNumber: number
  bookName: string
  startChapter: number
  startVerse: number
  endChapter: number
  endVerse: number
  isFullChapter: boolean
  formattedReference: string
}

export interface BibleSearchResult {
  bookNumber: number
  bookName: string
  chapter: number
  verse: number
  text: string
  translationAbbrev: string
  highlightedText: string
  formattedReference: string
}

export interface BibleDualConfig {
  primaryAbbrev: string
  secondaryAbbrev?: string
  layout: 'single' | 'stacked' | 'sideBySide'
}

/**
 * Global presentation state (Single Source of Truth in Main Process).
 */
export interface PresenterState {
  controls: GlobalControls
  currentSlide: LayerContent | null
  activeLayers: Record<string, OutputLayersState>
  currentTheme: ThemeConfig
  stressTestMode: boolean
  liveEditingSlideId?: string
  mediaSyncTick?: MediaSyncTick | null
  independentAudio?: IndependentAudioState
  roleBibleConfigs?: RoleBibleConfigsMap
  updatedAt: number
}

/**
 * Test slide definition for operator quick grid.
 */
export interface TestSlide {
  id: string
  title: string
  body: string
  subtitle: string
  background: LayerBackground
}

export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'warn' | 'success' | 'error'
  timestamp: number
}

/**
 * IPC API exposed through Preload contextBridge.
 */
export interface ChurchPresenterApi {
  // Screen management
  getDisplays: () => Promise<DisplayInfo[]>
  getRoleAssignments: () => Promise<RoleAssignment>
  assignRole: (role: string, stableId: string | null) => Promise<boolean>
  identifyDisplays: () => Promise<void>
  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void) => () => void

  // State management
  getState: () => Promise<PresenterState>
  setGlobalControl: (control: keyof GlobalControls, value: boolean) => Promise<PresenterState>
  toggleGlobalControl: (control: keyof GlobalControls) => Promise<PresenterState>
  sendSlide: (slide: TestSlide | SlideItem, targetRoles?: string[], nextSlide?: SlideItem) => Promise<PresenterState>
  setOutputMessage: (role: string, message: string, visible: boolean) => Promise<PresenterState>
  setStressTestMode: (enabled: boolean) => Promise<PresenterState>
  onStateUpdated: (callback: (state: PresenterState) => void) => () => void

  // Shortcuts & Settings
  getShortcuts: () => Promise<AppShortcutsConfig>
  saveShortcuts: (config: AppShortcutsConfig) => Promise<boolean>
  openBackupsFolder: () => Promise<void>
  onNotification: (callback: (notification: AppNotification) => void) => () => void

  // Phase 3: Songs Library
  getSongs: () => Promise<Song[]>
  getSongById: (id: string) => Promise<Song | null>
  saveSong: (song: Song) => Promise<Song>
  deleteSong: (id: string) => Promise<boolean>

  // Phase 3: Generic Presentations
  getPresentations: () => Promise<GenericPresentation[]>
  savePresentation: (presentation: GenericPresentation) => Promise<GenericPresentation>
  deletePresentation: (id: string) => Promise<boolean>

  // Phase 3: Themes
  getThemes: () => Promise<ThemeConfig[]>
  saveTheme: (theme: ThemeConfig) => Promise<ThemeConfig>
  setDefaultTheme: (id: string) => Promise<boolean>

  // Phase 3: Background Images
  getBackgroundImages: () => Promise<BackgroundImageItem[]>
  importBackgroundImage: (sourcePath: string, name?: string) => Promise<BackgroundImageItem>
  deleteBackgroundImage: (id: string) => Promise<boolean>

  // Phase 3: Services & Templates
  getServices: () => Promise<ServicePlan[]>
  saveService: (service: ServicePlan) => Promise<ServicePlan>
  deleteService: (id: string) => Promise<boolean>
  getTemplates: () => Promise<ServicePlan[]>

  // Phase 3: Export & Import
  exportLibrary: (includeMedia?: boolean) => Promise<string> // Returns JSON string or file path
  importLibrary: (jsonData: string) => Promise<{ importedSongs: number; importedPresentations: number }>

  // Demo Data Management
  loadDemoData: () => Promise<{ songsCount: number; servicesCount: number }>
  clearDemoData: () => Promise<{ deletedSongs: number; deletedServices: number }>
  hasDemoData: () => Promise<boolean>

  // Phase 4: Bible
  getBibleTranslations: () => Promise<BibleTranslationMeta[]>
  importBibleTranslation: (
    format: 'zefania' | 'osis' | 'usfm' | 'json',
    rawContent: string,
    meta: Partial<BibleTranslationMeta>
  ) => Promise<BibleTranslationMeta>
  deleteBibleTranslation: (id: string) => Promise<boolean>
  parseBibleReference: (input: string) => Promise<BibleReferenceParsed | null>
  getVersesByReference: (
    reference: string,
    translationAbbrev?: string,
    secondaryAbbrev?: string
  ) => Promise<{ parsed: BibleReferenceParsed; verses: BibleVerse[]; secondaryVerses?: BibleVerse[] }>
  searchBibleText: (
    query: string,
    translationAbbrev?: string,
    filter?: { bookNumber?: number; testament?: 'OT' | 'NT' }
  ) => Promise<BibleSearchResult[]>
  getBibleFavorites: () => Promise<string[]>
  toggleBibleFavorite: (reference: string) => Promise<string[]>
  getBibleRecentHistory: () => Promise<string[]>
  addBibleRecentHistory: (reference: string) => Promise<void>
  generateBibleSlides: (
    verses: BibleVerse[],
    secondaryVerses?: BibleVerse[],
    dualLayout?: 'stacked' | 'sideBySide'
  ) => Promise<SlideItem[]>
  getRoleBibleConfigs: () => Promise<RoleBibleConfigsMap>
  saveRoleBibleConfig: (config: RoleBibleConfig) => Promise<boolean>

  // Phase 5A: Media & PDF
  getMediaItems: (type?: MediaType) => Promise<MediaItem[]>
  importMediaFile: (sourcePath: string, tags?: string[]) => Promise<MediaItem>
  deleteMediaItem: (id: string) => Promise<boolean>
  checkMediaIntegrity: () => Promise<{ missingCount: number; missingIds: string[] }>
  playVideo: (config: VideoItemConfig) => Promise<PresenterState>
  controlVideo: (action: 'play' | 'pause' | 'stop' | 'seek', time?: number) => Promise<void>
  playIndependentAudio: (mediaId: string, filePath: string, title?: string) => Promise<void>
  controlIndependentAudio: (action: 'play' | 'pause' | 'stop' | 'fade-out' | 'volume', value?: number) => Promise<void>
  renderPdfPage: (mediaId: string, pageNumber: number, targetWidth?: number) => Promise<string>
  getPdfPageCount: (mediaId: string) => Promise<number>

  // Phase 5B: PowerPoint & Video Conversion
  detectPptConverters: () => Promise<PptConverterInfo[]>
  importPowerPoint: (filePath: string) => Promise<PptPresentationManifest>
  editInPowerPoint: (filePath: string) => Promise<string>
  checkPowerPointModified: (originalPath: string, recordedHash: string) => Promise<boolean>
  cancelPowerPointJob: (jobId: string) => Promise<boolean>
  detectFfmpeg: () => Promise<FfmpegStatus>
  convertVideoFfmpeg: (jobId: string, inputPath: string, outputPath: string) => Promise<{ success: boolean; outputPath: string }>
  cancelFfmpegJob: (jobId: string) => Promise<boolean>
  importImageFolder: (folderPath: string) => Promise<MediaItem[]>

  // Native Dialogs & File Access
  openFileDialog: (options?: OpenFileDialogOptions) => Promise<string[] | null>
  openFolderDialog: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>
  getPathForFile: (file: File) => string

  // File Watching (External Changes)
  watchFile: (filePath: string, type: 'powerpoint' | 'media') => Promise<boolean>
  unwatchFile: (filePath: string) => Promise<boolean>
  onFileChanged: (callback: (event: FileChangedEvent) => void) => () => void

  // User Libraries (Collections)
  getLibraries: () => Promise<UserLibrary[]>
  getLibraryItems: (libraryId: string) => Promise<LibraryItemReference[]>
  saveLibrary: (library: UserLibrary) => Promise<UserLibrary>
  deleteLibrary: (libraryId: string) => Promise<boolean>
  moveLibraryItem: (itemRefId: string, targetLibraryId: string) => Promise<boolean>

  // Timers
  getTimers: () => Promise<PresentationTimer[]>
  saveTimer: (timer: PresentationTimer) => Promise<PresentationTimer>
  deleteTimer: (timerId: string) => Promise<boolean>
  controlTimer: (timerId: string, action: 'start' | 'pause' | 'reset') => Promise<PresentationTimer>
  onTimersTick: (callback: (timers: PresentationTimer[]) => void) => () => void

  // Phase 5C: YouTube
  getYouTubeItems: () => Promise<YouTubeItem[]>
  saveYouTubeItem: (item: YouTubeItem) => Promise<YouTubeItem>
  deleteYouTubeItem: (id: string) => Promise<boolean>
  checkYouTubeAvailability: (videoIdOrUrl: string) => Promise<YouTubeAvailabilityStatus>
  verifyYouTubePlaylist: (items: ServiceItem[]) => Promise<{
    totalChecked: number
    okCount: number
    failedCount: number
    results: { itemId: string; title: string; videoId: string; status: YouTubeAvailabilityStatus }[]
  }>
  getYouTubeMetadata: (videoIdOrUrl: string) => Promise<{
    videoId: string
    title: string
    channelTitle: string
    thumbnailUrl: string
    duration: number
    availabilityStatus: YouTubeAvailabilityStatus
  }>
  openYouTubeBrowser: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>
  closeYouTubeBrowser: () => Promise<boolean>
  navigateYouTubeBrowser: (action: 'back' | 'forward' | 'home' | 'reload' | 'go', url?: string) => Promise<boolean>
  getYouTubeBrowserUrl: () => Promise<string>
  setYouTubeBrowserBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>
  clearYouTubeSession: () => Promise<boolean>
  controlYouTube: (
    action: 'prepare' | 'go-live' | 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'mute',
    payload?: any
  ) => Promise<any>
  downloadYouTubeVideo: (youtubeUrl: string) => Promise<{ success: boolean; item?: MediaItem; error?: string }>
  onYouTubeAdStatus: (callback: (isAd: boolean) => void) => () => void

  // Diagnostics & Logging
  logFpsDrop: (role: string, fps: number, displayId?: number) => void
  logMediaError: (role: string, url: string, message: string) => void
  captureOutputWindow: (role: string) => Promise<Buffer | null>
  openPreviewOutputWindow: (role: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  getEnvInfo: () => Promise<{ isDev: boolean; version: string; userDataPath: string }>
  copyProdLibraryToDev: () => Promise<{ success: boolean; message: string }>
}

declare global {
  interface Window {
    churchPresenterApi: ChurchPresenterApi
  }
}
