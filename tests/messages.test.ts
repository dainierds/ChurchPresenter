import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { MessageService } from '../src/main/messages/message-service'

describe('MessageService', () => {
  let tempDir: string
  let dbPath: string
  let msgService: MessageService

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-msg-test-'))
    dbPath = path.join(tempDir, 'test.sqlite')
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(tempDir, 'backups')
    await databaseService.initialize()

    msgService = new MessageService()
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('publishes and clears an active message', () => {
    const msg = msgService.sendMessage({
      text: 'Favor de mover vehículo patente AB-1234',
      target: 'audience'
    })

    expect(msg.active).toBe(true)
    expect(msg.text).toBe('Favor de mover vehículo patente AB-1234')
    expect(msg.target).toBe('audience')
    expect(msgService.getActiveMessage()?.id).toBe(msg.id)

    const cleared = msgService.clearMessage()
    expect(cleared).toBe(true)
    expect(msgService.getActiveMessage()).toBeNull()
  })

  it('auto-dismisses message when duration expires', async () => {
    vi.useFakeTimers()

    const msg = msgService.sendMessage({
      text: 'Tiempo restante: 1 minuto',
      target: 'stage',
      durationSeconds: 10
    })

    expect(msgService.getActiveMessage()?.id).toBe(msg.id)

    // Fast forward 10 seconds
    vi.advanceTimersByTime(10000)

    expect(msgService.getActiveMessage()).toBeNull()

    vi.useRealTimers()
  })

  it('manages predefined message presets in database', () => {
    const presets = msgService.getMessagePresets()
    expect(presets.length).toBeGreaterThan(0)
    expect(presets).toContain('Baja el volumen')

    // Add preset
    const updated = msgService.saveMessagePreset('Atención diáconos en entrada')
    expect(updated).toContain('Atención diáconos en entrada')

    // Delete preset
    const afterDelete = msgService.deleteMessagePreset('Atención diáconos en entrada')
    expect(afterDelete).not.toContain('Atención diáconos en entrada')
  })
})
