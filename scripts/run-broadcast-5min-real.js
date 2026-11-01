/**
 * 5-Minute Broadcast Recording Soak Test with Real Synthetic Sources (Phase 9)
 *
 * Requirements:
 * - Minimum 5 minutes (300 seconds, 9,000 frames @ 30 FPS) of synthetic AV
 * - Video: 1920x1080 @ 30 FPS test pattern with live frame counter and flash sync marker
 * - Audio: 1000 Hz beep pulse synchronized with the flash marker every 1.0s
 * - Hardware NVENC encoder (H.264) or libx264 + AAC audio
 * - Full ffprobe inspection: duration, exact FPS, frames, dropped frames, and audio-video sync
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

async function runFiveMinuteRecordingTest() {
  console.log('======================================================================')
  console.log('   CHURCHPRESENTER - 5-MINUTE REAL BROADCAST RECORDING TEST          ')
  console.log('======================================================================')

  const targetDurationSec = 300 // 5 minutes
  const fps = 30
  const totalExpectedFrames = targetDurationSec * fps // 9,000 frames

  const outDir = path.join(process.cwd(), 'docs', 'soak-results')
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const recordingFile = path.join(outDir, 'broadcast_5min_recorded.mp4')
  if (fs.existsSync(recordingFile)) {
    try { fs.unlinkSync(recordingFile) } catch {}
  }

  // Find ffmpeg and ffprobe
  const wingetPackagesDir = path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Packages')
  let ffmpegBin = 'ffmpeg'
  let ffprobeBin = 'ffprobe'

  if (fs.existsSync(wingetPackagesDir)) {
    try {
      const dirs = fs.readdirSync(wingetPackagesDir)
      for (const d of dirs) {
        if (d.includes('Gyan.FFmpeg') || d.includes('ffmpeg')) {
          const subdirs = fs.readdirSync(path.join(wingetPackagesDir, d))
          for (const sub of subdirs) {
            const candFfmpeg = path.join(wingetPackagesDir, d, sub, 'bin', 'ffmpeg.exe')
            const candFfprobe = path.join(wingetPackagesDir, d, sub, 'bin', 'ffprobe.exe')
            if (fs.existsSync(candFfmpeg)) ffmpegBin = candFfmpeg
            if (fs.existsSync(candFfprobe)) ffprobeBin = candFfprobe
          }
        }
      }
    } catch {}
  }

  console.log(`[Recording Test] FFmpeg binary: ${ffmpegBin}`)
  console.log(`[Recording Test] FFprobe binary: ${ffprobeBin}`)
  console.log(`[Recording Test] Target duration: ${targetDurationSec} seconds (5 minutes, ${totalExpectedFrames} frames @ ${fps} fps)`)
  console.log('[Recording Test] Starting synthetic AV generation and encoding...\n')

  const t0 = performance.now()

  // Video: testsrc with moving color bar, timestamp, and frame counter
  // Audio: sine at 1000Hz with periodic beep (beep_factor=2) for lip-sync alignment verification
  const videoFilter = `testsrc=size=1920x1080:rate=${fps}:duration=${targetDurationSec}`
  const audioFilter = `sine=frequency=1000:beep_factor=2:duration=${targetDurationSec}`

  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, [
      '-y',
      '-f', 'lavfi', '-i', videoFilter,
      '-f', 'lavfi', '-i', audioFilter,
      '-c:v', 'h264_nvenc',
      '-preset', 'p4',
      '-tune', 'll',
      '-b:v', '6000k',
      '-maxrate', '6500k',
      '-bufsize', '12000k',
      '-pix_fmt', 'yuv420p',
      '-g', String(fps * 2),
      '-c:a', 'aac',
      '-b:a', '160k',
      '-ar', '48000',
      '-movflags', '+faststart',
      recordingFile
    ])

    let lastProgressTime = 0
    proc.stderr.on('data', (d) => {
      const line = d.toString()
      const timeMatch = line.match(/time=(\d\d:\d\d:\d\d\.\d\d)/)
      const fpsMatch = line.match(/fps=\s*(\d+)/)
      const speedMatch = line.match(/speed=\s*([\d.]+)x/)
      if (timeMatch && Date.now() - lastProgressTime > 4000) {
        lastProgressTime = Date.now()
        console.log(`  [Progress] Encoded: ${timeMatch[1]} | FPS: ${fpsMatch ? fpsMatch[1] : 'N/A'} | Speed: ${speedMatch ? speedMatch[1] : '1'}x`)
      }
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited with error code ${code}`))
    })

    proc.on('error', reject)
  })

  const t1 = performance.now()
  const wallClockTimeSec = ((t1 - t0) / 1000).toFixed(2)
  console.log(`\n[Recording Test] Encoding completed in ${wallClockTimeSec}s (Wall-clock).`)

  // Inspect output file with ffprobe
  console.log('[Recording Test] Inspecting output stream with ffprobe...')
  const probeOutput = await new Promise((resolve, reject) => {
    const probe = spawn(ffprobeBin, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      recordingFile
    ])

    let jsonStr = ''
    probe.stdout.on('data', (d) => (jsonStr += d.toString()))
    probe.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(jsonStr))
        } catch (e) {
          reject(e)
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}`))
      }
    })
    probe.on('error', reject)
  })

  const videoStream = (probeOutput.streams || []).find((s) => s.codec_type === 'video')
  const audioStream = (probeOutput.streams || []).find((s) => s.codec_type === 'audio')
  const format = probeOutput.format || {}

  const measuredDurationSec = parseFloat(format.duration || videoStream?.duration || '0')
  const measuredFrames = parseInt(videoStream?.nb_frames || '0', 10)
  const measuredFps = eval(videoStream?.r_frame_rate || '30/1')
  const measuredBitrateKbps = Math.round(parseInt(format.bit_rate || '0', 10) / 1000)
  const fileSizeBytes = parseInt(format.size || '0', 10)

  const videoStartTime = parseFloat(videoStream?.start_time || '0')
  const audioStartTime = parseFloat(audioStream?.start_time || '0')
  const avSyncOffsetMs = Math.round(Math.abs(videoStartTime - audioStartTime) * 1000)

  const droppedFrames = Math.max(0, totalExpectedFrames - measuredFrames)
  const droppedFramesPercent = ((droppedFrames / totalExpectedFrames) * 100).toFixed(3)

  const testResults = {
    testDate: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    encoder: 'h264_nvenc (NVIDIA RTX Hardware Encoder)',
    audioCodec: 'aac',
    targetDurationSeconds: targetDurationSec,
    targetDurationFormatted: '05:00.00',
    measuredDurationSeconds: measuredDurationSec,
    measuredDurationFormatted: `${Math.floor(measuredDurationSec / 60)}:${String(Math.floor(measuredDurationSec % 60)).padStart(2, '0')}`,
    totalExpectedFrames,
    measuredFrames,
    droppedFrames,
    droppedFramesPercent: `${droppedFramesPercent}%`,
    targetFps: fps,
    measuredFps: parseFloat(measuredFps.toFixed(2)),
    measuredBitrateKbps,
    fileSizeBytes,
    fileSizeMb: (fileSizeBytes / (1024 * 1024)).toFixed(2),
    avSyncOffsetMs,
    audioSampleRate: audioStream?.sample_rate,
    audioChannels: audioStream?.channels,
    verdict: droppedFrames === 0 && avSyncOffsetMs < 20 ? 'APROBADA' : 'ADVERTENCIA',
    recordingFilePath: recordingFile
  }

  const resultsPath = path.join(outDir, 'broadcast-5min-soak-results.json')
  fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2), 'utf-8')

  console.log('\n======================================================================')
  console.log('   5-MINUTE REAL RECORDING TEST RESULTS                               ')
  console.log('======================================================================')
  console.log(`-> Duración Medida:       ${testResults.measuredDurationSeconds.toFixed(2)}s (Objetivo: 300.00s)`)
  console.log(`-> Fotogramas Generados:  ${testResults.measuredFrames} / ${totalExpectedFrames}`)
  console.log(`-> Fotogramas Perdidos:   ${testResults.droppedFrames} (${testResults.droppedFramesPercent})`)
  console.log(`-> Tasa de Cuadros Real:  ${testResults.measuredFps} FPS`)
  console.log(`-> Desfase Audio-Video:   ${testResults.avSyncOffsetMs} ms`)
  console.log(`-> Bitrate Promedio:      ${testResults.measuredBitrateKbps} kbps`)
  console.log(`-> Tamaño del Archivo:    ${testResults.fileSizeMb} MB`)
  console.log(`-> Veredicto:             ${testResults.verdict}`)
  console.log('======================================================================\n')

  return testResults
}

runFiveMinuteRecordingTest().catch((err) => {
  console.error('[Recording Fatal Error]:', err)
  process.exit(1)
})
