import { EventEmitter } from 'events'
import {
  MacroAction,
  MacroExecutionState,
  GlobalControls
} from '../../shared/types'
import { databaseService } from '../db/database-service'
import { stateManager } from '../state-manager'
import { propService } from '../props/prop-service'
import { messageService } from '../messages/message-service'
import { themeService } from '../theme/theme-service'
import { logger } from '../logger'

const MAX_EXECUTION_DEPTH = 5
const MAX_MACRO_TIMEOUT_MS = 60_000 // 60s safety timeout

export interface MacroExecutionRecord {
  timestamp: number
  macroId: string
  macroName: string
  actionIndex: number
  actionType: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
}

export class MacroEngine extends EventEmitter {
  private activeExecutions: Map<string, {
    macroId: string
    macroName: string
    startedAt: number
    currentActionIndex: number
    totalActions: number
    status: 'running' | 'paused' | 'step_by_step'
    abortController: AbortController
  }> = new Map()

  private executionLog: MacroExecutionRecord[] = []
  private allowExternalCommands: boolean = false
  private onNavigateCallback?: (direction: 'next_slide' | 'prev_slide' | 'next_item' | 'prev_item' | 'specific', itemId?: string, slideIndex?: number) => void
  private onTimerControlCallback?: (timerId: string, action: 'start' | 'pause' | 'reset') => void
  private onMediaControlCallback?: (action: 'play' | 'pause' | 'stop' | 'seek', seekSec?: number) => void
  private onAudioPlayCallback?: (path: string, fadeInSec?: number, volume?: number) => void

  constructor() {
    super()
  }

  public setAllowExternalCommands(allow: boolean): void {
    this.allowExternalCommands = allow
    logger.info(`Macro security policy: allowExternalCommands = ${allow}`)
  }

  public getAllowExternalCommands(): boolean {
    return this.allowExternalCommands
  }

  public registerCallbacks(callbacks: {
    onNavigate?: (direction: 'next_slide' | 'prev_slide' | 'next_item' | 'prev_item' | 'specific', itemId?: string, slideIndex?: number) => void
    onTimerControl?: (timerId: string, action: 'start' | 'pause' | 'reset') => void
    onMediaControl?: (action: 'play' | 'pause' | 'stop' | 'seek', seekSec?: number) => void
    onAudioPlay?: (path: string, fadeInSec?: number, volume?: number) => void
  }): void {
    this.onNavigateCallback = callbacks.onNavigate
    this.onTimerControlCallback = callbacks.onTimerControl
    this.onMediaControlCallback = callbacks.onMediaControl
    this.onAudioPlayCallback = callbacks.onAudioPlay
  }

  public getExecutionState(): MacroExecutionState {
    return {
      activeMacros: Array.from(this.activeExecutions.values()).map((e) => ({
        macroId: e.macroId,
        macroName: e.macroName,
        startedAt: e.startedAt,
        currentActionIndex: e.currentActionIndex,
        totalActions: e.totalActions,
        status: e.status
      })),
      executionLog: this.executionLog.slice(-50)
    }
  }

  public stopAllMacros(): boolean {
    let stoppedCount = 0
    for (const [id, exec] of this.activeExecutions.entries()) {
      exec.abortController.abort()
      this.activeExecutions.delete(id)
      stoppedCount++
      this.recordLog({
        timestamp: Date.now(),
        macroId: exec.macroId,
        macroName: exec.macroName,
        actionIndex: exec.currentActionIndex,
        actionType: 'stop_all',
        status: 'skipped',
        error: 'Detenida manualmente por el operador'
      })
    }
    this.syncExecutionState()
    logger.warn(`Emergency: stopped all active macros (${stoppedCount} cancelled)`)
    return true
  }

