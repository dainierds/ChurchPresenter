import { BrowserWindow, WebContentsView } from 'electron'
import { YouTubeItemConfig, YouTubeSyncTick, YouTubePlaybackError } from '../../shared/types'
import { youtubeService, YouTubeService } from './youtube-service'
import { calculatePlaybackDrift } from '../../shared/youtube-utils'
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
  private hasPlaybackError = false
  private syncInterval: NodeJS.Timeout | null = null
  private onAdStatusCallback: ((isAd: boolean) => void) | null = null
  private onEndActionCallback: ((action: 'freeze' | 'background' | 'next') => void) | null = null
  private onSyncCallback: ((tick: YouTubeSyncTick) => void) | null = null
  private onErrorCallback: ((error: YouTubePlaybackError) => void) | null = null

  public setSyncCallback(cb: (tick: YouTubeSyncTick) => void): void {
    this.onSyncCallback = cb
  }

  public setAdStatusCallback(cb: (isAd: boolean) => void): void {
    this.onAdStatusCallback = cb
  }

  public setEndActionCallback(cb: (action: 'freeze' | 'background' | 'next') => void): void {
    this.onEndActionCallback = cb
  }

  public setErrorCallback(cb: (error: YouTubePlaybackError) => void): void {
    this.onErrorCallback = cb
  }

  /**
   * Prepares the YouTube video using Option B: Dedicated Watch Page.
   * Loads the authentic youtube.com/watch page in a sandboxed WebContentsView
   * sharing the user's session (persist:youtube).
   * Kept hidden (setVisible(false)) so the current audience output remains undisturbed.
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
    this.hasPlaybackError = false

    const targetRoles = config.targetRoles || ['main']
    const audioRole = (config.audioRole === 'audience' ? 'main' : config.audioRole) || 'main'

    for (const rawRole of targetRoles) {
      const role = rawRole === 'audience' ? 'main' : rawRole
      const win = outputWindows.get(role)
      if (!win || win.isDestroyed()) continue

      const bounds = win.getContentBounds()

      const view = new WebContentsView({
        webPreferences: {
          partition: YouTubeService.SESSION_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false,
          autoplayPolicy: 'no-user-gesture-required'
        }
      })

      // Audio muting per role (keep muted while prepared/hidden)
      const shouldPlayAudio = role === audioRole
      view.webContents.setAudioMuted(true)

      // Clean full-viewport presentation CSS
      const YOUTUBE_OUTPUT_CSS = `
        #masthead-container, #related, #comments, #secondary, #below, ytd-miniplayer,
        #guide, ytd-guide-renderer, ytd-banner-promo-renderer-background,
        .ytp-chrome-top, .ytp-chrome-bottom, ytd-merch-shelf-renderer,
        #chat, ytd-live-chat-frame, ytd-masthead, #ticker {
          display: none !important;
        }
        html, body {
          overflow: hidden !important;
          background: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #movie_player, .html5-video-player {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 999999 !important;
          background: #000000 !important;
        }
        video {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: contain !important;
        }
      `

      // Verify page state & check for errors on dom-ready
      view.webContents.on('dom-ready', async () => {
        try {
          await view.webContents.insertCSS(YOUTUBE_OUTPUT_CSS)
        } catch (_err) {
          // CSS injection fallback
        }

        this.checkViewForErrors(view, role, config.youtubeId)

        if (this.isLive && this.isPlaying && !this.hasPlaybackError) {
          this.executePlay(view, shouldPlayAudio)
        }
      })

      view.webContents.on('did-finish-load', () => {
        this.checkViewForErrors(view, role, config.youtubeId)
        if (this.isLive && this.isPlaying && !this.hasPlaybackError) {
          this.executePlay(view, shouldPlayAudio)
        }
      })

      // Construct authentic watch page URL (Option B)
      const inPointSec = config.inPoint ? Math.floor(config.inPoint) : 0
      const watchUrl = inPointSec > 0
        ? `https://www.youtube.com/watch?v=${config.youtubeId}&t=${inPointSec}s`
        : `https://www.youtube.com/watch?v=${config.youtubeId}`

      win.contentView.addChildView(view)
      view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
      // Keep hidden during prepare: audience never sees prepare / load state
      view.setVisible(false)

      view.webContents.loadURL(watchUrl).catch((err) => {
        if (!err.message?.includes('ERR_ABORTED')) {
          logger.warn(`YouTube watch page navigation error for ${config.youtubeId}:`, err)
        }
      })

      // Dynamic resize handling
      const onResize = () => {
        if (!win.isDestroyed() && !view.webContents.isDestroyed()) {
          const b = win.getContentBounds()
          view.setBounds({ x: 0, y: 0, width: b.width, height: b.height })
        }
      }
      win.on('resize', onResize)

      this.outputViews.set(role, view)
      this.parentWindows.set(role, win)
      logger.info(`YouTube (Option B: Watch Page) prepared on output '${role}' with audio=${shouldPlayAudio}.`)
    }
  }

  /**
   * Checks if YouTube displays an error card on the page.
   * If an error is detected, the view is kept hidden so the audience NEVER sees the error card.
   */
  private async checkViewForErrors(view: WebContentsView, role: string, videoId: string): Promise<boolean> {
    if (view.webContents.isDestroyed()) return false
    try {
      const errInfo = await view.webContents.executeJavaScript(`
        (function() {
          const errEl = document.querySelector('#player-error-message-container, .yt-playability-error-supported-renderers, ytd-player-error-message-renderer');
          const reason = document.querySelector('#reason, .reason, .subreason');
          if (errEl && (errEl.offsetParent !== null || errEl.innerText.length > 5)) {
            return {
              hasError: true,
              reason: (reason ? reason.innerText : errEl.innerText).trim().replace(/\\s+/g, ' ')
            };
          }
          return { hasError: false };
        })()
      `)

      if (errInfo && errInfo.hasError) {
        this.hasPlaybackError = true
        view.setVisible(false) // AUDIENCE NEVER SEES ERROR CARD
        const errorPayload: YouTubePlaybackError = {
          videoId,
          code: '152-4',
          message: `Video no disponible en YouTube: ${errInfo.reason || 'Restringido por el autor o no existe'}`,
          role,
          details: errInfo.reason
        }
        logger.warn(`YouTube error detected on output '${role}':`, errorPayload.message)
        if (this.onErrorCallback) {
          this.onErrorCallback(errorPayload)
        }
        return true
      }
    } catch (_err) {
      // Ignore evaluation errors while navigating
    }
    return false
  }

  private executePlay(view: WebContentsView, shouldPlayAudio: boolean): void {
    if (view.webContents.isDestroyed() || this.hasPlaybackError) return
    view.webContents.setAudioMuted(!shouldPlayAudio)
    view.webContents.executeJavaScript(`
      (function() {
        const video = document.querySelector('video');
        if (video) {
          video.muted = ${!shouldPlayAudio};
          if (video.paused) {
            video.play().catch(() => {});
          }
          return true;
        }
        return false;
      })();
    `).catch(() => {})
  }

  /**
   * Switches the prepared video to LIVE without flicker.
   */
  public goLive(): void {
    if (!this.activeConfig) return

    this.isLive = true
    this.isPlaying = true

    const audioRole = (this.activeConfig.audioRole === 'audience' ? 'main' : this.activeConfig.audioRole) || 'main'

    for (const [role, view] of this.outputViews.entries()) {
      if (view.webContents.isDestroyed()) continue

      // Only show if there is no error detected; if error, maintain black / safe background
      if (!this.hasPlaybackError) {
        view.setVisible(true)
      } else {
        view.setVisible(false)
      }

      const shouldPlayAudio = role === audioRole
      this.executePlay(view, shouldPlayAudio)
    }

    this.startSyncLoop()
    logger.info(`YouTube video '${this.activeConfig.youtubeId}' is now LIVE (Option B: Watch Page).`)
  }

  public play(): void {
    if (!this.isLive) {
      this.goLive()
      return
    }
    this.isPlaying = true
    if (this.hasPlaybackError) return

    const audioRole = (this.activeConfig?.audioRole === 'audience' ? 'main' : this.activeConfig?.audioRole) || 'main'
    for (const [role, view] of this.outputViews.entries()) {
      view.setVisible(!this.hasPlaybackError)
      this.executePlay(view, role === audioRole)
    }
  }

  public pause(): void {
    this.isPlaying = false
    for (const view of this.outputViews.values()) {
      if (view.webContents.isDestroyed()) continue
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
      if (!view.webContents.isDestroyed()) {
        view.setVisible(false)
      }
    }
    this.isLive = false
    this.stopSyncLoop()
  }

  public syncToTick(tick: YouTubeSyncTick): void {
    if (!this.outputViews.size) return
    this.currentTime = tick.currentTime
    this.duration = tick.duration
    this.isPlaying = tick.isPlaying

    for (const view of this.outputViews.values()) {
      if (view.webContents.isDestroyed()) continue
      if (tick.isBrowserSource) {
        view.webContents.setAudioMuted(true)
      }
      view.webContents.executeJavaScript(`
        (function() {
          const v = document.querySelector('video');
          if (!v) return;
          if (${tick.isPlaying} && v.paused) {
            v.play().catch(() => {});
          } else if (!${tick.isPlaying} && !v.paused) {
            v.pause();
          }
          if (Math.abs(v.currentTime - ${tick.currentTime}) > 0.6) {
            v.currentTime = ${tick.currentTime};
          }
        })();
      `).catch(() => {})
    }
  }

  public seek(seconds: number): void {
    if (typeof seconds !== 'number' || isNaN(seconds)) return
    this.currentTime = seconds
    for (const view of this.outputViews.values()) {
      if (view.webContents.isDestroyed()) continue
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
    if (audioView && !audioView.webContents.isDestroyed()) {
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
    if (audioView && !audioView.webContents.isDestroyed()) {
      audioView.webContents.setAudioMuted(muted)
    }
  }

  /**
   * Responds to global emergency controls (Negro, Limpiar, Congelar).
   */
  public applyGlobalControl(control: 'black' | 'clear' | 'freeze', value: boolean): void {
    if (!this.isLive) return

    if (control === 'black') {
      for (const view of this.outputViews.values()) {
        if (!view.webContents.isDestroyed()) {
          view.setVisible(!value && !this.hasPlaybackError)
        }
      }
    } else if (control === 'clear') {
      if (value) {
        this.pause()
        for (const view of this.outputViews.values()) {
          if (!view.webContents.isDestroyed()) {
            view.setVisible(false)
          }
        }
      } else {
        for (const view of this.outputViews.values()) {
          if (!view.webContents.isDestroyed()) {
            view.setVisible(!this.hasPlaybackError)
          }
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

      if (!masterView || masterView.webContents.isDestroyed()) return

      try {
        const stats: any = await masterView.webContents.executeJavaScript(`
          (function() {
            const video = document.querySelector('video');
            const isAd = Boolean(document.querySelector('.ad-showing, .ytp-ad-player-overlay'));
            const errEl = document.querySelector('#player-error-message-container, .yt-playability-error-supported-renderers, ytd-player-error-message-renderer');
            if (errEl && (errEl.offsetParent !== null || errEl.innerText.length > 5)) {
              return { exists: false, isError: true, errorReason: errEl.innerText.trim() };
            }
            if (!video) return { exists: false, isAd, isError: false };
            if (video.paused && !isAd) {
              video.play().catch(() => {});
            }
            return {
              exists: true,
              currentTime: video.currentTime,
              duration: video.duration,
              paused: video.paused,
              ended: video.ended,
              isAd,
              isError: false
            };
          })();
        `)

        if (stats && stats.isError) {
          this.hasPlaybackError = true
          masterView.setVisible(false)
          if (this.onErrorCallback && this.activeConfig) {
            this.onErrorCallback({
              videoId: this.activeConfig.youtubeId,
              code: '152-4',
              message: `Video no disponible en YouTube: ${stats.errorReason || 'Restringido por el autor'}`
            })
          }
          return
        }

        if (stats && stats.exists) {
          this.currentTime = stats.currentTime
          if (stats.duration && !isNaN(stats.duration)) {
            this.duration = stats.duration
          }
          this.isPlaying = !stats.paused

          if (this.onAdStatusCallback) {
            this.onAdStatusCallback(stats.isAd)
          }

          if (this.onSyncCallback && this.activeConfig) {
            this.onSyncCallback({
              videoId: this.activeConfig.youtubeId,
              url: this.activeConfig.url,
              currentTime: stats.currentTime,
              duration: this.duration,
              isPlaying: this.isPlaying,
              isBrowserSource: false,
              timestamp: Date.now()
            })
          }

          // Check if video reached outPoint or ended
          const outPoint = this.activeConfig?.outPoint
          const isAtEnd = (outPoint && stats.currentTime >= outPoint) || stats.ended
          if (isAtEnd && this.isPlaying) {
            this.handleVideoEnded()
          }

          // Resynchronize secondary output display if drift exceeds threshold
          if (this.outputViews.size > 1) {
            for (const [role, slaveView] of this.outputViews.entries()) {
              if (slaveView === masterView || slaveView.webContents.isDestroyed()) continue
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
              } catch (_err) {
                // Secondary view read error
              }
            }
          }
        }
      } catch (_err) {
        // Evaluation error during navigation
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
        if (parent && !parent.isDestroyed() && !view.webContents.isDestroyed()) {
          parent.contentView.removeChildView(view)
        }
      } catch (_err) {
        // View removal error
      }
    }
    this.outputViews.clear()
    this.parentWindows.clear()
    this.activeConfig = null
    this.isLive = false
    this.hasPlaybackError = false
  }

  public getPlaybackState() {
    return {
      isLive: this.isLive,
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      config: this.activeConfig,
      hasPlaybackError: this.hasPlaybackError
    }
  }
}

export const youtubeOutputManager = new YouTubeOutputManager()
