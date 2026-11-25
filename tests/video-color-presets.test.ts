import { describe, it, expect } from 'vitest'
import {
  VIDEO_COLOR_PRESETS,
  getColorCorrectionFilter
} from '../src/renderer/operator/utils/videoColorPresets'

describe('Video Color Grading & Preset Filters', () => {
  it('contains essential presets including anti-yellow stage correction', () => {
    const ids = VIDEO_COLOR_PRESETS.map((p) => p.id)
    expect(ids).toContain('anti_tungsten_strong')
    expect(ids).toContain('anti_tungsten_soft')
    expect(ids).toContain('daylight_clean')
    expect(ids).toContain('portrait_preach')
    expect(ids).toContain('stage_vivid')
    expect(ids).toContain('cool_cinematic')
    expect(ids).toContain('original')
  })

  it('anti-yellow strong preset cools temperature and boosts contrast to eliminate yellow cast', () => {
    const antiYellow = VIDEO_COLOR_PRESETS.find((p) => p.id === 'anti_tungsten_strong')!
    expect(antiYellow).toBeDefined()
    expect(antiYellow.settings.temperature).toBeLessThan(0) // Cools down warm stage lighting
    expect(antiYellow.settings.contrast).toBeGreaterThan(100) // Restores shadow depth

    const filter = getColorCorrectionFilter({
      preset: antiYellow.id,
      ...antiYellow.settings
    })
    expect(filter).toContain('contrast(')
    expect(filter).toContain('hue-rotate(-')
  })

  it('original preset returns none filter', () => {
    const original = VIDEO_COLOR_PRESETS.find((p) => p.id === 'original')!
    const filter = getColorCorrectionFilter({
      preset: original.id,
      ...original.settings
    })
    expect(filter).toBe('none')
  })

  it('empty or undefined color correction returns none', () => {
    expect(getColorCorrectionFilter(null)).toBe('none')
    expect(getColorCorrectionFilter(undefined)).toBe('none')
    expect(getColorCorrectionFilter({})).toBe('none')
  })

  it('custom fine tuning correctly builds standard CSS filter functions', () => {
    const customFilter = getColorCorrectionFilter({
      temperature: -30,
      tint: 0,
      contrast: 110,
      brightness: 95,
      saturation: 105
    })
    expect(customFilter).toBe('brightness(0.95) contrast(1.10) saturate(1.05) hue-rotate(-10deg)')
  })
})
