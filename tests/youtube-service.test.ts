import { describe, it, expect } from 'vitest'
import { YouTubeService, youtubeService } from '../src/main/youtube/youtube-service'
import { ServiceItem } from '../src/shared/types'

describe('YouTube Service & Whitelist Security (Fase 5C)', () => {
  it('allows valid YouTube and Google ecosystem domains', () => {
    expect(youtubeService.isAllowedUrl('https://www.youtube.com')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://m.youtube.com/watch?v=aqz-KE-bpKQ')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://youtu.be/aqz-KE-bpKQ')).toBe(false) // youtu.be redirects to www.youtube.com
    expect(youtubeService.isAllowedUrl('https://accounts.google.com/signin')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://myaccount.google.com')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://fonts.gstatic.com/s/roboto')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg')).toBe(true)
    expect(youtubeService.isAllowedUrl('https://play.google.com/log')).toBe(true)
  })

  it('blocks untrusted or external third-party domains', () => {
    expect(youtubeService.isAllowedUrl('https://vimeo.com/1234567')).toBe(false)
    expect(youtubeService.isAllowedUrl('https://facebook.com')).toBe(false)
    expect(youtubeService.isAllowedUrl('https://malicious-site.com')).toBe(false)
    expect(youtubeService.isAllowedUrl('not-a-url')).toBe(false)
  })

  it('uses isolated session partition persist:youtube for authentic playback', () => {
    expect(YouTubeService.SESSION_PARTITION).toBe('persist:youtube')
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
          youtubeId: 'aqz-KE-bpKQ',
          url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          title: 'Blender Foundation - Big Buck Bunny',
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

    const validResult = report.results.find((r) => r.videoId === 'aqz-KE-bpKQ')
    const invalidResult = report.results.find((r) => r.videoId === 'invalid_id_9999')

    expect(validResult).toBeDefined()
    expect(validResult?.status).toBe('ok')

    expect(invalidResult).toBeDefined()
    expect(invalidResult?.status).toBe('unavailable')

    expect(report.okCount).toBe(1)
    expect(report.failedCount).toBe(1)
  })
})

describe('YouTube yt-dlp Integration & Progress Tracking', () => {
  it('detects yt-dlp binary path on the host system', () => {
    const ytDlpPath = YouTubeService.findYtDlpPath()
    expect(ytDlpPath).toBeDefined()
    expect(typeof ytDlpPath).toBe('string')
  })

  it('detects ffmpeg binary path for yt-dlp merging', () => {
    const ffmpegPath = YouTubeService.findFfmpegPath()
    expect(ffmpegPath).toBeDefined()
  })

  it('notifies download progress callback with initial status', async () => {
    const progressEvents: any[] = []
    const onProgress = (p: any) => {
      progressEvents.push(p)
    }

    const res = await youtubeService.downloadVideoToLocal(
      'https://invalid-url-domain.xyz',
      process.env.TEMP || '.',
      onProgress
    )

    expect(progressEvents.length).toBeGreaterThan(0)
    expect(progressEvents[0].percent).toBe(0)
    expect(progressEvents[0].statusText).toContain('yt-dlp')
    expect(res.success).toBe(false)
  })
})
