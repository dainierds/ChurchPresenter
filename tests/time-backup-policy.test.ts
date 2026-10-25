import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { DatabaseService } from '../src/main/db/database-service'

describe('Time-based Backup Policy', () => {
  const testDir = path.resolve(__dirname, 'time_backup_test')
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

  it('creates a startup backup upon initialization', async () => {
    const db = new DatabaseService(testDbPath)
    await db.initialize()

    const backupsDir = db.getBackupsDirectory()
    expect(fs.existsSync(backupsDir)).toBe(true)
    const backups = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.sqlite'))
    expect(backups.length).toBeGreaterThanOrEqual(1)
    db.close()
  })

  it('respects the 15-minute interval during usage and only backs up when dirty', async () => {
    const db = new DatabaseService(testDbPath)
    await db.initialize()

    const initialBackups = fs.readdirSync(db.getBackupsDirectory()).filter((f) => f.endsWith('.sqlite')).length

    // Case 1: No changes -> periodic check should NOT create backup
    const backedUpWithoutChanges = db.checkPeriodicBackup(true) // force check
    expect(backedUpWithoutChanges).toBe(false)
    expect(fs.readdirSync(db.getBackupsDirectory()).filter((f) => f.endsWith('.sqlite')).length).toBe(initialBackups)

    // Case 2: Make change, but time interval (15 min) has not passed
    db.setConfig('sample_key', 'sample_val')
    // Simulate time not elapsed (e.g. 5 min ago)
    const tooSoon = db.checkPeriodicBackup(false)
    expect(tooSoon).toBe(false)

    // Case 3: Simulate 16 minutes elapsed with changes
    const sixteenMinMs = 16 * 60 * 1000
    db.setLastBackupTimestampForTest(Date.now() - sixteenMinMs)
    const backedUp = db.checkPeriodicBackup(false)
    expect(backedUp).toBe(true)

    const finalBackups = fs.readdirSync(db.getBackupsDirectory()).filter((f) => f.endsWith('.sqlite')).length
    expect(finalBackups).toBe(initialBackups + 1)
    db.close()
  })

  it('creates and retains daily backups for configured retention days', async () => {
    const db = new DatabaseService(testDbPath)
    await db.initialize()

    const backupsDir = db.getBackupsDirectory()
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000

    // Create simulated daily backups: 5 within 14 days, and 3 older than 14 days
    const validDailyFile = path.join(backupsDir, 'daily_2026-10-20.sqlite')
    const oldDailyFile = path.join(backupsDir, 'daily_2026-09-01.sqlite')

    fs.copyFileSync(testDbPath, validDailyFile)
    fs.copyFileSync(testDbPath, oldDailyFile)

    // Set mtime for oldDaily to 20 days ago
    const oldMtime = new Date(now - 20 * oneDayMs)
    fs.utimesSync(oldDailyFile, oldMtime, oldMtime)

    // Run backup rotation with 14 days retention
    db.cleanExpiredBackups(14)

    expect(fs.existsSync(validDailyFile)).toBe(true)
    expect(fs.existsSync(oldDailyFile)).toBe(false)
    db.close()
  })
})
