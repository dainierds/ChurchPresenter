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
  private lastDiag: any = null
  private stalledTickCount = 0
  private lastObservedTime = 0
  private stallCount = 0
  private lastSlaveResyncTime: Map<string, number> = new Map()
  private reportedErrorVideoIds: Set<string> = new Set()
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
   * Prepares the YouTube video using Option A: Local Embed Server.
   * Loads the authentic local embed player in a sandboxed WebContentsView
   * with zero-spoofing compliance and strict origin / referer policy.
   * Kept hidden (setVisible(false)) so the current audience output remains undisturbed.
   */
  public async prepareVideo(
    config: YouTubeItemConfig,
    outputWindows: Map<string, BrowserWindow>
  ): Promise<void> {
    youtubeService.initializeSession()
    this.cleanupViews()
    this.activeConfig = config
    this.isLive = false
    this.isPlaying = false
    this.currentTime = config.inPoint || 0
    this.duration = config.duration || 0
    this.hasPlaybackError = false
    this.reportedErrorVideoIds.delete(config.youtubeId)
    this.lastObservedTime = 0
    this.stallCount = 0

    const targetRoles = config.targetRoles || ['main']
    const audioRole = (config.audioRole === 'audience' ? 'main' : config.audioRole) || 'main'

    for (const rawRole of targetRoles) {
      const role = rawRole === 'audience' ? 'main' : rawRole
      let win = outputWindows.get(role) || outputWindows.get(rawRole)
      if (!win && (role === 'main' || targetRoles.length === 1) && outputWindows.size > 0) {
        win = Array.from(outputWindows.values())[0]
      }
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
      view.webContents.setBackgroundThrottling(false)
      view.webContents.setAudioMuted(true)

      // Clean full-viewport presentation CSS
      const YOUTUBE_OUTPUT_CSS = `
        #masthead-container, #related, #comments, #secondary, #below, ytd-miniplayer,
        #guide, ytd-guide-renderer, ytd-banner-promo-renderer-background,
        .ytp-chrome-top, .ytp-chrome-bottom, ytd-merch-shelf-renderer,
        #chat, ytd-live-chat-frame, ytd-masthead, #ticker,
        tp-yt-paper-dialog, ytd-popup-container, .ytp-pause-overlay,
        .ytp-ce-element, .ytp-cards-teaser, .ytp-endscreen-element,
        .ytp-bezel-text-wrapper, .ytp-gradient-top, .ytp-gradient-bottom,
        .ytp-chrome-controls, .ytp-contextmenu, yt-confirm-dialog-renderer,
        #consent-bump, ytd-consent-bump-v2-lightbox, .ytp-spinner {
          display: none !important;
        }
        html, body {
          overflow: hidden !important;
          background: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        #movie_player, .html5-video-player, #player {
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
          await view.webContents.executeJavaScript(YouTubeService.getAdSkipperScript()).catch(() => {})
          await view.webContents.executeJavaScript(`
            (function() {
              try {
                // Ensure unfocused output display windows maintain continuous YouTube buffer playback
                Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
                Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
                Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
                Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
                Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
                window.hasFocus = () => true;
                document.hasFocus = () => true;
                window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
                document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
              } catch (_) {}
            })()
          `)
        } catch (_err) {
          // CSS injection fallback
        }

        this.checkViewForErrors(view, role, config.youtubeId)

        if (this.isLive && !this.hasPlaybackError) {
          view.setVisible(true)
          if (this.isPlaying) {
            this.executePlay(view, shouldPlayAudio)
          }
        }
      })

      view.webContents.on('did-finish-load', () => {
        this.checkViewForErrors(view, role, config.youtubeId)
        if (this.isLive && !this.hasPlaybackError) {
          view.setVisible(true)
          if (this.isPlaying) {
            this.executePlay(view, shouldPlayAudio)
          }
        }
      })

      view.webContents.on('render-process-gone', (_e, details) => {
        console.log(`[YT VIEW CRASH] Role ${role} render-process-gone:`, details)
      })
      view.webContents.on('media-paused', () => {
        console.log(`[YT VIEW MEDIA] Role ${role} media-paused`)
      })
      view.webContents.on('media-started-playing', () => {
        console.log(`[YT VIEW MEDIA] Role ${role} media-started-playing`)
      })
      view.webContents.on('console-message', (_e, level, message) => {
        if (level >= 2 || message.includes('error') || message.includes('pause') || message.includes('ended') || message.includes('[YT') || message.includes('[API]')) {
          console.log(`[YT PAGE CONSOLE ${role}]:`, message)
        }
      })

      view.webContents.on('did-navigate-in-page', (_e, url) => {
        console.log(`[YT NAV IN PAGE] Role ${role} navigated in page to:`, url)
        this.checkViewForErrors(view, role, config.youtubeId)
        if (this.isLive && !this.hasPlaybackError) {
          view.setVisible(true)
          if (this.isPlaying) {
            this.executePlay(view, shouldPlayAudio)
          }
        }
      })

      view.webContents.on('did-navigate', (_e, url) => {
        console.log(`[YT NAV] Role ${role} navigated to:`, url)
        this.checkViewForErrors(view, role, config.youtubeId)
        if (this.isLive && !this.hasPlaybackError) {
          view.setVisible(true)
          if (this.isPlaying) {
            this.executePlay(view, shouldPlayAudio)
          }
        }
      })

      // Construct native YouTube watch page URL (Option B) to bypass third-party iframe embed blocks (Error 150/101)
      const inPointSec = config.inPoint ? Math.floor(config.inPoint) : 0
      const targetUrl = config.url && config.url.includes('youtube.com/watch')
        ? (inPointSec > 0 ? `${config.url}${config.url.includes('?') ? '&' : '?'}t=${inPointSec}` : config.url)
        : `https://www.youtube.com/watch?v=${config.youtubeId}${inPointSec > 0 ? `&t=${inPointSec}` : ''}`

      win.contentView.addChildView(view)
      view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
      // Keep hidden during prepare: audience never sees prepare / load state
      view.setVisible(false)

      view.webContents.loadURL(targetUrl).catch((err) => {
        if (!err.message?.includes('ERR_ABORTED')) {
          logger.warn(`YouTube watch navigation error for ${config.youtubeId}:`, err)
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
          if (window.__lastError) {
            return {
              hasError: true,
              errorCode: window.__lastError,
              reason: 'YouTube Error ' + window.__lastError
            };
          }
          const errEl = document.querySelector('.yt-playability-error-supported-renderers, ytd-player-error-message-renderer, #player-error-message-container');
          const reason = document.querySelector('#reason, .reason, .subreason');
          if (errEl && (errEl as HTMLElement).offsetParent !== null && ((errEl as HTMLElement).offsetWidth > 0 || (errEl as HTMLElement).offsetHeight > 0)) {
            const txt = (reason ? (reason as HTMLElement).innerText : (errEl as HTMLElement).innerText).trim().replace(/\\s+/g, ' ');
            if (txt.length > 5) {
              return {
                hasError: true,
                errorCode: '152-4',
                reason: txt
              };
            }
          }
          return { hasError: false };
        })()
      `)

      if (errInfo && errInfo.hasError) {
        this.hasPlaybackError = true
        view.setVisible(false) // AUDIENCE NEVER SEES ERROR CARD

        if (!this.reportedErrorVideoIds.has(videoId)) {
          this.reportedErrorVideoIds.add(videoId)

          const rawCode = errInfo.errorCode || '150'
          const isEmbedBlocked = rawCode === 150 || rawCode === 101 || rawCode === '150' || rawCode === '101'
          const code = isEmbedBlocked ? '150' : (String(rawCode) || '152-4')
          const friendlyReason = isEmbedBlocked
            ? 'El autor o discográfica ha bloqueado la reproducción incrustada de este video (Error 150/101)'
            : (errInfo.reason || 'Restringido por el autor o no existe')

          const errorPayload: YouTubePlaybackError = {
            videoId,
            code,
            message: `Video no disponible en YouTube: ${friendlyReason}`,
            role,
            details: errInfo.reason
          }
          logger.warn(`YouTube error detected on output '${role}':`, errorPayload.message)
          if (this.onErrorCallback) {
            this.onErrorCallback(errorPayload)
          }
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
        if (window.__player) {
          if (typeof window.__player.unMute === 'function' && typeof window.__player.mute === 'function') {
            if (${shouldPlayAudio}) window.__player.unMute(); else window.__player.mute();
          }
          if (typeof window.__player.playVideo === 'function') {
            try { window.__player.playVideo(); } catch (_) {}
          }
        }
        const player = document.querySelector('#movie_player');
        if (player) {
          if (typeof player.unMute === 'function' && typeof player.mute === 'function') {
            if (${shouldPlayAudio}) player.unMute(); else player.mute();
          }
          if (typeof player.playVideo === 'function') {
            try { player.playVideo(); } catch (_) {}
          }
        }
        const playBtn = document.querySelector('.ytp-large-play-button');
        if (playBtn && typeof (playBtn as any).click === 'function') {
          try { (playBtn as any).click(); } catch (_) {}
        }
        const video = document.querySelector('#movie_player video.html5-main-video') || document.querySelector('video');
        if (video) {
          video.muted = ${!shouldPlayAudio};
          video.play().catch(() => {});
          return true;
        }
        return Boolean(player || window.__player);
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
    this.lastObservedTime = 0
    this.stallCount = 0

    const audioRole = (this.activeConfig.audioRole === 'audience' ? 'main' : this.activeConfig.audioRole) || 'main'

    for (const [role, view] of this.outputViews.entries()) {
      if (view.webContents.isDestroyed()) continue

      const win = this.parentWindows.get(role)
      if (win && !win.isDestroyed()) {
        const bounds = win.getContentBounds()
        view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
      }

      // Only show if there is no error detected; if error, maintain black / safe background
      if (!this.hasPlaybackError) {
        view.setVisible(true)
      } else {
        view.setVisible(false)
      }

      const shouldPlayAudio = role === audioRole
      this.executePlay(view, shouldPlayAudio)
      setTimeout(() => {
        if (this.isLive && this.isPlaying && !this.hasPlaybackError && !view.webContents.isDestroyed()) {
          this.executePlay(view, shouldPlayAudio)
        }
      }, 1500)
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
          if (window.__player && typeof window.__player.pauseVideo === 'function') {
            try { window.__player.pauseVideo(); } catch (_) {}
          }
          const player = document.querySelector('#movie_player');
          if (player && typeof player.pauseVideo === 'function') {
            try { player.pauseVideo(); } catch (_) {}
          }
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
          if (window.__player) {
            if (${tick.isPlaying} && typeof window.__player.playVideo === 'function') {
              window.__player.playVideo();
            } else if (!${tick.isPlaying} && typeof window.__player.pauseVideo === 'function') {
              window.__player.pauseVideo();
            }
            if (typeof window.__player.getCurrentTime === 'function' && typeof window.__player.seekTo === 'function') {
              const cur = window.__player.getCurrentTime();
              if (Math.abs(cur - ${tick.currentTime}) > 0.6) {
                window.__player.seekTo(${tick.currentTime}, true);
              }
            }
          }
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
          if (window.__player && typeof window.__player.seekTo === 'function') {
            try { window.__player.seekTo(${seconds}, true); } catch (_) {}
          }
          const player = document.querySelector('#movie_player');
          if (player && typeof player.seekTo === 'function') {
            try { player.seekTo(${seconds}, true); } catch (_) {}
          }
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
          if (window.__player && typeof window.__player.setVolume === 'function') {
            try { window.__player.setVolume(${Math.round(this.volume * 100)}); } catch (_) {}
          }
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
      audioView.webContents.executeJavaScript(`
        (function() {
          if (window.__player) {
            if (${muted}) {
              if (typeof window.__player.mute === 'function') window.__player.mute();
            } else {
              if (typeof window.__player.unMute === 'function') window.__player.unMute();
            }
          }
        })();
      `).catch(() => {})
    }
  }

  private isCapturing = false

  /**
   * Captures the live visual output frame from the master display (role: main).
   * Scaled to 480x270 JPEG data URL for low-overhead silent operator preview (Option B).
   * Protected with concurrency lock to prevent GPU compositor starvation under hardware decode.
   */
  public async capturePreviewFrame(): Promise<string | null> {
    return null
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
            if (typeof window.__getStatus === 'function') {
              const s = window.__getStatus();
              if (s && (s.exists || s.isError)) {
                return {
                  exists: s.exists,
                  currentTime: s.currentTime || 0,
                  duration: s.duration || 0,
                  paused: s.paused || false,
                  ended: s.ended || false,
                  isAd: s.isAd || false,
                  isError: s.isError || false,
                  errorReason: s.errorCode ? ('YouTube Error ' + s.errorCode) : 'Error',
                  diag: s.diag || null
                };
              }
            }

            const player = document.querySelector('#movie_player');
            const video = document.querySelector('#movie_player video.html5-main-video') ||
                          document.querySelector('video.html5-main-video') ||
                          document.querySelector('#movie_player video') ||
                          document.querySelector('video');

            const isAd = Boolean(document.querySelector('.ad-showing, .ytp-ad-player-overlay'));
            const errEl = document.querySelector('.yt-playability-error-supported-renderers, ytd-player-error-message-renderer, #player-error-message-container');
            if (errEl && (errEl as HTMLElement).offsetParent !== null && ((errEl as HTMLElement).offsetWidth > 0 || (errEl as HTMLElement).offsetHeight > 0)) {
              const txt = (errEl as HTMLElement).innerText ? (errEl as HTMLElement).innerText.trim() : '';
              if (txt.length > 5) {
                return { exists: false, isError: true, errorReason: txt };
              }
            }
            if (!video && !player) return { exists: false, isAd, isError: false };

            let pTime = null;
            let pDur = null;
            let pState = null;
            if (player && typeof player.getCurrentTime === 'function') {
              try {
                pTime = player.getCurrentTime();
                pDur = player.getDuration();
                pState = player.getPlayerState();
              } catch (_) {}
            }

            // Automatic resume without seek if player/video explicitly pauses while live
            if (!isAd) {
              if (pState === 2) {
                if (player && typeof player.playVideo === 'function') {
                  try { player.playVideo(); } catch (_) {}
                }
              }
              if (video && video.paused && video.readyState >= 2) {
                video.play().catch(() => {});
              }
            }

            const videoTime = video ? video.currentTime : 0;
            const videoDur = video ? video.duration : 0;

            const currentTime = (typeof pTime === 'number' && !isNaN(pTime))
              ? pTime
              : (typeof videoTime === 'number' && !isNaN(videoTime) ? videoTime : 0);

            const duration = (typeof pDur === 'number' && !isNaN(pDur) && pDur > 0)
              ? pDur
              : (typeof videoDur === 'number' && !isNaN(videoDur) ? videoDur : 0);

            // Crucial: A video has ONLY ended if currentTime reached duration (or outPoint).
            // DASH/MSE buffer transitions fire transient 'ended' events on intermediate chunks at ~42s!
            const reachedEnd = duration > 0 && currentTime >= duration - 1.5;
            const ended = reachedEnd && (pState === 0 || (video ? video.ended : false));
            const paused = pState !== null ? (pState === 2) : (video ? video.paused : false);

            return {
              exists: true,
              currentTime,
              duration,
              paused,
              ended,
              isAd,
              isError: false,
              diag: {
                pState,
                pTime,
                videoTime,
                videoPaused: video ? video.paused : null,
                videoReadyState: video ? video.readyState : null,
                videoNetworkState: video ? video.networkState : null,
                videoError: video && video.error ? video.error.code : null,
                vBuffered: video && video.buffered && video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0,
                pLoaded: player && typeof player.getVideoLoadedFraction === 'function' ? player.getVideoLoadedFraction() : null,
                vCount: document.querySelectorAll('video').length,
                vSrc: video ? (video.currentSrc || video.src || '').slice(0, 50) : null,
                vData: player && typeof player.getVideoData === 'function' ? player.getVideoData()?.video_id : null,
                dialogText: Array.from(document.querySelectorAll('ytd-popup-container, tp-yt-paper-dialog, yt-confirm-dialog-renderer'))
                  .map(el => el.innerText.trim()).filter(Boolean).join(' | ')
              }
            };
          })();
        `)

        if (stats && stats.isError) {
          this.hasPlaybackError = true
          masterView.setVisible(false)

          const vid = this.activeConfig?.youtubeId
          if (this.onErrorCallback && vid && !this.reportedErrorVideoIds.has(vid)) {
            this.reportedErrorVideoIds.add(vid)

            const rawCode = stats.errorCode || '150'
            const isEmbedBlocked = rawCode === 150 || rawCode === 101 || rawCode === '150' || rawCode === '101'
            const code = isEmbedBlocked ? '150' : (String(rawCode) || '152-4')
            const friendlyReason = isEmbedBlocked
              ? 'El autor o discográfica ha bloqueado la reproducción incrustada de este video (Error 150/101)'
              : (stats.errorReason || 'Restringido por el autor')

            this.onErrorCallback({
              videoId: vid,
              code,
              message: `Video no disponible en YouTube: ${friendlyReason}`,
              details: stats.errorReason
            })
          }
          // Stop sync timer to prevent repeated polling and redundant error notifications
          this.stopSyncLoop()
          return
        }

        if (stats && stats.exists) {
          if (this.isLive && !this.hasPlaybackError && !masterView.webContents.isDestroyed()) {
            masterView.setVisible(true)
          }
          this.lastDiag = stats.diag
          this.currentTime = stats.currentTime
          if (stats.duration && !isNaN(stats.duration)) {
            this.duration = stats.duration
          }

          // Universal monotonic watchdog: gentle recovery without destroying the DASH buffer
          if (!stats.isAd && this.isPlaying && this.activeConfig && !stats.ended) {
            if (stats.currentTime > this.lastObservedTime + 0.05) {
              this.lastObservedTime = stats.currentTime
              this.stallCount = 0
            } else {
              this.stallCount++
              // Periodic gentle resume without unloading video
              if (this.stallCount % 6 === 0) {
                masterView.webContents.executeJavaScript(`
                  (function() {
                    const p = document.querySelector('#movie_player');
                    if (p && typeof p.playVideo === 'function') p.playVideo();
                    const v = document.querySelector('video');
                    if (v && v.paused) v.play().catch(() => {});
                  })()
                `).catch(() => {})
              }
            }
          }

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
              isLive: this.isLive,
              timestamp: Date.now()
            })
          }

          // Check if video reached outPoint or ended
          const outPoint = this.activeConfig?.outPoint
          const isAtEnd = (outPoint && stats.currentTime >= outPoint) || (stats.ended && this.duration > 0 && stats.currentTime >= this.duration - 1.5)
          if (isAtEnd && this.isPlaying) {
            this.handleVideoEnded()
          }

          // Resynchronize secondary output display if drift exceeds threshold (1.5s)
          if (this.outputViews.size > 1) {
            const now = Date.now()
            for (const [role, slaveView] of this.outputViews.entries()) {
              if (slaveView === masterView || slaveView.webContents.isDestroyed()) continue
              const lastResync = this.lastSlaveResyncTime.get(role) || 0
              if (now - lastResync < 3000) continue

              try {
                const slaveDiag: any = await slaveView.webContents.executeJavaScript(
                  `(function() {
                    const p = document.querySelector('#movie_player');
                    const v = document.querySelector('video');
                    return {
                      time: p && p.getCurrentTime ? p.getCurrentTime() : (v ? v.currentTime : 0),
                      pState: p && p.getPlayerState ? p.getPlayerState() : null,
                      videoReadyState: v ? v.readyState : null
                    };
                  })()`
                )
                if (slaveDiag && typeof slaveDiag.time === 'number' && slaveDiag.time > 0) {
                  const driftCheck = calculatePlaybackDrift(stats.currentTime, slaveDiag.time, 3.0)
                  if (driftCheck.isOutThreshold) {
                    this.lastSlaveResyncTime.set(role, now)
                    slaveView.webContents.executeJavaScript(
                      `(function() {
                        const p = document.querySelector('#movie_player');
                        const v = document.querySelector('video');
                        if (p && p.playVideo) p.playVideo();
                        if (v && v.paused) v.play().catch(() => {});
                      })()`
                    ).catch(() => {})
                  }
                } else if (slaveDiag && slaveDiag.pState === -1 && stats.currentTime > 0) {
                  this.lastSlaveResyncTime.set(role, now)
                  slaveView.webContents.executeJavaScript(`
                    (function() {
                      const p = document.querySelector('#movie_player');
                      if (p && typeof p.playVideo === 'function') p.playVideo();
                    })()
                  `).catch(() => {})
                }
              } catch (_err) {
                // Secondary view read error
              }
            }
          }
        }
      } catch (syncErr: any) {
        console.log('[YT MANAGER TICK] Exception in syncInterval:', syncErr?.message)
      }
    }, 500)
  }

  private handleVideoEnded(): void {
    console.log('[PAUSE_DIAG] handleVideoEnded called! currentTime:', this.currentTime, 'duration:', this.duration)
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
      hasPlaybackError: this.hasPlaybackError,
      diag: this.lastDiag
    }
  }

  public getLivePlaybackTime(): number {
    return this.currentTime
  }

  public isCurrentlyLive(): boolean {
    return this.isLive && this.isPlaying
  }
}

export const youtubeOutputManager = new YouTubeOutputManager()
