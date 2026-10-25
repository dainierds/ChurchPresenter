import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DatabaseService, Migration } from '../src/main/db/database-service'

describe('Database Migration Safety & Rollback (A.7)', () => {
  let tempDir: string
  let dbPath: string
  let backupsDir: string
  let dbService: DatabaseService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-mig-safety-'))
    dbPath = path.join(tempDir, 'church_presenter.sqlite')
    backupsDir = path.join(tempDir, 'backups')
  })

  afterEach(() => {
    if (dbService) {
      dbService.close()
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('creates automatic pre-migration backup before applying migrations', async () => {
    dbService = new DatabaseService(dbPath)
    await dbService.initialize()

    // Inspect backups directory
    const files = fs.readdirSync(backupsDir)
    const preBackups = files.filter((f) => f.startsWith('backup_pre_migration_v'))
    expect(preBackups.length).toBeGreaterThan(0)
    expect(preBackups[0]).toMatch(/backup_pre_migration_v\d+_\d+\.sqlite/)
  })

  it('rolls back database safely and creates pre-migration backup if a migration fails', async () => {
    // 1. Initialize with 2 successful migrations and seed data
    dbService = new DatabaseService(dbPath)
    await dbService.initialize()

    dbService.setConfig('church_name', 'Iglesia de la Paz')
    expect(dbService.getConfig('church_name')).toBe('Iglesia de la Paz')

    // 2. Simulate pending migration that throws an unrecoverable SQL error
    const testMigrations: Migration[] = [
      {
        version: 998,
        name: 'test_successful_step',
        up: (db) => {
          db.run('CREATE TABLE test_table_998 (id INTEGER PRIMARY KEY, note TEXT);')
        }
      },
      {
        version: 999,
        name: 'test_failing_migration',
        up: () => {
          throw new Error('Simulated syntax error in migration 999!')
        }
      }
    ]

    // Run migrations with failing step
    dbService.runMigrations(testMigrations)

    // Verify rollback
    expect(dbService.migrationFailureAlert).not.toBeNull()
    expect(dbService.migrationFailureAlert?.failedVersion).toBe(999)
    expect(dbService.migrationFailureAlert?.error).toContain('Simulated syntax error')

    // Verify previous data was preserved after rollback
    expect(dbService.getConfig('church_name')).toBe('Iglesia de la Paz')

    // Verify table from rolled-back migration does NOT exist
    const db = dbService.getDatabaseInstance()
    expect(() => db?.exec('SELECT * FROM test_table_998;')).toThrow()

    // Verify pre-migration backup file exists in backups dir
    const files = fs.readdirSync(backupsDir)
    const failingPreBackups = files.filter((f) => f.startsWith('backup_pre_migration_v'))
    expect(failingPreBackups.length).toBeGreaterThan(0)
  })
})
