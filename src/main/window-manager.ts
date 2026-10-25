import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { DisplayInfo } from '../shared/types'
import { reconcileRoleAssignments } from '../shared/display-utils'
import { databaseService } from './db/database-service'
import { displayManager } from './display-manager'
import { stateManager } from './state-manager'
import { logger } from './logger'

export class WindowManager {
  private operatorWindow: BrowserWindow | null = null
  private outputWindows: Map<string, BrowserWindow> = new Map()
  private intentionallyClosedOutputs: Set<string> = new Set()
  private recreationTimeouts: Map<string, NodeJS.Timeout> = new Map()

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
        sandbox: false
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

  public syncOutputWindows(): void {
    const savedAssignments = databaseService.getRoleAssignments()
    const currentDisplays = displayManager.getDisplays()
    const reconciliation = reconcileRoleAssignments(savedAssignments, currentDisplays)

    // Log warnings if any screen was disconnected
    for (const warning of reconciliation.missingDisplayWarnings) {
      logger.warn(
        `Display ${warning.previousDisplayId} is missing. Role '${warning.role}' is now unassigned.`
      )
    }

    // Close windows for unassigned roles or roles whose screen was disconnected
    for (const [role, window] of this.outputWindows.entries()) {
      const assignedDisplayId = reconciliation.validAssignments[role]
      if (assignedDisplayId === null || assignedDisplayId === undefined) {
        logger.info(`Closing output window for unassigned role: ${role}`)
        this.intentionallyClosedOutputs.add(role)
        window.close()
        this.outputWindows.delete(role)
      }
    }

    // Open or update windows for validly assigned roles
    for (const [role, displayId] of Object.entries(reconciliation.validAssignments)) {
      if (displayId === null || displayId === undefined) continue
      const targetDisplay = displayManager.getDisplayById(displayId)
      if (!targetDisplay) continue

      const existingWindow = this.outputWindows.get(role)
      if (existingWindow && !existingWindow.isDestroyed()) {
        // Adjust bounds if physical screen metrics changed
        const currentBounds = existingWindow.getBounds()
        if (
          currentBounds.x !== targetDisplay.bounds.x ||
          currentBounds.y !== targetDisplay.bounds.y ||
          currentBounds.width !== targetDisplay.bounds.width ||
          currentBounds.height !== targetDisplay.bounds.height
        ) {
          logger.info(`Updating bounds for role '${role}' on display ${targetDisplay.id}`)
          existingWindow.setBounds(targetDisplay.bounds)
        }
      } else {
        // Create dedicated output window
        this.createOutputWindow(role, targetDisplay)
      }
    }
  }

  public createOutputWindow(role: string, targetDisplay: DisplayInfo): BrowserWindow {
    // If there's an existing window, close it first
    const existing = this.outputWindows.get(role)
    if (existing && !existing.isDestroyed()) {
      this.intentionallyClosedOutputs.add(role)
      existing.close()
    }

    this.intentionallyClosedOutputs.delete(role)

    logger.info(
      `Creating output window for role '${role}' on Display ${targetDisplay.id} (${targetDisplay.bounds.width}x${targetDisplay.bounds.height} at [${targetDisplay.bounds.x}, ${targetDisplay.bounds.y}])`
    )

    const win = new BrowserWindow({
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      width: targetDisplay.bounds.width,
      height: targetDisplay.bounds.height,
      frame: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      hasShadow: false,
      focusable: false,
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false // Keep full 60 FPS even when not focused
      }
    })

    win.setBounds(targetDisplay.bounds)
    win.setMenu(null)

    const route = `/output/${role}`
    const url = this.getRendererUrl(route)
    win.loadURL(url)

    win.once('ready-to-show', () => {
      win.setBounds(targetDisplay.bounds)
      win.showInactive()
      // Send current presentation state immediately
      win.webContents.send('state:updated', stateManager.getState())
    })

    // Robustness: Automatic recreation on crash
    win.webContents.on('render-process-gone', (_event, details) => {
      logger.error(
        `Output window for role '${role}' crashed! Reason: ${details.reason}, exitCode: ${details.exitCode}. Auto-recreating...`
      )
      this.outputWindows.delete(role)
      this.scheduleRecreation(role)
    })

    // Robustness: Automatic recreation on unexpected closure
    win.on('closed', () => {
      this.outputWindows.delete(role)
      if (!this.intentionallyClosedOutputs.has(role)) {
        logger.warn(
          `Output window for role '${role}' closed unexpectedly. Auto-recreating in 1s...`
        )
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
      const displayId = assignments[role]
      if (displayId !== null && displayId !== undefined) {
        const display = displayManager.getDisplayById(displayId)
        if (display) {
          logger.info(`Recreating output window for role '${role}' on display ${display.id}`)
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
        .filter(([_, id]) => id === display.id)
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
          contextIsolation: true
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

    // Close after exactly 3 seconds
    setTimeout(() => {
      for (const win of identifyWindows) {
        if (!win.isDestroyed()) {
          win.close()
        }
      }
    }, 3000)
  }

  public broadcastToAll(channel: string, ...args: any[]): void {
    if (this.operatorWindow && !this.operatorWindow.isDestroyed()) {
      this.operatorWindow.webContents.send(channel, ...args)
    }
    for (const win of this.outputWindows.values()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args)
      }
    }
  }

  public closeAllOutputWindows(): void {
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
