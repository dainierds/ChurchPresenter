import fs from 'fs'
import path from 'path'
import { app, dialog, shell, BrowserWindow } from 'electron'
import { logger } from '../logger'
import { databaseService, DatabaseService } from '../db/database-service'

export interface WorkspaceInfo {
  rootPath: string
  subfolders: string[]
}

export const WORKSPACE_SUBFOLDERS = [
  'Videos',
  'Imágenes',
  'Audios',
  'Cuentas Regresivas',
  'Presentaciones',
  'Documentos PDF',
  'Canciones',
  'Biblias',
  'Cultos',
  'Copias de Seguridad'
] as const

const SUBFOLDER_DESCRIPTIONS: Record<string, string> = {
  Videos: 'Coloque aquí sus fondos de video, clips y videos para proyectar.',
  'Imágenes': 'Coloque aquí sus fondos de imagen fija, fotos y gráficos.',
  Audios: 'Coloque aquí su música ambiental, pistas y efectos de sonido.',
  'Cuentas Regresivas': 'Coloque aquí videos o clips de conteo regresivo previo al culto.',
  Presentaciones: 'Coloque aquí sus archivos de PowerPoint (.pptx, .ppt) para importar.',
  'Documentos PDF': 'Coloque aquí sus documentos PDF, partituras o guiones de servicio.',
  Canciones: 'Coloque aquí archivos de letras para importar (.txt, .cho, .xml, .csv).',
  Biblias: 'Coloque aquí versiones o módulos de la Biblia para importar.',
  Cultos: 'Carpeta destinada a planes y listas de culto exportadas (.cpr / .json).',
  'Copias de Seguridad': 'Carpeta de respaldos periódicos y copias de seguridad de la base de datos.'
}

export class WorkspaceService {
  private customRootPath: string | null = null
  private db: DatabaseService

  constructor(db?: DatabaseService) {
    this.db = db || databaseService
  }

  public getDefaultWorkspacePath(): string {
    try {
      const docs = app.getPath('documents')
      return path.join(docs, 'ChurchPresenter')
    } catch {
      return path.resolve(process.cwd(), 'ChurchPresenter')
    }
  }

  public getWorkspacePath(): string {
    if (this.customRootPath) {
      return this.customRootPath
    }
    const configured = this.db.getConfig('user_workspace_directory')
    if (configured && configured.trim().length > 0) {
      return configured.trim()
    }
    return this.getDefaultWorkspacePath()
  }

  public getInfo(): WorkspaceInfo {
    const rootPath = this.getWorkspacePath()
    return {
      rootPath,
      subfolders: [...WORKSPACE_SUBFOLDERS]
    }
  }

  public ensureWorkspaceFolders(targetPath?: string): WorkspaceInfo {
    const root = targetPath || this.getWorkspacePath()

    try {
      if (!fs.existsSync(root)) {
        fs.mkdirSync(root, { recursive: true })
        logger.info(`[WorkspaceService] Created workspace root directory: ${root}`)
      }

      for (const folderName of WORKSPACE_SUBFOLDERS) {
        const fullSubfolderPath = path.join(root, folderName)
        if (!fs.existsSync(fullSubfolderPath)) {
          fs.mkdirSync(fullSubfolderPath, { recursive: true })
          logger.info(`[WorkspaceService] Auto-created section folder: ${folderName}`)
        }

        const readmePath = path.join(fullSubfolderPath, '_LEAME.txt')
        if (!fs.existsSync(readmePath)) {
          const desc = SUBFOLDER_DESCRIPTIONS[folderName] || 'Carpeta de sección de ChurchPresenter.'
          try {
            fs.writeFileSync(
              readmePath,
              `ChurchPresenter - Sección: ${folderName}\n\n${desc}\n`,
              'utf-8'
            )
          } catch {
            // Ignore write errors on readme
          }
        }
      }
    } catch (err) {
      logger.error(`[WorkspaceService] Error ensuring workspace folders at ${root}:`, err)
    }

    return {
      rootPath: root,
      subfolders: [...WORKSPACE_SUBFOLDERS]
    }
  }

  public setWorkspacePath(newPath: string): WorkspaceInfo {
    const cleanPath = path.resolve(newPath.trim())
    this.db.setConfig('user_workspace_directory', cleanPath)
    this.customRootPath = cleanPath
    logger.info(`[WorkspaceService] Workspace directory updated to: ${cleanPath}`)
    return this.ensureWorkspaceFolders(cleanPath)
  }

