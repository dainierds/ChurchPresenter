import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MacroEngine } from '../src/main/macros/macro-engine'
import { MacroItem } from '../src/shared/types'
import { databaseService } from '../src/main/db/database-service'

describe('MacroEngine Unit Test Suite (Phase 8)', () => {
  let engine: MacroEngine

  beforeEach(() => {
    engine = new MacroEngine()
    vi.restoreAllMocks()
  })

  it('executes a sequence of actions in exact sequential order', async () => {
    const executedActions: string[] = []

    engine.registerCallbacks({
      onTimerControl: (_id, action) => {
        executedActions.push(`timer:${action}`)
      },
      onMediaControl: (action) => {
        executedActions.push(`media:${action}`)
      }
    })

    const testMacro: MacroItem = {
      id: 'test_macro_seq',
      name: 'Secuencia de Prueba',
      color: '#FF7A00',
      icon: 'Zap',
      actions: [
        { id: '1', type: 'timer_control', params: { timerId: 't1', timerAction: 'start' } },
        { id: '2', type: 'media_control', params: { mediaAction: 'pause' } },
        { id: '3', type: 'timer_control', params: { timerId: 't1', timerAction: 'reset' } }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    vi.spyOn(databaseService, 'getMacros').mockReturnValue([testMacro])

    const result = await engine.runMacro('test_macro_seq')
    expect(result.success).toBe(true)
    expect(executedActions).toEqual(['timer:start', 'media:pause', 'timer:reset'])
  })

  it('respects delay/pause timing between actions', async () => {
    const testMacro: MacroItem = {
      id: 'test_macro_delay',
      name: 'Pausa de Prueba',
      color: '#10b981',
      icon: 'Clock',
      actions: [
        { id: '1', type: 'delay', params: { seconds: 0.1 } }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    vi.spyOn(databaseService, 'getMacros').mockReturnValue([testMacro])

    const t0 = Date.now()
    const result = await engine.runMacro('test_macro_delay')
    const elapsed = Date.now() - t0

    expect(result.success).toBe(true)
    expect(elapsed).toBeGreaterThanOrEqual(80) // At least ~100ms
  })

  it('detects and aborts infinite recursion loops', async () => {
    const macroA: MacroItem = {
      id: 'macro_a',
      name: 'Macro A',
      color: '#FF7A00',
      icon: 'Zap',
      actions: [
        { id: 'act_trigger_b', type: 'trigger_macro', params: { targetMacroId: 'macro_b' } }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const macroB: MacroItem = {
      id: 'macro_b',
      name: 'Macro B',
      color: '#38bdf8',
      icon: 'Zap',
      actions: [
        { id: 'act_trigger_a', type: 'trigger_macro', params: { targetMacroId: 'macro_a' } }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    vi.spyOn(databaseService, 'getMacros').mockReturnValue([macroA, macroB])

    const result = await engine.runMacro('macro_a')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Recursión infinita detectada')
  })

  it('strictly enforces the max nesting depth limit (depth <= 5)', async () => {
    const chain: MacroItem[] = []
    for (let i = 1; i <= 7; i++) {
      chain.push({
        id: `macro_${i}`,
        name: `Macro ${i}`,
        color: '#FF7A00',
        icon: 'Zap',
        actions: [
          { id: `act_${i}`, type: 'trigger_macro', params: { targetMacroId: `macro_${i + 1}` } }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    vi.spyOn(databaseService, 'getMacros').mockReturnValue(chain)

    const result = await engine.runMacro('macro_1')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Límite de profundidad')
  })

  it('emergency stop (stopAllMacros) halts all running macro executions', async () => {
    const longMacro: MacroItem = {
      id: 'macro_long',
      name: 'Macro Larga',
      color: '#FF7A00',
      icon: 'Clock',
      actions: [
        { id: '1', type: 'delay', params: { seconds: 5 } },
        { id: '2', type: 'timer_control', params: { timerId: 't1', timerAction: 'start' } }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    vi.spyOn(databaseService, 'getMacros').mockReturnValue([longMacro])

    const promise = engine.runMacro('macro_long')
    expect(engine.getExecutionState().activeMacros.length).toBe(1)

    // Stop all macros immediately
    const stopped = engine.stopAllMacros()
    expect(stopped).toBe(true)

    await promise
    expect(engine.getExecutionState().activeMacros.length).toBe(0)
  })

  it('rejects external system commands by default with security error', async () => {
    const insecureMacro: MacroItem = {
      id: 'macro_insecure',
      name: 'Comando Externo Peligroso',
      color: '#ef4444',
      icon: 'Shield',
      actions: [
        { id: '1', type: 'external_command', params: { command: 'cmd.exe', args: ['/c', 'dir'] } }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    vi.spyOn(databaseService, 'getMacros').mockReturnValue([insecureMacro])

    expect(engine.getAllowExternalCommands()).toBe(false)
    const result = await engine.runMacro('macro_insecure')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Seguridad')
  })
})
