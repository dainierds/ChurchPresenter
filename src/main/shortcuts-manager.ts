import { globalShortcut } from 'electron'
import { AppShortcutsConfig, DEFAULT_SHORTCUTS } from '../shared/types'
import { filterGlobalShortcutsToRegister } from '../shared/shortcut-utils'
import { databaseService } from './db/database-service'
import { stateManager } from './state-manager'
import { logger } from './logger'

const SHORTCUTS_CONFIG_KEY = 'app_shortcuts_config'

export class ShortcutsManager {
  private config: AppShortcutsConfig = DEFAULT_SHORTCUTS

  public initialize(): void {
    const saved = databaseService.getConfig(SHORTCUTS_CONFIG_KEY)
    if (saved) {
      try {
        this.config = { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) }
      } catch {
        this.config = DEFAULT_SHORTCUTS
      }
    } else {
      this.config = DEFAULT_SHORTCUTS
    }

    this.applyGlobalShortcuts()
  }

  public getShortcuts(): AppShortcutsConfig {
    return { ...this.config }
  }

  public updateShortcuts(newConfig: AppShortcutsConfig): boolean {
    this.config = { ...newConfig }
    databaseService.setConfig(SHORTCUTS_CONFIG_KEY, JSON.stringify(this.config))
    this.applyGlobalShortcuts()
    logger.info('Shortcuts configuration updated.')
    return true
  }

  private applyGlobalShortcuts(): void {
    // Unregister everything first
    globalShortcut.unregisterAll()

    if (!this.config.enableGlobalFShortcuts) {
      logger.info('Global F-key shortcuts are disabled by configuration.')
      return
    }

    const filtered = filterGlobalShortcutsToRegister(this.config)
    for (const [action, key] of Object.entries(filtered)) {
      try {
        globalShortcut.register(key, () => {
          logger.info(`Global F-key shortcut triggered: ${key} -> ${action}`)
          stateManager.toggleGlobalControl(action as any)
        })
        logger.info(`Registered global F-key shortcut: ${key} for action '${action}'`)
      } catch (err) {
        logger.error(`Failed to register global shortcut ${key}:`, err)
      }
    }
  }

  public unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}

export const shortcutsManager = new ShortcutsManager()
