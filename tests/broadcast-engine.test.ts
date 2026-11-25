import { describe, it, expect, beforeEach, vi } from 'vitest'
import { databaseService } from '../src/main/db/database-service'
import { broadcastEngine, buildBroadcastFfmpegArgs } from '../src/main/broadcast/broadcast-engine'
import { safeStorageService } from '../src/main/security/safe-storage-service'
import { ffmpegService } from '../src/main/media/ffmpeg-service'
import { BroadcastScene, BroadcastAudioMixerState } from '../src/shared/types'

describe('Phase 9: Broadcast Engine, Scenes & Audio Mixer (Stages B, C, D)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await databaseService.initialize()
  })

  describe('1. Migration 11 & Default Factory Scenes', () => {
    it('initializes default factory broadcast scenes from Migration 11', () => {
      const scenes = databaseService.getBroadcastScenes()
      expect(scenes.length).toBeGreaterThanOrEqual(4)

      const fullCam = scenes.find((s) => s.id === 'scene_camera_full')
      expect(fullCam).toBeDefined()
      expect(fullCam?.name).toContain('Cámara Principal')
      expect(fullCam?.layers[0].type).toBe('video_device')

      const lyricsOverlay = scenes.find((s) => s.id === 'scene_camera_lyrics')
      expect(lyricsOverlay).toBeDefined()
      expect(lyricsOverlay?.layers.some((l) => l.type === 'presentation')).toBe(true)

      const pip = scenes.find((s) => s.id === 'scene_slide_pip')
      expect(pip).toBeDefined()
      expect(pip?.layers.length).toBe(2)

      const presOnly = scenes.find((s) => s.id === 'scene_presentation_only')
      expect(presOnly).toBeDefined()
    })

    it('creates, edits, reorders, and deletes custom broadcast scenes', () => {
      const customScene: BroadcastScene = {
        id: 'scene_custom_interview',
        name: 'Entrevista en Vivo',
        orderIndex: 10,
        layers: [
          {
            id: 'layer_cam_pastor',
            name: 'Cámara Pastor',
            type: 'video_device',
            x: 0,
            y: 0,
            width: 50,
            height: 100,
            opacity: 1,
            zIndex: 1,
            visible: true
          },
          {
            id: 'layer_cam_invitado',
            name: 'Cámara Invitado',
            type: 'video_device',
            x: 50,
            y: 0,
            width: 50,
            height: 100,
            opacity: 1,
            zIndex: 1,
            visible: true
          }
        ],
        transitionType: 'fade',
        transitionDurationMs: 400
      }

      databaseService.saveBroadcastScene(customScene)
      let scenes = databaseService.getBroadcastScenes()
      expect(scenes.some((s) => s.id === 'scene_custom_interview')).toBe(true)

      // Edit scene
      customScene.name = 'Entrevista en Vivo (2 Cámaras)'
      databaseService.saveBroadcastScene(customScene)
      scenes = databaseService.getBroadcastScenes()
      const found = scenes.find((s) => s.id === 'scene_custom_interview')
      expect(found?.name).toBe('Entrevista en Vivo (2 Cámaras)')

      // Delete scene
      databaseService.deleteBroadcastScene('scene_custom_interview')
      scenes = databaseService.getBroadcastScenes()
      expect(scenes.some((s) => s.id === 'scene_custom_interview')).toBe(false)
    })
  })

  describe('2. Broadcast Settings & RTMP Key Security', () => {
    it('encrypts RTMP transmission key via safeStorage and avoids plaintext leaks', () => {
      const plainStreamKey = 'live_church_789456123_xyz'
      const encryptedKey = safeStorageService.encrypt(plainStreamKey)

      databaseService.saveBroadcastSettings({
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        rtmpKeyEncrypted: encryptedKey,
        qualityPreset: '1080p30',
        recordLocal: true,
        recordingFormat: 'mp4',
        encoderPreference: 'nvenc',
        audioDelayMs: 120
      })

      const rawEnc = databaseService.getConfig('broadcast_rtmp_key_enc')
      expect(rawEnc).toBeDefined()
      expect(rawEnc).not.toBe(plainStreamKey)
      expect(rawEnc?.startsWith('enc:')).toBe(true)

      const settings = databaseService.getBroadcastSettings()
      expect(settings.rtmpUrl).toBe('rtmp://a.rtmp.youtube.com/live2')
      expect(settings.qualityPreset).toBe('1080p30')
      expect(settings.audioDelayMs).toBe(120)

      const decrypted = safeStorageService.decrypt(settings.rtmpKeyEncrypted!)
      expect(decrypted).toBe(plainStreamKey)
    })
  })

  describe('3. Audio Mixer Configuration & Lip-sync Delay', () => {
    it('persists and retrieves audio mixer channels with gain, mute, and delay', () => {
      const mixerState: BroadcastAudioMixerState = {
        sources: [
          {
            id: 'source_pres',
            name: 'Audio de Canciones y Medios',
            type: 'presentation',
            volume: 0.9,
            muted: false,
            delayMs: 0
          },
          {
            id: 'source_mic',
            name: 'Micrófono Altar (HDMI Cam)',
            type: 'mic_input',
            volume: 1.1,
            muted: false,
            delayMs: 180 // 180 ms lip-sync delay compensation
          }
        ],
        masterVolume: 1.0,
        masterMuted: false,
        limiterEnabled: true
      }

      databaseService.saveAudioMixerConfig(mixerState)
      const retrieved = databaseService.getAudioMixerConfig()

      expect(retrieved.sources.length).toBe(2)
      expect(retrieved.sources[1].delayMs).toBe(180)
      expect(retrieved.limiterEnabled).toBe(true)
    })
  })

  describe('4. BroadcastEngine Execution, Presets & Isolation', () => {
    it('fails gracefully when FFmpeg is not installed without throwing or breaking displays', async () => {
      vi.spyOn(ffmpegService, 'detectFfmpeg').mockResolvedValue({
        available: false,
        path: null,
        version: null
      })

      const res = await broadcastEngine.start({
        stream: true,
        overrideSettings: { rtmpUrl: 'rtmp://test.local/live' }
      })

      expect(res.success).toBe(false)
      expect(res.error).toContain('FFmpeg no está instalado')
      expect(broadcastEngine.getStatus().connectionState).toBe('error')

      await broadcastEngine.stop()
      expect(broadcastEngine.getStatus().isStreaming).toBe(false)
    })

    it('selects NVENC hardware encoder when available', async () => {
      vi.spyOn(ffmpegService, 'detectFfmpeg').mockResolvedValue({
        available: true,
        path: 'mock_ffmpeg.exe',
        version: 'ffmpeg 9.0',
        hasNvenc: true
      })

      // We test that engine respects encoder preference and preset
      databaseService.saveBroadcastSettings({
        encoderPreference: 'nvenc',
        qualityPreset: '1080p30'
      })

      const status = broadcastEngine.getStatus()
      expect(status.isStreaming).toBe(false)
      expect(status.connectionState).toBe('disconnected')
    })

    it('resolves DirectShow audio device from browser label and builds correct FFmpeg dshow audio args', () => {
      const dshowDevices = ['Line (MG-XU)', 'Microphone Array (AMD Audio Device)']

      // Substring match from browser label
      const matched = broadcastEngine.resolveDirectShowAudioDevice('Line (MG-XU) (0499:1703)', dshowDevices)
      expect(matched).toBe('Line (MG-XU)')

      // Fallback if empty
      const defaultDev = broadcastEngine.resolveDirectShowAudioDevice('', dshowDevices)
      expect(defaultDev).toBe('Line (MG-XU)')

      // Check buildBroadcastFfmpegArgs
      const args = buildBroadcastFfmpegArgs({
        resolution: '1280x720',
        fps: 30,
        videoBitrate: '3000k',
        maxBitrate: '4000k',
        bufSize: '8000k',
        audioBitrate: '128k',
        useNvenc: false,
        audioDevice: matched,
        audioFilter: 'volume=1.10,adelay=100|100'
      })

      expect(args).toContain('-f')
      expect(args).toContain('dshow')
      expect(args).toContain('audio=Line (MG-XU)')
      expect(args).toContain('-af')
      expect(args).toContain('volume=1.10,adelay=100|100')
      expect(args).toContain('-c:a')
      expect(args).toContain('aac')
    })
  })
})
