import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DatabaseService } from '../src/main/db/database-service'

describe('Theme System Database Migration (Migration 8)', () => {
  let tempDir: string
  let dbPath: string
  let dbService: DatabaseService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-theme-mig-'))
    dbPath = path.join(tempDir, 'church_presenter.sqlite')
  })

  afterEach(() => {
    if (dbService) {
      dbService.close()
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  it('applies migration 8 and creates custom_fonts and theme_id columns', async () => {
    dbService = new DatabaseService(dbPath)
    await dbService.initialize()

    const rows = dbService.query('SELECT MAX(version) as ver FROM schema_migrations;')
    expect(Number(rows[0]?.ver || 0)).toBeGreaterThanOrEqual(8)

    // Verify custom_fonts table exists
    const fontCols = dbService.query("PRAGMA table_info('custom_fonts');")
    expect(fontCols.length).toBeGreaterThan(0)
    const fontColNames = fontCols.map((c: any) => c.name)
    expect(fontColNames).toContain('id')
    expect(fontColNames).toContain('name')
    expect(fontColNames).toContain('file_name')
    expect(fontColNames).toContain('format')
    expect(fontColNames).toContain('file_path')

    // Verify theme_id in songs
    const songCols = dbService.query("PRAGMA table_info('songs');")
    const songColNames = songCols.map((c: any) => c.name)
    expect(songColNames).toContain('theme_id')

    // Verify theme_id in generic_presentations
    const presCols = dbService.query("PRAGMA table_info('generic_presentations');")
    const presColNames = presCols.map((c: any) => c.name)
    expect(presColNames).toContain('theme_id')
  })
})
