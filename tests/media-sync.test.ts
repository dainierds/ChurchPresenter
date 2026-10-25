import { describe, it, expect } from 'vitest'
import {
  calculateDrift,
  shouldCorrectDrift,
  clampMediaTime,
  calculateFadeVolume
} from '../src/shared/media-sync-utils'

describe('Media Sync & Trim Utils', () => {
  it('calculates drift between local output time and master clock', () => {
    expect(calculateDrift(5.2, 5.0)).toBeCloseTo(0.2)
    expect(calculateDrift(4.9, 5.0)).toBeCloseTo(-0.1)
  })

  it('determines when drift exceeds correction threshold (150ms)', () => {
    expect(shouldCorrectDrift(0.05)).toBe(false)
    expect(shouldCorrectDrift(0.12)).toBe(false)
    expect(shouldCorrectDrift(0.18)).toBe(true)
    expect(shouldCorrectDrift(-0.25)).toBe(true)
  })

  it('clamps media time within inPoint and outPoint boundaries', () => {
    expect(clampMediaTime(2.0, 5.0, 30.0, 60.0)).toBe(5.0) // Before inPoint
    expect(clampMediaTime(15.0, 5.0, 30.0, 60.0)).toBe(15.0) // Within bounds
    expect(clampMediaTime(45.0, 5.0, 30.0, 60.0)).toBe(30.0) // After outPoint
  })

  it('computes smooth fade-in and fade-out volume curves', () => {
    // In-point = 0, Out-point = 20, FadeIn = 2s, FadeOut = 2s, BaseVolume = 1.0
    // At t=0s -> volume 0
    expect(calculateFadeVolume(0, 0, 20, 20, 2, 2, 1.0)).toBeCloseTo(0.0)
    // At t=1s (halfway through 2s fade-in) -> volume 0.5
    expect(calculateFadeVolume(1, 0, 20, 20, 2, 2, 1.0)).toBeCloseTo(0.5)
    // At t=10s (normal playback) -> volume 1.0
    expect(calculateFadeVolume(10, 0, 20, 20, 2, 2, 1.0)).toBeCloseTo(1.0)
    // At t=19s (halfway through 2s fade-out ending at 20) -> volume 0.5
    expect(calculateFadeVolume(19, 0, 20, 20, 2, 2, 1.0)).toBeCloseTo(0.5)
    // At t=20s -> volume 0.0
    expect(calculateFadeVolume(20, 0, 20, 20, 2, 2, 1.0)).toBeCloseTo(0.0)
  })
})