  public async chooseWorkspaceFolder(parentWin?: BrowserWindow | null): Promise<WorkspaceInfo | null> {
    const current = this.getWorkspacePath()
    const result = await dialog.showOpenDialog(parentWin || undefined as any, {
      title: 'Seleccionar Carpeta Principal de ChurchPresenter (Biblioteca y Medios)',
      defaultPath: fs.existsSync(current) ? current : this.getDefaultWorkspacePath(),
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled || !result.filePaths.length) {
      return null
    }

    const selected = result.filePaths[0]
    return this.setWorkspacePath(selected)
  }

  public async openWorkspaceFolder(subfolderName?: string): Promise<boolean> {
    const root = this.getWorkspacePath()
    this.ensureWorkspaceFolders(root)

    let target = root
    if (subfolderName) {
      const match = WORKSPACE_SUBFOLDERS.find(
        (sf) => sf.toLowerCase() === subfolderName.toLowerCase()
      )
      if (match) {
        target = path.join(root, match)
      } else {
        target = path.join(root, subfolderName)
      }
    }

    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true })
    }

    const res = await shell.openPath(target)
    if (res) {
      logger.warn(`[WorkspaceService] shell.openPath returned warning for ${target}: ${res}`)
      return false
    }
    return true
  }

  public initialize(): void {
    const root = this.getWorkspacePath()
    this.ensureWorkspaceFolders(root)
    logger.info(`[WorkspaceService] Initialized at: ${root}`)
  }

  public async saveChurchLogoFile(sourcePath?: string): Promise<{ success: boolean; filePath?: string; url?: string; error?: string }> {
    let chosenPath = sourcePath
    if (!chosenPath) {
      const parent = BrowserWindow.getFocusedWindow() || undefined
      const result = await dialog.showOpenDialog(parent as any, {
        title: 'Seleccionar Logo de la Iglesia',
        filters: [
          { name: 'Imágenes de Logo', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }
        ],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Selección cancelada' }
      }
      chosenPath = result.filePaths[0]
    }

    if (!fs.existsSync(chosenPath)) {
      return { success: false, error: 'El archivo seleccionado no existe' }
    }

    const ext = path.extname(chosenPath).toLowerCase()
    const targetDir = path.join(this.getWorkspacePath(), 'Imágenes')
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const targetFileName = `church_logo_${Date.now()}${ext}`
    const targetPath = path.join(targetDir, targetFileName)

    try {
      fs.copyFileSync(chosenPath, targetPath)
      logger.info(`[WorkspaceService] Church logo saved to: ${targetPath}`)
      return {
        success: true,
        filePath: targetPath,
        url: targetPath
      }
    } catch (err: any) {
      logger.error('Failed to copy church logo file:', err)
      return { success: false, error: err.message || 'Error al guardar archivo' }
    }
  }

  public async saveChurchBackgroundFile(sourcePath?: string): Promise<{ success: boolean; filePath?: string; url?: string; fileType?: 'image' | 'video'; error?: string }> {
    let chosenPath = sourcePath
    if (!chosenPath) {
      const parent = BrowserWindow.getFocusedWindow() || undefined
      const result = await dialog.showOpenDialog(parent as any, {
        title: 'Seleccionar Fondo de la Iglesia (Imagen o Video)',
        filters: [
          { name: 'Fondos Multimedia', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov'] }
        ],
        properties: ['openFile']
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Selección cancelada' }
      }
      chosenPath = result.filePaths[0]
    }

    if (!fs.existsSync(chosenPath)) {
      return { success: false, error: 'El archivo seleccionado no existe' }
    }

    const ext = path.extname(chosenPath).toLowerCase()
    const isVideo = ['.mp4', '.webm', '.mov'].includes(ext)
    const subfolder = isVideo ? 'Videos' : 'Imágenes'
    const targetDir = path.join(this.getWorkspacePath(), subfolder)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const targetFileName = `church_bg_${Date.now()}${ext}`
    const targetPath = path.join(targetDir, targetFileName)

    try {
      fs.copyFileSync(chosenPath, targetPath)
      logger.info(`[WorkspaceService] Church background (${subfolder}) saved to: ${targetPath}`)
      return {
        success: true,
        filePath: targetPath,
        url: targetPath,
        fileType: isVideo ? 'video' : 'image'
      }
    } catch (err: any) {
      logger.error('Failed to copy church background file:', err)
      return { success: false, error: err.message || 'Error al guardar fondo' }
    }
  }
}

export const workspaceService = new WorkspaceService()
