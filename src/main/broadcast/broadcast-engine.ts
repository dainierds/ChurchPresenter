/**
 * Broadcast Engine (Phase 9 - Stage D & E)
 *
 * Coordinates live RTMP/RTMPS streaming and local disk recording via FFmpeg.
 * Hardware accelerated encoding with NVIDIA NVENC (with CPU x264 fallback).
 * Complete isolation: broadcast failures never impact church display outputs.
 */

import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { ffmpegService } from '../media/ffmpeg-service'
import { databaseService } from '../db/database-service'
import { safeStorageService } from '../security/safe-storage-service'
import { BroadcastSettings, BroadcastStatus } from '../../shared/types'
import { logger } from '../logger'

export interface BroadcastFfmpegArgOptions {
  resolution: string
  fps: number
  videoBitrate: string
  minBitrate?: string
  maxBitrate: string
  bufSize: string
  audioBitrate: string
  useNvenc: boolean
  rtmpDestination?: string
  localRecordDestination?: string
  recordingFormat?: string
  audioDevice?: string
  audioFilter?: string
}

export function buildBroadcastFfmpegArgs(options: BroadcastFfmpegArgOptions): string[] {
  const args: string[] = [
    '-hide_banner',
    '-loglevel',
    'info',
    // Input 0: Raw RGBA video from stdin
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    options.resolution,
    '-r',
    String(options.fps),
    '-i',
    'pipe:0'
  ]

  // Input 1: Audio track
  if (options.audioDevice) {
    args.push('-f', 'dshow', '-i', `audio=${options.audioDevice}`)
  } else {
    args.push('-re', '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000')
  }

  // Stream mapping: video from input 0, audio from input 1
  args.push('-map', '0:v:0', '-map', '1:a:0')

  // Video Codec flags
  if (options.useNvenc) {
    args.push(
      '-c:v',
      'h264_nvenc',
      '-preset',
      'p4',
      '-tune',
      'll',
      '-rc',
      'cbr',
      '-b:v',
      options.videoBitrate,
      '-minrate',
      options.minBitrate || '1500k',
      '-maxrate',
      options.maxBitrate,
      '-bufsize',
      options.bufSize,
      '-r',
      String(options.fps),
      '-g',
      String(options.fps * 2),
      '-pix_fmt',
      'yuv420p'
    )
  } else {
    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-b:v',
      options.videoBitrate,
      '-minrate',
      options.minBitrate || '1500k',
      '-maxrate',
      options.maxBitrate,
      '-bufsize',
      options.bufSize,
      '-r',
      String(options.fps),
      '-g',
      String(options.fps * 2),
      '-pix_fmt',
      'yuv420p'
    )
  }

  // Audio filter if specified
  if (options.audioFilter) {
    args.push('-af', options.audioFilter)
  }

  // Audio Codec flags
  args.push('-c:a', 'aac', '-b:a', options.audioBitrate, '-ar', '48000', '-ac', '2')

  // Outputs
  if (options.rtmpDestination) {
    args.push('-f', 'flv', options.rtmpDestination)
  }

  if (options.localRecordDestination) {
    const isMkv = options.recordingFormat === 'mkv'
    if (isMkv) {
      args.push('-f', 'matroska', options.localRecordDestination)
    } else {
      args.push(
        '-movflags',
        '+frag_keyframe+empty_moov+default_base_moof',
        '-f',
        'mp4',
        options.localRecordDestination
      )
    }
  }

  return args
}

export class BroadcastEngine extends EventEmitter {
  private ffmpegProc: ChildProcess | null = null
  private status: BroadcastStatus = {
    isStreaming: false,
    isRecording: false,
    durationSeconds: 0,
    formattedTime: '00:00:00',
    bitrateKbps: 0,
    fps: 0,
    droppedFrames: 0,
    totalFrames: 0,
    connectionState: 'disconnected',
    activePreset: '1080p30',
    encoderUsed: 'none'
  }

  private timerInterval: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimer: NodeJS.Timeout | null = null
  private targetRtmpUrl = ''
  private targetRecordingPath = ''
  private recentStderr: string[] = []
  private targetBitrateKbps = 3500
  private lowBitrateSeconds = 0

