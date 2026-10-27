import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { secondaryBackupService } from '../src/main/extras/secondary-backup-service'

describe('Phase 10: Secondary External Backups (USB / Local Folder)', () => {
  let tempBaseDir: string
  let tempUsbDir: string

  beforeEach(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-backup-base-'))
    tempUsbDir = path.join(tempBaseDir, 'usb_target')
    fs.mkdirSync(tempUsbDir, { recursive: true })

    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = path.join(tempBaseDir, 'test.sqlite')
    ds.backupsDir = path.join(tempBaseDir, 'backups')
    await databaseService.initialize()

    // Generate at least one backup in backupsDir
    databaseService.createBackup('test_startup')

    secondaryBackupService.saveConfig({
      enabled: true,
      targetDirectory: tempUsbDir,
      verifyIntegrity: true
    })
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('copies backup file and verifies byte-by-byte SHA-256 integrity', async () => {
    const res = await secondaryBackupService.runSecondaryBackup()

    expect(res.success).toBe(true)
    expect(res.verified).toBe(true)
    expect(res.lastBackupFilename).toBeDefined()

    const copiedPath = path.join(tempUsbDir, res.lastBackupFilename!)
    expect(fs.existsSync(copiedPath)).toBe(true)
    expect(fs.statSync(copiedPath).size).toBeGreaterThan(0)
  })

  it('fails gracefully when target directory is missing or invalid', async () => {
    secondaryBackupService.saveConfig({
      targetDirectory: ''
    })

    const res = await secondaryBackupService.runSecondaryBackup()
    expect(res.success).toBe(false)
    expect(res.errorMessage).toContain('No se ha configurado la carpeta secundaria')
  })
})
