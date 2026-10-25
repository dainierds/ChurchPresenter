import { describe, it, expect, beforeEach } from 'vitest'
import { StateManager } from '../src/main/state-manager'
import { SlideItem } from '../src/shared/types'
import { parseYouTubeUrl } from '../src/shared/youtube-utils'

describe('YouTube Projection & State Management Verification', () => {
  let stateManager: StateManager

  beforeEach(() => {
    stateManager = new StateManager()
  })

  it('correctly parses videoId from YouTube URLs', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const parsed = parseYouTubeUrl(url)
    expect(parsed.isValid).toBe(true)
    expect(parsed.videoId).toBe('dQw4w9WgXcQ')
  })

  it('attaches youtubeId and youtubeDuration to both activeLayers and currentSlide', () => {
    const slide: SlideItem = {
      id: 'yt_slide_test_123',
      sourceId: 'test_123',
      sourceType: 'presentation',
      slideIndex: 0,
      totalSlidesInGroup: 1,
      title: 'Yamilka - A Dios Sea La Gloria',
      body: '▶ YouTube: Yamilka - A Dios Sea La Gloria\nCanal: Yamilka Oficial',
      mediaType: 'youtube',
      mediaUrl: 'https://www.youtube.com/watch?v=test_123',
      youtubeId: 'test_123',
      youtubeDuration: 300
    }

    const state = stateManager.sendSlide(slide, ['main', 'stage'])

    // Check main (audience) output layer
    const mainContent = state.activeLayers.main?.content
    expect(mainContent).toBeDefined()
    expect(mainContent?.mediaType).toBe('youtube')
    expect(mainContent?.youtubeId).toBe('test_123')
    expect(mainContent?.youtubeDuration).toBe(300)

    // Check stage display output layer
    const stageContent = state.activeLayers.stage?.content
    expect(stageContent).toBeDefined()
    expect(stageContent?.mediaType).toBe('youtube')
    expect(stageContent?.youtubeId).toBe('test_123')

    // Check currentSlide replica
    expect(state.currentSlide).toBeDefined()
    expect(state.currentSlide?.mediaType).toBe('youtube')
    expect(state.currentSlide?.youtubeId).toBe('test_123')
  })

  it('falls back to extracting youtubeId from mediaUrl if youtubeId is not directly passed', () => {
    const slide: any = {
      id: 'yt_slide_fallback',
      sourceId: 'abc123xyz00',
      sourceType: 'presentation',
      title: 'Fallback Test',
      body: 'Fallback Body',
      mediaType: 'youtube',
      mediaUrl: 'https://www.youtube.com/watch?v=abc123xyz00'
    }

    const state = stateManager.sendSlide(slide, ['main'])
    expect(state.activeLayers.main?.content?.youtubeId).toBe('abc123xyz00')
    expect(state.currentSlide?.youtubeId).toBe('abc123xyz00')
  })
})
