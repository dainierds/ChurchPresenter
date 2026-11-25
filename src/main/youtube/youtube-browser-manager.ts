import { BrowserWindow, WebContentsView, shell } from 'electron'
import { youtubeService, YouTubeService } from './youtube-service'
import { youtubeOutputManager } from './youtube-output-manager'
import { parseYouTubeUrl } from '../../shared/youtube-utils'
import { YouTubeSyncTick } from '../../shared/types'
import { logger } from '../logger'

export class YouTubeBrowserManager {
  private view: WebContentsView | null = null
  private parentWindow: BrowserWindow | null = null
  private currentUrl = 'https://www.youtube.com'
  private syncInterval: NodeJS.Timeout | null = null
  private syncCallback: ((tick: YouTubeSyncTick) => void) | null = null
  private currentBounds = { x: 0, y: 0, width: 0, height: 0 }
  private isVisible = true

  public setSyncCallback(cb: (tick: YouTubeSyncTick) => void): void {
    this.syncCallback = cb
  }

  public isAttached(): boolean {
    return Boolean(this.view && !this.view.webContents.isDestroyed())
  }

  public attachToWindow(
    win: BrowserWindow,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    youtubeService.initializeSession()

    if (!this.view) {
      this.parentWindow = win
      this.view = new WebContentsView({
        webPreferences: {
          partition: YouTubeService.SESSION_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: false
        }
      })

      // Restrict new windows (target="_blank")
      this.view.webContents.setWindowOpenHandler(({ url }) => {
        logger.info(`YouTube Browser: intercepting window.open for ${url}`)
        if (youtubeService.isAllowedUrl(url)) {
          this.view?.webContents.loadURL(url)
        } else {
          shell.openExternal(url)
        }
        return { action: 'deny' }
      })

      // Restrict navigation to allowed domains
      this.view.webContents.on('will-navigate', (event, url) => {
        if (!youtubeService.isAllowedUrl(url)) {
          event.preventDefault()
          logger.info(`YouTube Browser: blocked navigation to non-allowed domain, opening in external browser: ${url}`)
          shell.openExternal(url)
        }
      })

      // Inject ad-skipper on DOM ready
      this.view.webContents.on('dom-ready', () => {
        this.view?.webContents.executeJavaScript(YouTubeService.getAdSkipperScript()).catch(() => {})
      })

      this.view.webContents.on('did-navigate', (_event, url) => {
        this.currentUrl = url
      })

      this.view.webContents.on('did-navigate-in-page', (_event, url) => {
        this.currentUrl = url
      })

      win.contentView.addChildView(this.view)
      this.view.webContents.loadURL(this.currentUrl)
    } else if (this.parentWindow !== win) {
      if (this.parentWindow && !this.parentWindow.isDestroyed()) {
        try {
          this.parentWindow.contentView.removeChildView(this.view)
        } catch (err) {
          logger.debug('Parent window view detachment notice:', err)
        }
      }
      this.parentWindow = win
      if (!win.isDestroyed()) {
        try {
          win.contentView.addChildView(this.view)
        } catch (err) {
          logger.debug('Parent window view attachment notice:', err)
        }
      }
    }

    this.currentBounds = bounds
    this.isVisible = true
    this.setBounds(bounds)
    this.view.setVisible(true)
    this.startSyncLoop()
    this.resyncWithLiveOutputIfActive()
  }

  public setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    this.currentBounds = bounds
    if (this.view && this.isVisible) {
      this.view.setBounds(bounds)
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible
    if (!this.view) return
    this.view.setVisible(visible)
    if (visible) {
      if (this.currentBounds.width > 0 && this.currentBounds.height > 0) {
        this.view.setBounds(this.currentBounds)
      }
      this.resyncWithLiveOutputIfActive()
    } else {
      // Move offscreen so native view never intercepts mouse clicks or covers React modals
      this.view.setBounds({ x: -10000, y: -10000, width: 1, height: 1 })
    }
  }

