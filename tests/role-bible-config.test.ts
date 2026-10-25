import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DatabaseService } from '../src/main/db/database-service'
import { RoleBibleConfig } from '../src/shared/types'

describe('Role Bible Configuration (Doble traducción por salida)', () => {
  let dbService: DatabaseService
  let tempDir: string
  let dbPath: string

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'church-presenter-role-bible-test-'))
    dbPath = path.join(tempDir, 'test.db')
    dbService = new DatabaseService(dbPath)
    await dbService.initialize()
  })

  afterEach(() => {
    dbService.close()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('initializes with default configs for main, stage, and lobby', () => {
    const configs = dbService.getRoleBibleConfigs()
    expect(configs).toBeDefined()
    expect(configs['main']).toBeDefined()
    expect(configs['main'].mode).toBe('single')
    expect(configs['main'].primaryTranslation).toBe('RVR1909')

    expect(configs['stage']).toBeDefined()
    expect(configs['stage'].mode).toBe('stacked')
    expect(configs['stage'].primaryTranslation).toBe('RVR1909')
    expect(configs['stage'].secondaryTranslation).toBe('KJV')

    expect(configs['lobby']).toBeDefined()
    expect(configs['lobby'].mode).toBe('single')
  })

  it('saves and updates custom role Bible configuration', () => {
    const updatedMain: RoleBibleConfig = {
      role: 'main',
      mode: 'sideBySide',
      primaryTranslation: 'RVR1909',
      secondaryTranslation: 'KJV'
    }

    dbService.saveRoleBibleConfig(updatedMain)

    const configs = dbService.getRoleBibleConfigs()
    expect(configs['main'].mode).toBe('sideBySide')
    expect(configs['main'].primaryTranslation).toBe('RVR1909')
    expect(configs['main'].secondaryTranslation).toBe('KJV')

    // Stage remains unaffected
    expect(configs['stage'].mode).toBe('stacked')
  })

  it('supports custom output roles (e.g. recording, nursery)', () => {
    const recordingConfig: RoleBibleConfig = {
      role: 'recording',
      mode: 'single',
      primaryTranslation: 'KJV'
    }

    dbService.saveRoleBibleConfig(recordingConfig)

    const configs = dbService.getRoleBibleConfigs()
    expect(configs['recording']).toBeDefined()
    expect(configs['recording'].primaryTranslation).toBe('KJV')
    expect(configs['recording'].mode).toBe('single')
  })
})
