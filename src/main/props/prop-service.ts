import { EventEmitter } from 'events'
import { PropItem } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { stateManager } from '../state-manager'
import { logger } from '../logger'

export class PropService extends EventEmitter {
  private activePropsMap: Map<string, PropItem> = new Map()

  constructor() {
    super()
    this.initActiveProps()
  }

  private initActiveProps(): void {
    try {
      const allProps = databaseService.getProps()
      for (const p of allProps) {
        if (p.isActive) {
          this.activePropsMap.set(p.id, p)
        }
      }
      this.syncToStateManager()
    } catch (err) {
      logger.error('Failed to initialize active props:', err)
    }
  }

  public getProps(): PropItem[] {
    const all = databaseService.getProps()
    // Reflect runtime active state
    return all.map((p) => ({
      ...p,
      isActive: this.activePropsMap.has(p.id)
    }))
  }

  public getActiveProps(): PropItem[] {
    return Array.from(this.activePropsMap.values())
  }

  public saveProp(prop: PropItem): PropItem {
    const saved = databaseService.saveProp(prop)
    if (this.activePropsMap.has(saved.id)) {
      this.activePropsMap.set(saved.id, saved)
      this.syncToStateManager()
    }
    this.emit('props-updated', this.getProps())
    return saved
  }

  public deleteProp(id: string): boolean {
    this.activePropsMap.delete(id)
    this.syncToStateManager()
    const result = databaseService.deleteProp(id)
    this.emit('props-updated', this.getProps())
    return result
  }

  public toggleProp(id: string, forceActive?: boolean): PropItem {
    const all = databaseService.getProps()
    const target = all.find((p) => p.id === id)
    if (!target) {
      throw new Error(`Prop with ID '${id}' not found.`)
    }

    const currentActive = this.activePropsMap.has(id)
    const newActive = typeof forceActive === 'boolean' ? forceActive : !currentActive

    if (newActive) {
      const updated = { ...target, isActive: true }
      this.activePropsMap.set(id, updated)
      databaseService.setPropActive(id, true)
    } else {
      this.activePropsMap.delete(id)
      databaseService.setPropActive(id, false)
    }

    this.syncToStateManager()
    this.emit('active-props-changed', this.getActiveProps())
    this.emit('props-updated', this.getProps())

    const result = { ...target, isActive: newActive }
    logger.info(`Prop '${target.name}' (${id}) toggled to: ${newActive}`)
    return result
  }

  public clearAllProps(): void {
    const ids = Array.from(this.activePropsMap.keys())
    this.activePropsMap.clear()
    for (const id of ids) {
      databaseService.setPropActive(id, false)
    }
    this.syncToStateManager()
    this.emit('active-props-changed', [])
    this.emit('props-updated', this.getProps())
    logger.info('All active props cleared')
  }

  private syncToStateManager(): void {
    const activeList = Array.from(this.activePropsMap.values())
    stateManager.setActiveProps(activeList)
  }
}

export const propService = new PropService()
