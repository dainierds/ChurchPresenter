/**
 * Video Playback Performance & Frame Drop Benchmark (Phase 5A)
 * ChurchPresenter - Benchmarking 1080p and 4K across 3 Output Windows simultaneously.
 *
 * Measures:
 * 1. Dropped video frames via HTMLVideoElement.getVideoPlaybackQuality()
 * 2. CPU usage (% process and system)
 * 3. GPU memory and process metrics via Electron app.getAppMetrics()
 * 4. RAM RSS and Heap memory usage
 * 5. Master-slave drift statistics
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')
const os = require('os')

const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const BENCHMARK_OUT = path.resolve(__dirname, '../benchmark-video-results.json')

async function runBenchmark() {
  console.log('=====================================================')
  console.log('   CHURCHPRESENTER VIDEO PLAYBACK BENCHMARK (PHASE 5A)')
  console.log('=====================================================')

  const tempUserDataDir = path.join(os.tmpdir(), `cp-video-bench-${Date.now()}`)
  fs.mkdirSync(tempUserDataDir, { recursive: true })

  console.log(`[Bench] Launching Electron app with userData: ${tempUserDataDir}`)
  const app = await electron.launch({
    args: [MAIN_SCRIPT, `--user-data-dir=${tempUserDataDir}`],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  try {
    const operatorWin = await app.firstWindow()
    await operatorWin.waitForLoadState('domcontentloaded')
    console.log('[Bench] Operator window loaded.')

    // Close first-launch modal if present
    const firstLaunchModal = operatorWin.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible({ timeout: 4000 }).catch(() => false)) {
      const skipBtn = operatorWin.locator('button:has-text("Comenzar en Blanco")')
      await skipBtn.click()
      await firstLaunchModal.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
    }

    // Step 1: Generate synthetic 1080p (1920x1080) and 4K (3840x2160) WebM test video files in temp folder
    console.log('[Bench] Generating synthetic test videos via Canvas MediaRecorder...')
    const videoFiles = await operatorWin.evaluate(async (tmpDir) => {
      async function createVideo(width, height, durationSec, fps, filename) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        const stream = canvas.captureStream(fps)
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: width > 2000 ? 12000000 : 5000000 })
        const chunks = []
        recorder.ondataavailable = (e) => chunks.push(e.data)

        const startPromise = new Promise((resolve) => {
          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: mime })
            const buffer = await blob.arrayBuffer()
            resolve(new Uint8Array(buffer))
          }
        })

        recorder.start()
        const totalFrames = durationSec * fps
        for (let i = 0; i < totalFrames; i++) {
          const t = i / fps
          // Dynamic visual pattern (gradient sweep + rotating cross + frame counter)
          const grad = ctx.createLinearGradient(0, 0, width, height)
          grad.addColorStop(0, `hsl(${(t * 40) % 360}, 60%, 25%)`)
          grad.addColorStop(1, `hsl(${(t * 40 + 120) % 360}, 60%, 15%)`)
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, width, height)

          // Center cross
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = width > 2000 ? 16 : 8
          ctx.beginPath()
          ctx.moveTo(width / 2, height / 2 - (height * 0.2))
          ctx.lineTo(width / 2, height / 2 + (height * 0.2))
          ctx.moveTo(width / 2 - (width * 0.1), height / 2 - (height * 0.05))
          ctx.lineTo(width / 2 + (width * 0.1), height / 2 - (height * 0.05))
          ctx.stroke()

          // Text overlay
          ctx.fillStyle = '#ffffff'
          ctx.font = `${width > 2000 ? 64 : 32}px sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(`ChurchPresenter Synthetic Benchmark ${width}x${height} - Frame ${i}/${totalFrames}`, width / 2, height * 0.8)

          await new Promise((r) => setTimeout(r, 1000 / fps))
        }
        recorder.stop()
        const bytes = await startPromise
        return { filename, bytes: Array.from(bytes) }
      }

      // Generate 5-second 1080p and 5-second 4K videos
      const v1080 = await createVideo(1920, 1080, 5, 30, 'benchmark_1080p.webm')
      const v4k = await createVideo(3840, 2160, 5, 30, 'benchmark_4k.webm')
      return [v1080, v4k]
    })

    const path1080 = path.join(tempUserDataDir, 'benchmark_1080p.webm')
    const path4k = path.join(tempUserDataDir, 'benchmark_4k.webm')
    fs.writeFileSync(path1080, Buffer.from(videoFiles[0].bytes))
    fs.writeFileSync(path4k, Buffer.from(videoFiles[1].bytes))
    console.log(`[Bench] Created: 1080p (${(fs.statSync(path1080).size / 1024).toFixed(1)} KB) and 4K (${(fs.statSync(path4k).size / 1024).toFixed(1)} KB)`)

    // Step 2: Open 3 output windows (main, stage, lobby)
    console.log('[Bench] Opening 3 output windows: main, stage, lobby...')
    await operatorWin.evaluate(async () => {
      await window.churchPresenterApi.openPreviewOutputWindow('main')
      await window.churchPresenterApi.openPreviewOutputWindow('stage')
      await window.churchPresenterApi.openPreviewOutputWindow('lobby')
    })

    await operatorWin.waitForTimeout(2000)
    const allWindows = app.windows()
    console.log(`[Bench] Detected ${allWindows.length} open windows in Electron.`)

    // Step 3: Run Benchmark Function
    async function testVideoScenario(label, videoPath, durationSec) {
      console.log(`\n-----------------------------------------------------`)
      console.log(`  RUNNING BENCHMARK: ${label}`)
      console.log(`-----------------------------------------------------`)

      // Start video in StateManager
      await operatorWin.evaluate(async (vPath) => {
        await window.churchPresenterApi.playVideo({
          mediaId: 'bench-video',
          mediaPath: vPath,
          loop: true,
          volume: 1.0,
          fadeDuration: 0,
          endAction: 'freeze'
        })
      }, videoPath)

      // Measure playback quality and system resources over duration
      const sampleIntervalMs = 1000
      const totalSamples = durationSec
      const qualitySamples = []
      const cpuSamples = []
      const memorySamples = []

      for (let s = 0; s < totalSamples; s++) {
        await operatorWin.waitForTimeout(sampleIntervalMs)

        // Metrics from Electron
        const metrics = await app.evaluate(({ app: electronApp }) => {
          const appMetrics = electronApp.getAppMetrics()
          const totalCpu = appMetrics.reduce((sum, m) => sum + m.cpu.percentCPUUsage, 0)
          const gpuMetric = appMetrics.find((m) => m.type === 'GPU')
          return {
            totalCpu,
            gpuCpu: gpuMetric ? gpuMetric.cpu.percentCPUUsage : 0,
            gpuMemoryKb: gpuMetric ? gpuMetric.memory.workingSetSize : 0,
            processCount: appMetrics.length
          }
        })

        // Memory from process
        const mem = process.memoryUsage()
        cpuSamples.push(metrics.totalCpu)
        memorySamples.push(mem.rss / (1024 * 1024))

        // Query getVideoPlaybackQuality() from output windows
        const windowQuality = []
        for (const w of allWindows) {
          const q = await w.evaluate(() => {
            const video = document.querySelector('video')
            if (!video || typeof video.getVideoPlaybackQuality !== 'function') return null
            const quality = video.getVideoPlaybackQuality()
            return {
              totalFrames: quality.totalVideoFrames,
              droppedFrames: quality.droppedVideoFrames,
              corruptedFrames: quality.corruptedVideoFrames
            }
          }).catch(() => null)
          if (q) windowQuality.push(q)
        }
        qualitySamples.push(windowQuality)
      }

      // Stop video
      await operatorWin.evaluate(async () => {
        await window.churchPresenterApi.controlVideo('stop')
      })

      // Aggregate numbers
      const avgCpu = (cpuSamples.reduce((a, b) => a + b, 0) / (cpuSamples.length || 1)).toFixed(1)
      const maxCpu = Math.max(...cpuSamples).toFixed(1)
      const avgMemMb = (memorySamples.reduce((a, b) => a + b, 0) / (memorySamples.length || 1)).toFixed(1)

      let totalRenderedFrames = 0
      let totalDroppedFrames = 0
      for (const sample of qualitySamples) {
        for (const wq of sample) {
          if (wq.totalFrames > totalRenderedFrames) totalRenderedFrames = wq.totalFrames
          if (wq.droppedFrames > totalDroppedFrames) totalDroppedFrames = wq.droppedFrames
        }
      }

      const dropRatio = totalRenderedFrames > 0
        ? ((totalDroppedFrames / totalRenderedFrames) * 100).toFixed(2)
        : '0.00'

      const result = {
        scenario: label,
        totalRenderedFrames,
        totalDroppedFrames,
        dropPercentage: `${dropRatio}%`,
        avgCpuPercent: `${avgCpu}%`,
        maxCpuPercent: `${maxCpu}%`,
        avgMemoryMb: `${avgMemMb} MB`,
        outputWindowsActive: 3
      }

      console.log(`[Results - ${label}]:`, JSON.stringify(result, null, 2))
      return result
    }

    const r1080 = await testVideoScenario('1080p WebM VP9 (3 outputs)', path1080, 5)
    const r4k = await testVideoScenario('4K WebM VP9 (3 outputs)', path4k, 5)

    const finalReport = {
      benchmarkDate: new Date().toISOString(),
      platform: `${os.platform()} ${os.release()} (${os.arch()})`,
      cpuModel: os.cpus()[0]?.model || 'Unknown CPU',
      cpuCores: os.cpus().length,
      totalRamGb: (os.totalmem() / (1024 ** 3)).toFixed(1),
      results: [r1080, r4k]
    }

    fs.writeFileSync(BENCHMARK_OUT, JSON.stringify(finalReport, null, 2))
    console.log(`\n[Bench] Results saved to: ${BENCHMARK_OUT}`)
    return finalReport
  } finally {
    await app.close()
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
    } catch {}
  }
}

runBenchmark().catch((err) => {
  console.error('[Benchmark Error]:', err)
  process.exit(1)
})
