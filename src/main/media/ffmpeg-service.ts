/**
 * Optional Video Conversion Service using system FFmpeg (Phase 5A/5B - Requirement A.5)
 *
 * Scans for FFmpeg in system PATH or user-configured path in Settings.
 * Converts incompatible video containers/codecs (MKV, AVI, MOV, HEVC) to MP4 (H.264/AAC).
 * Does NOT bundle FFmpeg in the installer.
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export interface FfmpegStatus {
  available: boolean
  path: string | null
  version: string | null
}

export interface ConversionProgress {
  jobId: string
  percent: number
  currentTimeSeconds: number
  totalDurationSeconds: number
  status: 'running' | 'completed' | 'cancelled' | 'error'
  errorMessage?: string
}

export class FfmpegService {
  private activeProcesses: Map<string, ChildProcess> = new Map()

  /**
   * Discovers FFmpeg in system PATH, standard Windows folders, or user-configured path.
   */
  public async detectFfmpeg(): Promise<FfmpegStatus> {
    // 1. Check user configured path in database
    const configuredPath = databaseService.getConfig('ffmpeg_path')
    if (configuredPath && fs.existsSync(configuredPath)) {
      const ver = await this.queryFfmpegVersion(configuredPath)
      if (ver) {
        return { available: true, path: configuredPath, version: ver }
      }
    }

    // 2. Check standard Windows installations (winget / chocolatey / scoop)
    const standardPaths = [
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Links\\ffmpeg.exe'),
      'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe'
    ]

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        const ver = await this.queryFfmpegVersion(p)
        if (ver) {
          return { available: true, path: p, version: ver }
        }
      }
    }

    // 3. Check system PATH
    const pathVer = await this.queryFfmpegVersion('ffmpeg')
    if (pathVer) {
      return { available: true, path: 'ffmpeg', version: pathVer }
    }

    return { available: false, path: null, version: null }
  }

  private queryFfmpegVersion(ffmpegBin: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(ffmpegBin, ['-version'])
        let stdout = ''
        proc.stdout?.on('data', (d) => (stdout += d.toString()))
        proc.on('error', () => resolve(null))
        proc.on('close', (code) => {
          if (code === 0) {
            const firstLine = stdout.split('\n')[0] || ''
            resolve(firstLine.trim())
          } else {
            resolve(null)
          }
        })
      } catch {
        resolve(null)
      }
    })
  }

  /**
   * Converts an incompatible video file to standard MP4 (H.264/AAC).
   */
  public async convertVideo(
    jobId: string,
    inputPath: string,
    outputPath: string,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<{ success: boolean; outputPath: string }> {
    const status = await this.detectFfmpeg()
    if (!status.available || !status.path) {
      throw new Error(
        'FFmpeg no está disponible en este sistema. Por favor instálelo o configure su ruta en Configuración.'
      )
    }

    const outDir = path.dirname(outputPath)
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    logger.info(`Starting FFmpeg video conversion: "${inputPath}" -> "${outputPath}" (Job ID: ${jobId})`)

    const ffmpegExe: string = status.path!

    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        inputPath,
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '22',
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        outputPath
      ]

      const proc: ChildProcess = spawn(ffmpegExe, args)
      this.activeProcesses.set(jobId, proc)

      let stderrBuf = ''
      let totalDurationSec = 0

      proc.stderr?.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString()
        stderrBuf += text

        // Extract total duration: Duration: 00:01:23.45
        if (totalDurationSec === 0) {
          const durMatch = text.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
          if (durMatch) {
            const h = parseFloat(durMatch[1])
            const m = parseFloat(durMatch[2])
            const s = parseFloat(durMatch[3])
            totalDurationSec = h * 3600 + m * 60 + s
          }
        }

        // Extract current time: time=00:00:15.30
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        if (timeMatch && totalDurationSec > 0) {
          const ch = parseFloat(timeMatch[1])
          const cm = parseFloat(timeMatch[2])
          const cs = parseFloat(timeMatch[3])
          const currentSec = ch * 3600 + cm * 60 + cs
          const percent = Math.min(99, Math.round((currentSec / totalDurationSec) * 100))

          if (onProgress) {
            onProgress({
              jobId,
              percent,
              currentTimeSeconds: currentSec,
              totalDurationSeconds: totalDurationSec,
              status: 'running'
            })
          }
        }
      })

      proc.on('error', (err: Error) => {
        this.activeProcesses.delete(jobId)
        logger.error(`FFmpeg process error for job ${jobId}:`, err)
        if (onProgress) {
          onProgress({
            jobId,
            percent: 0,
            currentTimeSeconds: 0,
            totalDurationSeconds: totalDurationSec,
            status: 'error',
            errorMessage: err.message
          })
        }
        reject(err)
      })

      proc.on('close', (code: number | null) => {
        this.activeProcesses.delete(jobId)
        if (code === 0) {
          logger.info(`FFmpeg conversion completed successfully for job ${jobId}`)
          if (onProgress) {
            onProgress({
              jobId,
              percent: 100,
              currentTimeSeconds: totalDurationSec,
              totalDurationSeconds: totalDurationSec,
              status: 'completed'
            })
          }
          resolve({ success: true, outputPath })
        } else {
          const err = new Error(`FFmpeg terminó con código de error ${code}. ${stderrBuf.slice(-200)}`)
          logger.error(`FFmpeg failed for job ${jobId}:`, err)
          if (onProgress) {
            onProgress({
              jobId,
              percent: 0,
              currentTimeSeconds: 0,
              totalDurationSeconds: totalDurationSec,
              status: 'error',
              errorMessage: err.message
            })
          }
          reject(err)
        }
      })
    })
  }

  /**
   * Cancels an active conversion job.
   */
  public cancelConversion(jobId: string): boolean {
    const proc = this.activeProcesses.get(jobId)
    if (proc && !proc.killed) {
      logger.info(`Cancelling FFmpeg conversion job ${jobId}`)
      proc.kill('SIGTERM')
      this.activeProcesses.delete(jobId)
      return true
    }
    return false
  }
}

export const ffmpegService = new FfmpegService()
