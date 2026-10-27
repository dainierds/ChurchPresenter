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
export type ShortcutProfile = 'propresenter' | 'custom'

export interface AppShortcutsConfig {
  black: string // default 'F1'
  clear: string // default 'F2'
  logo: string // default 'F3'
  freeze: string // default 'F4'
  nextSlide: string // default 'ArrowRight'
  prevSlide: string // default 'ArrowLeft'
  nextPlaylistItem: string // default 'ArrowDown'
  prevPlaylistItem: string // default 'ArrowUp'
  clearAudio: string // default 'F5'
  clearBackground: string // default 'F6'
  clearSlide: string // default 'F7'
  clearMessage: string // default 'F8'
  clearMedia: string // default 'F9'
  clearAll: string // default 'F2'
  toggleMedia: string // default 'Ctrl+M'
  focusSearch: string // default 'Ctrl+F'
  profile: ShortcutProfile // default 'propresenter'
  enableGlobalFShortcuts: boolean // default false
}

export const DEFAULT_SHORTCUTS: AppShortcutsConfig = {
  black: 'F1',
  clear: 'F2',
  logo: 'F3',
  freeze: 'F4',
  nextSlide: 'ArrowRight',
  prevSlide: 'ArrowLeft',
  nextPlaylistItem: 'ArrowDown',
  prevPlaylistItem: 'ArrowUp',
  clearAudio: 'F5',
  clearBackground: 'F6',
  clearSlide: 'F7',
  clearMessage: 'F8',
  clearMedia: 'F9',
  clearAll: 'F2',
  toggleMedia: 'Ctrl+M',
  focusSearch: 'Ctrl+F',
  profile: 'propresenter',
  enableGlobalFShortcuts: false
}

export type PanelNaming = 'propresenter' | 'spanish'

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
  themeId?: string
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
  themeId?: string
  isDemo?: boolean
  createdAt: string
  updatedAt: string
}

export type ThemeContentType = 'songs' | 'bible' | 'announcements' | 'messages' | 'timer'

export type TypeDefaultThemesMap = Record<ThemeContentType, string>

export interface CustomFontItem {
  id: string
  name: string
  fileName: string
  format: 'truetype' | 'opentype' | 'woff' | 'woff2'
  filePath: string
  url: string
  createdAt: string
}

export interface ThemeExportOptions {
  themeId: string
  includeFonts?: boolean
  targetPath?: string
}

export interface ThemeImportResult {
  success: boolean
  theme?: ThemeConfig
  warnings?: string[]
  error?: string
}

export interface ThemeConfig {
  id: string
  name: string
  isDefault: boolean
  isBuiltIn?: boolean
  targetContentType?: 'all' | ThemeContentType

  // Typography
  fontFamily: string
  fontSizeVmin: number
  autoFit?: boolean
  slideTransition?: SlideTransitionConfig
  fontWeight?: '300' | '400' | '600' | '700' | 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  color: string
  textTransform?: 'none' | 'uppercase' | 'lowercase'
  lineHeight?: number
  letterSpacing?: number
  alignment: 'left' | 'center' | 'right' | 'justify'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  maxLinesPerSlide?: number

  // Safe Margins
  safeMarginsPercent: {
    top: number
    bottom: number
    left: number
    right: number
  }

  // Outline & Shadow
  outlineColor: string
  outlineWidthPx: number
  outlineBlurPx?: number
  shadowColor: string
  shadowBlurPx: number
  shadowOffsetX?: number
  shadowOffsetY?: number

  // Background & Overlay
  background: LayerBackground
  overlayColor?: string
  overlayOpacity?: number // 0.0 to 1.0

  // Bible-Specific
  bibleRefPosition?: 'top' | 'bottom'
  bibleRefFontSizeVmin?: number
  bibleShowVersionTag?: boolean
  bibleShowVerseNumbers?: boolean

  // Song-Specific
  songShowTitleOnFirstSlide?: boolean
  songShowCopyrightOnLastSlide?: boolean