  constructor() {
    super()
  }

  public getStatus(): BroadcastStatus {
    return { ...this.status }
  }

  private notifyStatus(): void {
    this.emit('status-changed', this.getStatus())
  }

  public updateDiskFree(): void {
    try {
      const dir = this.targetRecordingPath
        ? path.dirname(this.targetRecordingPath)
        : app.getPath('userData')
      if (fs.existsSync(dir)) {
        const stats = fs.statfsSync(dir)
        const freeGb = (stats.bsize * stats.bavail) / (1024 * 1024 * 1024)
        this.status.diskFreeFormatted = `${freeGb.toFixed(1)} GB Libres`
      }
    } catch {
      this.status.diskFreeFormatted = undefined
    }
  }

  public async listDirectShowAudioDevices(ffmpegPath?: string): Promise<string[]> {
    if (process.platform !== 'win32') return []
    const bin = ffmpegPath || (await ffmpegService.detectFfmpeg()).path
    if (!bin) return []

    return new Promise((resolve) => {
      const proc = spawn(bin, ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
        windowsHide: true
      })
      let stderr = ''
      proc.stderr?.on('data', (d) => {
        stderr += d.toString()
      })
      proc.on('close', () => {
        const devices: string[] = []
        const regex = /"([^"]+)"\s+\(audio\)/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(stderr)) !== null) {
          if (match[1] && !devices.includes(match[1])) {
            devices.push(match[1])
          }
        }
        resolve(devices)
      })
      proc.on('error', () => {
        resolve([])
      })
    })
  }

  public resolveDirectShowAudioDevice(requestedNameOrId: string, dshowDevices: string[]): string | undefined {
    if (dshowDevices.length === 0) return undefined
    if (!requestedNameOrId) return dshowDevices[0]

    const cleanReq = requestedNameOrId.trim().toLowerCase()

    // 1. Exact match
    const exact = dshowDevices.find((d) => d.toLowerCase() === cleanReq)
    if (exact) return exact

    // 2. Substring match (e.g. "Line (MG-XU) (0499:1703)" matches "Line (MG-XU)")
    const sub = dshowDevices.find(
      (d) => cleanReq.includes(d.toLowerCase()) || d.toLowerCase().includes(cleanReq)
    )
    if (sub) return sub

    // 3. Fallback to first available DirectShow audio device
    return dshowDevices[0]
  }

  public async start(options?: {
    stream?: boolean
    record?: boolean
    overrideSettings?: Partial<BroadcastSettings>
  }): Promise<{ success: boolean; error?: string }> {
    if (this.ffmpegProc) {
      if (options?.stream) this.status.isStreaming = true
      if (options?.record) this.status.isRecording = true
      this.notifyStatus()
      return { success: true }
    }

    const settings = {
      ...databaseService.getBroadcastSettings(),
      ...(options?.overrideSettings || {})
    }

    const ffmpegStatus = await ffmpegService.detectFfmpeg()
    if (!ffmpegStatus.available || !ffmpegStatus.path) {
      const err =
        'FFmpeg no está instalado en el sistema o no fue detectado. Instale FFmpeg o configure su ruta en Ajustes.'
      this.status.connectionState = 'error'
      this.status.errorMessage = err
      this.notifyStatus()
      return { success: false, error: err }
    }

    const shouldStream = options?.stream !== undefined ? options.stream : Boolean(settings.rtmpUrl)
    const shouldRecord = options?.record !== undefined ? options.record : settings.recordLocal

    if (!shouldStream && !shouldRecord) {
      return { success: false, error: 'Debe seleccionar transmitir o grabar.' }
    }

    // Resolve RTMP URL & decrypted key
    let rtmpDestination = ''
    if (shouldStream) {
      if (!settings.rtmpUrl) {
        return { success: false, error: 'URL de transmisión RTMP no configurada.' }
      }
      const rawKey = (
        settings.rtmpKey ||
        (settings.rtmpKeyEncrypted ? safeStorageService.decrypt(settings.rtmpKeyEncrypted) : '')
      ).trim()
      const baseUrl = settings.rtmpUrl.trim().replace(/\/$/, '')
      rtmpDestination = rawKey ? `${baseUrl}/${rawKey}` : baseUrl
      this.targetRtmpUrl = rtmpDestination
    }

    // Resolve local recording destination path
    let localRecordDestination = ''
    if (shouldRecord) {
      const recordingsDir =
        settings.recordingPath && fs.existsSync(settings.recordingPath)
          ? settings.recordingPath
          : path.join(app.getPath('userData'), 'recordings')

      try {
        if (!fs.existsSync(recordingsDir)) {
          fs.mkdirSync(recordingsDir, { recursive: true })
        }
      } catch (err: any) {
        return { success: false, error: `Error creando directorio de grabaciones: ${err.message}` }
      }

      const timestampStr = new Date().toISOString().replace(/[:.]/g, '-')
      const ext = settings.recordingFormat === 'mkv' ? 'mkv' : 'mp4'
      localRecordDestination = path.join(recordingsDir, `Culto_Grabacion_${timestampStr}.${ext}`)
      this.targetRecordingPath = localRecordDestination
      this.status.recordingFilePath = localRecordDestination
    }

    // Determine encoder & preset arguments
    const useNvenc = settings.encoderPreference === 'nvenc' && Boolean(ffmpegStatus.hasNvenc)
    this.status.encoderUsed = useNvenc ? 'nvenc' : 'x264'
    this.status.activePreset = settings.qualityPreset

    let resolution = '1280x720'
    let fps = 30
    let videoBitrate = '3000k'
    let minBitrate = '1500k'
    let maxBitrate = '4000k'
    let bufSize = '8000k'
    let audioBitrate = '128k'
    this.targetBitrateKbps = 3000

    if (settings.qualityPreset === '1080p30') {
      resolution = '1920x1080'
      fps = 30
      videoBitrate = '6000k'
      minBitrate = '3000k'
      maxBitrate = '6500k'
      bufSize = '12000k'
      audioBitrate = '160k'
      this.targetBitrateKbps = 6000
    } else if (settings.qualityPreset === '1080p60') {
      resolution = '1920x1080'
      fps = 60
      videoBitrate = '9000k'
      minBitrate = '4500k'
      maxBitrate = '10000k'
      bufSize = '18000k'
      audioBitrate = '192k'
      this.targetBitrateKbps = 9000
    }

    // Resolve audio device and filters from Audio Mixer config
    let audioDevice: string | undefined = undefined
    let audioFilter: string | undefined = undefined

    const mixerState = databaseService.getAudioMixerConfig()
    if (!mixerState.masterMuted) {
      // Find active microphone or aux input
      const activeSource = mixerState.sources.find(
        (s) => (s.type === 'mic_input' || s.type === 'aux_input') && !s.muted
      )
      if (activeSource) {
        const dshowDevices = await this.listDirectShowAudioDevices(ffmpegStatus.path)
        if (dshowDevices.length > 0) {
          const userDeviceName = (activeSource as any).deviceName || activeSource.deviceId || ''
          audioDevice = this.resolveDirectShowAudioDevice(userDeviceName, dshowDevices)

          logger.info(`[BroadcastEngine] Using DirectShow audio device: "${audioDevice}" for source "${activeSource.name}"`)

          const filters: string[] = []
          const effectiveVol = (activeSource.volume ?? 1.0) * (mixerState.masterVolume ?? 1.0)
          if (Math.abs(effectiveVol - 1.0) > 0.05) {
            filters.push(`volume=${effectiveVol.toFixed(2)}`)
          }
          if (activeSource.delayMs && activeSource.delayMs > 0) {
            filters.push(`adelay=${activeSource.delayMs}|${activeSource.delayMs}`)
          }
          if (mixerState.limiterEnabled) {
            filters.push('alimiter=limit=0.95:level=true')
          }
          if (filters.length > 0) {
            audioFilter = filters.join(',')
          }
        }
      }
    }

    const ffmpegArgs = buildBroadcastFfmpegArgs({
      resolution,
      fps,
      videoBitrate,
      minBitrate,
      maxBitrate,
      bufSize,
      audioBitrate,
      useNvenc,
      rtmpDestination: shouldStream ? rtmpDestination : undefined,
      localRecordDestination: shouldRecord ? localRecordDestination : undefined,
      recordingFormat: settings.recordingFormat,
      audioDevice,
      audioFilter
    })

    try {
      this.recentStderr = []
      this.status.connectionState = 'connecting'
      this.status.isStreaming = shouldStream
      this.status.isRecording = shouldRecord
      this.status.errorMessage = undefined
      this.status.qualityWarning = undefined
      this.updateDiskFree()
      this.notifyStatus()

      // Spawn FFmpeg with stdin pipe
      this.ffmpegProc = spawn(ffmpegStatus.path, ffmpegArgs, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.ffmpegProc.stdin?.on('error', (err) => {
        logger.warn('[BroadcastEngine] Stdin write error:', err)
      })

      this.startDurationTimer()

      this.ffmpegProc.stderr?.on('data', (data) => {
        const text = data.toString()
        const lines = text.split(/[\r\n]+/)
        for (const line of lines) {
          if (!line.trim()) continue
          this.recentStderr.push(line.trim())
          if (this.recentStderr.length > 50) this.recentStderr.shift()
          this.parseFfmpegStderr(line)
        }
      })

      this.ffmpegProc.on('error', (err) => {
        logger.error('[BroadcastEngine] FFmpeg process error:', err)
        this.handleProcessFailure(err.message)
      })

      this.ffmpegProc.on('close', (code) => {
        logger.info(`[BroadcastEngine] FFmpeg process closed with code ${code}`)
        this.handleProcessClose(code)
      })

      this.status.connectionState = 'connected'
      this.reconnectAttempts = 0
      this.notifyStatus()

      return { success: true }
    } catch (err: any) {
      this.handleProcessFailure(err.message)
      return { success: false, error: err.message }
    }
  }

  public feedChunk(chunk: Buffer | Uint8Array): void {
    if (this.ffmpegProc && this.ffmpegProc.stdin && !this.ffmpegProc.stdin.destroyed) {
      try {
        this.ffmpegProc.stdin.write(chunk)
      } catch (err) {
        logger.warn('[BroadcastEngine] Error writing chunk to FFmpeg stdin:', err)
      }
    }
  }

  public async stop(options?: { stream?: boolean; record?: boolean }): Promise<{ success: boolean }> {
    if (!this.ffmpegProc) {
      this.resetStatus()
      return { success: true }
    }

    const stopStream = options?.stream !== undefined ? options.stream : true
    const stopRecord = options?.record !== undefined ? options.record : true

    if (stopStream) this.status.isStreaming = false
    if (stopRecord) this.status.isRecording = false

    if (!this.status.isStreaming && !this.status.isRecording) {
      this.stopDurationTimer()
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }

      try {
        if (this.ffmpegProc.stdin && !this.ffmpegProc.stdin.destroyed) {
          this.ffmpegProc.stdin.end()
        }
      } catch {
        // stdin already closed
      }

      setTimeout(() => {
        if (this.ffmpegProc) {
          try {
            this.ffmpegProc.kill('SIGINT')
          } catch {
            // Process terminated
          }
          setTimeout(() => {
            if (this.ffmpegProc) {
              try {
                this.ffmpegProc.kill('SIGKILL')
              } catch {
                // Process already dead
              }
              this.ffmpegProc = null
            }
          }, 1500)
        }
      }, 500)

      this.resetStatus()
    }

    this.notifyStatus()
    return { success: true }
  }

  private startDurationTimer(): void {
    this.stopDurationTimer()
    this.status.durationSeconds = 0
    this.lowBitrateSeconds = 0
    this.timerInterval = setInterval(() => {
      this.status.durationSeconds++
      const secs = this.status.durationSeconds
      const h = String(Math.floor(secs / 3600)).padStart(2, '0')
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
      const s = String(secs % 60).padStart(2, '0')
      this.status.formattedTime = `${h}:${m}:${s}`

      this.checkBitrateHealth()
      if (secs % 5 === 0) {
        this.updateDiskFree()
      }
      this.notifyStatus()
    }, 1000)
  }

  private checkBitrateHealth(): void {
    if (this.status.durationSeconds < 15 || !this.status.isStreaming) {
      this.lowBitrateSeconds = 0
      this.status.qualityWarning = undefined
      return
    }

    const targetKbps = this.targetBitrateKbps || 3500
    const threshold = targetKbps * 0.7

    if (this.status.bitrateKbps > 0 && this.status.bitrateKbps < threshold) {
      this.lowBitrateSeconds++
      if (this.lowBitrateSeconds >= 10) {
        this.status.qualityWarning = `Alerta de Calidad: Caída de Bitrate detectada (>30% por más de 10s: ${Math.round(this.status.bitrateKbps)} kbps).`
      }
    } else {
      this.lowBitrateSeconds = 0
      this.status.qualityWarning = undefined
    }
  }

  private stopDurationTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  private resetStatus(): void {
    this.status.isStreaming = false
    this.status.isRecording = false
    this.status.connectionState = 'disconnected'
    this.status.bitrateKbps = 0
    this.status.fps = 0
    this.status.durationSeconds = 0
    this.status.formattedTime = '00:00:00'
    this.status.qualityWarning = undefined
    this.stopDurationTimer()
  }

  private parseFfmpegStderr(line: string): void {
    const fpsMatch = line.match(/fps=\s*([\d.]+)/)
    if (fpsMatch) this.status.fps = parseFloat(fpsMatch[1])

    const bitrateMatch = line.match(/bitrate=\s*([\d.]+)kbits\/s/)
    if (bitrateMatch) this.status.bitrateKbps = parseFloat(bitrateMatch[1])

    const dropMatch = line.match(/drop=\s*(\d+)/)
    if (dropMatch) this.status.droppedFrames = parseInt(dropMatch[1], 10)

    const frameMatch = line.match(/frame=\s*(\d+)/)
    if (frameMatch) this.status.totalFrames = parseInt(frameMatch[1], 10)

    if (line.includes('Connection to') && line.includes('failed')) {
      this.status.connectionState = 'reconnecting'
      this.status.errorMessage = 'Conexión RTMP interrumpida.'
    }
  }

  private handleProcessFailure(errorMessage: string): void {
    logger.warn('[BroadcastEngine] Failure event:', errorMessage)
    this.stopDurationTimer()
    this.status.isStreaming = false
    this.status.connectionState = 'error'
    this.status.errorMessage = errorMessage
    this.notifyStatus()
  }

  private handleProcessClose(code: number | null): void {
    const fullStderr = this.recentStderr.join('\n')
    this.ffmpegProc = null
    const wasStreaming = this.status.isStreaming
    const settings = databaseService.getBroadcastSettings()

    if (code !== 0 && code !== null) {
      let friendlyError = `Transmisión detenida por error de codificador (código ${code}).`
      if (
        fullStderr.includes('Connection refused') ||
        fullStderr.includes('Cannot open connection') ||
        fullStderr.includes('Error number -138') ||
        fullStderr.includes('Connection timed out')
      ) {
        friendlyError =
          'Error de conexión: No se pudo conectar al servidor RTMP. Compruebe la URL y el acceso a internet.'
      } else if (
        fullStderr.includes('Authentication failed') ||
        fullStderr.includes('Publish failed') ||
        fullStderr.includes('Server error')
      ) {
        friendlyError = 'Clave de transmisión incorrecta o rechazada por el servidor RTMP.'
      } else if (
        fullStderr.includes('Unknown encoder') ||
        fullStderr.includes('nvcuda.dll') ||
        fullStderr.includes('nvenc')
      ) {
        friendlyError =
          'El codificador NVIDIA NVENC no está disponible o requiere actualizar controladores.'
      } else if (fullStderr.includes('Invalid data found')) {
        friendlyError =
          'Error de formato en flujo de video de entrada (AVERROR_INVALIDDATA).'
      }

      logger.error(`[BroadcastEngine] FFmpeg process closed with code ${code}. Stderr:\n${fullStderr}`)

      if (wasStreaming && settings.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        this.status.connectionState = 'reconnecting'
        this.status.errorMessage = `Reconectando transmisión (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
        this.notifyStatus()

        this.reconnectTimer = setTimeout(() => {
          this.start({ stream: true })
        }, 2500)
        return
      }

      this.handleProcessFailure(friendlyError)
      return
    }

    this.resetStatus()
    this.notifyStatus()
  }
}

export const broadcastEngine = new BroadcastEngine()
