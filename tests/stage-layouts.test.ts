import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { StageLayoutService } from '../src/main/stage/stage-layout-service'
import { StageLayoutConfig } from '../src/shared/types'

describe('StageLayoutService', () => {
  let tempDir: string
  let dbPath: string
  let layoutService: StageLayoutService

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-stage-test-'))
    dbPath = path.join(tempDir, 'test.sqlite')
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(tempDir, 'backups')
    await databaseService.initialize()

    layoutService = new StageLayoutService()
    layoutService.initialize()
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

  it('seeds 4 built-in stage layouts into database', () => {
    const layouts = layoutService.getStageLayouts()
    expect(layouts.length).toBeGreaterThanOrEqual(4)

    const classic = layouts.find((l) => l.id === 'factory-stage-classic')
    expect(classic).toBeDefined()
    expect(classic?.isBuiltIn).toBe(true)

    const worship = layouts.find((l) => l.id === 'factory-stage-worship-leader')
    expect(worship).toBeDefined()
  })

  it('prevents deleting built-in stage layouts', () => {
    expect(() => {
      layoutService.deleteStageLayout('factory-stage-classic')
    }).toThrow(/No se pueden eliminar los diseños de escenario de fábrica/)
  })

  it('creates, saves, retrieves and assigns a custom stage layout', () => {
    const custom: StageLayoutConfig = {
      id: 'custom-stage-minimal',
      name: 'Monitor Minimalista',
      isBuiltIn: false,
      backgroundColor: '#111111',
      elements: [
        {
          id: 'el-current',
          type: 'current-slide',
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          visible: true,
          fontSizeVmin: 8.0,
          fontColor: '#ffffff'
        }
      ]
    }

    const saved = layoutService.saveStageLayout(custom)
    expect(saved.id).toBe('custom-stage-minimal')

    const retrieved = layoutService.getStageLayoutById('custom-stage-minimal')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.name).toBe('Monitor Minimalista')

    // Assign custom layout
    const assigned = layoutService.setAssignedStageLayout('custom-stage-minimal')
    expect(assigned).toBe(true)

    const currentAssigned = layoutService.getAssignedStageLayout()
    expect(currentAssigned.id).toBe('custom-stage-minimal')

    // Delete custom layout
    const deleted = layoutService.deleteStageLayout('custom-stage-minimal')
    expect(deleted).toBe(true)
    expect(layoutService.getStageLayoutById('custom-stage-minimal')).toBeNull()
  })
})
