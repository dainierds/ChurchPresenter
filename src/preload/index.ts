import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-events'
import {
  ChurchPresenterApi,
  DisplayInfo,
  GlobalControls,
  PresenterState,
  RoleAssignment,
  TestSlide,
  SlideItem,
  AppShortcutsConfig,
  AppNotification,
  Song,
  GenericPresentation,
  ThemeConfig,
  BackgroundImageItem,
  ServicePlan,
  BibleTranslationMeta,
  BibleReferenceParsed,
  BibleVerse,
  BibleSearchResult,
  RoleBibleConfig,
  RoleBibleConfigsMap,
  MediaType,
  MediaItem,
  VideoItemConfig
} from '../shared/types'

const api: ChurchPresenterApi = {
  // Screen management
  getDisplays: (): Promise<DisplayInfo[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_GET)
  },

  getRoleAssignments: (): Promise<RoleAssignment> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_GET_ASSIGNMENTS)
  },

  assignRole: (role: string, stableId: string | null): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_ASSIGN_ROLE, role, stableId)
  },

  identifyDisplays: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DISPLAYS_IDENTIFY)
  },

  onDisplaysChanged: (callback: (displays: DisplayInfo[]) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, displays: DisplayInfo[]) => {
      callback(displays)
    }
    ipcRenderer.on(IPC_CHANNELS.DISPLAYS_CHANGED, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DISPLAYS_CHANGED, subscription)
    }
  },

  // State management
  getState: (): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_GET)
  },

  setGlobalControl: (control: keyof GlobalControls, value: boolean): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SET_CONTROL, control, value)
  },

  toggleGlobalControl: (control: keyof GlobalControls): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_TOGGLE_CONTROL, control)
  },

  sendSlide: (slide: TestSlide | SlideItem, targetRoles?: string[], nextSlide?: SlideItem): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SEND_SLIDE, slide, targetRoles, nextSlide)
  },

  setOutputMessage: (role: string, message: string, visible: boolean): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SET_MESSAGE, role, message, visible)
  },

  setStressTestMode: (enabled: boolean): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STATE_SET_STRESS_TEST, enabled)
  },

  onStateUpdated: (callback: (state: PresenterState) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, state: PresenterState) => {
      callback(state)
    }
    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATED, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATED, subscription)
    }
  },

  // Shortcuts & Settings
  getShortcuts: (): Promise<AppShortcutsConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_GET)
  },

  saveShortcuts: (config: AppShortcutsConfig): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SHORTCUTS_SAVE, config)
  },

  openBackupsFolder: (): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKUPS_OPEN_FOLDER)
  },

  onNotification: (callback: (notif: AppNotification) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, notif: AppNotification) => {
      callback(notif)
    }
    ipcRenderer.on(IPC_CHANNELS.NOTIFICATION_EMIT, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATION_EMIT, subscription)
    }
  },

  // Phase 3: Songs Library
  getSongs: (): Promise<Song[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SONGS_GET)
  },

  getSongById: (id: string): Promise<Song | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SONGS_GET_BY_ID, id)
  },

  saveSong: (song: Song): Promise<Song> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SONGS_SAVE, song)
  },

  deleteSong: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SONGS_DELETE, id)
  },

  // Phase 3: Presentations
  getPresentations: (): Promise<GenericPresentation[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESENTATIONS_GET)
  },

  savePresentation: (presentation: GenericPresentation): Promise<GenericPresentation> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESENTATIONS_SAVE, presentation)
  },

  deletePresentation: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PRESENTATIONS_DELETE, id)
  },

  // Phase 3: Themes
  getThemes: (): Promise<ThemeConfig[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_GET)
  },

  saveTheme: (theme: ThemeConfig): Promise<ThemeConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_SAVE, theme)
  },

  setDefaultTheme: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_SET_DEFAULT, id)
  },

  // Phase 3: Background Images
  getBackgroundImages: (): Promise<BackgroundImageItem[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKGROUNDS_GET)
  },

  importBackgroundImage: (sourcePath: string, name?: string): Promise<BackgroundImageItem> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKGROUNDS_IMPORT, sourcePath, name)
  },

  deleteBackgroundImage: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BACKGROUNDS_DELETE, id)
  },

  // Phase 3: Services & Templates
  getServices: (): Promise<ServicePlan[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SERVICES_GET)
  },

  saveService: (service: ServicePlan): Promise<ServicePlan> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SERVICES_SAVE, service)
  },

  deleteService: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SERVICES_DELETE, id)
  },

  getTemplates: (): Promise<ServicePlan[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SERVICES_GET_TEMPLATES)
  },

  // Phase 3: Export & Import
  exportLibrary: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_EXPORT)
  },

  importLibrary: (jsonData: string): Promise<{ importedSongs: number; importedPresentations: number }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_IMPORT, jsonData)
  },

  // Demo Data Management
  loadDemoData: (): Promise<{ songsCount: number; servicesCount: number }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEMO_LOAD)
  },

  clearDemoData: (): Promise<{ deletedSongs: number; deletedServices: number }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEMO_CLEAR)
  },

  hasDemoData: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEMO_HAS)
  },

  // Phase 4: Bible
  getBibleTranslations: (): Promise<BibleTranslationMeta[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_GET_TRANSLATIONS)
  },

  importBibleTranslation: (
    format: 'zefania' | 'osis' | 'usfm' | 'json',
    rawContent: string,
    meta: Partial<BibleTranslationMeta>
  ): Promise<BibleTranslationMeta> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_IMPORT_TRANSLATION, format, rawContent, meta)
  },

  deleteBibleTranslation: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_DELETE_TRANSLATION, id)
  },

  parseBibleReference: (input: string): Promise<BibleReferenceParsed | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_PARSE_REFERENCE, input)
  },

  getVersesByReference: (
    reference: string,
    translationAbbrev?: string,
    secondaryAbbrev?: string
  ): Promise<{ parsed: BibleReferenceParsed; verses: BibleVerse[]; secondaryVerses?: BibleVerse[] }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_GET_VERSES, reference, translationAbbrev, secondaryAbbrev)
  },

  searchBibleText: (
    query: string,
    translationAbbrev?: string,
    filter?: { bookNumber?: number; testament?: 'OT' | 'NT' }
  ): Promise<BibleSearchResult[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_SEARCH_TEXT, query, translationAbbrev, filter)
  },

  getBibleFavorites: (): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_GET_FAVORITES)
  },

  toggleBibleFavorite: (reference: string): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_TOGGLE_FAVORITE, reference)
  },

  getBibleRecentHistory: (): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_GET_RECENT)
  },

  addBibleRecentHistory: (reference: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_ADD_RECENT, reference)
  },

  generateBibleSlides: (
    verses: BibleVerse[],
    secondaryVerses?: BibleVerse[],
    dualLayout?: 'stacked' | 'sideBySide'
  ): Promise<SlideItem[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_GENERATE_SLIDES, verses, secondaryVerses, dualLayout)
  },

  getRoleBibleConfigs: (): Promise<RoleBibleConfigsMap> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_GET_ROLE_CONFIGS)
  },

  saveRoleBibleConfig: (config: RoleBibleConfig): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_SAVE_ROLE_CONFIG, config)
  },

  // Phase 5A: Media & PDF
  getMediaItems: (type?: MediaType): Promise<MediaItem[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDIA_GET, type)
  },

  importMediaFile: (sourcePath: string, tags?: string[]): Promise<MediaItem> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDIA_IMPORT, sourcePath, tags)
  },

  deleteMediaItem: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDIA_DELETE, id)
  },

  checkMediaIntegrity: (): Promise<{ missingCount: number; missingIds: string[] }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDIA_CHECK_INTEGRITY)
  },

  playVideo: (config: VideoItemConfig): Promise<PresenterState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VIDEO_PLAY, config)
  },

  controlVideo: (action: 'play' | 'pause' | 'stop' | 'seek', time?: number): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.VIDEO_CONTROL, action, time)
  },

  playIndependentAudio: (mediaId: string, filePath: string, title?: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PLAY_INDEPENDENT, mediaId, filePath, title)
  },

  controlIndependentAudio: (action: 'play' | 'pause' | 'stop' | 'fade-out' | 'volume', value?: number): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_CONTROL_INDEPENDENT, action, value)
  },

  renderPdfPage: (mediaId: string, pageNumber: number, targetWidth?: number): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PDF_RENDER_PAGE, mediaId, pageNumber, targetWidth)
  },

  getPdfPageCount: (mediaId: string): Promise<number> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PDF_GET_PAGE_COUNT, mediaId)
  },

  // Diagnostics & Logging
  logFpsDrop: (role: string, fps: number, displayId?: number): void => {
    ipcRenderer.send(IPC_CHANNELS.LOG_FPS_DROP, role, fps, displayId)
  },

  logMediaError: (role: string, url: string, message: string): void => {
    ipcRenderer.send(IPC_CHANNELS.LOG_MEDIA_ERROR, role, url, message)
  },

  captureOutputWindow: (role: string): Promise<Buffer | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_CAPTURE_ROLE, role)
  },

  openPreviewOutputWindow: (role: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_OPEN_PREVIEW, role)
  },

  getAppVersion: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION)
  }
}

try {
  contextBridge.exposeInMainWorld('churchPresenterApi', api)
} catch (error) {
  console.error('Failed to expose churchPresenterApi in preload:', error)
}
