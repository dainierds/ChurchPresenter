const { app, BrowserWindow } = require('electron')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: { offscreen: true }
  })

  await win.loadURL('data:text/html,<html><body style="background:#000;color:#fff;margin:0"><h1>Audience Display</h1></body></html>')

  // Warmup
  await win.webContents.capturePage()

  const times = []
  const frameCount = 60
  const start = Date.now()

  for (let i = 0; i < frameCount; i++) {
    const t0 = performance.now()
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1280, height: 720 })
    const bitmap = img.toBitmap()
    times.push(performance.now() - t0)
  }

  const total = Date.now() - start
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const fps = 1000 / avg

  console.log(`[BENCHMARK capturePage] Total for ${frameCount} frames: ${total} ms`)
  console.log(`[BENCHMARK capturePage] Avg latency: ${avg.toFixed(2)} ms`)
  console.log(`[BENCHMARK capturePage] Real Achievable FPS: ${fps.toFixed(1)} FPS`)

  app.quit()
})
