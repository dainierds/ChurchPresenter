import { session, net } from 'electron'
import fs from 'fs'
import { logger } from '../logger'
import {
  YouTubeAvailabilityStatus,
  YouTubeDownloadProgress,
  ServiceItem
} from '../../shared/types'
import { parseYouTubeUrl } from '../../shared/youtube-utils'
import { spawn } from 'child_process'
import path from 'path'

export interface YouTubeMetadata {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  duration: number
  availabilityStatus: YouTubeAvailabilityStatus
}

export class YouTubeService {
  private static instance: YouTubeService | null = null
  public static readonly SESSION_PARTITION = 'persist:youtube'

  // Restricted navigation allowed domains
  public static readonly ALLOWED_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtube-nocookie.com',
    'google.com',
    'accounts.google.com',
    'myaccount.google.com',
    'gstatic.com',
    'fonts.gstatic.com',
    'ytimg.com',
    'i.ytimg.com',
    'googlevideo.com',
    'googleusercontent.com',
    'play.google.com'
  ]

  // Ad network and tracking URL patterns for blocking
  public static readonly AD_BLOCK_PATTERNS = [
    '*://*.doubleclick.net/*',
    '*://*.googleadservices.com/*',
    '*://*googleads.g.doubleclick.net/*',
    '*://*.googlesyndication.com/*',
    '*://*.youtube.com/api/stats/ads*',
    '*://*.youtube.com/pagead/*',
    '*://*.youtube.com/ptracking*',
    '*://*.youtube.com/get_midroll_info*'
  ]

  private initialized = false

  public static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService()
    }
    return YouTubeService.instance
  }

  /**
   * Initializes the dedicated YouTube session with strict sandboxing,
   * denied permissions, ad blocking, and navigation restrictions.
   */
  public initializeSession(): void {
    if (this.initialized) return

    const ytSession = session.fromPartition(YouTubeService.SESSION_PARTITION)

    // 1. Deny dangerous hardware permissions (camera, microphone, geolocation, notifications)
    ytSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      logger.info(`YouTube session: denied permission request for '${permission}'`)
      callback(false)
    })

    // 2. Deny device permission requests
    if (typeof (ytSession as any).setDevicePermissionHandler === 'function') {
      (ytSession as any).setDevicePermissionHandler(() => false)
    }

    // 3. Implement ad-blocking via WebRequest API strictly on the dedicated YouTube partition
    try {
      ytSession.webRequest.onBeforeRequest(
        { urls: YouTubeService.AD_BLOCK_PATTERNS },
        (details, callback) => {
          logger.debug(`[AdBlocker] Blocked ad request: ${details.url.substring(0, 80)}`)
          callback({ cancel: true })
        }
      )
      logger.info('YouTube session: Ad-blocking webRequest filters initialized on dedicated partition.')
    } catch (err) {
      logger.warn('Failed to configure ad-blocking webRequest:', err)
    }

    this.initialized = true
    logger.info(`YouTube session initialized for partition '${YouTubeService.SESSION_PARTITION}'.`)
  }

  /**
   * Evaluates if a given URL belongs to the allowed YouTube/Google ecosystem whitelist.
   */
  public isAllowedUrl(urlString: string): boolean {
    try {
      const parsed = new URL(urlString)
      const hostname = parsed.hostname.toLowerCase()
      return YouTubeService.ALLOWED_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      )
    } catch {
      return false
    }
  }

  /**
   * Fetches metadata for a YouTube video via the official zero-key oEmbed endpoint.
   */
  public async fetchMetadata(videoIdOrUrl: string): Promise<YouTubeMetadata> {
    const parsed = parseYouTubeUrl(videoIdOrUrl)
    const videoId = parsed.videoId || videoIdOrUrl

    const defaultMetadata: YouTubeMetadata = {
      videoId,
      title: `YouTube (${videoId})`,
      channelTitle: 'YouTube',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 0,
      availabilityStatus: 'checking'
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`

    try {
      const fetchFn =
        typeof net !== 'undefined' && typeof net.fetch === 'function'
          ? net.fetch
          : globalThis.fetch

      const response = await fetchFn(oembedUrl)

      if (response.status === 200) {
        const data: any = await response.json()
        return {
          videoId,
          title: data.title || defaultMetadata.title,
          channelTitle: data.author_name || defaultMetadata.channelTitle,
          thumbnailUrl: data.thumbnail_url || defaultMetadata.thumbnailUrl,
          duration: 0, // oEmbed does not provide duration in seconds
          availabilityStatus: 'ok'
        }
      } else if (response.status === 401) {
        return { ...defaultMetadata, availabilityStatus: 'requires_auth' }
      } else if (response.status === 403) {
        return { ...defaultMetadata, availabilityStatus: 'unembeddable' }
      } else if (response.status === 404 || response.status === 400) {
        return { ...defaultMetadata, availabilityStatus: 'unavailable' }
      } else {
        return { ...defaultMetadata, availabilityStatus: 'unavailable' }
      }
    } catch (err: any) {
      logger.warn(`Failed to fetch oEmbed metadata for ${videoId}:`, err)
      const isOffline =
        err?.code === 'ENOTFOUND' ||
        err?.code === 'ETIMEDOUT' ||
        err?.code === 'ECONNREFUSED' ||
        err?.message?.includes('network')
      return {
        ...defaultMetadata,
        availabilityStatus: isOffline ? 'offline' : 'unavailable'
      }
    }
  }

  /**
   * Verifies the availability of a specific video by ID or URL.
   */
  public async checkAvailability(videoIdOrUrl: string): Promise<YouTubeAvailabilityStatus> {
    const meta = await this.fetchMetadata(videoIdOrUrl)
    return meta.availabilityStatus
  }

  /**
   * Pre-service batch verification of all YouTube items in the playlist.
   */
  public async verifyPlaylistYouTubeItems(
    items: ServiceItem[]
  ): Promise<{
    totalChecked: number
    okCount: number
    failedCount: number
    results: { itemId: string; title: string; videoId: string; status: YouTubeAvailabilityStatus }[]
  }> {
    const youtubeItems = items.filter((it) => it.type === 'youtube' && it.youtubeConfig?.youtubeId)
    const results: { itemId: string; title: string; videoId: string; status: YouTubeAvailabilityStatus }[] = []

    let okCount = 0
    let failedCount = 0

    for (const item of youtubeItems) {
      const videoId = item.youtubeConfig!.youtubeId
      const status = await this.checkAvailability(videoId)
      results.push({
        itemId: item.id,
        title: item.name || item.youtubeConfig!.title,
        videoId,
        status
      })

      if (status === 'ok') {
        okCount++
      } else {
        failedCount++
      }
    }

    return {
      totalChecked: youtubeItems.length,
      okCount,
      failedCount,
      results
    }
  }

  /**
   * Clears cookies, cache, local storage, and session data for the YouTube partition.
   */
  public async clearSession(): Promise<boolean> {
    try {
      const ses = session.fromPartition(YouTubeService.SESSION_PARTITION)
      await ses.clearStorageData()
      await ses.clearCache()
      logger.info('YouTube session data and cookies cleared successfully.')
      return true
    } catch (err) {
      logger.error('Failed to clear YouTube session storage:', err)
      return false
    }
  }

  public static findYtDlpPath(): string | null {
    // 1. Check WinGet Packages
    const wingetDir = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages')
    if (fs.existsSync(wingetDir)) {
      try {
        const dirs = fs.readdirSync(wingetDir)
        for (const d of dirs) {
          if (d.toLowerCase().includes('yt-dlp')) {
            const exePath = path.join(wingetDir, d, 'yt-dlp.exe')
            if (fs.existsSync(exePath)) return exePath
          }
        }
      } catch (_err) {
        // Fallback to next detection method
      }
    }

    // 2. Check WinGet Links
    const wingetLinks = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe')
    if (fs.existsSync(wingetLinks)) return wingetLinks

    return 'yt-dlp'
  }

  public static findFfmpegPath(): string | null {
    const wingetDir = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages')
    if (fs.existsSync(wingetDir)) {
      try {
        const dirs = fs.readdirSync(wingetDir)
        for (const d of dirs) {
          if (d.toLowerCase().includes('ffmpeg')) {
            const checkPaths = [
              path.join(wingetDir, d, 'ffmpeg.exe'),
              path.join(wingetDir, d, 'bin', 'ffmpeg.exe')
            ]
            for (const p of checkPaths) {
              if (fs.existsSync(p)) return p
            }
            try {
              const sub = fs.readdirSync(path.join(wingetDir, d))
              for (const s of sub) {
                const p = path.join(wingetDir, d, s, 'bin', 'ffmpeg.exe')
                if (fs.existsSync(p)) return p
              }
            } catch (_err) {
              // Subfolder read error
            }
          }
        }
      } catch (_err) {
        // Fallback to null
      }
    }
    return null
  }

  /**
   * Attempts to download/extract a YouTube video to userData/media using yt-dlp if available on system.
   */
  public async downloadVideoToLocal(
    youtubeUrl: string,
    outputDirectory: string,
    onProgress?: (progress: YouTubeDownloadProgress) => void
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    return new Promise((resolve) => {
      const ytDlpPath = YouTubeService.findYtDlpPath() || 'yt-dlp'
      const ffmpegPath = YouTubeService.findFfmpegPath()

      // Sanitize URL to strip &list=... and other query params to prevent playlist traps
      const parsed = parseYouTubeUrl(youtubeUrl)
      const cleanUrl = parsed.videoId
        ? `https://www.youtube.com/watch?v=${parsed.videoId}`
        : youtubeUrl

      const args = [
        '--newline',
        '--no-playlist',
        '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--output', path.join(outputDirectory, 'yt_%(id)s.%(ext)s')
      ]

      if (ffmpegPath) {
        args.push('--ffmpeg-location', path.dirname(ffmpegPath))
      }
      args.push(cleanUrl)

      logger.info(`Starting YouTube download with: ${ytDlpPath} ${args.join(' ')}`)

      onProgress?.({
        percent: 0,
        statusText: 'Iniciando descarga con yt-dlp...'
      })

      const isExe = ytDlpPath.toLowerCase().endsWith('.exe') && fs.existsSync(ytDlpPath)
      const proc = spawn(ytDlpPath, args, { shell: !isExe })

      let stderr = ''
      let stdout = ''
      let stdoutBuffer = ''

      proc.stdout.on('data', (d) => {
        const text = d.toString()
        stdout += text
        stdoutBuffer += text
        const lines = stdoutBuffer.split(/\r?\n/)
        stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          const dlMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/i)
          if (dlMatch) {
            const percent = parseFloat(dlMatch[1])
            const totalSize = dlMatch[2]
            const speed = dlMatch[3] || ''
            const eta = dlMatch[4] || ''
            onProgress?.({
              percent,
              totalSize,
              speed: speed.includes('Unknown') ? '' : speed,
              eta: eta.includes('Unknown') ? '' : eta,
              statusText: `Descargando... ${percent.toFixed(0)}%`
            })
          } else if (line.includes('[Merger]') || line.includes('Merging formats')) {
            onProgress?.({
              percent: 99,
              statusText: 'Uniendo video y audio...'
            })
          } else if (line.includes('[download] 100%')) {
            onProgress?.({
              percent: 100,
              statusText: 'Completando descarga...'
            })
          }
        }
      })

      proc.stderr.on('data', (d) => {
        stderr += d.toString()
      })

      proc.on('error', (err) => {
        logger.error('Failed to spawn yt-dlp process:', err)
        resolve({
          success: false,
          error: `yt-dlp no está instalado o no se encuentra en el PATH del sistema: ${err.message}`
        })
      })

      proc.on('close', (code) => {
        if (code === 0) {
          // Find created mp4 file
          let target: string | undefined
          const match = stdout.match(/Destination:\s*(.+mp4)/i) || stdout.match(/\[download\]\s*(.+mp4)\s*has already been downloaded/i)
          if (match && fs.existsSync(match[1].trim())) {
            target = match[1].trim()
          } else {
            try {
              if (parsed.videoId) {
                const expected = path.join(outputDirectory, `yt_${parsed.videoId}.mp4`)
                if (fs.existsSync(expected)) target = expected
              }
              if (!target) {
                const files = fs.readdirSync(outputDirectory)
                  .filter((f) => f.startsWith('yt_') && f.endsWith('.mp4'))
                  .map((f) => ({ file: path.join(outputDirectory, f), mtime: fs.statSync(path.join(outputDirectory, f)).mtimeMs }))
                  .sort((a, b) => b.mtime - a.mtime)
                if (files.length > 0) target = files[0].file
              }
            } catch (_err) {
              // Could not list directory
            }
          }
          logger.info(`YouTube download completed successfully: ${target}`)
          onProgress?.({
            percent: 100,
            statusText: 'Descarga finalizada'
          })
          resolve({ success: true, filePath: target })
        } else {
          logger.warn(`yt-dlp exited with non-zero code ${code}: ${stderr}`)
          resolve({
            success: false,
            error: stderr || `Proceso finalizado con código de salida ${code}`
          })
        }
      })
    })
  }

  public static getAdSkipperScript(): string {
    return `
      (function() {
        if (window.__cp_ad_skipper_injected) return;
        window.__cp_ad_skipper_injected = true;

        function checkAndSkipAds() {
          try {
            // Check for skip ad buttons
            const skipButtons = document.querySelectorAll(
              '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button-text'
            );
            skipButtons.forEach(btn => {
              if (btn && typeof btn.click === 'function') {
                btn.click();
              }
            });

            // Fast forward video ads
            const adElement = document.querySelector('.ad-showing, .ytp-ad-player-overlay');
            const video = document.querySelector('video');
            if (adElement && video && !isNaN(video.duration) && isFinite(video.duration)) {
              video.muted = true;
              video.playbackRate = 16.0;
              video.currentTime = video.duration - 0.1;
            }

            // Close overlay ads
            const closeButtons = document.querySelectorAll(
              '.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container'
            );
            closeButtons.forEach(btn => {
              if (btn && typeof btn.click === 'function') {
                btn.click();
              }
            });
          } catch(e) {}
        }

        setInterval(checkAndSkipAds, 400);
      })();
    `
  }
}

export const youtubeService = YouTubeService.getInstance()
