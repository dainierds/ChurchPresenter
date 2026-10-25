import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { MediaService } from '../src/main/media/media-service'
import { databaseService } from '../src/main/db/database-service'

describe('MediaService (Biblioteca de Medios y Deduplicación)', () => {
  let mediaService: MediaService
  let tempDir: string
  let testFile1: string
  let testFile2: string

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'church-presenter-media-test-'))
    const dbPath = path.join(tempDir, 'test.db')
    ;(databaseService as any).dbPath = dbPath
    await databaseService.initialize()

    mediaService = new MediaService(tempDir)
    mediaService.initialize()

    testFile1 = path.join(tempDir, 'sample_video.mp4')
    fs.writeFileSync(testFile1, 'fake video content buffer 12345')

    testFile2 = path.join(tempDir, 'sample_audio.mp3')
    fs.writeFileSync(testFile2, 'fake audio content buffer 67890')
  })

  afterEach(() => {
    databaseService.close()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  it('calculates deterministic SHA-256 hash', async () => {
    const hash1 = await mediaService.calculateFileHash(testFile1)
    const hash2 = await mediaService.calculateFileHash(testFile1)
    expect(hash1).toBe(hash2)
    expect(hash1.length).toBe(64)
  })

  it('detects media types and container compatibility', () => {
    expect(mediaService.detectMediaType('video.mp4')).toBe('video')
    expect(mediaService.detectMediaType('audio.mp3')).toBe('audio')
    expect(mediaService.detectMediaType('image.png')).toBe('image')
    expect(mediaService.detectMediaType('document.pdf')).toBe('image')

    const mp4Compat = mediaService.checkFormatCompatibility('video.mp4')
    expect(mp4Compat.isCompatible).toBe(true)
    expect(mp4Compat.codec).toContain('H.264')

    const mkvCompat = mediaService.checkFormatCompatibility('movie.mkv')
    expect(mkvCompat.isCompatible).toBe(false)
    expect(mkvCompat.warning).toBeDefined()
  })

  it('deduplicates identical files on import', async () => {
    const item1 = await mediaService.importMediaFile(testFile1, ['fondo', 'culto'])
    expect(item1).toBeDefined()
    expect(item1.id).toBeDefined()
    expect(fs.existsSync(item1.filePath)).toBe(true)

    // Create a copy with another name but identical content
    const testFileCopy = path.join(tempDir, 'another_copy.mp4')
    fs.writeFileSync(testFileCopy, 'fake video content buffer 12345')

    const item2 = await mediaService.importMediaFile(testFileCopy, ['copia'])
    // Should reuse the same record because the SHA-256 hash is identical
    expect(item2.id).toBe(item1.id)
    expect(item2.hash).toBe(item1.hash)
  })

  it('detects missing files in integrity check', async () => {
    const item = await mediaService.importMediaFile(testFile2)
    const check1 = mediaService.checkIntegrity()
    expect(check1.missingCount).toBe(0)

    // Simulate accidental deletion on disk
    fs.unlinkSync(item.filePath)

    const check2 = mediaService.checkIntegrity()
    expect(check2.missingCount).toBe(1)
    expect(check2.missingIds).toContain(item.id)
  })
})
