const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const resedit = require('resedit')

const SOURCE_PNG = 'C:/Users/daini/.gemini/antigravity/brain/28899cf5-6ea7-4067-bb9c-954252bd86f0/.user_uploaded/media_1793967106913_d69f6a86.png'
const ROOT = path.join(__dirname, '..')
const BUILD_DIR = path.join(ROOT, 'build')
const RESOURCES_DIR = path.join(ROOT, 'resources')
const ASSETS_DIR = path.join(ROOT, 'src', 'renderer', 'assets')

fs.mkdirSync(BUILD_DIR, { recursive: true })
fs.mkdirSync(RESOURCES_DIR, { recursive: true })
fs.mkdirSync(ASSETS_DIR, { recursive: true })

console.log('[1/5] Copying master PNGs...')
fs.copyFileSync(SOURCE_PNG, path.join(BUILD_DIR, 'icon.png'))
fs.copyFileSync(SOURCE_PNG, path.join(RESOURCES_DIR, 'icon.png'))
fs.copyFileSync(SOURCE_PNG, path.join(ASSETS_DIR, 'icon.png'))

console.log('[2/5] Generating multi-resolution PNGs...')
const sizes = [16, 24, 32, 48, 64, 128, 256, 512]
const tmpDir = path.join(ROOT, 'scratch', 'ico_tmp')
fs.mkdirSync(tmpDir, { recursive: true })

const icoSizes = [256, 128, 64, 48, 32, 16]
const combinedIco = new resedit.Data.IconFile()
combinedIco.icons = []

for (const s of icoSizes) {
  const tmpIco = path.join(tmpDir, `icon_${s}.ico`)
  const cmd = `ffmpeg -y -i "${SOURCE_PNG}" -vf "scale=${s}:${s}" "${tmpIco}"`
  execSync(cmd, { stdio: 'ignore' })
  const buf = fs.readFileSync(tmpIco)
  const parsed = resedit.Data.IconFile.from(buf)
  combinedIco.icons.push(...parsed.icons)
}

console.log('[3/5] Packing Windows ICO with sizes:', icoSizes.join(', '))
const icoBuffer = Buffer.from(combinedIco.generate())
fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer)
fs.writeFileSync(path.join(RESOURCES_DIR, 'icon.ico'), icoBuffer)

console.log('[4/5] Generating 192x192 & 512x512 PWA icons...')
const pwa192 = path.join(ASSETS_DIR, 'icon-192.png')
const pwa512 = path.join(ASSETS_DIR, 'icon-512.png')
execSync(`ffmpeg -y -i "${SOURCE_PNG}" -vf "scale=192:192" "${pwa192}"`, { stdio: 'ignore' })
execSync(`ffmpeg -y -i "${SOURCE_PNG}" -vf "scale=512:512" "${pwa512}"`, { stdio: 'ignore' })

// Also write base64 data URL file for easy embedding in inline HTML/PWAs
const b64_64 = fs.readFileSync(path.join(ASSETS_DIR, 'icon-192.png')).toString('base64')
fs.writeFileSync(path.join(ASSETS_DIR, 'icon-base64.txt'), `data:image/png;base64,${b64_64}`)

console.log('[5/5] All icon assets generated successfully!')
console.log(' - build/icon.ico:', fs.statSync(path.join(BUILD_DIR, 'icon.ico')).size, 'bytes')
console.log(' - resources/icon.ico:', fs.statSync(path.join(RESOURCES_DIR, 'icon.ico')).size, 'bytes')
console.log(' - build/icon.png:', fs.statSync(path.join(BUILD_DIR, 'icon.png')).size, 'bytes')
