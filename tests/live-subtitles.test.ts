import { describe, it, expect, beforeEach, vi } from 'vitest'
import { liveSubtitlesService } from '../src/main/extras/live-subtitles-service'
import { stateManager } from '../src/main/state-manager'

describe('Phase 10: Real-Time Live Subtitles & Translation Layer', () => {
  beforeEach(() => {
    liveSubtitlesService.clearSubtitle()
    liveSubtitlesService.saveConfig({
      enabled: true,
      position: 'bottom',
      fontSizeVmin: 3.5,
      maxLines: 2,
      fadeDurationMs: 300,
      autoClearDelaySec: 4,
      targetRoles: ['main', 'program']
    })
  })

  it('dispatches live subtitle and updates presenter state', () => {
    const sub = liveSubtitlesService.sendSubtitle({
      text: 'Porque de tal manera amó Dios al mundo',
      translation: 'For God so loved the world',
      targetRoles: ['main', 'program'],
      durationSec: 5
    })

    expect(sub.text).toBe('Porque de tal manera amó Dios al mundo')
    expect(sub.translation).toBe('For God so loved the world')
    expect(sub.targetRoles).toEqual(['main', 'program'])

    const curState = stateManager.getState()
    expect(curState.activeSubtitle).toBeDefined()
    expect(curState.activeSubtitle?.text).toBe('Porque de tal manera amó Dios al mundo')
  })

  it('manually clears subtitle from presenter state', () => {
    liveSubtitlesService.sendSubtitle({
      text: 'Texto de prueba',
      targetRoles: ['main']
    })

    expect(stateManager.getState().activeSubtitle).not.toBeNull()

    liveSubtitlesService.clearSubtitle()
    expect(stateManager.getState().activeSubtitle).toBeNull()
  })

  it('auto-clears subtitle after silence timeout', async () => {
    vi.useFakeTimers()

    liveSubtitlesService.sendSubtitle({
      text: 'Subtítulo con auto-limpieza',
      durationSec: 3
    })

    expect(stateManager.getState().activeSubtitle).not.toBeNull()

    // Advance 3 seconds
    vi.advanceTimersByTime(3100)
    expect(stateManager.getState().activeSubtitle).toBeNull()

    vi.useRealTimers()
  })
})
