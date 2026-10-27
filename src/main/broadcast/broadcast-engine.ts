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

  constructor() {
    super()
  }

  public getStatus(): BroadcastStatus {
    return { ...this.status }
  }

  private notifyStatus(): void {
    this.emit('status-changed', this.getStatus())
  }

  public async start(options?: {
    stream?: boolean
    record?: boolean
    overrideSettings?: Partial<BroadcastSettings>
  }): Promise<{ success: boolean; error?: string }> {
    if (this.ffmpegProc) {
      // Already running; if only stream or record was requested, update flags
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
      const err = 'FFmpeg no está instalado en el sistema o no fue detectado. Instale FFmpeg o configure su ruta en Ajustes.'
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
      const rawKey = settings.rtmpKeyEncrypted ? safeStorageService.decrypt(settings.rtmpKeyEncrypted) : ''
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

    let resolution = '1920x1080'
    let fps = 30
    let videoBitrate = '6000k'
    let maxBitrate = '6500k'
    let bufSize = '12000k'
    let audioBitrate = '160k'

    if (settings.qualityPreset === '720p30') {
      resolution = '1280x720'
      fps = 30
      videoBitrate = '3500k'
      maxBitrate = '4000k'
      bufSize = '7000k'
      audioBitrate = '128k'
    } else if (settings.qualityPreset === '1080p60') {
      resolution = '1920x1080'
      fps = 60
      videoBitrate = '9000k'
      maxBitrate = '10000k'
      bufSize = '18000k'
      audioBitrate = '192k'
    }

    const ffmpegArgs: string[] = [
      '-hide_banner',
      '-loglevel',
      'info',
      // Input: WebM / Matroska or raw stdin
      '-re',
      '-f',
      'matroska',
      '-i',
      'pipe:0'
    ]

    // Video codec flags
    if (useNvenc) {
      ffmpegArgs.push(
        '-c:v',
        'h264_nvenc',
        '-preset',
        'p4',
        '-tune',
        'll',
        '-rc',
        'cbr',
        '-b:v',
        videoBitrate,
        '-maxrate',
        maxBitrate,
        '-bufsize',
        bufSize,
        '-g',
        String(fps * 2),
        '-pix_fmt',
        'yuv420p',
        '-s',
        resolution
      )
    } else {
      ffmpegArgs.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-tune',
        'zerolatency',
        '-b:v',
        videoBitrate,
        '-maxrate',
        maxBitrate,
        '-bufsize',
        bufSize,
        '-g',
        String(fps * 2),
        '-pix_fmt',
        'yuv420p',
        '-s',
        resolution
      )
    }

    // Audio codec flags
    ffmpegArgs.push('-c:a', 'aac', '-b:a', audioBitrate, '-ar', '48000', '-ac', '2')

    // Outputs
    if (shouldStream && rtmpDestination) {
      ffmpegArgs.push('-f', 'flv', rtmpDestination)
    }

    if (shouldRecord && localRecordDestination) {
      const containerFormat = settings.recordingFormat === 'mkv' ? 'matroska' : 'mp4'
      if (containerFormat === 'mp4') {
        ffmpegArgs.push('-movflags', '+frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', localRecordDestination)
      } else {
        ffmpegArgs.push('-f', 'matroska', localRecordDestination)
      }
    }

    try {
      this.status.connectionState = 'connecting'
      this.status.isStreaming = shouldStream
      this.status.isRecording = shouldRecord
      this.status.errorMessage = undefined
      this.notifyStatus()

      // Spawn FFmpeg with stdin pipe
      this.ffmpegProc = spawn(ffmpegStatus.path, ffmpegArgs, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this.startDurationTimer()

      this.ffmpegProc.stderr?.on('data', (data) => {
        const text = data.toString()
        this.parseFfmpegStderr(text)
      })

      this.ffmpegProc.on('error', (err) => {
        logger.error('[BroadcastEngine] FFmpeg process error:', err)
        this.handleProcessFailure(err.message)
      })

      this.ffmpegProc.on('close', (code) => {
        logger.info(`[BroadcastEngine] FFmpeg process closed with code ${code}`)
        this.handleProcessClose(code)
      })

      // Update state to connected after spawn
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

    // If both stopped, terminate process
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

      // Graceful timeout then force kill
      setTimeout(() => {
        if (this.ffmpegProc) {
          try {
            this.ffmpegProc.kill('SIGINT')
          } catch {
            // Process may already be terminated
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
    this.timerInterval = setInterval(() => {
      this.status.durationSeconds++
      const secs = this.status.durationSeconds
      const h = String(Math.floor(secs / 3600)).padStart(2, '0')
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
      const s = String(secs % 60).padStart(2, '0')
      this.status.formattedTime = `${h}:${m}:${s}`
      this.notifyStatus()
    }, 1000)
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
    this.stopDurationTimer()
  }

  private parseFfmpegStderr(line: string): void {
    // Matches: frame= 1234 fps= 30 q=28.0 size= 12500kB time=00:00:41.20 bitrate=2480.0kbits/s speed=1.0x drop=0
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
    this.status.connectionState = 'error'
    this.status.errorMessage = errorMessage
    this.notifyStatus()
  }

  private handleProcessClose(code: number | null): void {
    this.ffmpegProc = null
    const wasStreaming = this.status.isStreaming
    const settings = databaseService.getBroadcastSettings()

    if (wasStreaming && code !== 0 && settings.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      this.status.connectionState = 'reconnecting'
      this.status.errorMessage = `Reconectando transmisión (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      this.notifyStatus()

      this.reconnectTimer = setTimeout(() => {
        this.start({ stream: true })
      }, 2500)
    } else {
      this.resetStatus()
      this.notifyStatus()
    }
  }
}

export const broadcastEngine = new BroadcastEngine()
