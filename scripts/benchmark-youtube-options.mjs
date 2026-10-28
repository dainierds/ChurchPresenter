import { app, BrowserWindow, WebContentsView, session } from 'electron'
import fs from 'fs'

const TEST_VIDEOS = [
  { id: 'aqz-KE-bpKQ', title: 'Blender - Big Buck Bunny' },
  { id: 'eRsGyueVLvQ', title: 'Blender - Sintel' },
  { id: 'R6MlUcmOul8', title: 'Blender - Tears of Steel' },
  { id: 'UXqq0ZvbOnk', title: 'Blender - Charge' },
  { id: 'TLkA0RELQ1g', title: 'Blender - Elephants Dream' },
  { id: '21X5lGlDOfg', title: 'NASA - Earth from Space' },
  { id: '4P8xYT68ys8', title: 'NASA - James Webb Telescope' },
  { id: '1bwkY0KwRuY', title: 'Yamilka - A Dios Sea La Gloria' },
  { id: 'GRxofEmo3HA', title: 'Vivaldi - Four Seasons' },
  { id: 'jW3oT8e860E', title: 'Google - Android Developers' }
]

async function runBenchmark() {
  await app.whenReady()

  const results = {
    testDate: new Date().toISOString(),
    optionA_Embed: {
      tested: 0,
      passed: 0,
      failed: 0,
      avgStartupTimeMs: 0,
      details: []
    },
    optionB_WatchPage: {
      tested: 0,
      passed: 0,
      failed: 0,
      avgStartupTimeMs: 0,
      details: []
    }
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  console.log('\n======================================================')
  console.log('   EVALUATING YOUTUBE PLAYBACK: OPTION A vs OPTION B  ')
  console.log('======================================================\n')

  // -------------------------------------------------------------------
  // TEST OPTION A: Embed Player (/embed/VIDEO_ID)
  // -------------------------------------------------------------------
  console.log('>>> Testing Option A: Embedded Player (/embed/...)')
  let optATotalTime = 0

  for (const v of TEST_VIDEOS) {
    results.optionA_Embed.tested++
    const startTime = Date.now()
    const view = new WebContentsView({
      webPreferences: {
        partition: 'persist:youtube_benchmark_a',
        nodeIntegration: false,
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })
    win.contentView.addChildView(view)
    view.setBounds({ x: 0, y: 0, width: 1280, height: 720 })

    const embedUrl = `https://www.youtube.com/embed/${v.id}?enablejsapi=1&autoplay=1&mute=1&controls=0`
    
    let outcome = { id: v.id, title: v.title, success: false, startupMs: 0, reason: '' }

    try {
      await view.webContents.loadURL(embedUrl)

      // Wait up to 6s for playback or error card
      const checkRes = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ success: false, reason: 'timeout_or_error_152' }), 6000)
        const interval = setInterval(async () => {
          try {
            const status = await view.webContents.executeJavaScript(`
              (function() {
                const video = document.querySelector('video');
                const errorCard = document.querySelector('.ytp-error, .ytp-error-content, [class*="error-card"]');
                const errorText = errorCard ? errorCard.innerText : null;
                const unavailable = document.body ? document.body.innerText.includes('This video is unavailable') || document.body.innerText.includes('Error code: 152') : false;
                
                return {
                  hasVideo: Boolean(video),
                  currentTime: video ? video.currentTime : 0,
                  playing: video ? !video.paused && video.currentTime > 0.1 : false,
                  hasError: Boolean(errorCard || unavailable),
                  errorText: errorText || (unavailable ? 'Error 152-4 Unavailable' : null)
                };
              })()
            `)

            if (status.hasError) {
              clearInterval(interval)
              clearTimeout(timer)
              resolve({ success: false, reason: status.errorText || 'Error Card Detected' })
            } else if (status.playing) {
              clearInterval(interval)
              clearTimeout(timer)
              resolve({ success: true, reason: 'ok' })
            }
          } catch {
            // Wait for dom
          }
        }, 300)
      })

      const elapsed = Date.now() - startTime
      outcome.startupMs = elapsed
      outcome.success = checkRes.success
      outcome.reason = checkRes.reason

      if (checkRes.success) {
        results.optionA_Embed.passed++
        optATotalTime += elapsed
        console.log(`  [Option A] [PASS] ${v.id} (${v.title}) in ${elapsed}ms`)
      } else {
        results.optionA_Embed.failed++
        console.log(`  [Option A] [FAIL] ${v.id} (${v.title}): ${checkRes.reason}`)
      }
    } catch (err) {
      outcome.reason = err.message
      results.optionA_Embed.failed++
      console.log(`  [Option A] [FAIL] ${v.id} (${v.title}): ${err.message}`)
    } finally {
      win.contentView.removeChildView(view)
      results.optionA_Embed.details.push(outcome)
    }
  }

  results.optionA_Embed.avgStartupTimeMs =
    results.optionA_Embed.passed > 0
      ? Math.round(optATotalTime / results.optionA_Embed.passed)
      : 0

  // -------------------------------------------------------------------
  // TEST OPTION B: Dedicated Watch Page (youtube.com/watch?v=VIDEO_ID)
  // -------------------------------------------------------------------
  console.log('\n>>> Testing Option B: Dedicated Watch Page (youtube.com/watch?v=...)')
  let optBTotalTime = 0

  for (const v of TEST_VIDEOS) {
    results.optionB_WatchPage.tested++
    const startTime = Date.now()
    const view = new WebContentsView({
      webPreferences: {
        partition: 'persist:youtube', // Same partition as search browser
        nodeIntegration: false,
        contextIsolation: true,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })
    win.contentView.addChildView(view)
    view.setBounds({ x: 0, y: 0, width: 1280, height: 720 })

    const watchUrl = `https://www.youtube.com/watch?v=${v.id}`
    let outcome = { id: v.id, title: v.title, success: false, startupMs: 0, reason: '' }

    try {
      try {
        await view.webContents.loadURL(watchUrl)
      } catch (navErr) {
        if (!navErr.message.includes('ERR_ABORTED')) {
          throw navErr
        }
      }

      // Inject clean theater / full-viewport CSS & force play
      const checkRes = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ success: false, reason: 'timeout' }), 8000)
        const interval = setInterval(async () => {
          try {
            const status = await view.webContents.executeJavaScript(`
              (function() {
                const video = document.querySelector('video');
                const errorElement = document.querySelector('#player-error-message-container, .yt-playability-error-supported-renderers');
                
                if (video) {
                  // Simulate user gesture & command play
                  if (video.paused) {
                    video.muted = true;
                    video.play().catch(() => {});
                  }
                  
                  // Hide distracting YouTube chrome for clean projection
                  const player = document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
                  if (player && !player.classList.contains('church-presenter-fullscreen')) {
                    player.classList.add('church-presenter-fullscreen');
                    player.style.position = 'fixed';
                    player.style.inset = '0';
                    player.style.width = '100vw';
                    player.style.height = '100vh';
                    player.style.zIndex = '999999';
                    player.style.background = '#000000';
                  }
                }

                return {
                  hasVideo: Boolean(video),
                  currentTime: video ? video.currentTime : 0,
                  playing: video ? (!video.paused && video.currentTime > 0.1) || video.readyState >= 3 : false,
                  hasError: Boolean(errorElement && errorElement.offsetParent !== null),
                  errorText: errorElement ? errorElement.innerText.trim().substring(0, 100) : null
                };
              })()
            `)

            if (status.hasError) {
              clearInterval(interval)
              clearTimeout(timer)
              resolve({ success: false, reason: status.errorText || 'Error element detected' })
            } else if (status.playing) {
              clearInterval(interval)
              clearTimeout(timer)
              resolve({ success: true, reason: 'ok' })
            }
          } catch {
            // Wait for dom
          }
        }, 300)
      })

      const elapsed = Date.now() - startTime
      outcome.startupMs = elapsed
      outcome.success = checkRes.success
      outcome.reason = checkRes.reason

      if (checkRes.success) {
        results.optionB_WatchPage.passed++
        optBTotalTime += elapsed
        console.log(`  [Option B] [PASS] ${v.id} (${v.title}) in ${elapsed}ms`)
      } else {
        results.optionB_WatchPage.failed++
        console.log(`  [Option B] [FAIL] ${v.id} (${v.title}): ${checkRes.reason}`)
      }
    } catch (err) {
      outcome.reason = err.message
      results.optionB_WatchPage.failed++
      console.log(`  [Option B] [FAIL] ${v.id} (${v.title}): ${err.message}`)
    } finally {
      win.contentView.removeChildView(view)
      results.optionB_WatchPage.details.push(outcome)
    }
  }

  results.optionB_WatchPage.avgStartupTimeMs =
    results.optionB_WatchPage.passed > 0
      ? Math.round(optBTotalTime / results.optionB_WatchPage.passed)
      : 0

  fs.writeFileSync('benchmark-youtube-options-results.json', JSON.stringify(results, null, 2), 'utf8')
  console.log('\nResults written to benchmark-youtube-options-results.json')
  
  win.close()
  app.quit()
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
