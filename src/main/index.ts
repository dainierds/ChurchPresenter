import { app, globalShortcut } from 'electron'
import { setupLogger, logger } from './logger'
import { databaseService } from './db/database-service'
import { displayManager } from './display-manager'
import { windowManager } from './window-manager'
import { stateManager } from './state-manager'
import { registerIpcHandlers } from './ipc-handlers'

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const opWin = windowManager.getOperatorWindow()
    if (opWin) {
      if (opWin.isMinimized()) opWin.restore()
      opWin.focus()
    }
  })
}

// Security: Disallow remote navigation and new windows creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, navigationUrl) => {
    const isDevUrl = process.env['ELECTRON_RENDERER_URL'] && navigationUrl.startsWith(process.env['ELECTRON_RENDERER_URL'])
    const isFileUrl = navigationUrl.startsWith('file://')
    if (!isDevUrl && !isFileUrl) {
      event.preventDefault()
      logger.warn(`Blocked navigation attempt to unauthorized URL: ${navigationUrl}`)
    }
  })
})

async function initializeApp() {
  setupLogger()
  logger.info('ChurchPresenter starting up...')

  try {
    await databaseService.initialize()
    logger.info('Database initialized.')

    displayManager.initialize()
    logger.info('DisplayManager initialized.')

    registerIpcHandlers()
    logger.info('IPC handlers registered.')

    // Register global shortcuts for operator controls
    globalShortcut.register('F1', () => stateManager.toggleGlobalControl('black'))
    globalShortcut.register('F2', () => stateManager.toggleGlobalControl('clear'))
    globalShortcut.register('F3', () => stateManager.toggleGlobalControl('logo'))
    globalShortcut.register('F4', () => stateManager.toggleGlobalControl('freeze'))

    // Create Operator Window
    windowManager.createOperatorWindow()

    // Sync and launch assigned output windows
    windowManager.syncOutputWindows()

    logger.info('ChurchPresenter initialization completed successfully.')
  } catch (err) {
    logger.error('Fatal initialization error:', err)
  }
}

app.whenReady().then(initializeApp)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  windowManager.closeAllOutputWindows()
  databaseService.close()
  logger.info('ChurchPresenter exited cleanly.')
})
