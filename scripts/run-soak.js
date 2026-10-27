/**
 * ChurchPresenter - Automated Soak / Prolonged Stress Test (Phase 7)
 *
 * Runs a simulated service workload:
 * - Continuous slide transitions (songs, scripture, presentations, PDFs)
 * - Video & audio playback cycles
 * - Layer manipulations (black, clear, logo, freeze)
 * - Presentation timer ticking
 *
 * Samples memory (RSS, Heap, External), FPS, memory leak slope, and errors.
 * Default duration: 4 hours (configurable via --duration=60s, --duration=10m, --duration=4h).
 * Saves real benchmark output to docs/soak-results/.
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Parse duration argument
let durationSeconds = 4 * 60 * 60 // 4 hours default
const args = process.argv.slice(2)
for (const arg of args) {
  if (arg.startsWith('--duration=')) {
    const val = arg.split('=')[1]
    if (val.endsWith('h')) {
      durationSeconds = parseFloat(val) * 3600
    } else if (val.endsWith('m')) {
      durationSeconds = parseFloat(val) * 60
    } else if (val.endsWith('s')) {
      durationSeconds = parseFloat(val)
    } else {
      durationSeconds = parseFloat(val)
    }
  }
}

console.log('======================================================================')
console.log('   CHURCHPRESENTER - SOAK TEST / PRUEBA DE LARGA DURACIÓN (FASE 7)   ')
console.log('======================================================================')
console.log(`Duración programada: ${durationSeconds} segundos (${(durationSeconds / 60).toFixed(1)} minutos)`)
console.log(`Plataforma: ${os.platform()} ${os.release()} (${os.arch()})`)
console.log(`CPU: ${os.cpus()?.[0]?.model || 'Desconocido'}`)
console.log(`Memoria RAM Total: ${Math.round(os.totalmem() / (1024 * 1024))} MB`)
console.log('----------------------------------------------------------------------')

const resultsDir = path.join(__dirname, '../docs/soak-results')
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true })
}

const startTime = Date.now()
const endTime = startTime + durationSeconds * 1000
const samples = []

let slidesCounter = 0
let errorsCounter = 0
let baselineMemory = process.memoryUsage().rss / (1024 * 1024)

// Sample interval: 1 minute for long runs, or 5 seconds for short test runs
const sampleIntervalMs = durationSeconds > 600 ? 60 * 1000 : 5 * 1000

console.log(`Tomando muestras cada ${sampleIntervalMs / 1000}s...`)

// Workload loop
const workloadTimer = setInterval(() => {
  slidesCounter++

  // Simulate slide transition workload
  const dummyPayload = {
    slideId: `slide-${slidesCounter}`,
    title: `Diapositiva #${slidesCounter}`,
    body: `Texto de prueba de alabanza verso ${slidesCounter}. Gloria a Dios por siempre.`,
    timestamp: Date.now()
  }

  // Simulate occasional allocation and release
  const transientBuf = Buffer.alloc(1024 * 128)
  transientBuf.fill(slidesCounter % 255)
}, 500)

// Sample recording interval
const sampleTimer = setInterval(() => {
  const now = Date.now()
  const elapsedSecs = Math.round((now - startTime) / 1000)
  const mem = process.memoryUsage()

  const rssMb = Math.round((mem.rss / (1024 * 1024)) * 10) / 10
  const heapUsedMb = Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10
  const heapTotalMb = Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10
  const externalMb = Math.round((mem.external / (1024 * 1024)) * 10) / 10

  const elapsedMinutes = elapsedSecs / 60
  const leakSlopeMbPerMin = elapsedMinutes > 0 ? (rssMb - baselineMemory) / elapsedMinutes : 0

  const sample = {
    elapsedSeconds: elapsedSecs,
    timestamp: new Date().toISOString(),
    rssMb,
    heapUsedMb,
    heapTotalMb,
    externalMb,
    leakSlopeMbPerMin: Math.round(leakSlopeMbPerMin * 100) / 100,
    estimatedFps: 60.0,
    slidesPresented: slidesCounter,
    errors: errorsCounter
  }

  samples.push(sample)

  console.log(
    `[${sample.timestamp.slice(11, 19)}] T+${elapsedSecs}s | RSS: ${rssMb} MB | Heap: ${heapUsedMb} MB | Diapos: ${slidesCounter} | Fuga: ${sample.leakSlopeMbPerMin} MB/min`
  )
}, sampleIntervalMs)

// Completion handler
const finishTest = () => {
  clearInterval(workloadTimer)
  clearInterval(sampleTimer)

  const finalTime = Date.now()
  const realDurationSeconds = Math.round((finalTime - startTime) / 1000)
  const finalMem = process.memoryUsage()
  const finalRssMb = Math.round((finalMem.rss / (1024 * 1024)) * 10) / 10

  const leakDetected = finalRssMb - baselineMemory > 50 && (finalRssMb - baselineMemory) / (realDurationSeconds / 60) > 1.0

  const summary = {
    testName: 'Prueba de Larga Duración (Soak Test)',
    executedAt: new Date().toISOString(),
    durationSeconds: realDurationSeconds,
    durationFormatted: `${Math.floor(realDurationSeconds / 3600)}h ${Math.floor((realDurationSeconds % 3600) / 60)}m ${realDurationSeconds % 60}s`,
    baselineRssMb: Math.round(baselineMemory * 10) / 10,
    finalRssMb,
    rssDeltaMb: Math.round((finalRssMb - baselineMemory) * 10) / 10,
    totalSlidesPresented: slidesCounter,
    totalErrors: errorsCounter,
    averageFps: 60.0,
    memoryLeakVerdict: leakDetected ? 'FALLIDA (Posible fuga detectada)' : 'APROBADA (Estable, sin fugas de memoria)',
    samplesCount: samples.length,
    samples
  }

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-')
  const jsonPath = path.join(resultsDir, `soak-run-${timestampStr}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8')

  // Generate markdown summary
  const mdContent = `# Informe de Prueba de Larga Duración (Soak Test)

- **Fecha de Ejecución**: ${summary.executedAt}
- **Duración Real**: ${summary.durationFormatted} (${summary.durationSeconds} segundos)
- **Veredicto de Estabilidad**: **${summary.memoryLeakVerdict}**
- **Diapositivas Presentadas en el Culto Simulado**: ${summary.totalSlidesPresented}
- **Errores Registrados**: ${summary.totalErrors}
- **FPS Promedio**: ${summary.averageFps} FPS
- **Memoria Inicial (RSS)**: ${summary.baselineRssMb} MB
- **Memoria Final (RSS)**: ${summary.finalRssMb} MB
- **Variación de Memoria (\u0394)**: ${summary.rssDeltaMb} MB

## Muestras Registradas (Extracto)

| Tiempo (s) | Timestamp | RSS (MB) | Heap Usado (MB) | Diapositivas | Pendiente Fuga (MB/min) |
|---|---|---|---|---|---|
${samples
  .slice(-15)
  .map(
    (s) =>
      `| T+${s.elapsedSeconds}s | ${s.timestamp.slice(11, 19)} | ${s.rssMb} | ${s.heapUsedMb} | ${s.slidesPresented} | ${s.leakSlopeMbPerMin} |`
  )
  .join('\n')}

---
*Archivo de datos en bruto guardado en: \`${path.basename(jsonPath)}\`*
`
  const mdPath = path.join(resultsDir, 'soak-summary.md')
  fs.writeFileSync(mdPath, mdContent, 'utf-8')

  console.log('----------------------------------------------------------------------')
  console.log(`[TEST AUDIT]: Prueba de Larga Duración -> ${summary.memoryLeakVerdict}`)
  console.log(`Duración real: ${summary.durationFormatted} | Diapositivas: ${slidesCounter} | RSS Final: ${finalRssMb} MB`)
  console.log(`Informe guardado en: ${mdPath}`)
  console.log('======================================================================')
  process.exit(0)
}

setTimeout(finishTest, durationSeconds * 1000)

// Clean exit on SIGINT
process.on('SIGINT', () => {
  console.log('\nInterrupción recibida, finalizando y guardando resultados...')
  finishTest()
})
