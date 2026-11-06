import { EventEmitter } from 'events'
import crypto from 'crypto'
import os from 'os'
import { WebSocket } from 'ws'
import {
  PhoneCameraDevice,
  CameraSignalMessage,
  CameraSettingsConfig,
  CameraQrInfo
} from '../../shared/types'
import { databaseService } from '../db/database-service'
import { acmeService } from './acme-service'
import { windowManager } from '../window-manager'
import { octoStreamService } from './octostream-service'
import { IPC_CHANNELS } from '../../shared/ipc-events'
import { logger } from '../logger'
import QRCode from 'qrcode'

export interface CameraSessionRecord {
  token: string
  device: PhoneCameraDevice
  ws: WebSocket | null
  expiresAt: number
}

export class CameraHubService extends EventEmitter {
  private sessions: Map<string, CameraSessionRecord> = new Map() // token -> record
  private deviceIdToToken: Map<string, string> = new Map() // deviceId -> token

  public initialize(): void {
    acmeService.initialize()
    octoStreamService.initialize()
    octoStreamService.on('slot-status-changed', () => {
      this.notifyDevicesChanged()
    })
    this.cleanExpiredSessions()
  }

  public getSettings(): CameraSettingsConfig {
    return databaseService.getCameraSettings()
  }

  public async saveSettings(
    settings: Partial<CameraSettingsConfig> & { cloudflareToken?: string }
  ): Promise<CameraSettingsConfig> {
    const updated = databaseService.saveCameraSettings(settings)
    const certStatus = await acmeService.getCertificateStatus()
    return {
      ...updated,
      certStatus
    }
  }

  public getConnectedDevices(): PhoneCameraDevice[] {
    const devices: PhoneCameraDevice[] = octoStreamService.toPhoneCameraDevices()
    for (const record of this.sessions.values()) {
      if (!devices.some((d) => d.id === record.device.id)) {
        devices.push({ ...record.device })
      }
    }
    return devices
  }

