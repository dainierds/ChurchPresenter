/**
 * OBS Studio WebSocket v5 Integration Service (Phase 9 - Stage A)
 *
 * Implements obs-websocket protocol v5 to control OBS Studio from ChurchPresenter:
 * - List and switch scenes
 * - Start/stop streaming and recording
 * - Telemetry & status monitoring
 * - Encrypted password storage via Electron safeStorage
 */

import WebSocket from 'ws'
import crypto from 'crypto'
import { safeStorageService } from '../security/safe-storage-service'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export interface ObsConfig {
  host: string
  port: number
  password?: string
  passwordEncrypted?: string
  autoConnect: boolean
}

export interface ObsStatus {
  connected: boolean
  streaming: boolean
  recording: boolean
  currentScene: string
  scenes: string[]
  streamTimecode?: string
  recordTimecode?: string
  fps?: number
  kbitsPerSec?: number
  error?: string
}

export class ObsWebSocketService {
  private ws: WebSocket | null = null
  private config: ObsConfig = {
    host: 'localhost',
    port: 4455,
    autoConnect: false
  }

  private status: ObsStatus = {
    connected: false,
    streaming: false,
    recording: false,
    currentScene: '',
    scenes: []
  }

  private pendingRequests = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }
  >()
  private requestIdCounter = 1
  private onStatusChangedCallback?: (status: ObsStatus) => void

  constructor() {
    this.loadConfig()
  }

  public setOnStatusChanged(cb: (status: ObsStatus) => void): void {
    this.onStatusChangedCallback = cb
  }

  public getConfig(): ObsConfig {
    return {
      ...this.config,
      password: this.config.passwordEncrypted
        ? safeStorageService.decrypt(this.config.passwordEncrypted)
        : ''
    }
  }

  public saveConfig(newConfig: Partial<ObsConfig>): void {
    const existing = this.getConfig()
    const merged: ObsConfig = {
      ...existing,
      ...newConfig
    }

    if (newConfig.password !== undefined) {
      merged.passwordEncrypted = newConfig.password
        ? safeStorageService.encrypt(newConfig.password)
        : ''
    }

    this.config = merged
    databaseService.setConfig('obs_host', merged.host)
    databaseService.setConfig('obs_port', String(merged.port))
    databaseService.setConfig('obs_password_enc', merged.passwordEncrypted || '')
    databaseService.setConfig('obs_auto_connect', merged.autoConnect ? '1' : '0')
  }

  private loadConfig(): void {
    try {
      const host = databaseService.getConfig('obs_host') || 'localhost'
      const portStr = databaseService.getConfig('obs_port') || '4455'
      const passwordEnc = databaseService.getConfig('obs_password_enc') || ''
      const autoConnect = databaseService.getConfig('obs_auto_connect') === '1'

      this.config = {
        host,
        port: parseInt(portStr, 10) || 4455,
        passwordEncrypted: passwordEnc,
        autoConnect
      }
    } catch {
      // ignore
    }
  }

  public getStatus(): ObsStatus {
    return { ...this.status }
  }

  public async connect(overrideOptions?: {
    host?: string
    port?: number
    password?: string
  }): Promise<{ success: boolean; error?: string }> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return { success: true }
    }

    const host = overrideOptions?.host || this.config.host || 'localhost'
    const port = overrideOptions?.port || this.config.port || 4455
    const password =
      overrideOptions?.password !== undefined
        ? overrideOptions.password
        : this.config.passwordEncrypted
          ? safeStorageService.decrypt(this.config.passwordEncrypted)
          : ''

    const url = `ws://${host}:${port}`

    return new Promise((resolve) => {
      let resolved = false
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          this.disconnect()
          this.status.connected = false
          this.status.error = 'Tiempo de espera agotado al conectar con OBS (verifique que obs-websocket esté activo en OBS Studio).'
          this.notifyStatus()
          resolve({ success: false, error: this.status.error })
        }
      }, 6000)

      try {
        this.ws = new WebSocket(url)

        this.ws.on('open', () => {
          logger.info(`[OBS] WebSocket connection opened to ${url}`)
        })

        this.ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString())
            this.handleObsMessage(msg, password, () => {
              if (!resolved) {
                resolved = true
                clearTimeout(timeout)
                this.status.connected = true
                this.status.error = undefined
                this.notifyStatus()
                resolve({ success: true })
              }
            })
          } catch (err: any) {
            logger.warn('[OBS] Error parsing message from OBS:', err)
          }
        })

        this.ws.on('error', (err: any) => {
          logger.warn(`[OBS] Connection error to ${url}:`, err.message)
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            this.status.connected = false
            this.status.error = `No se pudo conectar a OBS en ${host}:${port}. Verifique que OBS Studio esté abierto y obs-websocket activado.`
            this.notifyStatus()
            resolve({ success: false, error: this.status.error })
          }
        })

        this.ws.on('close', (code, reason) => {
          logger.info(`[OBS] WebSocket closed: code=${code}, reason=${reason}`)
          this.handleDisconnect()
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve({ success: false, error: 'Conexión con OBS cerrada inesperadamente.' })
          }
        })
      } catch (err: any) {
        clearTimeout(timeout)
        this.status.connected = false
        this.status.error = err.message
        this.notifyStatus()
        resolve({ success: false, error: err.message })
      }
    })
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ws already closed
      }
      this.ws = null
    }
    this.handleDisconnect()
  }

  private handleDisconnect(): void {
    this.status.connected = false
    this.status.streaming = false
    this.status.recording = false
    for (const [, req] of this.pendingRequests) {
      clearTimeout(req.timeout)
      req.reject(new Error('Conexión con OBS cerrada.'))
    }
    this.pendingRequests.clear()
    this.notifyStatus()
  }

  private notifyStatus(): void {
    if (this.onStatusChangedCallback) {
      this.onStatusChangedCallback(this.getStatus())
    }
  }

  private handleObsMessage(msg: any, password: string, onIdentified: () => void): void {
    const op = msg.op
    const d = msg.d

    // op: 0 = Hello
    if (op === 0) {
      const identifyPayload: any = {
        rpcVersion: 1
      }

      // If OBS requires authentication
      if (d.authentication) {
        const { challenge, salt } = d.authentication
        const secretHash = crypto
          .createHash('sha256')
          .update(password + salt)
          .digest('base64')
        const authResponse = crypto
          .createHash('sha256')
          .update(secretHash + challenge)
          .digest('base64')

        identifyPayload.authentication = authResponse
      }

      this.sendOp(1, identifyPayload)
      return
    }

    // op: 2 = Identified
    if (op === 2) {
      onIdentified()
      this.refreshObsState()
      return
    }

    // op: 7 = RequestResponse
    if (op === 7) {
      const reqId = d.requestId
      const pending = this.pendingRequests.get(reqId)
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(reqId)
        if (d.requestStatus?.result) {
          pending.resolve(d.responseData)
        } else {
          pending.reject(new Error(d.requestStatus?.comment || 'Error en solicitud de OBS'))
        }
      }
      return
    }

    // op: 5 = Event
    if (op === 5) {
      const eventType = d.eventType
      const eventData = d.eventData || {}

      if (eventType === 'CurrentProgramSceneChanged') {
        this.status.currentScene = eventData.sceneName || ''
        this.notifyStatus()
      } else if (eventType === 'SceneListChanged') {
        this.refreshScenes()
      } else if (eventType === 'StreamStateChanged') {
        this.status.streaming = Boolean(eventData.outputActive)
        this.notifyStatus()
      } else if (eventType === 'RecordStateChanged') {
        this.status.recording = Boolean(eventData.outputActive)
        this.notifyStatus()
      }
    }
  }

  private sendOp(op: number, d: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d }))
    }
  }

  private callRequest<T = any>(requestType: string, requestData?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('OBS no está conectado.'))
      }

      const requestId = String(this.requestIdCounter++)
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Timeout esperando respuesta de OBS (${requestType})`))
      }, 5000)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      this.sendOp(6, {
        requestType,
        requestId,
        requestData
      })
    })
  }

  public async refreshObsState(): Promise<void> {
    try {
      await this.refreshScenes()
      const streamRes = await this.callRequest<any>('GetStreamStatus').catch(() => null)
      if (streamRes) {
        this.status.streaming = Boolean(streamRes.outputActive)
        this.status.streamTimecode = streamRes.outputTimecode
      }

      const recRes = await this.callRequest<any>('GetRecordStatus').catch(() => null)
      if (recRes) {
        this.status.recording = Boolean(recRes.outputActive)
        this.status.recordTimecode = recRes.outputTimecode
      }
      this.notifyStatus()
    } catch {
      // ignore status refresh errors
    }
  }

  public async refreshScenes(): Promise<string[]> {
    try {
      const res = await this.callRequest<any>('GetSceneList')
      if (res) {
        this.status.currentScene = res.currentProgramSceneName || ''
        const scenesList = (res.scenes || []).map((s: any) => s.sceneName || s)
        this.status.scenes = scenesList
        this.notifyStatus()
        return scenesList
      }
    } catch {
      // ignore scene fetch errors
    }
    return this.status.scenes
  }

  public async getScenes(): Promise<string[]> {
    if (!this.status.connected) return []
    return this.refreshScenes()
  }

  public async setCurrentProgramScene(sceneName: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.callRequest('SetCurrentProgramScene', { sceneName })
      this.status.currentScene = sceneName
      this.notifyStatus()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public async startStreaming(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.callRequest('StartStream')
      this.status.streaming = true
      this.notifyStatus()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public async stopStreaming(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.callRequest('StopStream')
      this.status.streaming = false
      this.notifyStatus()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public async startRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.callRequest('StartRecord')
      this.status.recording = true
      this.notifyStatus()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }

  public async stopRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.callRequest('StopRecord')
      this.status.recording = false
      this.notifyStatus()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

export const obsWebSocketService = new ObsWebSocketService()
