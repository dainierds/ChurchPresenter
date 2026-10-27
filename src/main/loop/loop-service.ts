import { EventEmitter } from 'events'
import { LoopConfig, LoopStatus } from '../../shared/types'
import { stateManager } from '../state-manager'
import { logger } from '../logger'

export class LoopService extends EventEmitter {
  private activeConfig: LoopConfig | null = null
  private currentSlideIndex: number = 0
  private totalSlides: number = 0
  private advanceInterval: NodeJS.Timeout | null = null
  private countdownInterval: NodeJS.Timeout | null = null
  private nextAdvanceInSeconds: number = 0
  private onSlideAdvanceCb: ((nextIndex: number) => void) | null = null
  private isPaused: boolean = false

  public isRunning(): boolean {
    return this.activeConfig !== null && this.countdownInterval !== null
  }

  public getStatus(): LoopStatus | null {
    if (!this.activeConfig) return null
    return {
      isActive: true,
      currentSlideIndex: this.currentSlideIndex,
      totalSlides: this.totalSlides,
      autoAdvanceSeconds: this.activeConfig.autoAdvanceSeconds,
      nextAdvanceInSeconds: this.nextAdvanceInSeconds,
      isPaused: this.isPaused,
      hasMusic: Boolean(this.activeConfig.backgroundMusicPath)
    }
  }

  public startLoop(
    config: LoopConfig,
    totalSlides: number,
    onSlideAdvance: (nextIndex: number) => void
  ): boolean {
    this.stopLoop(false)

    if (totalSlides <= 1) {
      logger.warn('Loop requested for presentation with <= 1 slide; starting single slide loop')
    }

    this.activeConfig = { ...config }
    this.totalSlides = Math.max(1, totalSlides)
    this.currentSlideIndex = 0
    this.onSlideAdvanceCb = onSlideAdvance
    this.isPaused = false
    this.nextAdvanceInSeconds = Math.max(1, config.autoAdvanceSeconds || 5)

    // Notify initial status
    this.syncStatus()

    // Countdown interval (every 1 second)
    this.countdownInterval = setInterval(() => {
      if (this.isPaused) return
      this.nextAdvanceInSeconds--
      if (this.nextAdvanceInSeconds <= 0) {
        this.nextAdvanceInSeconds = Math.max(1, this.activeConfig?.autoAdvanceSeconds || 5)
        this.advanceSlide()
      }
      this.syncStatus()
    }, 1000)

    logger.info(
      `Presentation loop started: ${totalSlides} slides, ${config.autoAdvanceSeconds}s interval, shuffle=${config.shuffle}, loop=${config.loop}`
    )
    return true
  }

  public advanceSlide(): void {
    if (!this.activeConfig || this.totalSlides <= 0) return

    let nextIndex: number
    if (this.activeConfig.shuffle && this.totalSlides > 1) {
      do {
        nextIndex = Math.floor(Math.random() * this.totalSlides)
      } while (nextIndex === this.currentSlideIndex)
    } else {
      nextIndex = this.currentSlideIndex + 1
      if (nextIndex >= this.totalSlides) {
        if (this.activeConfig.loop) {
          nextIndex = 0
        } else {
          // Finished loop
          this.stopLoop(true)
          return
        }
      }
    }

    this.currentSlideIndex = nextIndex
    if (this.onSlideAdvanceCb) {
      try {
        this.onSlideAdvanceCb(nextIndex)
      } catch (err) {
        logger.error('Error during loop slide advance callback:', err)
      }
    }
    this.syncStatus()
  }

  public stopLoop(smoothTransition: boolean = true): boolean {
    if (this.advanceInterval) {
      clearInterval(this.advanceInterval)
      this.advanceInterval = null
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }

    this.activeConfig = null
    this.onSlideAdvanceCb = null
    this.isPaused = false

    stateManager.setLoopStatus(null)
    this.emit('loop-status-changed', null)
    logger.info(`Presentation loop stopped (smoothTransition=${smoothTransition})`)
    return true
  }

  private syncStatus(): void {
    const status = this.getStatus()
    stateManager.setLoopStatus(status)
    this.emit('loop-status-changed', status)
  }
}

export const loopService = new LoopService()