  public authenticateCamera(pin: string, ip: string, deviceName?: string): {
    success: boolean
    token?: string
    error?: string
  } {
    const expectedPin = databaseService.getConfig('remote_server_pin') || '123456'
    if (pin.trim() !== expectedPin.trim()) {
      return { success: false, error: 'PIN incorrecto. Verifique el código en la pantalla del operador.' }
    }

    const settings = databaseService.getCameraSettings()
    const activeStreams = Array.from(this.sessions.values()).filter((s) => s.device.isStreaming).length
    if (activeStreams >= settings.maxCameras) {
      return {
        success: false,
        error: `Límite máximo de cámaras simultáneas alcanzado (${settings.maxCameras}). Desconecte una cámara para continuar.`
      }
    }

    const token = crypto.randomBytes(32).toString('hex')
    const deviceId = `cam_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const expiryDays = settings.tokenExpiryDays || 7
    const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000

    const device: PhoneCameraDevice = {
      id: deviceId,
      name: (deviceName || `Cámara ${this.sessions.size + 1}`).trim(),
      ip,
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      isStreaming: false,
      isOnline: true,
      batteryLevel: null,
      resolution: '1280x720',
      targetFps: 30,
      actualFps: 0,
      bitrateKbps: 0,
      packetLossPercent: 0,
      audioMuted: true,
      facingMode: 'environment',
      qualityRating: 'buena'
    }

    const record: CameraSessionRecord = {
      token,
      device,
      ws: null,
      expiresAt
    }

    this.sessions.set(token, record)
    this.deviceIdToToken.set(deviceId, token)

    // Also persist known device in DB
    const known = databaseService.getKnownPhoneCameras()
    const existingIdx = known.findIndex((k) => k.id === deviceId || (k.name === device.name && k.ip === device.ip))
    if (existingIdx >= 0) {
      known[existingIdx] = { ...known[existingIdx], ...device }
    } else {
      known.push({ ...device })
    }
    databaseService.saveKnownPhoneCameras(known)

    logger.info(`Camera authenticated: ${device.name} [${deviceId}] from ${ip}`)
    return { success: true, token }
  }

  public verifyCameraToken(token: string): CameraSessionRecord | null {
    if (!token) return null
    const record = this.sessions.get(token)
    if (!record) return null

    if (Date.now() > record.expiresAt) {
      this.sessions.delete(token)
      this.deviceIdToToken.delete(record.device.id)
      logger.info(`Camera token expired for ${record.device.name}`)
      return null
    }

    record.device.lastSeenAt = new Date().toISOString()
    return record
  }

  public registerSocket(token: string, ws: WebSocket): boolean {
    const record = this.verifyCameraToken(token)
    if (!record) return false

    // Check max simultaneous camera limit
    const settings = databaseService.getCameraSettings()
    const activeStreams = Array.from(this.sessions.values()).filter(
      (s) => s.ws && s.ws.readyState === WebSocket.OPEN && s.token !== token
    ).length

    if (activeStreams >= settings.maxCameras) {
      ws.close(4003, `Límite de cámaras simultáneas alcanzado (máximo ${settings.maxCameras})`)
      return false
    }

    record.ws = ws
    record.device.isOnline = true
    this.notifyDevicesChanged()
    return true
  }

  public unregisterSocket(token: string): void {
    const record = this.sessions.get(token)
    if (record) {
      record.ws = null
      record.device.isOnline = false
      record.device.isStreaming = false
      record.device.qualityRating = 'sin_senal'
      this.notifyDevicesChanged()
      this.emit('camera-disconnected', record.device)

      // Notify renderer window to activate backup background
      this.broadcastToRenderer(IPC_CHANNELS.CAMERA_DEVICE_UPDATED, this.getConnectedDevices())
    }
  }

  public revokeDevice(deviceId: string): boolean {
    const token = this.deviceIdToToken.get(deviceId)
    if (token) {
      const record = this.sessions.get(token)
      if (record && record.ws) {
        try {
          record.ws.close(4001, 'Cámara revocada por el operador')
        } catch {
          // ignore
        }
      }
      this.sessions.delete(token)
      this.deviceIdToToken.delete(deviceId)
    }

    const known = databaseService.getKnownPhoneCameras().filter((k) => k.id !== deviceId)
    databaseService.saveKnownPhoneCameras(known)

    this.notifyDevicesChanged()
    return true
  }

  public toggleAudio(deviceId: string, muted: boolean): boolean {
    const token = this.deviceIdToToken.get(deviceId)
    if (!token) return false
    const record = this.sessions.get(token)
    if (!record) return false

    record.device.audioMuted = muted
    if (record.ws && record.ws.readyState === WebSocket.OPEN) {
      record.ws.send(
        JSON.stringify({
          type: 'control',
          control: { audioMuted: muted }
        })
      )
    }
    this.notifyDevicesChanged()
    return true
  }

  public handleCameraMessage(token: string, rawText: string): void {
    const record = this.sessions.get(token)
    if (!record) return

    try {
      const msg = JSON.parse(rawText)
      record.device.lastSeenAt = new Date().toISOString()

      if (msg.type === 'camera-join') {
        if (msg.name) record.device.name = msg.name.trim()
        if (msg.facingMode) record.device.facingMode = msg.facingMode
        this.notifyDevicesChanged()
      } else if (msg.type === 'telemetry' && msg.telemetry) {
        const t = msg.telemetry
        if (typeof t.batteryLevel === 'number') record.device.batteryLevel = t.batteryLevel
        if (typeof t.isCharging === 'boolean') record.device.isCharging = t.isCharging
        if (typeof t.actualFps === 'number') record.device.actualFps = t.actualFps
        if (typeof t.bitrateKbps === 'number') record.device.bitrateKbps = t.bitrateKbps
        if (typeof t.packetLossPercent === 'number') record.device.packetLossPercent = t.packetLossPercent
        if (typeof t.resolution === 'string') record.device.resolution = t.resolution

        // Compute quality rating
        if (record.device.actualFps >= 25 && record.device.bitrateKbps > 1500) {
          record.device.qualityRating = 'excelente'
        } else if (record.device.actualFps >= 18 && record.device.bitrateKbps > 800) {
          record.device.qualityRating = 'buena'
        } else if (record.device.actualFps > 0) {
          record.device.qualityRating = 'degradada'
        } else {
          record.device.qualityRating = 'sin_senal'
        }

        this.notifyDevicesChanged()
      } else if (msg.type === 'offer') {
        record.device.isStreaming = true
        this.notifyDevicesChanged()

        // Resolve mDNS in SDP if present
        const resolvedSdp = this.resolveMdnsInSdp(msg.sdp, record.device.ip)

        // Forward offer to studio renderer
        const signal: CameraSignalMessage = {
          type: 'offer',
          cameraId: record.device.id,
          sdp: resolvedSdp,
          name: record.device.name,
          facingMode: record.device.facingMode
        }
        this.emit('signal-to-renderer', signal)
        this.broadcastToRenderer(IPC_CHANNELS.CAMERA_SIGNAL_RECEIVED, signal)
      } else if (msg.type === 'candidate') {
        const resolvedCandidate = this.resolveMdnsInCandidate(msg.candidate, record.device.ip)
        const signal: CameraSignalMessage = {
          type: 'candidate',
          cameraId: record.device.id,
          candidate: resolvedCandidate
        }
        this.emit('signal-to-renderer', signal)
        this.broadcastToRenderer(IPC_CHANNELS.CAMERA_SIGNAL_RECEIVED, signal)
      } else if (msg.type === 'name-change' && msg.name) {
        record.device.name = msg.name.trim()
        this.notifyDevicesChanged()
      }
    } catch (err) {
      logger.warn('Failed to parse camera message:', err)
    }
  }

  public sendSignalToCamera(cameraId: string, signal: CameraSignalMessage): boolean {
    const token = this.deviceIdToToken.get(cameraId)
    if (!token) return false
    const record = this.sessions.get(token)
    if (!record || !record.ws || record.ws.readyState !== WebSocket.OPEN) return false

    try {
      record.ws.send(JSON.stringify(signal))
      return true
    } catch (err) {
      logger.error('Failed to send signal to camera socket:', err)
      return false
    }
  }

  // --- mDNS Resolution for WebRTC Candidates ---
  // Replaces .local mDNS hostnames with real IP to prevent LAN / Wi-Fi candidate drops
  private resolveMdnsInCandidate(candidate: any, clientIp: string): any {
    if (!candidate || typeof candidate.candidate !== 'string') return candidate
    const candStr = candidate.candidate
    if (candStr.includes('.local')) {
      const realIp = clientIp || this.getPrimaryLocalIp()
      const replaced = candStr.replace(/([a-zA-Z0-9-]+\.local)/g, realIp)
      return { ...candidate, candidate: replaced }
    }
    return candidate
  }

  private resolveMdnsInSdp(sdp: any, clientIp: string): any {
    if (!sdp || typeof sdp.sdp !== 'string') return sdp
    if (sdp.sdp.includes('.local')) {
      const realIp = clientIp || this.getPrimaryLocalIp()
      const replaced = sdp.sdp.replace(/([a-zA-Z0-9-]+\.local)/g, realIp)
      return { ...sdp, sdp: replaced }
    }
    return sdp
  }

  public getPrimaryLocalIp(): string {
    const ifaces = os.networkInterfaces()
    for (const addrs of Object.values(ifaces)) {
      if (!addrs) continue
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal && addr.address !== '127.0.0.1') {
          return addr.address
        }
      }
    }
    return '127.0.0.1'
  }

  public async getCameraQrInfo(): Promise<CameraQrInfo> {
    const settings = databaseService.getCameraSettings()
    const localIp = this.getPrimaryLocalIp()
    const tailscaleIp = settings.tailscaleIp || '100.73.59.102'
    const domain = settings.domain.trim()
    const port = settings.httpsPort || 8443

    const host = domain || tailscaleIp || localIp
    const url = `https://${host}:${port}/cam`

    let qrDataUrl = ''
    try {
      qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2 })
    } catch (err) {
      logger.warn('Failed to generate camera QR:', err)
    }

    const ipChanged = Boolean(settings.lastKnownLocalIp && settings.lastKnownLocalIp !== localIp)
    if (settings.lastKnownLocalIp !== localIp) {
      databaseService.saveCameraSettings({ lastKnownLocalIp: localIp })
    }

    return {
      url,
      qrDataUrl,
      localIp,
      tailscaleIp,
      domain,
      ipChanged
    }
  }

  private notifyDevicesChanged(): void {
    const devices = this.getConnectedDevices()
    this.emit('devices-changed', devices)
    this.broadcastToRenderer(IPC_CHANNELS.CAMERA_DEVICE_UPDATED, devices)
  }

  private broadcastToRenderer(channel: string, payload: any): void {
    try {
      windowManager.broadcastToAll(channel, payload)
    } catch {
      // ignore
    }
  }

  private cleanExpiredSessions(): void {
    const now = Date.now()
    for (const [token, rec] of this.sessions.entries()) {
      if (now > rec.expiresAt) {
        if (rec.ws) {
          try {
            rec.ws.close(4001, 'Sesión de cámara expirada')
          } catch {
            // ignore
          }
        }
        this.sessions.delete(token)
        this.deviceIdToToken.delete(rec.device.id)
      }
    }
  }
}

export const cameraHubService = new CameraHubService()
