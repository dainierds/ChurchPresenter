import { EventEmitter } from 'events'
import { databaseService } from '../db/database-service'
import { macroEngine } from '../macros/macro-engine'
import { logger } from '../logger'

export interface MidiDeviceItem {
  id: string
  name: string
  manufacturer?: string
  state?: string
}

export interface MidiMessageEvent {
  type: 'note_on' | 'control_change'
  channel: number // 1-16
  number: number // Note or CC number (0-127)
  value: number // Velocity or CC value (0-127)
}

export class MidiService extends EventEmitter {
  private learningTargetMacroId: string | null = null
  private knownDevices: MidiDeviceItem[] = []

  constructor() {
    super()
  }

  public setDevices(devices: MidiDeviceItem[]): void {
    this.knownDevices = [...devices]
    logger.info(`MIDI devices updated: ${devices.length} input(s) available`)
    this.emit('devices-changed', this.knownDevices)
  }

  public getDevices(): MidiDeviceItem[] {
    return [...this.knownDevices]
  }

  public startLearning(macroId: string): void {
    this.learningTargetMacroId = macroId
    logger.info(`MIDI Learning activated for macro ID: ${macroId}`)
    this.emit('learning-started', macroId)
  }

  public cancelLearning(): void {
    this.learningTargetMacroId = null
    logger.info('MIDI Learning cancelled')
    this.emit('learning-cancelled')
  }

  public handleMidiMessage(msg: MidiMessageEvent): void {
    logger.debug(`MIDI message received: ${msg.type} ch=${msg.channel} num=${msg.number} val=${msg.value}`)

    // 1. If currently in learn mode, assign to target macro
    if (this.learningTargetMacroId) {
      const macroId = this.learningTargetMacroId
      this.learningTargetMacroId = null

      const macros = databaseService.getMacros()
      const targetMacro = macros.find((m) => m.id === macroId)
      if (targetMacro) {
        targetMacro.midiTrigger = {
          enabled: true,
          type: msg.type,
          channel: msg.channel,
          number: msg.number,
          value: msg.value
        }
        databaseService.saveMacro(targetMacro)
        logger.info(`MIDI trigger assigned to macro '${targetMacro.name}': ${msg.type} ch=${msg.channel} #${msg.number}`)
        this.emit('learning-completed', { macroId, trigger: targetMacro.midiTrigger })
      }
      return
    }

    // 2. Route message to matching macro
    const macros = databaseService.getMacros()
    for (const m of macros) {
      if (
        m.midiTrigger &&
        m.midiTrigger.enabled &&
        m.midiTrigger.type === msg.type &&
        m.midiTrigger.channel === msg.channel &&
        m.midiTrigger.number === msg.number
      ) {
        // Value threshold check if configured
        if (m.midiTrigger.value && msg.value < m.midiTrigger.value) {
          continue
        }
        logger.info(`Triggering macro '${m.name}' via MIDI event (${msg.type} ch=${msg.channel} num=${msg.number})`)
        macroEngine.runMacro(m.id).catch((err) => {
          logger.error(`Error running macro '${m.name}' from MIDI trigger:`, err)
        })
      }
    }
  }
}

export const midiService = new MidiService()
