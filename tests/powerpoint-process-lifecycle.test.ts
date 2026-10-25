import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PowerPointService } from '../src/main/powerpoint/powerpoint-service'

describe('PowerPoint Process Lifecycle (Requirement 9)', () => {
  let service: PowerPointService

  beforeEach(() => {
    service = new PowerPointService()
  })

  it('detects no orphaned processes when PowerPoint was not running initially', async () => {
    const initialPids: number[] = []
    // Mock getPowerPointPids returning empty initial and empty final
    vi.spyOn(service, 'getPowerPointPids').mockResolvedValue([])
    const cleanupSpy = vi.spyOn(service, 'cleanupOrphanedPowerPoint')

    await service.cleanupOrphanedPowerPoint(initialPids)
    expect(cleanupSpy).toHaveBeenCalledWith(initialPids)
  })

  it('terminates only newly spawned PowerPoint PIDs if PPT was not running initially', async () => {
    const initialPids: number[] = [] // Not open before
    const currentPids = [12345] // Spawned by conversion

    vi.spyOn(service, 'getPowerPointPids').mockResolvedValue(currentPids)
    // Verify orphaned detection
    const orphaned = currentPids.filter((p) => !initialPids.includes(p))
    expect(orphaned).toEqual([12345])
  })

  it('preserves existing PowerPoint processes when PPT was already open before conversion', async () => {
    const initialPids = [9991, 9992] // User has PowerPoint open with presentations
    const currentPids = [9991, 9992, 12345] // 12345 is the COM worker

    vi.spyOn(service, 'getPowerPointPids').mockResolvedValue(currentPids)

    // Verify that initialPids are never terminated
    const orphaned = currentPids.filter((p) => !initialPids.includes(p))
    expect(orphaned).toEqual([12345])
    expect(orphaned).not.toContain(9991)
    expect(orphaned).not.toContain(9992)
  })

  it('cleans up on job cancellation', async () => {
    const initialPids: number[] = []
    const cleanupSpy = vi.spyOn(service, 'cleanupOrphanedPowerPoint').mockResolvedValue()

    // simulate cancel
    service['jobInitialPids'].set('job-test-1', initialPids)
    const fakeProc = {
      killed: false,
      kill: vi.fn()
    } as any
    service['activeJobs'].set('job-test-1', fakeProc)

    const cancelled = service.cancelJob('job-test-1')
    expect(cancelled).toBe(true)
    expect(fakeProc.kill).toHaveBeenCalledWith('SIGKILL')
    expect(cleanupSpy).toHaveBeenCalledWith(initialPids)
    expect(service['jobInitialPids'].has('job-test-1')).toBe(false)
  })
})
