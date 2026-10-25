import { BrowserWindow, WebContentsView } from 'electron'
import { YouTubeItemConfig } from '../../shared/types'
import { youtubeService, YouTubeService } from './youtube-service'
import { buildYouTubeEmbedUrl, calculatePlaybackDrift } from '../../shared/youtube-utils'
import { logger } from '../logger'

export class YouTubeOutputManager {
  private outputViews: Map<string, WebContentsView> = new Map()
  private parentWindows: Map<string, BrowserWindow> = new Map()
  private activeConfig: YouTubeItemConfig | null = null
  private isLive = false
  private isPlaying = false
  private currentTime = 0
  private duration = 0
  private volume = 1.0
  private syncInterval: NodeJS.Timeout | null = null
  private onAdStatusCallback: ((isAd: boolean) => void) | null = null
  private onEndActionCallback: ((action: 'freeze' | 'background' | 'next') => void) | null = null

  public setAdStatusCallback(cb: (isAd: boolean) => void): void {
    this.onAdStatusCallback = cb
  }

  public setEndActionCallback(cb: (action: 'freeze' | 'background' | 'next') => void): void {
    this.onEndActionCallback = cb
  }

  /**
   * Prepares (preloads) the YouTube video in paused state, hidden behind the current output.
   */
  public prepareVideo(
    config: YouTubeItemConfig,
    outputWindows: Map<string, BrowserWindow>
  ): void {
    youtubeService.initializeSession()
    this.cleanupViews()
    this.activeConfig = config
    this.isLive = false
    this.isPlaying = false
    this.currentTime = config.inPoint || 0
    this.duration = config.duration || 0

    const targetRoles = config.targetRoles || ['main']
    const audioRole = config.audioRole || 'main'

    for (const role of targetRoles) {
      const win = outputWindows.get(role)
      if (!win || win.isDestroyed()) continue

      const [winW, winH] = win.getSize()

      const view = new WebContentsView({
        webPreferences: {
          partition: YouTubeService.SESSION_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false
        }
      })

      // Hardware level audio muting per role
      const shouldPlayAudio = role === audioRole
      view.webContents.setAudioMuted(!shouldPlayAudio)

      // Inject ad-skipper on dom-ready
      view.webContents.on('dom-ready', () => {
        view.webContents.executeJavaScript(YouTubeService.getAdSkipperScript()).catch(() => {})
      })

      const embedUrl = buildYouTubeEmbedUrl(config.youtubeId, {
        autoplay: false,
        controls: false,
        startSeconds: config.inPoint || 0,
        endSeconds: config.outPoint,
        mute: !shouldPlayAudio
      })

      win.contentView.addChildView(view)
      view.setBounds({ x: 0, y: 0, width: winW, height: winH })
      // Keep hidden during prepare so current slide/background remains undisturbed
      view.setVisible(false)
      view.webContents.loadURL(embedUrl)

      this.outputViews.set(role, view)
      this.parentWindows.set(role, win)
      logger.info(`YouTube prepared on output '${role}' with audio=${shouldPlayAudio}.`)
    }
  }

