import { EventEmitter } from 'events'
import { logger } from '../logger'
import { stateManager } from '../state-manager'
import { GlobalControls } from '../../shared/types'

export class EmergencyService extends EventEmitter {
  private isEmergencyActive: boolean = false
  private isSafeMode: boolean = false
  private savedControlsState: GlobalControls | null = null

  constructor() {
    super()
    this.detectSafeMode()
  }

  private detectSafeMode(): void {
    const hasArg = process.argv.some((arg) => arg === '--safe-mode' || arg === '-safe-mode')
    const hasEnv = process.env.CHURCH_PRESENTER_SAFE_MODE === '1'
    this.isSafeMode = hasArg || hasEnv
    if (this.isSafeMode) {
      logger.warn(
        '*** SAFE MODE ACTIVE: YouTube browser, remote server, and file watchers will be disabled for safe troubleshooting. ***'
      )
    }
  }

  public isSafeModeEnabled(): boolean {
    return this.isSafeMode
  }

  public isEmergency(): boolean {
    return this.isEmergencyActive
  }

  public activateEmergency(): boolean {
    if (this.isEmergencyActive) return true

    logger.warn('[EMERGENCY MODE ACTIVATED]: Blanking/protecting all outputs and freezing media.')
    this.savedControlsState = { ...stateManager.getState().controls }

    // Put logo or black on all screens and freeze media
    stateManager.setGlobalControl('logo', true)
    stateManager.setGlobalControl('freeze', true)

    this.isEmergencyActive = true
    this.emit('emergency-changed', true)
    return true
  }

  public deactivateEmergency(): boolean {
    if (!this.isEmergencyActive) return false

    logger.info('[EMERGENCY MODE DEACTIVATED]: Restoring output controls.')
    if (this.savedControlsState) {
      stateManager.setGlobalControl('logo', this.savedControlsState.logo)
      stateManager.setGlobalControl('freeze', this.savedControlsState.freeze)
      this.savedControlsState = null
    } else {
      stateManager.setGlobalControl('logo', false)
      stateManager.setGlobalControl('freeze', false)
    }

    this.isEmergencyActive = false
    this.emit('emergency-changed', false)
    return true
  }
}

export const emergencyService = new EmergencyService()
