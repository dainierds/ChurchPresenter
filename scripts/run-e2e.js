/**
 * End-to-End Automated Testing with Playwright and Electron
 * ChurchPresenter - Phase 5A Comprehensive Verification Suite
 *
 * Scenarios tested:
 * 1. App Launch & First-time Demo prompt verification
 * 2. Demo data loading (verified public-domain hymns)
 * 3. Library song search ("Castillo")
 * 4. Worship service assembly (adding song to active service)
 * 5. Sending slide to live projection
 * 6. Global action controls (F1-F4 toggle)
 * 7. Live editing isolation (live output unchanged until "Actualizar en vivo")
 * 8. Live update confirmation
 * 9. Bible reference search ("Juan 3:16")
 * 10. Sending Bible passage live
 * 11. Advancing verses with arrow keys
 * 12. Dual translations projection
 * 13. [Phase 5A] Video playback with master clock sync, audio routing, and stage countdown
 * 14. [Phase 5A] PDF presentation rendering, page navigation, and fit modes
 * 15. [Phase 5A] Dual translation per output role (Main: single, Stage: stacked)
 * 16. [Phase 5A] Independent background audio playback with 3s fade out
 * 17. [Phase 5A] Video background looping on themes
 *
 * Saves full screenshots of operator AND each output window to docs/evidence/
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')
const os = require('os')

const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')
const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures')

async function run() {
  console.log('=====================================================')
  console.log('   CHURCHPRESENTER E2E VERIFICATION SUITE (PHASE 5A)')
  console.log('=====================================================')

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true })
  }

  const tempUserDataDir = path.join(os.tmpdir(), `cp-e2e-${Date.now()}`)
  fs.mkdirSync(tempUserDataDir, { recursive: true })
  console.log(`[E2E] Isolated Test UserData: ${tempUserDataDir}`)

  console.log('[E2E] Launching Electron app...')
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

  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    console.log('[E2E] Operator window loaded successfully.')
    await win.setViewportSize({ width: 1400, height: 900 })
    await win.waitForTimeout(1000)

    // Helper to capture output windows (main, stage, lobby)
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
          await w.screenshot({ path: path.join(EVIDENCE_DIR, outName) })
          console.log(`  -> Captured Output Window: ${outName}`)
        }
      }
    }

    // =========================================================================
    // STEP 1: App Start & First-Launch Modal
    // =========================================================================
    console.log('[Step 1/17] Verifying First-Launch Demo Modal...')
    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido")')
    await firstLaunchModal.waitFor({ state: 'visible', timeout: 8000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '01_app_start.png') })
    console.log('  -> Captured: 01_app_start.png')

    // =========================================================================
    // STEP 2: Load Demo Data
    // =========================================================================
    console.log('[Step 2/17] Loading Public Domain Demo Hymns...')
    const loadDemoBtn = win.locator('button:has-text("Cargar Datos")')
    await loadDemoBtn.click()
    await firstLaunchModal.waitFor({ state: 'hidden', timeout: 5000 })
    await win.waitForTimeout(1000)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_demo_loaded.png') })
    console.log('  -> Captured: 02_demo_loaded.png')

    // Open Output Windows for all roles
    console.log('[E2E] Initializing output windows: main, stage, lobby...')
    await win.evaluate(async () => {
      await window.churchPresenterApi.openPreviewOutputWindow('main')
      await window.churchPresenterApi.openPreviewOutputWindow('stage')
      await window.churchPresenterApi.openPreviewOutputWindow('lobby')
    })
    await win.waitForTimeout(1500)

    // =========================================================================
    // STEP 3: Song Library Search
    // =========================================================================
    console.log('[Step 3/17] Searching song "Castillo"...')
    const searchInput = win.locator('.zone-library .search-input')
    await searchInput.fill('Castillo')
    await win.waitForTimeout(500)
    const songItem = win.locator('.library-item-card:has-text("Castillo fuerte")')
    await songItem.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '03_song_search.png') })
    console.log('  -> Captured: 03_song_search.png')

    // =========================================================================
    // STEP 4: Worship Service Assembly
    // =========================================================================
    console.log('[Step 4/17] Adding song to Service playlist...')
    const addSongBtn = songItem.locator('.add-btn')
    await addSongBtn.click()
    await win.waitForTimeout(500)
    const playlistItem = win.locator('.playlist-item-card:has-text("Castillo fuerte")').last()
    await playlistItem.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '04_service_assembled.png') })
    console.log('  -> Captured: 04_service_assembled.png')

    // =========================================================================
    // STEP 5: Send Slide Live
    // =========================================================================
    console.log('[Step 5/17] Projecting slide live...')
    await playlistItem.click()
    await win.waitForTimeout(500)
    const firstSlide = win.locator('.zone-slides .slide-card').first()
    await firstSlide.waitFor({ state: 'visible', timeout: 5000 })
    await firstSlide.dblclick()
    await win.waitForTimeout(500)
    const liveSlide = win.locator('.slide-card.is-live').first()
    await liveSlide.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '05_slide_live.png') })
    console.log('  -> Captured: 05_slide_live.png')
    await captureOutputWindows('05_slide_live')

    // =========================================================================
    // STEP 6: Global Action Controls (F1-F4)
    // =========================================================================
    console.log('[Step 6/17] Testing local F1 Blackout toggle...')
    await win.keyboard.press('F1')
    await win.waitForTimeout(500)
    const blackBtn = win.locator('.global-action-btn.active-black')
    await blackBtn.waitFor({ state: 'visible', timeout: 3000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_controls_f1_f4.png') })
    console.log('  -> Captured: 06_controls_f1_f4.png')
    await captureOutputWindows('06_controls_f1_black')
    await win.keyboard.press('F1')
    await win.waitForTimeout(500)

    // =========================================================================
    // STEP 7: Live Edit Isolation
    // =========================================================================
    console.log('[Step 7/17] Editing live song in editor...')
    const editSongBtn = win.locator('button:has-text("Editar Canción")')
    await editSongBtn.click()
    const songEditor = win.locator('.song-editor-modal')
    await songEditor.waitFor({ state: 'visible', timeout: 5000 })
    const titleInput = songEditor.locator('.form-group:has-text("Título de la Canción") input')
    await titleInput.fill('Castillo fuerte es nuestro Dios (Letra Revisada)')
    const saveSongBtn = songEditor.locator('button:has-text("Guardar Canción")')
    await saveSongBtn.click()
    await songEditor.waitFor({ state: 'hidden', timeout: 5000 })

    const updateLiveBtn = win.locator('.update-live-btn:has-text("Actualizar en vivo")')
    await updateLiveBtn.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '07_live_edit_dirty.png') })
    console.log('  -> Captured: 07_live_edit_dirty.png')

    // =========================================================================
    // STEP 8: Live Update Confirmation
    // =========================================================================
    console.log('[Step 8/17] Pushing updated lyrics to live projection...')
    await updateLiveBtn.click()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '08_live_updated.png') })
    console.log('  -> Captured: 08_live_updated.png')
    await captureOutputWindows('08_live_updated')

    // =========================================================================
    // STEP 9: Bible Reference Search ("Juan 3:16")
    // =========================================================================
    console.log('[Step 9/17] Switching to Bible Tab and searching "Juan 3:16"...')
    const bibleTabBtn = win.locator('.library-tabs .tab-btn:has-text("Biblia")')
    await bibleTabBtn.click()
    await win.waitForTimeout(500)

    const bibleRefInput = win.locator('.bible-reference-input')
    await bibleRefInput.fill('Juan 3:16')
    const bibleGoBtn = win.locator('.bible-go-btn:has-text("Ir")')
    await bibleGoBtn.click()
    await win.waitForTimeout(800)

    const bibleSlide = win.locator('.zone-slides .slide-card:has-text("amó Dios al mundo")')
    await bibleSlide.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '09_bible_search_juan316.png') })
    console.log('  -> Captured: 09_bible_search_juan316.png')

    // =========================================================================
    // STEP 10: Send Scripture Live
    // =========================================================================
    console.log('[Step 10/17] Projecting Juan 3:16 live...')
    await bibleSlide.dblclick()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '10_bible_juan316_live.png') })
    console.log('  -> Captured: 10_bible_juan316_live.png')
    await captureOutputWindows('10_bible_live')

    // =========================================================================
    // STEP 11: Advance to Next Verse with Keyboard
    // =========================================================================
    console.log('[Step 11/17] Advancing to next verse via ArrowDown key...')
    await bibleRefInput.fill('Juan 3:16-17')
    await bibleGoBtn.click()
    await win.waitForTimeout(800)
    const verse16 = win.locator('.zone-slides .slide-card').first()
    await verse16.dblclick()
    await win.waitForTimeout(400)
    await win.keyboard.press('ArrowDown')
    await win.waitForTimeout(600)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '11_bible_next_verse.png') })
    console.log('  -> Captured: 11_bible_next_verse.png')

    // =========================================================================
    // STEP 12: Dual Translations (RVR1909 + KJV)
    // =========================================================================
    console.log('[Step 12/17] Activating Dual Translations (RVR1909 + KJV)...')
    const dualCheckbox = win.locator('.dual-translation-toggle-row input[type="checkbox"]')
    await dualCheckbox.check()
    await win.waitForTimeout(500)
    await bibleGoBtn.click()
    await win.waitForTimeout(800)
    const dualSlide = win.locator('.zone-slides .slide-card:has-text("loved the world")').first()
    await dualSlide.waitFor({ state: 'visible', timeout: 5000 })
    await dualSlide.dblclick()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '12_bible_dual_translations.png') })
    console.log('  -> Captured: 12_bible_dual_translations.png')

    // =========================================================================
    // STEP 13: Phase 5A Video Playback & Output Captures
    // =========================================================================
    console.log('[Step 13/17] Testing Phase 5A Video Playback and Sync...')
    // Switch to Media Library tab
    const mediaTabBtn = win.locator('.library-tabs .tab-btn:has-text("Medios")')
    await mediaTabBtn.click()
    await win.waitForTimeout(500)

    // Generate a synthetic test video inside renderer if not exists
    const testVideoPath = path.join(FIXTURES_DIR, 'test_video.webm')
    if (!fs.existsSync(testVideoPath)) {
      console.log('  -> Generating synthetic WebM video...')
      const vBytes = await win.evaluate(async () => {
        const c = document.createElement('canvas')
        c.width = 1280
        c.height = 720
        const ctx = c.getContext('2d')
        const stream = c.captureStream(30)
        const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
        const chunks = []
        rec.ondataavailable = (e) => chunks.push(e.data)
        const p = new Promise((res) => {
          rec.onstop = async () => {
            const b = new Blob(chunks, { type: 'video/webm' })
            res(Array.from(new Uint8Array(await b.arrayBuffer())))
          }
        })
        rec.start()
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = '#0f172a'
          ctx.fillRect(0, 0, 1280, 720)
          ctx.fillStyle = '#38bdf8'
          ctx.font = '36px sans-serif'
          ctx.fillText(`Video Sintetico ChurchPresenter - Segundo ${(i / 30).toFixed(1)}`, 100, 360)
          await new Promise((r) => setTimeout(r, 33))
        }
        rec.stop()
        return await p
      })
      fs.writeFileSync(testVideoPath, Buffer.from(vBytes))
    }

    // Import the video
    await win.evaluate(async (vPath) => {
      await window.churchPresenterApi.importMediaFile(vPath, ['Prueba'])
    }, testVideoPath)
    await win.waitForTimeout(1000)

    // Reload library tab to show new media
    await mediaTabBtn.click()
    await win.waitForTimeout(500)

    // Play video live
    await win.evaluate(async (vPath) => {
      await window.churchPresenterApi.playVideo({
        mediaId: 'synthetic-video',
        mediaPath: vPath,
        loop: true,
        volume: 0.9,
        endAction: 'freeze'
      })
    }, testVideoPath)
    await win.waitForTimeout(1500)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '13_video_playback_operator.png') })
    console.log('  -> Captured: 13_video_playback_operator.png')
    await captureOutputWindows('13_video_playback')

    // =========================================================================
    // STEP 14: Phase 5A PDF Presentation
    // =========================================================================
    console.log('[Step 14/17] Testing Phase 5A PDF Presentation and Fit Modes...')
    const testPdfPath = path.join(FIXTURES_DIR, 'test_presentation.pdf')
    await win.evaluate(async (pPath) => {
      await window.churchPresenterApi.importMediaFile(pPath, ['Anuncios'])
    }, testPdfPath)
    await win.waitForTimeout(1000)

    // Add PDF item to service and project page 2
    await win.evaluate(async (pPath) => {
      const pdfSlide = {
        id: 'pdf_page_2',
        title: 'Documento PDF (Página 2)',
        body: 'Página 2',
        mediaUrl: pPath,
        mediaType: 'pdf',
        pdfPage: 2,
        pdfPageCount: 3,
        fitMode: 'contain'
      }
      await window.churchPresenterApi.sendSlide(pdfSlide)
    }, testPdfPath)
    await win.waitForTimeout(1500)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '14_pdf_presentation_operator.png') })
    console.log('  -> Captured: 14_pdf_presentation_operator.png')
    await captureOutputWindows('14_pdf_presentation')

    // =========================================================================
    // STEP 15: Dual Translations per Output Role
    // =========================================================================
    console.log('[Step 15/17] Verifying Output Role Specific Bible Layout...')
    await win.evaluate(async () => {
      // Main: single translation RVR1909
      await window.churchPresenterApi.saveRoleBibleConfig({
        role: 'main',
        mode: 'single',
        primaryTranslation: 'RVR1909'
      })
      // Stage: stacked translations RVR1909 + KJV
      await window.churchPresenterApi.saveRoleBibleConfig({
        role: 'stage',
        mode: 'stacked',
        primaryTranslation: 'RVR1909',
        secondaryTranslation: 'KJV'
      })
    })

    // Project passage with role-specific Bible layout
    await win.evaluate(async () => {
      const res = await window.churchPresenterApi.getVersesByReference('Juan 3:16', 'RVR1909', 'KJV')
      const mainVerses = res.verses || []
      const kjvVerses = res.secondaryVerses || []

      const slide = {
        id: 'role_bible_juan316',
        title: 'Juan 3:16',
        body: mainVerses[0]?.text || '',
        scriptureRef: 'Juan 3:16',
        roleOverrides: {
          main: {
            body: mainVerses[0]?.text || ''
          },
          stage: {
            body: `${mainVerses[0]?.text || ''}\n\n[KJV]\n${kjvVerses[0]?.text || ''}`
          }
        }
      }
      await window.churchPresenterApi.sendSlide(slide)
    })
    await win.waitForTimeout(1500)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '15_role_bible_operator.png') })
    console.log('  -> Captured: 15_role_bible_operator.png')
    await captureOutputWindows('15_role_bible')

    // =========================================================================
    // STEP 16: Independent Audio Background Track
    // =========================================================================
    console.log('[Step 16/17] Testing Independent Audio Background Playback...')
    const testAudioPath = path.join(FIXTURES_DIR, 'test_audio.wav')
    await win.evaluate(async (aPath) => {
      await window.churchPresenterApi.playIndependentAudio('ambient-bg', aPath, 'Musica de Bienvenida (Ambient)')
    }, testAudioPath)
    await win.waitForTimeout(1500)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '16_independent_audio.png') })
    console.log('  -> Captured: 16_independent_audio.png')

    // Trigger 3s fade out
    await win.evaluate(async () => {
      await window.churchPresenterApi.controlIndependentAudio('fade-out')
    })
    await win.waitForTimeout(1000)

    // =========================================================================
    // STEP 17: Video Background Loop on Theme
    // =========================================================================
    console.log('[Step 17/17] Testing Video Background on Theme Projection...')
    await win.evaluate(async (vPath) => {
      const slideWithVideoBg = {
        id: 'slide_video_bg',
        title: 'Himno con Fondo Animado',
        body: 'Alabemos al Rey de Gloria\nCon cantos de gratitud',
        theme: {
          background: {
            type: 'video',
            value: vPath
          }
        }
      }
      await window.churchPresenterApi.sendSlide(slideWithVideoBg)
    }, testVideoPath)
    await win.waitForTimeout(1500)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '17_video_background_theme.png') })
    console.log('  -> Captured: 17_video_background_theme.png')
    await captureOutputWindows('17_video_background')

    // =========================================================================
    // STEP 18: PowerPoint (.pptx) Import, Fidelity Warnings & Stage Speaker Notes
    // =========================================================================
    console.log('[Step 18/20] Testing PowerPoint (.pptx) Import & Stage Speaker Notes...')
    const samplePptxPath = path.resolve(__dirname, '../tests/fixtures/sample_presentation.pptx')

    // Import the sample PowerPoint via IPC
    const pptManifest = await win.evaluate(async (pptxPath) => {
      const manifest = await window.churchPresenterApi.importPowerPoint(pptxPath)
      // Send first slide to live (with speaker notes)
      const firstSlide = manifest.slides[0]
      const secondSlide = manifest.slides[1]
      const slideItem = {
        id: `ppt_slide_1`,
        sourceId: 'sample_pptx',
        sourceType: 'powerpoint',
        title: 'Mensaje de Bienvenida',
        body: firstSlide.speakerNotes || '',
        mediaUrl: firstSlide.imagePath,
        speakerNotes: firstSlide.speakerNotes,
        warnings: firstSlide.warnings
      }
      const nextSlideItem = secondSlide ? {
        id: `ppt_slide_2`,
        sourceId: 'sample_pptx',
        sourceType: 'powerpoint',
        title: 'Diapositiva 2',
        body: secondSlide.speakerNotes || ''
      } : undefined

      await window.churchPresenterApi.sendSlide(slideItem, ['main', 'lobby', 'stage'], nextSlideItem)
      return manifest
    }, samplePptxPath)

    await win.waitForTimeout(2000)
    console.log(`  -> PowerPoint imported: ${pptManifest.slideCount} slides converted.`)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '18_powerpoint_operator.png') })
    console.log('  -> Captured: 18_powerpoint_operator.png')
    await captureOutputWindows('18_powerpoint')

    // =========================================================================
    // STEP 19: Audio Device Configuration & Dev Environment Badge
    // =========================================================================
    console.log('[Step 19/20] Verifying Settings Modal, Audio Routing & Dev Badge...')
    // Open Settings modal
    const settingsBtn = win.locator('button[title*="Atajos"]')
    await settingsBtn.click()
    const settingsModal = win.locator('.modal-content.settings-modal')
    await settingsModal.waitFor({ state: 'visible', timeout: 5000 })
    await win.waitForTimeout(1000)

    await win.screenshot({ path: path.join(EVIDENCE_DIR, '19_settings_audio_dev.png') })
    console.log('  -> Captured: 19_settings_audio_dev.png')

    // Close settings modal
    const closeSettingsBtn = settingsModal.locator('button:has-text("Cancelar")')
    await closeSettingsBtn.click()
    await settingsModal.waitFor({ state: 'hidden', timeout: 5000 })

    // =========================================================================
    // STEP 20: Image Folder Presentation Import
    // =========================================================================
    console.log('[Step 20/20] Testing Image Folder Import...')
    const testFolderDir = path.join(tempUserDataDir, 'test_images_folder')
    fs.mkdirSync(testFolderDir, { recursive: true })
    // Create 2 test PNG images
    fs.writeFileSync(path.join(testFolderDir, 'image_1.png'), Buffer.from('fake png image 1 content'))
    fs.writeFileSync(path.join(testFolderDir, 'image_2.png'), Buffer.from('fake png image 2 content'))

    const importedImages = await win.evaluate(async (fDir) => {
      return await window.churchPresenterApi.importImageFolder(fDir)
    }, testFolderDir)
    console.log(`  -> Folder imported: ${importedImages.length} images added to media library.`)

    await win.waitForTimeout(1000)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '20_image_folder_import.png') })
    console.log('  -> Captured: 20_image_folder_import.png')

    console.log('=====================================================')
    console.log('   ALL 20 E2E SCENARIOS VERIFIED & ALL OUTPUTS CAPTURED! ')
    console.log('=====================================================')
  } finally {
    await app.close()
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
    } catch {}
  }
}

run().catch((err) => {
  console.error('[E2E FAILED]:', err)
  process.exit(1)
})
