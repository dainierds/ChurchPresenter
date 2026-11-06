const { _electron: electron } = require('playwright')
const path = require('path')
const fs = require('fs')

async function captureBroadcastEvidence() {
  const appPath = path.resolve(__dirname, '..')
  const tmpUserData = path.join(__dirname, '..', 'scratch', 'test-user-data-evidence')
  fs.mkdirSync(tmpUserData, { recursive: true })
  console.log('[Capture] Launching app for broadcast evidence...')
  const electronApp = await electron.launch({
    args: ['.', `--user-data-dir=${tmpUserData}`],
    cwd: appPath,
    env: { ...process.env, NODE_ENV: 'production' }
  })

  try {
    const win = await electronApp.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await win.waitForTimeout(2000)

    // Close demo modal if open
    const modalBtn = win.locator('button:has-text("Cargar Datos de Demostración")')
    if (await modalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalBtn.click()
      await win.waitForTimeout(1000)
    }

    // Go to Transmisión tab
    const transTab = win.locator('button:has-text("Transmisión")')
    if (await transTab.isVisible()) {
      await transTab.click()
      await win.waitForTimeout(1500)
    }

    // Open Transitions subtab to show Filmora-style transition gallery
    const transSubTab = win.locator('button:has-text("Transiciones")')
    if (await transSubTab.isVisible()) {
      await transSubTab.click()
      await win.waitForTimeout(1000)
    }

    const outDir = path.join(__dirname, '..', 'docs', 'evidence')
    fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, '31_broadcast_filmora_and_media_layer.png')
    await win.screenshot({ path: outPath })
    console.log('[Capture] Screenshot saved to:', outPath)

  } finally {
    await electronApp.close()
  }
}

captureBroadcastEvidence().catch((err) => {
  console.error('[Capture] Error:', err)
  process.exit(1)
})
