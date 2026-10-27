import fs from 'fs'
import path from 'path'
import os from 'os'
import { app, dialog } from 'electron'
import AdmZip from 'adm-zip'
import { logger } from '../logger'
import { LogEntry } from '../../shared/types'
import { displayManager } from '../display-manager'
import { databaseService } from '../db/database-service'
import { outputHealthService } from '../health/output-health-service'
import { stageLayoutService } from '../stage/stage-layout-service'

export class DiagnosticsService {
  private getLogFilePath(): string {
    const userData =
      app && typeof app.getPath === 'function' ? app.getPath('userData') : os.tmpdir()
    return path.join(userData, 'logs', 'church-presenter.log')
  }

  public async getLogs(options?: {
    filterLevel?: string
    query?: string
    limit?: number
  }): Promise<LogEntry[]> {
    const logFile = this.getLogFilePath()
    if (!fs.existsSync(logFile)) {
      return []
    }

    try {
      const content = await fs.promises.readFile(logFile, 'utf-8')
      const lines = content.split('\n')
      const entries: LogEntry[] = []

      const targetLevel = options?.filterLevel?.toLowerCase() || 'all'
      const targetQuery = options?.query?.toLowerCase() || ''
      const maxLimit = options?.limit || 300

      // Read from end towards beginning
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim()
        if (!line) continue

        // Format: [YYYY-MM-DD HH:mm:ss.SSS] [level] text
        const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/)
        if (match) {
          const timestamp = match[1]
          const levelStr = match[2].toLowerCase()
          const message = match[3]

          const level: LogEntry['level'] =
            levelStr === 'error'
              ? 'error'
              : levelStr === 'warn'
              ? 'warn'
              : levelStr === 'debug'
              ? 'debug'
              : 'info'

          if (targetLevel !== 'all' && level !== targetLevel) continue
          if (targetQuery && !line.toLowerCase().includes(targetQuery)) continue

          entries.push({ timestamp, level, message })
          if (entries.length >= maxLimit) break
        } else {
          // Continuation or raw line
          if (targetLevel === 'all' && (!targetQuery || line.toLowerCase().includes(targetQuery))) {
            entries.push({ timestamp: '', level: 'info', message: line })
            if (entries.length >= maxLimit) break
          }
        }
      }

      return entries
    } catch (err) {
      logger.error('Error reading logs for diagnostics:', err)
      return []
    }
  }

  public async exportDiagnosticsZip(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      logger.info('Creating diagnostics ZIP bundle...')
      const zip = new AdmZip()

      // 1. Logs
      const logFile = this.getLogFilePath()
      if (fs.existsSync(logFile)) {
        zip.addLocalFile(logFile, 'logs')
      }

      // Rehearsal logs if any
      const rehearsalLogsDir = path.join(app.getPath('userData'), 'logs')
      if (fs.existsSync(rehearsalLogsDir)) {
        const allFiles = fs.readdirSync(rehearsalLogsDir)
        for (const f of allFiles) {
          if (f.startsWith('rehearsal-') && f.endsWith('.log')) {
            zip.addLocalFile(path.join(rehearsalLogsDir, f), 'logs')
          }
        }
      }

      // 2. System Information
      let gpuStatus: any = {}
      try {
        gpuStatus = app.getGPUFeatureStatus()
      } catch {
        // ignore
      }

      const systemInfo = {
        appVersion: app.getVersion(),
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        osRelease: os.release(),
        cpuModel: os.cpus()?.[0]?.model || 'Unknown',
        cpuCores: os.cpus()?.length || 0,
        totalMemoryGb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
        freeMemoryGb: Math.round(os.freemem() / (1024 * 1024 * 1024)),
        gpuStatus,
        generatedAt: new Date().toISOString()
      }
      zip.addFile('system-info.json', Buffer.from(JSON.stringify(systemInfo, null, 2), 'utf-8'))

      // 3. Displays Configuration
      const displays = displayManager.getDisplays()
      const assignments = databaseService.getRoleAssignments()
      zip.addFile(
        'displays.json',
        Buffer.from(JSON.stringify({ displays, assignments }, null, 2), 'utf-8')
      )

      // 4. Output Health Statuses
      const outputHealth = outputHealthService.getStatuses()
      zip.addFile('output-health.json', Buffer.from(JSON.stringify(outputHealth, null, 2), 'utf-8'))

      // 5. Sanitized Configuration (No secrets, tokens or PINs!)
      const sanitizedConfig: Record<string, any> = {
        roles: assignments,
        stageLayoutAssignments: stageLayoutService.getStageLayoutAssignments()
      }
      zip.addFile('config-sanitized.json', Buffer.from(JSON.stringify(sanitizedConfig, null, 2), 'utf-8'))

      // Prompt user or write to desktop/downloads
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const defaultFileName = `diagnostico-church-presenter-${timestamp}.zip`

      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Exportar Diagnóstico de ChurchPresenter',
        defaultPath: path.join(app.getPath('downloads'), defaultFileName),
        filters: [{ name: 'Archivo ZIP', extensions: ['zip'] }]
      })

      if (canceled || !filePath) {
        return { success: false, error: 'Exportación cancelada por el usuario.' }
      }

      zip.writeZip(filePath)
      logger.info(`Diagnostics ZIP exported successfully to: ${filePath}`)
      return { success: true, filePath }
    } catch (err: any) {
      logger.error('Failed to export diagnostics ZIP:', err)
      return { success: false, error: err.message || 'Error desconocido al crear archivo ZIP' }
    }
  }
}

export const diagnosticsService = new DiagnosticsService()
