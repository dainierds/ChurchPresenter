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
  ThemeContentType,
  TypeDefaultThemesMap,
  CustomFontItem,
  ThemeImportResult,
  BackgroundImageItem,
  ServicePlan,
  BibleTranslationMeta,
  BibleImportResult,
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
  YouTubeDownloadProgress,
  ServiceItem,
  RemoteServerConfig,
  RemoteServerStatus,
  RemoteNetworkInterface,
  StageLayoutConfig,
  PresentationMessage
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

  // Phase 3 & Extended Theme System
  getThemes: (): Promise<ThemeConfig[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_GET)
  },

  saveTheme: (theme: ThemeConfig): Promise<ThemeConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_SAVE, theme)
  },

  deleteTheme: (id: string, reassignToThemeId?: string): Promise<{ success: boolean; reassignedCount: number }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_DELETE, id, reassignToThemeId)
  },

  duplicateTheme: (id: string, newName?: string): Promise<ThemeConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_DUPLICATE, id, newName)
  },

  setDefaultTheme: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_SET_DEFAULT, id)
  },

  getTypeDefaultThemes: (): Promise<TypeDefaultThemesMap> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_GET_TYPE_DEFAULTS)
  },

  setTypeDefaultTheme: (contentType: ThemeContentType, themeId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_SET_TYPE_DEFAULT, contentType, themeId)
  },

  applyThemeToScope: (themeId: string, scope: 'playlist' | 'library' | 'all_songs', playlistId?: string): Promise<{ affectedItems: number }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_APPLY_SCOPE, themeId, scope, playlistId)
  },

  exportTheme: (themeId: string, targetPath?: string, includeFonts?: boolean): Promise<{ success: boolean; filePath?: string; error?: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_EXPORT, { themeId, targetPath, includeFonts })
  },

  importThemePackage: (filePath?: string): Promise<ThemeImportResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_IMPORT, filePath)
  },

  uploadThemeBackground: (filePath?: string): Promise<BackgroundImageItem | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.THEMES_UPLOAD_BG, filePath)
  },

  getCustomFonts: (): Promise<CustomFontItem[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FONTS_GET)
  },

  importCustomFont: (filePath?: string): Promise<CustomFontItem | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FONTS_IMPORT, filePath)
  },

  deleteCustomFont: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.FONTS_DELETE, id)
  },

  onFontsChanged: (callback: (fonts: CustomFontItem[]) => void): (() => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, fonts: CustomFontItem[]) => {
      callback(fonts)
    }
    ipcRenderer.on(IPC_CHANNELS.FONTS_CHANGED, subscription)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.FONTS_CHANGED, subscription)
    }
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
    format: 'zefania' | 'osis' | 'usfm' | 'json' | 'sqlite',
    rawContent: string,
    meta: Partial<BibleTranslationMeta>
  ): Promise<BibleImportResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_IMPORT_TRANSLATION, format, rawContent, meta)
  },

  importBibleFile: (
    filePath: string,
    metaOverrides?: Partial<BibleTranslationMeta>
  ): Promise<BibleImportResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_IMPORT_FILE, filePath, metaOverrides)
  },

  deleteBibleTranslation: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_DELETE_TRANSLATION, id)
  },

  setBibleDefault: (abbrev: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BIBLE_SET_DEFAULT, abbrev)
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

  detectPowerPointConverters: (): Promise<any[]> => {
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

  setYouTubeBrowserVisible: (visible: boolean): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_SET_BROWSER_VISIBLE, visible)
  },

  clearYouTubeSession: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.YOUTUBE_CLEAR_SESSION)
  },

  controlYouTube: (
    action: 'prepare' | 'go-live' | 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'mute' | 'status',
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

  onYouTubeDownloadProgress: (callback: (progress: YouTubeDownloadProgress) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: YouTubeDownloadProgress) => callback(progress)
    ipcRenderer.on(IPC_CHANNELS.YOUTUBE_DOWNLOAD_PROGRESS, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.YOUTUBE_DOWNLOAD_PROGRESS, handler)
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

  closeOutputWindow: (role: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_CLOSE, role)
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
  },

  // Phase 6: Remote Control
  getRemoteConfig: (): Promise<RemoteServerConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_GET_CONFIG)
  },
  remoteGetConfig: (): Promise<RemoteServerConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_GET_CONFIG)
  },

  saveRemoteConfig: (config: Partial<RemoteServerConfig>): Promise<RemoteServerConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_SAVE_CONFIG, config)
  },
  remoteSaveConfig: (config: Partial<RemoteServerConfig>): Promise<RemoteServerConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_SAVE_CONFIG, config)
  },

  getRemoteStatus: (): Promise<RemoteServerStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_GET_STATUS)
  },
  remoteGetStatus: (): Promise<RemoteServerStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_GET_STATUS)
  },

  regenerateRemotePin: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_REGENERATE_PIN)
  },
  remoteRegeneratePin: (): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_REGENERATE_PIN)
  },

  kickRemoteClient: (clientId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_KICK_CLIENT, clientId)
  },
  remoteKickClient: (clientId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_KICK_CLIENT, clientId)
  },

  getNetworkInterfaces: (): Promise<RemoteNetworkInterface[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.REMOTE_GET_NETWORK_INTERFACES)
  },

  onRemoteActionDispatch: (callback: (action: { type: string; payload?: any; [key: string]: any }) => void): (() => void) => {
    const handler = (_event: any, action: { type: string; payload?: any; [key: string]: any }) => callback(action)
    ipcRenderer.on(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, handler)
  },

  // Phase 6: Stage Layouts
  getStageLayouts: (): Promise<StageLayoutConfig[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_LAYOUTS)
  },

  saveStageLayout: (layout: StageLayoutConfig): Promise<StageLayoutConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STAGE_SAVE_LAYOUT, layout)
  },

  deleteStageLayout: (layoutId: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STAGE_DELETE_LAYOUT, layoutId)
  },

  getAssignedStageLayout: (role?: string): Promise<StageLayoutConfig> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STAGE_GET_ASSIGNMENT, role)
  },

  setAssignedStageLayout: (layoutId: string, role?: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.STAGE_SET_ASSIGNMENT, layoutId, role)
  },

  // Phase 6: Messages
  getActiveMessage: (): Promise<PresentationMessage | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_GET_ACTIVE)
  },

  sendMessage: (message: { text: string; target: 'stage' | 'audience' | 'both'; durationSeconds?: number }): Promise<PresentationMessage> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_SEND, message)
  },

  clearMessage: (): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_CLEAR)
  },

  getMessagePresets: (): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_GET_PRESETS)
  },

  saveMessagePreset: (text: string): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_SAVE_PRESET, text)
  },

  deleteMessagePreset: (text: string): Promise<string[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_DELETE_PRESET, text)
  },

  // Phase 7: Crash Recovery
  checkSessionRecovery: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_CHECK)
  },
  dismissSessionRecovery: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_DISMISS)
  },
  getSessionRecoverySnapshot: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.RECOVERY_GET_SNAPSHOT)
  },

  // Phase 7: Output Health
  getOutputHealthStatuses: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.OUTPUT_HEALTH_GET)
  },
  onOutputHealthChanged: (callback) => {
    const handler = (_event: any, statuses: any) => callback(statuses)
    ipcRenderer.on(IPC_CHANNELS.OUTPUT_HEALTH_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OUTPUT_HEALTH_CHANGED, handler)
  },
  sendOutputHeartbeat: (heartbeat) => {
    ipcRenderer.send(IPC_CHANNELS.OUTPUT_HEALTH_HEARTBEAT, heartbeat)
  },

  // Phase 7: System Monitor
  getSystemMetrics: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_METRICS_GET)
  },
  onSystemMetricsTick: (callback) => {
    const handler = (_event: any, metrics: any) => callback(metrics)
    ipcRenderer.on(IPC_CHANNELS.SYSTEM_METRICS_TICK, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SYSTEM_METRICS_TICK, handler)
  },

  // Phase 7: Pre-Service Checklist
  runPreServiceChecklist: (plan?: any) => {
    return ipcRenderer.invoke(IPC_CHANNELS.CHECKLIST_RUN, plan)
  },
  fixChecklistItem: (itemId: string, actionType: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.CHECKLIST_FIX_ITEM, itemId, actionType)
  },

  // Phase 7: Diagnostics
  getDiagnosticsLogs: (options?: any) => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_GET_LOGS, options)
  },
  exportDiagnosticsZip: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIAGNOSTICS_EXPORT_ZIP)
  },

  // Phase 7: Rehearsal Mode
  setRehearsalMode: (enabled: boolean) => {
    return ipcRenderer.invoke(IPC_CHANNELS.REHEARSAL_SET_MODE, enabled)
  },
  getRehearsalStatus: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.REHEARSAL_GET_STATUS)
  },
  getRehearsalSummary: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.REHEARSAL_GET_SUMMARY)
  },
  onRehearsalModeChanged: (callback) => {
    const handler = (_event: any, active: boolean) => callback(active)
    ipcRenderer.on(IPC_CHANNELS.REHEARSAL_MODE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.REHEARSAL_MODE_CHANGED, handler)
  },

  // Phase 7: Emergency & Safe Mode
  activateEmergencyMode: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.EMERGENCY_ACTIVATE)
  },
  deactivateEmergencyMode: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.EMERGENCY_DEACTIVATE)
  },
  isEmergencyModeActive: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.EMERGENCY_GET_STATUS)
  },
  isSafeModeActive: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAFE_MODE_GET_STATUS)
  },

  // Phase 8: Automation, Macros, Props, Loops & MIDI
  getMacros: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_GET_ALL)
  },
  saveMacro: (macro: any) => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_SAVE, macro)
  },
  deleteMacro: (id: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_DELETE, id)
  },
  duplicateMacro: (id: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_DUPLICATE, id)
  },
  runMacro: (id: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_RUN, id)
  },
  runMacroStep: (id: string, actionIndex: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_RUN_STEP, id, actionIndex)
  },
  stopAllMacros: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_STOP_ALL)
  },
  getMacroExecutionState: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.MACROS_GET_STATUS)
  },
  onMacroStatusChanged: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state)
    ipcRenderer.on(IPC_CHANNELS.MACROS_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MACROS_STATUS_CHANGED, handler)
  },

  getProps: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROPS_GET_ALL)
  },
  saveProp: (prop: any) => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROPS_SAVE, prop)
  },
  deleteProp: (id: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROPS_DELETE, id)
  },
  toggleProp: (id: string, active?: boolean) => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROPS_TOGGLE, id, active)
  },
  getActiveProps: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.PROPS_GET_ACTIVE)
  },
  onPropsActiveChanged: (callback: (props: any[]) => void) => {
    const handler = (_event: any, props: any[]) => callback(props)
    ipcRenderer.on(IPC_CHANNELS.PROPS_ACTIVE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PROPS_ACTIVE_CHANGED, handler)
  },

  startPresentationLoop: (config: any, totalSlides: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.LOOP_START, config, totalSlides)
  },
  stopPresentationLoop: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.LOOP_STOP)
  },
  getLoopStatus: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.LOOP_GET_STATUS)
  },
  onLoopStatusChanged: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any) => callback(status)
    ipcRenderer.on(IPC_CHANNELS.LOOP_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LOOP_STATUS_CHANGED, handler)
  },

  getMidiInputs: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.MIDI_GET_INPUTS)
  },
  triggerMidiMessage: (msg: any) => {
    return ipcRenderer.invoke(IPC_CHANNELS.MIDI_TRIGGER_MESSAGE, msg)
  },

  // Phase 9: OBS Studio Integration
  getObsConfig: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_GET_CONFIG),
  saveObsConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.OBS_SAVE_CONFIG, config),
  connectObs: (overrideOptions?: any) => ipcRenderer.invoke(IPC_CHANNELS.OBS_CONNECT, overrideOptions),
  disconnectObs: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_DISCONNECT),
  getObsStatus: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_GET_STATUS),
  getObsScenes: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_GET_SCENES),
  setObsScene: (sceneName: string) => ipcRenderer.invoke(IPC_CHANNELS.OBS_SET_SCENE, sceneName),
  startObsStream: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_START_STREAM),
  stopObsStream: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_STOP_STREAM),
  startObsRecord: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_START_RECORD),
  stopObsRecord: () => ipcRenderer.invoke(IPC_CHANNELS.OBS_STOP_RECORD),
  onObsStatusChanged: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any) => callback(status)
    ipcRenderer.on(IPC_CHANNELS.OBS_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.OBS_STATUS_CHANGED, handler)
  },

  // Phase 9: Broadcast Studio, Streaming & Recording
  getBroadcastSettings: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_GET_SETTINGS),
  saveBroadcastSettings: (settings: any) => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_SAVE_SETTINGS, settings),
  getBroadcastScenes: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_GET_SCENES),
  saveBroadcastScene: (scene: any) => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_SAVE_SCENE, scene),
  deleteBroadcastScene: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_DELETE_SCENE, id),
  getAudioMixerConfig: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_GET_AUDIO_MIXER),
  saveAudioMixerConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_SAVE_AUDIO_MIXER, config),
  getBroadcastStatus: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_GET_STATUS),
  startBroadcastStream: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_START_STREAM),
  stopBroadcastStream: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_STOP_STREAM),
  startBroadcastRecord: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_START_RECORD),
  stopBroadcastRecord: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_STOP_RECORD),
  onBroadcastStatusChanged: (callback: (status: any) => void) => {
    const handler = (_event: any, status: any) => callback(status)
    ipcRenderer.on(IPC_CHANNELS.BROADCAST_STATUS_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.BROADCAST_STATUS_CHANGED, handler)
  },
  listDesktopSources: () => ipcRenderer.invoke(IPC_CHANNELS.BROADCAST_LIST_DESKTOP_SOURCES),

  // Phase 10: Extras (Sync, Song Importers, CCLI Reports, Subtitles, AI, Backups)
  // 1. Multi-PC Sync
  exportSyncPackage: (targetFolder: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_EXPORT_PACKAGE, targetFolder),
  inspectSyncPackage: (sourceFolder: string) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_INSPECT_PACKAGE, sourceFolder),
  mergeSyncPackage: (sourceFolder: string, resolutions: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_MERGE_PACKAGE, sourceFolder, resolutions),
  undoSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_UNDO),
  getSyncConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_CONFIG),
  saveSyncConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_SAVE_CONFIG, config),

  // 2. Song Importers
  parseSongImportFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.SONG_IMPORT_PARSE_FILE, filePath),
  executeSongImport: (songs: any[], targetLibraryId?: string) => ipcRenderer.invoke(IPC_CHANNELS.SONG_IMPORT_EXECUTE, songs, targetLibraryId),

  // 3. CCLI Song Usage
  recordSongUsage: (songId: string, title: string, artist?: string, ccliNumber?: string, copyright?: string, serviceId?: string, serviceTitle?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CCLI_RECORD_USAGE, songId, title, artist, ccliNumber, copyright, serviceId, serviceTitle),
  getSongUsageReport: (from?: string, to?: string) => ipcRenderer.invoke(IPC_CHANNELS.CCLI_GET_REPORT, from, to),
  exportSongUsageCsv: (from?: string, to?: string) => ipcRenderer.invoke(IPC_CHANNELS.CCLI_EXPORT_CSV, from, to),
  clearSongUsageHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CCLI_CLEAR_HISTORY),
  getCcliConfig: () => ipcRenderer.invoke(IPC_CHANNELS.CCLI_GET_CONFIG),
  saveCcliConfig: (config: { enabled: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.CCLI_SAVE_CONFIG, config),

  // 4. Live Subtitles
  getSubtitlesConfig: () => ipcRenderer.invoke(IPC_CHANNELS.SUBTITLES_GET_CONFIG),
  saveSubtitlesConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.SUBTITLES_SAVE_CONFIG, config),
  sendLiveSubtitle: (subtitle: any) => ipcRenderer.invoke(IPC_CHANNELS.SUBTITLES_SEND, subtitle),
  clearLiveSubtitle: () => ipcRenderer.invoke(IPC_CHANNELS.SUBTITLES_CLEAR),

  // 5. AI Assistant
  getAiAssistantConfig: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_CONFIG),
  saveAiAssistantConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_SAVE_CONFIG, config),
  executeAiTask: (request: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_EXECUTE_TASK, request),

  // 6. Secondary Backup
  getSecondaryBackupConfig: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_SECONDARY_CONFIG),
  saveSecondaryBackupConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_SAVE_SECONDARY_CONFIG, config),
  runSecondaryBackup: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RUN_SECONDARY)
}

try {
  contextBridge.exposeInMainWorld('churchPresenterApi', api)
} catch (error) {
  console.error('Failed to expose churchPresenterApi in preload:', error)
}
