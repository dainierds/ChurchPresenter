import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import { logger } from '../logger'
import { databaseService } from '../db/database-service'
import { MediaItem, MediaType } from '../../shared/types'

export interface CompatibilityCheckResult {
  isCompatible: boolean
  container: string
  codec?: string
  warning?: string
}

export class MediaService {
  private mediaDir: string
  private videosDir: string
  private audiosDir: string
  private imagesDir: string
  private pdfsDir: string
  private thumbsDir: string

  constructor(customBasePath?: string) {
    if (customBasePath) {
      this.mediaDir = path.join(customBasePath, 'media')
    } else {
      try {
        const userData = app.getPath('userData')
        this.mediaDir = path.join(userData, 'media')
      } catch {
        this.mediaDir = path.resolve(process.cwd(), 'userData', 'media')
      }
    }

    this.videosDir = path.join(this.mediaDir, 'videos')
    this.audiosDir = path.join(this.mediaDir, 'audios')
    this.imagesDir = path.join(this.mediaDir, 'images')
    this.pdfsDir = path.join(this.mediaDir, 'pdfs')
    this.thumbsDir = path.join(this.mediaDir, 'thumbnails')
  }

  public initialize(): void {
    const dirs = [this.mediaDir, this.videosDir, this.audiosDir, this.imagesDir, this.pdfsDir, this.thumbsDir]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    logger.info(`MediaService initialized storage directory: ${this.mediaDir}`)
  }

  /**
   * Calculates deterministic SHA-256 hash of a file for deduplication.
   */
  public async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(filePath)
      stream.on('data', (data) => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', (err) => reject(err))
    })
  }

  /**
   * Determines media type category from file extension.
   */
  public detectMediaType(filePath: string): MediaType {
    const ext = path.extname(filePath).toLowerCase()
    const videoExts = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.m4v']
    const audioExts = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.wma']
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.pdf']

    if (videoExts.includes(ext)) return 'video'
    if (audioExts.includes(ext)) return 'audio'
    if (imageExts.includes(ext)) return 'image'
    return 'image'
  }

  /**
   * Checks container and codec compatibility with Chromium/Electron.
   * Warns clearly if format requires external conversion.
   */
  public checkFormatCompatibility(filePath: string): CompatibilityCheckResult {
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const nativeVideoContainers = ['mp4', 'webm']
    const nativeAudioContainers = ['mp3', 'wav', 'aac', 'm4a', 'ogg']
    const nativeImageContainers = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'pdf']

    if (nativeVideoContainers.includes(ext)) {
      return {
        isCompatible: true,
        container: ext.toUpperCase(),
        codec: ext === 'webm' ? 'VP8/VP9' : 'H.264/AAC'
      }
    }

    if (nativeAudioContainers.includes(ext)) {
      return {
        isCompatible: true,
        container: ext.toUpperCase(),
        codec: ext.toUpperCase()
      }
    }

    if (nativeImageContainers.includes(ext)) {
      return {
        isCompatible: true,
        container: ext.toUpperCase()
      }
    }

    // Problematic formats
    return {
      isCompatible: false,
      container: ext.toUpperCase(),
      warning: `El formato contenedor (.${ext}) puede no reproducirse fluidamente o carecer de soporte de códec nativo en Chromium. Se recomienda usar MP4 (H.264/AAC) o WebM.`
    }
  }

  /**
   * Imports a media file into the managed app storage with deduplication.
   */
  public async importMediaFile(sourcePath: string, tags: string[] = []): Promise<MediaItem> {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`El archivo de origen no existe: ${sourcePath}`)
    }

    const stat = fs.statSync(sourcePath)
    if (stat.isDirectory()) {
      throw new Error('La ruta especificada es un directorio, no un archivo de medios.')
    }

    const fileHash = await this.calculateFileHash(sourcePath)

    // Deduplication check: if file hash already exists, return existing item
    const existing = databaseService.getMediaItemByHash(fileHash)
    if (existing && fs.existsSync(existing.filePath)) {
      logger.info(`Deduplication: Media file already exists (hash: ${fileHash.substring(0, 10)}...), reusing ID ${existing.id}`)
      return existing
    }

    const originalName = path.basename(sourcePath)
    const ext = path.extname(sourcePath).toLowerCase()
    const mediaType = this.detectMediaType(sourcePath)

    let targetDir = this.imagesDir
    if (mediaType === 'video') targetDir = this.videosDir
    else if (mediaType === 'audio') targetDir = this.audiosDir
    else if (ext === '.pdf') targetDir = this.pdfsDir

    const id = `med_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const fileName = `${id}${ext}`
    const targetPath = path.join(targetDir, fileName)

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // Copy file to storage
    fs.copyFileSync(sourcePath, targetPath)

    const compat = this.checkFormatCompatibility(sourcePath)

    const mediaItem: MediaItem = {
      id,
      hash: fileHash,
      fileName,
      originalName,
      filePath: targetPath,
      mediaType,
      fileSize: stat.size,
      duration: 0,
      width: 0,
      height: 0,
      codec: compat.codec,
      container: compat.container,
      tags: tags || [],
      isMissing: false,
      createdAt: new Date().toISOString()
    }

    databaseService.insertMediaItem(mediaItem)
    logger.info(`Imported media item '${originalName}' (${mediaType}, ${stat.size} bytes) -> ID: ${id}`)
    return mediaItem
  }

  public getMediaItems(type?: MediaType): MediaItem[] {
    const items = databaseService.getMediaItems(type)
    // Check if files physically exist on disk
    return items.map((item) => ({
      ...item,
      isMissing: !fs.existsSync(item.filePath)
    }))
  }

  public async deleteMediaItem(id: string): Promise<boolean> {
    const item = databaseService.getMediaItemById(id)
    if (!item) return false

    databaseService.deleteMediaItem(id)

    // Check if other records use the same hash before unlinking file
    const sameHash = databaseService.getMediaItemByHash(item.hash)
    if (!sameHash && fs.existsSync(item.filePath)) {
      try {
        fs.unlinkSync(item.filePath)
      } catch (err) {
        logger.warn(`Could not delete physical media file: ${item.filePath}`, err)
      }
    }

    logger.info(`Deleted media item: ${id} (${item.originalName})`)
    return true
  }

  /**
   * Scans database media items and identifies missing or corrupt files.
   */
  public checkIntegrity(): { missingCount: number; missingIds: string[] } {
    const allItems = databaseService.getMediaItems()
    const missingIds: string[] = []

    for (const item of allItems) {
      if (!fs.existsSync(item.filePath)) {
        missingIds.push(item.id)
      } else {
        const stat = fs.statSync(item.filePath)
        if (stat.size === 0) {
          missingIds.push(item.id)
        }
      }
    }

    if (missingIds.length > 0) {
      logger.warn(`Media integrity check detected ${missingIds.length} missing/damaged file(s).`)
    }
    return {
      missingCount: missingIds.length,
      missingIds
    }
  }
}

export const mediaService = new MediaService()
