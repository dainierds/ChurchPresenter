import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { pptxParser } from '../src/main/powerpoint/powerpoint-parser'
import { PowerPointService } from '../src/main/powerpoint/powerpoint-service'

describe('PowerPoint Engine & Fidelity Analysis (Phase 5B)', () => {
  const samplePptxPath = path.resolve(__dirname, 'fixtures/sample_presentation.pptx')
  let tempCacheDir: string
  let pptService: PowerPointService

  beforeEach(() => {
    tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ppt-test-'))
    pptService = new PowerPointService(tempCacheDir)
    pptService.initialize()
  })

  afterEach(() => {
    try {
      fs.rmSync(tempCacheDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('extracts speaker notes directly from PPTX OpenXML structure', () => {
    expect(fs.existsSync(samplePptxPath)).toBe(true)

    const analysis = pptxParser.parsePptx(samplePptxPath)
    expect(analysis.slideCount).toBe(5)

    // Verify notes on Slide 1
    const note1 = analysis.speakerNotes[1]
    expect(note1).toBeDefined()
    expect(note1.toLowerCase()).toContain('bienvenida')

    // Verify notes on Slide 3
    const note3 = analysis.speakerNotes[3]
    expect(note3).toBeDefined()
    expect(note3.toLowerCase()).toContain('refrigerio')
  })

  it('detects available converters on the Windows machine', async () => {
    const converters = await pptService.detectConverters()
    expect(converters.length).toBeGreaterThanOrEqual(2)

    const comConverter = converters.find((c) => c.type === 'powerpoint_com')
    expect(comConverter).toBeDefined()
    // Host has Microsoft Office PowerPoint installed
    expect(comConverter?.isAvailable).toBe(true)

    const manualConverter = converters.find((c) => c.type === 'manual')
    expect(manualConverter?.isAvailable).toBe(true)
  })

  it('converts presentation via PowerPoint COM, attaches notes, and caches results', async () => {
    const manifest = await pptService.importPresentation(samplePptxPath)

    expect(manifest.slideCount).toBe(5)
    expect(manifest.slides.length).toBe(5)
    expect(manifest.converterUsed).toBe('powerpoint_com')
    expect(manifest.targetWidth).toBeGreaterThanOrEqual(1920)

    // Verify images exist on disk
    for (const slide of manifest.slides) {
      expect(fs.existsSync(slide.imagePath)).toBe(true)
      const stat = fs.statSync(slide.imagePath)
      expect(stat.size).toBeGreaterThan(1000)
    }

    // Verify speaker notes attached to slide 1
    expect(manifest.slides[0].speakerNotes?.toLowerCase()).toContain('bienvenida')

    // Second call should return cached result instantly
    const cachedManifest = await pptService.importPresentation(samplePptxPath)
    expect(cachedManifest.hash).toBe(manifest.hash)
    expect(cachedManifest.slideCount).toBe(manifest.slideCount)
  })

  it('handles non-existent or invalid files gracefully', async () => {
    await expect(
      pptService.importPresentation('C:\\non_existent_path\\invalid.pptx')
    ).rejects.toThrow()
  })

  it('detects external modifications to original presentation file', async () => {
    const isMod = await pptService.checkIfModified(samplePptxPath, 'different_dummy_hash')
    expect(isMod).toBe(true)
  })
})
