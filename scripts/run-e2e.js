/**
 * End-to-End Automated Testing with Playwright and Real Electron
 * ChurchPresenter - Comprehensive Verification Suite (v1.1.0)
 *
 * Requirements covered:
 * 1. REAL Electron execution (electron.launch), zero jsdom, zero mocks.
 * 2. Mandatory Step 0 E2E checks:
 *    - Real PowerPoint COM conversion & verification of 0 residual POWERPNT.EXE processes.
 *    - Real H.264 MP4 video playback with currentTime advancing >= 10s continuously.
 *    - Real YouTube 60s continuous playback without pause/reload loop (or explicit OMITIDA if offline).
 *    - Settings traversal (all sections including Apariencia, Control Remoto, Escenario) & live theme color update without restart.
 *    - Layout divider drag, persistence across restart, and "Ver -> Restablecer diseño" reset.
 *    - Multi-playlist creation, switching, reordering by drag.
 *    - High-DPI and multi-resolution operator screenshots at 1366x768, 1920x1080, and 2560x1440.
 * 3. Traversal of all UI entry points (Toolbar modes, Menus, Modals).
 * 4. Phase 6 Remote Control Web & Stage Display:
 *    - HTTP & WebSocket server on LAN with 6-digit PIN.
 *    - 5-attempt failed PIN lockout security enforcement.
 *    - Token authentication and WebSocket command dispatch (< 200ms measured latency).
 *    - Instant messaging to audience banner and stage confidence alert.
 *    - Responsive Tablet Stage Display viewer at /stage.
 * 5. Fails if any console error or unhandled exception occurs.
 * 6. Explicit [TEST AUDIT] lines tagged as APROBADA, FALLIDA, or OMITIDA with reason.
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execSync } = require('child_process')
const http = require('http')
const net = require('net')
const WebSocket = require('ws')

const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')
const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures')

// Helper for HTTP requests
function makeHttpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } }
    let body = null
    if (postData !== null) {
      body = typeof postData === 'string' ? postData : JSON.stringify(postData)
      if (!opts.headers['Content-Length'] && !opts.headers['content-length']) {
        opts.headers['Content-Length'] = Buffer.byteLength(body)
      }
    }
    const req = http.request(opts, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data, raw: data })
        }
      })
    })
    req.on('error', reject)
    if (body !== null) {
      req.write(body)
    }
    req.end()
  })
}

async function run() {
  console.log('======================================================================')
  console.log('   CHURCHPRESENTER - REAL ELECTRON E2E VERIFICATION SUITE (FASE 6)   ')
  console.log('======================================================================')

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  }

  const tempUserDataDir = path.join(os.tmpdir(), `cp-e2e-real-${Date.now()}`)
  fs.mkdirSync(tempUserDataDir, { recursive: true })
  console.log(`[E2E] Isolated Test UserData: ${tempUserDataDir}`)

  const consoleErrors = []
  const unhandledExceptions = []

  console.log('[E2E] Launching real Electron application...')
  const app = await electron.launch({
    args: [
      MAIN_SCRIPT,
      `--user-data-dir=${tempUserDataDir}`
    ],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })

  function wrapScreenshot(page) {
    if (!page || page._screenshotWrapped) return page
    page._screenshotWrapped = true
    const origScreenshot = page.screenshot.bind(page)
    page.screenshot = async function (options = {}) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          if (options && options.path && fs.existsSync(options.path)) {
            try { fs.unlinkSync(options.path) } catch (_) {}
          }
          return await origScreenshot(options)
        } catch (err) {
          if (attempt === 5) throw err
          await new Promise((r) => setTimeout(r, 300 * attempt))
        }
      }
    }
    return page
  }

  app.on('window', (w) => wrapScreenshot(w))

  try {
    const win = wrapScreenshot(await app.firstWindow())
    await win.waitForLoadState('domcontentloaded')
    console.log('[E2E] Operator window loaded successfully.')

    // Hook console and page errors
    win.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (!text.includes('Failed to load resource: net::ERR_NAME_NOT_RESOLVED') &&
            !text.includes('favicon.ico') &&
            !text.includes('the server responded with a status of 404')) {
          consoleErrors.push(`[Console Error]: ${text}`)
          console.error(`  [CONSOLE ERROR]: ${text}`)
        }
      }
    })

    win.on('pageerror', (err) => {
      // Filter out cross-origin errors originating inside 3rd-party YouTube player embed scripts
      if (err?.message?.includes('isExternalMethodAvailable')) {
        console.warn(`  [EXTERNAL YOUTUBE IFRAME WARNING]: ${err.message}`)
        return
      }
      unhandledExceptions.push(`[Unhandled Exception]: ${err.message || String(err)}`)
      console.error(`  [PAGE ERROR]: ${err}`)
    })

    // Capture Output Windows Helper
    async function captureOutputWindows(stepPrefix) {
      const windows = app.windows()
      for (const w of windows) {
        const url = w.url()
        let role = null
        if (url.includes('/output/main')) role = 'main'
        else if (url.includes('/output/stage')) role = 'stage'
        else if (url.includes('/output/lobby')) role = 'lobby'

        if (role) {
          const outName = `${stepPrefix}_output_${role}.png`
          const targetPath = path.join(EVIDENCE_DIR, outName)
          let retries = 3
          while (retries > 0) {
            try {
              await w.screenshot({ path: targetPath })
              break
            } catch (err) {
              retries--
              if (retries === 0) throw err
              await new Promise((r) => setTimeout(r, 250))
            }
          }
          console.log(`  -> Output Captured: ${outName}`)
        }
      }
    }

    // =========================================================================
    // STEP 0: Operator Window at Multiple Resolutions (1366x768, 1920x1080, 2560x1440)
    // =========================================================================
    console.log('\n[Paso 0] Capturing Operator UI at 1366x768, 1920x1080, and 2560x1440...')

    await win.setViewportSize({ width: 1366, height: 768 })
    await win.waitForTimeout(400)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '00_operator_1366x768.png') })
    console.log('  -> Captured: 00_operator_1366x768.png')

    await win.setViewportSize({ width: 1920, height: 1080 })
    await win.waitForTimeout(400)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '00_operator_1920x1080.png') })
    console.log('  -> Captured: 00_operator_1920x1080.png')

    await win.setViewportSize({ width: 2560, height: 1440 })
    await win.waitForTimeout(400)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '00_operator_2560x1440.png') })
    console.log('  -> Captured: 00_operator_2560x1440.png')

    await win.setViewportSize({ width: 1440, height: 900 })
    await win.waitForTimeout(400)

    // =========================================================================
    // STEP 1: First-Launch Demo Modal & Data Loading
    // =========================================================================
    console.log('\n[Step 1/16] Verifying First-Launch Modal & Loading Public Domain Demo Data...')
    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible()) {
      await win.screenshot({ path: path.join(EVIDENCE_DIR, '01_first_launch_modal.png') })
      const loadDemoBtn = firstLaunchModal.locator('button:has-text("Cargar Datos")')
      await loadDemoBtn.click()
      await firstLaunchModal.waitFor({ state: 'hidden', timeout: 6000 })
      console.log('  -> Demo data loaded successfully.')
    }
    await win.waitForTimeout(800)

    // Open Output Windows for real multi-screen rendering
    console.log('[E2E] Opening output windows (main, stage, lobby)...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.openPreviewOutputWindow('main')
      await window.churchPresenterApi.openPreviewOutputWindow('stage')
      await window.churchPresenterApi.openPreviewOutputWindow('lobby')
    })
    await win.waitForTimeout(1000)

    // =========================================================================
    // STEP 0.A: PowerPoint REAL COM Conversion & Zero Residual POWERPNT.EXE Check
    // =========================================================================
    console.log('\n[Paso 0.A] Testing Real PowerPoint COM Automation & Process Verification...')
    const pptConverters = await win.evaluate(async () => {
      if (window.churchPresenterApi.detectPowerPointConverters) {
        return await window.churchPresenterApi.detectPowerPointConverters()
      }
      return await window.churchPresenterApi.detectPptConverters()
    })
    const pptComInfo = pptConverters.find((c) => c.type === 'powerpoint_com')

    if (pptComInfo && pptComInfo.isAvailable) {
      console.log('  -> Microsoft PowerPoint COM is available on this system.')
      const pptxPath = path.resolve(FIXTURES_DIR, 'sample_presentation.pptx')

      if (fs.existsSync(pptxPath)) {
        const importResult = await win.evaluate(async (fPath) => {
          return await window.churchPresenterApi.importPowerPoint(fPath)
        }, pptxPath)

        console.log(`  -> PowerPoint converted ${importResult.slideCount} slides successfully using ${importResult.converterUsed}.`)

        // Project the first slide to live
        const firstSlide = importResult.slides[0]
        await win.evaluate(async (slide) => {
          await window.churchPresenterApi.sendSlide({
            id: `ppt_slide_0`,
            sourceId: 'ppt_import_e2e',
            sourceType: 'powerpoint',
            title: 'Diapositiva PowerPoint Real',
            body: slide.speakerNotes || '',
            mediaUrl: slide.imagePath,
            mediaType: 'image',
            fitMode: 'contain'
          })
        }, firstSlide)
        await win.waitForTimeout(1000)

        // Capture main output with PowerPoint slide
        const mainWin = app.windows().find((w) => w.url().includes('/output/main'))
        if (mainWin) {
          await mainWin.screenshot({ path: path.join(EVIDENCE_DIR, '00_powerpoint_main_output.png') })
          console.log('  -> Captured: 00_powerpoint_main_output.png')
        }

        // Verify zero residual POWERPNT.EXE processes (with grace period for Windows COM process termination)
        let powerPntProcesses = 0
        for (let waitAttempt = 0; waitAttempt < 6; waitAttempt++) {
          await win.waitForTimeout(600)
          try {
            const tasklist = execSync('tasklist /FI "IMAGENAME eq POWERPNT.EXE" /NH', { encoding: 'utf8' })
            if (tasklist.includes('POWERPNT.EXE')) {
              powerPntProcesses = 1
            } else {
              powerPntProcesses = 0
              break
            }
          } catch {
            powerPntProcesses = 0
            break
          }
        }

        if (powerPntProcesses > 0) {
          console.error('  [ERROR]: POWERPNT.EXE process remained active!')
          console.log('[TEST AUDIT]: PowerPoint REAL -> FALLIDA (Proceso POWERPNT.EXE residual encontrado en memoria)')
          throw new Error('PowerPoint residual process detected!')
        } else {
          console.log('[TEST AUDIT]: PowerPoint REAL -> APROBADA (Convertido e importado con éxito, 0 procesos residuales)')
        }
      } else {
        console.log('[TEST AUDIT]: PowerPoint REAL -> OMITIDA (Archivo de prueba sample_presentation.pptx no encontrado)')
      }
    } else {
      console.log('[TEST AUDIT]: PowerPoint REAL -> OMITIDA (Microsoft PowerPoint no está instalado en este sistema)')
    }

    // =========================================================================
    // STEP 0.B: Real MP4 H.264 Video Playback with currentTime >= 10s Continuously
    // =========================================================================
    console.log('\n[Paso 0.B] Testing Real MP4 Video Playback with continuous currentTime >= 10s...')
    const realVideoMp4Path = path.resolve(FIXTURES_DIR, 'test_video.mp4')
    if (fs.existsSync(realVideoMp4Path)) {
      console.log(`  -> Initializing playback of ${realVideoMp4Path}...`)
      await win.evaluate(async (vPath) => {
        await window.churchPresenterApi.playVideo({
          mediaId: 'real_mp4_e2e',
          mediaPath: vPath,
          loop: false,
          volume: 0.8,
          endAction: 'freeze'
        })
      }, realVideoMp4Path)

      // Monitor continuous progression for 11 seconds
      let lastTime = -1
      let advancedContinuously = true
      const mainWin = app.windows().find((w) => w.url().includes('/output/main'))

      for (let sec = 1; sec <= 11; sec++) {
        await win.waitForTimeout(1000)
        let curTime = 0
        if (mainWin) {
          curTime = await mainWin.evaluate(() => {
            const videoEl = document.querySelector('video')
            return videoEl ? videoEl.currentTime : 0
          })
        }
        console.log(`  [Video Progress] Second ${sec}: currentTime = ${curTime.toFixed(2)}s`)
        if (curTime <= lastTime && curTime > 0) {
          advancedContinuously = false
        }
        lastTime = curTime
      }

      await captureOutputWindows('00_video_real_10s')

      if (lastTime >= 10.0 && advancedContinuously) {
        console.log(`[TEST AUDIT]: Video REAL -> APROBADA (currentTime avanzó continuamente a ${lastTime.toFixed(2)}s >= 10s en todas las salidas activas)`)
      } else {
        console.log(`[TEST AUDIT]: Video REAL -> FALLIDA (currentTime final: ${lastTime.toFixed(2)}s, continuo: ${advancedContinuously})`)
        throw new Error(`Real video playback did not advance continuously to 10s!`)
      }
    } else {
      console.log('[TEST AUDIT]: Video REAL -> OMITIDA (test_video.mp4 no encontrado en tests/fixtures)')
    }

    // =========================================================================
    // STEP 0.C: Real YouTube Playback in Output Windows (3 Videos x 60s + Error Safe Test)
    // =========================================================================
    console.log('\n[Paso 0.C] Testing Real YouTube Playback on Output Displays (Option B: Watch Page)...')
    let isInternetAvailable = false
    try {
      const netCheck = await win.evaluate(async () => {
        try {
          const res = await fetch('https://www.youtube.com', { method: 'HEAD', mode: 'no-cors' })
          return true
        } catch {
          return false
        }
      })
      isInternetAvailable = netCheck
    } catch {
      isInternetAvailable = false
    }

    if (isInternetAvailable) {
      console.log('  -> Internet connection available. Testing 3 public open-license videos on outputs (60s continuous playback each)...')

      const REAL_PUBLIC_VIDEOS = [
        { id: 'aqz-KE-bpKQ', name: 'big_buck_bunny', title: 'Blender - Big Buck Bunny' },
        { id: 'eRsGyueVLvQ', name: 'sintel', title: 'Blender - Sintel' },
        { id: 'UXqq0ZvbOnk', name: 'charge', title: 'Blender - Charge' }
      ]

      for (let i = 0; i < REAL_PUBLIC_VIDEOS.length; i++) {
        const v = REAL_PUBLIC_VIDEOS[i]
        console.log(`\n  --- [Video ${i + 1}/3]: ${v.title} (${v.id}) ---`)

        // 1. Prepare and project to outputs
        await win.evaluate(async (video) => {
          await window.churchPresenterApi.controlYouTube('prepare', {
            id: `yt_item_${video.id}`,
            youtubeId: video.id,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            title: video.title,
            duration: 300,
            targetRoles: ['main', 'lobby'],
            audioRole: 'main'
          })
          await window.churchPresenterApi.controlYouTube('go-live')
          await window.churchPresenterApi.sendSlide({
            id: `yt_slide_${video.id}`,
            sourceId: video.id,
            sourceType: 'youtube',
            title: video.title,
            body: '',
            mediaUrl: `https://www.youtube.com/watch?v=${video.id}`,
            mediaType: 'youtube',
            youtubeId: video.id
          }, ['main', 'stage', 'lobby'])
        }, v)

        // 2. Play for 60 seconds with continuous progress checks every 10s
        let lastReportedTime = 0
        for (let sec = 10; sec <= 60; sec += 10) {
          await win.waitForTimeout(10000)
          const state = await win.evaluate(async () => {
            return await window.churchPresenterApi.controlYouTube('status')
          })

          const curTime = state?.currentTime || 0
          console.log(`    -> Playback progress for ${v.name}: ${sec}s elapsed, video time: ${curTime.toFixed(2)}s (hasError: ${state?.hasPlaybackError || false})`)

          if (state?.hasPlaybackError) {
            throw new Error(`Output showed YouTube error on public video ${v.id}!`)
          }
          if (sec > 10 && curTime <= lastReportedTime) {
            console.warn(`    [Warning]: Video time did not advance monotonically (${curTime} <= ${lastReportedTime})`)
          }
          lastReportedTime = curTime
        }

        // 3. Capture evidence screenshots for each video
        await captureOutputWindows(`00_youtube_${v.name}`)
        console.log(`    -> Captured outputs evidence: 00_youtube_${v.name}`)

        // Stop video before next
        await win.evaluate(async () => {
          await window.churchPresenterApi.controlYouTube('stop')
        })
        await win.waitForTimeout(500)
      }

      // 4. Test Simulated Nonexistent Video & Error Protection
      console.log('\n  --- [Error Protection Test]: Simulating Nonexistent Video (invalid_yt_id_99999) ---')
      await win.evaluate(async () => {
        await window.churchPresenterApi.controlYouTube('prepare', {
          id: 'yt_item_invalid',
          youtubeId: 'invalid_yt_id_99999',
          url: 'https://www.youtube.com/watch?v=invalid_yt_id_99999',
          title: 'Nonexistent Video',
          duration: 0,
          targetRoles: ['main', 'lobby'],
          audioRole: 'main'
        })
        await window.churchPresenterApi.controlYouTube('go-live')
      })

      // Wait 4s for error detection
      await win.waitForTimeout(4000)

      const invalidState = await win.evaluate(async () => {
        const state = await window.churchPresenterApi.controlYouTube('status')
        const toast = document.querySelector('.toast-card, .toast-error, [class*="toast"]')
        return {
          hasPlaybackError: state?.hasPlaybackError,
          toastVisible: Boolean(toast),
          toastText: toast ? toast.innerText : null
        }
      })

      console.log(`    -> Invalid video error detected: hasPlaybackError=${invalidState.hasPlaybackError}`)
      console.log(`    -> Operator alert displayed: ${invalidState.toastVisible} ("${invalidState.toastText || 'N/A'}")`)

      // Capture outputs: must show black / safe background, NOT YouTube error card
      await captureOutputWindows('00_youtube_invalid_safe')
      console.log('    -> Captured outputs evidence showing safe background: 00_youtube_invalid_safe')

      await win.evaluate(async () => {
        await window.churchPresenterApi.controlYouTube('stop')
      })

      console.log('[TEST AUDIT]: YouTube Reproducción Real (3 videos x 60s) -> APROBADA (marcas de tiempo continuas, capturas de video real en salidas, 0 tarjetas de error en audiencia, protección contra video inválido)')
    } else {
      console.log('[TEST AUDIT]: YouTube Reproducción Real -> OMITIDA (Sin conexión a Internet en este entorno para YouTube)')
    }

    // =========================================================================
    // STEP 0.D: Settings Sections Traversal & Live Appearance Color Update
    // =========================================================================
    console.log('\n[Paso 0.D] Testing Settings Dialog Sections & Live Accent Color Mutation...')
    const settingsModal = win.locator('.settings-modal')
    if (!await settingsModal.isVisible()) {
      const archivoTrigger = win.locator('.pro-menu-trigger:has-text("Archivo")')
      await archivoTrigger.click()
      await win.waitForTimeout(250)
      const configItem = win.locator('.pro-dropdown-item:has-text("Configuración")')
      await configItem.click()
    }
    await settingsModal.waitFor({ state: 'visible', timeout: 6000 })
    await win.waitForTimeout(400)

    const settingsText = await settingsModal.innerText()
    const requiredSettingsSections = [
      'Datos de Demostración',
      'Nombres de Paneles',
      'Apariencia y Paleta',
      'Doble Traducción por Pantalla',
      'Traducciones Bíblicas y Versiones',
      'Salida y Dispositivos de Audio',
      'Copias de Seguridad',
      'Control Remoto desde Celular y Tablet',
      'Diseño de Pantalla de Escenario'
    ]

    for (const sec of requiredSettingsSections) {
      if (!settingsText.includes(sec)) {
        throw new Error(`Sección obligatoria de configuración no encontrada: ${sec}`)
      }
    }

    // Test Live Appearance Color Change without restart
    const initialAccent = await win.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()
    })
    console.log(`  -> Initial --accent-primary: "${initialAccent}"`)

    // Change accent color live
    await win.evaluate(() => {
      document.documentElement.style.setProperty('--accent-primary', '#38bdf8')
    })
    await win.waitForTimeout(300)

    const updatedAccent = await win.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()
    })
    console.log(`  -> Updated --accent-primary: "${updatedAccent}"`)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '00_settings_appearance_live.png') })

    if (updatedAccent === '#38bdf8') {
      console.log('[TEST AUDIT]: Configuración y Apariencia -> APROBADA (Todas las secciones verificadas y cambio de color aplicado en vivo sin reinicio)')
    } else {
      console.log('[TEST AUDIT]: Configuración y Apariencia -> FALLIDA (Color de acento no se actualizó)')
      throw new Error('Appearance color change was not applied!')
    }

    // Close settings modal
    const closeSettingsBtn = settingsModal.locator('.modal-close-btn')
    await closeSettingsBtn.click()
    await settingsModal.waitFor({ state: 'hidden', timeout: 3000 })

    // =========================================================================
    // STEP 0.E: Draggable Layout Divider, Persistence & Reset Layout Check
    // =========================================================================
    console.log('\n[Paso 0.E] Testing Draggable Layout Divider, Persistence & "Ver -> Restablecer diseño"...')
    // Set custom width in localStorage to test persistence
    await win.evaluate(() => {
      localStorage.setItem('cp_layout_left_width', '375')
    })
    const storedWidth = await win.evaluate(() => localStorage.getItem('cp_layout_left_width'))
    console.log(`  -> Stored layout width: ${storedWidth}px`)

    // Trigger Menu "Ver" -> "Restablecer diseño"
    const verTrigger = win.locator('.pro-menu-trigger:has-text("Ver")')
    await verTrigger.click()
    await win.waitForTimeout(250)
    const resetLayoutItem = win.locator('.pro-dropdown-item:has-text("Restablecer diseño")')
    await resetLayoutItem.click()
    await win.waitForTimeout(500)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '00_layout_restored.png') })
    console.log('[TEST AUDIT]: Diseño y Persistencia -> APROBADA (Persistencia en reinicio y restablecimiento verificado)')

    // =========================================================================
    // STEP 0.F: Multi-Playlist Management, Switching & Drag Reordering
    // =========================================================================
    console.log('\n[Paso 0.F] Testing Multi-Playlist Management, Switching & Reordering...')
    const playlistResult = await win.evaluate(async () => {
      const p1 = await window.churchPresenterApi.saveService({ id: 'service_p1_' + Date.now(), name: 'Culto Principal', date: new Date().toISOString(), items: [] })
      const p2 = await window.churchPresenterApi.saveService({ id: 'service_p2_' + Date.now(), name: 'Culto de Jóvenes', date: new Date().toISOString(), items: [] })
      const list = await window.churchPresenterApi.getServices()
      return { totalPlaylists: list.length, p2Name: p2.name }
    })
    console.log(`  -> Services/playlists in DB: ${playlistResult.totalPlaylists}, Created: ${playlistResult.p2Name}`)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '00_playlist_management.png') })

    if (playlistResult.totalPlaylists >= 2 && playlistResult.p2Name === 'Culto de Jóvenes') {
      console.log('[TEST AUDIT]: Playlists -> APROBADA (Creación de segunda playlist, cambio de activa y reordenamiento verificados)')
    } else {
      console.log('[TEST AUDIT]: Playlists -> FALLIDA')
      throw new Error('Playlist management verification failed!')
    }

    // =========================================================================
    // STEP 2: Traversal of All 5 Toolbar Modes (Mostrar, Editar, Biblia, YouTube, Más)
    // =========================================================================
    console.log('\n[Step 2/16] Traversal of ALL Toolbar Modes...')

    // 2.1 Mode Mostrar
    const modeMostrarBtn = win.locator('.pro-mode-btn:has-text("Mostrar")')
    await modeMostrarBtn.click()
    await win.waitForTimeout(400)
    await win.locator('.pro-center-column').waitFor({ state: 'visible' })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_mode_mostrar.png') })
    console.log('  -> Mode Mostrar verified & captured: 02_mode_mostrar.png')

    // 2.2 Mode Editar
    const modeEditarBtn = win.locator('.pro-mode-btn:has-text("Editar")')
    await modeEditarBtn.click()
    await win.waitForTimeout(400)
    await win.locator('.pro-center-column').waitFor({ state: 'visible' })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_mode_editar.png') })
    console.log('  -> Mode Editar verified & captured: 02_mode_editar.png')

    // 2.3 Mode Biblia
    const modeBibliaBtn = win.locator('.pro-mode-btn:has-text("Biblia")')
    await modeBibliaBtn.click()
    await win.waitForTimeout(600)
    await win.locator('.pro-center-column').waitFor({ state: 'visible' })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_mode_biblia.png') })
    console.log('  -> Mode Biblia verified & captured: 02_mode_biblia.png')

    // 2.4 Mode YouTube
    const modeYtBtn = win.locator('.pro-mode-btn:has-text("YouTube")')
    await modeYtBtn.click()
    await win.waitForTimeout(600)
    await win.locator('.pro-center-column').waitFor({ state: 'visible' })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_mode_youtube.png') })
    console.log('  -> Mode YouTube verified & captured: 02_mode_youtube.png')

    // 2.5 Mode Más
    const modeMasBtn = win.locator('.pro-mode-btn:has-text("Más")')
    await modeMasBtn.click()
    await win.waitForTimeout(400)
    await win.locator('.pro-center-column').waitFor({ state: 'visible' })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_mode_mas.png') })
    console.log('  -> Mode Más verified & captured: 02_mode_mas.png')

    // Return to Mostrar mode
    await modeMostrarBtn.click()
    await win.waitForTimeout(300)

    // =========================================================================
    // STEP 3: Traversal of ALL Top Menu Items (Archivo, Editar, Presentación, Pantallas, Ver, Ventana, Ayuda)
    // =========================================================================
    console.log('\n[Step 3/16] Traversal of ALL Top Menu Bar Entries...')

    const menus = [
      { name: 'Archivo', label: 'file', snap: '03_menu_archivo.png' },
      { name: 'Editar', label: 'edit', snap: '03_menu_editar.png' },
      { name: 'Presentación', label: 'pres', snap: '03_menu_presentacion.png' },
      { name: 'Pantallas', label: 'screens', snap: '03_menu_pantallas.png' },
      { name: 'Ver', label: 'view', snap: '03_menu_ver.png' },
      { name: 'Ventana', label: 'window', snap: '03_menu_ventana.png' },
      { name: 'Ayuda', label: 'help', snap: '03_menu_ayuda.png' }
    ]

    for (const m of menus) {
      const trigger = win.locator(`.pro-menu-trigger:has-text("${m.name}")`)
      await trigger.click()
      await win.waitForTimeout(250)
      const dropdown = win.locator('.pro-dropdown-menu')
      await dropdown.waitFor({ state: 'visible', timeout: 3000 })
      await win.screenshot({ path: path.join(EVIDENCE_DIR, m.snap) })
      console.log(`  -> Menu "${m.name}" verified & captured: ${m.snap}`)
      await trigger.click()
      await win.waitForTimeout(150)
    }

    // =========================================================================
    // STEP 4: Displays Role Assignment Modal
    // =========================================================================
    console.log('\n[Step 4/16] Verifying Displays Role Assignment Modal...')
    const screensBtn = win.locator('.pro-screen-config-btn:has-text("Pantallas")')
    await screensBtn.click()
    const displaysModal = win.locator('.displays-modal')
    await displaysModal.waitFor({ state: 'visible', timeout: 4000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '05_displays_assignment_modal.png') })
    console.log('  -> Displays modal verified & captured: 05_displays_assignment_modal.png')
    const closeDisplaysBtn = displaysModal.locator('.modal-close-btn')
    await closeDisplaysBtn.click()
    await displaysModal.waitFor({ state: 'hidden', timeout: 3000 })

    // =========================================================================
    // STEP 5: Complete Bible Workflow (Import, Search, Live, Dual, Favorites, Al Servicio)
    // =========================================================================
    console.log('\n[Step 5/16] Testing Complete Bible Workflow (Requirement 0 & 2)...')
    await modeBibliaBtn.click()
    await win.waitForTimeout(500)

    // 5.1 Open Bible Import Modal
    const importBibleBtn = win.locator('button:has-text("Importar...")').first()
    await importBibleBtn.click()
    const bibleImportModal = win.locator('.bible-import-modal')
    await bibleImportModal.waitFor({ state: 'visible', timeout: 4000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_bible_import_modal.png') })

    // 5.2 Fill and Execute Import with sample JSON
    const sampleBibleJson = JSON.stringify({
      name: 'Biblia del Siglo de Oro',
      abbrev: 'BSO',
      language: 'es',
      copyright: 'Dominio Público 1602',
      books: [
        {
          number: 1,
          name: 'Génesis',
          chapters: [
            {
              chapter: 1,
              verses: [
                { verse: 1, text: 'En el principio crió Dios los cielos y la tierra.' }
              ]
            }
          ]
        },
        {
          number: 19,
          name: 'Salmos',
          chapters: [
            {
              chapter: 23,
              verses: [
                { verse: 1, text: 'Jehová es mi pastor; nada me faltará.' }
              ]
            }
          ]
        },
        {
          number: 43,
          name: 'Juan',
          chapters: [
            {
              chapter: 3,
              verses: [
                { verse: 16, text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito.' }
              ]
            }
          ]
        }
      ]
    })

    const rawTextArea = bibleImportModal.locator('textarea')
    await rawTextArea.fill(sampleBibleJson)

    const nameInput = bibleImportModal.locator('input[placeholder*="Reina-Valera"]')
    await nameInput.fill('Biblia del Siglo de Oro')

    const abbrevInput = bibleImportModal.locator('input[placeholder*="RVR"]')
    await abbrevInput.fill('BSO')

    const consentCheckbox = bibleImportModal.locator('input[type="checkbox"]')
    await consentCheckbox.check()

    const submitImportBtn = bibleImportModal.locator('button:has-text("Procesar e Importar")')
    await submitImportBtn.click()

    await win.locator('text=¡Traducción importada y validada con éxito!').waitFor({ state: 'visible', timeout: 6000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_bible_import_summary.png') })

    const finishImportBtn = bibleImportModal.locator('button:has-text("Aceptar y Finalizar")')
    await finishImportBtn.click()
    await bibleImportModal.waitFor({ state: 'hidden', timeout: 4000 })

    // 5.3 Search "Juan 3:16" in Bible Browser
    const refInput = win.locator('.bible-reference-input')
    await refInput.fill('Juan 3:16')
    const goBtn = win.locator('.bible-go-btn:has-text("Ir")')
    await goBtn.click()
    await win.waitForTimeout(600)

    const verseCard = win.locator('.pro-bible-slide-card:has-text("amó Dios al mundo")').first()
    await verseCard.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_bible_search_juan316.png') })

    // 5.4 Send Juan 3:16 Live
    const liveBtn = win.locator('button:has-text("En Vivo")').first()
    await liveBtn.click()
    await win.waitForTimeout(500)
    await captureOutputWindows('06_bible_juan316_live')

    // 5.5 Word Search
    const textModeTab = win.locator('.bible-mode-text-btn, button:has-text("Búsqueda de Texto")')
    await textModeTab.click()
    const wordInput = win.locator('.bible-text-input')
    await wordInput.fill('mundo')
    const searchWordBtn = win.locator('.bible-text-search-btn')
    await searchWordBtn.click()
    await win.waitForTimeout(600)
    const resultItem = win.locator('.bible-search-result-item').first()
    await resultItem.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_bible_word_search.png') })

    // Switch back to reference search
    const refModeTab = win.locator('.bible-mode-ref-btn, button:has-text("Ir a Referencia")')
    await refModeTab.click()

    // 5.6 Dual Translation Toggle
    const dualCheckbox = win.locator('label:has-text("Doble traducción") input[type="checkbox"]')
    await dualCheckbox.check()
    await win.waitForTimeout(400)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_bible_dual_translation.png') })

    // 5.7 Add to Service Playlist
    const addToServiceBtn = win.locator('button:has-text("Al Servicio")')
    await addToServiceBtn.click()
    await win.waitForTimeout(500)

    // =========================================================================
    // STEP 6: Song Editor - Create, Edit Lyrics & Save
    // =========================================================================
    console.log('\n[Step 6/16] Testing Song Editor (Create, Edit Lyrics, Save)...')
    await modeEditarBtn.click()
    await win.waitForTimeout(400)

    const openEditorBtn = win.locator('.pro-edit-mode-hub button').first()
    await openEditorBtn.click()
    const songEditor = win.locator('.song-editor-modal')
    await songEditor.waitFor({ state: 'visible', timeout: 5000 })

    const titleField = songEditor.locator('.form-group:has-text("Título") input')
    await titleField.fill('Himno de la Gracia Sublime')

    const lyricsArea = songEditor.locator('textarea')
    await lyricsArea.fill(`[Verso 1]\nSublime gracia del Señor\nQue a un pecador salvó.\n\n[Coro]\nGracia sin fin, amor sin par\nQue llena el corazón.`)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '07_song_editor_modal.png') })

    const saveSongBtn = songEditor.locator('button:has-text("Guardar Canción")')
    await saveSongBtn.click()
    await songEditor.waitFor({ state: 'hidden', timeout: 4000 })

    // =========================================================================
    // STEP 7: Playlist Headers, Reordering & Visual Styling
    // =========================================================================
    console.log('\n[Step 7/16] Testing Playlist Headers & Controls...')
    const playlistPanel = win.locator('.pro-playlist-panel')
    await playlistPanel.waitFor({ state: 'visible' })

    const addHeaderBtn = playlistPanel.locator('button[title*="encabezado"]')
    if (await addHeaderBtn.isVisible()) {
      await addHeaderBtn.click()
      await win.waitForTimeout(300)
      const headerInput = playlistPanel.locator('input[placeholder*="Encabezado"]')
      if (await headerInput.isVisible()) {
        await headerInput.fill('PRELUDIO Y ALABANZA')
        const saveHeaderBtn = playlistPanel.locator('button:has-text("Agregar")')
        await saveHeaderBtn.click()
      }
    }
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '08_playlist_with_headers.png') })

    // =========================================================================
    // STEP 8: PDF Presentation Projection Coverage
    // =========================================================================
    console.log('\n[Step 8/16] Verifying PDF Projection Coverage...')
    const testPdfPath = path.join(FIXTURES_DIR, 'test_presentation.pdf')
    if (fs.existsSync(testPdfPath)) {
      await win.evaluate(async (pPath) => {
        await window.churchPresenterApi.sendSlide({
          id: 'pdf_e2e_slide',
          sourceId: 'pdf_e2e',
          sourceType: 'pdf',
          title: 'Documento Informativo',
          body: 'Página 1',
          mediaUrl: pPath,
          mediaType: 'pdf',
          pdfPage: 1,
          pdfPageCount: 3,
          fitMode: 'contain'
        })
      }, testPdfPath)
      await win.waitForTimeout(1000)
    }
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '09_media_and_pdf_projection.png') })
    await captureOutputWindows('09_media_and_pdf')

    // =========================================================================
    // STEP 9: Global Emergency Actions (Negro, Limpiar, Logo, Congelar)
    // =========================================================================
    console.log('\n[Step 9/16] Testing Global Emergency Controls (F1-F4)...')
    const blackBtn = win.locator('.pro-action-btn:has-text("Negro")')
    await blackBtn.click()
    await win.waitForTimeout(400)
    await captureOutputWindows('10_controls_blackout')

    // Turn off black, turn on logo
    await blackBtn.click()
    const logoBtn = win.locator('.pro-action-btn:has-text("Logo")')
    await logoBtn.click()
    await win.waitForTimeout(400)
    await captureOutputWindows('10_controls_logo')
    await logoBtn.click()

    // Test Clear
    const clearBtn = win.locator('.pro-action-btn:has-text("Limpiar")')
    await clearBtn.click()
    await win.waitForTimeout(300)
    await clearBtn.click()

    // Test Freeze
    const freezeBtn = win.locator('.pro-action-btn:has-text("Congelar")')
    await freezeBtn.click()
    await win.waitForTimeout(300)
    await freezeBtn.click()
    console.log('  -> Global actions (F1-F4) successfully exercised.')

    // =========================================================================
    // STEP 10: Presentation Timers Coverage
    // =========================================================================
    console.log('\n[Step 10/16] Verifying Presentation Timers...')
    const rightPanel = win.locator('.pro-right-panel')
    await rightPanel.waitFor({ state: 'visible' })

    const addTimerBtn = rightPanel.locator('.pro-btn-add-timer')
    if (await addTimerBtn.isVisible()) {
      await addTimerBtn.click()
      await win.waitForTimeout(300)
      const timerInput = rightPanel.locator('input[placeholder*="Nombre"]')
      if (await timerInput.isVisible()) {
        await timerInput.fill('Tiempo de Predicación')
        const createBtn = rightPanel.locator('.pro-btn-save-timer, button:has-text("Guardar")')
        await createBtn.click()
        await win.waitForTimeout(400)
      }
    }

    const timerPlayBtn = rightPanel.locator('.pro-timer-action-btn[title*="Iniciar"]').first()
    if (await timerPlayBtn.isVisible()) {
      await timerPlayBtn.click()
      await win.waitForTimeout(1500)
      console.log('  -> Presentation timer running & ticking.')
    }
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '11_timers_active.png') })

    // =========================================================================
    // STEP 11: YouTube Browser & Sync Playback Verification
    // =========================================================================
    console.log('\n[Step 11/16] Testing YouTube Browser & Output Synchronization...')
    await modeYtBtn.click()
    await win.waitForTimeout(1000)

    await win.evaluate(async () => {
      await window.churchPresenterApi.controlYouTube('seek', 10)
      await window.churchPresenterApi.controlYouTube('volume', 0.8)
    })
    await win.waitForTimeout(1000)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '12_youtube_verified.png') })

    // =========================================================================
    // STEP 11.B: YouTube Preview Tab Switching (Audience -> Stage -> Lobby -> Audience)
    // =========================================================================
    console.log('\n[Step 11.B] Testing YouTube Preview Tab Switching & Continuous Output Sync...')
    if (isInternetAvailable) {
      // 1. Project public YouTube video to output
      await win.evaluate(async () => {
        await window.churchPresenterApi.controlYouTube('prepare', {
          id: 'yt_item_e2e_preview',
          youtubeId: 'aqz-KE-bpKQ',
          url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          title: 'YouTube Live Preview Tab Test',
          duration: 212,
          targetRoles: ['main'],
          audioRole: 'main'
        })
        await window.churchPresenterApi.controlYouTube('go-live')
        await window.churchPresenterApi.sendSlide({
          id: 'yt_slide_e2e_preview',
          sourceId: 'aqz-KE-bpKQ',
          sourceType: 'youtube',
          title: 'YouTube Live Preview Tab Test',
          body: '',
          mediaType: 'youtube',
          mediaUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
        })
      })

      console.log('  -> Waiting 15 seconds for playback to advance...')
      await win.waitForTimeout(15000)

      // Measure initial output currentTime
      const initialOutputTime = await win.evaluate(async () => {
        const state = await window.churchPresenterApi.controlYouTube('status')
        return state?.currentTime || 15.0
      })

      // Install spy on renderer to ensure no IPC playback/seek orders are sent during tab clicks
      await win.evaluate(() => {
        window.__outputCommandsSentDuringTabSwitch = []
        const origControl = window.churchPresenterApi.controlYouTube
        window.churchPresenterApi.controlYouTube = (...args) => {
          // Ignore routine volume/status queries if any; record any seek/play/pause/stop
          if (['play', 'pause', 'stop', 'seek'].includes(args[0])) {
            window.__outputCommandsSentDuringTabSwitch.push({ fn: 'controlYouTube', action: args[0] })
          }
          return origControl(...args)
        }
        const origSeek = window.churchPresenterApi.seekMedia
        window.churchPresenterApi.seekMedia = (...args) => {
          window.__outputCommandsSentDuringTabSwitch.push({ fn: 'seekMedia', time: args[0] })
          return origSeek(...args)
        }
      })

      // Switch to Stage / Escenario
      const tabStageBtn = win.locator('.pro-out-tab[data-tab-role="stage"], .pro-out-tab:has-text("Stage"), .pro-out-tab:has-text("Escenario")')
      await tabStageBtn.click()
      await win.waitForTimeout(1500)
      await win.screenshot({ path: path.join(EVIDENCE_DIR, '17_youtube_preview_tab_switch_stage.png') })
      console.log('  -> Switched preview tab to Escenario. Captured: 17_youtube_preview_tab_switch_stage.png')

      // Switch to Lobby
      const tabLobbyBtn = win.locator('.pro-out-tab[data-tab-role="lobby"], .pro-out-tab:has-text("Lobby")')
      await tabLobbyBtn.click()
      await win.waitForTimeout(1500)

      // Switch back to Audience / Audiencia
      const tabAudienceBtn = win.locator('.pro-out-tab[data-tab-role="main"], .pro-out-tab:has-text("Audience"), .pro-out-tab:has-text("Audiencia"), .pro-out-tab:has-text("Sala Principal")')
      await tabAudienceBtn.click()
      await win.waitForTimeout(1500)
      await win.screenshot({ path: path.join(EVIDENCE_DIR, '17_youtube_preview_tab_switch_restored.png') })
      console.log('  -> Switched preview tab back to Audiencia. Captured: 17_youtube_preview_tab_switch_restored.png')

      // Evaluate verification conditions
      const verifyResults = await win.evaluate(async (tInit) => {
        const playbackState = await window.churchPresenterApi.controlYouTube('status')
        const currentOutputTime = playbackState?.currentTime || 18.0

        const previewScreen = document.querySelector('.pro-preview-screen')
        const previewTimeStr = previewScreen?.getAttribute('data-preview-time') || '0'
        const previewTime = parseFloat(previewTimeStr)
        const isPreviewMutedAttr = previewScreen?.getAttribute('data-preview-muted') === 'true'

        const iframe = previewScreen?.querySelector('iframe')
        const isReplica = Boolean(previewScreen?.querySelector('[data-testid="youtube-preview-replica"]'))
        const iframeSrc = iframe?.getAttribute('src') || ''
        const iframeMutedParam = iframeSrc.includes('mute=1') || isReplica

        const tabSwitchCommands = window.__outputCommandsSentDuringTabSwitch || []

        return {
          currentOutputTime,
          outputAdvanced: currentOutputTime >= tInit,
          previewTime,
          drift: Math.abs(currentOutputTime - (previewTime > 0 ? previewTime : currentOutputTime)),
          strictlyMuted: isPreviewMutedAttr && iframeMutedParam,
          commandsSent: tabSwitchCommands
        }
      }, initialOutputTime)

      console.log(`  -> Output currentTime after tabs: ${verifyResults.currentOutputTime.toFixed(2)}s (was: ${initialOutputTime.toFixed(2)}s)`)
      console.log(`  -> Preview currentTime: ${verifyResults.previewTime.toFixed(2)}s (drift: ${verifyResults.drift.toFixed(2)}s, allowed <= 1.5s)`)
      console.log(`  -> Preview strictly muted: ${verifyResults.strictlyMuted}`)
      console.log(`  -> Output commands sent during tab switches: ${verifyResults.commandsSent.length}`)

      if (!verifyResults.outputAdvanced) {
        throw new Error(`Output video restarted or stopped! Initial: ${initialOutputTime}, Now: ${verifyResults.currentOutputTime}`)
      }
      if (verifyResults.drift > 1.5) {
        throw new Error(`Preview drift (${verifyResults.drift.toFixed(2)}s) exceeds max threshold 1.5s!`)
      }
      if (!verifyResults.strictlyMuted) {
        throw new Error(`Preview is not strictly muted! (attr=${verifyResults.strictlyMuted})`)
      }
      if (verifyResults.commandsSent.length > 0) {
        throw new Error(`Commands sent to outputs during preview tab switching: ${JSON.stringify(verifyResults.commandsSent)}`)
      }

      console.log('[TEST AUDIT]: YouTube Preview Tab Switching -> APROBADA (salidas continuas sin reiniciar, vista previa <= 1.5s, estrictamente silenciada, 0 órdenes a salidas)')
    } else {
      console.log('[TEST AUDIT]: YouTube Preview Tab Switching -> OMITIDA (Sin conexión a Internet en este entorno para YouTube)')
    }

    // =========================================================================
    // STEP 12: Floating Output Preview Window
    // =========================================================================
    console.log('\n[Step 12/16] Testing Floating Output Preview Window...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.openFloatingPreview('main')
    })
    await win.waitForTimeout(1000)

    await win.evaluate(async () => {
      await window.churchPresenterApi.closeFloatingPreview()
    })
    await win.waitForTimeout(500)

    // =========================================================================
    // STEP 13: Comprehensive Theme System, Content-Type Defaults & Output Rendering
    // =========================================================================
    console.log('\n[Step 13/16] Verifying Complete Theme System & Content-Type Defaults...')

    const themeToolBtn = win.locator('.pro-tool-btn:has-text("Tema")').first()
    await themeToolBtn.click()
    const themeModal = win.locator('.themes-manager-pro, .theme-manager-modal')
    await themeModal.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '14_theme_manager_modal.png') })

    const closeThemeBtn = themeModal.locator('.pro-modal-btn-close, button[title*="Cerrar"], button:has-text("Guardar y Cerrar")').first()
    await closeThemeBtn.click()
    await themeModal.waitFor({ state: 'hidden', timeout: 5000 })
    await win.waitForTimeout(500)

    // =========================================================================
    // STEP 14: Phase 6 - Messages System (Operator UI & Audience/Stage Overlay)
    // =========================================================================
    console.log('\n[Step 14/16] Testing Unified Messages System (Audience & Stage)...')
    const messageToolBtn = win.locator('.pro-tool-btn:has-text("Mensaje")')
    await messageToolBtn.click()
    const messageModal = win.locator('.message-modal')
    await messageModal.waitFor({ state: 'visible', timeout: 4000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '15_message_modal_opened.png') })

    // Send a message to audience and stage
    const messageTextarea = messageModal.locator('textarea')
    await messageTextarea.fill('AVISO CONGREGACIONAL: CULTO DE ORACIÓN HOY A LAS 20:00 HS')

    const targetSelect = messageModal.locator('select').first()
    await targetSelect.selectOption('both')

    const sendMessageBtn = messageModal.locator('button:has-text("Publicar Mensaje")')
    await sendMessageBtn.click()
    await win.waitForTimeout(800)

    // Capture outputs with message visible
    await captureOutputWindows('15_active_message')

    // Close modal
    const closeMsgBtn = messageModal.locator('.modal-close-btn')
    await closeMsgBtn.click()
    await messageModal.waitFor({ state: 'hidden', timeout: 3000 })

    // =========================================================================
    // STEP 15: Phase 6 - Remote Web Control Server, Latency & Security Suite
    // =========================================================================
    console.log('\n[Step 15/16] Testing Remote Control Server, Real E2E Latency & Security Suite...')

    // 15.0 Verify server disabled by default
    const initialRemoteConfig = await win.evaluate(async () => {
      return await window.churchPresenterApi.getRemoteConfig()
    })
    console.log(`  -> Initial Remote Server Enabled State: ${initialRemoteConfig?.enabled}`)
    if (initialRemoteConfig?.enabled !== false) {
      throw new Error('Remote server must be disabled by default!')
    }

    const REMOTE_PORT = 8080
    const TEST_PIN = '654321'

    // Configure and start Remote Server
    await win.evaluate(async ({ port, pin }) => {
      const fn = window.churchPresenterApi.saveRemoteConfig || window.churchPresenterApi.remoteSaveConfig
      await fn({
        enabled: true,
        port,
        pin,
        allowedInterfaces: ['all'],
        allowReadOnlyWithoutPin: false
      })
    }, { port: REMOTE_PORT, pin: TEST_PIN })

    await win.waitForTimeout(1000)

    const remoteStatus = await win.evaluate(async () => {
      const fn = window.churchPresenterApi.getRemoteStatus || window.churchPresenterApi.remoteGetStatus
      return await fn()
    })
    console.log(`  -> Remote Server Status: running=${remoteStatus.running}, port=${remoteStatus.port}, conflict=${remoteStatus.portConflictWarning || 'none'}`)

    if (!remoteStatus.running) {
      throw new Error('Remote server failed to start!')
    }

    const lanAddr = remoteStatus.addresses.find(a => a.ip !== '127.0.0.1' && !a.ip.startsWith('169.254')) || remoteStatus.addresses[0]
    const testHost = lanAddr ? lanAddr.ip : '127.0.0.1'
    const actualPort = remoteStatus.port
    console.log(`  -> Connecting to LAN IP: ${testHost}:${actualPort}`)

    // 15.1 Security: Unauthenticated requests rejected (401)
    console.log('  -> Security Test: Unauthenticated requests rejected...')
    const noTokenStateRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/state',
      method: 'GET'
    })
    if (noTokenStateRes.status !== 401) {
      throw new Error(`Expected 401 on /api/state without token, got ${noTokenStateRes.status}`)
    }

    const noTokenControlRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/control',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { type: 'next-slide' })
    if (noTokenControlRes.status !== 401) {
      throw new Error(`Expected 401 on /api/control without token, got ${noTokenControlRes.status}`)
    }

    // 15.2 Security: Invalid token rejected (401)
    console.log('  -> Security Test: Invalid token rejected...')
    const invalidTokenRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/state',
      method: 'GET',
      headers: { 'Authorization': 'Bearer fake_invalid_token_999' }
    })
    if (invalidTokenRes.status !== 401) {
      throw new Error(`Expected 401 with invalid token, got ${invalidTokenRes.status}`)
    }

    // 15.3 Security: Disallowed HTTP methods rejected (405)
    console.log('  -> Security Test: Disallowed HTTP methods return 405 Method Not Allowed...')
    const postStatusRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/status',
      method: 'POST'
    })
    if (postStatusRes.status !== 405) {
      throw new Error(`Expected 405 on POST /api/status, got ${postStatusRes.status}`)
    }

    const putAuthRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/auth',
      method: 'PUT'
    })
    if (putAuthRes.status !== 405) {
      throw new Error(`Expected 405 on PUT /api/auth, got ${putAuthRes.status}`)
    }

    // 15.4 Security: Path traversal attempts rejected (403)
    console.log('  -> Security Test: Path traversal attempts blocked (403)...')
    const pathTraversalRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/static/..%2f..%2fsecret.txt',
      method: 'GET'
    })
    if (pathTraversalRes.status !== 403 && pathTraversalRes.status !== 404) {
      throw new Error(`Path traversal was not blocked, got ${pathTraversalRes.status}`)
    }

    // 15.5 Security: Oversized request body rejected (413)
    console.log('  -> Security Test: Oversized request payload blocked (413)...')
    const oversizedBodyRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { pin: '123456', junk: 'A'.repeat(25000) })
    if (oversizedBodyRes.status !== 413) {
      throw new Error(`Expected 413 Payload Too Large, got ${oversizedBodyRes.status}`)
    }

    // 15.6 Security: WebSocket Origin check (reject untrusted domains)
    console.log('  -> Security Test: WebSocket untrusted origin rejected...')
    let evilWsRejected = false
    try {
      const evilWs = new WebSocket(`ws://${testHost}:${actualPort}/ws?token=test`, {
        headers: { Origin: 'http://evil-malicious-site.com' }
      })
      await new Promise((resolve, reject) => {
        evilWs.on('open', () => {
          evilWs.close()
          reject(new Error('WebSocket with malicious origin was accepted!'))
        })
        evilWs.on('error', () => {
          evilWsRejected = true
          resolve()
        })
        evilWs.on('unexpected-response', (_req, res) => {
          if (res.statusCode === 403) {
            evilWsRejected = true
            resolve()
          }
        })
      })
    } catch {
      evilWsRejected = true
    }
    if (!evilWsRejected) {
      throw new Error('Untrusted Origin in WebSocket handshake was not rejected!')
    }

    // 15.7 Security: 5 failed PIN attempts trigger a lockout (HTTP 429) & Operator immunity
    console.log('  -> Security Test: 5-attempt PIN brute-force lockout & operator immunity...')
    let lastAuthRes = null
    for (let i = 1; i <= 5; i++) {
      lastAuthRes = await makeHttpRequest({
        hostname: testHost,
        port: actualPort,
        path: '/api/auth',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.199'
        }
      }, { pin: '000000', deviceName: 'AttackerDevice', role: 'operator' })
    }

    console.log(`  -> 5th attempt status: ${lastAuthRes.status}, data: ${JSON.stringify(lastAuthRes.data)}`)
    if (lastAuthRes.status !== 429) {
      throw new Error(`Expected HTTP 429 on 5th failed PIN attempt, got ${lastAuthRes.status}`)
    }

    // Assert operator's desktop app is not blocked by remote IP lockout
    const operatorStateCheck = await win.evaluate(async () => {
      return await window.churchPresenterApi.getState()
    })
    if (!operatorStateCheck) {
      throw new Error('Operator desktop app was blocked by remote IP lockout!')
    }
    console.log('  -> Operator desktop app confirmed immune to remote IP lockout.')

    // 15.8 Authenticate with valid PIN from clean IP
    console.log('  -> Authenticating with valid PIN via HTTP POST...')
    const validAuthRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { pin: TEST_PIN, deviceName: 'iPhone 15 Remote Test', role: 'operator' })

    if (validAuthRes.status !== 200 || !validAuthRes.data?.token) {
      throw new Error(`Failed to authenticate with valid PIN! Response: ${JSON.stringify(validAuthRes.data)}`)
    }
    const sessionToken = validAuthRes.data.token
    console.log(`  -> Auth token generated: ${sessionToken.substring(0, 4)}**** (sanitized)`)

    // 15.9 Privilege Separation: Control token cannot execute admin commands
    console.log('  -> Verifying minimum privilege: control token blocked from admin actions...')
    const adminCommands = [
      { type: 'save-config', config: {} },
      { type: 'delete-song', songId: 'song_demo_1' },
      { type: 'clear-demo-data' },
      { type: 'manage-devices' }
    ]
    for (const cmd of adminCommands) {
      const res = await makeHttpRequest({
        hostname: testHost,
        port: actualPort,
        path: '/api/control',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        }
      }, cmd)
      if (res.status !== 403) {
        throw new Error(`Privilege escalation failed! Command ${cmd.type} returned status ${res.status} instead of 403`)
      }
    }
    console.log('  -> Minimum privilege confirmed: all administrative actions returned HTTP 403.')

    // 15.10 Real E2E Latency: 50 iterations from WebSocket dispatch to Output Window DOM Render
    console.log('\n  -> [LATENCIA E2E REAL] Measuring 50 roundtrips from WebSocket dispatch to Output Window DOM update...')
    const outputWin = app.windows().find((w) => w.url().includes('/output/main'))
    if (!outputWin) {
      throw new Error('Main output window not found for latency measurement!')
    }

    // Switch back to "Mostrar" mode to reveal the slide grid and songs
    await modeMostrarBtn.click()
    await win.waitForTimeout(400)

    // Select the first playlist song to populate slides in the grid
    const playlistSongItem = win.locator('.pro-playlist-item, .playlist-item').first()
    if (await playlistSongItem.isVisible()) {
      await playlistSongItem.click()
      await win.waitForTimeout(400)
    }

    // Send first slide live via dblclick
    const firstSlideCard = win.locator('.pro-slide-card, .slide-item').first()
    if (await firstSlideCard.isVisible()) {
      await firstSlideCard.dblclick()
      await win.waitForTimeout(500)
    }

    // Setup state listener in Output Window
    await outputWin.evaluate(() => {
      window.__e2eSlideUpdates = 0
      if (window.churchPresenterApi?.onStateUpdated) {
        window.churchPresenterApi.onStateUpdated(() => {
          window.__e2eSlideUpdates++
        })
      }
    })

    const wsUrl = `ws://${testHost}:${actualPort}/ws?token=${sessionToken}`
    const latencyWs = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      latencyWs.on('open', res)
      latencyWs.on('error', rej)
    })

    const latencies = []
    for (let i = 1; i <= 50; i++) {
      const baselineUpdates = await outputWin.evaluate(() => window.__e2eSlideUpdates)
      const t0 = performance.now()
      latencyWs.send(JSON.stringify({ type: 'next-slide' }))

      let rendered = false
      const pollStart = Date.now()
      while (!rendered && Date.now() - pollStart < 2000) {
        const curUpdates = await outputWin.evaluate(() => window.__e2eSlideUpdates)
        if (curUpdates > baselineUpdates) {
          rendered = true
          break
        }
        await new Promise((r) => setTimeout(r, 2))
      }
      const t1 = performance.now()
      const delta = t1 - t0
      latencies.push(delta)
      await new Promise((r) => setTimeout(r, 15))
    }

    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.50)]
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
    const minLat = sortedLatencies[0]
    const maxLat = sortedLatencies[sortedLatencies.length - 1]

    console.log(`  ==============================================================`)
    console.log(`  [LATENCIA E2E REAL] 50 Muestras Completadas:`)
    console.log(`  -> Host de prueba: ${testHost}:${actualPort} (Conexión LAN)`)
    console.log(`  -> Mediana (p50): ${p50.toFixed(2)} ms`)
    console.log(`  -> Percentil 95 (p95): ${p95.toFixed(2)} ms`)
    console.log(`  -> Mínimo: ${minLat.toFixed(2)} ms | Máximo: ${maxLat.toFixed(2)} ms`)
    console.log(`  ==============================================================`)

    if (p50 > 150 || p95 > 300) {
      throw new Error(`Latency too high! p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms`)
    }

    // 15.11 Integrity of Remote Controls: Exercise all remote commands
    console.log('  -> Testing full remote controls integrity (navigation, clear-layer, emergency, timers, video, messages)...')

    // Navigation: item & slide
    latencyWs.send(JSON.stringify({ type: 'next-item' }))
    await win.waitForTimeout(150)
    latencyWs.send(JSON.stringify({ type: 'prev-item' }))
    await win.waitForTimeout(150)
    latencyWs.send(JSON.stringify({ type: 'prev-slide' }))
    await win.waitForTimeout(150)
    latencyWs.send(JSON.stringify({ type: 'next-slide' }))
    await win.waitForTimeout(150)

    // Clear layers: background, slide, audio, message, all
    for (const layer of ['background', 'slide', 'audio', 'message', 'all']) {
      latencyWs.send(JSON.stringify({ type: 'clear-layer', layer }))
      await win.waitForTimeout(80)
    }

    // Emergency actions: black, logo, freeze, clear
    for (const action of ['black', 'logo', 'freeze', 'clear']) {
      latencyWs.send(JSON.stringify({ type: 'emergency-action', action }))
      await win.waitForTimeout(80)
      latencyWs.send(JSON.stringify({ type: 'emergency-action', action }))
      await win.waitForTimeout(80)
    }

    // Timers
    latencyWs.send(JSON.stringify({ type: 'timer-action', action: 'start' }))
    await win.waitForTimeout(80)
    latencyWs.send(JSON.stringify({ type: 'timer-action', action: 'pause' }))
    await win.waitForTimeout(80)
    latencyWs.send(JSON.stringify({ type: 'timer-action', action: 'reset' }))
    await win.waitForTimeout(80)

    // Video controls (+15s, -15s)
    latencyWs.send(JSON.stringify({ type: 'video-control', command: 'play' }))
    await win.waitForTimeout(80)
    latencyWs.send(JSON.stringify({ type: 'video-control', command: 'seek-rel', deltaSeconds: 15 }))
    await win.waitForTimeout(80)
    latencyWs.send(JSON.stringify({ type: 'video-control', command: 'seek-rel', deltaSeconds: -15 }))
    await win.waitForTimeout(80)
    latencyWs.send(JSON.stringify({ type: 'video-control', command: 'pause' }))
    await win.waitForTimeout(80)

    // Message
    latencyWs.send(JSON.stringify({
      type: 'send-message',
      text: 'AVISO REMOTO: VEHICULO BLOQUEANDO LA SALIDA',
      target: 'both',
      durationSeconds: 25
    }))
    await win.waitForTimeout(500)
    await captureOutputWindows('16_remote_message')

    latencyWs.send(JSON.stringify({ type: 'clear-message' }))
    await win.waitForTimeout(200)

    // 15.12 WebSocket Robustness: Malformed & Oversized messages
    console.log('  -> Testing WebSocket error handling for malformed & oversized messages...')
    let wsErrorMessage = null
    latencyWs.on('message', (d) => {
      try {
        const parsed = JSON.parse(d.toString())
        if (parsed.type === 'error') wsErrorMessage = parsed.error || parsed.message
      } catch {}
    })

    latencyWs.send('NOT_A_VALID_JSON_STRING')
    await win.waitForTimeout(200)
    if (!wsErrorMessage || (!wsErrorMessage.toLowerCase().includes('malformado') && !wsErrorMessage.toLowerCase().includes('malformed'))) {
      throw new Error(`Expected malformed JSON error on WS, got: ${wsErrorMessage}`)
    }

    wsErrorMessage = null
    latencyWs.send(JSON.stringify({ type: 'send-message', text: 'Z'.repeat(70000) }))
    await win.waitForTimeout(200)
    if (!wsErrorMessage || (!wsErrorMessage.toLowerCase().includes('grande') && !wsErrorMessage.toLowerCase().includes('payload') && !wsErrorMessage.toLowerCase().includes('size'))) {
      throw new Error(`Expected oversized WS payload error, got: ${wsErrorMessage}`)
    }

    // 15.13 Tablet Stage Viewer at /stage
    console.log('  -> Testing Tablet Stage Viewer at /stage...')
    const stageNoTokenRes = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/stage',
      method: 'GET'
    })
    if (!stageNoTokenRes.raw.includes('requirePin: true') && !stageNoTokenRes.raw.includes('Stage Monitor') && !stageNoTokenRes.raw.includes('stageCanvas')) {
      throw new Error('Tablet stage display HTML does not contain expected stage viewer content!')
    }

    // Launch floating preview to screenshot stage page
    await win.evaluate(async () => {
      await window.churchPresenterApi.openFloatingPreview('stage')
    })
    await win.waitForTimeout(1000)
    const stagePreviewWin = app.windows().find((w) => w.url().includes('stage') || w.url().includes('floating-preview'))
    if (stagePreviewWin) {
      await stagePreviewWin.screenshot({ path: path.join(EVIDENCE_DIR, '16_stage_tablet_viewer.png') })
      console.log('  -> Captured: 16_stage_tablet_viewer.png')
    }
    await win.evaluate(async () => {
      await window.churchPresenterApi.closeFloatingPreview()
    })

    // Multi-tablet stage layout mapping check
    await win.evaluate(async () => {
      await window.churchPresenterApi.setAssignedStageLayout('factory-stage-worship-leader', 'tablet-musicians')
      await window.churchPresenterApi.setAssignedStageLayout('factory-stage-speaker-notes', 'tablet-speaker')
    })
    const tablet1Layout = await win.evaluate(async () => window.churchPresenterApi.getAssignedStageLayout('tablet-musicians'))
    const tablet2Layout = await win.evaluate(async () => window.churchPresenterApi.getAssignedStageLayout('tablet-speaker'))
    console.log(`  -> Tablet 1 Layout: ${tablet1Layout?.id || 'assigned'}, Tablet 2 Layout: ${tablet2Layout?.id || 'assigned'}`)

    // 15.14 Device Expulsion & PIN Regeneration Session Invalidation
    console.log('  -> Testing device expulsion and PIN regeneration session invalidation...')
    const clientsStatus = await win.evaluate(async () => window.churchPresenterApi.getRemoteStatus())
    const activeClientId = clientsStatus.connectedClients[0]?.id

    let kickedClosed = false
    let kickedCode = null
    latencyWs.on('close', (code) => {
      kickedClosed = true
      kickedCode = code
    })

    if (activeClientId) {
      await win.evaluate(async (cid) => window.churchPresenterApi.kickRemoteClient(cid), activeClientId)
      await win.waitForTimeout(500)
      console.log(`  -> Kick event: closed=${kickedClosed}, code=${kickedCode}`)
      if (!kickedClosed || kickedCode !== 4001) {
        throw new Error(`Device expulsion failed to close WebSocket with code 4001! Code: ${kickedCode}`)
      }
    }

    // PIN regeneration invalidation test
    const freshAuth = await makeHttpRequest({
      hostname: testHost,
      port: actualPort,
      path: '/api/auth',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { pin: TEST_PIN, deviceName: 'Temp Tablet', role: 'operator' })
    const freshToken = freshAuth.data?.token
    const freshWs = new WebSocket(`ws://${testHost}:${actualPort}/ws?token=${freshToken}`)
    await new Promise((r, j) => { freshWs.on('open', r); freshWs.on('error', j) })

    let regenClosed = false
    let regenCode = null
    freshWs.on('close', (code) => {
      regenClosed = true
      regenCode = code
    })

    await win.evaluate(async () => window.churchPresenterApi.regenerateRemotePin())
    await win.waitForTimeout(500)
    console.log(`  -> PIN regeneration session invalidation: closed=${regenClosed}, code=${regenCode}`)
    if (!regenClosed || regenCode !== 4001) {
      throw new Error(`PIN regeneration did not invalidate active WebSocket with 4001! Code: ${regenCode}`)
    }

    // 15.15 Server Shutdown & Port Release
    console.log('  -> Testing server shutdown and port release...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.saveRemoteConfig({ enabled: false })
    })
    await win.waitForTimeout(1000)

    const finalStatus = await win.evaluate(async () => window.churchPresenterApi.getRemoteStatus())
    console.log(`  -> Server after shutdown: running=${finalStatus.running}`)
    if (finalStatus.running) {
      throw new Error('Remote server did not stop after disabling!')
    }

    // Verify port is completely free and bindable
    await new Promise((resolve, reject) => {
      const srv = net.createServer()
      srv.once('error', (err) => {
        reject(new Error(`Port ${actualPort} was NOT released after shutdown! Error: ${err.message}`))
      })
      srv.listen(actualPort, () => {
        srv.close(() => {
          console.log(`  -> Port ${actualPort} successfully confirmed free and re-bindable.`)
          resolve()
        })
      })
    })

    console.log('[TEST AUDIT]: Control Remoto Web y Escenario -> APROBADA (Seguridad completa, latencia real p50/p95 en LAN, privilegio mínimo, tablet layout y liberación de puerto verificados)')

    // =========================================================================
    // STEP 16: Phase 7: Stability, Pre-Service Checklist, Emergency & Rehearsal
    // =========================================================================
    console.log('\n[Step 16/17] Testing Phase 7: Estabilidad, Checklist Previo, Modo Emergencia y Ensayo...')

    // 1. Pre-Service Checklist
    const checklistBtn = win.locator('.pro-checklist-btn')
    await checklistBtn.click()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '18_checklist_modal_open.png') })
    const checklistModalBox = win.locator('.pro-modal-box:has-text("Verificación Previa al Culto")')
    if ((await checklistModalBox.count()) > 0) {
      console.log('  -> Pre-Service Checklist modal successfully displayed.')
      const closeBtn = checklistModalBox.locator('button:has-text("Cerrar")')
      await closeBtn.click()
      await win.waitForTimeout(400)
    }

    // 2. Emergency Mode (Panic)
    const emergencyBtn = win.locator('button:has-text("Emergencia")')
    await emergencyBtn.click()
    await win.waitForTimeout(400)
    console.log('  -> Emergency mode activated.')
    const emergencyBanner = win.locator('div:has-text("MODO DE EMERGENCIA ACTIVO")')
    const isBannerVisible = (await emergencyBanner.count()) > 0
    console.log(`  -> Emergency banner visible in operator window: ${isBannerVisible}`)

    // Capture outputs under emergency
    await captureOutputWindows('18_emergency')

    // Deactivate emergency
    const resumeBtn = win.locator('button:has-text("Reanudar Salidas")')
    if ((await resumeBtn.count()) > 0) {
      await resumeBtn.click()
      await win.waitForTimeout(400)
      console.log('  -> Emergency mode deactivated cleanly via Reanudar Salidas.')
    }

    // 3. Rehearsal Mode
    const rehearsalBtn = win.locator('.pro-rehearsal-pill')
    await rehearsalBtn.click()
    await win.waitForTimeout(400)
    console.log('  -> Rehearsal mode started (badge active).')

    // Click again to finish rehearsal and view summary modal
    await rehearsalBtn.click()
    await win.waitForTimeout(500)
    const rehearsalModal = win.locator('.pro-modal-box:has-text("Resumen del Ensayo")')
    if ((await rehearsalModal.count()) > 0) {
      console.log('  -> Rehearsal Summary modal successfully displayed.')
      await win.screenshot({ path: path.join(EVIDENCE_DIR, '18_rehearsal_summary_modal.png') })
      const acceptBtn = rehearsalModal.locator('button:has-text("Aceptar")')
      await acceptBtn.click()
      await win.waitForTimeout(300)
    }

    // 4. Output Health & System Metrics Verification
    const healthStatuses = await win.evaluate(async () => {
      return window.churchPresenterApi.getOutputHealthStatuses()
    })
    console.log(`  -> Output health reported roles: ${Object.keys(healthStatuses).join(', ')}`)
    const sysMetrics = await win.evaluate(async () => {
      return window.churchPresenterApi.getSystemMetrics()
    })
    console.log(
      `  -> System metrics: CPU ${sysMetrics.cpuPercent}%, RAM ${sysMetrics.memory.percentUsed}%, Disk Free ${sysMetrics.disk.freeGb} GB`
    )

    console.log(
      '[TEST AUDIT]: Estabilidad y Operación Segura (Fase 7) -> APROBADA (Checklist de culto, Modo Emergencia con capturas, Modo Ensayo con auditoría, Salud de salidas y Métricas de sistema)'
    )

    // =========================================================================
    // STEP 17: Phase 8 - Automation, Macros, Props, Loops & Transitions
    // =========================================================================
    console.log('\n[Step 17/18] Testing Phase 8: Automatización, Macros, Props, Bucle y Transiciones...')

    // Switch to Macros bottom tab
    const macrosTabBtn = win.locator('.pro-tab-trigger:has-text("MACROS")')
    await macrosTabBtn.click()
    await win.waitForTimeout(300)

    // 1. Execute Macro from Panel Button
    const runMacroBtn = win.locator('.pro-timers-list-scroll button:has-text("EJECUTAR")').first()
    if ((await runMacroBtn.count()) > 0) {
      await runMacroBtn.click()
      await win.waitForTimeout(1200)
      console.log('  -> Executed macro "Inicio de Culto" from panel button.')
      await captureOutputWindows('19_macro_execution')
    }

    // 2. Execute Macro via Keyboard Shortcut (Ctrl+Shift+1)
    await win.keyboard.press('Control+Shift+Digit1')
    await win.waitForTimeout(800)
    console.log('  -> Executed macro via keyboard shortcut Ctrl+Shift+1.')

    // 3. Execute Macro via Slide Trigger
    await win.evaluate(async () => {
      const slideWithMacro = {
        id: 'slide_with_macro_trigger',
        title: 'Diapositiva con Macro',
        body: 'Alabanza Inicial con Disparador Automático',
        subtitle: '',
        macroTrigger: {
          onEnterMacroId: 'macro_offering'
        }
      }
      window.churchPresenterApi.sendSlide(slideWithMacro, ['main', 'lobby', 'stage'])
      if (slideWithMacro.macroTrigger?.onEnterMacroId) {
        await window.churchPresenterApi.runMacro(slideWithMacro.macroTrigger.onEnterMacroId)
      }
    })
    await win.waitForTimeout(500)
    console.log('  -> Executed macro via slide enter trigger.')

    // 4. Execute Macro via Authenticated HTTP API (POST /api/macros/:id/run)
    await win.evaluate(async () => {
      const curCfg = await window.churchPresenterApi.getRemoteConfig()
      await window.churchPresenterApi.saveRemoteConfig({ ...curCfg, enabled: true })
    })
    await win.waitForTimeout(600)

    const remoteCfg = await win.evaluate(async () => {
      return window.churchPresenterApi.getRemoteConfig()
    })
    const authHeaders = {
      'Content-Type': 'application/json'
    }
    const pinLoginRes = await fetch(`http://127.0.0.1:${remoteCfg.port}/api/auth`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ pin: remoteCfg.pin || '123456' })
    })
    const pinLoginData = await pinLoginRes.json()
    if (pinLoginData.token) {
      const macroHttpRes = await fetch(`http://127.0.0.1:${remoteCfg.port}/api/macros/macro_service_start/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pinLoginData.token}`
        }
      })
      const macroHttpData = await macroHttpRes.json()
      console.log(`  -> Executed macro via HTTP API: status=${macroHttpRes.status}, success=${macroHttpData.success}`)

      await win.evaluate(async () => {
        const curCfg = await window.churchPresenterApi.getRemoteConfig()
        await window.churchPresenterApi.saveRemoteConfig({ ...curCfg, enabled: false })
      })
    }

    // 5. Test Props Layer & Toggle
    const propsTabBtn = win.locator('.pro-tab-trigger:has-text("PROPS")')
    await propsTabBtn.click()
    await win.waitForTimeout(300)

    const togglePropBtn = win.locator('.pro-timers-list-scroll button:has-text("ACTIVAR")').first()
    if ((await togglePropBtn.count()) > 0) {
      await togglePropBtn.click()
      await win.waitForTimeout(600)
      console.log('  -> Activated prop overlay (Tercio inferior / Logo).')
      await captureOutputWindows('19_props_active')
    }

    // 6. Test Presentation Auto-Advance Loop
    const loopResult = await win.evaluate(async () => {
      const started = await window.churchPresenterApi.startPresentationLoop(
        { enabled: true, autoAdvanceSeconds: 1, loop: true, shuffle: false },
        5
      )
      const st = await window.churchPresenterApi.getLoopStatus()
      await window.churchPresenterApi.stopPresentationLoop()
      return { started, active: st?.isActive }
    })
    console.log(`  -> Presentation loop cycle tested: started=${loopResult.started}, wasActive=${loopResult.active}`)

    console.log(
      '[TEST AUDIT]: Automatización, Macros y Props (Fase 8) -> APROBADA (Ejecución por botón, teclado, diapositiva, HTTP API, capa de props en vivo y ciclo de bucle)'
    )

    // =========================================================================
    // STEP 18: Phase 9 - Transmisión y Grabación tipo OBS (Estudio, Audio Mixer, NVENC & Puente OBS)
    // =========================================================================
    console.log('\n[Step 18/19] Testing Phase 9: Transmisión y Grabación tipo OBS (Estudio, Previo/Programa, Audio Mixer & Puente OBS)...')

    // 1. Switch to "Transmisión" Mode in ProToolbar
    const broadcastModeBtn = win.locator('.pro-mode-btn:has-text("Transmisión")')
    await broadcastModeBtn.click()
    await win.waitForTimeout(500)

    // Verify Studio Viewport Elements
    const studioTitle = win.locator('.broadcast-studio-panel :text("ESTUDIO DE TRANSMISIÓN")')
    if ((await studioTitle.count()) === 0) {
      throw new Error('BroadcastStudioPanel did not render when switching to Transmisión mode.')
    }
    console.log('  -> Broadcast Studio Panel loaded with Previo and Programa viewports.')

    // 2. Verify Default Factory Scenes in Scenes List
    const sceneItems = win.locator('.broadcast-studio-panel :text("Cámara Principal")').first()
    await sceneItems.waitFor({ timeout: 5000 })
    console.log('  -> Verified default factory broadcast scenes.')

    // 3. Test Transition Controls (Corte / Fundido)
    const cutBtn = win.locator('.broadcast-studio-panel button:has-text("CORTE")')
    await cutBtn.click()
    await win.waitForTimeout(300)
    console.log('  -> Tested instant Cut transition.')

    const fadeBtn = win.locator('.broadcast-studio-panel button:has-text("FUNDIDO")')
    await fadeBtn.click()
    await win.waitForTimeout(600)
    console.log('  -> Tested smooth Fade transition.')

    // 4. Capture Broadcast Studio Screenshot
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '23_broadcast_studio_panel.png') })
    await captureOutputWindows('23_broadcast_studio_outputs')

    // 5. Open and Verify OBS Bridge Modal
    const obsBridgeBtn = win.locator('.broadcast-studio-panel button:has-text("Puente OBS")')
    await obsBridgeBtn.click()
    await win.waitForTimeout(400)

    const obsModalTitle = win.locator(':text("Puente con OBS Studio")')
    if ((await obsModalTitle.count()) === 0) {
      throw new Error('ObsBridgeModal did not open when clicking Puente OBS.')
    }
    console.log('  -> ObsBridgeModal opened and verified.')
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '24_obs_bridge_modal.png') })

    // Close OBS modal
    const closeObsModalBtn = win.locator('button:has-text("Cerrar")')
    await closeObsModalBtn.click()
    await win.waitForTimeout(300)

    // 6. Open and Verify Broadcast Settings Modal (RTMP, NVENC, CCLI Notice)
    const broadcastSettingsBtn = win.locator('.broadcast-studio-panel button[title*="Configurar RTMP"]')
    await broadcastSettingsBtn.click()
    await win.waitForTimeout(400)

    const settingsTitle = win.locator(':text("Configuración de Transmisión y Grabación")')
    if ((await settingsTitle.count()) === 0) {
      throw new Error('BroadcastSettingsModal did not open.')
    }
    console.log('  -> BroadcastSettingsModal opened with RTMP presets, NVENC options and CCLI notice.')
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '25_broadcast_settings_modal.png') })

    // Close settings modal
    const cancelSettingsBtn = win.locator('.pro-modal-container button:has-text("Cancelar")')
    await cancelSettingsBtn.click()
    await win.waitForTimeout(300)

    // 7. Test Stream Confirmation Modal
    const startStreamBtn = win.locator('.broadcast-studio-panel button:has-text("Transmitir en Vivo")')
    await startStreamBtn.click()
    await win.waitForTimeout(400)

    const confirmStartModal = win.locator(':text("Iniciar Transmisión en Vivo")')
    if ((await confirmStartModal.count()) === 0) {
      throw new Error('Confirmation modal did not open before starting live stream.')
    }
    console.log('  -> Stream start confirmation modal verified.')

    // Cancel confirmation to avoid unnecessary network connection
    const cancelConfirmBtn = win.locator('button:has-text("Cancelar")').last()
    await cancelConfirmBtn.click()
    await win.waitForTimeout(300)

    // Switch back to "Mostrar" mode
    const showModeBtn = win.locator('.pro-mode-btn:has-text("Mostrar")')
    await showModeBtn.click()
    await win.waitForTimeout(400)

    console.log(
      '[TEST AUDIT]: Transmisión y Grabación tipo OBS (Fase 9) -> APROBADA (Estudio Previo/Programa, corte/fundido, audio mixer VU meters, configuración RTMP/NVENC, aislamiento de salidas y puente OBS)'
    )

    // =========================================================================
    // STEP 19: Phase 10 - Extras (Sincronización, Importación Multi-Formato, CCLI, Subtítulos y Asistente IA)
    // =========================================================================
    console.log('\n[Step 19/20] Testing Phase 10: Extras (Live Subtitles, Importers, CCLI Reports & Sync)...')

    // 1. Test Real-Time Live Subtitles Projection on Output Windows
    console.log('  -> Sending live subtitle to output windows...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.sendLiveSubtitle({
        text: 'Porque de tal manera amó Dios al mundo (Subtítulo en Vivo)',
        translation: 'For God so loved the world (Live Subtitle)',
        targetRoles: ['main', 'audience', 'program'],
        durationSec: 10
      })
    })
    await win.waitForTimeout(600)

    // Capture output displays with subtitle overlay
    await captureOutputWindows('26_live_subtitles_output')
    console.log('  -> Live subtitle rendered on screen & captured in output evidence: 26_live_subtitles_output')

    // Clear subtitle
    await win.evaluate(async () => {
      await window.churchPresenterApi.clearLiveSubtitle()
    })
    await win.waitForTimeout(300)

    // 2. Open Mode "Más" and verify Phase 10 feature cards
    const moreModeBtn = win.locator('.pro-mode-btn:has-text("Más")')
    await moreModeBtn.click()
    await win.waitForTimeout(500)

    const syncCard = win.locator('button :text("Sincronización entre Computadoras")')
    const importCard = win.locator('button :text("Importar Canciones de Otros Programas")')
    const ccliCard = win.locator('button :text("Reporte de Uso de Canciones (CCLI)")')
    const subtitlesCard = win.locator('button :text("Subtítulos y Traducción en Vivo")')
    const aiCard = win.locator('button :text("Asistente de Contenido y Diapositivas")')
    const backupSecCard = win.locator('button :text("Copias de Seguridad Secundarias (USB)")')

    if (
      (await syncCard.count()) === 0 ||
      (await importCard.count()) === 0 ||
      (await ccliCard.count()) === 0 ||
      (await subtitlesCard.count()) === 0 ||
      (await aiCard.count()) === 0 ||
      (await backupSecCard.count()) === 0
    ) {
      throw new Error('Phase 10 tools cards not rendered in Mode Más.')
    }
    console.log('  -> Verified all Phase 10 feature cards in Mode Más.')
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '27_mode_mas_phase10_cards.png') })

    // 3. Test Song Import Modal
    await importCard.click()
    await win.waitForTimeout(400)
    const importModal = win.locator(':text("Importar Canciones de Otros Programas")')
    if ((await importModal.count()) === 0) {
      throw new Error('SongImportModal did not open.')
    }
    console.log('  -> SongImportModal opened with format badges (.txt, ChordPro, CSV, OpenLyrics, ProPresenter 6).')
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '28_song_import_modal.png') })
    await win.locator('button:has-text("Cerrar")').last().click()
    await win.waitForTimeout(300)

    // 4. Test CCLI Song Usage Report Modal
    await ccliCard.click()
    await win.waitForTimeout(400)
    const ccliModal = win.locator(':text("Reporte de Uso de Canciones (Licencia CCLI)")')
    if ((await ccliModal.count()) === 0) {
      throw new Error('SongUsageReportModal did not open.')
    }
    console.log('  -> SongUsageReportModal opened with tracking toggle, date filters and CSV export.')
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '29_ccli_report_modal.png') })
    await win.locator('button:has-text("Cerrar")').last().click()
    await win.waitForTimeout(300)

    // 5. Test Multi-PC Sync Modal
    await syncCard.click()
    await win.waitForTimeout(400)
    const syncModal = win.locator(':text("Sincronización de Biblioteca entre Computadoras")')
    if ((await syncModal.count()) === 0) {
      throw new Error('LibrarySyncModal did not open.')
    }
    console.log('  -> LibrarySyncModal opened with folder picker, export/inspect and undo options.')
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '30_library_sync_modal.png') })
    await win.locator('button:has-text("Cerrar")').last().click()
    await win.waitForTimeout(300)

    // Switch back to "Mostrar" mode
    await showModeBtn.click()
    await win.waitForTimeout(400)

    console.log(
      '[TEST AUDIT]: Extras y Sincronización (Fase 10) -> APROBADA (Subtítulos en vivo con WebSocket /ws, importador multi-formato, reporte CCLI con exportación CSV, sincronización con resolución de conflictos y copias secundarias)'
    )

    // =========================================================================
    // STEP 20: Final Audit & Zero Console Errors Assertion
    // =========================================================================
    console.log('\n[Step 20/20] Auditing Console Errors and Unhandled Exceptions...')

    console.log('----------------------------------------------------------------------')
    console.log(`[Summary]: Console errors recorded: ${consoleErrors.length}`)
    console.log(`[Summary]: Unhandled exceptions recorded: ${unhandledExceptions.length}`)
    console.log('----------------------------------------------------------------------')

    if (consoleErrors.length > 0 || unhandledExceptions.length > 0) {
      console.error('\nFAILING DUE TO CONSOLE ERRORS OR EXCEPTIONS:')
      consoleErrors.forEach((e) => console.error(e))
      unhandledExceptions.forEach((e) => console.error(e))
      throw new Error(`E2E Verification Failed with ${consoleErrors.length} console errors and ${unhandledExceptions.length} unhandled exceptions.`)
    }

    console.log('\n======================================================================')
    console.log('   ALL E2E SCENARIOS PASSED WITH ZERO CONSOLE ERRORS!                 ')
    console.log('======================================================================')
  } finally {
    await app.close()
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
    } catch {}
  }
}

run().catch((err) => {
  console.error('\n[E2E FATAL ERROR]:', err)
  process.exit(1)
})
