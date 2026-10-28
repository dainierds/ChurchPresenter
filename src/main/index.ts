import { app, session } from 'electron'

app.name = 'church-presenter'

const isTest = process.env.NODE_ENV === 'test'

// Separate dev and production user data folders (Requirement A.6)
if (!app.isPackaged && !isTest) {
  try {
    const defaultUserData = app.getPath('userData')
    if (!defaultUserData.endsWith('-dev')) {
      app.setPath('userData', `${defaultUserData}-dev`)
    }
  } catch {
    // Fallback if userData cannot be read yet
  }
}

import { setupLogger, logger } from './logger'
import { databaseService } from './db/database-service'
import { displayManager } from './display-manager'
import { windowManager } from './window-manager'
import { registerIpcHandlers } from './ipc-handlers'
import { shortcutsManager } from './shortcuts-manager'
import { libraryService } from './library-service'
import { bibleService } from './bible/bible-service'
import { mediaService } from './media/media-service'
import { youtubeService } from './youtube/youtube-service'
import { stageLayoutService } from './stage/stage-layout-service'
import { remoteServer } from './remote/remote-server'
import { sessionRecoveryService } from './recovery/session-recovery-service'
import { outputHealthService } from './health/output-health-service'
import { systemMonitorService } from './health/system-monitor-service'
import { powerProtectionService } from './power/power-protection-service'
import { emergencyService } from './emergency/emergency-service'

// Single instance lock (bypassed in test environment)
const gotTheLock = isTest ? true : app.requestSingleInstanceLock()
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
    const isDevUrl =
      process.env['ELECTRON_RENDERER_URL'] &&
      navigationUrl.startsWith(process.env['ELECTRON_RENDERER_URL'])
    const isFileUrl = navigationUrl.startsWith('file://')
    const isAllowedRemote = youtubeService.isAllowedUrl(navigationUrl)
    if (!isDevUrl && !isFileUrl && !isAllowedRemote) {
      event.preventDefault()
      logger.warn(`Blocked navigation attempt to unauthorized URL: ${navigationUrl}`)
    }
  })
})

async function initializeApp() {
  setupLogger()
  logger.info('ChurchPresenter starting up...')

  try {
    // Check GPU Feature status
    const gpuStatus = app.getGPUFeatureStatus()
    logger.info(`Hardware acceleration GPU status: ${JSON.stringify(gpuStatus)}`)

    // Allow YouTube embed preview frames in operator UI & output windows
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders }
      if (details.url.includes('youtube.com') || details.url.includes('youtube-nocookie.com')) {
        delete responseHeaders['x-frame-options']
        delete responseHeaders['X-Frame-Options']
        delete responseHeaders['frame-options']
        if (responseHeaders['content-security-policy']) {
          delete responseHeaders['content-security-policy']
        }
      }
      callback({ responseHeaders })
    })

    await databaseService.initialize()
    logger.info('Database initialized.')

    libraryService.initialize()
    logger.info('LibraryService initialized.')

    await bibleService.initialize()
    logger.info('BibleService initialized.')

    mediaService.initialize()
    logger.info('MediaService initialized.')

    displayManager.initialize()
    logger.info('DisplayManager initialized.')

    registerIpcHandlers()
    logger.info('IPC handlers registered.')

    shortcutsManager.initialize()
    logger.info('ShortcutsManager initialized.')

    stageLayoutService.initialize()
    logger.info('StageLayoutService initialized.')

    sessionRecoveryService.initialize()
    logger.info('SessionRecoveryService initialized.')

    outputHealthService.initialize(() => windowManager.getOutputWindows())
    logger.info('OutputHealthService initialized.')

    systemMonitorService.initialize()
    logger.info('SystemMonitorService initialized.')

    powerProtectionService.initialize()
    logger.info('PowerProtectionService initialized.')

    if (!emergencyService.isSafeModeEnabled()) {
      remoteServer.initialize()
      logger.info('RemoteServer initialized.')
    } else {
      logger.warn('Safe Mode active: RemoteServer initialization skipped.')
    }

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

app.on('before-quit', () => {
  logger.info('App closing: flushing database, saving session snapshot and closing windows.')
  sessionRecoveryService.markCleanShutdown()
  databaseService.persist()
  databaseService.createBackup()
})

app.on('will-quit', () => {
  powerProtectionService.release()
  systemMonitorService.destroy()
  outputHealthService.destroy()
  remoteServer.stop()
  shortcutsManager.unregisterAll()
  windowManager.closeAllOutputWindows()
  databaseService.close()
  logger.info('ChurchPresenter exited cleanly.')
})
