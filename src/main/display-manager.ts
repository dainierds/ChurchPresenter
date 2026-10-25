import { screen, Display } from 'electron'
import { EventEmitter } from 'events'
import { DisplayInfo } from '../shared/types'
import { logger } from './logger'

export class DisplayManager extends EventEmitter {
  private displays: DisplayInfo[] = []
  private initialized: boolean = false

  constructor() {
    super()
  }

  public initialize(): void {
    if (this.initialized) return
    this.initialized = true

    this.updateDisplays()

    screen.on('display-added', (_event, display) => {
      logger.info(`Screen added: id=${display.id}, bounds=${JSON.stringify(display.bounds)}`)
      this.updateDisplays()
      this.emit('displays-changed', this.displays)
    })

    screen.on('display-removed', (_event, display) => {
      logger.info(`Screen removed: id=${display.id}`)
      this.updateDisplays()
      this.emit('displays-changed', this.displays)
    })

    screen.on('display-metrics-changed', (_event, display, changedMetrics) => {
      logger.info(`Screen metrics changed: id=${display.id}, metrics=${changedMetrics.join(',')}`)
      this.updateDisplays()
      this.emit('displays-changed', this.displays)
    })

    logger.info(`DisplayManager initialized. Detected ${this.displays.length} displays.`)
  }

  public getDisplays(): DisplayInfo[] {
    this.updateDisplays()
    return this.displays
  }

  public getDisplayById(id: number): DisplayInfo | undefined {
    return this.getDisplays().find((d) => d.id === id)
  }

  public getPrimaryDisplay(): DisplayInfo {
    const primary = screen.getPrimaryDisplay()
    return this.mapDisplay(primary)
  }

  private updateDisplays(): void {
    try {
      const all = screen.getAllDisplays()
      this.displays = all.map((d) => this.mapDisplay(d))
    } catch (err) {
      logger.error('Error querying screen displays:', err)
    }
  }

  private mapDisplay(d: Display): DisplayInfo {
    const primary = screen.getPrimaryDisplay()
    const isPrimary = d.id === primary.id
    return {
      id: d.id,
      name: `Pantalla ${d.id}${isPrimary ? ' (Principal)' : ''}`,
      bounds: {
        x: d.bounds.x,
        y: d.bounds.y,
        width: d.bounds.width,
        height: d.bounds.height
      },
      workArea: {
        x: d.workArea.x,
        y: d.workArea.y,
        width: d.workArea.width,
        height: d.workArea.height
      },
      scaleFactor: d.scaleFactor,
      isPrimary,
      isInternal: d.internal
    }
  }
}

export const displayManager = new DisplayManager()