  // Watermark / Logo
  watermarkUrl?: string
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  watermarkSizePercent?: number
  watermarkOpacity?: number

  roleOverrides?: Record<string, Partial<ThemeConfig>>
}

export const DEFAULT_THEME: ThemeConfig = {
  id: 'default-theme',
  name: 'Predeterminado Carbón Elegante',
  isDefault: true,
  isBuiltIn: true,
  targetContentType: 'all',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSizeVmin: 4.8,
  autoFit: true,
  fontWeight: 'normal',
  fontStyle: 'normal',
  color: '#ffffff',
  textTransform: 'none',
  lineHeight: 1.25,
  letterSpacing: 0,
  outlineColor: '#000000',
  outlineWidthPx: 2,
  outlineBlurPx: 0,
  shadowBlurPx: 12,
  shadowColor: 'rgba(0,0,0,0.85)',
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  alignment: 'center',
  verticalAlign: 'middle',
  maxLinesPerSlide: 4,
  safeMarginsPercent: {
    top: 6,
    bottom: 6,
    left: 8,
    right: 8
  },
  background: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #181818 0%, #242424 100%)'
  },
  overlayColor: '#000000',
  overlayOpacity: 0.25,
  bibleRefPosition: 'bottom',
  bibleRefFontSizeVmin: 3.4,
  bibleShowVersionTag: true,
  bibleShowVerseNumbers: true,
  songShowTitleOnFirstSlide: true,
  songShowCopyrightOnLastSlide: true,
  roleOverrides: {
    stage: {
      fontSizeVmin: 5.5,
      color: '#f97316',
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
  | 'media'
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

export interface YouTubeSyncTick {
  videoId: string
  url: string
  title?: string
  currentTime: number
  duration: number
  isPlaying: boolean
  isBrowserSource: boolean
  timestamp: number
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
  themeId?: string
  videoConfig?: VideoItemConfig
  pdfConfig?: PdfItemConfig
  imageConfig?: ImagePresentationConfig
  powerpointConfig?: { manifestPath?: string; originalPath: string; hash: string }
  youtubeConfig?: YouTubeItemConfig
  macroId?: string
  loopConfig?: LoopConfig
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
export type LibraryItemType =
  | 'song'
  | 'presentation'
  | 'pdf'
  | 'powerpoint'
  | 'video'
  | 'image'
  | 'audio'
  | 'scripture'
  | 'youtube'

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
  remainingSeconds?: number
  isRunning: boolean
  isOverrun?: boolean
  isOvertime?: boolean
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
  contentType?: ThemeContentType
  groupLabel?: string
  slideIndex: number
  totalSlidesInGroup: number
  title?: string
  body: string
  subtitle?: string
  background?: LayerBackground
  themeId?: string
  theme?: ThemeConfig
  mediaUrl?: string
  mediaType?: string
  youtubeId?: string
  youtubeDuration?: number
  pdfPage?: number
  pdfPageCount?: number
  fitMode?: 'contain' | 'cover' | 'center'
  speakerNotes?: string
  nextSlideTitle?: string
  nextSlideBody?: string
  warnings?: string[]
  transition?: SlideTransitionConfig
  macroTrigger?: {
    onEnterMacroId?: string
    onExitMacroId?: string
  }
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

export interface BibleImportResult {
  success: boolean
  translation: BibleTranslationMeta
  bookCount: number
  verseCount: number
  missingBooks: string[]
  sampleVerses: {
    reference: string
    text: string
  }[]
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
  activeMessage?: PresentationMessage | null
  activeStageLayout?: StageLayoutConfig | null
  activeProps?: PropItem[]
  activeLoopStatus?: LoopStatus | null
  disableTransitions?: boolean
  macroExecutionState?: MacroExecutionState | null
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

// =========================================================================
// PHASE 6: Remote Control, Stage Layouts & Messages
// =========================================================================

export interface PresentationMessage {
  id: string
  text: string
  target: 'stage' | 'audience' | 'both'
  durationSeconds?: number
  active: boolean
  createdAt: string
  expiresAt?: string
}

export type StageElementType = 'current-slide' | 'next-slide' | 'clock' | 'timers' | 'messages' | 'notes' | 'video-time'

export interface StageLayoutElement {
  id: string
  type: StageElementType
  x: number // percent 0-100
  y: number // percent 0-100
  width: number // percent 0-100
  height: number // percent 0-100
  visible: boolean
  fontSizeVmin?: number
  fontColor?: string
  fontWeight?: string
  alignment?: 'left' | 'center' | 'right'
  showLabel?: boolean
  label?: string
}

export interface StageLayoutConfig {
  id: string
  name: string
  isBuiltIn: boolean
  backgroundColor: string
  elements: StageLayoutElement[]
}

export interface RemoteServerConfig {
  enabled: boolean
  port: number
  selectedIp: string // '0.0.0.0' or specific IP
  pin: string
  allowReadOnlyWithoutPin: boolean
}

export interface RemoteClientSession {
  id: string
  name: string
  role: 'operator' | 'stage-viewer'
  ip: string
  connectedAt: string
  lastActiveAt: string
}

export interface RemoteNetworkInterface {
  name: string
  ip: string
  isDefault?: boolean
}

export interface RemoteServerAddress {
  interfaceName: string
  ip: string
  url: string
  qrDataUrl: string
  stageUrl?: string
  stageQrDataUrl?: string
}

export interface RemoteServerStatus {
  running: boolean
  port: number
  pin: string
  addresses: RemoteServerAddress[]
  connectedClients: RemoteClientSession[]
  portConflictWarning?: string | null
  isWindowsPublicNetwork?: boolean
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

  // Phase 3 & Complete Theme System
  getThemes: () => Promise<ThemeConfig[]>
  saveTheme: (theme: ThemeConfig) => Promise<ThemeConfig>
  deleteTheme: (id: string, reassignToThemeId?: string) => Promise<{ success: boolean; reassignedCount: number }>
  duplicateTheme: (id: string, newName?: string) => Promise<ThemeConfig>
  setDefaultTheme: (id: string) => Promise<boolean>
  getTypeDefaultThemes: () => Promise<TypeDefaultThemesMap>
  setTypeDefaultTheme: (contentType: ThemeContentType, themeId: string) => Promise<boolean>
  applyThemeToScope: (themeId: string, scope: 'playlist' | 'library' | 'all_songs', playlistId?: string) => Promise<{ affectedItems: number }>
  exportTheme: (themeId: string, targetPath?: string, includeFonts?: boolean) => Promise<{ success: boolean; filePath?: string; error?: string }>
  importThemePackage: (filePath?: string) => Promise<ThemeImportResult>
  uploadThemeBackground: (filePath?: string) => Promise<BackgroundImageItem | null>
  getCustomFonts: () => Promise<CustomFontItem[]>
  importCustomFont: (filePath?: string) => Promise<CustomFontItem | null>
  deleteCustomFont: (id: string) => Promise<boolean>
  onFontsChanged: (callback: (fonts: CustomFontItem[]) => void) => () => void

  // Phase 3: Background Images
  getBackgroundImages: () => Promise<BackgroundImageItem[]>
  importBackgroundImage: (sourcePath: string, name?: string) => Promise<BackgroundImageItem>
  deleteBackgroundImage: (id: string) => Promise<boolean>

  // Phase 3: Services & Templates
  getServices: () => Promise<ServicePlan[]>
  saveService: (service: ServicePlan) => Promise<ServicePlan>
  deleteService: (id: string) => Promise<boolean>
  duplicateService: (serviceId: string) => Promise<ServicePlan>
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
    format: 'zefania' | 'osis' | 'usfm' | 'json' | 'sqlite',
    rawContent: string,
    meta: Partial<BibleTranslationMeta>
  ) => Promise<BibleImportResult>
  importBibleFile: (
    filePath: string,
    metaOverrides?: Partial<BibleTranslationMeta>
  ) => Promise<BibleImportResult>
  deleteBibleTranslation: (id: string) => Promise<boolean>
  setBibleDefault: (abbrev: string) => Promise<boolean>
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
  detectPowerPointConverters?: () => Promise<PptConverterInfo[]>
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
  renameLibrary: (libraryId: string, newName: string) => Promise<boolean>
  reorderLibraries: (orderedIds: string[]) => Promise<boolean>
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
  setYouTubeBrowserVisible: (visible: boolean) => Promise<boolean>
  clearYouTubeSession: () => Promise<boolean>
  controlYouTube: (
    action: 'prepare' | 'go-live' | 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'mute' | 'status',
    payload?: any
  ) => Promise<any>
  downloadYouTubeVideo: (youtubeUrl: string) => Promise<{ success: boolean; item?: MediaItem; error?: string }>
  onYouTubeAdStatus: (callback: (isAd: boolean) => void) => () => void
  onYouTubeSyncTick: (callback: (tick: YouTubeSyncTick) => void) => () => void

  // Diagnostics & Logging
  logFpsDrop: (role: string, fps: number, displayId?: number) => void
  logMediaError: (role: string, url: string, message: string) => void
  captureOutputWindow: (role: string) => Promise<Buffer | null>
  openPreviewOutputWindow: (role: string) => Promise<boolean>
  closeOutputWindow: (role: string) => Promise<boolean>
  getAppVersion: () => Promise<string>
  getEnvInfo: () => Promise<{ isDev: boolean; version: string; userDataPath: string }>
  copyProdLibraryToDev: () => Promise<{ success: boolean; message: string }>

  // Floating Output Preview Window (Requirement 3)
  openFloatingPreview: (initialRole?: string) => Promise<boolean>
  setFloatingPreviewAlwaysOnTop: (alwaysOnTop: boolean) => Promise<boolean>
  closeFloatingPreview: () => Promise<boolean>

  // Phase 6: Remote Control
  getRemoteConfig: () => Promise<RemoteServerConfig>
  remoteGetConfig?: () => Promise<RemoteServerConfig>
  saveRemoteConfig: (config: Partial<RemoteServerConfig>) => Promise<RemoteServerConfig>
  remoteSaveConfig?: (config: Partial<RemoteServerConfig>) => Promise<RemoteServerConfig>
  getRemoteStatus: () => Promise<RemoteServerStatus>
  remoteGetStatus?: () => Promise<RemoteServerStatus>
  regenerateRemotePin: () => Promise<string>
  remoteRegeneratePin?: () => Promise<string>
  kickRemoteClient: (clientId: string) => Promise<boolean>
  remoteKickClient?: (clientId: string) => Promise<boolean>
  getNetworkInterfaces: () => Promise<RemoteNetworkInterface[]>
  onRemoteActionDispatch?: (callback: (action: { type: string; payload?: any }) => void) => () => void

  // Phase 6: Stage Layouts
  getStageLayouts: () => Promise<StageLayoutConfig[]>
  saveStageLayout: (layout: StageLayoutConfig) => Promise<StageLayoutConfig>
  deleteStageLayout: (layoutId: string) => Promise<boolean>
  getAssignedStageLayout: (role?: string) => Promise<StageLayoutConfig>
  setAssignedStageLayout: (layoutId: string, role?: string) => Promise<boolean>

  // Phase 6: Messages
  getActiveMessage: () => Promise<PresentationMessage | null>
  sendMessage: (message: { text: string; target: 'stage' | 'audience' | 'both'; durationSeconds?: number }) => Promise<PresentationMessage>
  clearMessage: () => Promise<boolean>
  getMessagePresets: () => Promise<string[]>
  saveMessagePreset: (text: string) => Promise<string[]>
  deleteMessagePreset: (text: string) => Promise<string[]>

  // Phase 7: Stability, Diagnostics, Checklist & Rehearsal
  checkSessionRecovery: () => Promise<SessionRecoveryCheckResult>
  dismissSessionRecovery: () => Promise<boolean>
  getSessionRecoverySnapshot: () => Promise<SessionSnapshot | null>
  getOutputHealthStatuses: () => Promise<Record<string, OutputHealthStatus>>
  onOutputHealthChanged?: (callback: (statuses: Record<string, OutputHealthStatus>) => void) => () => void
  sendOutputHeartbeat: (heartbeat: { role: string; fps: number; timestamp: number; lastError?: string }) => void
  getSystemMetrics: () => Promise<SystemMetrics>
  onSystemMetricsTick?: (callback: (metrics: SystemMetrics) => void) => () => void
  runPreServiceChecklist: (plan?: ServicePlan | null) => Promise<ServiceChecklistResult>
  fixChecklistItem?: (itemId: string, actionType: string) => Promise<boolean>
  getDiagnosticsLogs: (options?: { filterLevel?: string; query?: string; limit?: number }) => Promise<LogEntry[]>
  exportDiagnosticsZip: () => Promise<{ success: boolean; filePath?: string; error?: string }>
  setRehearsalMode: (enabled: boolean) => Promise<boolean>
  getRehearsalStatus: () => Promise<{ active: boolean; sessionStartedAt?: number; incidentsCount: number }>
  getRehearsalSummary: () => Promise<RehearsalSummary | null>
  onRehearsalModeChanged?: (callback: (active: boolean) => void) => () => void
  activateEmergencyMode: () => Promise<boolean>
  deactivateEmergencyMode: () => Promise<boolean>
  isEmergencyModeActive: () => Promise<boolean>
  isSafeModeActive: () => Promise<boolean>

  // Phase 8: Automation, Macros, Props, Loops & Transitions
  getMacros: () => Promise<MacroItem[]>
  saveMacro: (macro: MacroItem) => Promise<MacroItem>
  deleteMacro: (id: string) => Promise<boolean>
  duplicateMacro: (id: string) => Promise<MacroItem>
  runMacro: (id: string) => Promise<{ success: boolean; error?: string }>
  runMacroStep: (id: string, actionIndex: number) => Promise<{ success: boolean; error?: string }>
  stopAllMacros: () => Promise<boolean>
  getMacroExecutionState: () => Promise<MacroExecutionState>
  onMacroStatusChanged?: (callback: (state: MacroExecutionState) => void) => () => void

  getProps: () => Promise<PropItem[]>
  saveProp: (prop: PropItem) => Promise<PropItem>
  deleteProp: (id: string) => Promise<boolean>
  toggleProp: (id: string, active?: boolean) => Promise<PropItem>
  getActiveProps: () => Promise<PropItem[]>
  onPropsActiveChanged?: (callback: (props: PropItem[]) => void) => () => void

  startPresentationLoop: (config: LoopConfig, totalSlides: number) => Promise<boolean>
  stopPresentationLoop: () => Promise<boolean>
  getLoopStatus: () => Promise<LoopStatus | null>
  onLoopStatusChanged?: (callback: (status: LoopStatus | null) => void) => () => void

  getMidiInputs: () => Promise<Array<{ id: string; name: string; manufacturer?: string }>>
  triggerMidiMessage?: (message: { type: 'note_on' | 'control_change'; channel: number; number: number; value: number }) => Promise<void>

  // Phase 9: OBS Studio Integration
  getObsConfig: () => Promise<ObsConfig>
  saveObsConfig: (config: Partial<ObsConfig>) => Promise<ObsConfig>
  connectObs: (overrideOptions?: { host?: string; port?: number; password?: string }) => Promise<{ success: boolean; error?: string }>
  disconnectObs: () => Promise<{ success: boolean }>
  getObsStatus: () => Promise<ObsStatus>
  getObsScenes: () => Promise<string[]>
  setObsScene: (sceneName: string) => Promise<{ success: boolean; error?: string }>
  startObsStream: () => Promise<{ success: boolean; error?: string }>
  stopObsStream: () => Promise<{ success: boolean; error?: string }>
  startObsRecord: () => Promise<{ success: boolean; error?: string }>
  stopObsRecord: () => Promise<{ success: boolean; error?: string }>
  onObsStatusChanged?: (callback: (status: ObsStatus) => void) => () => void

  // Phase 9: Broadcast Studio, Streaming & Recording
  getBroadcastSettings: () => Promise<BroadcastSettings>
  saveBroadcastSettings: (settings: Partial<BroadcastSettings>) => Promise<BroadcastSettings>
  getBroadcastScenes: () => Promise<BroadcastScene[]>
  saveBroadcastScene: (scene: BroadcastScene) => Promise<BroadcastScene>
  deleteBroadcastScene: (id: string) => Promise<boolean>
  getAudioMixerConfig: () => Promise<BroadcastAudioMixerState>
  saveAudioMixerConfig: (state: BroadcastAudioMixerState) => Promise<BroadcastAudioMixerState>
  getBroadcastStatus: () => Promise<BroadcastStatus>
  startBroadcastStream: () => Promise<{ success: boolean; error?: string }>
  stopBroadcastStream: () => Promise<{ success: boolean; error?: string }>
  startBroadcastRecord: () => Promise<{ success: boolean; error?: string }>
  stopBroadcastRecord: () => Promise<{ success: boolean; error?: string }>
  onBroadcastStatusChanged?: (callback: (status: BroadcastStatus) => void) => () => void
  listDesktopSources: () => Promise<DesktopCaptureSource[]>
}

// =========================================================================
// PHASE 7: Stability, System Monitor, Checklist, Diagnostics & Rehearsal
// =========================================================================

export interface SessionSnapshot {
  activePlanId?: string | null
  activePlanTitle?: string | null
  activeItemIndex: number
  activeSlideIndex: number
  currentSlide: LayerContent | null
  activeLayers: Record<string, OutputLayersState>
  controls: GlobalControls
  timers: PresentationTimer[]
  videoPosition?: {
    mediaUrl?: string
    currentTime: number
    isPlaying: boolean
  }
  timestamp: number
  cleanShutdown: boolean
}

export interface SessionRecoveryCheckResult {
  hasPendingRecovery: boolean
  snapshot: SessionSnapshot | null
}

export interface OutputIncident {
  timestamp: number
  type: 'crash' | 'disconnect' | 'fps_drop' | 'recreation' | 'error'
  details: string
}

export interface OutputHealthStatus {
  role: string
  displayConnected: boolean
  windowAlive: boolean
  fps: number
  lastFrameTimestamp: number
  memoryUsageMb: number
  recentErrors: Array<{ timestamp: number; message: string }>
  incidents: OutputIncident[]
  status: 'healthy' | 'warning' | 'error'
}

export interface SystemMetrics {
  cpuPercent: number
  memory: {
    totalMb: number
    freeMb: number
    usedMb: number
    percentUsed: number
  }
  disk: {
    totalGb: number
    freeGb: number
    usedGb: number
    percentUsed: number
  }
  gpu: {
    featureStatus: any
    info?: string
  }
  alerts: Array<{
    id: string
    type: 'memory' | 'disk' | 'cpu'
    level: 'warning' | 'critical'
    message: string
  }>
  timestamp: number
}

export type ChecklistStatus = 'ok' | 'warning' | 'error'

export interface ChecklistItem {
  id: string
  category: 'media' | 'fonts' | 'youtube' | 'powerpoint' | 'bible' | 'displays' | 'audio' | 'disk' | 'backup'
  title: string
  status: ChecklistStatus
  details: string
  actionType?: 'reconnect_display' | 'convert_powerpoint' | 'import_bible' | 'create_backup' | 'refresh' | string
  actionLabel?: string
}

export interface ServiceChecklistResult {
  overallStatus: ChecklistStatus
  checkedAt: number
  items: ChecklistItem[]
  summary: {
    total: number
    ok: number
    warning: number
    error: number
  }
}

export interface RehearsalSummary {
  startedAt: number
  endedAt: number
  durationSeconds: number
  slidesCount: number
  mediaPlaysCount: number
  incidentsCount: number
  incidents: Array<{ timestamp: number; message: string }>
  logFilePath: string
}

export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

// =========================================================================
// PHASE 8: Automation, Macros, Props, Loops & Transitions
// =========================================================================

export type SlideTransitionType = 'cut' | 'fade' | 'slide_left' | 'slide_right' | 'slide_up'

export interface SlideTransitionConfig {
  type: SlideTransitionType
  durationMs: number
}

export type MacroActionType =
  | 'go_to_item_slide'
  | 'clear_layer'
  | 'emergency_control'
  | 'timer_control'
  | 'media_control'
  | 'play_audio_track'
  | 'display_message'
  | 'prop_control'
  | 'set_output_theme'
  | 'delay'
  | 'trigger_macro'
  | 'external_command'
  | 'obs_control'
  | 'broadcast_control'

export interface MacroActionParams {
  itemId?: string
  slideIndex?: number
  relative?: 'next_slide' | 'prev_slide' | 'next_item' | 'prev_item' | 'specific'
  layer?: 'all' | 'slide' | 'background' | 'audio' | 'message' | 'media' | 'props'
  emergencyType?: 'black' | 'logo' | 'freeze'
  active?: boolean
  timerId?: string
  timerAction?: 'start' | 'pause' | 'reset'
  mediaAction?: 'play' | 'pause' | 'stop' | 'seek'
  seekSeconds?: number
  audioPath?: string
  fadeInSeconds?: number
  volume?: number
  loop?: boolean
  messageAction?: 'show' | 'hide'
  messageText?: string
  targetRole?: OutputRole | 'all'
  propId?: string
  propAction?: 'show' | 'hide' | 'toggle'
  role?: OutputRole
  themeId?: string
  seconds?: number
  targetMacroId?: string
  command?: string
  args?: string[]
  obsAction?: 'change_scene' | 'start_stream' | 'stop_stream' | 'start_record' | 'stop_record'
  obsSceneName?: string
  broadcastAction?: 'start_stream' | 'stop_stream' | 'start_record' | 'stop_record' | 'switch_scene'
  broadcastSceneId?: string
}

export interface ObsConfig {
  host: string
  port: number
  password?: string
  passwordEncrypted?: string
  autoConnect: boolean
}

export interface ObsStatus {
  connected: boolean
  streaming: boolean
  recording: boolean
  currentScene: string
  scenes: string[]
  streamTimecode?: string
  recordTimecode?: string
  fps?: number
  kbitsPerSec?: number
  error?: string
}

export interface MacroAction {
  id: string
  type: MacroActionType
  label?: string
  delayBeforeMs?: number
  delayAfterMs?: number
  params: MacroActionParams
}

export interface MacroMidiTrigger {
  enabled: boolean
  type: 'note_on' | 'control_change'
  channel: number // 1-16
  number: number // Note or CC number (0-127)
  value?: number
}

export interface MacroScheduleTrigger {
  enabled: boolean
  type: 'daily' | 'weekly'
  time: string // "HH:MM" 24h
  daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc.
}

export interface MacroItem {
  id: string
  name: string
  color: string
  icon: string
  description?: string
  shortcut?: string
  midiTrigger?: MacroMidiTrigger
  scheduleTrigger?: MacroScheduleTrigger
  actions: MacroAction[]
  isBuiltIn?: boolean
  createdAt: string
  updatedAt: string
}

export interface MacroExecutionState {
  activeMacros: Array<{
    macroId: string
    macroName: string
    startedAt: number
    currentActionIndex: number
    totalActions: number
    status: 'running' | 'paused' | 'step_by_step'
  }>
  executionLog: Array<{
    timestamp: number
    macroId: string
    macroName: string
    actionIndex: number
    actionType: string
    status: 'success' | 'failed' | 'skipped'
    error?: string
  }>
}

export type PropType = 'image' | 'text' | 'logo' | 'lower_third' | 'countdown'

export interface PropPosition {
  x: number // percent 0-100
  y: number // percent 0-100
  width: number // percent 0-100
  height: number // percent 0-100
  alignment: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center' | 'custom'
}

export interface PropStyle {
  opacity: number // 0.0 - 1.0
  fontSizeVmin?: number
  fontColor?: string
  backgroundColor?: string
  borderRadiusPx?: number
  paddingPx?: number
}

export interface PropTransition {
  inType: 'cut' | 'fade' | 'slide_up' | 'slide_down' | 'zoom'
  outType: 'cut' | 'fade' | 'slide_up' | 'slide_down' | 'zoom'
  durationMs: number
}

export interface PropItem {
  id: string
  name: string
  type: PropType
  content: {
    text?: string
    subtitle?: string
    imageUrl?: string
    targetTime?: string
    countdownSeconds?: number
  }
  position: PropPosition
  style: PropStyle
  transition: PropTransition
  targetRoles: OutputRole[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LoopConfig {
  enabled: boolean
  autoAdvanceSeconds: number
  loop: boolean
  shuffle: boolean
  backgroundMusicPath?: string
  backgroundMusicVolume?: number
}

export interface LoopStatus {
  isActive: boolean
  currentSlideIndex: number
  totalSlides: number
  autoAdvanceSeconds: number
  nextAdvanceInSeconds: number
  isPaused: boolean
  hasMusic: boolean
}

// =========================================================================
// PHASE 9: Streaming, Recording & Studio Broadcast
// =========================================================================

export type BroadcastSourceType =
  | 'video_device'
  | 'desktop_capture'
  | 'presentation'
  | 'media_file'
  | 'color'

export interface BroadcastLayer {
  id: string
  name: string
  type: BroadcastSourceType
  deviceId?: string
  sourceId?: string
  mediaPath?: string
  color?: string
  x: number
  y: number
  width: number
  height: number
  crop?: { top: number; right: number; bottom: number; left: number }
  opacity: number
  zIndex: number
  borderRadius?: number
  visible: boolean
}

export interface BroadcastScene {
  id: string
  name: string
  orderIndex: number
  layers: BroadcastLayer[]
  isDefault?: boolean
  transitionType?: 'cut' | 'fade'
  transitionDurationMs?: number
}

export interface BroadcastAudioSource {
  id: string
  name: string
  deviceId?: string
  type: 'presentation' | 'mic_input' | 'aux_input' | 'media'
  volume: number
  muted: boolean
  delayMs: number
}

export interface BroadcastAudioMixerState {
  sources: BroadcastAudioSource[]
  masterVolume: number
  masterMuted: boolean
  limiterEnabled: boolean
}

export interface BroadcastSettings {
  rtmpUrl: string
  rtmpKeyEncrypted?: string
  rtmpKey?: string
  qualityPreset: '1080p30' | '720p30' | '1080p60'
  recordLocal: boolean
  recordingFormat: 'mp4' | 'mkv'
  recordingPath?: string
  autoReconnect: boolean
  encoderPreference: 'nvenc' | 'x264'
  audioDelayMs: number
}

export interface BroadcastStatus {
  isStreaming: boolean
  isRecording: boolean
  durationSeconds: number
  formattedTime: string
  bitrateKbps: number
  fps: number
  droppedFrames: number
  totalFrames: number
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  errorMessage?: string
  currentSceneId?: string
  activePreset: string
  encoderUsed: 'nvenc' | 'x264' | 'none'
  recordingFilePath?: string
}

export interface DesktopCaptureSource {
  id: string
  name: string
  thumbnailDataUrl?: string
}

declare global {
  interface Window {
    churchPresenterApi: ChurchPresenterApi
  }
}
