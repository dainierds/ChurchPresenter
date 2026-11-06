import crypto from 'crypto'
import { RemoteClientSession } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export const REMOTE_CONFIG_KEY = 'remote_server_config'
export const REMOTE_PIN_CONFIG_KEY = 'remote_server_pin'
export const REMOTE_OPERATOR_PIN_CONFIG_KEY = 'remote_operator_pin'
export const REMOTE_OPERATOR_SESSION_HOURS_KEY = 'remote_operator_session_hours'

export interface RateLimitRecord {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number
}

export class RemoteAuthService {
  private sessions: Map<string, RemoteClientSession> = new Map() // token -> session
  private rateLimits: Map<string, RateLimitRecord> = new Map() // ip -> record
  private currentPin: string = ''
  private remoteOperatorPin: string = ''

  public readonly MAX_ATTEMPTS = 5
  public readonly LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes
  public readonly ATTEMPT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

  public initialize(): void {
    const savedPin = databaseService.getConfig(REMOTE_PIN_CONFIG_KEY)
    if (savedPin && /^\d{6}$/.test(savedPin)) {
      this.currentPin = savedPin
    } else {
      this.currentPin = this.generateNumericPin()
      databaseService.setConfig(REMOTE_PIN_CONFIG_KEY, this.currentPin)
    }

    const savedOpPin = databaseService.getConfig(REMOTE_OPERATOR_PIN_CONFIG_KEY)
    if (savedOpPin && /^\d{6}$/.test(savedOpPin)) {
      this.remoteOperatorPin = savedOpPin
    } else {
      this.remoteOperatorPin = this.generateNumericPin()
      databaseService.setConfig(REMOTE_OPERATOR_PIN_CONFIG_KEY, this.remoteOperatorPin)
    }

    logger.info('RemoteAuthService initialized successfully.')
  }

  private onInvalidateSessionsCallback: (() => void) | null = null

  public setOnInvalidateSessions(cb: () => void): void {
    this.onInvalidateSessionsCallback = cb
  }

  public getPin(): string {
    if (!this.currentPin) {
      this.initialize()
    }
    return this.currentPin
  }

  public getRemoteOperatorPin(): string {
    if (!this.remoteOperatorPin) {
      this.initialize()
    }
    return this.remoteOperatorPin
  }

