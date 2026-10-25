import { describe, it, expect } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { PowerPointService } from '../src/main/powerpoint/powerpoint-service'

describe('PowerPoint 80-Slide Performance Benchmark (Requirement B.7)', () => {
  it('converts an 80-slide presentation via PowerPoint COM and measures real throughput', async () => {
    const benchPptxPath = path.resolve(__dirname, 'fixtures/benchmark_80_slides.pptx')
    expect(fs.existsSync(benchPptxPath)).toBe(true)

    const tempCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-bench-80-'))
    const pptService = new PowerPointService(tempCacheDir)
    pptService.initialize()

    const startTime = Date.now()
    const startMem = process.memoryUsage().rss / (1024 * 1024)

    const manifest = await pptService.importPresentation(benchPptxPath)

    const endTime = Date.now()
    const durationSec = parseFloat(((endTime - startTime) / 1000).toFixed(2))
    const endMem = parseFloat((process.memoryUsage().rss / (1024 * 1024)).toFixed(1))
    const slidesPerSec = parseFloat((manifest.slideCount / (endTime - startTime) * 1000).toFixed(1))

    expect(manifest.slideCount).toBe(80)
    expect(manifest.slides.length).toBe(80)

    const results = {
      testDate: new Date().toISOString(),
      startMemMb: parseFloat(startMem.toFixed(1)),
      platform: `${os.platform()} ${os.release()} (${os.arch()})`,
      cpuModel: os.cpus()[0]?.model || 'Unknown CPU',
      cpuCores: os.cpus().length,
      converterUsed: manifest.converterUsed,
      slideCount: manifest.slideCount,
      targetResolution: `${manifest.targetWidth}x${manifest.targetHeight}`,
      totalDurationSeconds: durationSec,
      slidesPerSecond: slidesPerSec,
      memoryRssMb: endMem
    }

    console.log('\n[80-Slide PowerPoint Benchmark Results]:', JSON.stringify(results, null, 2))

    const resultsOut = path.resolve(__dirname, '../benchmark-powerpoint-results.json')
    fs.writeFileSync(resultsOut, JSON.stringify(results, null, 2))

    // Cleanup
    try {
      fs.rmSync(tempCacheDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }, 120000) // 120s timeout limit
})
