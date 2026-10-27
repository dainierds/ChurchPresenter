import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { SessionRecoveryService } from '../src/main/recovery/session-recovery-service'

describe('Session Recovery & Crash Resilience (Phase 7)', () => {
  let tmpDir: string
  let recoveryService: SessionRecoveryService

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-recovery-test-'))
    recoveryService = new SessionRecoveryService()
  })

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('detects clean startup when no prior snapshot exists', () => {
    recoveryService.initialize(tmpDir)
    const check = recoveryService.checkRecovery()
    expect(check.hasPendingRecovery).toBe(false)
    expect(check.snapshot).toBeNull()
  })

  it('detects an unclean prior shutdown and provides snapshot for recovery', () => {
    // Simulate previous abnormal crash by pre-creating snapshot with cleanShutdown = false
    const snapshotPath = path.join(tmpDir, 'session-snapshot.json')
    const priorState = {
      activePlanId: 'plan-sunday-service',
      activePlanTitle: 'Culto Dominical Central',
      activeItemIndex: 2,
      activeSlideIndex: 3,
      currentSlide: {
        id: 'slide-verse-2',
        title: 'Cuan Grande es Él',
        body: 'Al recorrer los montes y los valles...'
      },
      activeLayers: {},
      controls: { black: false, clear: false, logo: false, freeze: false },
      timers: [],
      timestamp: Date.now() - 60000,
      cleanShutdown: false
    }
    fs.writeFileSync(snapshotPath, JSON.stringify(priorState), 'utf-8')

    // App launches after crash
    recoveryService.initialize(tmpDir)
    const check = recoveryService.checkRecovery()

    expect(check.hasPendingRecovery).toBe(true)
    expect(check.snapshot).not.toBeNull()
    expect(check.snapshot?.activePlanId).toBe('plan-sunday-service')
    expect(check.snapshot?.activePlanTitle).toBe('Culto Dominical Central')
    expect(check.snapshot?.activeItemIndex).toBe(2)
    expect(check.snapshot?.activeSlideIndex).toBe(3)
    expect(check.snapshot?.currentSlide?.title).toBe('Cuan Grande es Él')
  })

  it('allows dismissing recovery cleanly', () => {
    const snapshotPath = path.join(tmpDir, 'session-snapshot.json')
    fs.writeFileSync(
      snapshotPath,
      JSON.stringify({ activePlanId: 'p1', cleanShutdown: false, timestamp: Date.now() }),
      'utf-8'
    )

    recoveryService.initialize(tmpDir)
    expect(recoveryService.checkRecovery().hasPendingRecovery).toBe(true)

    const dismissed = recoveryService.dismissRecovery()
    expect(dismissed).toBe(true)
    expect(recoveryService.checkRecovery().hasPendingRecovery).toBe(false)
  })

  it('marks clean shutdown on normal exit so next launch does not prompt', () => {
    recoveryService.initialize(tmpDir)
    recoveryService.updateSessionState({
      activePlanId: 'service-wednesday',
      activeItemIndex: 1
    })

    // Simulate normal clean exit
    recoveryService.markCleanShutdown()

    // Next app launch
    const nextLaunchService = new SessionRecoveryService()
    nextLaunchService.initialize(tmpDir)
    const check = nextLaunchService.checkRecovery()
    expect(check.hasPendingRecovery).toBe(false)
  })
})
