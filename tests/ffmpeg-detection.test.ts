import { describe, it, expect } from 'vitest'
import { ffmpegService } from '../src/main/media/ffmpeg-service'

describe('FFmpeg & NVENC Detection on Windows 11 Host', () => {
  it('detects system FFmpeg, ffprobe, and checks NVENC hardware encoder', async () => {
    const status = await ffmpegService.detectFfmpeg()
    console.log('Detected FFmpeg Status:', status)
    expect(status.available).toBe(true)
    expect(status.path).toBeDefined()
    expect(status.version).toContain('ffmpeg')
    expect(status.hasNvenc).toBe(true)
  })
})
