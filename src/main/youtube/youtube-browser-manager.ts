import { BrowserWindow, WebContentsView, shell } from 'electron'
import { youtubeService, YouTubeService } from './youtube-service'
import { parseYouTubeUrl } from '../../shared/youtube-utils'
import { logger } from '../logger'

export class YouTubeBrowserManager {
  private view: WebContentsView | null = null
  private parentWindow: BrowserWindow | null = null
  private currentUrl = 'https://www.youtube.com'

  public attachToWindow(
    win: BrowserWindow,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    youtubeService.initializeSession()
    this.parentWindow = win

    if (!this.view) {
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
    }

    this.setBounds(bounds)
    this.view.setVisible(true)
  }

  public setBounds(bounds: { x: number; y: number; width: number; height: number }): void {
    if (this.view) {
      this.view.setBounds(bounds)
    }
  }

  public hide(): void {
    if (this.view) {
      this.view.setVisible(false)
    }
  }

  public show(): void {
    if (this.view) {
      this.view.setVisible(true)
    }
  }

  public close(): void {
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

  public navigate(action: 'back' | 'forward' | 'home' | 'reload' | 'go', url?: string): void {
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
        this.view.webContents.loadURL('https://www.youtube.com')
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
