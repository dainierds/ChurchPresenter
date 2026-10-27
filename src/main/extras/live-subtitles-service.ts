import { databaseService } from '../db/database-service'
import { stateManager } from '../state-manager'
import { LiveSubtitleMessage, LiveSubtitlesConfig } from '../../shared/types'
import { logger } from '../logger'

export class LiveSubtitlesService {
  private autoClearTimer: NodeJS.Timeout | null = null

  constructor() {
    // Sync initial configuration to state
    try {
      const config = databaseService.getSubtitlesConfig()
      stateManager.setSubtitlesConfig(config)
    } catch {
      // ignore
    }
  }

  public getConfig(): LiveSubtitlesConfig {
    return databaseService.getSubtitlesConfig()
  }

  public saveConfig(config: Partial<LiveSubtitlesConfig>): LiveSubtitlesConfig {
    const saved = databaseService.saveSubtitlesConfig(config)
    stateManager.setSubtitlesConfig(saved)
    return saved
  }

  /**
   * Dispatches a live subtitle message and starts the silence auto-clear timer.
   */
  public sendSubtitle(params: {
    text: string
    translation?: string
    targetRoles?: string[]
    durationSec?: number
  }): LiveSubtitleMessage {
    const config = this.getConfig()
    const subtitle: LiveSubtitleMessage = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: (params.text || '').trim(),
      translation: params.translation ? params.translation.trim() : undefined,
      targetRoles: params.targetRoles && params.targetRoles.length > 0 ? params.targetRoles : config.targetRoles,
      timestamp: Date.now(),
      durationSec: params.durationSec || config.autoClearDelaySec || 5
    }

    if (this.autoClearTimer) {
      clearTimeout(this.autoClearTimer)
      this.autoClearTimer = null
    }

    stateManager.setActiveSubtitle(subtitle)
    logger.info(`LiveSubtitles: displayed "${subtitle.text.substring(0, 30)}..." for roles [${subtitle.targetRoles.join(', ')}]`)

    const delayMs = (subtitle.durationSec || 5) * 1000
    if (delayMs > 0) {
      this.autoClearTimer = setTimeout(() => {
        this.clearSubtitle()
      }, delayMs)
    }

    return subtitle
  }

  /**
   * Clears the current subtitle from all displays.
   */
  public clearSubtitle(): boolean {
    if (this.autoClearTimer) {
      clearTimeout(this.autoClearTimer)
      this.autoClearTimer = null
    }
    stateManager.setActiveSubtitle(null)
    return true
  }
}

export const liveSubtitlesService = new LiveSubtitlesService()
