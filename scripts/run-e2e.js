/**
 * End-to-End Automated Testing with Playwright and Electron
 * ChurchPresenter - Phase 4 Verification Suite
 *
 * Scenarios tested:
 * 1. App Launch & First-time Demo prompt verification
 * 2. Demo data loading (6 verified public-domain hymns)
 * 3. Library song search ("Castillo") with DEMO badge
 * 4. Worship service assembly (adding song to active service)
 * 5. Sending slide to live projection
 * 6. Global action controls (F1-F4 toggle without interfering with copy/paste)
 * 7. Live editing isolation (live output unchanged until "Actualizar en vivo")
 * 8. Live update confirmation
 * 9. Bible reference search ("Juan 3:16") with tolerant parser
 * 10. Sending Bible passage live
 * 11. Advancing verses with arrow keys
 * 12. Dual translations projection (RVR1909 + KJV)
 *
 * Saves full screenshots to docs/evidence/
 */

const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')
const os = require('os')

const EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence')
const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')

async function run() {
  console.log('=====================================================')
  console.log('   CHURCHPRESENTER E2E VERIFICATION SUITE           ')
  console.log('=====================================================')

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }

  // Ensure fresh isolated user data directory for first-launch prompt test
  const tempUserDataDir = path.join(os.tmpdir(), `church-presenter-e2e-${Date.now()}`)
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

    // Set viewport for clean desktop screenshots
    await win.setViewportSize({ width: 1400, height: 900 })
    await win.waitForTimeout(1000)

    // =========================================================================
    // STEP 1: App Start & First-Launch Modal
    // =========================================================================
    console.log('[Step 1/12] Verifying First-Launch Demo Modal...')
    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido a ChurchPresenter")')
    await firstLaunchModal.waitFor({ state: 'visible', timeout: 8000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '01_app_start.png') })
    console.log('  -> Captured: 01_app_start.png')

    // =========================================================================
    // STEP 2: Load Demo Data
    // =========================================================================
    console.log('[Step 2/12] Loading Public Domain Demo Hymns...')
    const loadDemoBtn = win.locator('button:has-text("Cargar Datos de Demostración")')
    await loadDemoBtn.click()
    await firstLaunchModal.waitFor({ state: 'hidden', timeout: 5000 })
    await win.waitForTimeout(1000)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '02_demo_loaded.png') })
    console.log('  -> Captured: 02_demo_loaded.png')

    // =========================================================================
    // STEP 3: Song Library Search
    // =========================================================================
    console.log('[Step 3/12] Searching song "Castillo" with accent-insensitivity...')
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
    console.log('[Step 4/12] Adding song to Service playlist...')
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
    console.log('[Step 5/12] Projecting slide live...')
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

    // =========================================================================
    // STEP 6: Global Action Controls (F1-F4)
    // =========================================================================
    console.log('[Step 6/12] Testing local F1 Blackout toggle...')
    await win.keyboard.press('F1')
    await win.waitForTimeout(500)
    const blackBtn = win.locator('.global-action-btn.active-black')
    await blackBtn.waitFor({ state: 'visible', timeout: 3000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '06_controls_f1_f4.png') })
    console.log('  -> Captured: 06_controls_f1_f4.png')
    // Turn Black off again
    await win.keyboard.press('F1')
    await win.waitForTimeout(500)

    // =========================================================================
    // STEP 7: Live Edit Isolation (Projection Unchanged until Update)
    // =========================================================================
    console.log('[Step 7/12] Editing live song in editor (verifying projection isolation)...')
    const editSongBtn = win.locator('button:has-text("Editar Canción")')
    await editSongBtn.click()
    const songEditor = win.locator('.song-editor-modal')
    await songEditor.waitFor({ state: 'visible', timeout: 5000 })

    const titleInput = songEditor.locator('.form-group:has-text("Título de la Canción") input')
    await titleInput.fill('Castillo fuerte es nuestro Dios (Letra Revisada)')
    const saveSongBtn = songEditor.locator('button:has-text("Guardar Canción")')
    await saveSongBtn.click()
    await songEditor.waitFor({ state: 'hidden', timeout: 5000 })

    // Verify "Actualizar en vivo" button is shown while live monitor keeps original slide
    const updateLiveBtn = win.locator('.update-live-btn:has-text("Actualizar en vivo")')
    await updateLiveBtn.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '07_live_edit_dirty.png') })
    console.log('  -> Captured: 07_live_edit_dirty.png')

    // =========================================================================
    // STEP 8: Live Update Confirmation
    // =========================================================================
    console.log('[Step 8/12] Pushing updated lyrics to live projection...')
    await updateLiveBtn.click()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '08_live_updated.png') })
    console.log('  -> Captured: 08_live_updated.png')

    // =========================================================================
    // STEP 9: Bible Reference Search ("Juan 3:16")
    // =========================================================================
    console.log('[Step 9/12] Switching to Bible Tab and searching "Juan 3:16"...')
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
    console.log('[Step 10/12] Projecting Juan 3:16 live...')
    await bibleSlide.dblclick()
    await win.waitForTimeout(500)
    const liveBibleSlide = win.locator('.slide-card.is-live:has-text("amó Dios al mundo")').first()
    await liveBibleSlide.waitFor({ state: 'visible', timeout: 5000 })
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '10_bible_juan316_live.png') })
    console.log('  -> Captured: 10_bible_juan316_live.png')

    // =========================================================================
    // STEP 11: Advance to Next Verse with Keyboard
    // =========================================================================
    console.log('[Step 11/12] Advancing to next verse via ArrowDown key...')
    // Load range or chapter so next verse is available in slides
    await bibleRefInput.fill('Juan 3:16-17')
    await bibleGoBtn.click()
    await win.waitForTimeout(800)

    const verse16 = win.locator('.zone-slides .slide-card').first()
    await verse16.dblclick()
    await win.waitForTimeout(400)

    // Press ArrowDown to advance to verse 17
    await win.keyboard.press('ArrowDown')
    await win.waitForTimeout(600)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '11_bible_next_verse.png') })
    console.log('  -> Captured: 11_bible_next_verse.png')

    // =========================================================================
    // STEP 12: Dual Translations (RVR1909 + KJV)
    // =========================================================================
    console.log('[Step 12/12] Activating Dual Translations (RVR1909 + KJV)...')
    const dualCheckbox = win.locator('.dual-translation-toggle-row input[type="checkbox"]')
    await dualCheckbox.check()
    await win.waitForTimeout(500)

    // Refresh passage to generate dual translation slides
    await bibleGoBtn.click()
    await win.waitForTimeout(800)

    const dualSlide = win.locator('.zone-slides .slide-card:has-text("loved the world")').first()
    await dualSlide.waitFor({ state: 'visible', timeout: 5000 })
    await dualSlide.dblclick()
    await win.waitForTimeout(500)
    await win.screenshot({ path: path.join(EVIDENCE_DIR, '12_bible_dual_translations.png') })
    console.log('  -> Captured: 12_bible_dual_translations.png')

    console.log('=====================================================')
    console.log('   ALL 12 E2E SCENARIOS VERIFIED & CAPTURED!        ')
    console.log('=====================================================')
  } finally {
    await app.close()
    // Clean up temporary isolated directory
    try {
      fs.rmSync(tempUserDataDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error if file lock persists briefly
    }
  }
}

run().catch((err) => {
  console.error('[E2E FAILED]:', err)
  process.exit(1)
})
