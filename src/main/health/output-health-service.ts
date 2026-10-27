import { EventEmitter } from 'events'
import { BrowserWindow, app } from 'electron'
import { logger } from '../logger'
import { OutputHealthStatus, OutputIncident } from '../../shared/types'
import { displayManager } from '../display-manager'
import { databaseService } from '../db/database-service'

export class OutputHealthService extends EventEmitter {
  private statuses: Record<string, OutputHealthStatus> = {}
  private pollInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.initRole('main')
    this.initRole('stage')
    this.initRole('lobby')
  }

  private initRole(role: string): void {
    if (!this.statuses[role]) {
      this.statuses[role] = {
        role,
        displayConnected: false,
        windowAlive: false,
        fps: 60,
        lastFrameTimestamp: Date.now(),
        memoryUsageMb: 0,
        recentErrors: [],
        incidents: [],
        status: 'healthy'
      }
    }
  }

  public initialize(getWindowsMap: () => Map<string, BrowserWindow>): void {
    if (this.pollInterval) clearInterval(this.pollInterval)

    this.pollInterval = setInterval(async () => {
      await this.refreshStatuses(getWindowsMap)
    }, 2000)

    logger.info('OutputHealthService initialized.')
  }

  public recordHeartbeat(role: string, fps: number, timestamp: number, lastError?: string): void {
    this.initRole(role)
    const s = this.statuses[role]
    s.fps = fps
    s.lastFrameTimestamp = timestamp

    if (lastError) {
      s.recentErrors.unshift({ timestamp, message: lastError })
      if (s.recentErrors.length > 20) s.recentErrors.pop()
    }

    if (fps < 30) {
      this.recordIncident(role, 'fps_drop', `Baja de tasa de cuadros: ${fps.toFixed(1)} FPS`)
    }

    this.recomputeStatus(role)
    this.emit('health-changed', this.getStatuses())
  }

  public recordIncident(
    role: string,
    type: 'crash' | 'disconnect' | 'fps_drop' | 'recreation' | 'error',
    details: string
  ): void {
    this.initRole(role)
    const incident: OutputIncident = {
      timestamp: Date.now(),
      type,
      details
    }

    this.statuses[role].incidents.unshift(incident)
    if (this.statuses[role].incidents.length > 50) {
      this.statuses[role].incidents.pop()
    }

    logger.warn(`[OutputHealth] Incident recorded for role '${role}': [${type}] ${details}`)
    this.recomputeStatus(role)
    this.emit('health-changed', this.getStatuses())
  }

  public async refreshStatuses(getWindowsMap: () => Map<string, BrowserWindow>): Promise<void> {
    const assignments = databaseService.getRoleAssignments()
    const currentDisplays = displayManager.getDisplays()
    const windows = getWindowsMap()

    for (const role of ['main', 'stage', 'lobby']) {
      this.initRole(role)
      const s = this.statuses[role]
      const assignedStableId = assignments[role]

      s.displayConnected = Boolean(
        assignedStableId && currentDisplays.some((d) => d.stableId === assignedStableId || String(d.id) === assignedStableId)
      )

      const win = windows.get(role)
      s.windowAlive = Boolean(win && !win.isDestroyed())

      if (win && !win.isDestroyed()) {
        try {
          const pid = win.webContents.getOSProcessId()
          const metrics = app.getAppMetrics ? app.getAppMetrics() : []
          const found = metrics.find((m) => m.pid === pid)
          if (found && found.memory) {
            s.memoryUsageMb = Math.round(found.memory.workingSetSize / 1024)
          } else {
            s.memoryUsageMb = 85
          }
        } catch {
          s.memoryUsageMb = 85
        }
      } else {
        s.memoryUsageMb = 0
      }

      this.recomputeStatus(role)
    }

    this.emit('health-changed', this.getStatuses())
  }

  private recomputeStatus(role: string): void {
    const s = this.statuses[role]
    const assignments = databaseService.getRoleAssignments()
    const isAssigned = Boolean(assignments[role])

    if (!isAssigned) {
      s.status = 'healthy' // Not used / unassigned is fine
      return
    }

    if (!s.displayConnected || (s.windowAlive === false && isAssigned)) {
      s.status = 'error'
    } else if (s.fps < 40 || s.recentErrors.length > 0 || (Date.now() - s.lastFrameTimestamp > 4000 && s.windowAlive)) {
      s.status = 'warning'
    } else {
      s.status = 'healthy'
    }
  }

  public getStatuses(): Record<string, OutputHealthStatus> {
    return { ...this.statuses }
  }

  public destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}

export const outputHealthService = new OutputHealthService()
