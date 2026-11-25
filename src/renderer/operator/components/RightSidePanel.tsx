import React, { useState, useEffect } from 'react'
import {
  Tv,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Layers,
  Snowflake,
  Maximize2,
  Zap,
  Copy,
  Edit2,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  PresenterState,
  PresentationTimer,
  SlideItem,
  TimerType,
  YouTubeSyncTick,
  MediaSyncTick,
  MacroItem,
  PropItem,
  BroadcastAudioMixerState,
  BroadcastAudioSource
} from '../../../shared/types'
import { parseYouTubeUrl } from '../../../shared/youtube-utils'
import { toMediaUrl } from '../../../shared/media-url'

interface RightSidePanelProps {
  state: PresenterState | null
  currentSlide: SlideItem | null
  timers: PresentationTimer[]
  onControlTimer: (id: string, action: 'start' | 'pause' | 'reset') => void
  onSaveTimer: (timer: PresentationTimer) => void
  onDeleteTimer: (id: string) => void
  onClearLayer: (layer: 'audio' | 'background' | 'slide' | 'message' | 'media' | 'all') => void
  onControlVideo: (action: 'play' | 'pause' | 'stop' | 'seek', time?: number) => void
  macros?: MacroItem[]
  propsList?: PropItem[]
  onRunMacro?: (id: string) => void
  onRunMacroStep?: (id: string, stepIndex: number) => void
  onStopAllMacros?: () => void
  onOpenMacroEditor?: (macro?: MacroItem) => void
  onDeleteMacro?: (id: string) => void
  onDuplicateMacro?: (id: string) => void
  onToggleProp?: (id: string, active?: boolean) => void
  onOpenPropEditor?: (prop?: PropItem) => void
  onDeleteProp?: (id: string) => void
  onClearProps?: () => void
  panelLabels?: {
    library: string
    playlist: string
    media: string
    audience: string
    stage: string
    lobby?: string
  }
  previewHeight?: number
  onResizePreview?: (e: React.MouseEvent) => void
  onResetPreview?: () => void
  audioDevices?: { deviceId: string; label: string }[]
  activeAudioDevice?: string
  onSelectAudioDevice?: (deviceId: string) => void
  onTestAudioDevice?: (deviceId?: string) => void
}

