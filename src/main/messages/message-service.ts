import { PresentationMessage } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { stateManager } from '../state-manager'
import { logger } from '../logger'

export class MessageService {
  private activeMessage: PresentationMessage | null = null
  private autoDismissTimer: NodeJS.Timeout | null = null
  private onMessageChangeCallback: ((msg: PresentationMessage | null) => void) | null = null

  public setOnMessageChange(callback: (msg: PresentationMessage | null) => void): void {
    this.onMessageChangeCallback = callback
  }

  public getActiveMessage(): PresentationMessage | null {
    return this.activeMessage
  }

  public sendMessage(params: {
    text: string
    target: 'stage' | 'audience' | 'both'
    durationSeconds?: number
  }): PresentationMessage {
    const text = (params.text || '').trim()
    if (!text) {
      throw new Error('El texto del mensaje no puede estar vacío.')
    }

    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer)
      this.autoDismissTimer = null
    }

    const duration = params.durationSeconds && params.durationSeconds > 0 ? params.durationSeconds : undefined
    const now = new Date()
    const expiresAt = duration ? new Date(now.getTime() + duration * 1000).toISOString() : undefined

    const message: PresentationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text,
      target: params.target || 'stage',
      durationSeconds: duration,
      active: true,
      createdAt: now.toISOString(),
      expiresAt
    }

    this.activeMessage = message
    logger.info(`Message published to [${message.target}]: "${text}" (duration: ${duration || 'manual'}s)`)

    if (duration) {
      this.autoDismissTimer = setTimeout(() => {
        logger.info(`Message [${message.id}] auto-dismissed after ${duration}s`)
        this.clearMessage()
      }, duration * 1000)
    }

    this.notifyChange()
    return message
  }

  public clearMessage(): boolean {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer)
      this.autoDismissTimer = null
    }

    if (this.activeMessage) {
      logger.info(`Active message cleared: "${this.activeMessage.text}"`)
      this.activeMessage = null
      this.notifyChange()
      return true
    }

    return false
  }

  public getMessagePresets(): string[] {
    try {
      const rows = databaseService.query('SELECT text FROM message_presets ORDER BY sort_order ASC;')
      return rows.map((r: any) => String(r.text || '')).filter(Boolean)
    } catch (err) {
      logger.error('Failed to get message presets from database:', err)
      return [
        'Baja el volumen',
        'Falta 1 minuto',
        'Pastores a la sala pastoral',
        'Tiempo de ofrenda y anuncios',
        'Fin del servicio, gracias por acompañarnos'
      ]
    }
  }

  public saveMessagePreset(text: string): string[] {
    const trimmed = (text || '').trim()
    if (!trimmed) return this.getMessagePresets()

    try {
      const id = `preset_${Date.now()}`
      const existing = this.getMessagePresets()
      databaseService.run(
        'INSERT INTO message_presets (id, text, sort_order, created_at) VALUES (?, ?, ?, datetime("now"));',
        [id, trimmed, existing.length]
      )
    } catch (err) {
      logger.error('Failed to save message preset:', err)
    }

    return this.getMessagePresets()
  }

  public deleteMessagePreset(text: string): string[] {
    try {
      databaseService.run('DELETE FROM message_presets WHERE text = ?;', [text])
    } catch (err) {
      logger.error('Failed to delete message preset:', err)
    }

    return this.getMessagePresets()
  }

  private notifyChange(): void {
    try {
      stateManager.setActiveMessage(this.activeMessage)
    } catch {
      // ignore
    }

    if (this.onMessageChangeCallback) {
      try {
        this.onMessageChangeCallback(this.activeMessage)
      } catch (err) {
        logger.error('Error in onMessageChangeCallback:', err)
      }
    }
  }
}

export const messageService = new MessageService()
