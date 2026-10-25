import { BrowserWindow, screen, shell } from 'electron'
import path from 'path'
import { DisplayInfo, AppNotification } from '../shared/types'
import { reconcileRoleAssignments, matchDisplayByStableId } from '../shared/display-utils'
import { databaseService } from './db/database-service'
import { displayManager } from './display-manager'
import { stateManager } from './state-manager'
import { logger } from './logger'
import { IPC_CHANNELS } from '../shared/ipc-events'

export class WindowManager {
  private operatorWindow: BrowserWindow | null = null
  private floatingPreviewWindow: BrowserWindow | null = null
  private outputWindows: Map<string, BrowserWindow> = new Map()
  private intentionallyClosedOutputs: Set<string> = new Set()
  private recreationTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private previouslyDisconnectedRoles: Set<string> = new Set()

  private getPreloadPath(): string {
    return path.join(__dirname, '../preload/index.js')
  }

  private getRendererUrl(route: string): string {
    if (process.env['ELECTRON_RENDERER_URL']) {
      return `${process.env['ELECTRON_RENDERER_URL']}#${route}`
    }
    return `file://${path.join(__dirname, '../renderer/index.html')}#${route}`
  }

  public createOperatorWindow(): BrowserWindow {
    if (this.operatorWindow && !this.operatorWindow.isDestroyed()) {
      this.operatorWindow.focus()
      return this.operatorWindow
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const width = Math.min(1440, Math.floor(primaryDisplay.workArea.width * 0.9))
    const height = Math.min(900, Math.floor(primaryDisplay.workArea.height * 0.9))

    this.operatorWindow = new BrowserWindow({
      title: 'ChurchPresenter - Panel del Operador',
      width,
      height,
      minWidth: 1024,
      minHeight: 700,
      backgroundColor: '#18191c',
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    })

    const url = this.getRendererUrl('/operator')
    logger.info(`Loading Operator Window from: ${url}`)
    this.operatorWindow.loadURL(url)

    this.operatorWindow.on('closed', () => {
      this.operatorWindow = null
      logger.info('Operator window closed. Terminating active outputs.')
      this.closeAllOutputWindows()
    })

    return this.operatorWindow
  }

  public getOperatorWindow(): BrowserWindow | null {
    return this.operatorWindow
  }

  public getOutputWindows(): Map<string, BrowserWindow> {
    return this.outputWindows
  }

  public syncOutputWindows(): void {
    const savedAssignments = databaseService.getRoleAssignments()
    const currentDisplays = displayManager.getDisplays()
    const reconciliation = reconcileRoleAssignments(savedAssignments, currentDisplays, {
      previouslyDisconnected: Array.from(this.previouslyDisconnectedRoles)
    })

    // Handle missing displays (do NOT delete saved assignment, just close window & notify)
    for (const [role, stableId] of Object.entries(reconciliation.disconnectedRoles)) {
      if (!this.previouslyDisconnectedRoles.has(role)) {
        this.previouslyDisconnectedRoles.add(role)
        logger.warn(`Display '${stableId}' is disconnected. Role '${role}' is marked offline.`)

        this.emitNotification({
          id: `disc_${role}_${Date.now()}`,
          title: 'Pantalla Desconectada',
          message: `La pantalla para el rol '${role}' se ha desconectado. La asignación se mantiene guardada.`,
          type: 'warn',
          timestamp: Date.now()
        })
      }

      // Close output window if it was open
      const existingWin = this.outputWindows.get(role)
      if (existingWin && !existingWin.isDestroyed()) {
        this.intentionallyClosedOutputs.add(role)
        existingWin.close()
        this.outputWindows.delete(role)
      }
    }

    // Handle reconnected displays (restore automatically)
    for (const role of reconciliation.reconnectedRoles) {
      this.previouslyDisconnectedRoles.delete(role)
      logger.info(`Known display reconnected for role '${role}'! Restoring output window...`)

      this.emitNotification({
        id: `reconn_${role}_${Date.now()}`,
        title: 'Pantalla Reconectada',
        message: `Se ha detectado de nuevo la pantalla para '${role}'. Salida restaurada automáticamente.`,
        type: 'success',
        timestamp: Date.now()
      })
    }

    // Close windows for explicitly unassigned roles
    for (const role of reconciliation.unassignedRoles) {
      this.previouslyDisconnectedRoles.delete(role)
      const existingWin = this.outputWindows.get(role)
      if (existingWin && !existingWin.isDestroyed()) {
        this.intentionallyClosedOutputs.add(role)
        existingWin.close()
        this.outputWindows.delete(role)
      }
    }

    // Open or reposition windows for active valid assignments
    for (const [role, assignedStableId] of Object.entries(reconciliation.activeAssignments)) {
      if (!assignedStableId) continue
      const targetDisplay = matchDisplayByStableId(assignedStableId, currentDisplays)
      if (!targetDisplay) continue

      const existingWindow = this.outputWindows.get(role)
      if (existingWindow && !existingWindow.isDestroyed()) {
        const currentBounds = existingWindow.getBounds()
        if (
          currentBounds.x !== targetDisplay.bounds.x ||
          currentBounds.y !== targetDisplay.bounds.y ||
          currentBounds.width !== targetDisplay.bounds.width ||
          currentBounds.height !== targetDisplay.bounds.height
        ) {
          logger.info(`Repositioning output window for role '${role}' to [${targetDisplay.bounds.x}, ${targetDisplay.bounds.y}]`)
          existingWindow.setBounds(targetDisplay.bounds)
        }
      } else {
        this.createOutputWindow(role, targetDisplay)
      }
    }
  }

  public createOutputWindow(role: string, targetDisplay: DisplayInfo): BrowserWindow {
    const existing = this.outputWindows.get(role)
    if (existing && !existing.isDestroyed()) {
      this.intentionallyClosedOutputs.add(role)
      existing.close()
    }

    this.intentionallyClosedOutputs.delete(role)

    logger.info(
      `Creating dedicated output window for role '${role}' on display '${targetDisplay.name}' at bounds: ${JSON.stringify(targetDisplay.bounds)}`
    )

    // Dedicated output window options
    // Crucial: strictly positioned on target display bounds; never covers operator window
    const win = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      frame: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: process.env.NODE_ENV !== 'test',
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      hasShadow: false,
      focusable: false,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false // Always render at 60 FPS even when unfocused or covered
      }
    })

    win.setBounds(targetDisplay.bounds)
    win.setMenu(null)

    const route = `/output/${role}`
    const url = this.getRendererUrl(route)
    win.loadURL(url)

    win.once('ready-to-show', () => {
      win.setBounds(targetDisplay.bounds)
      // showInactive ensures the operator window retains keyboard focus
      win.showInactive()
      win.webContents.send('state:updated', stateManager.getState())
    })

    // Auto-recreation on unexpected renderer crash
    win.webContents.on('render-process-gone', (_event, details) => {
      logger.error(
        `Output window for role '${role}' crashed! Reason: ${details.reason}, exitCode: ${details.exitCode}. Auto-recreating...`
      )
      this.outputWindows.delete(role)
      this.scheduleRecreation(role)
    })

    // Auto-recreation on unexpected window closure
    win.on('closed', () => {
      this.outputWindows.delete(role)
      if (!this.intentionallyClosedOutputs.has(role)) {
        logger.warn(`Output window for role '${role}' closed unexpectedly. Auto-recreating in 1s...`)
        this.scheduleRecreation(role)
      } else {
        this.intentionallyClosedOutputs.delete(role)
      }
    })

    this.outputWindows.set(role, win)
    return win
  }

  private scheduleRecreation(role: string): void {
    if (this.recreationTimeouts.has(role)) {
      clearTimeout(this.recreationTimeouts.get(role)!)
    }

    const timer = setTimeout(() => {
      this.recreationTimeouts.delete(role)
      const assignments = databaseService.getRoleAssignments()
      const stableId = assignments[role]
      if (stableId) {
        const display = matchDisplayByStableId(stableId, displayManager.getDisplays())
        if (display) {
          logger.info(`Recreating output window for role '${role}' on display ${display.name}`)
          this.createOutputWindow(role, display)
        }
      }
    }, 1000)

    this.recreationTimeouts.set(role, timer)
  }

  public identifyDisplays(): void {
    logger.info('Triggering identify displays overlay (3 seconds)...')
    const allDisplays = displayManager.getDisplays()
    const assignments = databaseService.getRoleAssignments()
    const identifyWindows: BrowserWindow[] = []

    for (const display of allDisplays) {
      // Find roles mapped to this display
      const rolesForDisplay = Object.entries(assignments)
        .filter(([_, id]) => id === display.stableId)
        .map(([role]) => role.toUpperCase())

      const rolesText = rolesForDisplay.length > 0 ? rolesForDisplay.join(', ') : 'SIN ROL'

      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        backgroundColor: '#00000000',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      })

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              background: rgba(0, 0, 0, 0.75);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: white;
              user-select: none;
              overflow: hidden;
            }
            .badge {
              background: rgba(30, 41, 59, 0.95);
              border: 4px solid #3b82f6;
              box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 50px rgba(59, 130, 246, 0.5);
              border-radius: 24px;
              padding: 40px 60px;
              text-align: center;
              animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes popIn {
              from { transform: scale(0.85); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .number {
              font-size: 80px;
              font-weight: 900;
              color: #60a5fa;
              line-height: 1;
              margin-bottom: 12px;
            }
            .title {
              font-size: 32px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .roles {
              display: inline-block;
              background: #1e40af;
              color: #dbeafe;
              padding: 8px 18px;
              border-radius: 9999px;
              font-size: 20px;
              font-weight: 600;
              letter-spacing: 0.05em;
              margin-top: 10px;
            }
            .res {
              font-size: 18px;
              color: #94a3b8;
              margin-top: 12px;
            }
          </style>
        </head>
        <body>
          <div class="badge">
            <div class="number">#${display.id}</div>
            <div class="title">${display.name}</div>
            <div class="roles">ROL: ${rolesText}</div>
            <div class="res">${display.bounds.width} x ${display.bounds.height} | Escala: ${display.scaleFactor * 100}%</div>
          </div>
        </body>
        </html>
      `

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      win.showInactive()
      identifyWindows.push(win)
    }

    setTimeout(() => {
      for (const win of identifyWindows) {
        if (!win.isDestroyed()) {
          win.close()
        }
      }
    }, 3000)
  }

  public emitNotification(notif: AppNotification): void {
    this.broadcastToAll(IPC_CHANNELS.NOTIFICATION_EMIT, notif)
  }

  public openBackupsFolder(): void {
    const backupsDir = databaseService.getBackupsDirectory()
    shell.openPath(backupsDir)
  }

  public broadcastToAll(channel: string, ...args: any[]): void {
    if (this.operatorWindow && !this.operatorWindow.isDestroyed()) {
      this.operatorWindow.webContents.send(channel, ...args)
    }
    if (this.floatingPreviewWindow && !this.floatingPreviewWindow.isDestroyed()) {
      this.floatingPreviewWindow.webContents.send(channel, ...args)
    }
    for (const win of this.outputWindows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args)
      }
    }
  }

  public openFloatingPreviewWindow(initialRole: string = 'main'): BrowserWindow {
    if (this.floatingPreviewWindow && !this.floatingPreviewWindow.isDestroyed()) {
      this.floatingPreviewWindow.focus()
      return this.floatingPreviewWindow
    }

    this.floatingPreviewWindow = new BrowserWindow({
      title: 'ChurchPresenter - Vista Previa Flotante',
      width: 760,
      height: 480,
      minWidth: 400,
      minHeight: 260,
      backgroundColor: '#0a0a0a',
      autoHideMenuBar: true,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    })

    const url = this.getRendererUrl(`/floating-preview?role=${encodeURIComponent(initialRole)}`)
    logger.info(`Opening floating preview window from: ${url}`)
    this.floatingPreviewWindow.loadURL(url)

    this.floatingPreviewWindow.on('closed', () => {
      this.floatingPreviewWindow = null
    })

    return this.floatingPreviewWindow
  }

  public setFloatingPreviewAlwaysOnTop(alwaysOnTop: boolean): boolean {
    if (this.floatingPreviewWindow && !this.floatingPreviewWindow.isDestroyed()) {
      this.floatingPreviewWindow.setAlwaysOnTop(alwaysOnTop)
      return true
    }
    return false
  }

  public closeFloatingPreviewWindow(): void {
    if (this.floatingPreviewWindow && !this.floatingPreviewWindow.isDestroyed()) {
      this.floatingPreviewWindow.close()
      this.floatingPreviewWindow = null
    }
  }

  public async captureOutputWindow(role: string): Promise<Buffer | null> {
    const win = this.outputWindows.get(role)
    if (!win || win.isDestroyed()) return null
    try {
      const img = await win.capturePage()
      return img.toPNG()
    } catch (err) {
      logger.error(`Failed to capture output window for role '${role}':`, err)
      return null
    }
  }

  public closeAllOutputWindows(): void {
    this.closeFloatingPreviewWindow()
    for (const [role, win] of this.outputWindows.entries()) {
      this.intentionallyClosedOutputs.add(role)
      if (!win.isDestroyed()) {
        win.close()
      }
    }
    this.outputWindows.clear()
  }
}

export const windowManager = new WindowManager()
