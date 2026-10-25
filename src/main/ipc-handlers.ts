import { ipcMain, app } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-events'
import { GlobalControls, TestSlide, AppShortcutsConfig } from '../shared/types'
import { displayManager } from './display-manager'
import { databaseService } from './db/database-service'
import { stateManager } from './state-manager'
import { windowManager } from './window-manager'
import { shortcutsManager } from './shortcuts-manager'
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
    (_event, slide: TestSlide, targetRoles?: string[]) => {
      return stateManager.sendSlide(slide, targetRoles)
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
