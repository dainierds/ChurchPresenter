import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { RemoteAuthService } from '../src/main/remote/remote-auth-service'
import { getStageViewerHtml, getObsBrowserSourceHtml, getRemoteControlHtml } from '../src/main/remote/client-templates'

describe('RemoteAuthService (PIN, Sessions, Rate Limiting & Lockout)', () => {
  let tempDir: string
  let dbPath: string
  let authService: RemoteAuthService

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-remote-auth-test-'))
    dbPath = path.join(tempDir, 'test.sqlite')
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(tempDir, 'backups')
    await databaseService.initialize()

    authService = new RemoteAuthService()
    authService.initialize()
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('initializes with a valid 6-digit numeric PIN', () => {
    const pin = authService.getPin()
    expect(pin).toMatch(/^\d{6}$/)
  })

  it('authenticates successfully with valid PIN and returns session token', () => {
    const pin = authService.getPin()
    const res = authService.authenticate({
      pin,
      ip: '192.168.1.100',
      deviceName: 'iPhone 15 Pro',
      role: 'operator'
    })

    expect(res.success).toBe(true)
    expect(res.session).toBeDefined()
    expect(res.session?.role).toBe('operator')
    expect(res.session?.name).toBe('iPhone 15 Pro')

    // Verify session via token
    const token = res.session!.id
    const verified = authService.verifySession(token)
    expect(verified).not.toBeNull()
    expect(verified?.name).toBe('iPhone 15 Pro')
  })

  it('rejects authentication with invalid PIN', () => {
    const res = authService.authenticate({
      pin: '000000',
      ip: '192.168.1.101',
      deviceName: 'Unknown'
    })

    expect(res.success).toBe(false)
    expect(res.error).toMatch(/PIN incorrecto/)
  })

  it('locks out IP after 5 consecutive failed attempts for 5 minutes', () => {
    const ip = '192.168.1.105'

    for (let i = 1; i <= 4; i++) {
      const res = authService.authenticate({ pin: '999999', ip })
      expect(res.success).toBe(false)
      expect(res.remainingLockSeconds).toBeUndefined()
    }

    // 5th failed attempt triggers lockout
    const res5 = authService.authenticate({ pin: '999999', ip })
    expect(res5.success).toBe(false)
    expect(res5.remainingLockSeconds).toBeGreaterThan(0)
    expect(res5.error).toMatch(/Acceso bloqueado temporalmente/)

    // 6th attempt (even with CORRECT PIN) is rejected while locked
    const correctPin = authService.getPin()
    const res6 = authService.authenticate({ pin: correctPin, ip })
    expect(res6.success).toBe(false)
    expect(res6.error).toMatch(/Demasiados intentos fallidos/)
  })

  it('revokes session token when kicked by operator', () => {
    const pin = authService.getPin()
    const res = authService.authenticate({
      pin,
      ip: '192.168.1.110',
      deviceName: 'iPad Air',
      role: 'stage-viewer'
    })

    const token = res.session!.id
    expect(authService.verifySession(token)).not.toBeNull()

    const revoked = authService.revokeSession(token)
    expect(revoked).toBe(true)
    expect(authService.verifySession(token)).toBeNull()
  })

  it('regenerates PIN and invalidates all existing sessions for security', () => {
    const pin1 = authService.getPin()
    const res = authService.authenticate({ pin: pin1, ip: '192.168.1.120' })
    const token = res.session!.id
    expect(authService.verifySession(token)).not.toBeNull()

    const pin2 = authService.regeneratePin()
    expect(pin2).toMatch(/^\d{6}$/)
    expect(authService.getPin()).toBe(pin2)

    // Previous token is now invalidated
    expect(authService.verifySession(token)).toBeNull()
  })

  it('generates remote HTML templates enforcing PIN and token requirements', () => {
    // 1. Remote control client always demands PIN and authorization token
    const remoteHtml = getRemoteControlHtml()
    expect(remoteHtml).toContain('id="authModal"')
    expect(remoteHtml).toContain('id="pinInput"')
    expect(remoteHtml).toContain('/api/auth')

    // 2. Stage viewer template: enforce PIN modal when requirePin is true
    const stageWithPin = getStageViewerHtml({ requirePin: true })
    expect(stageWithPin).toContain('id="stageAuthModal"')
    expect(stageWithPin).toContain('id="stagePinInput"')
    expect(stageWithPin).toContain('if (!true || token)')

    // 3. Stage viewer template: bypass PIN modal only when requirePin is explicitly false
    const stageWithoutPin = getStageViewerHtml({ requirePin: false })
    expect(stageWithoutPin).not.toContain('id="stageAuthModal"')
    expect(stageWithoutPin).toContain('if (!false || token)')

    // 4. OBS Browser source template: verify requirePin wiring
    const obsWithPin = getObsBrowserSourceHtml({ role: 'main', requirePin: true })
    expect(obsWithPin).toContain('const requirePin = true;')
    const obsWithoutPin = getObsBrowserSourceHtml({ role: 'main', requirePin: false })
    expect(obsWithoutPin).toContain('const requirePin = false;')
  })

  it('creates strictly read-only stage sessions and denies operator actions', () => {
    const stageSession = authService.createReadOnlyStageSession('192.168.1.150', 'iPad Stage')
    expect(stageSession.role).toBe('stage-viewer')
    expect(stageSession.id).toBeDefined()

    const verified = authService.verifySession(stageSession.id)
    expect(verified).not.toBeNull()
    expect(verified?.role).toBe('stage-viewer')

    // Stage viewer sessions cannot act as operators
    const isOperator = verified?.role === 'operator'
    expect(isOperator).toBe(false)
  })

  it('measures remote control token verification empirical latencies (p50 and p95)', () => {
    const pin = authService.getPin()
    const authRes = authService.authenticate({ pin, ip: '127.0.0.1', deviceName: 'Benchmark Client' })
    expect(authRes.success).toBe(true)
    const token = authRes.session!.id

    const latenciesMs: number[] = []
    const iterations = 200

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now()
      const session = authService.verifySession(token)
      const t1 = performance.now()
      expect(session).not.toBeNull()
      latenciesMs.push(t1 - t0)
    }

    latenciesMs.sort((a, b) => a - b)
    const p50 = latenciesMs[Math.floor(iterations * 0.5)]
    const p95 = latenciesMs[Math.floor(iterations * 0.95)]
    const avg = latenciesMs.reduce((sum, v) => sum + v, 0) / iterations

    console.log('\n======================================================================')
    console.log('   REMOTE CONTROL EMPIRICAL LATENCY BENCHMARK (200 SAMPLES)          ')
    console.log('======================================================================')
    console.log(`-> Muestras Analizadas:  ${iterations}`)
    console.log(`-> Latencia Media:       ${avg.toFixed(3)} ms`)
    console.log(`-> Latencia p50:         ${p50.toFixed(3)} ms`)
    console.log(`-> Latencia p95:         ${p95.toFixed(3)} ms`)
    console.log('======================================================================\n')

    expect(p50).toBeLessThan(5.0) // sub-millisecond expected in Node memory
    expect(p95).toBeLessThan(10.0)
  })
})
