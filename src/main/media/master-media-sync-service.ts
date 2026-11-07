import { EventEmitter } from 'events'
import {
  IndependentAudioState,
  MediaSyncTick,
  VideoItemConfig
} from '../../shared/types'
import { clampMediaTime } from '../../shared/media-sync-utils'
import { logger } from '../logger'

export class MasterMediaSyncService extends EventEmitter {
  private currentVideoConfig: VideoItemConfig | null = null
  private videoCurrentTime: number = 0
  private videoDuration: number = 0
  private isVideoPlaying: boolean = false
  private videoSyncInterval: NodeJS.Timeout | null = null
  private audioDeviceId: string = ''

  private independentAudio: IndependentAudioState = {
    isPlaying: false,
    mediaId: null,
    filePath: null,
    title: null,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isFadingOut: false
  }
  private audioSyncInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
  }

  // =========================================================================
  // VIDEO MASTER CLOCK MANAGEMENT
  // =========================================================================

  public playVideo(config: VideoItemConfig): MediaSyncTick {
    if (config.audioDeviceId !== undefined) {
      this.audioDeviceId = config.audioDeviceId
    } else if (this.audioDeviceId) {
      config.audioDeviceId = this.audioDeviceId
    }
    this.currentVideoConfig = config
    this.videoCurrentTime = config.inPoint || 0
    this.isVideoPlaying = true

    if (this.videoSyncInterval) {
      clearInterval(this.videoSyncInterval)
    }

    const tickMs = 200
    this.videoSyncInterval = setInterval(() => {
      this.stepVideoTick(tickMs / 1000)
    }, tickMs)

    logger.info(`Master clock started video: ${config.mediaId} (in: ${config.inPoint || 0}s, out: ${config.outPoint || 'end'})`)
    return this.createVideoSyncTick()
  }

  public controlVideo(action: 'play' | 'pause' | 'stop' | 'seek', time?: number): MediaSyncTick | null {
    if (!this.currentVideoConfig) return null

    switch (action) {
      case 'play':
        this.isVideoPlaying = true
        if (!this.videoSyncInterval) {
          const tickMs = 200
          this.videoSyncInterval = setInterval(() => {
            this.stepVideoTick(tickMs / 1000)
          }, tickMs)
        }
        break
      case 'pause':
        this.isVideoPlaying = false
        break
      case 'stop':
        this.isVideoPlaying = false
        this.videoCurrentTime = this.currentVideoConfig.inPoint || 0
        if (this.videoSyncInterval) {
          clearInterval(this.videoSyncInterval)
          this.videoSyncInterval = null
        }
        break
      case 'seek':
        if (time !== undefined) {
          this.videoCurrentTime = clampMediaTime(
            time,
            this.currentVideoConfig.inPoint || 0,
            this.currentVideoConfig.outPoint,
            this.videoDuration
          )
        }
        break
    }

    const tick = this.createVideoSyncTick()
    this.emit('sync-tick', tick)
    return tick
  }

  public stopVideo(): void {
    if (this.videoSyncInterval) {
      clearInterval(this.videoSyncInterval)
      this.videoSyncInterval = null
    }
    this.currentVideoConfig = null
    this.isVideoPlaying = false
    this.videoCurrentTime = 0
  }

  public setAudioDeviceId(id: string): void {
    this.audioDeviceId = id || ''
    if (this.currentVideoConfig) {
      this.currentVideoConfig.audioDeviceId = this.audioDeviceId
    }
  }

  public getAudioDeviceId(): string {
    return this.audioDeviceId
  }

  public updateVideoDuration(duration: number): void {
    this.videoDuration = duration
  }

  private stepVideoTick(deltaSeconds: number): void {
    if (!this.currentVideoConfig || !this.isVideoPlaying) return

    this.videoCurrentTime += deltaSeconds

    const inPoint = this.currentVideoConfig.inPoint || 0
    const outPoint =
      this.currentVideoConfig.outPoint !== undefined
        ? this.currentVideoConfig.outPoint
        : this.videoDuration > 0
          ? this.videoDuration
          : undefined

    if (outPoint !== undefined && this.videoCurrentTime >= outPoint) {
      if (this.currentVideoConfig.loop) {
        this.videoCurrentTime = inPoint
      } else {
        // Al terminar el video/canción: vuelve automáticamente al inicio (inPoint o 0),
        // queda en pausa esperando por si quiere ser reproducida, sin reproducirse automáticamente
        this.videoCurrentTime = inPoint
        this.isVideoPlaying = false
        if (this.videoSyncInterval) {
          clearInterval(this.videoSyncInterval)
          this.videoSyncInterval = null
        }
        this.emit('video-ended', {
          mediaId: this.currentVideoConfig.mediaId,
          endAction: this.currentVideoConfig.endAction
        })
      }
    }

    const tick = this.createVideoSyncTick()
    this.emit('sync-tick', tick)
  }

  public createVideoSyncTick(): MediaSyncTick {
    if (!this.currentVideoConfig) {
      return {
        mediaId: '',
        mediaType: 'video',
        filePath: '',
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        loop: false,
        volume: 1.0,
        audioOutputRole: 'main',
        audioDeviceId: this.audioDeviceId || '',
        timestamp: Date.now()
      }
    }

    return {
      mediaId: this.currentVideoConfig.mediaId,
      mediaType: 'video',
      filePath: this.currentVideoConfig.mediaPath,
      isPlaying: this.isVideoPlaying,
      currentTime: this.videoCurrentTime,
      duration: this.videoDuration,
      loop: this.currentVideoConfig.loop,
      volume: this.currentVideoConfig.volume,
      audioOutputRole: this.currentVideoConfig.audioOutputRole || 'main',
      audioDeviceId: this.currentVideoConfig.audioDeviceId ?? this.audioDeviceId ?? '',
      inPoint: this.currentVideoConfig.inPoint,
      outPoint: this.currentVideoConfig.outPoint,
      timestamp: Date.now()
    }
  }

  // =========================================================================
  // INDEPENDENT BACKGROUND AUDIO MANAGEMENT
  // =========================================================================

  public playIndependentAudio(mediaId: string, filePath: string, title?: string): IndependentAudioState {
    this.independentAudio = {
      isPlaying: true,
      mediaId,
      filePath,
      title: title || 'Pista de Audio',
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isFadingOut: false
    }

    if (this.audioSyncInterval) {
      clearInterval(this.audioSyncInterval)
    }

    const tickMs = 500
    this.audioSyncInterval = setInterval(() => {
      if (this.independentAudio.isPlaying) {
        this.independentAudio.currentTime += tickMs / 1000
        this.emit('audio-updated', this.independentAudio)
      }
    }, tickMs)

    logger.info(`Independent audio started: ${title || mediaId}`)
    this.emit('audio-updated', this.independentAudio)
    return this.independentAudio
  }

  public controlIndependentAudio(
    action: 'play' | 'pause' | 'stop' | 'fade-out' | 'volume',
    value?: number
  ): IndependentAudioState {
    switch (action) {
      case 'play':
        this.independentAudio.isPlaying = true
        break
      case 'pause':
        this.independentAudio.isPlaying = false
        break
      case 'stop':
        this.independentAudio.isPlaying = false
        this.independentAudio.currentTime = 0
        if (this.audioSyncInterval) {
          clearInterval(this.audioSyncInterval)
          this.audioSyncInterval = null
        }
        break
      case 'volume':
        if (value !== undefined) {
          this.independentAudio.volume = Math.max(0, Math.min(1, value))
        }
        break
      case 'fade-out': {
        this.independentAudio.isFadingOut = true
        // 3-second gentle fade-out
        let steps = 15
        const stepTime = 200
        const volumeDrop = this.independentAudio.volume / steps
        const fadeTimer = setInterval(() => {
          this.independentAudio.volume = Math.max(0, this.independentAudio.volume - volumeDrop)
          this.emit('audio-updated', this.independentAudio)
          steps--
          if (steps <= 0 || this.independentAudio.volume <= 0.01) {
            clearInterval(fadeTimer)
            this.controlIndependentAudio('stop')
          }
        }, stepTime)
        break
      }
    }

    this.emit('audio-updated', this.independentAudio)
    return this.independentAudio
  }

  public getIndependentAudioState(): IndependentAudioState {
    return { ...this.independentAudio }
  }
}

export const masterMediaSyncService = new MasterMediaSyncService()