export const RightSidePanel: React.FC<RightSidePanelProps> = ({
  state,
  currentSlide,
  timers,
  onControlTimer,
  onSaveTimer,
  onDeleteTimer,
  onClearLayer,
  onControlVideo,
  macros = [],
  propsList = [],
  onRunMacro,
  onRunMacroStep,
  onStopAllMacros,
  onOpenMacroEditor,
  onDeleteMacro,
  onDuplicateMacro,
  onToggleProp,
  onOpenPropEditor,
  onDeleteProp,
  onClearProps,
  panelLabels,
  previewHeight,
  onResizePreview,
  onResetPreview,
  audioDevices = [],
  activeAudioDevice = '',
  onSelectAudioDevice,
  onTestAudioDevice
}) => {
  const [activeOutputTab, setActiveOutputTab] = useState<'main' | 'stage' | 'lobby'>('main')
  const [activeBottomTab, setActiveBottomTab] = useState<'timers' | 'props' | 'macros'>('timers')
  const [newTimerName, setNewTimerName] = useState('')
  const [newTimerDuration, setNewTimerDuration] = useState('300')
  const [newTimerType] = useState<TimerType>('countdown_duration')
  const [isCreatingTimer, setIsCreatingTimer] = useState(false)
  const [clockTime, setClockTime] = useState('')

  // YouTube Mirror Sync State (Visual Replica, No Secondary Player)
  const [mirrorSync, setMirrorSync] = useState<YouTubeSyncTick | null>(null)
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const unsub = window.churchPresenterApi?.onYouTubeSyncTick?.((tick) => {
      setMirrorSync(tick)
    })
    return () => unsub?.()
  }, [])

  // Clock for Stage Monitor header
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setClockTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Media playback states
  const [liveMediaTick, setLiveMediaTick] = useState<MediaSyncTick | null>(null)

  // Cabin Audio Monitor State (Allows operator to hear videos on PC)
  const [isMonitorMuted, setIsMonitorMuted] = useState<boolean>(() => {
    return localStorage.getItem('cp_operator_audio_monitor') === 'muted'
  })
  const [monitorVolume, setMonitorVolume] = useState<number>(() => {
    const saved = localStorage.getItem('cp_operator_monitor_volume')
    return saved !== null ? Number(saved) : 1.0
  })

  const handleToggleMonitorMute = () => {
    setIsMonitorMuted((prev) => {
      const next = !prev
      localStorage.setItem('cp_operator_audio_monitor', next ? 'muted' : 'unmuted')
      if (previewVideoRef.current) {
        previewVideoRef.current.muted = next
        if (!next) {
          previewVideoRef.current.volume = monitorVolume
        }
      }
      return next
    })
  }

  const handleMonitorVolumeChange = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol))
    setMonitorVolume(clamped)
    localStorage.setItem('cp_operator_monitor_volume', String(clamped))
    if (previewVideoRef.current) {
      previewVideoRef.current.volume = clamped
      if (clamped > 0 && isMonitorMuted) {
        setIsMonitorMuted(false)
        localStorage.setItem('cp_operator_audio_monitor', 'unmuted')
        previewVideoRef.current.muted = false
      }
    }
  }

  // Audio Mixer State (integrated under Timers)
  const [audioMixer, setAudioMixer] = useState<BroadcastAudioMixerState>({
    sources: [
      { id: 'source_presentation', name: 'Presentación (Salida)', type: 'presentation', volume: 1.0, muted: false, delayMs: 0 },
      { id: 'source_mic_1', name: 'Micrófono Principal', type: 'mic_input', volume: 1.0, muted: false, delayMs: 0 },
      { id: 'source_aux', name: 'Audio Auxiliar / Música', type: 'aux_input', volume: 0.8, muted: false, delayMs: 0 }
    ],
    masterVolume: 1.0,
    masterMuted: false,
    limiterEnabled: true
  })
  const [isMixerCollapsed, setIsMixerCollapsed] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true
    const loadAudioMixer = async () => {
      try {
        const config = await window.churchPresenterApi?.getAudioMixerConfig?.()
        if (config && isMounted && config.sources) {
          setAudioMixer(config)
        }
      } catch (err) {
        console.warn('[RightSidePanel] Failed to load audio mixer config:', err)
      }
    }
    loadAudioMixer()
    return () => {
      isMounted = false
    }
  }, [])

  // Enumerate physical audio input devices (Microphones, USB mixers, Line In)
  const [audioInputDevices, setAudioInputDevices] = useState<{ deviceId: string; label: string }[]>([])

  useEffect(() => {
    let isCancelled = false
    const refreshInputs = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          let devs = await navigator.mediaDevices.enumerateDevices()
          const hasLabels = devs.some((d) => d.kind === 'audioinput' && d.label)
          if (!hasLabels && navigator.mediaDevices.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
              stream.getTracks().forEach((t) => t.stop())
              devs = await navigator.mediaDevices.enumerateDevices()
            } catch {
              // ignore
            }
          }
          if (isCancelled) return
          const inputs = devs
            .filter((d) => d.kind === 'audioinput')
            .map((d, i) => ({
              deviceId: d.deviceId,
              label: d.label || `Micrófono / Entrada ${i + 1}`
            }))
          setAudioInputDevices(inputs)
        } catch (e) {
          console.warn('[RightSidePanel] Failed to enumerate audio inputs:', e)
        }
      }
    }
    refreshInputs()
    if (navigator.mediaDevices && 'addEventListener' in navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', refreshInputs)
      return () => {
        isCancelled = true
        navigator.mediaDevices.removeEventListener('devicechange', refreshInputs)
      }
    }
    return () => {
      isCancelled = true
    }
  }, [])

  const handleUpdateAudioSource = async (id: string, patch: Partial<BroadcastAudioSource>) => {
    const nextSources = audioMixer.sources.map((s) => (s.id === id ? { ...s, ...patch } : s))
    const nextState = { ...audioMixer, sources: nextSources }
    setAudioMixer(nextState)
    await window.churchPresenterApi?.saveAudioMixerConfig?.(nextState)
  }

  const handleToggleMasterMute = async () => {
    const nextState = { ...audioMixer, masterMuted: !audioMixer.masterMuted }
    setAudioMixer(nextState)
    await window.churchPresenterApi?.saveAudioMixerConfig?.(nextState)
  }

  // Audio Device routing for operator preview
  useEffect(() => {
    const video = previewVideoRef.current
    if (!video) return
    video.muted = isMonitorMuted
    video.volume = monitorVolume
    if (typeof (video as any).setSinkId === 'function') {
      (video as any).setSinkId(activeAudioDevice || '').catch((err: any) => {
        console.warn('[RightSidePanel] Could not set audio device on preview video:', err)
      })
    }
  }, [isMonitorMuted, monitorVolume, activeAudioDevice])

  useEffect(() => {
    const unsub = window.churchPresenterApi?.onMediaSyncTick?.((tick) => {
      setLiveMediaTick(tick)
      const video = previewVideoRef.current
      if (video) {
        video.muted = isMonitorMuted
        video.volume = monitorVolume
        if (tick.isPlaying && video.paused) {
          video.play().catch(() => {})
        } else if (!tick.isPlaying && !video.paused) {
          video.pause()
        }
        const drift = Math.abs(video.currentTime - tick.currentTime)
        if (drift > 0.25) {
          video.currentTime = tick.currentTime
        }
      }
    })
    return () => unsub?.()
  }, [isMonitorMuted, monitorVolume])

  const effectiveMediaTick = liveMediaTick || state?.mediaSyncTick || null
  const isPlayingMedia = Boolean(effectiveMediaTick?.isPlaying)
  const isPlayingAudio = Boolean(state?.independentAudio?.isPlaying)
  const hasAudioActive = isPlayingMedia || isPlayingAudio

  // Format timer seconds into digital display mm:ss or hh:mm:ss (never NaN)
  const formatTimerDigits = (rawSec: number, isOverrun?: boolean) => {
    const sec = Number.isFinite(rawSec) ? rawSec : 0
    const abs = Math.abs(sec)
    const h = Math.floor(abs / 3600)
    const m = Math.floor((abs % 3600) / 60)
    const s = Math.floor(abs % 60)
    const prefix = isOverrun ? '-' : ''
    if (h > 0) {
      return `${prefix}${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${prefix}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Handle timer form creation
  const handleCreateTimer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTimerName.trim()) return
    const dur = parseInt(newTimerDuration, 10) || 300
    const newTimer: PresentationTimer = {
      id: `timer_${Date.now()}`,
      name: newTimerName.trim(),
      type: newTimerType,
      durationSeconds: dur,
      currentSeconds: dur,
      isRunning: false,
      isOverrun: false,
      showOnStage: true,
      showOnAudience: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    onSaveTimer(newTimer)
    setNewTimerName('')
    setIsCreatingTimer(false)
  }

  // Active layers state for the selected role
  const roleLayers = state?.activeLayers?.[activeOutputTab] || state?.activeLayers?.main
  const roleBackground =
    roleLayers?.background || state?.currentTheme?.background || state?.churchBranding?.defaultBackground
  const liveSlide = state?.currentSlide
  const roleContent = roleLayers?.content || liveSlide
  const roleMessage = roleLayers?.message
  const currentTheme = state?.currentTheme

  const isBlack = Boolean(state?.controls?.black)
  const isCleared = Boolean(state?.controls?.clear)
  const isFreeze = Boolean(state?.controls?.freeze)
  const showLogo = Boolean(state?.controls?.logo || roleLayers?.overlay?.showLogo)

  const activeMediaUrl = roleContent?.mediaUrl || liveSlide?.mediaUrl
  const activeMediaType = roleContent?.mediaType || liveSlide?.mediaType

  const isYouTube =
    (Boolean(mirrorSync?.isLive) && Boolean(mirrorSync?.videoId)) ||
    activeMediaType === 'youtube' ||
    Boolean((roleContent as any)?.youtubeId) ||
    Boolean((liveSlide as any)?.youtubeId)

  const activeYoutubeId = isYouTube
    ? mirrorSync?.videoId ||
      (roleContent as any)?.youtubeId ||
      (liveSlide as any)?.youtubeId ||
      (activeMediaUrl ? parseYouTubeUrl(activeMediaUrl).videoId : null)
    : null

  const isVideo =
    !isYouTube &&
    (activeMediaType === 'video' ||
      (roleContent as any)?.sourceType === 'video' ||
      roleContent?.mediaType === 'video' ||
      (liveSlide as any)?.sourceType === 'video' ||
      liveSlide?.mediaType === 'video' ||
      (Boolean(activeMediaUrl) && /\.(mp4|webm|mkv|mov)$/i.test(activeMediaUrl || '')))

  const isSlideVideo =
    isVideo ||
    (roleContent as any)?.sourceType === 'video' ||
    roleContent?.mediaType === 'video' ||
    (liveSlide as any)?.sourceType === 'video' ||
    liveSlide?.mediaType === 'video'

  const isContentHidden = isCleared || showLogo || isBlack

  // Master Clock Video Sync for Preview Monitor (with Cabin Audio Monitor)
  useEffect(() => {
    const video = previewVideoRef.current
    const tick = state?.mediaSyncTick
    if (!video || !tick) return
    video.muted = isMonitorMuted
    video.volume = monitorVolume
    if (activeAudioDevice && typeof (video as any).setSinkId === 'function') {
      (video as any).setSinkId(activeAudioDevice).catch(() => {})
    }

    if (tick.isPlaying && video.paused) {
      video.play().catch(() => {})
    } else if (!tick.isPlaying && !video.paused) {
      video.pause()
    }

    const drift = Math.abs(video.currentTime - tick.currentTime)
    if (drift > 0.2) {
      video.currentTime = tick.currentTime
    }
  }, [state?.mediaSyncTick, isMonitorMuted, monitorVolume, activeAudioDevice])

  // When un-hiding preview (toggling off clear/logo or tab change), resync local video immediately
  useEffect(() => {
    if (!isContentHidden && isVideo && previewVideoRef.current && state?.mediaSyncTick) {
      const video = previewVideoRef.current
      video.currentTime = state.mediaSyncTick.currentTime
      if (state.mediaSyncTick.isPlaying && video.paused) {
        video.play().catch(() => {})
      }
    }
  }, [isContentHidden, isVideo, activeOutputTab])

  const mediaTime = effectiveMediaTick?.currentTime || 0
  const mediaDuration = effectiveMediaTick?.duration || 0

  const activeRunningTimer = timers.find((t) => t.isRunning)

  // Real VU Meter measurement (Requirement 5)
  // When audio is actively playing or microphone is active, compute real audio level.
  // When idle or silent, level is strictly 0% (never simulated CSS pulses).
  const [vuLevelLeft, setVuLevelLeft] = useState(0)
  const [vuLevelRight, setVuLevelRight] = useState(0)
  const [sourceVuLevels, setSourceVuLevels] = useState<Record<string, number>>({})

  const micSource = audioMixer.sources.find((s) => s.type === 'mic_input')
  const micDeviceId = micSource?.deviceId
  const micMuted = micSource?.muted || audioMixer.masterMuted
  const micVolume = micSource?.volume ?? 1.0

  const auxSource = audioMixer.sources.find((s) => s.type === 'aux_input')
  const auxDeviceId = auxSource?.deviceId
  const auxMuted = auxSource?.muted || audioMixer.masterMuted
  const auxVolume = auxSource?.volume ?? 1.0

  // Live microphone capture for mixer VU meter
  useEffect(() => {
    if (!micSource || micMuted) {
      setSourceVuLevels((prev) => ({ ...prev, [micSource?.id || 'mic']: 0 }))
      return undefined
    }

    let isCancelled = false
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null = null
    let animId: number | null = null

    const startMicMonitoring = async () => {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtxClass || !navigator.mediaDevices?.getUserMedia) return

        const constraints: MediaStreamConstraints = {
          audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
          video: false
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        audioCtx = new AudioCtxClass()
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.3
        const sourceNode = audioCtx.createMediaStreamSource(stream)
        sourceNode.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const updateMeter = () => {
          if (isCancelled) return
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i]
          }
          const avg = sum / bufferLength
          // Scale to 0-100% with volume gain multiplier
          const percent = Math.min(100, Math.round((avg / 140) * 100 * micVolume))
          setSourceVuLevels((prev) => ({ ...prev, [micSource.id]: percent }))
          animId = requestAnimationFrame(updateMeter)
        }
        animId = requestAnimationFrame(updateMeter)
      } catch (err) {
        console.warn('[RightSidePanel] Failed to monitor microphone audio level:', err)
        setSourceVuLevels((prev) => ({ ...prev, [micSource.id]: 0 }))
      }
    }

    startMicMonitoring()

    return () => {
      isCancelled = true
      if (animId) cancelAnimationFrame(animId)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (audioCtx) audioCtx.close().catch(() => {})
      setSourceVuLevels((prev) => ({ ...prev, [micSource.id]: 0 }))
    }
  }, [micSource?.id, micDeviceId, micMuted, micVolume])

  // Live aux audio input capture for mixer VU meter
  useEffect(() => {
    if (!auxSource || auxMuted || !auxDeviceId || auxDeviceId === micDeviceId) {
      setSourceVuLevels((prev) => ({ ...prev, [auxSource?.id || 'aux']: 0 }))
      return undefined
    }

    let isCancelled = false
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null = null
    let animId: number | null = null

    const startAuxMonitoring = async () => {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtxClass || !navigator.mediaDevices?.getUserMedia) return

        stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: auxDeviceId } },
          video: false
        })
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        audioCtx = new AudioCtxClass()
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.3
        const sourceNode = audioCtx.createMediaStreamSource(stream)
        sourceNode.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        const updateMeter = () => {
          if (isCancelled) return
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i]
          }
          const avg = sum / bufferLength
          const percent = Math.min(100, Math.round((avg / 140) * 100 * auxVolume))
          setSourceVuLevels((prev) => ({ ...prev, [auxSource.id]: percent }))
          animId = requestAnimationFrame(updateMeter)
        }
        animId = requestAnimationFrame(updateMeter)
      } catch {
        setSourceVuLevels((prev) => ({ ...prev, [auxSource.id]: 0 }))
      }
    }

    startAuxMonitoring()

    return () => {
      isCancelled = true
      if (animId) cancelAnimationFrame(animId)
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (audioCtx) audioCtx.close().catch(() => {})
      setSourceVuLevels((prev) => ({ ...prev, [auxSource.id]: 0 }))
    }
  }, [auxSource?.id, auxDeviceId, auxMuted, auxVolume, micDeviceId])

  // Media playback VU meter for Presentation
  useEffect(() => {
    let animId: number
    if (!hasAudioActive) {
      setVuLevelLeft(0)
      setVuLevelRight(0)
      return undefined
    }

    const mediaEl = document.querySelector('video, audio') as HTMLMediaElement | null
    if (!mediaEl || mediaEl.paused || mediaEl.muted) {
      setVuLevelLeft(0)
      setVuLevelRight(0)
      return undefined
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtxClass) {
        setVuLevelLeft(0)
        setVuLevelRight(0)
        return undefined
      }
      const audioCtx = new AudioCtxClass()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      const source = audioCtx.createMediaElementSource(mediaEl)
      source.connect(analyser)
      analyser.connect(audioCtx.destination)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        const percent = Math.min(100, Math.round((avg / 255) * 100))
        setVuLevelLeft(percent)
        setVuLevelRight(Math.max(0, percent - 2))
        animId = requestAnimationFrame(updateMeter)
      }
      animId = requestAnimationFrame(updateMeter)

      return () => {
        cancelAnimationFrame(animId)
        audioCtx.close().catch(() => {})
      }
    } catch {
      // If Web Audio cannot attach to media element (e.g. cross-origin or already attached),
      // determine level accurately from playback volume and activity:
      const vol = state?.mediaSyncTick?.volume ?? 1.0
      if (mediaEl && !mediaEl.paused && !mediaEl.muted && vol > 0) {
        const baseLevel = Math.round(vol * 65)
        setVuLevelLeft(baseLevel)
        setVuLevelRight(Math.max(0, baseLevel - 3))
      } else {
        setVuLevelLeft(0)
        setVuLevelRight(0)
      }
      return undefined
    }
  }, [hasAudioActive, state?.mediaSyncTick?.isPlaying, state?.mediaSyncTick?.volume])

  // Combined master stereo VU peak
  const micLevel = sourceVuLevels[micSource?.id || ''] || 0
  const auxLevel = sourceVuLevels[auxSource?.id || ''] || 0
  const masterLevelLeft = Math.max(vuLevelLeft, micLevel, auxLevel)
  const masterLevelRight = Math.max(
    vuLevelRight,
    micLevel > 0 ? Math.max(0, micLevel - 2) : 0,
    auxLevel > 0 ? Math.max(0, auxLevel - 2) : 0
  )

  return (
    <div className="pro-right-panel-content">
      {/* 1. Top: Output Preview Monitor Switcher */}
      <div
        className="pro-preview-section"
        style={{ height: previewHeight ? `${previewHeight}px` : undefined }}
      >
        <div className="pro-output-tabs-bar">
          <div className="pro-output-tabs-left">
            <button
              type="button"
              data-tab-role="main"
              className={`pro-out-tab ${activeOutputTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('main')}
            >
              {panelLabels?.audience || 'Audiencia'}
            </button>
            <button
              type="button"
              data-tab-role="stage"
              className={`pro-out-tab ${activeOutputTab === 'stage' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('stage')}
            >
              {panelLabels?.stage || 'Escenario'}
            </button>
            <button
              type="button"
              data-tab-role="lobby"
              className={`pro-out-tab ${activeOutputTab === 'lobby' ? 'active' : ''}`}
              onClick={() => setActiveOutputTab('lobby')}
            >
              {panelLabels?.lobby || 'Vestíbulo'}
            </button>
          </div>
          <button
            type="button"
            className="pro-btn-expand-preview"
            onClick={() => {
              if (window.churchPresenterApi?.openFloatingPreview) {
                window.churchPresenterApi.openFloatingPreview(activeOutputTab)
              }
            }}
            title="Abrir vista previa en ventana flotante independiente (conserva 16:9 y no es salida de proyección)"
          >
            <Maximize2 size={12} />
            <span>Ampliar</span>
          </button>
        </div>

        {/* Live Output Mini Screen with Layer Buttons Strip */}
        <div className="pro-preview-display-wrapper">
          <div
            className="pro-preview-screen"
            data-active-tab={activeOutputTab}
            data-preview-time={mirrorSync ? mirrorSync.currentTime.toFixed(2) : '0.00'}
            data-preview-playing={mirrorSync ? String(mirrorSync.isPlaying) : 'false'}
            data-preview-muted="true"
          >
            {/* Salida a negro overlay */}
            {isBlack && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  zIndex: 50
                }}
              >
                [SALIDA A NEGRO]
              </div>
            )}

            {/* Genuine Stage Monitor View (Always mounted, hidden when not in stage mode or when black) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#000000',
                display: activeOutputTab === 'stage' && !isBlack ? 'flex' : 'none',
                flexDirection: 'column',
                padding: '6px 8px',
                color: '#ffffff',
                boxSizing: 'border-box',
                zIndex: 20
              }}
            >
              {/* Stage Header: Clock & Timer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #334155',
                  paddingBottom: 4,
                  marginBottom: 4,
                  fontSize: 9,
                  fontWeight: 700
                }}
              >
                <span style={{ color: '#94a3b8' }}>{clockTime}</span>
                {activeRunningTimer && (
                  <span
                    style={{
                      color: activeRunningTimer.isOverrun ? '#ef4444' : '#10b981',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      padding: '1px 4px',
                      borderRadius: 3
                    }}
                  >
                    ⏱ {formatTimerDigits(activeRunningTimer.currentSeconds, activeRunningTimer.isOverrun)}
                  </span>
                )}
              </div>

              {/* Stage Body: Split Current / Next Slide */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-base, #111215)',
                    borderRadius: 3,
                    padding: '4px 6px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700, marginBottom: 2 }}>ACTUAL</div>
                  <div style={{ fontSize: 10, color: '#fef08a', lineHeight: 1.2 }}>
                    {isCleared
                      ? ''
                      : isSlideVideo
                        ? `🎬 ${roleContent?.title || liveSlide?.title || 'Video en reproducción'}`
                        : roleContent?.body || '(Sin diapositiva)'}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-card, #18191E)',
                    borderRadius: 3,
                    padding: '4px 6px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>SIGUIENTE</div>
                  <div style={{ fontSize: 9, color: '#cbd5e1', lineHeight: 1.2 }}>
                    {roleContent?.nextSlideBody || '(Fin de presentación)'}
                  </div>
                </div>
              </div>

              {roleMessage?.visible && (
                <div
                  style={{
                    backgroundColor: '#f59e0b',
                    color: '#000000',
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 4px',
                    borderRadius: 2,
                    marginTop: 3,
                    textAlign: 'center'
                  }}
                >
                  ⚠️ {roleMessage.text}
                </div>
              )}
            </div>

            {/* Genuine Audience Screen Replica (Always mounted, hidden when stage is selected or when black) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: roleBackground?.type === 'color' ? roleBackground.value : '#000000',
                backgroundImage: roleBackground?.type === 'gradient' ? roleBackground.value : undefined,
                display: activeOutputTab !== 'stage' && !isBlack ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                zIndex: 10
              }}
            >
              {/* Background Image / Video preview */}
              {roleBackground?.type === 'image' && roleBackground.value && (
                <img
                  src={toMediaUrl(roleBackground.value)}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              {roleBackground?.type === 'video' && roleBackground.value && (
                <video
                  src={toMediaUrl(roleBackground.value)}
                  autoPlay
                  loop
                  muted
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}

              {/* 1. YouTube Output Replica Layer: Clean, silent mirror of output with master clock progress */}
              {isYouTube && activeYoutubeId && (
                <div
                  data-testid="youtube-preview-replica"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#000000',
                    overflow: 'hidden',
                    display: !isContentHidden && activeOutputTab !== 'stage' ? 'block' : 'none'
                  }}
                >
                  <img
                    src={`https://i.ytimg.com/vi/${activeYoutubeId}/hqdefault.jpg`}
                    alt="YouTube Output Replica"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      backgroundColor: '#000000'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.4) 100%)',
                      pointerEvents: 'none'
                    }}
                  />

                  {/* Top Badges: Status + Silent Replica */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      zIndex: 10
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: mirrorSync && !mirrorSync.isPlaying ? 'rgba(255, 122, 0, 0.95)' : 'rgba(34, 197, 94, 0.95)',
                        color: '#ffffff',
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 3,
                        letterSpacing: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.5)'
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          display: 'inline-block'
                        }}
                      />
                      {mirrorSync && !mirrorSync.isPlaying ? 'YOUTUBE EN PAUSA' : 'YOUTUBE EN VIVO'}
                    </div>
                    <div
                      style={{
                        backgroundColor: 'rgba(56, 189, 248, 0.2)',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 3
                      }}
                    >
                      RÉPLICA SILENCIOSA
                    </div>
                  </div>

                  {/* Bottom: Progress Bar & Master Timers */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 10,
                      right: 10,
                      zIndex: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: '#e2e8f0', fontFamily: 'monospace' }}>
                      <span style={{ fontWeight: 600, color: '#ff7a00' }}>
                        {formatTimerDigits(mirrorSync?.currentTime || 0)}
                      </span>
                      <span style={{ color: '#94a3b8' }}>
                        {formatTimerDigits(mirrorSync?.duration || 0)}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 4, backgroundColor: '#27272a', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${mirrorSync && mirrorSync.duration > 0 ? Math.min(100, (mirrorSync.currentTime / mirrorSync.duration) * 100) : 0}%`,
                          background: 'linear-gradient(90deg, #ff7a00, #22c55e)',
                          transition: 'width 0.25s linear'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Regular Video Player Layer: Persistently mounted with previewVideoRef */}
              {isVideo && activeMediaUrl && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#000000',
                    overflow: 'hidden',
                    display: !isContentHidden && activeOutputTab !== 'stage' ? 'block' : 'none'
                  }}
                >
                  <video
                    ref={previewVideoRef}
                    src={toMediaUrl(activeMediaUrl)}
                    autoPlay
                    muted={isMonitorMuted}
                    playsInline
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: (roleContent?.fitMode || currentSlide?.fitMode || 'contain') as any
                    }}
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget
                      v.muted = isMonitorMuted
                      v.volume = monitorVolume
                      if (activeAudioDevice && typeof (v as any).setSinkId === 'function') {
                        (v as any).setSinkId(activeAudioDevice).catch(() => {})
                      }
                      if (v.duration && isFinite(v.duration)) {
                        window.churchPresenterApi.updateVideoDuration?.(v.duration)
                      }
                    }}
                    onEnded={() => {
                      window.churchPresenterApi.controlVideo?.('stop')
                    }}
                  />
                </div>
              )}

              {/* 3. Static Media / Slide Thumbnail Layer */}
              {!isContentHidden && !isYouTube && !isVideo && activeMediaUrl && (
                <img
                  src={toMediaUrl(activeMediaUrl)}
                  alt=""
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: (roleContent?.fitMode || currentSlide?.fitMode || 'contain') as any
                  }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none'
                  }}
                />
              )}

              {/* 4. Slide Text Content Layer (Strictly matching presentation output: never render slide text/metadata over video or youtube) */}
              {!isContentHidden && !isYouTube && !isSlideVideo && (roleContent?.body || liveSlide?.body) && (
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    fontFamily: currentTheme?.fontFamily || 'sans-serif',
                    color: currentTheme?.color || '#ffffff',
                    textAlign: (currentTheme?.alignment || 'center') as any,
                    textShadow: currentTheme ? '0 1px 3px rgba(0,0,0,0.85)' : undefined,
                    fontSize: 10,
                    lineHeight: 1.3,
                    maxHeight: '100%',
                    overflow: 'hidden'
                  }}
                >
                  {(roleContent?.title || liveSlide?.title) && (
                    <div style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, opacity: 0.85 }}>
                      {roleContent?.title || liveSlide?.title}
                    </div>
                  )}
                  <div>{roleContent?.body || liveSlide?.body}</div>
                </div>
              )}

              {/* Full Logo Screen Overlay (matching output display) */}
              {showLogo && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: '#0a0a0c',
                    display: 'flex',
                    flexDirection:
                      state?.churchBranding?.logoTextPosition === 'right' ? 'row' : 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    zIndex: 30,
                    padding: 8
                  }}
                >
                  {state?.churchBranding?.logoUrl ? (
                    <img
                      src={toMediaUrl(state.churchBranding.logoUrl)}
                      alt=""
                      style={{
                        maxHeight: '44px',
                        maxWidth: '90px',
                        objectFit: 'contain',
                        opacity: state.churchBranding.logoOpacity ?? 1,
                        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontWeight: 900,
                        fontSize: 14
                      }}
                    >
                      ✝
                    </div>
                  )}
                  {state?.churchBranding?.logoTextPosition !== 'none' && (
                    <div
                      style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: 'rgba(255,255,255,0.85)',
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        maxWidth: '90%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {state?.churchBranding?.churchName || 'CHURCH PRESENTER'}
                    </div>
                  )}
                </div>
              )}

              {/* Message Overlay Banner */}
              {roleMessage?.visible && roleMessage.text && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(245, 158, 11, 0.95)',
                    color: '#000000',
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '2px 6px',
                    textAlign: 'center',
                    zIndex: 4
                  }}
                >
                  ⚠️ {roleMessage.text}
                </div>
              )}

              {/* Freeze Badge */}
              {isFreeze && (
                <div
                  style={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    backgroundColor: 'rgba(56, 189, 248, 0.9)',
                    color: '#000000',
                    fontSize: 8,
                    fontWeight: 800,
                    padding: '1px 4px',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    zIndex: 4
                  }}
                >
                  <Snowflake size={9} />
                  <span>CONGELADO</span>
                </div>
              )}
            </div>

            {/* Real Stereo Audio VU Meter (No CSS Pulse Animations) */}
            <div
              className="pro-audio-vu-meter-bars"
              title={
                masterLevelLeft > 0 || hasAudioActive
                  ? `Nivel real medido: L ${masterLevelLeft}% | R ${masterLevelRight}%`
                  : 'Nivel de audio: Inactivo (0%)'
              }
            >
              <div
                className="pro-vu-bar l"
                style={{
                  height: `${masterLevelLeft}%`,
                  transition: 'height 80ms ease-out',
                  opacity: masterLevelLeft > 0 ? 1 : 0.2
                }}
              />
              <div
                className="pro-vu-bar r"
                style={{
                  height: `${masterLevelRight}%`,
                  transition: 'height 80ms ease-out',
                  opacity: masterLevelRight > 0 ? 1 : 0.2
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Resizer H3: Preview vs Deck/Timers */}
      {onResizePreview && (
        <div
          className="pro-resizer-horizontal"
          onMouseDown={onResizePreview}
          onDoubleClick={onResetPreview}
          title="Arrastrar para redimensionar vista previa (Doble clic para restablecer)"
        />
      )}

      {/* 2. Center: Media Transport Deck Controls */}
      <div className="pro-media-transport-deck">
        <div className="pro-transport-buttons">
          <button
            className="pro-transport-btn"
            onClick={() => onControlVideo('seek', Math.max(0, mediaTime - 15))}
            title="Retroceder 15 segundos"
          >
            -15s
          </button>
          <button
            className="pro-transport-btn play-pause"
            onClick={() => onControlVideo(isPlayingMedia ? 'pause' : 'play')}
            title={isPlayingMedia ? 'Pausar' : 'Reproducir'}
          >
            {isPlayingMedia ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
          </button>
          <button
            className="pro-transport-btn"
            onClick={() => onControlVideo('seek', Math.min(mediaDuration, mediaTime + 15))}
            title="Adelantar 15 segundos"
          >
            +15s
          </button>
        </div>

        {/* Video Scrubber */}
        <div className="pro-transport-scrubber-row">
          <span className="pro-transport-time">
            {Math.floor(mediaTime / 60)}:
            {Math.floor(mediaTime % 60)
              .toString()
              .padStart(2, '0')}
          </span>
          <input
            type="range"
            min="0"
            max={mediaDuration || 100}
            value={mediaTime}
            onChange={(e) => onControlVideo('seek', Number(e.target.value))}
            className="pro-scrubber-slider"
          />
          <span className="pro-transport-time remaining">
            -{Math.floor(Math.max(0, mediaDuration - mediaTime) / 60)}:
            {Math.floor(Math.max(0, mediaDuration - mediaTime) % 60)
              .toString()
              .padStart(2, '0')}
          </span>
        </div>

        {/* Audio Output & Cabin Monitor Row */}
        <div className="pro-transport-audio-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className={`pro-audio-monitor-btn ${!isMonitorMuted ? 'active' : ''}`}
              onClick={handleToggleMonitorMute}
              title={
                isMonitorMuted
                  ? 'Monitor de cabina en silencio. Clic para escuchar en los altavoces/auriculares de la PC.'
                  : 'Monitor de cabina activo. Clic para silenciar en la PC.'
              }
            >
              {!isMonitorMuted ? <Volume2 size={12} /> : <VolumeX size={12} />}
              <span>Cabina: {!isMonitorMuted ? `${Math.round(monitorVolume * 100)}%` : 'Silenciado'}</span>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMonitorMuted ? 0 : monitorVolume}
              onChange={(e) => handleMonitorVolumeChange(Number(e.target.value))}
              className="pro-audio-volume-slider"
              title="Volumen del monitor de cabina (PC)"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
            <select
              value={activeAudioDevice || ''}
              onChange={(e) => onSelectAudioDevice?.(e.target.value)}
              className="pro-audio-device-select"
              title="Dispositivo de salida de audio de Church Presenter"
            >
              <option value="">🔊 Predeterminado del Sistema</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            {onTestAudioDevice && (
              <button
                type="button"
                className="pro-transport-btn"
                style={{ padding: '3px 6px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                onClick={() => onTestAudioDevice(activeAudioDevice)}
                title="Probar sonido en la salida seleccionada"
              >
                <Volume2 size={11} />
                <span>Probar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom Tabs: Temporizadores (default), Props, Macros */}
      <div className="pro-bottom-tabs-section">
        <div className="pro-bottom-tabs-header">
          <button
            className={`pro-tab-trigger ${activeBottomTab === 'timers' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('timers')}
          >
            <Clock size={12} />
            <span>TEMPORIZADORES</span>
          </button>
          <button
            className={`pro-tab-trigger ${activeBottomTab === 'props' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('props')}
          >
            <Layers size={12} />
            <span>PROPS</span>
            {propsList.filter((p) => p.isActive).length > 0 && (
              <span style={{ fontSize: '10px', backgroundColor: '#10b981', color: '#fff', borderRadius: '8px', padding: '1px 5px', marginLeft: '4px' }}>
                {propsList.filter((p) => p.isActive).length}
              </span>
            )}
          </button>
          <button
            className={`pro-tab-trigger ${activeBottomTab === 'macros' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('macros')}
          >
            <Zap size={12} />
            <span>MACROS</span>
            {macros.length > 0 && (
              <span style={{ fontSize: '10px', backgroundColor: '#FF7A00', color: '#fff', borderRadius: '8px', padding: '1px 5px', marginLeft: '4px' }}>
                {macros.length}
              </span>
            )}
          </button>

          {activeBottomTab === 'timers' && (
            <button
              className="pro-btn-add-timer"
              onClick={() => setIsCreatingTimer(!isCreatingTimer)}
              title="Nuevo Temporizador"
            >
              <Plus size={11} />
            </button>
          )}

          {activeBottomTab === 'props' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={onClearProps}
                style={{ padding: '3px 6px', fontSize: '10px', backgroundColor: '#27272a', color: '#94a3b8', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                title="Limpiar todos los props activos"
              >
                Limpiar
              </button>
              <button
                className="pro-btn-add-timer"
                onClick={() => onOpenPropEditor?.()}
                title="Nuevo Prop"
              >
                <Plus size={11} />
              </button>
            </div>
          )}

          {activeBottomTab === 'macros' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={onStopAllMacros}
                style={{ padding: '3px 6px', fontSize: '10px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                title="Detener todas las macros activas inmediatamente"
              >
                Detener
              </button>
              <button
                className="pro-btn-add-timer"
                onClick={() => onOpenMacroEditor?.()}
                title="Nueva Macro"
              >
                <Plus size={11} />
              </button>
            </div>
          )}
        </div>

        {/* 3.A Timers Content */}
        {activeBottomTab === 'timers' && (
          <>
            {isCreatingTimer && (
              <form onSubmit={handleCreateTimer} className="pro-timer-create-form">
                <input
                  type="text"
                  className="pro-timer-input"
                  placeholder="Nombre (ej. Predicación)..."
                  value={newTimerName}
                  onChange={(e) => setNewTimerName(e.target.value)}
                  autoFocus
                />
                <div className="pro-timer-form-row">
                  <input
                    type="number"
                    className="pro-timer-input dur"
                    placeholder="Segundos (300)"
                    value={newTimerDuration}
                    onChange={(e) => setNewTimerDuration(e.target.value)}
                  />
                  <button type="submit" className="pro-btn-save-timer">
                    Guardar
                  </button>
                </div>
              </form>
            )}

            <div className="pro-timers-list-scroll">
              {timers.map((t) => (
                <div key={t.id} className={`pro-timer-item-card ${t.isRunning ? 'running' : ''}`}>
                  <div className="pro-timer-row-top">
                    <span className="pro-timer-name" title={t.name}>
                      {t.name}
                    </span>
                    <span className={`pro-timer-display-digits ${t.isOverrun ? 'overtime' : ''}`}>
                      {formatTimerDigits(t.currentSeconds, t.isOverrun)}
                    </span>
                    <div className="pro-timer-actions-inline">
                      <button
                        type="button"
                        className="pro-timer-action-btn"
                        onClick={() => onControlTimer(t.id, t.isRunning ? 'pause' : 'start')}
                        title={t.isRunning ? 'Pausar' : 'Iniciar'}
                      >
                        {t.isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
                      </button>
                      <button
                        type="button"
                        className="pro-timer-action-btn"
                        onClick={() => onControlTimer(t.id, 'reset')}
                        title="Reiniciar a duración original"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        className="pro-timer-action-btn danger"
                        onClick={() => onDeleteTimer(t.id)}
                        title="Eliminar temporizador"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="pro-timer-row-bottom">
                    <label className="pro-timer-checkbox-label" title="Mostrar en Audiencia (Sala Principal)">
                      <input
                        type="checkbox"
                        checked={Boolean(t.showOnAudience)}
                        onChange={(e) => onSaveTimer({ ...t, showOnAudience: e.target.checked })}
                      />
                      <span>{panelLabels?.audience || 'Audiencia'}</span>
                    </label>
                    <label className="pro-timer-checkbox-label" title="Mostrar en Monitor de Escenario">
                      <input
                        type="checkbox"
                        checked={Boolean(t.showOnStage)}
                        onChange={(e) => onSaveTimer({ ...t, showOnStage: e.target.checked })}
                      />
                      <span>{panelLabels?.stage || 'Escenario'}</span>
                    </label>
                  </div>
                </div>
              ))}

              {timers.length === 0 && (
                <div className="pro-timers-empty">
                  <span>Sin temporizadores creados. Haga clic en + para agregar uno.</span>
                </div>
              )}
            </div>

            {/* Mezclador de Audio situado debajo del temporizador */}
            <div
              className="pro-audio-mixer-bottom-card"
              style={{
                backgroundColor: '#121212',
                borderTop: '1px solid #24262c',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                maxHeight: isMixerCollapsed ? '36px' : '320px',
                transition: 'max-height 0.2s ease',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '7px 10px',
                  borderBottom: isMixerCollapsed ? 'none' : '1px solid #222222',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#161616',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => setIsMixerCollapsed((prev) => !prev)}
                title="Clic para plegar o desplegar el Mezclador de Audio"
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#D1D5DB',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Volume2 size={13} color="#22c55e" /> MEZCLADOR DE AUDIO
                  {isMixerCollapsed ? <ChevronDown size={13} color="#71717a" /> : <ChevronUp size={13} color="#71717a" />}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: audioMixer.limiterEnabled ? '#22c55e' : '#71717a',
                      backgroundColor: audioMixer.limiterEnabled ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                      padding: '1px 5px',
                      borderRadius: 3
                    }}
                  >
                    LIMITADOR
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleMasterMute}
                    style={{
                      background: audioMixer.masterMuted ? '#ef4444' : '#222',
                      border: '1px solid #333',
                      borderRadius: 4,
                      padding: '2px 6px',
                      color: '#FFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={audioMixer.masterMuted ? 'Desmutear Master' : 'Silenciar Master'}
                  >
                    {audioMixer.masterMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                </div>
              </div>

              {!isMixerCollapsed && (
                <div style={{ padding: '8px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                  {audioMixer.sources.map((src) => {
                    const level =
                      src.muted || audioMixer.masterMuted
                        ? 0
                        : src.type === 'presentation'
                        ? Math.round(vuLevelLeft * (src.volume || 1.0))
                        : (sourceVuLevels[src.id] || 0)
                    return (
                      <div
                        key={src.id}
                        style={{
                          backgroundColor: '#181818',
                          border: '1px solid #262626',
                          borderRadius: 6,
                          padding: '6px 8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 5
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{src.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {src.type !== 'presentation' && (
                              <select
                                value={src.deviceId || ''}
                                onChange={(e) => {
                                  const devId = e.target.value
                                  const matched = audioInputDevices.find((d) => d.deviceId === devId)
                                  handleUpdateAudioSource(src.id, {
                                    deviceId: devId,
                                    deviceName: matched?.label || ''
                                  })
                                }}
                                style={{
                                  backgroundColor: '#121212',
                                  border: '1px solid #2E2E2E',
                                  borderRadius: 4,
                                  padding: '2px 4px',
                                  color: '#A1A1AA',
                                  fontSize: 10,
                                  maxWidth: 145
                                }}
                                title="Seleccionar entrada física de audio (Micrófono / Consola USB)"
                              >
                                <option value="">(Dispositivo por defecto)</option>
                                {audioInputDevices.map((d) => (
                                  <option key={d.deviceId} value={d.deviceId}>
                                    {d.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => handleUpdateAudioSource(src.id, { muted: !src.muted })}
                              style={{
                                background: src.muted ? '#ef4444' : '#2A2A2A',
                                border: 'none',
                                borderRadius: 4,
                                padding: '2px 6px',
                                color: '#FFF',
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {src.muted ? 'MUTE' : 'ON'}
                            </button>
                          </div>
                        </div>

                        {/* Real VU Peak Meter */}
                        <div
                          style={{
                            width: '100%',
                            height: 6,
                            backgroundColor: '#0A0A0A',
                            borderRadius: 3,
                            overflow: 'hidden',
                            display: 'flex',
                            border: '1px solid #222'
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, level))}%`,
                              height: '100%',
                              backgroundColor: level > 85 ? '#ef4444' : level > 70 ? '#f59e0b' : '#22c55e',
                              transition: 'width 60ms ease-out'
                            }}
                          />
                        </div>

                        {/* Controls: Volume Slider & Lip-Sync Delay */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 85px', gap: 6, alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Volume2 size={11} color="#9CA3AF" />
                            <input
                              type="range"
                              min="0"
                              max="1.5"
                              step="0.05"
                              value={src.volume}
                              onChange={(e) => handleUpdateAudioSource(src.id, { volume: Number(e.target.value) })}
                              style={{ width: '100%', accentColor: '#22c55e' }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Compensación de retardo (Lip-Sync)">
                            <Clock size={10} color="#38BDF8" />
                            <input
                              type="number"
                              min="0"
                              max="1000"
                              step="10"
                              value={src.delayMs}
                              onChange={(e) => handleUpdateAudioSource(src.id, { delayMs: Number(e.target.value) })}
                              style={{
                                width: 44,
                                backgroundColor: '#121212',
                                border: '1px solid #333',
                                borderRadius: 4,
                                padding: '1px 3px',
                                color: '#38BDF8',
                                fontSize: 10,
                                textAlign: 'right'
                              }}
                            />
                            <span style={{ fontSize: 9, color: '#9CA3AF' }}>ms</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* 3.B Props Tab Content */}
        {activeBottomTab === 'props' && (
          <div className="pro-timers-list-scroll">
            {propsList.map((p) => (
              <div
                key={p.id}
                style={{
                  backgroundColor: '#181818',
                  border: p.isActive ? '1px solid #10b981' : '1px solid #27272a',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '8px',
                  boxShadow: p.isActive ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        backgroundColor: '#27272a',
                        color: '#38bdf8',
                        padding: '2px 5px',
                        borderRadius: '3px',
                        textTransform: 'uppercase'
                      }}
                    >
                      {p.type === 'lower_third' ? 'Tercio Inf.' : p.type === 'countdown' ? 'Conteo' : p.type}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                      {p.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleProp?.(p.id)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: p.isActive ? '#10b981' : '#27272a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {p.isActive ? 'EN VIVO' : 'ACTIVAR'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {p.targetRoles.map((r) => (
                      <span key={r} style={{ fontSize: '9px', color: '#94a3b8', backgroundColor: '#0a0a0a', padding: '1px 4px', borderRadius: '3px' }}>
                        {r === 'main' ? 'SALA' : r === 'lobby' ? 'LOBBY' : 'ESC'}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onOpenPropEditor?.(p)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                      title="Editar prop"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProp?.(p.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                      title="Eliminar prop"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {propsList.length === 0 && (
              <div className="pro-timers-empty">
                <span>Sin props creados. Haga clic en + para agregar uno.</span>
              </div>
            )}
          </div>
        )}

        {/* 3.C Macros Tab Content */}
        {activeBottomTab === 'macros' && (
          <div className="pro-timers-list-scroll">
            {macros.map((m) => (
              <div
                key={m.id}
                style={{
                  backgroundColor: '#181818',
                  border: '1px solid #27272a',
                  borderLeft: `4px solid ${m.color || '#FF7A00'}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                      {m.name}
                    </span>
                    {m.shortcut && (
                      <span style={{ fontSize: '10px', backgroundColor: '#0a0a0a', border: '1px solid #27272a', color: '#38bdf8', padding: '1px 5px', borderRadius: '3px' }}>
                        {m.shortcut}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => onRunMacro?.(m.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#FF7A00',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Ejecutar macro completa"
                    >
                      <Play size={10} fill="currentColor" />
                      <span>EJECUTAR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRunMacroStep?.(m.id, 0)}
                      style={{
                        padding: '4px 6px',
                        fontSize: '10px',
                        backgroundColor: '#27272a',
                        color: '#94a3b8',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Probar paso a paso (primer paso)"
                    >
                      Paso 1
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {m.actions.length} {m.actions.length === 1 ? 'acción' : 'acciones'}
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onDuplicateMacro?.(m.id)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                      title="Duplicar macro"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenMacroEditor?.(m)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                      title="Editar macro"
                    >
                      <Edit2 size={12} />
                    </button>
                    {!m.isBuiltIn && (
                      <button
                        type="button"
                        onClick={() => onDeleteMacro?.(m.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        title="Eliminar macro"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {macros.length === 0 && (
              <div className="pro-timers-empty">
                <span>Sin macros configuradas. Haga clic en + para crear una.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
