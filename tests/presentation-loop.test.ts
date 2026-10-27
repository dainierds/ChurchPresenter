import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LoopService } from '../src/main/loop/loop-service'
import { LoopConfig } from '../src/shared/types'

describe('LoopService Presentation Loop Suite (Phase 8)', () => {
  let loop: LoopService

  beforeEach(() => {
    vi.useFakeTimers()
    loop = new LoopService()
  })

  afterEach(() => {
    loop.stopLoop(false)
    vi.useRealTimers()
  })

  it('starts loop and advances slides automatically at configured interval', () => {
    const advances: number[] = []
    const config: LoopConfig = {
      enabled: true,
      autoAdvanceSeconds: 3,
      loop: true,
      shuffle: false
    }

    loop.startLoop(config, 4, (nextIndex) => {
      advances.push(nextIndex)
    })

    expect(loop.isRunning()).toBe(true)
    const status = loop.getStatus()
    expect(status?.totalSlides).toBe(4)
    expect(status?.autoAdvanceSeconds).toBe(3)

    // Fast-forward 3 seconds
    vi.advanceTimersByTime(3000)
    expect(advances).toEqual([1])

    // Fast-forward another 3 seconds
    vi.advanceTimersByTime(3000)
    expect(advances).toEqual([1, 2])
  })

  it('wraps around to slide 0 when reaching the end of presentation if loop is true', () => {
    const advances: number[] = []
    const config: LoopConfig = {
      enabled: true,
      autoAdvanceSeconds: 1,
      loop: true,
      shuffle: false
    }

    loop.startLoop(config, 3, (nextIndex) => {
      advances.push(nextIndex)
    })

    // Advance 3 times: 0->1, 1->2, 2->0 (wrap around)
    vi.advanceTimersByTime(3000)
    expect(advances).toEqual([1, 2, 0])
  })

  it('stops cleanly and clears countdown intervals on stopLoop', () => {
    const config: LoopConfig = {
      enabled: true,
      autoAdvanceSeconds: 5,
      loop: true,
      shuffle: false
    }

    loop.startLoop(config, 5, () => {})
    expect(loop.isRunning()).toBe(true)

    loop.stopLoop(true)
    expect(loop.isRunning()).toBe(false)
    expect(loop.getStatus()).toBe(null)
  })
})
