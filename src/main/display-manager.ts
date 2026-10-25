import { screen, Display } from 'electron'
import { EventEmitter } from 'events'
import { DisplayInfo } from '../shared/types'
import { enrichDisplaysWithStableIds } from '../shared/display-utils'
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

  public getDisplayByStableId(stableId: string): DisplayInfo | undefined {
    return this.getDisplays().find((d) => d.stableId === stableId)
  }

  public getPrimaryDisplay(): DisplayInfo {
    const primary = screen.getPrimaryDisplay()
    const all = this.getDisplays()
    return all.find((d) => d.id === primary.id) || all[0]
  }

  private updateDisplays(): void {
    try {
      const all = screen.getAllDisplays()
      const primary = screen.getPrimaryDisplay()

      const raw = all.map((d: Display) => {
        const isPrimary = d.id === primary.id
        const displayName = d.label && d.label.trim().length > 0 ? d.label : `Pantalla ${d.id}`
        return {
          id: d.id,
          name: displayName,
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
      })

      this.displays = enrichDisplaysWithStableIds(raw)
    } catch (err) {
      logger.error('Error querying screen displays:', err)
    }
  }
}

export const displayManager = new DisplayManager()
