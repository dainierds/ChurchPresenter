import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-events'
import { FileChangedEvent } from '../../shared/types'
import { logger } from '../logger'

export class FileWatcherService {
  private watchers = new Map<string, fs.FSWatcher>()
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private lastMtimes = new Map<string, number>()

  /**
   * Watches an external file for modifications.
   */
  public watch(filePath: string, type: 'powerpoint' | 'media'): boolean {
    const normalized = path.resolve(filePath)
    if (this.watchers.has(normalized)) return true
    if (!fs.existsSync(normalized)) return false

    try {
      const stats = fs.statSync(normalized)
      this.lastMtimes.set(normalized, stats.mtimeMs)

      const watcher = fs.watch(normalized, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          this.handleFileChange(normalized, type)
        }
      })

      watcher.on('error', (err) => {
        logger.warn(`File watcher error for "${normalized}":`, err)
        this.unwatch(normalized)
      })

      this.watchers.set(normalized, watcher)
      logger.info(`Started watching external file (${type}): ${normalized}`)
      return true
    } catch (err) {
      logger.warn(`Could not watch file "${normalized}":`, err)
      return false
    }
  }

  /**
   * Stops watching a file.
   */
  public unwatch(filePath: string): boolean {
    const normalized = path.resolve(filePath)
    const watcher = this.watchers.get(normalized)
    if (watcher) {
      try {
        watcher.close()
      } catch {
        // ignore
      }
      this.watchers.delete(normalized)
      this.lastMtimes.delete(normalized)
      const timer = this.debounceTimers.get(normalized)
      if (timer) clearTimeout(timer)
      this.debounceTimers.delete(normalized)
      logger.info(`Stopped watching external file: ${normalized}`)
      return true
    }
    return false
  }

  /**
   * Debounced change handler that checks mtime and broadcasts to all windows.
   */
  private handleFileChange(filePath: string, type: 'powerpoint' | 'media'): void {
    const existingTimer = this.debounceTimers.get(filePath)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath)

      if (!fs.existsSync(filePath)) {
        logger.info(`Watched file no longer exists: ${filePath}`)
        return
      }

      try {
        const stats = fs.statSync(filePath)
        const previousMtime = this.lastMtimes.get(filePath) || 0

        // Only trigger if modified time actually moved forward by at least 100ms
        if (stats.mtimeMs - previousMtime > 100) {
          this.lastMtimes.set(filePath, stats.mtimeMs)
          logger.info(`External modification detected on watched file (${type}): ${filePath}`)

          const eventPayload: FileChangedEvent = {
            filePath,
            fileName: path.basename(filePath),
            type
          }

          // Broadcast to all active renderer windows
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send(IPC_CHANNELS.FILE_CHANGED, eventPayload)
            }
          }
        }
      } catch (err) {
        logger.warn(`Error reading stats for watched file "${filePath}":`, err)
      }
    }, 800) // 800ms debounce to let saving finish

    this.debounceTimers.set(filePath, timer)
  }

  public closeAll(): void {
    for (const [f, w] of this.watchers.entries()) {
      try {
        w.close()
      } catch {
        // ignore
      }
      logger.info(`Closed watcher for: ${f}`)
    }
    this.watchers.clear()
    this.debounceTimers.clear()
    this.lastMtimes.clear()
  }
}

export const fileWatcherService = new FileWatcherService()
