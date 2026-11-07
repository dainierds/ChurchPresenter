import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'
import QRCode from 'qrcode'
import { OctoStreamSlot, PhoneCameraDevice } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { ffmpegService } from '../media/ffmpeg-service'
import { windowManager } from '../window-manager'
import { IPC_CHANNELS } from '../../shared/ipc-events'
import { logger } from '../logger'

export const OCTOSTREAM_CONFIG_KEY = 'octostream_slots_config'

export const DEFAULT_OCTOSTREAM_SLOTS: OctoStreamSlot[] = [
  {
    id: 'cam1',
    name: 'Cámara 1 (Principal)',
    mode: 'rtmp',
    rtmpPort: 1935,
    rtmpStreamKey: 'cam1',
    rtspUrl: 'rtsp://192.168.1.100:8554/live',
    enabled: true,
    isStreaming: false
  },
  {
    id: 'cam2',
    name: 'Cámara 2 (Púlpito / Altar)',
    mode: 'rtmp',
    rtmpPort: 1936,
    rtmpStreamKey: 'cam2',
    rtspUrl: 'rtsp://192.168.1.101:8554/live',
    enabled: true,
    isStreaming: false
  },
  {
    id: 'cam3',
    name: 'Cámara 3 (Músicos / Alabanza)',
    mode: 'rtmp',
    rtmpPort: 1937,
    rtmpStreamKey: 'cam3',
    rtspUrl: 'rtsp://192.168.1.102:8554/live',
    enabled: false,
    isStreaming: false
  },
  {
    id: 'cam4',
    name: 'Cámara 4 (Plano General)',
    mode: 'rtmp',
    rtmpPort: 1938,
    rtmpStreamKey: 'cam4',
    rtspUrl: 'rtsp://192.168.1.103:8554/live',
    enabled: false,
    isStreaming: false
  }
]

export class OctoStreamService extends EventEmitter {
  private slots: Map<string, OctoStreamSlot> = new Map()
  private processes: Map<string, ChildProcess> = new Map()
  private restartTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private frameCounters: Map<string, { count: number; bytes: number; lastTime: number }> = new Map()
  private isShuttingDown: boolean = false

  constructor() {
    super()
    this.loadSlotsSync()
  }

  public loadSlotsSync(): OctoStreamSlot[] {
    try {
      const raw = databaseService.getConfig(OCTOSTREAM_CONFIG_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as OctoStreamSlot[]
        this.slots.clear()
        for (const s of parsed) {
          this.slots.set(s.id, { ...s, isStreaming: false })
        }
      } else {
        this.slots.clear()
        for (const s of DEFAULT_OCTOSTREAM_SLOTS) {
          this.slots.set(s.id, { ...s })
        }
      }
    } catch {
      this.slots.clear()
      for (const s of DEFAULT_OCTOSTREAM_SLOTS) {
        this.slots.set(s.id, { ...s })
      }
    }
    return Array.from(this.slots.values())
  }

  public async initialize(): Promise<void> {
    this.loadSlotsSync()
    // Auto-start enabled slots
    for (const slot of this.slots.values()) {
      if (slot.enabled) {
        this.startSlot(slot.id).catch((err) => {
          logger.warn(`Failed to auto-start OctoStream slot ${slot.id}:`, err)
        })
      }
    }
  }

