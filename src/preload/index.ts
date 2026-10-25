import { contextBridge, ipcRenderer, webUtils } from 'electron'
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
  VideoItemConfig,
  UserLibrary,
  LibraryItemReference,
  PresentationTimer,
  OpenFileDialogOptions,
  FileChangedEvent,
  YouTubeItem,
  YouTubeAvailabilityStatus,
  YouTubeSyncTick,
  ServiceItem
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

  duplicateService: (serviceId: string): Promise<ServicePlan> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SERVICES_DUPLICATE, serviceId)
  },

  getTemplates: (): Promise<ServicePlan[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SERVICES_GET_TEMPLATES)
  },

  // Phase 3: Export & Import
  exportLibrary: (includeMedia?: boolean): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_EXPORT, includeMedia)
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

  // Phase 5B: PowerPoint & Video Conversion
  detectPptConverters: (): Promise<any[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.POWERPOINT_DETECT_CONVERTERS)
  },

  importPowerPoint: (filePath: string): Promise<any> => {
    return ipcRenderer.invoke(IPC_CHANNELS.POWERPOINT_IMPORT, filePath)
  },

  editInPowerPoint: (filePath: string): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.POWERPOINT_EDIT, filePath)
  },

  checkPowerPointModified: (originalPath: string, recordedHash: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.POWERPOINT_CHECK_MODIFIED, originalPath, recordedHash)
  },

  cancelPowerPointJob: (jobId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.POWERPOINT_CANCEL, jobId)
  },

  detectFfmpeg: (): Promise<any> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_DETECT)
  },

  convertVideoFfmpeg: (jobId: string, inputPath: string, outputPath: string): Promise<any> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_CONVERT, jobId, inputPath, outputPath)
  },

  cancelFfmpegJob: (jobId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_CANCEL, jobId)
  },

  importImageFolder: (folderPath: string): Promise<any[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MEDIA_IMPORT_FOLDER, folderPath)
  },

  // Native Dialogs & File Access (A.4)
  openFileDialog: (options?: OpenFileDialogOptions): Promise<string[] | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, options)
  },

  openFolderDialog: (options?: { title?: string; defaultPath?: string }): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FOLDER, options)
  },

  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file)
  },

  // File Watching (A.5)
  watchFile: (filePath: string, type: 'powerpoint' | 'media'): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WATCH_FILE, filePath, type)
  },

  unwatchFile: (filePath: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.UNWATCH_FILE, filePath)
  },

  onFileChanged: (callback: (event: FileChangedEvent) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, payload: FileChangedEvent) => callback(payload)
    ipcRenderer.on(IPC_CHANNELS.FILE_CHANGED, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.FILE_CHANGED, handler)
    }
  },

  // User Libraries (B.1)
  getLibraries: (): Promise<UserLibrary[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARIES_GET)
  },

  getLibraryItems: (libraryId: string): Promise<LibraryItemReference[]> => {
    return ipcRenderer.invoke('libraries:get-items', libraryId)
  },

  saveLibrary: (library: UserLibrary): Promise<UserLibrary> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARIES_SAVE, library)
  },

  renameLibrary: (libraryId: string, newName: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARIES_RENAME, libraryId, newName)
  },

  reorderLibraries: (orderedIds: string[]): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARIES_REORDER, orderedIds)
  },

  deleteLibrary: (libraryId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARIES_DELETE, libraryId)
  },

  moveLibraryItem: (itemRefId: string, targetLibraryId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.LIBRARIES_MOVE_ITEM, itemRefId, targetLibraryId)
  },

  // Timers (Fase 6 adelantada)
  getTimers: (): Promise<PresentationTimer[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TIMERS_GET)
  },

  saveTimer: (timer: PresentationTimer): Promise<PresentationTimer> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TIMERS_SAVE, timer)
  },

  deleteTimer: (timerId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.TIMERS_DELETE, timerId)
  },

  controlTimer: (timerId: string, action: 'start' | 'pause' | 'reset'): Promise<PresentationTimer> => {
    return ipcRenderer.invoke('timers:control', timerId, action)
  },

  onTimersTick: (callback: (timers: PresentationTimer[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, timers: PresentationTimer[]) => callback(timers)
    ipcRenderer.on(IPC_CHANNELS.TIMERS_TICK, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TIMERS_TICK, handler)
    }
  },

  // Phase 5C: YouTube
  getYouTubeItems: (): Promise<YouTubeItem[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_GET_ITEMS)
  },

  saveYouTubeItem: (item: YouTubeItem): Promise<YouTubeItem> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_SAVE_ITEM, item)
  },

  deleteYouTubeItem: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_DELETE_ITEM, id)
  },

  checkYouTubeAvailability: (videoIdOrUrl: string): Promise<YouTubeAvailabilityStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_CHECK_AVAILABILITY, videoIdOrUrl)
  },

  verifyYouTubePlaylist: (
    items: ServiceItem[]
  ): Promise<{
    totalChecked: number
    okCount: number
    failedCount: number
    results: { itemId: string; title: string; videoId: string; status: YouTubeAvailabilityStatus }[]
  }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_VERIFY_PLAYLIST, items)
  },

  getYouTubeMetadata: (
    videoIdOrUrl: string
  ): Promise<{
    videoId: string
    title: string
    channelTitle: string
    thumbnailUrl: string
    duration: number
    availabilityStatus: YouTubeAvailabilityStatus
  }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_GET_METADATA, videoIdOrUrl)
  },

  openYouTubeBrowser: (bounds: { x: number; y: number; width: number; height: number }): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_OPEN_BROWSER, bounds)
  },

  closeYouTubeBrowser: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_CLOSE_BROWSER)
  },

  navigateYouTubeBrowser: (
    action: 'back' | 'forward' | 'home' | 'reload' | 'go',
    url?: string
  ): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_NAVIGATE_BROWSER, action, url)
  },

  getYouTubeBrowserUrl: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_GET_BROWSER_URL)
  },

  setYouTubeBrowserBounds: (bounds: { x: number; y: number; width: number; height: number }): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_SET_BROWSER_BOUNDS, bounds)
  },

  clearYouTubeSession: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_CLEAR_SESSION)
  },

  controlYouTube: (
    action: 'prepare' | 'go-live' | 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'mute',
    payload?: any
  ): Promise<any> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_CONTROL, action, payload)
  },

  downloadYouTubeVideo: (
    youtubeUrl: string
  ): Promise<{ success: boolean; item?: MediaItem; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_DOWNLOAD_VIDEO, youtubeUrl)
  },

  onYouTubeAdStatus: (callback: (isAd: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, isAd: boolean) => callback(isAd)
    ipcRenderer.on(IPC_CHANNELS.YOUTUBE_AD_STATUS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.YOUTUBE_AD_STATUS, handler)
    }
  },

  onYouTubeSyncTick: (callback: (tick: YouTubeSyncTick) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, tick: YouTubeSyncTick) => callback(tick)
    ipcRenderer.on(IPC_CHANNELS.YOUTUBE_SYNC_TICK, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.YOUTUBE_SYNC_TICK, handler)
    }
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
  },

  getEnvInfo: (): Promise<{ isDev: boolean; version: string; userDataPath: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_ENV_INFO)
  },

  copyProdLibraryToDev: (): Promise<{ success: boolean; message: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DEV_COPY_PROD_LIBRARY)
  },

  // Floating Output Preview Window (Requirement 3)
  openFloatingPreview: (initialRole?: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FLOATING_PREVIEW_OPEN, initialRole)
  },

  setFloatingPreviewAlwaysOnTop: (alwaysOnTop: boolean): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FLOATING_PREVIEW_SET_ALWAYS_ON_TOP, alwaysOnTop)
  },

  closeFloatingPreview: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FLOATING_PREVIEW_CLOSE)
  }
}

try {
  contextBridge.exposeInMainWorld('churchPresenterApi', api)
} catch (error) {
  console.error('Failed to expose churchPresenterApi in preload:', error)
}
