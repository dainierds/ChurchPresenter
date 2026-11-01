/**
 * Converts a raw local or remote path into a valid URL for Chromium media/image elements.
 * Uses local HTTP streaming endpoint (http://127.0.0.1:58999/stream?file=...) which
 * completely bypasses Chromium URL safety check rejections and provides seamless
 * 206 Partial Content range seeking for local MP4/WebM videos.
 */
export function toMediaUrl(raw?: string): string {
  if (!raw) return ''
  if (
    raw.startsWith('http://') ||
    raw.startsWith('https://') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw
  }

  let clean = raw
  if (clean.startsWith('media://file/')) {
    clean = decodeURIComponent(clean.slice(13))
  } else if (clean.startsWith('media://')) {
    clean = decodeURIComponent(clean.slice(8))
  } else if (clean.startsWith('file:///')) {
    clean = decodeURIComponent(clean.slice(8))
  } else if (clean.startsWith('file://')) {
    clean = decodeURIComponent(clean.slice(7))
  }

  if (/^\/[a-zA-Z]:/.test(clean)) {
    clean = clean.slice(1)
  }

  const port = (typeof window !== 'undefined' && (window as any).__MEDIA_SERVER_PORT__) || 58999
  return `http://127.0.0.1:${port}/stream?file=${encodeURIComponent(clean.replace(/\\/g, '/'))}`
}
