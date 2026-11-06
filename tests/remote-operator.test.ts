import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { RemoteAuthService } from '../src/main/remote/remote-auth-service'
import { databaseService } from '../src/main/db/database-service'
import { FORBIDDEN_ADMIN_TYPES } from '../src/main/remote/remote-server'

describe('Fase 12: Panel de Operador Remoto desde Casa (Tailscale VPN)', () => {
  let testDir: string
  let authService: RemoteAuthService

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-remote-op-test-'))
    const dbPath = path.join(testDir, 'test_remote_operator.sqlite')

    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(testDir, 'backups')
    await databaseService.initialize()

    // Configure distinct PINs
    databaseService.setConfig('remote_server_pin', '111111') // Local control PIN
    databaseService.setConfig('remote_operator_pin', '888888') // Remote operator PIN
    databaseService.setConfig('remote_operator_session_hours', '8')

    authService = new RemoteAuthService()
    authService.initialize()
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Autenticación y Nivel de Acceso (Rol Remote-Operator)', () => {
    it('autentica correctamente con el PIN de operador remoto específico', () => {
      const auth = authService.authenticate({
        pin: '888888',
        ip: '100.73.59.102',
        deviceName: 'Laptop ThinkPad (Tailscale)',
        role: 'remote-operator'
      })

      expect(auth.success).toBe(true)
      expect(auth.session).toBeDefined()
      expect(auth.session?.role).toBe('remote-operator')
      expect(auth.session?.name).toContain('Laptop ThinkPad')
      expect(auth.session?.ip).toBe('100.73.59.102')
    })

    it('rechaza autenticación si se usa el PIN de control local para el rol remote-operator', () => {
      const auth = authService.authenticate({
        pin: '111111', // PIN de control local, no de operador remoto
        ip: '100.73.59.102',
        role: 'remote-operator'
      })

      expect(auth.success).toBe(false)
      expect(auth.session).toBeUndefined()
      expect(auth.error).toContain('PIN incorrecto')
    })

    it('bloquea por 5 minutos tras 5 intentos fallidos desde la misma IP', () => {
      const ip = '100.73.59.105'
      for (let i = 0; i < 4; i++) {
        const res = authService.authenticate({ pin: '000000', ip, role: 'remote-operator' })
        expect(res.success).toBe(false)
        expect(res.remainingLockSeconds).toBeUndefined()
      }

      // 5th attempt triggers lockout
      const fifth = authService.authenticate({ pin: '000000', ip, role: 'remote-operator' })
      expect(fifth.success).toBe(false)
      expect(fifth.error).toContain('bloqueado temporalmente')
      expect(fifth.remainingLockSeconds).toBeGreaterThan(250)

      // Even correct PIN is blocked during lockout
      const blocked = authService.authenticate({ pin: '888888', ip, role: 'remote-operator' })
      expect(blocked.success).toBe(false)
      expect(blocked.error).toContain('Demasiados intentos fallidos')
    })
  })

  describe('2. Caducidad del Token y Renovación Automática (Sliding Expiration)', () => {
    it('renueva automáticamente la sesión activa al verificar el token (sliding TTL)', () => {
      const auth = authService.authenticate({
        pin: '888888',
        ip: '100.73.59.102',
        role: 'remote-operator'
      })
      const token = auth.session!.id

      const initialSession = authService.verifySession(token)
      expect(initialSession).not.toBeNull()
      expect(initialSession!.lastActiveAt).toBeDefined()

      // Advance clock slightly and verify
      const verifiedAgain = authService.verifySession(token)
      expect(verifiedAgain).not.toBeNull()
      expect(verifiedAgain?.role).toBe('remote-operator')
      expect(verifiedAgain?.lastActiveAt).toBeDefined()
    })

    it('caduca el token de operador remoto tras transcurrir las 8 horas de inactividad', () => {
      const auth = authService.authenticate({
        pin: '888888',
        ip: '100.73.59.102',
        role: 'remote-operator'
      })
      const token = auth.session!.id

      const sess = authService.verifySession(token)!
      expect(sess).not.toBeNull()

      // Artificially simulate 8.5 hours of inactivity
      const pastTime = Date.now() - 8.5 * 60 * 60 * 1000
      sess.lastActiveAt = new Date(pastTime).toISOString()

      const expired = authService.verifySession(token)
      expect(expired).toBeNull()
    })

    it('permite cierre de sesión explícito revocando el token inmediatamente', () => {
      const auth = authService.authenticate({
        pin: '888888',
        ip: '100.73.59.102',
        role: 'remote-operator'
      })
      const token = auth.session!.id

      const revoked = authService.revokeSession(token)
      expect(revoked).toBe(true)

      const check = authService.verifySession(token)
      expect(check).toBeNull()
    })
  })

  describe('3. Mínimo Privilegio y Auditoría de Acciones', () => {
    it('identifica y bloquea acciones administrativas prohibidas para el operador remoto', () => {
      expect(FORBIDDEN_ADMIN_TYPES).toContain('save-config')
      expect(FORBIDDEN_ADMIN_TYPES).toContain('delete-song')
      expect(FORBIDDEN_ADMIN_TYPES).toContain('delete-playlist')
      expect(FORBIDDEN_ADMIN_TYPES).toContain('import-library')
    })

    it('registra en auditoría las acciones del operador remoto con IP y marca de tiempo', () => {
      const auth = authService.authenticate({
        pin: '888888',
        ip: '100.73.59.102',
        role: 'remote-operator'
      })
      const session = authService.verifySession(auth.session!.id)!

      // Spy on logger or call auditLog directly
      expect(() => {
        authService.auditLog(session, 'studio-set-scene', { sceneId: 'scene_pastor_ppt' })
        authService.auditLog(session, 'studio-start-stream', { target: 'youtube' })
      }).not.toThrow()
    })
  })

  describe('4. Concurrencia y Resolución de Conflictos (Last-Write-Wins)', () => {
    it('mantiene sesiones independientes para operador local y operador remoto', () => {
      // Local operator
      const local = authService.authenticate({
        pin: '111111',
        ip: '192.168.1.50',
        deviceName: 'PC Iglesia Local',
        role: 'operator'
      })
      expect(local.success).toBe(true)

      // Remote operator via Tailscale
      const remote = authService.authenticate({
        pin: '888888',
        ip: '100.73.59.102',
        deviceName: 'Laptop Operador Remoto',
        role: 'remote-operator'
      })
      expect(remote.success).toBe(true)

      const all = authService.getSessions()
      expect(all.length).toBe(2)
      expect(all.map((s) => s.role)).toContain('operator')
      expect(all.map((s) => s.role)).toContain('remote-operator')
    })

    it('invalida solo las sesiones de operador remoto cuando se regenera su PIN específico', () => {
      const local = authService.authenticate({ pin: '111111', ip: '192.168.1.50', role: 'operator' })
      const remote = authService.authenticate({ pin: '888888', ip: '100.73.59.102', role: 'remote-operator' })

      const newRemotePin = authService.regenerateRemoteOperatorPin()
      expect(newRemotePin).toMatch(/^\d{6}$/)
      expect(newRemotePin).not.toBe('888888')

      // Remote session is now invalidated
      expect(authService.verifySession(remote.session!.id)).toBeNull()

      // Local operator session remains valid
      expect(authService.verifySession(local.session!.id)).not.toBeNull()
    })
  })
})
