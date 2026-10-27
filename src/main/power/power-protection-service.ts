import { powerSaveBlocker, powerMonitor, screen } from 'electron'
import { logger } from '../logger'
import { displayManager } from '../display-manager'
import { windowManager } from '../window-manager'
import { stateManager } from '../state-manager'

export class PowerProtectionService {
  private blockerId: number | null = null
  private initialized: boolean = false

  public initialize(): void {
    if (this.initialized) return

    try {
      // Monitor OS power events
      powerMonitor.on('suspend', () => {
        logger.warn('Windows OS suspend event detected. Safely pausing media playback.')
        try {
          stateManager.setGlobalControl('freeze', true)
        } catch {
          // ignore
        }
      })

      powerMonitor.on('resume', () => {
        logger.info('Windows OS resumed from sleep! Re-detecting displays and reconciling output windows...')
        try {
          displayManager.getDisplays()
          windowManager.syncOutputWindows()
        } catch (err) {
          logger.error('Error reconciling displays upon system resume:', err)
        }
      })

      powerMonitor.on('unlock-screen', () => {
        logger.info('Windows screen unlocked. Verifying output window bounds...')
        try {
          displayManager.getDisplays()
          windowManager.syncOutputWindows()
        } catch (err) {
          logger.error('Error syncing windows on screen unlock:', err)
        }
      })

      // Re-align bounds on resolution/DPI scale changes
      screen.on('display-metrics-changed', (_event, display, changedMetrics) => {
        logger.info(
          `Display metrics changed for display ${display.id}: ${changedMetrics.join(', ')}. Updating output window bounds.`
        )
        try {
          windowManager.syncOutputWindows()
        } catch (err) {
          logger.error('Error updating bounds after display metrics changed:', err)
        }
      })

      this.initialized = true
      logger.info('PowerProtectionService initialized.')
    } catch (err) {
      logger.error('Failed to initialize PowerProtectionService:', err)
    }
  }

  public updateOutputsState(activeOutputsCount: number): void {
    try {
      if (activeOutputsCount > 0) {
        if (this.blockerId === null || !powerSaveBlocker.isStarted(this.blockerId)) {
          this.blockerId = powerSaveBlocker.start('prevent-display-sleep')
          logger.info(`powerSaveBlocker activated (ID: ${this.blockerId}) to prevent display sleep while outputs are open.`)
        }
      } else {
        if (this.blockerId !== null && powerSaveBlocker.isStarted(this.blockerId)) {
          powerSaveBlocker.stop(this.blockerId)
          logger.info(`powerSaveBlocker stopped (ID: ${this.blockerId}). Outputs are idle.`)
          this.blockerId = null
        }
      }
    } catch (err) {
      logger.error('Error toggling powerSaveBlocker:', err)
    }
  }

  public release(): void {
    if (this.blockerId !== null && powerSaveBlocker.isStarted(this.blockerId)) {
      try {
        powerSaveBlocker.stop(this.blockerId)
        this.blockerId = null
        logger.info('PowerSaveBlocker cleanly released.')
      } catch {
        // ignore
      }
    }
  }
}

export const powerProtectionService = new PowerProtectionService()
