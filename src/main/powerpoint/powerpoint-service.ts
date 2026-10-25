/**
 * PowerPoint Conversion & Management Service (Phase 5B)
 *
 * Implements converter abstraction with fallback:
 * 1. Microsoft PowerPoint COM (packaged PowerShell script, non-interactive, forced macro disable)
 * 2. LibreOffice CLI (--headless --convert-to pdf)
 * 3. Manual fallback with step-by-step instructions
 *
 * Features:
 * - Deterministic SHA-256 hash + resolution caching
 * - Resolution targeting (max resolution among active displays, e.g. 1080p / 4K)
 * - 120s timeout, child process tracking and cancellation
 * - Speaker notes extraction & fidelity analysis
 * - "Editar en PowerPoint" integration with modification detection
 */

import { spawn, exec, ChildProcess } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'
import { pptxParser, PptxAnalysisResult } from './powerpoint-parser'
import { databaseService } from '../db/database-service'
import { displayManager } from '../display-manager'
import { logger } from '../logger'

export type PptConverterType = 'powerpoint_com' | 'libreoffice' | 'manual'

export interface PptConverterInfo {
  type: PptConverterType
  name: string
  isAvailable: boolean
  description: string
  version?: string
}

export interface PptConversionSlide {
  index: number
  imagePath: string
  speakerNotes?: string
  warnings?: string[]
}

export interface PptPresentationManifest {
  id: string
  hash: string
  originalPath: string
  originalName: string
  fileSize: number
  slideCount: number
  targetWidth: number
  targetHeight: number
  converterUsed: PptConverterType
  convertedAt: string
  slides: PptConversionSlide[]
  analysis: PptxAnalysisResult
  isModifiedExternally?: boolean
}

export interface PptConversionProgress {
  jobId: string
  percent: number
  status: 'running' | 'completed' | 'cancelled' | 'error'
  currentStep: string
  errorMessage?: string
}

export class PowerPointService {
  private cacheDir: string
  private activeJobs: Map<string, ChildProcess> = new Map()
  private jobInitialPids: Map<string, number[]> = new Map()

  constructor(customCacheDir?: string) {
    if (customCacheDir) {
      this.cacheDir = customCacheDir
    } else {
      try {
        this.cacheDir = path.join(app.getPath('userData'), 'media', 'powerpoint_cache')
      } catch {
        this.cacheDir = path.resolve(process.cwd(), 'userData', 'media', 'powerpoint_cache')
      }
    }
  }

