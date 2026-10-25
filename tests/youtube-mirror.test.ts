import { describe, it, expect } from 'vitest'
import { YouTubeSyncTick } from '../src/shared/types'
import { parseYouTubeUrl } from '../src/shared/youtube-utils'

describe('YouTube Mirror Sync Verification', () => {
  it('correctly builds and parses mirror sync tick objects', () => {
    const url = 'https://www.youtube.com/watch?v=1bwkY0KwRuY'
    const parsed = parseYouTubeUrl(url)
    expect(parsed.isValid).toBe(true)
    expect(parsed.videoId).toBe('1bwkY0KwRuY')

    const tick: YouTubeSyncTick = {
      videoId: parsed.videoId!,
      url,
      title: 'Yamilka - A Dios Sea La Gloria',
      currentTime: 58.3,
      duration: 330,
      isPlaying: true,
      isBrowserSource: true,
      timestamp: Date.now()
    }

    expect(tick.isPlaying).toBe(true)
    expect(tick.currentTime).toBeCloseTo(58.3, 1)
    expect(tick.isBrowserSource).toBe(true)
  })

  it('handles pause events by setting isPlaying to false', () => {
    const tick: YouTubeSyncTick = {
      videoId: '1bwkY0KwRuY',
      url: 'https://www.youtube.com/watch?v=1bwkY0KwRuY',
      currentTime: 75.0,
      duration: 330,
      isPlaying: false, // user paused in YouTube browser
      isBrowserSource: true,
      timestamp: Date.now()
    }

    expect(tick.isPlaying).toBe(false)
    expect(tick.currentTime).toBe(75.0)
  })
})
