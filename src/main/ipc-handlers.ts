import { ipcMain, app, dialog, BrowserWindow, desktopCapturer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-events'
import {
  GlobalControls,
  TestSlide,
  SlideItem,
  AppShortcutsConfig,
  Song,
  GenericPresentation,
  ThemeConfig,
  ServicePlan,
  RoleBibleConfig,
  VideoItemConfig,
  UserLibrary,
  PresentationTimer,
  YouTubeItem,
  YouTubeItemConfig,
  ServiceItem,
  MacroItem,
  PropItem,
  LoopConfig
} from '../shared/types'
import { displayManager } from './display-manager'
import { databaseService } from './db/database-service'
import { stateManager } from './state-manager'
import { windowManager } from './window-manager'
import { shortcutsManager } from './shortcuts-manager'
import { libraryService } from './library-service'
import { themeService } from './theme/theme-service'
import { bibleService } from './bible/bible-service'
import { mediaService } from './media/media-service'
import { masterMediaSyncService } from './media/master-media-sync-service'
import { pdfService } from './pdf/pdf-service'
import { powerpointService } from './powerpoint/powerpoint-service'
import { ffmpegService } from './media/ffmpeg-service'
import { fileWatcherService } from './media/file-watcher-service'
import { youtubeService } from './youtube/youtube-service'
import { youTubeBrowserManager } from './youtube/youtube-browser-manager'
import { youtubeOutputManager } from './youtube/youtube-output-manager'
import { remoteServer } from './remote/remote-server'
import { remoteAuthService } from './remote/remote-auth-service'
import { stageLayoutService } from './stage/stage-layout-service'
import { messageService } from './messages/message-service'
import { sessionRecoveryService } from './recovery/session-recovery-service'
import { outputHealthService } from './health/output-health-service'
import { systemMonitorService } from './health/system-monitor-service'
import { checklistService } from './checklist/checklist-service'
import { diagnosticsService } from './diagnostics/diagnostics-service'
import { rehearsalService } from './rehearsal/rehearsal-service'
import { emergencyService } from './emergency/emergency-service'
import { macroEngine } from './macros/macro-engine'
import { propService } from './props/prop-service'
import { loopService } from './loop/loop-service'
import { midiService } from './midi/midi-service'
import { obsWebSocketService } from './broadcast/obs-websocket-service'
import { broadcastEngine } from './broadcast/broadcast-engine'
import { librarySyncService } from './extras/library-sync-service'
import { songImporterService } from './extras/song-importer-service'
import { ccliService } from './extras/ccli-service'
import { liveSubtitlesService } from './extras/live-subtitles-service'
import { aiAssistantService } from './extras/ai-assistant-service'
import { secondaryBackupService } from './extras/secondary-backup-service'
import fs from 'fs'
import path from 'path'
import { parseBibleReference } from '../shared/bible-reference-parser'
import { buildBibleSlides } from '../shared/bible-slide-generator'
import { logger } from './logger'

export function registerIpcHandlers(): void {
  // Screens & Displays
  ipcMain.handle(IPC_CHANNELS.DISPLAYS_GET, () => {
    return displayManager.getDisplays()
  })

  ipcMain.handle(IPC_CHANNELS.DISPLAYS_GET_ASSIGNMENTS, () => {
    return databaseService.getRoleAssignments()
  })

  ipcMain.handle(
    IPC_CHANNELS.DISPLAYS_ASSIGN_ROLE,
    (_event, role: string, stableId: string | null) => {
      logger.info(`Assigning role '${role}' to stable display id: ${stableId}`)
      databaseService.setRoleAssignment(role, stableId)
      windowManager.syncOutputWindows()
      return true
    }
  )

  ipcMain.handle(IPC_CHANNELS.DISPLAYS_IDENTIFY, () => {
    windowManager.identifyDisplays()
  })

  // Presentation State
  ipcMain.handle(IPC_CHANNELS.STATE_GET, () => {
    return stateManager.getState()
  })

  ipcMain.handle(
    IPC_CHANNELS.STATE_SET_CONTROL,
    (_event, control: keyof GlobalControls, value: boolean) => {
      if (control === 'black' || control === 'clear' || control === 'freeze') {
        youtubeOutputManager.applyGlobalControl(control, value)
      }
      return stateManager.setGlobalControl(control, value)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STATE_TOGGLE_CONTROL,
    (_event, control: keyof GlobalControls) => {
      const newState = stateManager.toggleGlobalControl(control)
      if (control === 'black' || control === 'clear' || control === 'freeze') {
        youtubeOutputManager.applyGlobalControl(control, newState.controls[control])
      }
      return newState
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STATE_SEND_SLIDE,
    (_event, slide: TestSlide | SlideItem, targetRoles?: string[], nextSlide?: SlideItem) => {
      const isYt = (slide as any).mediaType === 'youtube' || Boolean((slide as any).youtubeId)
      const isVid = (slide as any).mediaType === 'video' || (slide as any).sourceType === 'video'

      if (!isYt) {
        youtubeOutputManager.stop()
        youtubeOutputManager.cleanupViews()
        windowManager.broadcastToAll(IPC_CHANNELS.YOUTUBE_SYNC_TICK, {
          videoId: '',
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          isAd: false,
          timestamp: Date.now()
        })
      }

      if (!isVid) {
        masterMediaSyncService.stopVideo()
        stateManager.updateMediaSyncTick(null)
        windowManager.broadcastToAll(IPC_CHANNELS.MEDIA_SYNC_TICK, {
          mediaId: '',
          mediaType: 'video',
          filePath: '',
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          loop: false,
          volume: 1.0,
          audioOutputRole: 'main',
          timestamp: Date.now()
        })
      }

      return stateManager.sendSlide(slide, targetRoles, nextSlide)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STATE_SET_MESSAGE,
    (_event, role: string, message: string, visible: boolean) => {
      return stateManager.setOutputMessage(role, message, visible)
    }
  )

  ipcMain.handle(IPC_CHANNELS.STATE_SET_STRESS_TEST, (_event, enabled: boolean) => {
    return stateManager.setStressTestMode(enabled)
  })

  // Shortcuts & Backups Settings
  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_GET, () => {
    return shortcutsManager.getShortcuts()
  })

  ipcMain.handle(IPC_CHANNELS.SHORTCUTS_SAVE, (_event, config: AppShortcutsConfig) => {
    return shortcutsManager.updateShortcuts(config)
  })

  ipcMain.handle(IPC_CHANNELS.BACKUPS_OPEN_FOLDER, () => {
    windowManager.openBackupsFolder()
  })

  // Phase 3: Songs
  ipcMain.handle(IPC_CHANNELS.SONGS_GET, () => {
    return libraryService.getSongs()
  })

  ipcMain.handle(IPC_CHANNELS.SONGS_GET_BY_ID, (_event, id: string) => {
    return libraryService.getSongById(id)
  })

  ipcMain.handle(IPC_CHANNELS.SONGS_SAVE, (_event, song: Song) => {
    return libraryService.saveSong(song)
  })

  ipcMain.handle(IPC_CHANNELS.SONGS_DELETE, (_event, id: string) => {
    return libraryService.deleteSong(id)
  })

  // Phase 3: Presentations
  ipcMain.handle(IPC_CHANNELS.PRESENTATIONS_GET, () => {
    return libraryService.getPresentations()
  })

  ipcMain.handle(IPC_CHANNELS.PRESENTATIONS_SAVE, (_event, presentation: GenericPresentation) => {
    return libraryService.savePresentation(presentation)
  })

  ipcMain.handle(IPC_CHANNELS.PRESENTATIONS_DELETE, (_event, id: string) => {
    return libraryService.deletePresentation(id)
  })

  // Phase 3 & Extended Theme System
  ipcMain.handle(IPC_CHANNELS.THEMES_GET, () => {
    return themeService.getThemes()
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_SAVE, (_event, theme: ThemeConfig) => {
    const saved = themeService.saveTheme(theme)
    if (saved.isDefault) {
      stateManager.setTheme(saved)
    }
    return saved
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_SET_DEFAULT, (_event, id: string) => {
    const success = themeService.setDefaultTheme(id)
    const themes = themeService.getThemes()
    const found = themes.find((t) => t.id === id)
    if (found) {
      stateManager.setTheme(found)
    }
    return success
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_DUPLICATE, (_event, id: string, newName?: string) => {
    return themeService.duplicateTheme(id, newName)
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_DELETE, (_event, id: string, reassignToThemeId?: string) => {
    return themeService.deleteTheme(id, reassignToThemeId)
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_GET_TYPE_DEFAULTS, () => {
    return themeService.getTypeDefaultThemes()
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_SET_TYPE_DEFAULT, (_event, contentType: any, themeId: string) => {
    return themeService.setTypeDefaultTheme(contentType, themeId)
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_APPLY_SCOPE, (_event, themeId: string, scope: any, playlistId?: string) => {
    return themeService.applyThemeToScope(themeId, scope, playlistId)
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_EXPORT, (_event, options: any) => {
    return themeService.exportThemePackage(options)
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_IMPORT, (_event, filePath?: string) => {
    return themeService.importThemePackage(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_UPLOAD_BG, (_event, filePath?: string) => {
    return themeService.uploadBackground(filePath)
  })

  // Custom Fonts
  ipcMain.handle(IPC_CHANNELS.FONTS_GET, () => {
    return themeService.getCustomFonts()
  })

  ipcMain.handle(IPC_CHANNELS.FONTS_IMPORT, (_event, filePath?: string) => {
    const font = themeService.importCustomFont(filePath)
    if (font) {
      const allFonts = themeService.getCustomFonts()
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.FONTS_CHANGED, allFonts)
        }
      })
    }
    return font
  })

  ipcMain.handle(IPC_CHANNELS.FONTS_DELETE, (_event, id: string) => {
    const success = themeService.deleteCustomFont(id)
    if (success) {
      const allFonts = themeService.getCustomFonts()
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.FONTS_CHANGED, allFonts)
        }
      })
    }
    return success
  })

  // Phase 3: Background Images
  ipcMain.handle(IPC_CHANNELS.BACKGROUNDS_GET, () => {
    return libraryService.getBackgroundImages()
  })

  ipcMain.handle(
    IPC_CHANNELS.BACKGROUNDS_IMPORT,
    (_event, sourcePath: string, name?: string) => {
      return libraryService.importBackgroundImage(sourcePath, name)
    }
  )

  ipcMain.handle(IPC_CHANNELS.BACKGROUNDS_DELETE, (_event, id: string) => {
    return libraryService.deleteBackgroundImage(id)
  })

  // Phase 3: Services & Templates
  ipcMain.handle(IPC_CHANNELS.SERVICES_GET, () => {
    return libraryService.getServices()
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_SAVE, (_event, service: ServicePlan) => {
    return libraryService.saveService(service)
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_DELETE, (_event, id: string) => {
    return libraryService.deleteService(id)
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_DUPLICATE, (_event, id: string) => {
    return libraryService.duplicateService(id)
  })

  ipcMain.handle(IPC_CHANNELS.SERVICES_GET_TEMPLATES, () => {
    return libraryService.getTemplates()
  })

  // Phase 3: Export & Import
  ipcMain.handle(IPC_CHANNELS.LIBRARY_EXPORT, (_event, includeMedia?: boolean) => {
    return libraryService.exportLibrary(includeMedia)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARY_IMPORT, (_event, jsonData: string) => {
    return libraryService.importLibrary(jsonData)
  })

  // Demo Data Management
  ipcMain.handle(IPC_CHANNELS.DEMO_LOAD, () => {
    return libraryService.loadDemoData()
  })

  ipcMain.handle(IPC_CHANNELS.DEMO_CLEAR, () => {
    return libraryService.clearDemoData()
  })

  ipcMain.handle(IPC_CHANNELS.DEMO_HAS, () => {
    return libraryService.hasDemoData()
  })

  // Phase 4: Bible
  ipcMain.handle(IPC_CHANNELS.BIBLE_GET_TRANSLATIONS, () => {
    return bibleService.getTranslations()
  })

  ipcMain.handle(
    IPC_CHANNELS.BIBLE_IMPORT_TRANSLATION,
    (_event, format: 'zefania' | 'osis' | 'usfm' | 'json' | 'sqlite', rawContent: string, meta: any) => {
      return bibleService.importTranslation(format, rawContent, meta)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BIBLE_IMPORT_FILE,
    (_event, filePath: string, meta: any) => {
      return bibleService.importTranslationFromFile(filePath, meta)
    }
  )

  ipcMain.handle(IPC_CHANNELS.BIBLE_DELETE_TRANSLATION, (_event, id: string) => {
    return bibleService.deleteTranslation(id)
  })

  ipcMain.handle(IPC_CHANNELS.BIBLE_SET_DEFAULT, (_event, abbrev: string) => {
    return bibleService.setDefaultTranslation(abbrev)
  })

  ipcMain.handle(IPC_CHANNELS.BIBLE_PARSE_REFERENCE, (_event, input: string) => {
    return parseBibleReference(input)
  })

  ipcMain.handle(
    IPC_CHANNELS.BIBLE_GET_VERSES,
    (_event, reference: string, translationAbbrev?: string, secondaryAbbrev?: string) => {
      return bibleService.getVersesByReference(reference, translationAbbrev, secondaryAbbrev)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.BIBLE_SEARCH_TEXT,
    (_event, query: string, translationAbbrev?: string, filter?: any) => {
      return bibleService.searchBibleText(query, translationAbbrev, filter)
    }
  )

  ipcMain.handle(IPC_CHANNELS.BIBLE_GET_FAVORITES, () => {
    return bibleService.getFavorites()
  })

  ipcMain.handle(IPC_CHANNELS.BIBLE_TOGGLE_FAVORITE, (_event, reference: string) => {
    return bibleService.toggleFavorite(reference)
  })

  ipcMain.handle(IPC_CHANNELS.BIBLE_GET_RECENT, () => {
    return bibleService.getRecentHistory()
  })

  ipcMain.handle(IPC_CHANNELS.BIBLE_ADD_RECENT, (_event, reference: string) => {
    bibleService.addRecentHistory(reference)
    return true
  })

  ipcMain.handle(
    IPC_CHANNELS.BIBLE_GENERATE_SLIDES,
    (_event, verses: any[], secondaryVerses?: any[], dualLayout?: any) => {
      const primaryAbbrev = verses[0]?.translationAbbrev || 'RVR1909'
      const secAbbrev = secondaryVerses?.[0]?.translationAbbrev
      return buildBibleSlides(verses, secondaryVerses, {
        translationAbbrev: primaryAbbrev,
        secondaryAbbrev: secAbbrev,
        dualLayout
      })
    }
  )

  // Role Bible Configs
  ipcMain.handle(IPC_CHANNELS.BIBLE_GET_ROLE_CONFIGS, () => {
    return databaseService.getRoleBibleConfigs()
  })

  ipcMain.handle(IPC_CHANNELS.BIBLE_SAVE_ROLE_CONFIG, (_event, config: RoleBibleConfig) => {
    databaseService.saveRoleBibleConfig(config)
    const allConfigs = databaseService.getRoleBibleConfigs()
    stateManager.updateRoleBibleConfigs(allConfigs)
    return true
  })

  // Phase 5A: Media Items
  ipcMain.handle(IPC_CHANNELS.MEDIA_GET, (_event, type?: any) => {
    return mediaService.getMediaItems(type)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_IMPORT, (_event, sourcePath: string, tags?: string[]) => {
    return mediaService.importMediaFile(sourcePath, tags)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_DELETE, (_event, id: string) => {
    return mediaService.deleteMediaItem(id)
  })

  ipcMain.handle(IPC_CHANNELS.MEDIA_CHECK_INTEGRITY, () => {
    return mediaService.checkIntegrity()
  })

  // Phase 5A: Video & Media Sync
  ipcMain.handle(IPC_CHANNELS.VIDEO_PLAY, (_event, config: VideoItemConfig) => {
    masterMediaSyncService.playVideo(config)
    const videoSlide: any = {
      id: `vid_${config.mediaId}_${Date.now()}`,
      title: 'Video',
      body: '',
      subtitle: '',
      mediaUrl: config.mediaPath || (config as any).filePath || '',
      mediaType: 'video',
      videoPlaying: true,
      fitMode: 'contain'
    }
    return stateManager.sendSlide(videoSlide)
  })

  ipcMain.handle(
    IPC_CHANNELS.VIDEO_CONTROL,
    (_event, action: 'play' | 'pause' | 'stop' | 'seek', time?: number) => {
      const tick = masterMediaSyncService.controlVideo(action, time)
      if (tick) {
        windowManager.broadcastToAll(IPC_CHANNELS.MEDIA_SYNC_TICK, tick)
      }
      return true
    }
  )

  // Phase 5A: Independent Audio
  ipcMain.handle(
    IPC_CHANNELS.AUDIO_PLAY_INDEPENDENT,
    (_event, mediaId: string, filePath: string, title?: string) => {
      const audioState = masterMediaSyncService.playIndependentAudio(mediaId, filePath, title)
      stateManager.updateIndependentAudio(audioState)
      return true
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.AUDIO_CONTROL_INDEPENDENT,
    (_event, action: 'play' | 'pause' | 'stop' | 'fade-out' | 'volume', value?: number) => {
      const audioState = masterMediaSyncService.controlIndependentAudio(action, value)
      stateManager.updateIndependentAudio(audioState)
      return true
    }
  )

  // Phase 5A: PDF
  ipcMain.handle(IPC_CHANNELS.PDF_GET_PAGE_COUNT, (_event, filePath: string) => {
    return pdfService.getPdfPageCount(filePath)
  })

  // Phase 5B: PowerPoint
  ipcMain.handle(IPC_CHANNELS.POWERPOINT_DETECT_CONVERTERS, () => {
    return powerpointService.detectConverters()
  })

  ipcMain.handle(IPC_CHANNELS.POWERPOINT_IMPORT, (_event, filePath: string) => {
    return powerpointService.importPresentation(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.POWERPOINT_EDIT, (_event, filePath: string) => {
    return powerpointService.editInPowerPoint(filePath)
  })

  ipcMain.handle(
    IPC_CHANNELS.POWERPOINT_CHECK_MODIFIED,
    (_event, originalPath: string, recordedHash: string) => {
      return powerpointService.checkIfModified(originalPath, recordedHash)
    }
  )

  ipcMain.handle(IPC_CHANNELS.POWERPOINT_CANCEL, (_event, jobId: string) => {
    return powerpointService.cancelJob(jobId)
  })

  // Phase 5B: Video Conversion (FFmpeg)
  ipcMain.handle(IPC_CHANNELS.FFMPEG_DETECT, () => {
    return ffmpegService.detectFfmpeg()
  })

  ipcMain.handle(
    IPC_CHANNELS.FFMPEG_CONVERT,
    (_event, jobId: string, inputPath: string, outputPath: string) => {
      return ffmpegService.convertVideo(jobId, inputPath, outputPath)
    }
  )

  ipcMain.handle(IPC_CHANNELS.FFMPEG_CANCEL, (_event, jobId: string) => {
    return ffmpegService.cancelConversion(jobId)
  })

  // Folder Import (Images)
  ipcMain.handle(IPC_CHANNELS.MEDIA_IMPORT_FOLDER, async (_event, folderPath: string) => {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`La carpeta no existe: ${folderPath}`)
    }
    const stat = fs.statSync(folderPath)
    if (!stat.isDirectory()) {
      throw new Error('La ruta especificada no es una carpeta.')
    }

    const files = fs.readdirSync(folderPath)
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    const importedItems = []

    for (const f of files) {
      const ext = path.extname(f).toLowerCase()
      if (validExtensions.includes(ext)) {
        const fullPath = path.join(folderPath, f)
        try {
          const item = await mediaService.importMediaFile(fullPath, [path.basename(folderPath)])
          importedItems.push(item)
        } catch (err) {
          logger.warn(`Could not import image ${fullPath}:`, err)
        }
      }
    }
    return importedItems
  })

  // Connect master media sync events to broadcast to all windows
  masterMediaSyncService.on('sync-tick', (tick) => {
    windowManager.broadcastToAll(IPC_CHANNELS.MEDIA_SYNC_TICK, tick)
  })

  masterMediaSyncService.on('audio-updated', (audioState) => {
    stateManager.updateIndependentAudio(audioState)
  })

  // Diagnostics & Logging
  ipcMain.on(
    IPC_CHANNELS.LOG_FPS_DROP,
    (_event, role: string, fps: number, displayId?: number) => {
      logger.warn(
        `[FPS Drop Alert] Role '${role}' on display ${displayId ?? 'unknown'} dropped to ${fps.toFixed(1)} FPS!`
      )
    }
  )

  ipcMain.on(
    IPC_CHANNELS.LOG_MEDIA_ERROR,
    (_event, role: string, url: string, message: string) => {
      logger.error(`[Media Decode Error] Role '${role}' error for URL '${url}': ${message}`)
      windowManager.emitNotification({
        id: `media_err_${Date.now()}`,
        title: 'Error de Reproducción de Video',
        message: `No se pudo reproducir el medio en la salida '${role}'. La salida continuará mostrando el fondo.`,
        type: 'error',
        timestamp: Date.now()
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.OUTPUT_CAPTURE_ROLE, async (_event, role: string) => {
    return windowManager.captureOutputWindow(role)
  })

  ipcMain.handle(IPC_CHANNELS.OUTPUT_OPEN_PREVIEW, async (_event, role: string) => {
    const primary = displayManager.getPrimaryDisplay()
    const win = windowManager.createOutputWindow(role, primary)
    return !!win
  })

  ipcMain.handle(IPC_CHANNELS.OUTPUT_CLOSE, async (event, role: string) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender)
    if (senderWin && !senderWin.isDestroyed()) {
      for (const [r, w] of windowManager.getOutputWindows().entries()) {
        if (w === senderWin) {
          windowManager.closeOutputWindow(r)
          return true
        }
      }
      senderWin.close()
    }
    if (role) {
      windowManager.closeOutputWindow(role)
    }
    return true
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_ENV_INFO, () => {
    return {
      isDev: !app.isPackaged,
      version: app.getVersion(),
      userDataPath: app.getPath('userData')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DEV_COPY_PROD_LIBRARY, () => {
    return databaseService.copyFromProduction()
  })

  // --- NATIVE DIALOGS (A.4) ---
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FILE,
    async (_event, options?: { title?: string; defaultPath?: string; buttonLabel?: string; filters?: { name: string; extensions: string[] }[]; multiSelections?: boolean }) => {
      const parent = BrowserWindow.getFocusedWindow() || undefined
      const res = await dialog.showOpenDialog(parent as any, {
        title: options?.title || 'Seleccionar Archivo',
        defaultPath: options?.defaultPath,
        buttonLabel: options?.buttonLabel || 'Seleccionar',
        filters: options?.filters,
        properties: options?.multiSelections ? ['openFile', 'multiSelections'] : ['openFile']
      })
      if (res.canceled) return null
      return res.filePaths
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DIALOG_OPEN_FOLDER,
    async (_event, options?: { title?: string; defaultPath?: string }) => {
      const parent = BrowserWindow.getFocusedWindow() || undefined
      const res = await dialog.showOpenDialog(parent as any, {
        title: options?.title || 'Seleccionar Carpeta',
        defaultPath: options?.defaultPath,
        properties: ['openDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) return null
      return res.filePaths[0]
    }
  )

  // --- EXTERNAL FILE WATCHING (A.5) ---
  ipcMain.handle(IPC_CHANNELS.WATCH_FILE, (_event, filePath: string, type: 'powerpoint' | 'media') => {
    return fileWatcherService.watch(filePath, type)
  })

  ipcMain.handle(IPC_CHANNELS.UNWATCH_FILE, (_event, filePath: string) => {
    return fileWatcherService.unwatch(filePath)
  })

  // --- USER LIBRARIES (ProPresenter 7 Style) ---
  ipcMain.handle(IPC_CHANNELS.LIBRARIES_GET, () => {
    return databaseService.getLibraries()
  })

  ipcMain.handle('libraries:get-items', (_event, libraryId: string) => {
    return databaseService.getLibraryItems(libraryId)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARIES_SAVE, (_event, library: UserLibrary) => {
    return databaseService.saveLibrary(library)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARIES_RENAME, (_event, id: string, newName: string) => {
    return databaseService.renameLibrary(id, newName)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARIES_REORDER, (_event, orderedIds: string[]) => {
    return databaseService.reorderLibraries(orderedIds)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARIES_DELETE, (_event, id: string) => {
    return databaseService.deleteLibrary(id)
  })

  ipcMain.handle(IPC_CHANNELS.LIBRARIES_MOVE_ITEM, (_event, itemRefId: string, targetLibraryId: string) => {
    return databaseService.moveLibraryItem(itemRefId, targetLibraryId)
  })

  // --- TIMERS ---
  let activeTimersInterval: NodeJS.Timeout | null = null

  function ensureTimersLoop() {
    if (activeTimersInterval) return
    activeTimersInterval = setInterval(() => {
      const timers = databaseService.getTimers()
      const running = timers.filter((t) => t.isRunning)
      if (running.length === 0) {
        if (activeTimersInterval) {
          clearInterval(activeTimersInterval)
          activeTimersInterval = null
        }
        return
      }

      for (const t of running) {
        if (t.type === 'stopwatch') {
          t.currentSeconds += 1
        } else if (t.type === 'countdown_duration') {
          t.currentSeconds -= 1
        } else if (t.type === 'countdown_to_time' && t.targetTime) {
          const now = new Date()
          const parts = t.targetTime.split(':').map(Number)
          const target = new Date(now)
          target.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0)
          const diff = Math.floor((target.getTime() - now.getTime()) / 1000)
          t.currentSeconds = diff
        }
        databaseService.saveTimer(t)
      }

      windowManager.broadcastToAll(IPC_CHANNELS.TIMERS_TICK, timers)
    }, 1000)
  }

  ipcMain.handle(IPC_CHANNELS.TIMERS_GET, () => {
    return databaseService.getTimers()
  })

  ipcMain.handle(IPC_CHANNELS.TIMERS_SAVE, (_event, timer: PresentationTimer) => {
    const saved = databaseService.saveTimer(timer)
    if (saved.isRunning) ensureTimersLoop()
    return saved
  })

  ipcMain.handle(IPC_CHANNELS.TIMERS_DELETE, (_event, id: string) => {
    return databaseService.deleteTimer(id)
  })

  ipcMain.handle('timers:control', (_event, timerId: string, action: 'start' | 'pause' | 'reset') => {
    const timers = databaseService.getTimers()
    const found = timers.find((t) => t.id === timerId)
    if (!found) throw new Error('Temporizador no encontrado')

    if (action === 'start') {
      found.isRunning = true
      databaseService.saveTimer(found)
      ensureTimersLoop()
    } else if (action === 'pause') {
      found.isRunning = false
      databaseService.saveTimer(found)
    } else if (action === 'reset') {
      found.isRunning = false
      found.currentSeconds = found.type === 'stopwatch' ? 0 : found.durationSeconds
      databaseService.saveTimer(found)
    }

    const updated = databaseService.getTimers()
    windowManager.broadcastToAll(IPC_CHANNELS.TIMERS_TICK, updated)
    return found
  })

  // --- Phase 5C: YouTube Integration Handlers ---
  youtubeOutputManager.setAdStatusCallback((isAd) => {
    windowManager.broadcastToAll(IPC_CHANNELS.YOUTUBE_AD_STATUS, isAd)
  })

  youtubeOutputManager.setSyncCallback((tick) => {
    windowManager.broadcastToAll(IPC_CHANNELS.YOUTUBE_SYNC_TICK, tick)
  })

  youTubeBrowserManager.setSyncCallback((tick) => {
    youtubeOutputManager.syncToTick(tick)
    windowManager.broadcastToAll(IPC_CHANNELS.YOUTUBE_SYNC_TICK, tick)
  })

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_GET_ITEMS, () => {
    return databaseService.getYouTubeItems()
  })

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_SAVE_ITEM, (_event, item: YouTubeItem) => {
    return databaseService.saveYouTubeItem(item)
  })

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_DELETE_ITEM, (_event, id: string) => {
    return databaseService.deleteYouTubeItem(id)
  })

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_CHECK_AVAILABILITY, (_event, videoIdOrUrl: string) => {
    return youtubeService.checkAvailability(videoIdOrUrl)
  })

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_VERIFY_PLAYLIST, (_event, items: ServiceItem[]) => {
    return youtubeService.verifyPlaylistYouTubeItems(items)
  })

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_GET_METADATA, (_event, videoIdOrUrl: string) => {
    return youtubeService.fetchMetadata(videoIdOrUrl)
  })

  ipcMain.handle(
    IPC_CHANNELS.YOUTUBE_OPEN_BROWSER,
    (_event, bounds: { x: number; y: number; width: number; height: number }) => {
      const opWin = windowManager.getOperatorWindow()
      if (opWin && !opWin.isDestroyed()) {
        youTubeBrowserManager.attachToWindow(opWin, bounds)
        return true
      }
      return false
    }
  )

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_CLOSE_BROWSER, () => {
    youTubeBrowserManager.close()
    return true
  })

  ipcMain.handle(
    IPC_CHANNELS.YOUTUBE_NAVIGATE_BROWSER,
    (_event, action: 'back' | 'forward' | 'home' | 'reload' | 'go', url?: string) => {
      youTubeBrowserManager.navigate(action, url)
      return true
    }
  )

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_GET_BROWSER_URL, () => {
    return youTubeBrowserManager.getCurrentUrl()
  })

  ipcMain.handle(
    IPC_CHANNELS.YOUTUBE_SET_BROWSER_BOUNDS,
    (_event, bounds: { x: number; y: number; width: number; height: number }) => {
      youTubeBrowserManager.setBounds(bounds)
      return true
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.YOUTUBE_SET_BROWSER_VISIBLE,
    (_event, visible: boolean) => {
      youTubeBrowserManager.setVisible(visible)
      return true
    }
  )

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_CLEAR_SESSION, async () => {
    return await youtubeService.clearSession()
  })

  ipcMain.handle(
    IPC_CHANNELS.YOUTUBE_CONTROL,
    (
      _event,
      action: 'prepare' | 'go-live' | 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'mute' | 'status',
      payload?: any
    ) => {
      switch (action) {
        case 'status':
          // Status query only; does not modify playback
          break
        case 'prepare':
          youtubeOutputManager.prepareVideo(
            payload as YouTubeItemConfig,
            windowManager.getOutputWindows()
          )
          break
        case 'go-live':
          youtubeOutputManager.goLive()
          break
        case 'play':
          youtubeOutputManager.play()
          break
        case 'pause':
          youtubeOutputManager.pause()
          break
        case 'stop':
          youtubeOutputManager.stop()
          break
        case 'seek':
          youtubeOutputManager.seek(Number(payload) || 0)
          break
        case 'volume':
          youtubeOutputManager.setVolume(Number(payload) || 1.0)
          break
        case 'mute':
          youtubeOutputManager.setAudioMuted(Boolean(payload))
          break
      }
      return youtubeOutputManager.getPlaybackState()
    }
  )

  ipcMain.handle(IPC_CHANNELS.YOUTUBE_DOWNLOAD_VIDEO, async (event, youtubeUrl: string) => {
    const mediaDir = path.join(app.getPath('userData'), 'media')
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true })
    }
    const result = await youtubeService.downloadVideoToLocal(youtubeUrl, mediaDir, (progress) => {
      try {
        event.sender.send(IPC_CHANNELS.YOUTUBE_DOWNLOAD_PROGRESS, progress)
      } catch (_err) {
        // Window might have closed during download
      }
    })
    if (result.success && result.filePath) {
      const importedItem = await mediaService.importMediaFile(result.filePath, ['YouTube'])
      return { success: true, item: importedItem }
    }
    return result
  })

  // Floating Output Preview Window (Requirement 3)
  ipcMain.handle(IPC_CHANNELS.FLOATING_PREVIEW_OPEN, async (_event, initialRole: string) => {
    windowManager.openFloatingPreviewWindow(initialRole || 'main')
    return true
  })

  ipcMain.handle(IPC_CHANNELS.FLOATING_PREVIEW_SET_ALWAYS_ON_TOP, async (_event, alwaysOnTop: boolean) => {
    return windowManager.setFloatingPreviewAlwaysOnTop(alwaysOnTop)
  })

  ipcMain.handle(IPC_CHANNELS.FLOATING_PREVIEW_CLOSE, async () => {
    windowManager.closeFloatingPreviewWindow()
    return true
  })

  // --- PHASE 6: REMOTE CONTROL HANDLERS ---
  ipcMain.handle(IPC_CHANNELS.REMOTE_GET_CONFIG, async () => {
    return remoteServer.loadConfig()
  })

  ipcMain.handle(IPC_CHANNELS.REMOTE_SAVE_CONFIG, async (_event, config) => {
    return remoteServer.saveConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.REMOTE_GET_STATUS, async () => {
    return remoteServer.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.REMOTE_REGENERATE_PIN, async () => {
    const newPin = remoteAuthService.regeneratePin()
    await remoteServer.saveConfig({ pin: newPin })
    return newPin
  })

  ipcMain.handle(IPC_CHANNELS.REMOTE_KICK_CLIENT, async (_event, clientId: string) => {
    return remoteServer.kickClient(clientId)
  })

  ipcMain.handle(IPC_CHANNELS.REMOTE_GET_NETWORK_INTERFACES, async () => {
    return remoteServer.getNetworkInterfaces()
  })

  // --- PHASE 6: STAGE LAYOUTS HANDLERS ---
  ipcMain.handle(IPC_CHANNELS.STAGE_GET_LAYOUTS, async () => {
    return stageLayoutService.getStageLayouts()
  })

  ipcMain.handle(IPC_CHANNELS.STAGE_SAVE_LAYOUT, async (_event, layout) => {
    const saved = stageLayoutService.saveStageLayout(layout)
    stateManager.setActiveStageLayout(stageLayoutService.getAssignedStageLayout())
    return saved
  })

  ipcMain.handle(IPC_CHANNELS.STAGE_DELETE_LAYOUT, async (_event, layoutId: string) => {
    return stageLayoutService.deleteStageLayout(layoutId)
  })

  ipcMain.handle(IPC_CHANNELS.STAGE_GET_ASSIGNMENT, async (_event, targetKey?: string) => {
    return stageLayoutService.getAssignedStageLayout(targetKey)
  })

  ipcMain.handle(IPC_CHANNELS.STAGE_SET_ASSIGNMENT, async (_event, layoutId: string, targetKey?: string) => {
    const ok = stageLayoutService.setAssignedStageLayout(layoutId, targetKey)
    if (ok) {
      stateManager.setActiveStageLayout(stageLayoutService.getAssignedStageLayout())
    }
    return ok
  })

  // --- PHASE 6: MESSAGES HANDLERS ---
  ipcMain.handle(IPC_CHANNELS.MESSAGES_GET_ACTIVE, async () => {
    return messageService.getActiveMessage()
  })

  ipcMain.handle(IPC_CHANNELS.MESSAGES_SEND, async (_event, msg) => {
    return messageService.sendMessage(msg)
  })

  ipcMain.handle(IPC_CHANNELS.MESSAGES_CLEAR, async () => {
    return messageService.clearMessage()
  })

  ipcMain.handle(IPC_CHANNELS.MESSAGES_GET_PRESETS, async () => {
    return messageService.getMessagePresets()
  })

  ipcMain.handle(IPC_CHANNELS.MESSAGES_SAVE_PRESET, async (_event, text: string) => {
    return messageService.saveMessagePreset(text)
  })

  ipcMain.handle(IPC_CHANNELS.MESSAGES_DELETE_PRESET, async (_event, text: string) => {
    return messageService.deleteMessagePreset(text)
  })

  // --- PHASE 7: STABILITY, RECOVERY, HEALTH, CHECKLIST, DIAGNOSTICS & REHEARSAL ---
  ipcMain.handle(IPC_CHANNELS.RECOVERY_CHECK, async () => {
    return sessionRecoveryService.checkRecovery()
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_DISMISS, async () => {
    return sessionRecoveryService.dismissRecovery()
  })

  ipcMain.handle(IPC_CHANNELS.RECOVERY_GET_SNAPSHOT, async () => {
    return sessionRecoveryService.getPendingSnapshot()
  })

  ipcMain.handle(IPC_CHANNELS.OUTPUT_HEALTH_GET, async () => {
    return outputHealthService.getStatuses()
  })

  ipcMain.on(IPC_CHANNELS.OUTPUT_HEALTH_HEARTBEAT, (_event, heartbeat) => {
    if (heartbeat && heartbeat.role) {
      outputHealthService.recordHeartbeat(
        heartbeat.role,
        heartbeat.fps || 60,
        heartbeat.timestamp || Date.now(),
        heartbeat.lastError
      )
    }
  })

  ipcMain.handle(IPC_CHANNELS.SYSTEM_METRICS_GET, async () => {
    return systemMonitorService.getMetrics()
  })

  ipcMain.handle(IPC_CHANNELS.CHECKLIST_RUN, async (_event, plan?: ServicePlan) => {
    return checklistService.runChecklist(plan)
  })

  ipcMain.handle(IPC_CHANNELS.CHECKLIST_FIX_ITEM, async (_event, itemId: string, actionType: string) => {
    return checklistService.fixItem(itemId, actionType)
  })

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_GET_LOGS, async (_event, options) => {
    return diagnosticsService.getLogs(options)
  })

  ipcMain.handle(IPC_CHANNELS.DIAGNOSTICS_EXPORT_ZIP, async () => {
    return diagnosticsService.exportDiagnosticsZip()
  })

  ipcMain.handle(IPC_CHANNELS.REHEARSAL_SET_MODE, async (_event, enabled: boolean) => {
    return rehearsalService.setRehearsalMode(enabled)
  })

  ipcMain.handle(IPC_CHANNELS.REHEARSAL_GET_STATUS, async () => {
    return rehearsalService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.REHEARSAL_GET_SUMMARY, async () => {
    return rehearsalService.getSummary()
  })

  ipcMain.handle(IPC_CHANNELS.EMERGENCY_ACTIVATE, async () => {
    return emergencyService.activateEmergency()
  })

  ipcMain.handle(IPC_CHANNELS.EMERGENCY_DEACTIVATE, async () => {
    return emergencyService.deactivateEmergency()
  })

  ipcMain.handle(IPC_CHANNELS.EMERGENCY_GET_STATUS, async () => {
    return emergencyService.isEmergency()
  })

  ipcMain.handle(IPC_CHANNELS.SAFE_MODE_GET_STATUS, async () => {
    return emergencyService.isSafeModeEnabled()
  })

  // =========================================================================
  // Phase 8: Macros, Props, Loops & MIDI
  // =========================================================================

  // Wire MacroEngine execution callbacks to real application controllers
  macroEngine.registerCallbacks({
    onNavigate: (direction, itemId, slideIndex) => {
      windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, {
        type: direction === 'specific' ? 'select-item' : direction.replace('_', '-'),
        itemId,
        slideIndex
      })
    },
    onTimerControl: (timerId, action) => {
      const timers = databaseService.getTimers()
      const target = timers.find((t) => t.id === timerId) || timers[0]
      if (target) {
        if (action === 'start') target.isRunning = true
        else if (action === 'pause') target.isRunning = false
        else if (action === 'reset') {
          target.isRunning = false
          target.currentSeconds = target.type === 'stopwatch' ? 0 : target.durationSeconds
        }
        databaseService.saveTimer(target)
        windowManager.broadcastToAll(IPC_CHANNELS.TIMERS_TICK, databaseService.getTimers())
      }
    },
    onMediaControl: (action, seekSec) => {
      masterMediaSyncService.controlVideo(action, seekSec)
    },
    onAudioPlay: (filePath, fadeInSec, volume) => {
      masterMediaSyncService.playIndependentAudio(`macro_audio_${Date.now()}`, filePath, filePath)
      if (typeof volume === 'number') {
        masterMediaSyncService.controlIndependentAudio('volume', volume)
      }
    }
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_GET_ALL, async () => {
    return databaseService.getMacros()
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_SAVE, async (_event, macro: MacroItem) => {
    return databaseService.saveMacro(macro)
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_DELETE, async (_event, id: string) => {
    return databaseService.deleteMacro(id)
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_DUPLICATE, async (_event, id: string) => {
    const all = databaseService.getMacros()
    const original = all.find((m) => m.id === id)
    if (!original) {
      throw new Error(`Macro '${id}' no encontrada.`)
    }
    const duplicated: MacroItem = {
      ...original,
      id: `macro_${Date.now()}`,
      name: `${original.name} (Copia)`,
      isBuiltIn: false,
      shortcut: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    return databaseService.saveMacro(duplicated)
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_RUN, async (_event, id: string) => {
    return macroEngine.runMacro(id)
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_RUN_STEP, async (_event, id: string, actionIndex: number) => {
    return macroEngine.runStep(id, actionIndex)
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_STOP_ALL, async () => {
    return macroEngine.stopAllMacros()
  })

  ipcMain.handle(IPC_CHANNELS.MACROS_GET_STATUS, async () => {
    return macroEngine.getExecutionState()
  })

  ipcMain.handle(IPC_CHANNELS.PROPS_GET_ALL, async () => {
    return propService.getProps()
  })

  ipcMain.handle(IPC_CHANNELS.PROPS_SAVE, async (_event, prop: PropItem) => {
    return propService.saveProp(prop)
  })

  ipcMain.handle(IPC_CHANNELS.PROPS_DELETE, async (_event, id: string) => {
    return propService.deleteProp(id)
  })

  ipcMain.handle(IPC_CHANNELS.PROPS_TOGGLE, async (_event, id: string, forceActive?: boolean) => {
    return propService.toggleProp(id, forceActive)
  })

  ipcMain.handle(IPC_CHANNELS.PROPS_GET_ACTIVE, async () => {
    return propService.getActiveProps()
  })

  ipcMain.handle(IPC_CHANNELS.LOOP_START, async (_event, config: LoopConfig, totalSlides: number) => {
    return loopService.startLoop(config, totalSlides, (_nextIndex) => {
      windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, {
        type: 'next-slide'
      })
    })
  })

  ipcMain.handle(IPC_CHANNELS.LOOP_STOP, async () => {
    return loopService.stopLoop(true)
  })

  ipcMain.handle(IPC_CHANNELS.LOOP_GET_STATUS, async () => {
    return loopService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.MIDI_GET_INPUTS, async () => {
    return midiService.getDevices()
  })

  ipcMain.handle(IPC_CHANNELS.MIDI_TRIGGER_MESSAGE, async (_event, msg) => {
    midiService.handleMidiMessage(msg)
  })

  // Phase 9: OBS Studio Integration
  ipcMain.handle(IPC_CHANNELS.OBS_GET_CONFIG, async () => {
    return obsWebSocketService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_SAVE_CONFIG, async (_event, config) => {
    obsWebSocketService.saveConfig(config)
    return obsWebSocketService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_CONNECT, async (_event, overrideOptions) => {
    return obsWebSocketService.connect(overrideOptions)
  })

  ipcMain.handle(IPC_CHANNELS.OBS_DISCONNECT, async () => {
    obsWebSocketService.disconnect()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.OBS_GET_STATUS, async () => {
    return obsWebSocketService.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_GET_SCENES, async () => {
    return obsWebSocketService.getScenes()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_SET_SCENE, async (_event, sceneName: string) => {
    return obsWebSocketService.setCurrentProgramScene(sceneName)
  })

  ipcMain.handle(IPC_CHANNELS.OBS_START_STREAM, async () => {
    return obsWebSocketService.startStreaming()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_STOP_STREAM, async () => {
    return obsWebSocketService.stopStreaming()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_START_RECORD, async () => {
    return obsWebSocketService.startRecording()
  })

  ipcMain.handle(IPC_CHANNELS.OBS_STOP_RECORD, async () => {
    return obsWebSocketService.stopRecording()
  })

  obsWebSocketService.setOnStatusChanged((st) => {
    windowManager.broadcastToAll(IPC_CHANNELS.OBS_STATUS_CHANGED, st)
  })

  // Phase 9: Broadcast Studio, Streaming & Recording
  ipcMain.handle(IPC_CHANNELS.BROADCAST_GET_SETTINGS, async () => {
    return databaseService.getBroadcastSettings()
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_SAVE_SETTINGS, async (_event, settings) => {
    return databaseService.saveBroadcastSettings(settings)
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_GET_SCENES, async () => {
    return databaseService.getBroadcastScenes()
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_SAVE_SCENE, async (_event, scene) => {
    return databaseService.saveBroadcastScene(scene)
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_DELETE_SCENE, async (_event, id: string) => {
    return databaseService.deleteBroadcastScene(id)
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_GET_AUDIO_MIXER, async () => {
    return databaseService.getAudioMixerConfig()
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_SAVE_AUDIO_MIXER, async (_event, mixerState) => {
    return databaseService.saveAudioMixerConfig(mixerState)
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_GET_STATUS, async () => {
    return broadcastEngine.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_START_STREAM, async () => {
    return broadcastEngine.start({ stream: true })
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_STOP_STREAM, async () => {
    return broadcastEngine.stop({ stream: true })
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_START_RECORD, async () => {
    return broadcastEngine.start({ record: true })
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_STOP_RECORD, async () => {
    return broadcastEngine.stop({ record: true })
  })

  ipcMain.handle(IPC_CHANNELS.BROADCAST_LIST_DESKTOP_SOURCES, async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: false
      })
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnailDataUrl: s.thumbnail.toDataURL()
      }))
    } catch (err: any) {
      logger.warn('[Broadcast] Error listing desktop sources:', err.message)
      return []
    }
  })

  // =========================================================================
  // Phase 10: Extras (Sync, Importers, CCLI Reports, Subtitles, AI, Backups)
  // =========================================================================

  // 1. Multi-PC Sync
  ipcMain.handle(IPC_CHANNELS.SYNC_EXPORT_PACKAGE, async (_event, targetFolder: string) => {
    return librarySyncService.exportPackage(targetFolder)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_INSPECT_PACKAGE, async (_event, sourceFolder: string) => {
    return librarySyncService.inspectPackage(sourceFolder)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_MERGE_PACKAGE, async (_event, sourceFolder: string, resolutions: any) => {
    return librarySyncService.mergePackage(sourceFolder, resolutions)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_UNDO, async () => {
    return librarySyncService.undoSync()
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_CONFIG, async () => {
    return databaseService.getSyncConfig()
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_SAVE_CONFIG, async (_event, config: any) => {
    return databaseService.saveSyncConfig(config)
  })

  // 2. Song Importers
  ipcMain.handle(IPC_CHANNELS.SONG_IMPORT_PARSE_FILE, async (_event, filePath: string) => {
    return songImporterService.parseFile(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.SONG_IMPORT_EXECUTE, async (_event, songs: any[], targetLibraryId?: string) => {
    return songImporterService.executeImport(songs, targetLibraryId)
  })

  // 3. CCLI Song Usage
  ipcMain.handle(
    IPC_CHANNELS.CCLI_RECORD_USAGE,
    async (
      _event,
      songId: string,
      title: string,
      artist?: string,
      ccliNumber?: string,
      copyright?: string,
      serviceId?: string,
      serviceTitle?: string
    ) => {
      return ccliService.recordUsage({
        songId,
        title,
        artist,
        ccliNumber,
        copyright,
        serviceId,
        serviceTitle
      })
    }
  )

  ipcMain.handle(IPC_CHANNELS.CCLI_GET_REPORT, async (_event, from?: string, to?: string) => {
    return ccliService.getReport(from, to)
  })

  ipcMain.handle(IPC_CHANNELS.CCLI_EXPORT_CSV, async (_event, from?: string, to?: string) => {
    return ccliService.exportCsv(from, to)
  })

  ipcMain.handle(IPC_CHANNELS.CCLI_CLEAR_HISTORY, async () => {
    return ccliService.clearHistory()
  })

  ipcMain.handle(IPC_CHANNELS.CCLI_GET_CONFIG, async () => {
    return ccliService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.CCLI_SAVE_CONFIG, async (_event, config: { enabled: boolean }) => {
    return ccliService.saveConfig(config)
  })

  // 4. Live Subtitles
  ipcMain.handle(IPC_CHANNELS.SUBTITLES_GET_CONFIG, async () => {
    return liveSubtitlesService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_SAVE_CONFIG, async (_event, config: any) => {
    return liveSubtitlesService.saveConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_SEND, async (_event, subtitle: any) => {
    return liveSubtitlesService.sendSubtitle(subtitle)
  })

  ipcMain.handle(IPC_CHANNELS.SUBTITLES_CLEAR, async () => {
    return liveSubtitlesService.clearSubtitle()
  })

  // 5. AI Assistant
  ipcMain.handle(IPC_CHANNELS.AI_GET_CONFIG, async () => {
    return aiAssistantService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.AI_SAVE_CONFIG, async (_event, config: any) => {
    return aiAssistantService.saveConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.AI_EXECUTE_TASK, async (_event, request: any) => {
    return aiAssistantService.executeTask(request)
  })

  // 6. Secondary Backup
  ipcMain.handle(IPC_CHANNELS.BACKUP_GET_SECONDARY_CONFIG, async () => {
    return secondaryBackupService.getConfig()
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_SAVE_SECONDARY_CONFIG, async (_event, config: any) => {
    return secondaryBackupService.saveConfig(config)
  })

  ipcMain.handle(IPC_CHANNELS.BACKUP_RUN_SECONDARY, async () => {
    return secondaryBackupService.runSecondaryBackup()
  })

  broadcastEngine.on('status-changed', (st) => {
    windowManager.broadcastToAll(IPC_CHANNELS.BROADCAST_STATUS_CHANGED, st)
  })

  // Hook DisplayManager events
  displayManager.on('displays-changed', (displays) => {
    logger.info(`Notifying windows of displays-changed (${displays.length} displays)`)
    windowManager.broadcastToAll(IPC_CHANNELS.DISPLAYS_CHANGED, displays)
    windowManager.syncOutputWindows()
  })

  // Hook StateManager updates
  stateManager.on('state-updated', (state) => {
    sessionRecoveryService.updateSessionState({ presenterState: state })
    windowManager.broadcastToAll(IPC_CHANNELS.STATE_UPDATED, state)
  })

  // Hook OutputHealthService events
  outputHealthService.on('health-changed', (statuses) => {
    windowManager.broadcastToAll(IPC_CHANNELS.OUTPUT_HEALTH_CHANGED, statuses)
  })

  // Hook SystemMonitorService events
  systemMonitorService.on('metrics-tick', (metrics) => {
    windowManager.broadcastToAll(IPC_CHANNELS.SYSTEM_METRICS_TICK, metrics)
  })

  // Hook RehearsalService events
  rehearsalService.on('mode-changed', (active) => {
    windowManager.broadcastToAll(IPC_CHANNELS.REHEARSAL_MODE_CHANGED, active)
  })

  // Hook Phase 8 Engine Events
  macroEngine.on('macro-status-changed', (st) => {
    windowManager.broadcastToAll(IPC_CHANNELS.MACROS_STATUS_CHANGED, st)
  })

  propService.on('active-props-changed', (props) => {
    windowManager.broadcastToAll(IPC_CHANNELS.PROPS_ACTIVE_CHANGED, props)
  })

  loopService.on('loop-status-changed', (status) => {
    windowManager.broadcastToAll(IPC_CHANNELS.LOOP_STATUS_CHANGED, status)
  })
}
