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
 * Presentation layers for each output.
 */
export interface LayerContent {
  id: string
  title?: string
  body: string
  subtitle?: string
  nextSlideBody?: string // For Stage Monitor (Escenario)
  nextSlideTitle?: string
}

export interface LayerBackground {
  type: 'color' | 'gradient' | 'image'
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

export type ServiceItemType = 'song' | 'presentation' | 'blank' | 'header'

export interface ServiceItem {
  id: string
  type: ServiceItemType
  name: string
  songId?: string
  arrangementId?: string
  presentationId?: string
  notes?: string
}

export interface ServicePlan {
  id: string
  name: string
  date: string
  items: ServiceItem[]
  isTemplate: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Slide resolved and ready for projection / presentation.
 */
export interface SlideItem {
  id: string
  sourceId: string
  sourceType: 'song' | 'presentation' | 'blank'
  groupLabel?: string
  slideIndex: number
  totalSlidesInGroup: number
  title?: string
  body: string
  subtitle?: string
  background?: LayerBackground
}

export interface LibraryExportData {
  version: number
  exportedAt: string
  songs: Song[]
  presentations: GenericPresentation[]
  themes: ThemeConfig[]
  services?: ServicePlan[]
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
  type: 'info' | 'warn' | 'success'
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
  exportLibrary: () => Promise<string> // Returns JSON string or file path
  importLibrary: (jsonData: string) => Promise<{ importedSongs: number; importedPresentations: number }>

  // Diagnostics & Logging
  logFpsDrop: (role: string, fps: number, displayId?: number) => void
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    churchPresenterApi: ChurchPresenterApi
  }
}
