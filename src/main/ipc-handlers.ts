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
  ServicePlan
} from '../shared/types'
import { displayManager } from './display-manager'
import { databaseService } from './db/database-service'
import { stateManager } from './state-manager'
import { windowManager } from './window-manager'
import { shortcutsManager } from './shortcuts-manager'
import { libraryService } from './library-service'
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

  // Diagnostics & Logging
  ipcMain.on(
    IPC_CHANNELS.LOG_FPS_DROP,
    (_event, role: string, fps: number, displayId?: number) => {
      logger.warn(
        `[FPS Drop Alert] Role '${role}' on display ${displayId ?? 'unknown'} dropped to ${fps.toFixed(1)} FPS!`
      )
    }
  )

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