  private resyncWithLiveOutputIfActive(): void {
    if (!this.view || this.view.webContents.isDestroyed()) return
    try {
      const outputState = youtubeOutputManager.getPlaybackState()
      if (outputState.isLive && outputState.isPlaying && outputState.currentTime > 0) {
        const liveTime = outputState.currentTime
        this.view.webContents.executeJavaScript(`
          (function() {
            const v = document.querySelector('video');
            if (v && !isNaN(v.duration) && v.duration > 0) {
              if (Math.abs(v.currentTime - ${liveTime}) > 0.8) {
                v.currentTime = ${liveTime};
              }
              if (v.paused) {
                v.play().catch(() => {});
              }
            }
          })()
        `).catch(() => {})
      }
    } catch (err) {
      logger.warn('Failed to resync YouTube browser with live output:', err)
    }
  }

  public hide(): void {
    this.setVisible(false)
  }

  public show(): void {
    this.setVisible(true)
  }

  public close(): void {
    this.stopSyncLoop()
    if (this.view && this.parentWindow && !this.parentWindow.isDestroyed()) {
      try {
        this.parentWindow.contentView.removeChildView(this.view)
      } catch (err) {
        logger.warn('Failed to remove WebContentsView from parent window:', err)
      }
    }
    this.view = null
    this.parentWindow = null
  }

  private startSyncLoop(): void {
    if (this.syncInterval) return
    this.syncInterval = setInterval(async () => {
      if (!this.view || this.view.webContents.isDestroyed() || !this.isVisible) return
      try {
        const data = await this.view.webContents.executeJavaScript(`
          (function() {
            const v = document.querySelector('video');
            if (!v) return null;
            return {
              paused: v.paused,
              currentTime: v.currentTime,
              duration: v.duration || 0,
              ended: v.ended
            };
          })()
        `)
        if (data && this.syncCallback) {
          const url = this.view.webContents.getURL()
          const parsed = parseYouTubeUrl(url)
          if (parsed.isValid && parsed.videoId) {
            this.syncCallback({
              videoId: parsed.videoId,
              url,
              currentTime: data.currentTime,
              duration: data.duration,
              isPlaying: !data.paused && !data.ended,
              isBrowserSource: true,
              isLive: false,
              timestamp: Date.now()
            })
          }
        }
      } catch {
        // Ignore evaluation errors during page navigation
      }
    }, 250)
  }

  private stopSyncLoop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  public navigate(action: 'back' | 'forward' | 'home' | 'reload' | 'go', url?: string): void {
    if (action === 'go' && url) {
      const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
      this.currentUrl = targetUrl
    } else if (action === 'home') {
      this.currentUrl = 'https://www.youtube.com'
    }

    if (!this.view) return

    switch (action) {
      case 'back':
        if (this.view.webContents.navigationHistory.canGoBack()) {
          this.view.webContents.navigationHistory.goBack()
        }
        break
      case 'forward':
        if (this.view.webContents.navigationHistory.canGoForward()) {
          this.view.webContents.navigationHistory.goForward()
        }
        break
      case 'home':
        this.view.webContents.loadURL(this.currentUrl)
        break
      case 'reload':
        this.view.webContents.reload()
        break
      case 'go':
        if (url) {
          const targetUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
          if (youtubeService.isAllowedUrl(targetUrl)) {
            this.view.webContents.loadURL(targetUrl)
          } else {
            shell.openExternal(targetUrl)
          }
        }
        break
    }
  }

  public getCurrentUrl(): string {
    if (this.view) {
      this.currentUrl = this.view.webContents.getURL()
    }
    return this.currentUrl
  }

  public async getCurrentVideoMetadata() {
    const url = this.getCurrentUrl()
    const parsed = parseYouTubeUrl(url)
    if (!parsed.isValid || !parsed.videoId) {
      return null
    }

    const meta = await youtubeService.fetchMetadata(parsed.videoId)
    return {
      ...meta,
      url,
      inPoint: parsed.inPointSeconds
    }
  }
}

export const youTubeBrowserManager = new YouTubeBrowserManager()
