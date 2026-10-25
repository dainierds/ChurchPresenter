import { describe, it, expect } from 'vitest'
import { YouTubeService, youtubeService } from '../src/main/youtube/youtube-service'
import { ServiceItem } from '../src/shared/types'

describe('YouTube Service & Whitelist Security (Fase 5C)', () => {
  it('allows valid YouTube and Google ecosystem domains', () => {
    expect(youtubeService.isAllowedUrl('https://www.youtube.com')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(false) // youtu.be redirects to www.youtube.com
    expect(youtubeService.isAllowedUrl('https://accounts.google.com/signin')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://myaccount.google.com')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://fonts.gstatic.com/s/roboto')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://play.google.com/log')).toBe(true)
  })

  it('blocks untrusted or external third-party domains', () => {
    expect(youtubeService.isAllowedUrl('https://vimeo.com/1234567')).toBe(false)
    expect(youtubeService.isAllowedUrl('https://facebook.com')).toBe(false)
    expect(youtubeService.isAllowedUrl('https://malicious-site.com')).toBe(false)
    expect(youtubeService.isAllowedUrl('not-a-url')).toBe(false)
  })

  it('includes proper ad network patterns in blocklist', () => {
    const patterns = YouTubeService.AD_BLOCK_PATTERNS
    expect(patterns.some((p) => p.includes('doubleclick.net'))).toBe(true)
    expect(patterns.some((p) => p.includes('googleadservices'))).toBe(true)
    expect(patterns.some((p) => p.includes('youtube.com/api/stats/ads'))).toBe(true)
    expect(patterns.some((p) => p.includes('youtube.com/pagead'))).toBe(true)
  })

  it('provides automated ad-skipper injection script', () => {
    const script = YouTubeService.getAdSkipperScript()
    expect(script).toContain('ytp-ad-skip-button')
    expect(script).toContain('video.playbackRate = 16.0')
    expect(script).toContain('ytp-ad-overlay-close-button')
  })
})

describe('YouTube Playlist Pre-Service Verification (Fase 5C)', () => {
  it('verifies a playlist with mixed items accurately', async () => {
    const sampleItems: ServiceItem[] = [
      {
        id: 'item_1',
        type: 'song',
        name: 'Himno de Gracia'
      },
      {
        id: 'item_2',
        type: 'youtube',
        name: 'Video Abierto de Prueba',
        youtubeConfig: {
          youtubeId: 'dQw4w9WgXcQ',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Rick Astley - Never Gonna Give You Up',
          duration: 212,
          targetRoles: ['main'],
          audioRole: 'main',
          endAction: 'freeze'
        }
      },
      {
        id: 'item_3',
        type: 'youtube',
        name: 'Video Inválido de Prueba',
        youtubeConfig: {
          youtubeId: 'invalid_id_9999',
          url: 'https://www.youtube.com/watch?v=invalid_id_9999',
          title: 'Video Inválido',
          duration: 0,
          targetRoles: ['main'],
          audioRole: 'main',
          endAction: 'freeze'
        }
      }
    ]

    const report = await youtubeService.verifyPlaylistYouTubeItems(sampleItems)
    expect(report.totalChecked).toBe(2)
    expect(report.results.length).toBe(2)

    const validResult = report.results.find((r) => r.videoId === 'dQw4w9WgXcQ')
    const invalidResult = report.results.find((r) => r.videoId === 'invalid_id_9999')

    expect(validResult).toBeDefined()
    expect(validResult?.status).toBe('ok')

    expect(invalidResult).toBeDefined()
    expect(invalidResult?.status).toBe('unavailable')

    expect(report.okCount).toBe(1)
    expect(report.failedCount).toBe(1)
  })
})
