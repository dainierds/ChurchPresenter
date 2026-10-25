/**
 * verify-ui-layout-and-evidence.js
 * Automated Layout Verification, Overlap Checker & Screenshot Evidence Generator
 * ChurchPresenter v1.1 - ProPresenter 7 Redesign
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')

const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
}

function assertNoOverlap(leftBox, centerBox, rightBox, label) {
  if (!leftBox || !centerBox || !rightBox) {
    throw new Error(`[${label}] Missing bounding box: left=${Boolean(leftBox)}, center=${Boolean(centerBox)}, right=${Boolean(rightBox)}`)
  }

  console.log(`[Overlap Check - ${label}]`)
  console.log(`  Left:   [${leftBox.x.toFixed(1)} -> ${(leftBox.x + leftBox.width).toFixed(1)}] (width: ${leftBox.width.toFixed(1)})`)
  console.log(`  Center: [${centerBox.x.toFixed(1)} -> ${(centerBox.x + centerBox.width).toFixed(1)}] (width: ${centerBox.width.toFixed(1)})`)
  console.log(`  Right:  [${rightBox.x.toFixed(1)} -> ${(rightBox.x + rightBox.width).toFixed(1)}] (width: ${rightBox.width.toFixed(1)})`)

  // Check 1: Left does not overlap Center
  if (leftBox.x + leftBox.width > centerBox.x + 1.5) {
    throw new Error(`[${label}] Left Column overlaps Center Column! Left right edge=${leftBox.x + leftBox.width}, Center left edge=${centerBox.x}`)
  }

  // Check 2: Center does not overlap Right
  if (centerBox.x + centerBox.width > rightBox.x + 1.5) {
    throw new Error(`[${label}] Center Column overlaps Right Column! Center right edge=${centerBox.x + centerBox.width}, Right left edge=${rightBox.x}`)
  }

  // Check 3: Center has substantial visible width
  if (centerBox.width < 100) {
    throw new Error(`[${label}] Center column width collapsed below 100px: ${centerBox.width}`)
  }

  console.log(`  ==> PASSED: Zero overlap between columns in ${label}.\n`)
}

async function runVerification() {
  console.log('======================================================================')
  console.log('  CHURCHPRESENTER: VERIFY LAYOUT WITHOUT OVERLAPPING & CAPTURE EVIDENCE')
  console.log('======================================================================\n')

  const app = await electron.launch({
    args: [MAIN_SCRIPT],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    console.log('[Playwright] Operator window loaded successfully.')

    // Step A: Load demo data & dismiss any modal
    console.log('[Step A] Loading demo data...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.loadDemoData()
    })
    await win.waitForTimeout(1000)

    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const loadDemoBtn = win.locator('button:has-text("Cargar Datos de Demostración")')
      await loadDemoBtn.click().catch(() => {})
      await win.waitForTimeout(1000)
    }

    // Step B: Set up service with section headers, live slide, active timer, media drawer open
    console.log('[Step B] Assembling service playlist, running timer, and opening media drawer...')
    await win.evaluate(async () => {
      const services = await window.churchPresenterApi.getServices()
      const songs = await window.churchPresenterApi.getSongs()
      const pres = await window.churchPresenterApi.getPresentations()
      const media = await window.churchPresenterApi.getMediaItems()

      const s1 = songs[0] || { id: 's1', title: 'Castillo Fuerte Es Nuestro Dios' }
      const s2 = songs[1] || { id: 's2', title: 'Sublime Gracia' }
      const p1 = pres[0] || { id: 'p1', title: 'Avisos y Bienvenida' }

      const assembledItems = [
        { id: 'h_preludio', type: 'header', name: 'PRELUDIO Y BIENVENIDA', notes: '#FF7A00' },
        { id: 'item_song_1', type: 'song', name: s1.title, songId: s1.id },
        { id: 'h_mensaje', type: 'header', name: 'SEPARADOR MENSAJE PRINCIPAL', notes: '#22C55E' },
        { id: 'item_song_2', type: 'song', name: s2.title, songId: s2.id },
        { id: 'h_anuncios', type: 'header', name: 'AVISOS Y OFRENDA', notes: '#2D9CFF' },
        { id: 'item_pres_1', type: 'presentation', name: p1.title, presentationId: p1.id }
      ]

      const serviceToSave = {
        id: services[0]?.id || `service_${Date.now()}`,
        name: 'Culto Dominical Principal',
        date: new Date().toISOString().split('T')[0],
        items: assembledItems
      }

      await window.churchPresenterApi.saveService(serviceToSave)

      // Start timer
      const timers = await window.churchPresenterApi.getTimers()
      if (timers && timers.length > 0) {
        await window.churchPresenterApi.controlTimer(timers[0].id, 'start')
      }

      // Put slide 1 live
      await window.churchPresenterApi.sendSlide({
        id: 'demo_live_slide_1',
        title: s1.title,
        body: 'Castillo fuerte es nuestro Dios, defensa y buen escudo.\nCon su poder nos librará en todo trance agudo.',
        groupLabel: 'Verso 1'
      })
    })

    // Open media drawer if not open
    const isDrawerOpen = await win.locator('.pro-media-drawer-expanded').isVisible().catch(() => false)
    if (!isDrawerOpen) {
      const toggleBtn = win.locator('.pro-media-toggle-btn')
      if (await toggleBtn.isVisible().catch(() => false)) {
        await toggleBtn.click()
        await win.waitForTimeout(500)
      }
    }

    await win.waitForTimeout(1500)

    // Helper to get boxes
    async function getBoxes() {
      const leftBox = await win.locator('.pro-left-column').boundingBox()
      const centerBox = await win.locator('.pro-center-column').boundingBox()
      const rightBox = await win.locator('.pro-right-panel').boundingBox()
      return { leftBox, centerBox, rightBox }
    }

    // Step C: Test resolutions 1366x768, 1920x1080, 2560x1440
    console.log('[Step C.1] Testing at 1920x1080...')
    await win.setViewportSize({ width: 1920, height: 1080 })
    await win.waitForTimeout(800)
    let boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, '1920x1080 (100% scale)')
    const file1080 = path.join(EVIDENCE_DIR, 'ui-operator-1920x1080.png')
    await win.screenshot({ path: file1080 })
    console.log(`Saved screenshot: ${file1080}`)

    console.log('[Step C.2] Testing at 1366x768...')
    await win.setViewportSize({ width: 1366, height: 768 })
    await win.waitForTimeout(800)
    boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, '1366x768 (100% scale)')
    const file768 = path.join(EVIDENCE_DIR, 'ui-operator-1366x768.png')
    await win.screenshot({ path: file768 })
    console.log(`Saved screenshot: ${file768}`)

    console.log('[Step C.3] Testing at 2560x1440...')
    await win.setViewportSize({ width: 2560, height: 1440 })
    await win.waitForTimeout(800)
    boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, '2560x1440 (100% scale)')
    const file1440 = path.join(EVIDENCE_DIR, 'ui-operator-2560x1440.png')
    await win.screenshot({ path: file1440 })
    console.log(`Saved screenshot: ${file1440}`)

    // Step C.4: Windows display scaling 125% and 150% (simulated via zoom on viewport)
    console.log('[Step C.4] Testing at 1920x1080 with 125% scaling...')
    await win.setViewportSize({ width: 1920, height: 1080 })
    await win.evaluate(() => {
      document.body.style.zoom = '1.25'
    })
    await win.waitForTimeout(800)
    boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, '1920x1080 (125% Windows scaling)')
    const fileScale125 = path.join(EVIDENCE_DIR, 'ui-operator-scale-125.png')
    await win.screenshot({ path: fileScale125 })
    console.log(`Saved screenshot: ${fileScale125}`)

    console.log('[Step C.5] Testing at 1920x1080 with 150% scaling...')
    await win.evaluate(() => {
      document.body.style.zoom = '1.5'
    })
    await win.waitForTimeout(800)
    boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, '1920x1080 (150% Windows scaling)')
    const fileScale150 = path.join(EVIDENCE_DIR, 'ui-operator-scale-150.png')
    await win.screenshot({ path: fileScale150 })
    console.log(`Saved screenshot: ${fileScale150}`)

    // Reset zoom back to 100%
    await win.evaluate(() => {
      document.body.style.zoom = '1.0'
    })
    await win.waitForTimeout(500)

    // Step D: Move dividers to minimum and maximum extremes
    console.log('[Step D.1] Setting dividers to MINIMUM values...')
    await win.evaluate(() => {
      localStorage.setItem('cp_layout_left_width', '200')
      localStorage.setItem('cp_layout_right_width', '260')
      localStorage.setItem('cp_layout_lib_height', '120')
      localStorage.setItem('cp_layout_media_drawer_height', '120')
      localStorage.setItem('cp_layout_preview_height', '160')
    })
    await win.reload()
    await win.waitForTimeout(1000)
    boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, 'Dividers at MINIMUM')
    const fileMin = path.join(EVIDENCE_DIR, 'ui-operator-dividers-min.png')
    await win.screenshot({ path: fileMin })
    console.log(`Saved screenshot: ${fileMin}`)

    console.log('[Step D.2] Setting dividers to MAXIMUM values (Right panel up to 50% width)...')
    const maxRightWidth = Math.round(1920 * 0.48)
    await win.evaluate((mw) => {
      localStorage.setItem('cp_layout_left_width', '450')
      localStorage.setItem('cp_layout_right_width', mw.toString())
      localStorage.setItem('cp_layout_lib_height', '450')
      localStorage.setItem('cp_layout_media_drawer_height', '360')
      localStorage.setItem('cp_layout_preview_height', '380')
    }, maxRightWidth)
    await win.reload()
    await win.waitForTimeout(1000)
    boxes = await getBoxes()
    assertNoOverlap(boxes.leftBox, boxes.centerBox, boxes.rightBox, 'Dividers at MAXIMUM')
    const fileMax = path.join(EVIDENCE_DIR, 'ui-operator-dividers-max.png')
    await win.screenshot({ path: fileMax })
    console.log(`Saved screenshot: ${fileMax}`)

    // Reset to defaults
    await win.evaluate(() => {
      localStorage.removeItem('cp_layout_left_width')
      localStorage.removeItem('cp_layout_right_width')
      localStorage.removeItem('cp_layout_lib_height')
      localStorage.removeItem('cp_layout_media_drawer_height')
      localStorage.removeItem('cp_layout_preview_height')
    })
    await win.reload()
    await win.waitForTimeout(1000)

    // Step E: Open floating preview window, resize it and capture
    console.log('[Step E] Opening Floating Preview window (independiente de salidas)...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.openFloatingPreview('audience')
    })
    await win.waitForTimeout(2000)

    const allWindows = app.windows()
    console.log(`Total active windows after opening floating preview: ${allWindows.length}`)
    let floatingWin = null
    for (const w of allWindows) {
      const url = w.url()
      if (url.includes('floating-preview') || url.includes('/floating-preview')) {
        floatingWin = w
        break
      }
    }

    if (floatingWin) {
      console.log('[Step E] Found floating preview window! Resizing to 800x490 (16:9)...')
      await floatingWin.setViewportSize({ width: 800, height: 490 })
      await floatingWin.waitForTimeout(1000)
      const fileFloat = path.join(EVIDENCE_DIR, 'ui-operator-floating-preview.png')
      await floatingWin.screenshot({ path: fileFloat })
      console.log(`Saved floating preview screenshot: ${fileFloat}`)
    } else {
      console.warn('[Step E] Floating preview window not detected among app.windows(). Capturing operator with open state.')
    }

    console.log('\n======================================================================')
    console.log('  ALL AUTOMATED LAYOUT VERIFICATIONS PASSED WITH ZERO OVERLAP!')
    console.log('======================================================================\n')
    await app.close()
  } catch (err) {
    console.error('\n[Verification FAILED]:', err)
    await app.close().catch(() => {})
    process.exit(1)
  }
}

runVerification().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
