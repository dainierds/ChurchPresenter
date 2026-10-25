/**
 * E2E YouTube Integration Test & Evidence Capture (Phase 5C)
 * ChurchPresenter - Windows 11 Desktop Application
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')

const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

async function runYouTubeE2E() {
  console.log('======================================================================')
  console.log('  CHURCHPRESENTER: E2E YOUTUBE INTEGRATION & EVIDENCE CAPTURE')
  console.log('======================================================================')

  console.log('[E2E] Launching Electron...')
  const app = await electron.launch({
    args: [MAIN_SCRIPT],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    console.log('[E2E] Operator window loaded.')

    // Close any first launch modal
    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      const loadDemoBtn = win.locator('button:has-text("Cargar Datos de Demostración")')
      await loadDemoBtn.click()
      await firstLaunchModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    }

    await win.waitForTimeout(1000)

    // Pre-accept legal disclaimer in localStorage so it doesn't block UI
    await win.evaluate(() => {
      localStorage.setItem('cp_youtube_disclaimer_accepted', 'true')
    })

    // 1. Switch to YouTube mode
    console.log('[E2E] Switching toolbar mode to YouTube...')
    const ytBtn = win.locator('button.pro-mode-btn:has-text("YouTube")')
    await ytBtn.click({ force: true })
    await win.waitForTimeout(1500)

    // Capture Operator with YouTube Browser Panel open
    const ytPanelImg = path.join(EVIDENCE_DIR, 'ui-operator-youtube-panel.png')
    await win.screenshot({ path: ytPanelImg })
    console.log(`[E2E] Captured YouTube Panel: ${ytPanelImg}`)

    // 2. Add sample YouTube video to the current service
    console.log('[E2E] Adding public test video to the active service plan...')
    await win.evaluate(async () => {
      const services = await window.churchPresenterApi.getServices()
      if (services.length > 0) {
        const s = services[0]
        const ytItem = {
          id: `item_yt_sample_${Date.now()}`,
          type: 'youtube',
          name: 'Video Abierto de Prueba (Rick Astley)',
          notes: 'Canal Oficial de Prueba',
          youtubeConfig: {
            youtubeId: 'dQw4w9WgXcQ',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
            channelTitle: 'Rick Astley',
            thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            duration: 212,
            inPoint: 10,
            outPoint: 120,
            targetRoles: ['main', 'lobby'],
            audioRole: 'main',
            endAction: 'freeze',
            availabilityStatus: 'ok'
          }
        }
        s.items.push(ytItem)
        await window.churchPresenterApi.saveService(s)
      }
    })

    await win.waitForTimeout(1000)

    // 3. Switch back to "Mostrar" mode to see the item in playlist
    console.log('[E2E] Switching back to "Mostrar" mode...')
    const showBtn = win.locator('button.pro-mode-btn:has-text("Mostrar")')
    await showBtn.click({ force: true })
    await win.waitForTimeout(1000)

    // 4. Test "Verificar playlist" modal
    console.log('[E2E] Testing "Verificar playlist" pre-service modal...')
    await win.evaluate(() => {
      const vBtn = document.querySelector('button.pro-btn-verify-playlist')
      if (vBtn) vBtn.click()
    })
    await win.waitForTimeout(2000)

    const verifyModalImg = path.join(EVIDENCE_DIR, 'ui-operator-youtube-verify.png')
    await win.screenshot({ path: verifyModalImg })
    console.log(`[E2E] Captured Verification Modal: ${verifyModalImg}`)

    // Close modal via DOM click
    await win.evaluate(() => {
      const closeBtn = document.querySelector('.pro-verify-modal .pro-modal-close-btn') ||
                       document.querySelector('.pro-verify-modal .pro-btn-primary')
      if (closeBtn) closeBtn.click()
    })
    await win.waitForTimeout(1000)

    // 5. Open output windows (Main, Stage, Lobby)
    console.log('[E2E] Opening preview output windows...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.openPreviewOutputWindow('main')
      await window.churchPresenterApi.openPreviewOutputWindow('stage')
      await window.churchPresenterApi.openPreviewOutputWindow('lobby')
    })

    await win.waitForTimeout(2500)

    // 6. Project YouTube item LIVE
    console.log('[E2E] Projecting YouTube video to LIVE...')
    await win.evaluate(async () => {
      const config = {
        youtubeId: 'dQw4w9WgXcQ',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
        channelTitle: 'Rick Astley',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        duration: 212,
        inPoint: 10,
        outPoint: 120,
        targetRoles: ['main', 'lobby'],
        audioRole: 'main',
        endAction: 'freeze',
        availabilityStatus: 'ok'
      }

      await window.churchPresenterApi.controlYouTube('prepare', config)
      await window.churchPresenterApi.controlYouTube('go-live')

      const slide = {
        id: `yt_slide_${config.youtubeId}`,
        title: config.title,
        body: `▶ YouTube: ${config.title}\nCanal: ${config.channelTitle}`,
        mediaType: 'youtube',
        mediaUrl: config.url,
        youtubeId: config.youtubeId,
        youtubeDuration: config.duration
      }
      await window.churchPresenterApi.sendSlide(slide, config.targetRoles)
    })

    await win.waitForTimeout(3000)

    // 7. Capture screenshots of each window
    console.log('[E2E] Capturing all windows during active YouTube projection...')
    const allWindows = app.windows()
    for (const w of allWindows) {
      const url = w.url()
      if (w === win) {
        const liveOperatorImg = path.join(EVIDENCE_DIR, 'ui-operator-youtube-live.png')
        await w.screenshot({ path: liveOperatorImg })
        console.log(`[E2E] Saved live operator screenshot: ${liveOperatorImg}`)
      } else {
        let role = 'unknown'
        if (url.includes('/output/main')) role = 'main'
        else if (url.includes('/output/stage')) role = 'stage'
        else if (url.includes('/output/lobby')) role = 'lobby'

        const outPath = path.join(EVIDENCE_DIR, `ui-youtube-output-${role}.png`)
        await w.screenshot({ path: outPath })
        console.log(`[E2E] Saved output window (${role}): ${outPath}`)
      }
    }

    console.log('\n[E2E] YouTube E2E testing completed successfully!')
    await app.close()
  } catch (err) {
    console.error('[E2E] Test error:', err)
    await app.close()
    process.exit(1)
  }
}

runYouTubeE2E().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
