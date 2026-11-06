import { describe, it, expect, beforeEach, vi } from 'vitest'
import { databaseService } from '../src/main/db/database-service'
import { safeStorageService } from '../src/main/security/safe-storage-service'
import { ffmpegService } from '../src/main/media/ffmpeg-service'
import { buildBroadcastFfmpegArgs } from '../src/main/broadcast/broadcast-engine'

describe('Broadcast Engine, Security & YouTube Pipeline Verification', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await databaseService.initialize()
  })

  describe('1. Stream Key Encryption & DPAPI Security', () => {
    it('encrypts and decrypts stream keys preserving exact characters and hyphens', () => {
      const youtubeKey = '4k8p-7m2q-9x1v-5zt8-3wya'
      const encrypted = safeStorageService.encrypt(youtubeKey)

      expect(encrypted).not.toBe(youtubeKey)
      expect(encrypted.startsWith('enc:')).toBe(true)

      const decrypted = safeStorageService.decrypt(encrypted)
      expect(decrypted).toBe(youtubeKey)
    })

    it('trims leading and trailing whitespace from stream keys upon saving', () => {
      const keyWithWhitespace = '   7ybz-912a-44ff-0021-qq12   \n'
      const saved = databaseService.saveBroadcastSettings({
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        rtmpKey: keyWithWhitespace
      })

      expect(saved.rtmpKey).toBe('7ybz-912a-44ff-0021-qq12')
      const fromDb = databaseService.getBroadcastSettings()
      expect(fromDb.rtmpKey).toBe('7ybz-912a-44ff-0021-qq12')
    })
  })

  describe('2. FFmpeg Command Construction with Raw Video & Audio Mapping', () => {
    it('constructs correct arguments for 720p30 with NVENC hardware acceleration', () => {
      const args = buildBroadcastFfmpegArgs({
        resolution: '1280x720',
        fps: 30,
        videoBitrate: '3000k',
        minBitrate: '1500k',
        maxBitrate: '4000k',
        bufSize: '8000k',
        audioBitrate: '128k',
        useNvenc: true,
        rtmpDestination: 'rtmp://a.rtmp.youtube.com/live2/test-key-123',
        localRecordDestination: 'C:\\recordings\\test.mp4',
        recordingFormat: 'mp4'
      })

      // Stdin rawvideo input
      expect(args).toContain('-f')
      expect(args).toContain('rawvideo')
      expect(args).toContain('-pix_fmt')
      expect(args).toContain('rgba')
      expect(args).toContain('-s')
      expect(args).toContain('1280x720')
      expect(args).toContain('-r')
      expect(args).toContain('30')
      expect(args).toContain('pipe:0')

      // Synthetic AAC audio input & mapping
      expect(args.some((a) => a.includes('anullsrc'))).toBe(true)
      expect(args).toContain('-map')
      expect(args).toContain('0:v:0')
      expect(args).toContain('1:a:0')

      // NVENC codec flags
      expect(args).toContain('-c:v')
      expect(args).toContain('h264_nvenc')
      expect(args).toContain('-preset')
      expect(args).toContain('p4')
      expect(args).toContain('-b:v')
      expect(args).toContain('3000k')
      expect(args).toContain('-minrate')
      expect(args).toContain('1500k')
      expect(args).toContain('-maxrate')
      expect(args).toContain('4000k')
      expect(args).toContain('-bufsize')
      expect(args).toContain('8000k')
      expect(args).toContain('-g')
      expect(args).toContain('60')

      // AAC audio flags
      expect(args).toContain('-c:a')
      expect(args).toContain('aac')
      expect(args).toContain('-b:a')
      expect(args).toContain('128k')
      expect(args).toContain('-ar')
      expect(args).toContain('48000')

      // RTMP destination
      expect(args).toContain('rtmp://a.rtmp.youtube.com/live2/test-key-123')
      expect(args).toContain('flv')

      // Local recording destination
      expect(args).toContain('C:\\recordings\\test.mp4')
      expect(args).toContain('+frag_keyframe+empty_moov+default_base_moof')
    })

    it('falls back cleanly to libx264 when NVENC is unavailable', () => {
      const args = buildBroadcastFfmpegArgs({
        resolution: '1920x1080',
        fps: 30,
        videoBitrate: '6000k',
        maxBitrate: '6500k',
        bufSize: '12000k',
        audioBitrate: '160k',
        useNvenc: false,
        rtmpDestination: 'rtmp://a.rtmp.youtube.com/live2/fallback-key'
      })

      expect(args).toContain('-c:v')
      expect(args).toContain('libx264')
      expect(args).toContain('-preset')
      expect(args).toContain('veryfast')
      expect(args).not.toContain('h264_nvenc')
    })
  })

  describe('3. NVENC Hardware Encoder Detection', () => {
    it('detects NVIDIA NVENC support via ffmpegService', async () => {
      const res = await ffmpegService.detectFfmpeg()
      expect(res.available).toBe(true)
      expect(res.path).toBeDefined()
      expect(res.hasNvenc).toBe(true)
    })
  })
})
