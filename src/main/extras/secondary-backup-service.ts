import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { databaseService } from '../db/database-service'
import { SecondaryBackupConfig, SecondaryBackupStatus } from '../../shared/types'
import { logger } from '../logger'

export class SecondaryBackupService {
  public getConfig(): SecondaryBackupConfig {
    return databaseService.getSecondaryBackupConfig()
  }

  public saveConfig(config: Partial<SecondaryBackupConfig>): SecondaryBackupConfig {
    return databaseService.saveSecondaryBackupConfig(config)
  }

  /**
   * Copies the latest (or specified) local backup database to the configured secondary folder / USB,
   * verifying integrity via SHA-256 checksum comparison.
   */
  public async runSecondaryBackup(sourceFilePath?: string): Promise<SecondaryBackupStatus> {
    const config = this.getConfig()

    if (!config.targetDirectory) {
      return {
        success: false,
        verified: false,
        errorMessage: 'No se ha configurado la carpeta secundaria o unidad USB de respaldo.'
      }
    }

    try {
      let source = sourceFilePath

      if (!source) {
        const backupsDir = databaseService.getBackupsDirectory()
        if (!fs.existsSync(backupsDir)) {
          return {
            success: false,
            verified: false,
            errorMessage: 'El directorio local de copias de seguridad no existe.'
          }
        }

        const files = fs
          .readdirSync(backupsDir)
          .filter((f) => f.endsWith('.sqlite'))
          .map((f) => ({
            name: f,
            fullPath: path.join(backupsDir, f),
            mtime: fs.statSync(path.join(backupsDir, f)).mtimeMs
          }))
          .sort((a, b) => b.mtime - a.mtime)

        if (files.length === 0) {
          // If no backups exist yet, create an on-demand backup
          const fresh = databaseService.createBackup('manual_secondary')
          if (!fresh) {
            return {
              success: false,
              verified: false,
              errorMessage: 'No hay copias de seguridad locales disponibles y no se pudo generar una nueva.'
            }
          }
          source = fresh
        } else {
          source = files[0].fullPath
        }
      }

      if (!fs.existsSync(source)) {
        return {
          success: false,
          verified: false,
          errorMessage: `El archivo origen de copia de seguridad no existe: ${source}`
        }
      }

      // Ensure target directory exists
      if (!fs.existsSync(config.targetDirectory)) {
        fs.mkdirSync(config.targetDirectory, { recursive: true })
      }

      const filename = path.basename(source)
      const targetPath = path.join(config.targetDirectory, filename)

      // Copy file
      fs.copyFileSync(source, targetPath)

      let verified = true
      if (config.verifyIntegrity) {
        const sourceHash = this.computeSha256(source)
        const targetHash = this.computeSha256(targetPath)

        if (sourceHash !== targetHash) {
          verified = false
          try {
            fs.unlinkSync(targetPath)
          } catch {
            // ignore
          }
          logger.error(`Secondary backup integrity verification failed for ${filename}`)
          return {
            success: false,
            verified: false,
            errorMessage: 'La verificación de integridad SHA-256 falló: los datos no coinciden.'
          }
        }
      }

      logger.info(`Secondary backup succeeded: copied ${filename} to ${targetPath} (verified: ${verified})`)
      return {
        success: true,
        verified,
        lastBackupTime: new Date().toISOString(),
        lastBackupFilename: filename
      }
    } catch (err: any) {
      logger.error('Secondary backup failed:', err)
      return {
        success: false,
        verified: false,
        errorMessage: err?.message || String(err)
      }
    }
  }

  private computeSha256(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath)
    return crypto.createHash('sha256').update(fileBuffer).digest('hex')
  }
}

export const secondaryBackupService = new SecondaryBackupService()
