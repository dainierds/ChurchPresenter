/**
 * YouTube Utility Functions
 * Supports extraction of video IDs, playlists, timestamp parsing,
 * and availability status evaluation.
 */

export interface ParsedYouTubeUrl {
  isValid: boolean
  videoId: string | null
  playlistId: string | null
  inPointSeconds: number
  canonicalUrl: string | null
  embedUrl: string | null
}

/**
 * Parses time format from YouTube query params (e.g. "90", "90s", "1m30s", "1h2m3s").
 * Returns time in seconds.
 */
export function parseYouTubeTimestamp(timeParam: string | null | undefined): number {
  if (!timeParam) return 0
  const clean = timeParam.trim().toLowerCase()

  // Case 1: Pure number (e.g. "90" or "90s")
  if (/^\d+s?$/.test(clean)) {
    return parseInt(clean.replace('s', ''), 10) || 0
  }

  // Case 2: Compound format (e.g. "1h20m30s", "2m15s", "1h30s")
  const hourMatch = clean.match(/(\d+)h/)
  const minMatch = clean.match(/(\d+)m/)
  const secMatch = clean.match(/(\d+)s/)

  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0
  const minutes = minMatch ? parseInt(minMatch[1], 10) : 0
  const seconds = secMatch ? parseInt(secMatch[1], 10) : 0

  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Extracts videoId, playlistId, and starting inPoint from any standard YouTube URL.
 */
export function parseYouTubeUrl(rawUrl: string | null | undefined): ParsedYouTubeUrl {
  const result: ParsedYouTubeUrl = {
    isValid: false,
    videoId: null,
    playlistId: null,
    inPointSeconds: 0,
    canonicalUrl: null,
    embedUrl: null
  }

  if (!rawUrl || typeof rawUrl !== 'string') {
    return result
  }

  const trimmed = rawUrl.trim()
  if (!trimmed) return result

  try {
    // Add protocol if missing
    const urlStr = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`

    const parsed = new URL(urlStr)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')

    // Extract timestamp
    const tParam = parsed.searchParams.get('t') || parsed.searchParams.get('start')
    result.inPointSeconds = parseYouTubeTimestamp(tParam)

    // Extract playlist ID if present
    const listParam = parsed.searchParams.get('list')
    if (listParam) {
      result.playlistId = listParam
    }

    // Host: youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
      const pathname = parsed.pathname.replace(/^\//, '')
      const parts = pathname.split('/')
      if (parts[0] && /^[a-zA-Z0-9_-]{11}$/.test(parts[0])) {
        result.videoId = parts[0]
      }
    }
    // Host: youtube.com, m.youtube.com, youtube-nocookie.com
    else if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'youtube-nocookie.com'
    ) {
      // 1. /watch?v=VIDEO_ID
      if (parsed.pathname === '/watch' || parsed.pathname === '/watch_popup') {
        const vParam = parsed.searchParams.get('v')
        if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
          result.videoId = vParam
        }
      }
      // 2. /shorts/VIDEO_ID
      else if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.replace('/shorts/', '').split('/')[0]
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          result.videoId = id
        }
      }
      // 3. /embed/VIDEO_ID
      else if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.replace('/embed/', '').split('/')[0]
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          result.videoId = id
        }
      }
      // 4. /live/VIDEO_ID
      else if (parsed.pathname.startsWith('/live/')) {
        const id = parsed.pathname.replace('/live/', '').split('/')[0]
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          result.videoId = id
        }
      }
      // 5. /v/VIDEO_ID
      else if (parsed.pathname.startsWith('/v/')) {
        const id = parsed.pathname.replace('/v/', '').split('/')[0]
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
          result.videoId = id
        }
      }
    }

    if (result.videoId) {
      result.isValid = true
      result.canonicalUrl = `https://www.youtube.com/watch?v=${result.videoId}`
      result.embedUrl = `https://www.youtube.com/embed/${result.videoId}`
    } else if (result.playlistId) {
      // Playlist without specific video ID
      result.isValid = true
      result.canonicalUrl = `https://www.youtube.com/playlist?list=${result.playlistId}`
    }
  } catch {
    // Malformed URL string
  }

  return result
}

/**
 * Builds an optimized embed URL for playback with proper parameters.
 */
export function buildYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean
    controls?: boolean
    startSeconds?: number
    endSeconds?: number
    mute?: boolean
    loop?: boolean
    origin?: string
  } = {}
): string {
  const params = new URLSearchParams()
  params.set('enablejsapi', '1')
  params.set('rel', '0')
  params.set('modestbranding', '1')
  params.set('playsinline', '1')
  params.set('iv_load_policy', '3')

  if (options.autoplay !== false) params.set('autoplay', '1')
  if (options.controls === false) params.set('controls', '0')
  if (options.mute) params.set('mute', '1')
  if (options.startSeconds && options.startSeconds > 0) {
    params.set('start', Math.floor(options.startSeconds).toString())
  }
  if (options.endSeconds && options.endSeconds > 0) {
    params.set('end', Math.floor(options.endSeconds).toString())
  }
  if (options.loop) {
    params.set('loop', '1')
    params.set('playlist', videoId)
  }
  if (options.origin) {
    params.set('origin', options.origin)
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * Evaluates whether two output players are synchronized within acceptable tolerance.
 * Returns true if drift is within driftThresholdSeconds (e.g. 0.250s).
 */
export function calculatePlaybackDrift(
  masterTime: number,
  slaveTime: number,
  driftThresholdSeconds = 0.25
): { drift: number; isOutThreshold: boolean } {
  const drift = Math.abs(masterTime - slaveTime)
  return {
    drift,
    isOutThreshold: drift > driftThresholdSeconds
  }
}