  /**
   * Switches the prepared video to LIVE without flicker.
   */
  public goLive(): void {
    if (!this.activeConfig) return

    this.isLive = true
    this.isPlaying = true

    // Show views and command playback
    for (const [role, view] of this.outputViews.entries()) {
      view.setVisible(true)
      view.webContents.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (video) {
            video.play().catch(() => {});
          }
        })();
      `).catch(() => {})
    }

    this.startSyncLoop()
    logger.info(`YouTube video '${this.activeConfig.youtubeId}' is now LIVE.`)
  }

  public play(): void {
    if (!this.isLive) {
      this.goLive()
      return
    }
    this.isPlaying = true
    for (const view of this.outputViews.values()) {
      view.webContents.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (video && video.paused) {
            video.play().catch(() => {});
          }
        })();
      `).catch(() => {})
    }
  }

  public pause(): void {
    this.isPlaying = false
    for (const view of this.outputViews.values()) {
      view.webContents.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (video && !video.paused) {
            video.pause();
          }
        })();
      `).catch(() => {})
    }
  }

  public stop(): void {
    this.pause()
    this.seek(this.activeConfig?.inPoint || 0)
    for (const view of this.outputViews.values()) {
      view.setVisible(false)
    }
    this.isLive = false
    this.stopSyncLoop()
  }

  public seek(seconds: number): void {
    this.currentTime = seconds
    for (const view of this.outputViews.values()) {
      view.webContents.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = ${seconds};
          }
        })();
      `).catch(() => {})
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
    const audioRole = this.activeConfig?.audioRole || 'main'
    const audioView = this.outputViews.get(audioRole)
    if (audioView) {
      audioView.webContents.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (video) {
            video.volume = ${this.volume};
          }
        })();
      `).catch(() => {})
    }
  }

  public setAudioMuted(muted: boolean): void {
    const audioRole = this.activeConfig?.audioRole || 'main'
    const audioView = this.outputViews.get(audioRole)
    if (audioView) {
      audioView.webContents.setAudioMuted(muted)
    }
  }

  /**
   * Responds to global controls (Negro, Limpiar, Congelar).
   */
  public applyGlobalControl(control: 'black' | 'clear' | 'freeze', value: boolean): void {
    if (!this.isLive) return

    if (control === 'black') {
      for (const view of this.outputViews.values()) {
        view.setVisible(!value)
      }
    } else if (control === 'clear') {
      if (value) {
        this.pause()
        for (const view of this.outputViews.values()) {
          view.setVisible(false)
        }
      } else {
        for (const view of this.outputViews.values()) {
          view.setVisible(true)
        }
      }
    } else if (control === 'freeze') {
      if (value) {
        this.pause()
      } else {
        this.play()
      }
    }
  }

  private startSyncLoop(): void {
    if (this.syncInterval) return

    this.syncInterval = setInterval(async () => {
      if (!this.isLive || this.outputViews.size === 0) return

      const masterRole = this.activeConfig?.targetRoles[0] || 'main'
      const masterView = this.outputViews.get(masterRole) || Array.from(this.outputViews.values())[0]

      if (!masterView) return

      try {
        const stats: any = await masterView.webContents.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            const isAd = Boolean(document.querySelector('.ad-showing, .ytp-ad-player-overlay'));
            if (!video) return { exists: false, isAd };
            return {
              exists: true,
              currentTime: video.currentTime,
              duration: video.duration,
              paused: video.paused,
              ended: video.ended,
              isAd
            };
          })();
        `)

        if (stats && stats.exists) {
          this.currentTime = stats.currentTime
          if (stats.duration && !isNaN(stats.duration)) {
            this.duration = stats.duration
          }
          this.isPlaying = !stats.paused

          if (this.onAdStatusCallback) {
            this.onAdStatusCallback(stats.isAd)
          }

          // Check if video reached outPoint or ended
          const outPoint = this.activeConfig?.outPoint
          const isAtEnd = (outPoint && stats.currentTime >= outPoint) || stats.ended
          if (isAtEnd && this.isPlaying) {
            this.handleVideoEnded()
          }

          // Check and correct secondary display drift
          if (this.outputViews.size > 1) {
            for (const [role, slaveView] of this.outputViews.entries()) {
              if (slaveView === masterView) continue
              try {
                const slaveTime = await slaveView.webContents.executeJavaScript(
                  `document.querySelector('video')?.currentTime || 0`
                )
                const driftCheck = calculatePlaybackDrift(stats.currentTime, slaveTime, 0.25)
                if (driftCheck.isOutThreshold) {
                  logger.warn(`Resyncing YouTube output '${role}': drift ${driftCheck.drift.toFixed(3)}s exceeds threshold.`)
                  slaveView.webContents.executeJavaScript(
                    `const v = document.querySelector('video'); if (v) v.currentTime = ${stats.currentTime};`
                  ).catch(() => {})
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        // executeJavaScript may fail if page navigating or unloading
      }
    }, 250)
  }

  private handleVideoEnded(): void {
    const action = this.activeConfig?.endAction || 'freeze'
    logger.info(`YouTube playback reached end/outPoint. Action: ${action}`)
    this.pause()

    if (action === 'background') {
      this.stop()
    }

    if (this.onEndActionCallback) {
      this.onEndActionCallback(action)
    }
  }

  private stopSyncLoop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  public cleanupViews(): void {
    this.stopSyncLoop()
    for (const [role, view] of this.outputViews.entries()) {
      try {
        const parent = this.parentWindows.get(role)
        if (parent && !parent.isDestroyed()) {
          parent.contentView.removeChildView(view)
        }
      } catch {}
    }
    this.outputViews.clear()
    this.parentWindows.clear()
    this.activeConfig = null
    this.isLive = false
  }

  public getPlaybackState() {
    return {
      isLive: this.isLive,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      config: this.activeConfig
    }
  }
}

export const youtubeOutputManager = new YouTubeOutputManager()
