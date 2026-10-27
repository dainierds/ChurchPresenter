import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { librarySyncService } from '../src/main/extras/library-sync-service'
import { libraryService } from '../src/main/library-service'
import { databaseService } from '../src/main/db/database-service'

describe('Phase 10: Multi-PC Library Synchronization', () => {
  let tempBaseDir: string
  let tempSyncDir: string

  beforeEach(async () => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-sync-base-'))
    tempSyncDir = path.join(tempBaseDir, 'sync_folder')
    fs.mkdirSync(tempSyncDir, { recursive: true })

    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = path.join(tempBaseDir, 'test.sqlite')
    ds.backupsDir = path.join(tempBaseDir, 'backups')
    await databaseService.initialize()
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

  it('exports local database items into a portable folder sync package with manifest', async () => {
    // Ensure at least one test song exists
    libraryService.saveSong({
      id: 'test_sync_song_1',
      title: 'Canción para Sincronizar',
      groups: [{ id: 'g1', groupType: 'verse', groupNumber: 1, label: 'Verso 1', content: 'Línea de prueba', sortOrder: 0 }],
      slides: [{ id: 's1', title: 'V1', body: 'Línea de prueba' }],
      arrangements: []
    } as any)

    const res = await librarySyncService.exportPackage(tempSyncDir)
    expect(res.success).toBe(true)
    expect(res.manifest).toBeDefined()
    expect(res.manifest?.counts.songs).toBeGreaterThanOrEqual(1)

    // Check files generated on disk
    expect(fs.existsSync(path.join(tempSyncDir, 'manifest.json'))).toBe(true)
    expect(fs.existsSync(path.join(tempSyncDir, 'songs.json'))).toBe(true)
    expect(fs.existsSync(path.join(tempSyncDir, 'playlists.json'))).toBe(true)
    expect(fs.existsSync(path.join(tempSyncDir, 'themes.json'))).toBe(true)
    expect(fs.existsSync(path.join(tempSyncDir, 'macros.json'))).toBe(true)
  })

  it('inspects package and correctly identifies identical items and conflicts', async () => {
    libraryService.saveSong({
      id: 'test_sync_song_inspect',
      title: 'Canción para Inspeccionar',
      groups: [{ id: 'g1', groupType: 'verse', groupNumber: 1, label: 'Verso 1', content: 'Línea inicial', sortOrder: 0 }],
      slides: [{ id: 's1', title: 'V1', body: 'Línea inicial' }],
      arrangements: []
    } as any)

    await librarySyncService.exportPackage(tempSyncDir)

    // 1. Inspect without changes -> should report identical items and 0 conflicts
    const inspectClean = await librarySyncService.inspectPackage(tempSyncDir)
    expect(inspectClean.success).toBe(true)
    expect(inspectClean.conflicts.length).toBe(0)
    expect(inspectClean.identicalCount).toBeGreaterThanOrEqual(1)

    // 2. Introduce a conflict by modifying songs.json in the sync folder
    const songsPath = path.join(tempSyncDir, 'songs.json')
    const remoteSongs = JSON.parse(fs.readFileSync(songsPath, 'utf-8'))
    expect(remoteSongs.length).toBeGreaterThan(0)

    remoteSongs[0].title = 'Título Modificado en Equipo B'
    remoteSongs[0].lyrics = 'Nueva letra distinta'
    fs.writeFileSync(songsPath, JSON.stringify(remoteSongs), 'utf-8')

    const inspectConflict = await librarySyncService.inspectPackage(tempSyncDir)
    expect(inspectConflict.success).toBe(true)
    expect(inspectConflict.conflicts.length).toBeGreaterThanOrEqual(1)
    expect(inspectConflict.conflicts[0].id).toBe(remoteSongs[0].id)
  })

  it('merges with resolutions and creates an undoable pre-sync backup', async () => {
    const testSongId = 'conflict_song_123'
    libraryService.saveSong({
      id: testSongId,
      title: 'Canción Original Local',
      groups: [{ id: 'g1', groupType: 'verse', groupNumber: 1, label: 'V1', content: 'Local', sortOrder: 0 }],
      slides: [{ id: 's1', title: 'V1', body: 'Local' }],
      arrangements: []
    } as any)

    await librarySyncService.exportPackage(tempSyncDir)

    // Change remote version in sync folder
    const songsPath = path.join(tempSyncDir, 'songs.json')
    const remoteSongs = JSON.parse(fs.readFileSync(songsPath, 'utf-8'))
    const target = remoteSongs.find((s: any) => s.id === testSongId)
    if (target) {
      target.title = 'Canción Remota Actualizada'
      target.lyrics = 'Letra cambiada'
      fs.writeFileSync(songsPath, JSON.stringify(remoteSongs), 'utf-8')
    }

    // Merge with 'keep_remote'
    const mergeRes = await librarySyncService.mergePackage(tempSyncDir, {
      [testSongId]: 'keep_remote'
    })

    expect(mergeRes.success).toBe(true)
    expect(mergeRes.backupPath).toBeDefined()
    expect(fs.existsSync(mergeRes.backupPath!)).toBe(true)

    // Verify local DB was updated to remote version
    const localSong = libraryService.getSongById(testSongId)
    expect(localSong?.title).toBe('Canción Remota Actualizada')

    // Undo sync
    const undoRes = await librarySyncService.undoSync()
    expect(undoRes.success).toBe(true)

    // Verify reverted
    const revertedSong = libraryService.getSongById(testSongId)
    expect(revertedSong?.title).toBe('Canción Original Local')
  })
})
