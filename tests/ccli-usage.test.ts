import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { ccliService } from '../src/main/extras/ccli-service'

describe('Phase 10: CCLI Song Usage Tracking & Reporting', () => {
  let tempDir: string
  let dbPath: string

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ccli-test-'))
    dbPath = path.join(tempDir, 'test.sqlite')
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(tempDir, 'backups')
    await databaseService.initialize()

    ccliService.clearHistory()
    ccliService.saveConfig({ enabled: true })
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('records song projections with full metadata', () => {
    const recorded = ccliService.recordUsage({
      songId: 'song_ccli_1',
      title: 'Tu Fidelidad es Grande',
      artist: 'Miguel Cassina',
      ccliNumber: '1234567',
      copyright: '1990 Integrity Music',
      serviceTitle: 'Culto Dominical Mañana'
    })

    expect(recorded).toBe(true)

    const rep = ccliService.getReport()
    expect(rep.totalPlays).toBe(1)
    expect(rep.uniqueSongs).toBe(1)
    expect(rep.records[0].title).toBe('Tu Fidelidad es Grande')
    expect(rep.records[0].ccliNumber).toBe('1234567')
  })

  it('does not record when CCLI tracking is disabled', () => {
    ccliService.saveConfig({ enabled: false })

    const recorded = ccliService.recordUsage({
      songId: 'song_disabled_1',
      title: 'Canción no registrada'
    })

    expect(recorded).toBe(false)
    const rep = ccliService.getReport()
    expect(rep.totalPlays).toBe(0)
  })

  it('generates a valid RFC4180 CSV export adhering to CCLI reporting standards', () => {
    ccliService.recordUsage({
      songId: 'song_csv_1',
      title: 'Sublime Gracia, "Amor Eterno"',
      artist: 'John Newton',
      ccliNumber: '22025',
      copyright: 'Public Domain',
      serviceTitle: 'Culto de Adoración'
    })

    const csvRes = ccliService.exportCsv()
    expect(csvRes.success).toBe(true)
    expect(csvRes.recordCount).toBe(1)

    // Check CSV headers
    expect(csvRes.csvContent).toContain('Fecha y Hora')
    expect(csvRes.csvContent).toContain('Título de Canción')
    expect(csvRes.csvContent).toContain('Número CCLI')

    // Check escaped quotes in title
    expect(csvRes.csvContent).toContain('"Sublime Gracia, ""Amor Eterno"""')
    expect(csvRes.csvContent).toContain('"22025"')
  })

  it('clears all usage history upon confirmation', () => {
    ccliService.recordUsage({ songId: 'song_a', title: 'Canción A' })
    ccliService.recordUsage({ songId: 'song_b', title: 'Canción B' })
    expect(ccliService.getReport().totalPlays).toBe(2)

    ccliService.clearHistory()
    expect(ccliService.getReport().totalPlays).toBe(0)
  })
})
