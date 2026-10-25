/**
 * Output roles supported by ChurchPresenter.
 * Easily extensible for future roles (e.g. 'nursery', 'recording', 'confidence').
 */
export type OutputRole = 'operator' | 'main' | 'stage' | 'lobby' | string

export const STANDARD_OUTPUT_ROLES: { id: string; label: string; description: string }[] = [
  { id: 'main', label: 'Sala Principal', description: 'Pantalla de congregación (duplicada por splitter)' },
  { id: 'stage', label: 'Escenario', description: 'Monitor de confianza para músicos y predicador' },
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
  title: string
  body: string
  subtitle?: string
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
 * Global presentation state (Single Source of Truth in Main Process).
 */
export interface PresenterState {
  controls: GlobalControls
  currentSlide: LayerContent | null
  activeLayers: Record<string, OutputLayersState>
  stressTestMode: boolean
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
  sendSlide: (slide: TestSlide, targetRoles?: string[]) => Promise<PresenterState>
  setStressTestMode: (enabled: boolean) => Promise<PresenterState>
  onStateUpdated: (callback: (state: PresenterState) => void) => () => void

  // Shortcuts & Settings
  getShortcuts: () => Promise<AppShortcutsConfig>
  saveShortcuts: (config: AppShortcutsConfig) => Promise<boolean>
  openBackupsFolder: () => Promise<void>
  onNotification: (callback: (notification: AppNotification) => void) => () => void

  // Diagnostics & Logging
  logFpsDrop: (role: string, fps: number, displayId?: number) => void
  getAppVersion: () => Promise<string>
}

declare global {
  interface Window {
    churchPresenterApi: ChurchPresenterApi
  }
}