  public async runMacro(
    macroId: string,
    callStack: string[] = []
  ): Promise<{ success: boolean; error?: string }> {
    // 1. Recursion & Depth Check
    if (callStack.includes(macroId)) {
      const err = `Recursión infinita detectada: la macro '${macroId}' ya está en la cadena de llamadas.`
      logger.error(err)
      return { success: false, error: err }
    }
    if (callStack.length >= MAX_EXECUTION_DEPTH) {
      const err = `Límite de profundidad de macros excedido (máximo ${MAX_EXECUTION_DEPTH}).`
      logger.error(err)
      return { success: false, error: err }
    }

    const macros = databaseService.getMacros()
    const macro = macros.find((m) => m.id === macroId)
    if (!macro) {
      const err = `Macro '${macroId}' no encontrada en la base de datos.`
      logger.error(err)
      return { success: false, error: err }
    }

    const abortController = new AbortController()
    const executionId = `${macroId}_${Date.now()}`

    this.activeExecutions.set(executionId, {
      macroId: macro.id,
      macroName: macro.name,
      startedAt: Date.now(),
      currentActionIndex: 0,
      totalActions: macro.actions.length,
      status: 'running',
      abortController
    })
    this.syncExecutionState()

    const timeoutHandle = setTimeout(() => {
      if (this.activeExecutions.has(executionId)) {
        logger.warn(`Macro '${macro.name}' excedió el tiempo límite de ejecución de ${MAX_MACRO_TIMEOUT_MS / 1000}s. Forzando detención.`)
        abortController.abort()
      }
    }, MAX_MACRO_TIMEOUT_MS)

    try {
      const updatedStack = [...callStack, macroId]
      for (let i = 0; i < macro.actions.length; i++) {
        if (abortController.signal.aborted) {
          logger.info(`Macro '${macro.name}' abortada antes de la acción #${i + 1}`)
          break
        }

        const activeExec = this.activeExecutions.get(executionId)
        if (activeExec) {
          activeExec.currentActionIndex = i
          this.syncExecutionState()
        }

        const action = macro.actions[i]
        await this.executeAction(action, updatedStack, abortController.signal)

        this.recordLog({
          timestamp: Date.now(),
          macroId: macro.id,
          macroName: macro.name,
          actionIndex: i,
          actionType: action.type,
          status: 'success'
        })
      }

      logger.info(`Macro '${macro.name}' ejecutada exitosamente (${macro.actions.length} acciones)`)
      return { success: true }
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      logger.error(`Error durante ejecución de macro '${macro.name}':`, err)
      const currentIdx = this.activeExecutions.get(executionId)?.currentActionIndex || 0
      this.recordLog({
        timestamp: Date.now(),
        macroId: macro.id,
        macroName: macro.name,
        actionIndex: currentIdx,
        actionType: macro.actions[currentIdx]?.type || 'unknown',
        status: 'failed',
        error: errorMsg
      })
      this.emit('macro-error', { macroId: macro.id, macroName: macro.name, error: errorMsg })
      return { success: false, error: errorMsg }
    } finally {
      clearTimeout(timeoutHandle)
      this.activeExecutions.delete(executionId)
      this.syncExecutionState()
    }
  }

  public async runStep(
    macroId: string,
    actionIndex: number
  ): Promise<{ success: boolean; error?: string }> {
    const macros = databaseService.getMacros()
    const macro = macros.find((m) => m.id === macroId)
    if (!macro) {
      return { success: false, error: `Macro '${macroId}' no encontrada.` }
    }
    const action = macro.actions[actionIndex]
    if (!action) {
      return { success: false, error: `Acción en índice ${actionIndex} no existe.` }
    }

    try {
      await this.executeAction(action, [macroId], undefined)
      this.recordLog({
        timestamp: Date.now(),
        macroId: macro.id,
        macroName: macro.name,
        actionIndex,
        actionType: action.type,
        status: 'success'
      })
      return { success: true }
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      this.recordLog({
        timestamp: Date.now(),
        macroId: macro.id,
        macroName: macro.name,
        actionIndex,
        actionType: action.type,
        status: 'failed',
        error: errorMsg
      })
      return { success: false, error: errorMsg }
    }
  }

  private async executeAction(
    action: MacroAction,
    callStack: string[],
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) return

    // Optional delay before action
    if (action.delayBeforeMs && action.delayBeforeMs > 0) {
      await this.sleep(action.delayBeforeMs, signal)
      if (signal?.aborted) return
    }

    const { type, params } = action

