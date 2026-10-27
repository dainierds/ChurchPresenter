import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { RemoteAuthService } from '../src/main/remote/remote-auth-service'

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
})
