const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')

const MAIN_SCRIPT = path.resolve(__dirname, '../out/main/index.js')
const SETTINGS_EVIDENCE_DIR = path.resolve(__dirname, '../docs/evidence/settings-ui')

if (!fs.existsSync(SETTINGS_EVIDENCE_DIR)) {
  fs.mkdirSync(SETTINGS_EVIDENCE_DIR, { recursive: true })
}

const CATEGORIES = [
  { id: 'general', name: '01_general', label: 'General' },
  { id: 'displays', name: '02_pantallas', label: 'Pantallas' },
  { id: 'audio', name: '03_audio', label: 'Audio' },
  { id: 'remote', name: '04_red_y_remoto', label: 'Red y Remoto' },
  { id: 'cameras', name: '05_camaras', label: 'Cámaras' },
  { id: 'broadcast', name: '06_transmision', label: 'Transmisión' },
  { id: 'bibles', name: '07_biblias', label: 'Biblias' },
  { id: 'keyboard', name: '08_teclado', label: 'Teclado' },
  { id: 'data', name: '09_datos_y_respaldo', label: 'Datos y Respaldo' },
  { id: 'appearance', name: '10_apariencia', label: 'Apariencia' },
  { id: 'advanced', name: '11_avanzado', label: 'Avanzado' }
]

async function run() {
  console.log('======================================================================')
  console.log('  CHURCHPRESENTER: SETTINGS UI SIDEBAR CAPTURE & VERIFICATION')
  console.log('======================================================================')

  const app = await electron.launch({
    args: [MAIN_SCRIPT],
    env: { ...process.env, NODE_ENV: 'test' }
  })

  try {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await win.setViewportSize({ width: 1920, height: 1080 })
    await win.waitForTimeout(1000)

    // Close first launch modal if present
    const firstLaunchModal = win.locator('.modal-backdrop:has-text("Bienvenido")')
    if (await firstLaunchModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      const loadDemoBtn = win.locator('button:has-text("Cargar Datos de Demostración")')
      await loadDemoBtn.click()
      await firstLaunchModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    }

    // Open Settings Modal
    console.log('[1/4] Opening Settings modal via menu...')
    const settingsModal = win.locator('.settings-modal')
    if (!await settingsModal.isVisible()) {
      const archivoTrigger = win.locator('.pro-menu-trigger:has-text("Archivo")')
      await archivoTrigger.click()
      await win.waitForTimeout(250)
      const configItem = win.locator('.pro-dropdown-item:has-text("Configuración")')
      await configItem.click()
    }
    await settingsModal.waitFor({ state: 'visible', timeout: 6000 })
    await win.waitForTimeout(500)

    // Capture each category at 1920x1080
    console.log('[2/4] Capturing screenshots for each category at 1920x1080...')
    for (const cat of CATEGORIES) {
      const btn = win.locator(`.settings-nav-btn:has-text("${cat.label}")`)
      await btn.click()
      await win.waitForTimeout(350)
      const outPath = path.join(SETTINGS_EVIDENCE_DIR, `${cat.name}_1920x1080.png`)
      await win.screenshot({ path: outPath })
      console.log(`  -> Captured ${cat.label} -> ${outPath}`)
    }

    // Test State Preservation across Category Switching
    console.log('[3/4] Verifying state preservation across category switching...')
    // Switch to General
    await win.locator('.settings-nav-btn:has-text("General")').click()
    await win.waitForTimeout(250)
    const churchNameInput = win.locator('.settings-content-area input[placeholder*="Iglesia Bautista"]')
    await churchNameInput.fill('Iglesia Gracia & Paz Demo Test')
    
    // Switch to Teclado, then to Audio, then back to General
    await win.locator('.settings-nav-btn:has-text("Teclado")').click()
    await win.waitForTimeout(250)
    await win.locator('.settings-nav-btn:has-text("Audio")').click()
    await win.waitForTimeout(250)
    await win.locator('.settings-nav-btn:has-text("General")').click()
    await win.waitForTimeout(250)

    const preservedValue = await churchNameInput.inputValue()
    if (preservedValue !== 'Iglesia Gracia & Paz Demo Test') {
      throw new Error(`State was NOT preserved! Expected "Iglesia Gracia & Paz Demo Test", got "${preservedValue}"`)
    }
    console.log('  -> State preservation verified: Input value remained intact across category switches.')

    // Test at 1366x768
    console.log('[4/4] Testing resolutions (1366x768 and < 900px responsive mobile dropdown)...')
    await win.setViewportSize({ width: 1366, height: 768 })
    await win.waitForTimeout(400)
    await win.screenshot({ path: path.join(SETTINGS_EVIDENCE_DIR, 'settings_modal_1366x768.png') })
    console.log('  -> Captured at 1366x768.')

    // Test at 850x700 (< 900px)
    await win.setViewportSize({ width: 850, height: 700 })
    await win.waitForTimeout(400)
    const mobileNav = win.locator('.settings-mobile-nav')
    const mobileSelect = win.locator('.settings-mobile-select')
    const isMobileNavVisible = await mobileNav.isVisible()
    console.log(`  -> Under 900px mobile dropdown visible: ${isMobileNavVisible}`)
    if (!isMobileNavVisible) {
      throw new Error('Mobile dropdown did not become visible under 900px viewport width!')
    }
    await mobileSelect.selectOption('audio')
    await win.waitForTimeout(300)
    await win.screenshot({ path: path.join(SETTINGS_EVIDENCE_DIR, 'settings_modal_mobile_under_900px.png') })
    console.log('  -> Captured mobile dropdown mode under 900px.')

    console.log('\n[SUCCESS] All Settings UI sidebar tests and evidence captures completed successfully!')
  } finally {
    await app.close()
  }
}

run().catch((err) => {
  console.error('[ERROR] Failed settings capture script:', err)
  process.exit(1)
})