  public initialize(): void {
    try {
      this.cacheDir = path.join(app.getPath('userData'), 'media', 'powerpoint_cache')
    } catch {
      // app might be unavailable in unit test runner
    }
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  /**
   * Detects available converters on this computer.
   */
  public async detectConverters(): Promise<PptConverterInfo[]> {
    const list: PptConverterInfo[] = []

    // 1. Check Microsoft PowerPoint COM
    const pptComAvailable = await this.checkPowerPointCom()
    list.push({
      type: 'powerpoint_com',
      name: 'Microsoft PowerPoint (COM Automático)',
      isAvailable: pptComAvailable,
      description: pptComAvailable
        ? 'Instalado y disponible. Exporta diapositivas directamente en alta resolución sin ventana visible.'
        : 'No se detectó Microsoft Office PowerPoint en este equipo.'
    })

    // 2. Check LibreOffice
    const libreOfficePath = this.findLibreOfficePath()
    list.push({
      type: 'libreoffice',
      name: 'LibreOffice (Modo sin interfaz)',
      isAvailable: !!libreOfficePath,
      description: libreOfficePath
        ? `Disponible en: ${libreOfficePath}. Respaldo automático mediante conversión a PDF.`
        : 'LibreOffice no está instalado (respaldo opcional).'
    })

    // 3. Manual Fallback
    list.push({
      type: 'manual',
      name: 'Exportación Manual a PDF',
      isAvailable: true,
      description:
        'Siempre disponible: guarde su presentación como PDF desde PowerPoint (Archivo > Exportar > Crear documento PDF) e impórtela directamente en ChurchPresenter.'
    })

    return list
  }

  private checkPowerPointCom(): Promise<boolean> {
    return new Promise((resolve) => {
      // Fast check for POWERPNT.EXE in common Office paths
      const officePaths = [
        'C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
        'C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE',
        'C:\\Program Files\\Microsoft Office\\Office15\\POWERPNT.EXE',
        'C:\\Program Files\\Microsoft Office\\Office16\\POWERPNT.EXE'
      ]
      for (const p of officePaths) {
        if (fs.existsSync(p)) return resolve(true)
      }

      // Fallback: quick COM probe via PowerShell
      const proc = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'try { $p = New-Object -ComObject PowerPoint.Application; $p.Quit(); exit 0 } catch { exit 1 }'
      ])
      proc.on('close', (code) => resolve(code === 0))
      proc.on('error', () => resolve(false))
    })
  }

  private findLibreOfficePath(): string | null {
    const paths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
    ]
    for (const p of paths) {
      if (fs.existsSync(p)) return p
    }
    return null
  }

  /**
   * Calculates deterministic SHA-256 hash of presentation file.
   */
  public async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', (d) => hash.update(d))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', (err) => reject(err))
    })
  }

  /**
   * Resolves target resolution based on active displays (supports 4K and 1080p).
   */
  public getTargetResolution(): { width: number; height: number } {
    try {
      const displays = displayManager.getDisplays()
      let maxW = 1920
      let maxH = 1080
      for (const d of displays) {
        if (d.bounds.width > maxW) maxW = d.bounds.width
        if (d.bounds.height > maxH) maxH = d.bounds.height
      }
      return { width: maxW, height: maxH }
    } catch {
      return { width: 1920, height: 1080 }
    }
  }

  /**
   * Imports and converts a PowerPoint presentation.
   */
  public async importPresentation(
    filePath: string,
    onProgress?: (p: PptConversionProgress) => void
  ): Promise<PptPresentationManifest> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo de PowerPoint no existe: ${filePath}`)
    }

    const ext = path.extname(filePath).toLowerCase()
    const allowed = ['.pptx', '.ppt', '.pptm', '.ppsx']
    if (!allowed.includes(ext)) {
      throw new Error(`Formato no compatible (${ext}). Formatos soportados: ${allowed.join(', ')}`)
    }

    const jobId = `ppt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
    const fileHash = await this.calculateFileHash(filePath)
    const { width: targetWidth, height: targetHeight } = this.getTargetResolution()
    const itemCacheDir = path.join(this.cacheDir, `${fileHash.substring(0, 16)}_${targetWidth}x${targetHeight}`)
    const manifestPath = path.join(itemCacheDir, 'manifest.json')

    // 1. Check Cache
    if (fs.existsSync(manifestPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PptPresentationManifest
        // Verify slide files exist
        let allValid = true
        for (const s of cached.slides) {
          if (!fs.existsSync(s.imagePath)) {
            allValid = false
            break
          }
        }
        if (allValid) {
          logger.info(`Reusing cached PowerPoint conversion (${cached.slideCount} slides) for hash ${fileHash.substring(0, 10)}`)
          if (onProgress) {
            onProgress({
              jobId,
              percent: 100,
              status: 'completed',
              currentStep: 'Completado desde caché'
            })
          }
          return cached
        }
      } catch {
        // Cache read miss
      }
    }

    // 2. Parse Presentation structure (notes, fonts, animations) if PPTX/PPTM/PPSX
    if (onProgress) {
      onProgress({
        jobId,
        percent: 10,
        status: 'running',
        currentStep: 'Analizando estructura y notas del orador...'
      })
    }

    let analysis: PptxAnalysisResult = {
      slideCount: 0,
      speakerNotes: {},
      fontsUsed: [],
      missingFonts: [],
      warnings: []
    }

    try {
      if (ext !== '.ppt') {
        analysis = pptxParser.parsePptx(filePath)
      }
    } catch (parseErr) {
      logger.warn(`Could not parse XML structure of ${filePath}:`, parseErr)
    }

    // 3. Select Converter
    const converters = await this.detectConverters()
    const chosenConverter =
      databaseService.getConfig('preferred_ppt_converter') as PptConverterType ||
      (converters.find((c) => c.isAvailable && c.type !== 'manual')?.type || 'manual')

    if (onProgress) {
      onProgress({
        jobId,
        percent: 25,
        status: 'running',
        currentStep: `Exportando diapositivas con ${chosenConverter}...`
      })
    }

    if (!fs.existsSync(itemCacheDir)) {
      fs.mkdirSync(itemCacheDir, { recursive: true })
    }

    let slideImages: { index: number; path: string }[] = []

    if (chosenConverter === 'powerpoint_com') {
      slideImages = await this.convertWithPowerPointCom(jobId, filePath, itemCacheDir, targetWidth, targetHeight, onProgress)
    } else if (chosenConverter === 'libreoffice') {
      slideImages = await this.convertWithLibreOffice(jobId, filePath, itemCacheDir, onProgress)
    } else {
      throw new Error(
        'No hay un conversor automático de PowerPoint disponible en este equipo. Por favor, abra la presentación en PowerPoint, seleccione Archivo > Exportar > Crear documento PDF, e importe el archivo PDF generado.'
      )
    }

    // 4. Assemble Manifest
    const slides: PptConversionSlide[] = slideImages.map((s) => ({
      index: s.index,
      imagePath: s.path,
      speakerNotes: analysis.speakerNotes[s.index],
      warnings: analysis.warnings.find((w) => w.slideIndex === s.index)?.details
    }))

    const stat = fs.statSync(filePath)
    const manifest: PptPresentationManifest = {
      id: `pptx_${fileHash.substring(0, 12)}`,
      hash: fileHash,
      originalPath: filePath,
      originalName: path.basename(filePath),
      fileSize: stat.size,
      slideCount: slides.length,
      targetWidth,
      targetHeight,
      converterUsed: chosenConverter,
      convertedAt: new Date().toISOString(),
      slides,
      analysis
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')
    logger.info(`PowerPoint conversion completed: ${manifest.slideCount} slides saved to ${itemCacheDir}`)

    if (onProgress) {
      onProgress({
        jobId,
        percent: 100,
        status: 'completed',
        currentStep: 'Conversión finalizada con éxito'
      })
    }

    return manifest
  }

  public getPowerPointPids(): Promise<number[]> {
    return new Promise((resolve) => {
      exec(
        'powershell.exe -NoProfile -NonInteractive -Command "Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"',
        (err, stdout) => {
          if (err || !stdout) return resolve([])
          const pids = stdout
            .trim()
            .split(/\r?\n/)
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
          resolve(pids)
        }
      )
    })
  }

  public cleanupOrphanedPowerPoint(initialPids: number[]): Promise<void> {
    return new Promise((resolve) => {
      this.getPowerPointPids().then((currentPids) => {
        // Any PID in currentPids that was NOT in initialPids must be cleanly terminated
        const orphaned = currentPids.filter((pid) => !initialPids.includes(pid))
        if (orphaned.length === 0) return resolve()
        logger.info(`Terminating ${orphaned.length} orphaned PowerPoint process(es): ${orphaned.join(', ')}`)
        exec(
          `powershell.exe -NoProfile -NonInteractive -Command "Stop-Process -Id ${orphaned.join(',')} -Force -ErrorAction SilentlyContinue"`,
          () => resolve()
        )
      })
    })
  }

  /**
   * Executes packaged PowerShell script with strict security and 120s timeout.
   */
  private async convertWithPowerPointCom(
    jobId: string,
    filePath: string,
    outputDir: string,
    targetWidth: number,
    targetHeight: number,
    _onProgress?: (p: PptConversionProgress) => void
  ): Promise<{ index: number; path: string }[]> {
    const initialPids = await this.getPowerPointPids()
    this.jobInitialPids.set(jobId, initialPids)

    return new Promise((resolve, reject) => {
      // Packaged script path
      let scriptPath = path.resolve(__dirname, 'scripts/export-powerpoint.ps1')
      if (!fs.existsSync(scriptPath)) {
        scriptPath = path.resolve(process.cwd(), 'src/main/powerpoint/scripts/export-powerpoint.ps1')
      }

      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Script de exportación de PowerPoint no encontrado: ${scriptPath}`))
      }

      const args = [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-FilePath',
        filePath,
        '-OutputDir',
        outputDir,
        '-TargetWidth',
        targetWidth.toString(),
        '-TargetHeight',
        targetHeight.toString()
      ]

      logger.info(`Spawning PowerPoint COM worker: powershell.exe with script ${scriptPath}`)
      const proc = spawn('powershell.exe', args)
      this.activeJobs.set(jobId, proc)

      // 120 seconds timeout protection
      const timeoutMs = 120000
      const timer = setTimeout(async () => {
        logger.error(`PowerPoint COM conversion timed out after ${timeoutMs / 1000}s. Killing worker process...`)
        if (!proc.killed) {
          proc.kill('SIGKILL')
        }
        this.activeJobs.delete(jobId)
        await this.cleanupOrphanedPowerPoint(initialPids)
        this.jobInitialPids.delete(jobId)
        reject(new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s) durante la conversión de PowerPoint.`))
      }, timeoutMs)

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (d) => (stdout += d.toString()))
      proc.stderr.on('data', (d) => (stderr += d.toString()))

      proc.on('close', async (code) => {
        clearTimeout(timer)
        this.activeJobs.delete(jobId)
        if (code !== 0) {
          await this.cleanupOrphanedPowerPoint(initialPids)
        }
        this.jobInitialPids.delete(jobId)

        if (code !== 0) {
          logger.error(`PowerPoint export script exited with code ${code}. Stderr: ${stderr}`)
          try {
            const errObj = JSON.parse(stdout)
            return reject(new Error(errObj.errorMessage || `Error de exportación (Código ${errObj.errorCode || code})`))
          } catch {
            return reject(new Error(`Error en el proceso de PowerPoint (${stderr || stdout || code})`))
          }
        }

        try {
          const res = JSON.parse(stdout)
          if (!res.success) {
            return reject(new Error(res.errorMessage || 'Fallo desconocido en la exportación de PowerPoint.'))
          }

          const slides: { index: number; path: string }[] = res.slides.map((s: any) => ({
            index: s.index,
            path: s.path
          }))
          resolve(slides)
        } catch {
          logger.error('Failed to parse PowerPoint worker JSON output:', stdout)
          reject(new Error('Respuesta inválida del proceso de exportación de PowerPoint.'))
        }
      })

      proc.on('error', async (err) => {
        clearTimeout(timer)
        this.activeJobs.delete(jobId)
        await this.cleanupOrphanedPowerPoint(initialPids)
        this.jobInitialPids.delete(jobId)
        logger.error(`Worker spawn error:`, err)
        reject(err)
      })
    })
  }

  /**
   * Fallback using LibreOffice --headless --convert-to pdf.
   */
  private convertWithLibreOffice(
    jobId: string,
    filePath: string,
    outputDir: string,
    _onProgress?: (p: PptConversionProgress) => void
  ): Promise<{ index: number; path: string }[]> {
    return new Promise((resolve, reject) => {
      const soffice = this.findLibreOfficePath()
      if (!soffice) {
        return reject(new Error('LibreOffice no está instalado.'))
      }

      logger.info(`Converting PowerPoint via LibreOffice headless: ${filePath}`)
      const args = ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, filePath]
      const proc = spawn(soffice, args)
      this.activeJobs.set(jobId, proc)

      const timer = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL')
        this.activeJobs.delete(jobId)
        reject(new Error('Tiempo de espera agotado en LibreOffice.'))
      }, 90000)

      proc.on('close', (code) => {
        clearTimeout(timer)
        this.activeJobs.delete(jobId)
        if (code === 0) {
          const pdfName = path.basename(filePath, path.extname(filePath)) + '.pdf'
          const pdfPath = path.join(outputDir, pdfName)
          if (fs.existsSync(pdfPath)) {
            // Note: Returning empty list with manifest pdf fallback
            resolve([{ index: 1, path: pdfPath }])
          } else {
            reject(new Error('LibreOffice no generó el archivo PDF esperado.'))
          }
        } else {
          reject(new Error(`LibreOffice falló con código ${code}`))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        this.activeJobs.delete(jobId)
        reject(err)
      })
    })
  }

  /**
   * Opens original presentation in default Windows app ("Editar en PowerPoint").
   */
  public async editInPowerPoint(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo original no existe en la ruta: ${filePath}`)
    }
    logger.info(`Opening presentation in default application: ${filePath}`)
    return shell.openPath(filePath)
  }

  /**
   * Checks if original presentation file has changed in disk.
   */
  public async checkIfModified(originalPath: string, recordedHash: string): Promise<boolean> {
    if (!fs.existsSync(originalPath)) return false
    const currentHash = await this.calculateFileHash(originalPath)
    return currentHash !== recordedHash
  }

  /**
   * Cancels an ongoing conversion job.
   */
  public cancelJob(jobId: string): boolean {
    const proc = this.activeJobs.get(jobId)
    const initialPids = this.jobInitialPids.get(jobId) || []
    if (proc && !proc.killed) {
      logger.info(`Cancelling PowerPoint conversion job ${jobId}`)
      proc.kill('SIGKILL')
      this.activeJobs.delete(jobId)
      this.cleanupOrphanedPowerPoint(initialPids)
      this.jobInitialPids.delete(jobId)
      return true
    }
    this.jobInitialPids.delete(jobId)
    return false
  }
}

export const powerpointService = new PowerPointService()
