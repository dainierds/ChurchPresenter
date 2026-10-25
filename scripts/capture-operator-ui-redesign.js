/**
 * Capture Operator UI Redesign Evidence (ProPresenter 7 Layout)
 * ChurchPresenter - Windows 11 Desktop Application
 *
 * Requirements:
 * 1. Window at 1920x1080 -> docs/evidence/ui-operator-1920x1080.png
 * 2. Window at 1366x768 -> docs/evidence/ui-operator-1366x768.png
 * 3. Real content visible:
 *    - Library collections ("Canciones", "Presentaciones", "Videos", "Playlist anterior")
 *    - Service playlist with bold/colored collapsible section headers ("MÚSICA", "MENSAJE", "AVISOS")
 *    - Slide grid with legible thumbnails, group badges ("Verso 1", "Coro"), live red/green badges
 *    - Collapsed/expanded media drawer with video thumbnails, loop badge, duration, zoom slider
 *    - Right panel with output preview monitor, audio VU meters, clear layers strip, transport deck
 *    - Presentation timers with at least 1 timer running actively
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')

const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

async function captureEvidence() {
  console.log('======================================================================')
  console.log('  CHURCHPRESENTER: OPERATOR UI REDESIGN SCREENSHOT CAPTURE')
  console.log('======================================================================')

  console.log('[Capture] Launching Electron app...')
  const app = await electron.launch({
    args: [MAIN_SCRIPT],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    console.log('[Capture] Operator window loaded.')

    // 1. If first-launch modal appears, click "Cargar Datos de Demostración"
    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('[Capture] Clicking "Cargar Datos de Demostración" on first launch modal...')
      const loadDemoBtn = win.locator('button:has-text("Cargar Datos de Demostración")')
      await loadDemoBtn.click()
      await firstLaunchModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    } else {
      // Ensure demo data is loaded
      await win.evaluate(async () => {
        await window.churchPresenterApi.loadDemoData()
      })
    }

    await win.waitForTimeout(1500)

    // 2. Set up realistic Service with Headers ("MÚSICA", "MENSAJE", "ANUNCIOS")
    console.log('[Capture] Assembling service with section headers and items...')
    await win.evaluate(async () => {
      const services = await window.churchPresenterApi.getServices()
      const songs = await window.churchPresenterApi.getSongs()
      const pres = await window.churchPresenterApi.getPresentations()
      const media = await window.churchPresenterApi.getMediaItems()

      const s1 = songs[0] || { id: 's1', title: 'Castillo Fuerte Es Nuestro Dios' }
      const s2 = songs[1] || { id: 's2', title: 'Sublime Gracia' }
      const p1 = pres[0] || { id: 'p1', title: 'Avisos Comunitarios' }

      const assembledItems = [
        { id: 'h_musica', type: 'header', name: 'MÚSICA Y ALABANZA' },
        { id: 'item_song_1', type: 'song', name: s1.title, songId: s1.id },
        { id: 'item_song_2', type: 'song', name: s2.title, songId: s2.id },
        { id: 'h_mensaje', type: 'header', name: 'MENSAJE / PREDICACIÓN' },
        { id: 'item_scripture_1', type: 'scripture', name: 'Juan 3:16-17', notes: 'Lectura bíblica dominical' },
        { id: 'h_anuncios', type: 'header', name: 'ANUNCIOS Y DESPEDIDA' },
        { id: 'item_pres_1', type: 'presentation', name: p1.title, presentationId: p1.id }
      ]

      const serviceToSave = {
        id: services[0]?.id || `service_${Date.now()}`,
        name: 'Culto Dominical Principal',
        date: new Date().toISOString().split('T')[0],
        items: assembledItems
      }

      await window.churchPresenterApi.saveService(serviceToSave)

      // Start one timer running
      const timers = await window.churchPresenterApi.getTimers()
      if (timers.length > 0) {
        await window.churchPresenterApi.controlTimer(timers[0].id, 'start')
      }

      // Send first slide to live
      if (songs[0]) {
        const slides = [
          {
            id: 'demo_live_slide_1',
            title: s1.title,
            body: 'Castillo fuerte es nuestro Dios, defensa y buen escudo.\nCon su poder nos librará en todo trance agudo.',
            groupLabel: 'Verso 1'
          }
        ]
        await window.churchPresenterApi.sendSlide(slides[0], undefined, {
          id: 'demo_slide_2',
          title: s1.title,
          body: 'Con furia y con afán acósanos Satán;\npor armas deja ver astucia y gran poder.',
          groupLabel: 'Verso 2'
        })
      }
    })

    // Reload window state to ensure UI picks up all assembled items
    await win.evaluate(async () => {
      // Trigger media drawer expansion
      const mediaToggle = document.querySelector('.pro-media-toggle-btn')
      if (mediaToggle && !document.querySelector('.pro-media-drawer-expanded')) {
        mediaToggle.click()
      }
    })

    await win.waitForTimeout(2000)

    // 3. CAPTURE 1: 1920x1080 (Full HD ProPresenter layout)
    console.log('[Capture] Setting window viewport to 1920x1080...')
    await win.setViewportSize({ width: 1920, height: 1080 })
    await win.waitForTimeout(1500)

    const path1080 = path.join(EVIDENCE_DIR, 'ui-operator-1920x1080.png')
    await win.screenshot({ path: path1080 })
    console.log(`[Capture] Saved: ${path1080} (${(fs.statSync(path1080).size / 1024).toFixed(1)} KB)`)

    // 4. CAPTURE 2: 1366x768 (Standard church laptop resolution)
    console.log('[Capture] Setting window viewport to 1366x768...')
    await win.setViewportSize({ width: 1366, height: 768 })
    await win.waitForTimeout(1500)

    const path768 = path.join(EVIDENCE_DIR, 'ui-operator-1366x768.png')
    await win.screenshot({ path: path768 })
    console.log(`[Capture] Saved: ${path768} (${(fs.statSync(path768).size / 1024).toFixed(1)} KB)`)

    // 5. Open output windows and capture output evidence
    console.log('[Capture] Opening output windows to capture output rendering...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.openPreviewOutputWindow('main')
      await window.churchPresenterApi.openPreviewOutputWindow('stage')
      await window.churchPresenterApi.openPreviewOutputWindow('lobby')
    })

    await win.waitForTimeout(3000)
    const allWindows = app.windows()
    for (const w of allWindows) {
      if (w !== win) {
        const url = w.url()
        let role = 'unknown'
        if (url.includes('/output/main')) role = 'main'
        else if (url.includes('/output/stage')) role = 'stage'
        else if (url.includes('/output/lobby')) role = 'lobby'

        const outPath = path.join(EVIDENCE_DIR, `ui-output-${role}.png`)
        await w.screenshot({ path: outPath })
        console.log(`[Capture] Saved output window: ${outPath}`)
      }
    }

    console.log('\n[Capture] All evidence screenshots successfully captured!')
    await app.close()
  } catch (err) {
    console.error('[Capture] Failed to capture evidence:', err)
    await app.close()
    process.exit(1)
  }
}

captureEvidence().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
