import fs from 'fs'
import path from 'path'
import os from 'os'
import { EventEmitter } from 'events'
import { app } from 'electron'
import { logger } from '../logger'
import { RehearsalSummary } from '../../shared/types'

export class RehearsalService extends EventEmitter {
  private active: boolean = false
  private sessionStartedAt: number = 0
  private logFilePath: string = ''
  private slidesCount: number = 0
  private mediaPlaysCount: number = 0
  private incidents: Array<{ timestamp: number; message: string }> = []
  private lastSummary: RehearsalSummary | null = null

  public isRehearsalActive(): boolean {
    return this.active
  }

  public getStatus(): { active: boolean; sessionStartedAt?: number; incidentsCount: number } {
    return {
      active: this.active,
      sessionStartedAt: this.active ? this.sessionStartedAt : undefined,
      incidentsCount: this.incidents.length
    }
  }

  public setRehearsalMode(enabled: boolean): boolean {
    if (this.active === enabled) return this.active

    this.active = enabled

    if (enabled) {
      this.sessionStartedAt = Date.now()
      this.slidesCount = 0
      this.mediaPlaysCount = 0
      this.incidents = []

      const userData =
        app && typeof app.getPath === 'function'
          ? app.getPath('userData')
          : path.join(os.tmpdir(), 'cp-test-data')
      const logsDir = path.join(userData, 'logs')
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-')
      this.logFilePath = path.join(logsDir, `rehearsal-${timestampStr}.log`)

      this.logEvent(`=== INICIO DE MODO ENSAYO [${new Date().toISOString()}] ===`)
      logger.info(`Rehearsal mode started. Dedicated log: ${this.logFilePath}`)
    } else {
      this.logEvent(`=== FIN DE MODO ENSAYO [${new Date().toISOString()}] ===`)
      const endedAt = Date.now()
      const durationSeconds = Math.round((endedAt - this.sessionStartedAt) / 1000)

      this.lastSummary = {
        startedAt: this.sessionStartedAt,
        endedAt,
        durationSeconds,
        slidesCount: this.slidesCount,
        mediaPlaysCount: this.mediaPlaysCount,
        incidentsCount: this.incidents.length,
        incidents: [...this.incidents],
        logFilePath: this.logFilePath
      }

      this.logEvent(
        `Resumen: Duración ${durationSeconds}s, Diapositivas: ${this.slidesCount}, Medios: ${this.mediaPlaysCount}, Incidentes: ${this.incidents.length}`
      )
      logger.info(`Rehearsal mode ended. Summary generated.`)
    }

    this.emit('mode-changed', this.active)
    return this.active
  }

  public recordSlideChange(title?: string): void {
    if (!this.active) return
    this.slidesCount++
    this.logEvent(`[Diapositiva #${this.slidesCount}] Proyectada: "${title || 'Sin título'}"`)
  }

  public recordMediaPlay(url?: string): void {
    if (!this.active) return
    this.mediaPlaysCount++
    this.logEvent(`[Reproducción de Medio] Iniciado: "${url || 'Desconocido'}"`)
  }

  public recordIncident(message: string): void {
    if (!this.active) return
    const timestamp = Date.now()
    this.incidents.push({ timestamp, message })
    this.logEvent(`[INCIDENTE] ${message}`)
  }

  public getSummary(): RehearsalSummary | null {
    return this.lastSummary
  }

  private logEvent(text: string): void {
    if (!this.logFilePath) return
    try {
      const entry = `[${new Date().toISOString()}] ${text}\n`
      fs.appendFileSync(this.logFilePath, entry, 'utf-8')
    } catch (err) {
      logger.error('Error writing to rehearsal log file:', err)
    }
  }
}

export const rehearsalService = new RehearsalService()