  public getNetworkIps(): { localIp: string; tailscaleIp: string } {
    let tailscaleIp = databaseService.getCameraSettings()?.tailscaleIp || '100.73.59.102'

    const interfaces = os.networkInterfaces()
    const candidates: { ip: string; isPhysical: boolean; isPrivateSubnet: boolean }[] = []

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue
      const lowerName = name.toLowerCase()
      const isVirtual =
        lowerName.includes('tailscale') ||
        lowerName.includes('surfshark') ||
        lowerName.includes('vpn') ||
        lowerName.includes('virtual') ||
        lowerName.includes('vmware') ||
        lowerName.includes('vbox') ||
        lowerName.includes('vethernet') ||
        lowerName.includes('hyper-v') ||
        lowerName.includes('tap') ||
        lowerName.includes('tun') ||
        lowerName.includes('loopback') ||
        lowerName.includes('wsl') ||
        lowerName.includes('docker')

      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) {
          if (a.address.startsWith('100.')) {
            tailscaleIp = a.address
            continue
          }
          // Strictly reject APIPA link-local addresses (169.254.x.x) and loopback
          if (a.address.startsWith('169.254.') || a.address === '127.0.0.1') {
            continue
          }

          const isPrivate =
            a.address.startsWith('10.') ||
            a.address.startsWith('192.168.') ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(a.address)

          candidates.push({
            ip: a.address,
            isPhysical: !isVirtual,
            isPrivateSubnet: isPrivate
          })
        }
      }
    }

    candidates.sort((a, b) => {
      const scoreA = (a.isPhysical ? 2 : 0) + (a.isPrivateSubnet ? 1 : 0)
      const scoreB = (b.isPhysical ? 2 : 0) + (b.isPrivateSubnet ? 1 : 0)
      return scoreB - scoreA
    })

    const localIp = candidates.length > 0 ? candidates[0].ip : '127.0.0.1'
    return { localIp, tailscaleIp }
  }

  public async loadSlots(): Promise<OctoStreamSlot[]> {
    try {
      const raw = databaseService.getConfig(OCTOSTREAM_CONFIG_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as OctoStreamSlot[]
        this.slots.clear()
        for (const s of parsed) {
          this.slots.set(s.id, { ...s, isStreaming: false })
        }
      } else {
        this.slots.clear()
        for (const s of DEFAULT_OCTOSTREAM_SLOTS) {
          this.slots.set(s.id, { ...s })
        }
      }
    } catch (err) {
      logger.error('Error loading OctoStream slots, using defaults:', err)
      this.slots.clear()
      for (const s of DEFAULT_OCTOSTREAM_SLOTS) {
        this.slots.set(s.id, { ...s })
      }
    }
    return this.getSlotsWithUrls()
  }

  public async saveSlot(slotData: Partial<OctoStreamSlot> & { id: string }): Promise<OctoStreamSlot[]> {
    const existing = this.slots.get(slotData.id)
    if (!existing) {
      throw new Error(`Slot ${slotData.id} no encontrado.`)
    }

    const wasRunning = this.processes.has(slotData.id)
    const needsRestart =
      wasRunning &&
      (slotData.mode !== undefined && slotData.mode !== existing.mode ||
        slotData.rtmpPort !== undefined && slotData.rtmpPort !== existing.rtmpPort ||
        slotData.rtspUrl !== undefined && slotData.rtspUrl !== existing.rtspUrl)

    const updated: OctoStreamSlot = {
      ...existing,
      ...slotData,
      isStreaming: existing.isStreaming
    }

    this.slots.set(updated.id, updated)
    const list = Array.from(this.slots.values()).map((s) => ({
      ...s,
      qrDataUrl: undefined,
      rtmpUrl: undefined,
      tailscaleRtmpUrl: undefined
    }))
    databaseService.setConfig(OCTOSTREAM_CONFIG_KEY, JSON.stringify(list))

    if (needsRestart) {
      await this.stopSlot(updated.id)
      if (updated.enabled) {
        await this.startSlot(updated.id)
      }
    } else if (slotData.enabled !== undefined) {
      if (slotData.enabled && !wasRunning) {
        await this.startSlot(updated.id)
      } else if (!slotData.enabled && wasRunning) {
        await this.stopSlot(updated.id)
      }
    }

    return this.getSlotsWithUrls()
  }

  public async getSlotsWithUrls(): Promise<OctoStreamSlot[]> {
    if (this.slots.size === 0) {
      await this.loadSlots()
    }
    const { localIp, tailscaleIp } = this.getNetworkIps()
    const result: OctoStreamSlot[] = []

    let httpPort = 8080
    try {
      const rawRemote = databaseService.getConfig('remote_server_config')
      if (rawRemote) {
        httpPort = JSON.parse(rawRemote).port || 8080
      }
    } catch {
      // ignore
    }

    for (const slot of this.slots.values()) {
      const rtmpServerBase = `rtmp://${localIp}:${slot.rtmpPort}/live`
      const tailscaleServerBase = `rtmp://${tailscaleIp}:${slot.rtmpPort}/live`
      const rtmpUrl = `${rtmpServerBase}/${slot.rtmpStreamKey}`
      const tailscaleRtmpUrl = `${tailscaleServerBase}/${slot.rtmpStreamKey}`
      const setupWebUrl = `http://${localIp}:${httpPort}/setup-cam?id=${slot.id}`

      let qrDataUrl = ''
      try {
        qrDataUrl = await QRCode.toDataURL(setupWebUrl, { width: 260, margin: 2 })
      } catch {
        // ignore
      }

      result.push({
        ...slot,
        rtmpServerBase,
        tailscaleServerBase,
        rtmpUrl,
        tailscaleRtmpUrl,
        setupWebUrl,
        qrDataUrl
      })
    }

    return result
  }

  public async startSlot(slotId: string): Promise<{ success: boolean; error?: string }> {
    const slot = this.slots.get(slotId)
    if (!slot) return { success: false, error: 'Ranura no encontrada.' }

    if (this.processes.has(slotId)) {
      return { success: true }
    }

    const ffmpegStatus = await ffmpegService.detectFfmpeg()
    if (!ffmpegStatus.available || !ffmpegStatus.path) {
      slot.error = 'FFmpeg no encontrado en el sistema.'
      this.emit('slot-status-changed', slot)
      return { success: false, error: slot.error }
    }

    slot.error = undefined
    slot.enabled = true

    let args: string[] = []
    if (slot.mode === 'rtmp') {
      args = [
        '-listen', '1',
        '-timeout', '10000000',
        '-i', `rtmp://0.0.0.0:${slot.rtmpPort}/live/${slot.rtmpStreamKey}`,
        '-vf', 'scale=1280:720',
        '-r', '30',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-q:v', '3',
        '-'
      ]
    } else {
      if (!slot.rtspUrl) {
        slot.error = 'URL de RTSP vacía.'
        return { success: false, error: slot.error }
      }
      args = [
        '-rtsp_transport', 'tcp',
        '-i', slot.rtspUrl,
        '-vf', 'scale=1280:720',
        '-r', '30',
        '-f', 'image2pipe',
        '-vcodec', 'mjpeg',
        '-q:v', '3',
        '-'
      ]
    }

    try {
      logger.info(`Starting OctoStream receiver [${slot.id}] (${slot.mode}): ffmpeg ${args.join(' ')}`)
      const proc = spawn(ffmpegStatus.path, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      this.processes.set(slot.id, proc)

      this.frameCounters.set(slot.id, { count: 0, bytes: 0, lastTime: Date.now() })
      let buffer = Buffer.alloc(0)

      proc.stdout.on('data', (chunk: Buffer) => {
        if (!slot.isStreaming) {
          slot.isStreaming = true
          logger.info(`OctoStream [${slot.id}] stream started!`)
          this.emit('slot-status-changed', slot)
        try {
          windowManager.broadcastToAll(IPC_CHANNELS.CAMERA_DEVICE_UPDATED, this.toPhoneCameraDevices())
        } catch {
          // ignore
        }
          try {
            windowManager.broadcastToAll(IPC_CHANNELS.CAMERA_DEVICE_UPDATED, this.toPhoneCameraDevices())
          } catch {
            // ignore
          }
        }

        const metrics = this.frameCounters.get(slot.id)
        if (metrics) {
          metrics.bytes += chunk.length
        }

        buffer = Buffer.concat([buffer, chunk])
        let hasFrames = true
        while (hasFrames) {
          const start = buffer.indexOf(Buffer.from([0xff, 0xd8]))
          if (start === -1) {
            buffer = Buffer.alloc(0)
            hasFrames = false
            break
          }
          const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2)
          if (end === -1) {
            if (start > 0) buffer = buffer.subarray(start)
            hasFrames = false
            break
          }

          const frame = buffer.subarray(start, end + 2)
          buffer = buffer.subarray(end + 2)

          if (metrics) {
            metrics.count++
            const now = Date.now()
            if (now - metrics.lastTime >= 1000) {
              const sec = (now - metrics.lastTime) / 1000
              slot.actualFps = Math.round(metrics.count / sec)
              slot.bitrateKbps = Math.round((metrics.bytes * 8) / (sec * 1024))
              metrics.count = 0
              metrics.bytes = 0
              metrics.lastTime = now
            }
          }

          const base64 = frame.toString('base64')
          windowManager.broadcastToAll(IPC_CHANNELS.CAMERA_FRAME, {
            cameraId: slot.id,
            frame: base64,
            timestamp: Date.now()
          })
        }
      })

      proc.stderr.on('data', (data) => {
        const text = data.toString('utf8')
        if (text.includes('Connection refused') || text.includes('Server error')) {
          logger.warn(`OctoStream [${slot.id}] warning:`, text.trim().slice(0, 150))
        }
      })

      proc.on('error', (err) => {
        logger.error(`OctoStream [${slot.id}] process error:`, err)
        slot.error = err.message
      })

      proc.on('close', (code) => {
        logger.info(`OctoStream [${slot.id}] process exited with code ${code}`)
        this.processes.delete(slot.id)
        slot.isStreaming = false
        slot.actualFps = 0
        slot.bitrateKbps = 0
        this.emit('slot-status-changed', slot)
        try {
          windowManager.broadcastToAll(IPC_CHANNELS.CAMERA_DEVICE_UPDATED, this.toPhoneCameraDevices())
        } catch {
          // ignore
        }

        // Auto restart listener if slot is enabled and not shutting down
        if (slot.enabled && !this.isShuttingDown) {
          const timeout = setTimeout(() => {
            this.restartTimeouts.delete(slot.id)
            if (slot.enabled && !this.isShuttingDown) {
              this.startSlot(slot.id).catch(() => {})
            }
          }, 1500)
          this.restartTimeouts.set(slot.id, timeout)
        }
      })

      this.emit('slot-status-changed', slot)
      return { success: true }
    } catch (err: any) {
      slot.error = err.message
      slot.isStreaming = false
      this.emit('slot-status-changed', slot)
      return { success: false, error: err.message }
    }
  }

  public async stopSlot(slotId: string): Promise<{ success: boolean; error?: string }> {
    const slot = this.slots.get(slotId)
    if (!slot) return { success: false, error: 'Ranura no encontrada.' }

    slot.enabled = false
    slot.isStreaming = false
    slot.actualFps = 0
    slot.bitrateKbps = 0

    const timeout = this.restartTimeouts.get(slotId)
    if (timeout) {
      clearTimeout(timeout)
      this.restartTimeouts.delete(slotId)
    }

    const proc = this.processes.get(slotId)
    if (proc) {
      try {
        proc.kill('SIGINT')
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL')
          }
        }, 500)
      } catch {
        // ignore
      }
      this.processes.delete(slotId)
    }

    this.emit('slot-status-changed', slot)
    return { success: true }
  }

  public toPhoneCameraDevices(): PhoneCameraDevice[] {
    if (this.slots.size === 0) {
      this.loadSlotsSync()
    }
    const devices: PhoneCameraDevice[] = []
    const { localIp } = this.getNetworkIps()

    for (const slot of this.slots.values()) {
      if (!slot.enabled && !slot.isStreaming) continue

      devices.push({
        id: slot.id,
        name: `${slot.name} (OctoStream)`,
        ip: slot.mode === 'rtsp' && slot.rtspUrl ? (slot.rtspUrl.split('@')[1] || slot.rtspUrl).split(':')[0].replace('//', '') : localIp,
        connectedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        isStreaming: slot.isStreaming,
        isOnline: slot.enabled,
        batteryLevel: null,
        resolution: '1280x720',
        targetFps: 30,
        actualFps: slot.actualFps || (slot.isStreaming ? 30 : 0),
        bitrateKbps: slot.bitrateKbps || (slot.isStreaming ? 2500 : 0),
        packetLossPercent: 0,
        audioMuted: false,
        facingMode: 'environment',
        qualityRating: slot.isStreaming ? 'excelente' : 'sin_senal'
      })
    }

    return devices
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true
    for (const timeout of this.restartTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.restartTimeouts.clear()

    for (const [id, proc] of this.processes.entries()) {
      try {
        proc.kill('SIGINT')
        proc.kill('SIGKILL')
      } catch {
        // ignore
      }
      this.processes.delete(id)
    }
  }
}

export const octoStreamService = new OctoStreamService()
