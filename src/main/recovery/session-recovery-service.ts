import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from '../logger'
import {
  SessionSnapshot,
  SessionRecoveryCheckResult,
  PresenterState,
  PresentationTimer
} from '../../shared/types'

export class SessionRecoveryService {
  private snapshotFilePath: string = ''
  private pendingSnapshot: SessionSnapshot | null = null
  private currentSnapshot: SessionSnapshot | null = null
  private saveDebounceTimer: NodeJS.Timeout | null = null
  private initialized: boolean = false

  public initialize(customUserDataPath?: string): void {
    if (this.initialized) return

    try {
      const userData = customUserDataPath || app.getPath('userData')
      this.snapshotFilePath = path.join(userData, 'session-snapshot.json')

      // Check for an unclean prior shutdown
      if (fs.existsSync(this.snapshotFilePath)) {
        try {
          const raw = fs.readFileSync(this.snapshotFilePath, 'utf-8')
          const parsed = JSON.parse(raw) as SessionSnapshot
          if (parsed && parsed.cleanShutdown === false) {
            this.pendingSnapshot = parsed
            logger.warn(
              `Unclean shutdown detected! Previous session snapshot from ${new Date(parsed.timestamp).toISOString()} is available for recovery.`
            )
          } else {
            this.pendingSnapshot = null
          }
        } catch (readErr) {
          logger.error('Failed to parse previous session snapshot:', readErr)
          this.pendingSnapshot = null
        }
      }

      // Initialize current session snapshot with cleanShutdown = false
      this.currentSnapshot = {
        activePlanId: null,
        activePlanTitle: null,
        activeItemIndex: 0,
        activeSlideIndex: 0,
        currentSlide: null,
        activeLayers: {},
        controls: { black: false, clear: false, logo: false, freeze: false },
        timers: [],
        timestamp: Date.now(),
        cleanShutdown: false
      }

      this.flushCurrentSnapshot()
      this.initialized = true
      logger.info('SessionRecoveryService initialized.')
    } catch (err) {
      logger.error('Failed to initialize SessionRecoveryService:', err)
    }
  }

  public checkRecovery(): SessionRecoveryCheckResult {
    return {
      hasPendingRecovery: this.pendingSnapshot !== null,
      snapshot: this.pendingSnapshot
    }
  }

  public dismissRecovery(): boolean {
    this.pendingSnapshot = null
    logger.info('Pending session recovery dismissed by user.')
    return true
  }

  public getPendingSnapshot(): SessionSnapshot | null {
    return this.pendingSnapshot
  }

  public updateSessionState(update: {
    activePlanId?: string | null
    activePlanTitle?: string | null
    activeItemIndex?: number
    activeSlideIndex?: number
    presenterState?: PresenterState
    timers?: PresentationTimer[]
    videoPosition?: {
      mediaUrl?: string
      currentTime: number
      isPlaying: boolean
    }
  }): void {
    if (!this.currentSnapshot) {
      this.currentSnapshot = {
        activePlanId: null,
        activePlanTitle: null,
        activeItemIndex: 0,
        activeSlideIndex: 0,
        currentSlide: null,
        activeLayers: {},
        controls: { black: false, clear: false, logo: false, freeze: false },
        timers: [],
        timestamp: Date.now(),
        cleanShutdown: false
      }
    }

    if (update.activePlanId !== undefined) this.currentSnapshot.activePlanId = update.activePlanId
    if (update.activePlanTitle !== undefined) this.currentSnapshot.activePlanTitle = update.activePlanTitle
    if (update.activeItemIndex !== undefined) this.currentSnapshot.activeItemIndex = update.activeItemIndex
    if (update.activeSlideIndex !== undefined) this.currentSnapshot.activeSlideIndex = update.activeSlideIndex
    if (update.timers !== undefined) this.currentSnapshot.timers = update.timers
    if (update.videoPosition !== undefined) this.currentSnapshot.videoPosition = update.videoPosition

    if (update.presenterState) {
      this.currentSnapshot.currentSlide = update.presenterState.currentSlide
      this.currentSnapshot.activeLayers = update.presenterState.activeLayers
      this.currentSnapshot.controls = update.presenterState.controls
    }

    this.currentSnapshot.timestamp = Date.now()
    this.scheduleSave()
  }

  public markCleanShutdown(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = null
    }

    if (this.snapshotFilePath) {
      try {
        if (this.currentSnapshot) {
          this.currentSnapshot.cleanShutdown = true
          fs.writeFileSync(this.snapshotFilePath, JSON.stringify(this.currentSnapshot, null, 2), 'utf-8')
          logger.info('Session snapshot marked as clean shutdown.')
        } else if (fs.existsSync(this.snapshotFilePath)) {
          fs.unlinkSync(this.snapshotFilePath)
        }
      } catch (err) {
        logger.error('Error writing clean shutdown to session snapshot:', err)
      }
    }
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) return
    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null
      this.flushCurrentSnapshot()
    }, 1500)
  }

  private flushCurrentSnapshot(): void {
    if (!this.snapshotFilePath || !this.currentSnapshot) return
    try {
      const dir = path.dirname(this.snapshotFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.snapshotFilePath, JSON.stringify(this.currentSnapshot, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Failed to flush session snapshot:', err)
    }
  }
}

export const sessionRecoveryService = new SessionRecoveryService()
