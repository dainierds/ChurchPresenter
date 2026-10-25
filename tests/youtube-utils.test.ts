import { describe, it, expect } from 'vitest'
import {
  parseYouTubeUrl,
  parseYouTubeTimestamp,
  buildYouTubeEmbedUrl,
  calculatePlaybackDrift
} from '../src/shared/youtube-utils'

describe('YouTube URL & Timestamp Extraction (Fase 5C)', () => {
  it('extracts ID from standard watch URL', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
    expect(res.inPointSeconds).toBe(0)
    expect(res.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('extracts ID from youtu.be short URL', () => {
    const res = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
  })

  it('extracts ID from shorts URL', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
  })

  it('extracts ID from embed URL', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
  })

  it('extracts ID and timestamp with t= in seconds', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
    expect(res.inPointSeconds).toBe(45)
  })

  it('extracts ID and timestamp with compound t=1m30s', () => {
    const res = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=1m30s')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
    expect(res.inPointSeconds).toBe(90)
  })

  it('extracts ID and timestamp with hours t=1h2m3s', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
    expect(res.inPointSeconds).toBe(3723)
  })

  it('extracts ID and playlist ID from playlist item URL', () => {
    const res = parseYouTubeUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrEnWoR732-BvYk_9z_wG7p_9q-7c1qX3&index=4'
    )
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBe('dQw4w9WgXcQ')
    expect(res.playlistId).toBe('PLrEnWoR732-BvYk_9z_wG7p_9q-7c1qX3')
  })

  it('handles pure playlist URL gracefully', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/playlist?list=PLrEnWoR732-BvYk_9z_wG7p_9q-7c1qX3')
    expect(res.isValid).toBe(true)
    expect(res.videoId).toBeNull()
    expect(res.playlistId).toBe('PLrEnWoR732-BvYk_9z_wG7p_9q-7c1qX3')
  })

  it('handles mobile and live URLs', () => {
    const resMobile = parseYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(resMobile.isValid).toBe(true)
    expect(resMobile.videoId).toBe('dQw4w9WgXcQ')

    const resLive = parseYouTubeUrl('https://www.youtube.com/live/dQw4w9WgXcQ')
    expect(resLive.isValid).toBe(true)
    expect(resLive.videoId).toBe('dQw4w9WgXcQ')
  })

  it('returns invalid for non-YouTube or malformed strings', () => {
    expect(parseYouTubeUrl('not-a-url').isValid).toBe(false)
    expect(parseYouTubeUrl('https://vimeo.com/12345678').isValid).toBe(false)
    expect(parseYouTubeUrl('').isValid).toBe(false)
    expect(parseYouTubeUrl(null).isValid).toBe(false)
  })
})

describe('YouTube Timestamp Parsing', () => {
  it('parses plain seconds', () => {
    expect(parseYouTubeTimestamp('120')).toBe(120)
    expect(parseYouTubeTimestamp('120s')).toBe(120)
  })

  it('parses minutes and seconds', () => {
    expect(parseYouTubeTimestamp('3m45s')).toBe(225)
  })

  it('parses hours, minutes and seconds', () => {
    expect(parseYouTubeTimestamp('2h10m15s')).toBe(7815)
  })

  it('handles undefined or null', () => {
    expect(parseYouTubeTimestamp(null)).toBe(0)
    expect(parseYouTubeTimestamp(undefined)).toBe(0)
  })
})

describe('YouTube Embed URL Builder', () => {
  it('builds secure embed URL with start and end seconds', () => {
    const embed = buildYouTubeEmbedUrl('dQw4w9WgXcQ', {
      startSeconds: 15,
      endSeconds: 120,
      controls: false,
      mute: true
    })
    expect(embed).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ?')
    expect(embed).toContain('start=15')
    expect(embed).toContain('end=120')
    expect(embed).toContain('controls=0')
    expect(embed).toContain('mute=1')
    expect(embed).toContain('enablejsapi=1')
  })
})

describe('YouTube Playback Drift Calculation', () => {
  it('detects when drift is within tolerance', () => {
    const { drift, isOutThreshold } = calculatePlaybackDrift(10.5, 10.65, 0.25)
    expect(drift).toBeCloseTo(0.15, 2)
    expect(isOutThreshold).toBe(false)
  })

  it('detects when drift exceeds tolerance requiring seek resync', () => {
    const { drift, isOutThreshold } = calculatePlaybackDrift(10.0, 10.4, 0.25)
    expect(drift).toBeCloseTo(0.4, 2)
    expect(isOutThreshold).toBe(true)
  })
})
