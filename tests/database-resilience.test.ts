import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { DatabaseService } from '../src/main/db/database-service'

describe('DatabaseService Resilience & Backups', () => {
  const testDir = path.resolve(__dirname, 'db_resilience_test')
  const testDbPath = path.join(testDir, 'church_presenter.sqlite')

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('performs atomic writes without leaving orphaned corrupt temp files', async () => {
    const db = new DatabaseService(testDbPath)
    await db.initialize()
    db.setConfig('test_key', 'atomic_value')
    db.persist()

    expect(fs.existsSync(testDbPath)).toBe(true)
    const tmpFile = `${testDbPath}.tmp`
    expect(fs.existsSync(tmpFile)).toBe(false)
    expect(db.getConfig('test_key')).toBe('atomic_value')
    db.close()
  })

  it('creates rotating backups and limits them to maximum 10', async () => {
    const db = new DatabaseService(testDbPath)
    await db.initialize()
    db.setConfig('version', '1')
    db.persist()

    // Create 12 backups
    for (let i = 1; i <= 12; i++) {
      db.setConfig('version', String(i))
      db.createBackup()
    }

    const backupsDir = db.getBackupsDirectory()
    expect(fs.existsSync(backupsDir)).toBe(true)
    const backupFiles = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.sqlite'))
    expect(backupFiles.length).toBeLessThanOrEqual(10)
    db.close()
  })

  it('automatically detects corrupt main database and restores latest valid backup', async () => {
    // 1. Create a valid database with a specific key and backup it
    const db1 = new DatabaseService(testDbPath)
    await db1.initialize()
    db1.setConfig('important_data', 'salvation_history')
    db1.persist()
    db1.createBackup()
    db1.close()

    // 2. Corrupt the main file (simulate partial write / power outage)
    fs.writeFileSync(testDbPath, Buffer.from('CORRUPTED_TRUNCATED_SQLITE_DATA_THAT_IS_NOT_VALID'))

    // 3. Re-initialize DatabaseService
    const db2 = new DatabaseService(testDbPath)
    await db2.initialize()

    // Must have restored the data from the backup
    expect(db2.getConfig('important_data')).toBe('salvation_history')
    expect(db2.wasRestoredFromBackup()).toBe(true)
    db2.close()
  })
})
