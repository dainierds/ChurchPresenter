import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { DatabaseService } from '../src/main/db/database-service'

describe('DatabaseService', () => {
  const testDbPath = path.resolve(__dirname, 'test_temp.sqlite')
  let dbService: DatabaseService

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    dbService = new DatabaseService(testDbPath)
    await dbService.initialize()
  })

  afterEach(() => {
    dbService.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  it('runs migrations and creates tables successfully', () => {
    expect(dbService.getConfig('non_existent')).toBeNull()
  })

  it('saves and retrieves key-value configuration', () => {
    dbService.setConfig('theme', 'dark')
    dbService.setConfig('church_name', 'Iglesia Central')

    expect(dbService.getConfig('theme')).toBe('dark')
    expect(dbService.getConfig('church_name')).toBe('Iglesia Central')

    const all = dbService.getAllConfigs()
    expect(all['theme']).toBe('dark')
    expect(all['church_name']).toBe('Iglesia Central')
  })

  it('saves and retrieves screen role assignments', () => {
    dbService.setRoleAssignment('main', 101)
    dbService.setRoleAssignment('stage', 102)

    let assignments = dbService.getRoleAssignments()
    expect(assignments['main']).toBe(101)
    expect(assignments['stage']).toBe(102)

    // Unassign main
    dbService.setRoleAssignment('main', null)
    assignments = dbService.getRoleAssignments()
    expect(assignments['main']).toBeUndefined()
  })
})
