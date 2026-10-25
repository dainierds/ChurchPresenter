/**
 * Generates synthetic, non-copyrighted media fixtures for E2E tests:
 * 1. test_audio.wav (gentle 440Hz / 554Hz chord)
 * 2. test_presentation.pdf (3-page standard PDF 1.4)
 */

const fs = require('fs')
const path = require('path')

const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures')
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })
}

// 1. Generate Synthetic 3-second WAV Audio
function generateWav(filePath, durationSec = 3, sampleRate = 44100) {
  const numChannels = 2
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const totalSamples = durationSec * sampleRate
  const dataSize = totalSamples * blockAlign
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // Subchunk1Size
  buffer.writeUInt16LE(1, 20)  // PCM
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34) // BitsPerSample
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Generate gentle A4 major chord (440Hz + 554.37Hz) with envelope
  let offset = 44
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate
    const envelope = Math.min(1, t * 2) * Math.min(1, (durationSec - t) * 2) // Fade in & out
    const sampleL = Math.sin(2 * Math.PI * 440 * t) * 0.3 * envelope
    const sampleR = Math.sin(2 * Math.PI * 554.37 * t) * 0.3 * envelope

    buffer.writeInt16LE(Math.floor(sampleL * 32767), offset)
    buffer.writeInt16LE(Math.floor(sampleR * 32767), offset + 2)
    offset += 4
  }

  fs.writeFileSync(filePath, buffer)
  console.log(`[Fixture] Generated: ${filePath} (${(buffer.length / 1024).toFixed(1)} KB)`)
}

// 2. Generate Synthetic 3-page PDF 1.4
function generatePdf(filePath) {
  const pages = [
    'Pagina 1: Bienvenidos al Servicio de Adoracion',
    'Pagina 2: Anuncios Comunitarios de la Semana',
    'Pagina 3: Bendicion y Despedida'
  ]

  let pdf = `%PDF-1.4\n`
  const offsets = []

  function addObj(content) {
    offsets.push(pdf.length)
    pdf += `${offsets.length} 0 obj\n${content}\nendobj\n`
    return offsets.length
  }

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`)
  // 2: Pages
  addObj(`<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>`)
  // 3, 4, 5: Page objects
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 9 0 R >> >> >>`)
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 9 0 R >> >> >>`)
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 8 0 R /Resources << /Font << /F1 9 0 R >> >> >>`)

  // 6, 7, 8: Content streams
  for (const text of pages) {
    const stream = `BT /F1 24 Tf 50 700 Td (${text}) Tj ET`
    addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  }

  // 9: Font
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`)

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  fs.writeFileSync(filePath, Buffer.from(pdf, 'utf-8'))
  console.log(`[Fixture] Generated: ${filePath} (${(pdf.length / 1024).toFixed(1)} KB)`)
}

async function generateWebm(filePath) {
  const { chromium } = require('playwright')
  console.log('[Fixture] Launching headless browser for synthetic test video...')
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    const p = new Promise((resolve) => {
      recorder.onstop = async () => {
        const b = new Blob(chunks, { type: 'video/webm' })
        const arr = await b.arrayBuffer()
        resolve(new Uint8Array(arr))
      }
    })
    recorder.start()
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, 1280, 720)
      ctx.fillStyle = '#38bdf8'
      ctx.fillRect(100 + (i * 10) % 1080, 200, 100, 100)
      ctx.fillStyle = '#ffffff'
      ctx.font = '36px sans-serif'
      ctx.fillText(`Synthetic ChurchPresenter Video - Frame ${i}/90`, 120, 400)
      await new Promise((r) => setTimeout(r, 1000 / 30))
    }
    recorder.stop()
    const res = await p
    return Array.from(res)
  })
  await browser.close()
  fs.writeFileSync(filePath, Buffer.from(bytes))
  console.log(`[Fixture] Generated: ${filePath} (${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`)
}

async function main() {
  generateWav(path.join(FIXTURES_DIR, 'test_audio.wav'), 4)
  generatePdf(path.join(FIXTURES_DIR, 'test_presentation.pdf'))
  await generateWebm(path.join(FIXTURES_DIR, 'test_video.webm'))
}

main().catch(console.error)
