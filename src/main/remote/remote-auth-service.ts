import crypto from 'crypto'
import { RemoteClientSession } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export const REMOTE_CONFIG_KEY = 'remote_server_config'
export const REMOTE_PIN_CONFIG_KEY = 'remote_server_pin'

export interface RateLimitRecord {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number
}

export class RemoteAuthService {
  private sessions: Map<string, RemoteClientSession> = new Map() // token -> session
  private rateLimits: Map<string, RateLimitRecord> = new Map() // ip -> record
  private currentPin: string = ''

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

  public regeneratePin(): string {
    this.currentPin = this.generateNumericPin()
    databaseService.setConfig(REMOTE_PIN_CONFIG_KEY, this.currentPin)
    // Invalidate existing operator sessions when PIN changes for safety
    this.sessions.clear()
    this.onInvalidateSessionsCallback?.()
    logger.info('Remote control PIN regenerated. All active sessions invalidated.')
    return this.currentPin
  }

  public setPin(pin: string): void {
    if (!/^\d{6}$/.test(pin)) {
      throw new Error('El PIN debe contener exactamente 6 dígitos numéricos.')
    }
    this.currentPin = pin
    databaseService.setConfig(REMOTE_PIN_CONFIG_KEY, pin)
    this.sessions.clear()
    this.onInvalidateSessionsCallback?.()
    logger.info('Remote control PIN updated. All active sessions invalidated.')
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
    role?: 'operator' | 'stage-viewer'
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

    // Stage viewer can be allowed without PIN if config permits or with proper PIN
    const targetRole = role === 'stage-viewer' ? 'stage-viewer' : 'operator'

    if (pin.trim() !== this.currentPin) {
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
    const session: RemoteClientSession = {
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: (deviceName || (targetRole === 'operator' ? 'Control Móvil' : 'Monitor de Escenario')).trim(),
      role: targetRole,
      ip,
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }

    this.sessions.set(token, session)
    logger.info(`Remote client authenticated [${session.id}] (${session.name}, ${session.role}) from ${ip}`)

    return { success: true, session: { ...session, id: token } }
  }

  public createReadOnlyStageSession(ip: string, deviceName?: string): RemoteClientSession {
    const token = crypto.randomBytes(32).toString('hex')
    const session: RemoteClientSession = {
      id: `stage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: (deviceName || 'Monitor Escenario Tableta').trim(),
      role: 'stage-viewer',
      ip,
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString()
    }
    this.sessions.set(token, session)
    return { ...session, id: token }
  }

  public readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

  public verifySession(token: string): RemoteClientSession | null {
    if (!token) return null
    const session = this.sessions.get(token)
    if (!session) return null

    // Check expiration
    const connectedTime = new Date(session.connectedAt).getTime()
    if (Date.now() - connectedTime > this.SESSION_TTL_MS) {
      this.sessions.delete(token)
      logger.info(`Session [${session.id}] expired due to TTL.`)
      return null
    }

    session.lastActiveAt = new Date().toISOString()
    return session
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
