/**
 * Benchmark: 80-Slide PowerPoint Presentation Conversion (Requirement B.7)
 * Measures real conversion duration, throughput (slides/sec), CPU and memory.
 */

const path = require('path')
const fs = require('fs')
const os = require('os')
const { PowerPointService } = require('../src/main/powerpoint/powerpoint-service.ts')

async function runBenchmark() {
  console.log('=====================================================')
  console.log('   CHURCHPRESENTER POWERPOINT BENCHMARK (80 SLIDES)  ')
  console.log('=====================================================')

  const benchPptxPath = path.resolve(__dirname, '../tests/fixtures/benchmark_80_slides.pptx')
  if (!fs.existsSync(benchPptxPath)) {
    console.error('Fixture not found:', benchPptxPath)
    process.exit(1)
  }

  const tempCacheDir = path.join(os.tmpdir(), `cp-bench-ppt-${Date.now()}`)
  fs.mkdirSync(tempCacheDir, { recursive: true })

  const pptService = new PowerPointService(tempCacheDir)
  pptService.initialize()

  console.log(`[Bench] Converting 80-slide presentation via Microsoft PowerPoint COM...`)
  const startTime = Date.now()
  const startMem = process.memoryUsage().rss / (1024 * 1024)

  const manifest = await pptService.importPresentation(benchPptxPath, (p) => {
    if (p.percent % 25 === 0) {
      console.log(`  -> Progress: ${p.percent}% (${p.currentStep})`)
    }
  })

  const endTime = Date.now()
  const durationSec = ((endTime - startTime) / 1000).toFixed(2)
  const endMem = process.memoryUsage().rss / (1024 * 1024)
  const slidesPerSec = (manifest.slideCount / (endTime - startTime) * 1000).toFixed(1)

  const results = {
    testDate: new Date().toISOString(),
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    cpuModel: os.cpus()[0]?.model || 'Unknown CPU',
    cpuCores: os.cpus().length,
    converterUsed: manifest.converterUsed,
    slideCount: manifest.slideCount,
    targetResolution: `${manifest.targetWidth}x${manifest.targetHeight}`,
    totalDurationSeconds: parseFloat(durationSec),
    slidesPerSecond: parseFloat(slidesPerSec),
    memoryRssMb: parseFloat(endMem.toFixed(1))
  }

  console.log('\n[Benchmark Results]:')
  console.log(JSON.stringify(results, null, 2))

  const resultsOut = path.resolve(__dirname, '../benchmark-powerpoint-results.json')
  fs.writeFileSync(resultsOut, JSON.stringify(results, null, 2))
  console.log(`\n[Bench] Saved to: ${resultsOut}`)

  // Clean up
  try {
    fs.rmSync(tempCacheDir, { recursive: true, force: true })
  } catch {}
}

runBenchmark().catch((err) => {
  console.error('[Benchmark Failed]:', err)
  process.exit(1)
})