    switch (type) {
      case 'go_to_item_slide': {
        const relative = params.relative || 'specific'
        if (this.onNavigateCallback) {
          this.onNavigateCallback(relative, params.itemId, params.slideIndex)
        }
        break
      }

      case 'clear_layer': {
        const layer = params.layer || 'all'
        if (layer === 'all') {
          stateManager.setGlobalControl('clear', true)
        } else if (layer === 'props') {
          propService.clearAllProps()
        } else if (layer === 'message') {
          messageService.clearMessage()
        } else if (layer === 'slide') {
          stateManager.setGlobalControl('clear', true)
        } else if (layer === 'audio') {
          if (this.onMediaControlCallback) this.onMediaControlCallback('stop')
        } else if (layer === 'media') {
          if (this.onMediaControlCallback) this.onMediaControlCallback('stop')
        }
        break
      }

      case 'emergency_control': {
        const ctrl = params.emergencyType || 'black'
        const active = typeof params.active === 'boolean' ? params.active : true
        stateManager.setGlobalControl(ctrl as keyof GlobalControls, active)
        break
      }

      case 'timer_control': {
        if (params.timerId && this.onTimerControlCallback) {
          this.onTimerControlCallback(params.timerId, params.timerAction || 'start')
        }
        break
      }

      case 'media_control': {
        if (this.onMediaControlCallback) {
          this.onMediaControlCallback(params.mediaAction || 'play', params.seekSeconds)
        }
        break
      }

      case 'play_audio_track': {
        if (params.audioPath && this.onAudioPlayCallback) {
          this.onAudioPlayCallback(params.audioPath, params.fadeInSeconds, params.volume)
        }
        break
      }

      case 'display_message': {
        if (params.messageAction === 'hide') {
          messageService.clearMessage()
        } else if (params.messageText) {
          const role = (params.targetRole || 'all') as string
          const target = role === 'all' ? 'both' : (role === 'stage' ? 'stage' : 'audience')
          messageService.sendMessage({ text: params.messageText, target })
        }
        break
      }

      case 'prop_control': {
        if (params.propId) {
          if (params.propAction === 'show') {
            propService.toggleProp(params.propId, true)
          } else if (params.propAction === 'hide') {
            propService.toggleProp(params.propId, false)
          } else {
            propService.toggleProp(params.propId)
          }
        }
        break
      }

      case 'set_output_theme': {
        if (params.themeId) {
          const allThemes = themeService.getThemes()
          const found = allThemes.find((t: any) => t.id === params.themeId)
          if (found) {
            stateManager.setTheme(found)
          }
        }
        break
      }

      case 'delay': {
        const sec = Math.max(0.05, params.seconds || 1)
        await this.sleep(sec * 1000, signal)
        break
      }

      case 'trigger_macro': {
        if (params.targetMacroId) {
          const res = await this.runMacro(params.targetMacroId, callStack)
          if (!res.success) {
            throw new Error(res.error || `Error ejecutando macro anidada '${params.targetMacroId}'`)
          }
        }
        break
      }

      case 'external_command': {
        if (!this.allowExternalCommands) {
          throw new Error(
            'Seguridad: La ejecución de comandos del sistema está desactivada por defecto. Habilítela en Configuración bajo su propia responsabilidad.'
          )
        }
        logger.warn(`External command executed by macro: ${params.command} ${JSON.stringify(params.args)}`)
        break
      }

      default:
        logger.warn(`Tipo de acción de macro desconocido: '${type}'`)
    }

    // Optional delay after action
    if (action.delayAfterMs && action.delayAfterMs > 0) {
      await this.sleep(action.delayAfterMs, signal)
    }
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve()
      const timer = setTimeout(resolve, ms)
      signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  private recordLog(record: MacroExecutionRecord): void {
    this.executionLog.push(record)
    if (this.executionLog.length > 200) {
      this.executionLog.shift()
    }
  }

  private syncExecutionState(): void {
    const st = this.getExecutionState()
    stateManager.setMacroExecutionState(st)
    this.emit('macro-status-changed', st)
  }
}

export const macroEngine = new MacroEngine()
