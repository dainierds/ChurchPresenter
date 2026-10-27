import { describe, it, expect, beforeEach } from 'vitest'
import { stateManager } from '../src/main/state-manager'
import { SlideItem } from '../src/shared/types'

describe('Video Continuity & Bible Projection', () => {
  beforeEach(() => {
    // Reset state before each test
    stateManager.setGlobalControl('clear', false)
    stateManager.setGlobalControl('logo', false)
    stateManager.setGlobalControl('black', false)
  })

  it('preserves master media tick when toggling Clear and Logo controls', () => {
    // Simulate playing a video
    stateManager.updateMediaSyncTick({
      mediaId: 'vid-123',
      mediaType: 'video',
      filePath: 'C:/media/intro.mp4',
      isPlaying: true,
      currentTime: 14.5,
      duration: 60.0,
      loop: false,
      volume: 1.0,
      audioOutputRole: 'main',
      timestamp: Date.now()
    })

    let state = stateManager.getState()
    expect(state.mediaSyncTick?.isPlaying).toBe(true)
    expect(state.mediaSyncTick?.currentTime).toBe(14.5)

    // Toggle Clear
    state = stateManager.toggleGlobalControl('clear')
    expect(state.controls.clear).toBe(true)
    // Master clock tick is NOT destroyed: currentTime is preserved
    expect(state.mediaSyncTick?.currentTime).toBe(14.5)

    // Toggle Clear off
    state = stateManager.toggleGlobalControl('clear')
    expect(state.controls.clear).toBe(false)
    expect(state.mediaSyncTick?.currentTime).toBe(14.5)

    // Toggle Logo
    state = stateManager.toggleGlobalControl('logo')
    expect(state.controls.logo).toBe(true)
    expect(state.mediaSyncTick?.currentTime).toBe(14.5)

    // Toggle Logo off
    state = stateManager.toggleGlobalControl('logo')
    expect(state.controls.logo).toBe(false)
    expect(state.mediaSyncTick?.currentTime).toBe(14.5)
  })

  it('automatically removes video and clears media sync tick when projecting a Bible slide', () => {
    // 1. First, send a video slide
    const videoSlide: SlideItem = {
      id: 'vid-slide-1',
      sourceId: 'vid-1',
      sourceType: 'video',
      groupLabel: 'Video',
      slideIndex: 1,
      totalSlidesInGroup: 1,
      title: 'Video de Apertura',
      body: '',
      subtitle: '',
      mediaUrl: 'C:/media/worship_video.mp4',
      mediaType: 'video'
    }

    stateManager.sendSlide(videoSlide)
    stateManager.updateMediaSyncTick({
      mediaId: 'vid-1',
      mediaType: 'video',
      filePath: 'C:/media/worship_video.mp4',
      isPlaying: true,
      currentTime: 22.0,
      duration: 120.0,
      loop: false,
      volume: 1.0,
      audioOutputRole: 'main',
      timestamp: Date.now()
    })

    let state = stateManager.getState()
    expect(state.currentSlide?.mediaType).toBe('video')
    expect(state.mediaSyncTick?.isPlaying).toBe(true)

    // 2. Now user selects a Bible passage and projects a scripture slide
    const scriptureSlide: SlideItem = {
      id: 'bible-slide-1',
      sourceId: 'bible-1',
      sourceType: 'scripture',
      contentType: 'bible',
      groupLabel: 'Lectura Bíblica',
      slideIndex: 1,
      totalSlidesInGroup: 1,
      title: 'Juan 3:16',
      body: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito...',
      subtitle: 'RVR1960',
      scripturePayload: {
        reference: 'Juan 3:16',
        bookNumber: 43,
        chapter: 3,
        verseStart: 16,
        verseEnd: 16,
        primaryText: 'Porque de tal manera amó Dios al mundo...'
      }
    }

    stateManager.sendSlide(scriptureSlide, ['main', 'lobby', 'stage'])
    state = stateManager.getState()

    // Verification:
    // a) Video mediaSyncTick is automatically cleared to null
    expect(state.mediaSyncTick).toBeNull()

    // b) currentSlide reflects Bible content with NO video/youtube leftovers
    expect(state.currentSlide?.mediaUrl).toBeUndefined()
    expect(state.currentSlide?.mediaType).toBeUndefined()
    expect(state.currentSlide?.youtubeId).toBeUndefined()
    expect(state.currentSlide?.title).toBe('Juan 3:16')
    expect(state.currentSlide?.body).toContain('Porque de tal manera')

    // c) Target output layers have the biblical text and no mediaUrl
    expect(state.activeLayers['main'].content?.body).toContain('Porque de tal manera')
    expect(state.activeLayers['main'].content?.mediaUrl).toBeUndefined()
    expect(state.activeLayers['main'].content?.mediaType).toBeUndefined()
    expect(state.activeLayers['stage'].content?.body).toContain('Porque de tal manera')

    // d) Controls clear is automatically cleared so text shows immediately
    expect(state.controls.clear).toBe(false)
  })
})
