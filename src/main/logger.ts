import log from 'electron-log'
import path from 'path'
import { app } from 'electron'

if (process.env.VITEST || process.env.NODE_ENV === 'test') {
  log.transports.file.level = false
  log.transports.console.level = false
}

export function setupLogger() {
  if (process.env.VITEST) {
    log.transports.file.level = false
    log.transports.console.level = false
    return log
  }

  // Configure log file location in userData
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    log.transports.file.resolvePathFn = () => path.join(logsDir, 'church-presenter.log')
  } catch {
    // During tests where app is not initialized
  }

  // Configure file transport
  log.transports.file.maxSize = 10 * 1024 * 1024 // 10 Megabytes
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}'

  // Catch unhandled errors
  log.errorHandler.startCatching({
    showDialog: false,
    onError({ error, processType }) {
      log.error(`Unhandled error in ${processType}:`, error)
    }
  })

  log.info('ChurchPresenter logger initialized.')
  return log
}

export const logger = log
