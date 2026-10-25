import { ipcMain, app, dialog, BrowserWindow } from 'electron'
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
  LibraryItemReference,
  PresentationTimer
} from '../shared/types'
import { displayManager } from './display-manager'
import { databaseService } from './db/database-service'
import { stateManager } from './state-manager'
import { windowManager } from './window-manager'
import { shortcutsManager } from './shortcuts-manager'
import { libraryService } from './library-service'
import { bibleService } from './bible/bible-service'
import { mediaService } from './media/media-service'
import { masterMediaSyncService } from './media/master-media-sync-service'
import { pdfService } from './pdf/pdf-service'
import { powerpointService } from './powerpoint/powerpoint-service'
import { ffmpegService } from './media/ffmpeg-service'
import { fileWatcherService } from './media/file-watcher-service'
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
      return stateManager.setGlobalControl(control, value)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STATE_TOGGLE_CONTROL,
    (_event, control: keyof GlobalControls) => {
      return stateManager.toggleGlobalControl(control)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.STATE_SEND_SLIDE,
    (_event, slide: TestSlide | SlideItem, targetRoles?: string[], nextSlide?: SlideItem) => {
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

  // Phase 3: Themes
  ipcMain.handle(IPC_CHANNELS.THEMES_GET, () => {
    return libraryService.getThemes()
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_SAVE, (_event, theme: ThemeConfig) => {
    const saved = libraryService.saveTheme(theme)
    if (saved.isDefault) {
      stateManager.setTheme(saved)
    }
    return saved
  })

  ipcMain.handle(IPC_CHANNELS.THEMES_SET_DEFAULT, (_event, id: string) => {
    const success = libraryService.setDefaultTheme(id)
    const themes = libraryService.getThemes()
    const found = themes.find((t) => t.id === id)
    if (found) {
      stateManager.setTheme(found)
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
    (_event, format: 'zefania' | 'osis' | 'usfm' | 'json', rawContent: string, meta: any) => {
      return bibleService.importTranslation(format, rawContent, meta)
    }
  )

  ipcMain.handle(IPC_CHANNELS.BIBLE_DELETE_TRANSLATION, (_event, id: string) => {
    return bibleService.deleteTranslation(id)
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

  // Hook DisplayManager events
  displayManager.on('displays-changed', (displays) => {
    logger.info(`Notifying windows of displays-changed (${displays.length} displays)`)
    windowManager.broadcastToAll(IPC_CHANNELS.DISPLAYS_CHANGED, displays)
    windowManager.syncOutputWindows()
  })

  // Hook StateManager updates
  stateManager.on('state-updated', (state) => {
    windowManager.broadcastToAll(IPC_CHANNELS.STATE_UPDATED, state)
  })
}
