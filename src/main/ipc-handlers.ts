import { ipcMain, app } from 'electron'
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
  VideoItemConfig
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
  ipcMain.handle(IPC_CHANNELS.LIBRARY_EXPORT, () => {
    return libraryService.exportLibrary()
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