  public regeneratePin(): string {
    this.currentPin = this.generateNumericPin()
    databaseService.setConfig(REMOTE_PIN_CONFIG_KEY, this.currentPin)
    // Invalidate existing control operator sessions when PIN changes for safety
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.role === 'operator') {
        this.sessions.delete(token)
      }
    }
    this.onInvalidateSessionsCallback?.()
    logger.info('Remote control PIN regenerated. Control operator sessions invalidated.')
    return this.currentPin
  }

  public regenerateRemoteOperatorPin(): string {
    this.remoteOperatorPin = this.generateNumericPin()
    databaseService.setConfig(REMOTE_OPERATOR_PIN_CONFIG_KEY, this.remoteOperatorPin)
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.role === 'remote-operator') {
        this.sessions.delete(token)
      }
    }
    this.onInvalidateSessionsCallback?.()
    logger.info('Remote operator PIN regenerated. Remote-operator sessions invalidated.')
    return this.remoteOperatorPin
  }

  public setPin(pin: string): void {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('El PIN debe contener exactamente 6 dígitos numéricos.')
    }
    this.currentPin = pin
    databaseService.setConfig(REMOTE_PIN_CONFIG_KEY, pin)
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.role === 'operator') {
        this.sessions.delete(token)
      }
    }
    this.onInvalidateSessionsCallback?.()
    logger.info('Remote control PIN updated. Control operator sessions invalidated.')
  }

  public setRemoteOperatorPin(pin: string): void {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('El PIN de operador remoto debe contener exactamente 6 dígitos numéricos.')
    }
    this.remoteOperatorPin = pin
    databaseService.setConfig(REMOTE_OPERATOR_PIN_CONFIG_KEY, pin)
    for (const [token, sess] of this.sessions.entries()) {
      if (sess.role === 'remote-operator') {
        this.sessions.delete(token)
      }
    }
    this.onInvalidateSessionsCallback?.()
    logger.info('Remote operator PIN updated. Remote-operator sessions invalidated.')
  }

  public checkRateLimit(ip: string): { allowed: boolean; remainingLockSeconds?: number } {
    const record = this.rateLimits.get(ip)
    if (!record) return { allowed: true }

    const now = Date.now()
    if (record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000)
      return { allowed: false, remainingLockSeconds: remainingSeconds }
    }

    // Reset if window has passed
    if (now - record.firstAttemptAt > this.ATTEMPT_WINDOW_MS) {
      this.rateLimits.delete(ip)
      return { allowed: true }
    }

    return { allowed: true }
  }

  public recordFailedAttempt(ip: string): { locked: boolean; remainingLockSeconds?: number } {
    const now = Date.now()
    let record = this.rateLimits.get(ip)

    if (!record || now - record.firstAttemptAt > this.ATTEMPT_WINDOW_MS) {
      record = { attempts: 1, firstAttemptAt: now, lockedUntil: 0 }
    } else {
      record.attempts += 1
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      record.lockedUntil = now + this.LOCKOUT_DURATION_MS
      this.rateLimits.set(ip, record)
      logger.warn(`Remote IP [${ip}] temporarily locked out for 5 minutes after ${record.attempts} failed PIN attempts.`)
      return { locked: true, remainingLockSeconds: Math.ceil(this.LOCKOUT_DURATION_MS / 1000) }
    }

    this.rateLimits.set(ip, record)
    return { locked: false }
  }

  public clearRateLimit(ip: string): void {
    this.rateLimits.delete(ip)
  }

  public authenticate(params: {
    pin: string
    ip: string
    deviceName?: string
    role?: 'operator' | 'stage-viewer' | 'camera' | 'remote-operator'
  }): { success: boolean; session?: RemoteClientSession; error?: string; remainingLockSeconds?: number } {
    const { pin, ip, deviceName, role } = params

    // Check rate limit
    const limitCheck = this.checkRateLimit(ip)
    if (!limitCheck.allowed) {
      return {
        success: false,
        error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente por ${limitCheck.remainingLockSeconds} segundos.`,
        remainingLockSeconds: limitCheck.remainingLockSeconds
      }
    }

    // Role resolution
    const targetRole: 'operator' | 'stage-viewer' | 'camera' | 'remote-operator' =
      role === 'remote-operator'
        ? 'remote-operator'
        : role === 'camera'
          ? 'camera'
          : role === 'stage-viewer'
            ? 'stage-viewer'
            : 'operator'

    const expectedPin = targetRole === 'remote-operator' ? this.getRemoteOperatorPin() : this.getPin()

    if (pin.trim() !== expectedPin.trim()) {
      const lockStatus = this.recordFailedAttempt(ip)
      if (lockStatus.locked) {
        return {
          success: false,
          error: `PIN incorrecto. Acceso bloqueado temporalmente por ${lockStatus.remainingLockSeconds} segundos.`,
          remainingLockSeconds: lockStatus.remainingLockSeconds
        }
      }
      return { success: false, error: 'PIN incorrecto. Por favor verifique el código en la pantalla del operador.' }
    }

    // Success: clear rate limits
    this.clearRateLimit(ip)

    // Create session token
    const token = crypto.randomBytes(32).toString('hex')
    const defaultName =
      targetRole === 'remote-operator'
        ? 'Operador Remoto (Tailscale)'
        : targetRole === 'camera'
          ? 'Cámara Móvil'
          : targetRole === 'operator'
            ? 'Control Móvil'
            : 'Monitor de Escenario'

    const session: RemoteClientSession = {
      id: token,
      name: (deviceName || defaultName).trim(),
      role: targetRole,
      ip,
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }

    this.sessions.set(token, session)
    logger.info(`Remote client authenticated [${session.id}] (${session.name}, ${session.role}) from ${ip}`)

    return { success: true, session }
  }

  public createReadOnlyStageSession(ip: string, deviceName?: string): RemoteClientSession {
    const token = crypto.randomBytes(32).toString('hex')
    const session: RemoteClientSession = {
      id: token,
      name: (deviceName || 'Monitor Escenario Tableta').trim(),
      role: 'stage-viewer',
      ip,
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }
    this.sessions.set(token, session)
    return session
  }

  public readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
  public readonly CAMERA_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
  public readonly DEFAULT_REMOTE_OPERATOR_TTL_HOURS = 8

  public verifySession(token: string): RemoteClientSession | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null

    const now = Date.now()
    let ttl = this.SESSION_TTL_MS

    if (session.role === 'camera') {
      ttl = this.CAMERA_SESSION_TTL_MS
    } else if (session.role === 'remote-operator') {
      const hours = parseInt(databaseService.getConfig(REMOTE_OPERATOR_SESSION_HOURS_KEY) || '8', 10) || this.DEFAULT_REMOTE_OPERATOR_TTL_HOURS
      ttl = hours * 60 * 60 * 1000
    }

    // For remote-operator: sliding auto-renewal based on lastActiveAt
    const referenceTime = session.role === 'remote-operator'
      ? new Date(session.lastActiveAt).getTime()
      : new Date(session.connectedAt).getTime()

    if (now - referenceTime > ttl) {
      this.sessions.delete(token)
      logger.info(`Session [${session.id}] (${session.role}) expired due to TTL.`)
      return null
    }

    session.lastActiveAt = new Date().toISOString()
    return session
  }

  public auditLog(session: RemoteClientSession, action: string, details?: any): void {
    const detailStr = details ? ` | ${typeof details === 'object' ? JSON.stringify(details) : details}` : ''
    logger.info(`[REMOTE-OP AUDIT] ${new Date().toISOString()} [${session.ip}] ${session.name} (${session.role}): ${action}${detailStr}`)
  }

  public revokeSession(tokenOrId: string): boolean {
    for (const [token, sess] of this.sessions.entries()) {
      if (token === tokenOrId || sess.id === tokenOrId) {
        this.sessions.delete(token)
        logger.info(`Revoked remote session [${sess.id}] (${sess.name})`)
        return true
      }
    }
    return false
  }

  public getSessions(): RemoteClientSession[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s }))
  }

  public clearAllSessions(): void {
    this.sessions.clear()
  }

  private generateNumericPin(): string {
    const num = Math.floor(100000 + Math.random() * 900000)
    return String(num)
  }
}

export const remoteAuthService = new RemoteAuthService()
