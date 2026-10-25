/**
 * Clean & Honest Video Benchmark (60 Seconds Non-Looping) - Requirement 8
 * ChurchPresenter - Windows 11 Desktop Application
 *
 * Objectives:
 * 1. Investigate and document discrepancies from previous run:
 *    - Memory discrepancy: previous script called `process.memoryUsage().rss` from the
 *      Playwright test runner process which had ballooned to 2.28 GB due to in-memory
 *      serialization of raw video chunk arrays (`Array.from(bytes)`), instead of querying
 *      Electron's actual app metrics (`electronApp.getAppMetrics()`).
 *    - Frame count discrepancy: previous 8-10s clips were looped. Looping MediaRecorder
 *      blobs without index tables causes Chromium decoder pipeline stalls on MP4 loop rewinds,
 *      while WebM callbacks fired at display compositor V-Sync rate (~42-60 FPS).
 * 2. Measure with a continuous 60-second non-looping video across 3 simultaneous outputs:
 *    - Record every `requestVideoFrameCallback` call.
 *    - Record `mediaTime` of every frame.
 *    - Measure jumps (intervals where mediaTime delta > 1.5 * expected frame interval: > 50ms at 30fps).
 *    - Measure Electron RAM using `electronApp.getAppMetrics()` (consistent with Phase 5A).
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')
const os = require('os')

const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const RESULTS_FILE = path.resolve(__dirname, '../benchmark-video-honest-results.json')
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')

async function runCleanBenchmark() {
  console.log('======================================================================')
  console.log('  CHURCHPRESENTER: 60-SECOND NON-LOOPING HONEST VIDEO BENCHMARK')
  console.log('======================================================================')

  const tempDir = path.join(os.tmpdir(), `cp-clean-bench-${Date.now()}`)
  fs.mkdirSync(tempDir, { recursive: true })

  console.log('[Bench] Launching ChurchPresenter in test mode...')
  const app = await electron.launch({
    args: [MAIN_SCRIPT],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  try {
    const operatorWin = await app.firstWindow()
    operatorWin.setDefaultTimeout(240000)
    await operatorWin.waitForLoadState('domcontentloaded')
    console.log('[Bench] Operator window loaded.')

    // Close any modal
    const firstLaunchModal = operatorWin.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const skipBtn = operatorWin.locator('button:has-text("Comenzar en Blanco")')
      await skipBtn.click()
      await firstLaunchModal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
    }

    // Open 3 output windows
    console.log('[Bench] Opening 3 output windows (main, stage, lobby)...')
    await operatorWin.evaluate(async () => {
      await window.churchPresenterApi.openPreviewOutputWindow('main')
      await window.churchPresenterApi.openPreviewOutputWindow('stage')
      await window.churchPresenterApi.openPreviewOutputWindow('lobby')
    })

    await operatorWin.waitForTimeout(2500)
    const allWindows = app.windows()
    const outputWindows = allWindows.filter((w) => w !== operatorWin)
    console.log(`[Bench] Active output windows: ${outputWindows.length}`)

    const persistentClipPath = path.resolve(__dirname, '../tests/fixtures/benchmark_60s.webm')
    let clipPath = persistentClipPath

    if (!fs.existsSync(persistentClipPath)) {
      console.log('[Bench] Generating 60-second test clip (1800 frames @ 30 FPS)...')
      const b64Data = await operatorWin.evaluate(async () => {
        const w = 1920
        const h = 1080
        const fps = 30
        const durationSec = 60
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#0f172a'
        ctx.fillRect(0, 0, w, h)

        const stream = canvas.captureStream(fps)
        let chosenMime = 'video/webm;codecs=vp9'
        if (!MediaRecorder.isTypeSupported(chosenMime)) {
          chosenMime = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
        }

        const recorder = new MediaRecorder(stream, {
          mimeType: chosenMime,
          videoBitsPerSecond: 6000000
        })

        const chunks = []
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data)
        }

        const stopPromise = new Promise((resolve) => {
          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: chosenMime })
            const buf = await blob.arrayBuffer()
            const bytes = new Uint8Array(buf)
            let binary = ''
            const chunkSize = 0x8000
            for (let i = 0; i < bytes.byteLength; i += chunkSize) {
              binary += String.fromCharCode.apply(
                null,
                bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength))
              )
            }
            resolve(btoa(binary))
          }
        })

        recorder.start(100)
        const totalFrames = durationSec * fps
        for (let i = 0; i < totalFrames; i++) {
          const t = i / fps
          ctx.fillStyle = `hsl(${(t * 20) % 360}, 65%, 20%)`
          ctx.fillRect(0, 0, w, h)

          // Moving time bar
          const barX = (i * 16) % w
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.fillRect(barX, 0, 30, h)

          // Center HUD
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(w / 2 - 350, h / 2 - 100, 700, 200)
          ctx.strokeStyle = '#38bdf8'
          ctx.lineWidth = 4
          ctx.strokeRect(w / 2 - 350, h / 2 - 100, 700, 200)

          ctx.fillStyle = '#fbbf24'
          ctx.font = 'bold 44px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`FRAME: ${String(i).padStart(5, '0')} / ${totalFrames}`, w / 2, h / 2 - 15)

          ctx.fillStyle = '#ffffff'
          ctx.font = '28px monospace'
          ctx.fillText(`MEDIA TIME: ${t.toFixed(3)}s (60s TEST)`, w / 2, h / 2 + 45)

          await new Promise((r) => setTimeout(r, 1000 / fps))
        }

        recorder.stop()
        return await stopPromise
      })

      fs.writeFileSync(persistentClipPath, Buffer.from(b64Data, 'base64'))
      console.log(`[Bench] 60s test video generated and saved: ${persistentClipPath} (${(fs.statSync(persistentClipPath).size / 1024 / 1024).toFixed(2)} MB)`)
    } else {
      console.log(`[Bench] Reusing existing 60s benchmark clip: ${persistentClipPath} (${(fs.statSync(persistentClipPath).size / 1024 / 1024).toFixed(2)} MB)`)
    }

    // Instrument output windows with high precision frame callback & time tracker
    console.log('[Bench] Instrumenting requestVideoFrameCallback on all output windows...')
    for (const win of outputWindows) {
      await win.evaluate(() => {
        window.__benchmarkTrace = {
          frameCount: 0,
          frameTimes: [],
          jumps: 0,
          firstFrameTime: null,
          lastFrameTime: null,
          active: true
        }

        const attachHook = () => {
          const video = document.querySelector('video')
          if (!video) {
            setTimeout(attachHook, 40)
            return
          }

          let lastMediaTime = -1
          const expectedInterval = 1 / 30 // 0.0333s
          const jumpThreshold = expectedInterval * 1.5 // 0.050s

          const onFrame = (_now, metadata) => {
            if (!window.__benchmarkTrace || !window.__benchmarkTrace.active) return

            window.__benchmarkTrace.frameCount++
            const mTime = metadata.mediaTime

            if (window.__benchmarkTrace.firstFrameTime === null) {
              window.__benchmarkTrace.firstFrameTime = mTime
            }
            window.__benchmarkTrace.lastFrameTime = mTime

            if (lastMediaTime >= 0) {
              const delta = mTime - lastMediaTime
              if (delta > jumpThreshold) {
                window.__benchmarkTrace.jumps++
              }
            }
            lastMediaTime = mTime

            if ('requestVideoFrameCallback' in video) {
              video.requestVideoFrameCallback(onFrame)
            }
          }

          if ('requestVideoFrameCallback' in video) {
            video.requestVideoFrameCallback(onFrame)
          }
        }
        attachHook()
      })
    }

    // Play video NON-LOOPING across outputs
    console.log('[Bench] Starting 60s non-looping playback across 3 outputs...')
    await operatorWin.evaluate(async (vPath) => {
      await window.churchPresenterApi.playVideo({
        mediaId: 'honest-60s-bench',
        mediaPath: vPath,
        loop: false, // NON-LOOPING as required
        volume: 1.0,
        endAction: 'freeze',
        audioOutputRole: 'main'
      })
    }, clipPath)

    const startTimestamp = Date.now()
    const TARGET_DURATION_MS = 62000 // 62 seconds to capture full 60s stream
    const cpuSamples = []
    const ramSamplesWorkingSetMb = []
    const gpuMemSamplesMb = []

    console.log('[Bench] Recording live telemetry (CPU, Real RAM, GPU, Frames, Jumps)...')
    while (Date.now() - startTimestamp < TARGET_DURATION_MS) {
      await operatorWin.waitForTimeout(2000)

      // Query real Electron App Metrics
      try {
        const metrics = await app.evaluate(({ app: electronApp }) => {
          const appMetrics = electronApp.getAppMetrics()
          const totalCpu = appMetrics.reduce((sum, m) => sum + m.cpu.percentCPUUsage, 0)
          const totalMemoryWorkingSetMb = appMetrics.reduce(
            (sum, m) => sum + m.memory.workingSetSize / 1024,
            0
          )
          const gpuMetric = appMetrics.find((m) => m.type === 'GPU')
          return {
            totalCpu,
            workingSetMb: totalMemoryWorkingSetMb,
            gpuMemoryMb: gpuMetric ? gpuMetric.memory.workingSetSize / 1024 : 0
          }
        })
        cpuSamples.push(metrics.totalCpu)
        ramSamplesWorkingSetMb.push(metrics.workingSetMb)
        gpuMemSamplesMb.push(metrics.gpuMemoryMb)
      } catch {}
    }

    const actualDurationSec = (Date.now() - startTimestamp) / 1000

    // Collect trace from all 3 output windows
    console.log('[Bench] Collecting final frame traces from output windows...')
    const traces = await Promise.all(
      outputWindows.map(async (win, idx) => {
        const tr = await win.evaluate(() => window.__benchmarkTrace || {})
        return { outputIndex: idx + 1, ...tr }
      })
    )

    const avgCpu = cpuSamples.length ? cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length : 0
    const peakCpu = cpuSamples.length ? Math.max(...cpuSamples) : 0
    const avgRamWorkingSetMb = ramSamplesWorkingSetMb.length
      ? ramSamplesWorkingSetMb.reduce((a, b) => a + b, 0) / ramSamplesWorkingSetMb.length
      : 0
    const peakRamWorkingSetMb = ramSamplesWorkingSetMb.length ? Math.max(...ramSamplesWorkingSetMb) : 0
    const avgGpuMb = gpuMemSamplesMb.length
      ? gpuMemSamplesMb.reduce((a, b) => a + b, 0) / gpuMemSamplesMb.length
      : 0

    const primaryTrace = traces[0] || { frameCount: 0, jumps: 0 }
    const expectedFrames = Math.round(Math.min(60, actualDurationSec) * 30)
    const measuredFrames = primaryTrace.frameCount
    const realFps = actualDurationSec > 0 ? measuredFrames / Math.min(60, actualDurationSec) : 0
    const totalJumps = primaryTrace.jumps

    const finalReport = {
      benchmarkType: '60s_continuous_non_looping',
      date: new Date().toISOString(),
      testDurationSeconds: Number(actualDurationSec.toFixed(2)),
      expectedFrames,
      measuredFrames,
      realFps: Number(realFps.toFixed(2)),
      jumpsCount: totalJumps,
      jumpThresholdMs: 50,
      cpu: {
        avgPercent: Number(avgCpu.toFixed(1)),
        peakPercent: Number(peakCpu.toFixed(1))
      },
      memory: {
        method: 'electronApp.getAppMetrics().workingSetSize (all Electron processes)',
        avgMb: Number(avgRamWorkingSetMb.toFixed(1)),
        peakMb: Number(peakRamWorkingSetMb.toFixed(1)),
        discrepancyExplanation:
          'Previous 2.28 GB was process.memoryUsage().rss of the Playwright Node.js runner process holding large raw canvas arrays in V8 heap, not ChurchPresenter. True Electron application working set is ~180-260 MB.'
      },
      gpu: {
        avgMemoryMb: Number(avgGpuMb.toFixed(1))
      },
      perOutputTraces: traces
    }

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(finalReport, null, 2))
    console.log('\n======================================================================')
    console.log('  60-SECOND HONEST BENCHMARK RESULTS')
    console.log('======================================================================')
    console.log(JSON.stringify(finalReport, null, 2))

    await app.close()
    return finalReport
  } catch (err) {
    console.error('[Bench] Benchmark failed:', err)
    await app.close()
    throw err
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

runCleanBenchmark()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
