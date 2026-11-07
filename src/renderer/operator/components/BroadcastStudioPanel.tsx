import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Radio,
  Volume2,
  VolumeX,
  Layers,
  Settings,
  Square,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  Clock,
  HardDrive,
  ShieldCheck,
  ArrowRight,
  Smartphone,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Tag,
  QrCode,
  Sliders,
  Check,
  Play,
  Upload,
  Palette,
  Edit3,
  X,
  RotateCcw,
  Film,
  Search
} from 'lucide-react'
import QRCode from 'qrcode'
import {
  BroadcastScene,
  BroadcastLayer,
  BroadcastAudioMixerState,
  BroadcastAudioSource,
  BroadcastStatus,
  DesktopCaptureSource,
  PhoneCameraDevice,
  ChurchBrandingConfig
} from '../../../shared/types'
import { cameraReceiverService } from '../services/camera-receiver-service'
import { EpsBannerImporter } from '../services/eps-banner-importer'

interface BroadcastStudioPanelProps {
  onOpenSettings: () => void
  onOpenObsBridge?: () => void
}

export type StudioTab = 'layers' | 'phone_cameras' | 'transitions' | 'overlays'

export type TransitionType =
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'wipe-left'
  | 'wipe-right'
  | 'blinds'
  | 'split'
  | 'zoom'
  | 'flip'
  | 'dip-black'

export interface TransitionPreset {
  id: TransitionType
  name: string
  category: 'Corte y Fundido' | 'Deslizamientos' | 'Barridos y Persianas' | '3D y Zoom'
  desc: string
  icon: string
}

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: 'fade', name: 'Disolución (Fundido)', category: 'Corte y Fundido', desc: 'Transición clásica suave de opacidad cruzada', icon: '✨' },
  { id: 'slide-left', name: 'Deslizar a la Izquierda', category: 'Deslizamientos', desc: 'La nueva escena entra empujando desde la derecha', icon: '⬅️' },
  { id: 'slide-right', name: 'Deslizar a la Derecha', category: 'Deslizamientos', desc: 'La nueva escena entra empujando desde la izquierda', icon: '➡️' },
  { id: 'slide-up', name: 'Deslizar hacia Arriba', category: 'Deslizamientos', desc: 'La nueva escena sube desde el borde inferior', icon: '⬆️' },
  { id: 'slide-down', name: 'Deslizar hacia Abajo', category: 'Deslizamientos', desc: 'La nueva escena desciende desde el borde superior', icon: '⬇️' },
  { id: 'wipe-left', name: 'Cortinilla / Barrido', category: 'Barridos y Persianas', desc: 'Barrido horizontal limpio de derecha a izquierda', icon: '🪟' },
  { id: 'wipe-right', name: 'Cortinilla Inversa', category: 'Barridos y Persianas', desc: 'Barrido horizontal limpio de izquierda a derecha', icon: '📑' },
  { id: 'blinds', name: 'Ciego (Persiana)', category: 'Barridos y Persianas', desc: 'Efecto de persianas venecianas horizontales', icon: '▦' },
  { id: 'split', name: 'Col Dividir', category: 'Barridos y Persianas', desc: 'Separación central simétrica hacia los laterales', icon: '↔️' },
  { id: 'zoom', name: 'Zoom 3D / Escala', category: '3D y Zoom', desc: 'Efecto cinematográfico de acercamiento y foco', icon: '🔍' },
  { id: 'flip', name: 'Voltear Caja 3D', category: '3D y Zoom', desc: 'Rotación tridimensional isométrica en cubo', icon: '📦' },
  { id: 'dip-black', name: 'Fundido a Negro', category: 'Corte y Fundido', desc: 'Baja a negro total y sube suavemente con la nueva escena', icon: '🌑' }
]

const TransitionDiagramThumbnail: React.FC<{
  type: TransitionType
  isSelected: boolean
}> = ({ type, isSelected }) => {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16/9',
        backgroundColor: '#0A0E17',
        borderRadius: 4,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: isSelected ? '1px solid #FF7A00' : '1px solid #1E293B',
        boxShadow: isSelected ? '0 0 10px rgba(255, 122, 0, 0.35)' : 'none'
      }}
    >
      {type === 'fade' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="15" y="10" width="40" height="36" fill="#1E293B" stroke="#475569" strokeWidth="1" rx="2" />
          <rect x="35" y="10" width="40" height="36" fill="rgba(56, 189, 248, 0.4)" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" rx="2" />
          <circle cx="50" cy="28" r="4" fill="#38BDF8" />
        </svg>
      )}
      {type === 'slide-left' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="10" y="8" width="14" height="40" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <line x1="85" y1="20" x2="35" y2="20" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="32,20 40,16 40,24" fill="#38BDF8" />
          <line x1="85" y1="28" x2="35" y2="28" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="32,28 40,24 40,32" fill="#38BDF8" />
          <line x1="85" y1="36" x2="35" y2="36" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="32,36 40,32 40,40" fill="#38BDF8" />
        </svg>
      )}
      {type === 'slide-right' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="76" y="8" width="14" height="40" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <line x1="15" y1="20" x2="65" y2="20" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="68,20 60,16 60,24" fill="#38BDF8" />
          <line x1="15" y1="28" x2="65" y2="28" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="68,28 60,24 60,32" fill="#38BDF8" />
          <line x1="15" y1="36" x2="65" y2="36" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="68,36 60,32 60,40" fill="#38BDF8" />
        </svg>
      )}
      {type === 'slide-up' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="15" y="8" width="70" height="10" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <line x1="30" y1="46" x2="30" y2="25" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="30,22 26,30 34,30" fill="#38BDF8" />
          <line x1="50" y1="46" x2="50" y2="25" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="50,22 46,30 54,30" fill="#38BDF8" />
          <line x1="70" y1="46" x2="70" y2="25" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="70,22 66,30 74,30" fill="#38BDF8" />
        </svg>
      )}
      {type === 'slide-down' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="15" y="38" width="70" height="10" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <line x1="30" y1="10" x2="30" y2="31" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="30,34 26,26 34,26" fill="#38BDF8" />
          <line x1="50" y1="10" x2="50" y2="31" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="50,34 46,26 54,26" fill="#38BDF8" />
          <line x1="70" y1="10" x2="70" y2="31" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="70,34 66,26 74,26" fill="#38BDF8" />
        </svg>
      )}
      {type === 'wipe-left' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="10" y="8" width="40" height="40" fill="#1E293B" />
          <line x1="50" y1="8" x2="50" y2="48" stroke="#38BDF8" strokeWidth="2" />
          <line x1="80" y1="28" x2="56" y2="28" stroke="#FFFFFF" strokeWidth="1.5" />
          <polygon points="53,28 60,24 60,32" fill="#FFFFFF" />
        </svg>
      )}
      {type === 'wipe-right' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="50" y="8" width="40" height="40" fill="#1E293B" />
          <line x1="50" y1="8" x2="50" y2="48" stroke="#38BDF8" strokeWidth="2" />
          <line x1="20" y1="28" x2="44" y2="28" stroke="#FFFFFF" strokeWidth="1.5" />
          <polygon points="47,28 40,24 40,32" fill="#FFFFFF" />
        </svg>
      )}
      {type === 'blinds' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          {[10, 18, 26, 34, 42].map((y) => (
            <rect key={y} x="15" y={y} width="70" height="5" fill="#1E293B" stroke="#38BDF8" strokeWidth="0.75" />
          ))}
          <line x1="50" y1="12" x2="50" y2="44" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 2" />
          <polygon points="50,47 46,40 54,40" fill="#FFFFFF" />
        </svg>
      )}
      {type === 'split' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="15" y="8" width="30" height="40" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <rect x="55" y="8" width="30" height="40" fill="#1E293B" stroke="#475569" strokeWidth="1" />
          <line x1="42" y1="28" x2="25" y2="28" stroke="#38BDF8" strokeWidth="1.5" />
          <polygon points="22,28 29,24 29,32" fill="#38BDF8" />
          <line x1="58" y1="28" x2="75" y2="28" stroke="#38BDF8" strokeWidth="1.5" />
          <polygon points="78,28 71,24 71,32" fill="#38BDF8" />
        </svg>
      )}
      {type === 'zoom' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="35" y="16" width="30" height="24" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="35" y1="16" x2="20" y2="8" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="65" y1="16" x2="80" y2="8" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="35" y1="40" x2="20" y2="48" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="65" y1="40" x2="80" y2="48" stroke="#38BDF8" strokeWidth="1.5" />
        </svg>
      )}
      {type === 'flip' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <polygon points="35,14 65,14 55,42 25,42" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
          <path d="M 70,22 Q 82,28 70,36" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <polygon points="68,36 74,33 74,40" fill="#FFFFFF" />
        </svg>
      )}
      {type === 'dip-black' && (
        <svg viewBox="0 0 100 56" width="100%" height="100%">
          <rect x="15" y="8" width="70" height="40" fill="#000000" stroke="#334155" strokeWidth="1" rx="4" />
          <circle cx="50" cy="28" r="10" fill="#000000" stroke="#A855F7" strokeWidth="2" />
          <circle cx="50" cy="28" r="4" fill="#A855F7" />
        </svg>
      )}
    </div>
  )
}

export type LowerThirdTemplateId = string

export type LowerThirdBadgeType = 'qr_code' | 'church_logo' | 'text_badge' | 'none'

export interface CustomBannerItem {
  id: string
  name: string
  type: 'eps' | 'svg' | 'raster'
  graphicUrl: string
  createdAt: number
}

export interface LowerThirdTemplatePreset {
  id: string
  name: string
  subtitle: string
  thumbnailDescription: string
  defaultPrimary: string
  defaultSecondary: string
  hasBadgeSlot: boolean
  badgeShape: 'square' | 'circle' | 'pill'
  isCustom?: boolean
  customGraphicUrl?: string
}

export const LOWER_THIRD_TEMPLATES: LowerThirdTemplatePreset[] = [
  {
    id: 'qr_square',
    name: 'Recuadro QR / Full HD',
    subtitle: 'Estilo Noticias Streaming con recuadro grande para QR o Logo',
    thumbnailDescription: 'Recuadro destacado a la izquierda para Código QR o Full HD con barra doble',
    defaultPrimary: '#0F172A',
    defaultSecondary: '#0284C7',
    hasBadgeSlot: true,
    badgeShape: 'square'
  },
  {
    id: 'tv_news',
    name: 'Noticiero TV Metálico',
    subtitle: 'Estilo Breaking News con barra plateada y zócalo rojo',
    thumbnailDescription: 'Barra superior metálica cepillada, franja inferior roja e insignia angular',
    defaultPrimary: '#1E3A8A',
    defaultSecondary: '#DC2626',
    hasBadgeSlot: true,
    badgeShape: 'square'
  },
  {
    id: 'modern_pill',
    name: 'Cápsula Redondeada (HD / QR)',
    subtitle: 'Estilo streamer moderno con insignia circular izquierda',
    thumbnailDescription: 'Insignia redonda para QR o HD con barra redondeada y subcápsula flotante',
    defaultPrimary: '#1E40AF',
    defaultSecondary: '#EC4899',
    hasBadgeSlot: true,
    badgeShape: 'circle'
  },
  {
    id: 'slanted_dynamic',
    name: 'Dinámico Inclinado',
    subtitle: 'Estilo moderno con líneas diagonales deportivas / streaming',
    thumbnailDescription: 'Polígono inclinado con acentos diagonales y borde superior resaltado',
    defaultPrimary: '#1E3A8A',
    defaultSecondary: '#F43F5E',
    hasBadgeSlot: true,
    badgeShape: 'pill'
  },
  {
    id: 'gold_altar',
    name: 'Altar Solemne Dorado',
    subtitle: 'Estilo litúrgico formal en ónix y oro cepillado',
    thumbnailDescription: 'Elegante barra negra ónix con bordes dorados metálicos para predicación',
    defaultPrimary: '#0B0C0E',
    defaultSecondary: '#D97706',
    hasBadgeSlot: true,
    badgeShape: 'square'
  },
  {
    id: 'custom_imported',
    name: 'Importado (.EPS / .SVG)',
    subtitle: 'Gráfico vectorial personalizado descargado de Freepik o banco',
    thumbnailDescription: 'Usa tu propio archivo EPS o SVG como fondo del banner con texto y QR',
    defaultPrimary: '#181818',
    defaultSecondary: '#FF7A00',
    hasBadgeSlot: true,
    badgeShape: 'square'
  }
]

export interface BroadcastOverlaysConfig {
  lowerThird: {
    enabled: boolean
    template: LowerThirdTemplateId
    speakerName: string
    speakerTitle: string
    topicTitle: string
    badgeType: LowerThirdBadgeType
    badgeText: string
    badgeQrUrl: string
    badgeQrDataUrl: string
    primaryColor: string
    secondaryColor: string
    textColor: string
    customGraphicUrl?: string
    customGraphicName?: string
    style: 'orange_accent' | 'blue_accent' | 'gold_accent' | 'modern_dark'
  }
  ticker: {
    enabled: boolean
    text: string
    speed: 'slow' | 'normal' | 'fast'
  }
  qrCode: {
    enabled: boolean
    title: string
    url: string
    qrDataUrl: string
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  }
  liveBug: {
    enabled: boolean
    text: string
  }
}

const DEFAULT_OVERLAYS: BroadcastOverlaysConfig = {
  lowerThird: {
    enabled: false,
    template: 'qr_square',
    speakerName: 'Pr. Juan Carlos Pérez',
    speakerTitle: 'Pastor Principal',
    topicTitle: 'Serie: El Poder de la Fe • Hebreos 11:1',
    badgeType: 'qr_code',
    badgeText: 'HD',
    badgeQrUrl: 'https://paypal.me/iglesia',
    badgeQrDataUrl: '',
    primaryColor: '#0F172A',
    secondaryColor: '#0284C7',
    textColor: '#FFFFFF',
    style: 'orange_accent'
  },
  ticker: {
    enabled: false,
    text: 'Bienvenidos a nuestra transmisión en vivo • Culto de Oración y Alabanza • Miércoles 7:30 PM • Si necesitas oración comunícate con nosotros',
    speed: 'normal'
  },
  qrCode: {
    enabled: false,
    title: 'Diezmos y Ofrendas',
    url: 'https://paypal.me/iglesia',
    qrDataUrl: '',
    position: 'bottom-left'
  },
  liveBug: {
    enabled: true,
    text: 'EN VIVO'
  }
}

export const BroadcastStudioPanel: React.FC<BroadcastStudioPanelProps> = ({
  onOpenSettings,
  onOpenObsBridge
}) => {
  // Scenes & Layers
  const [scenes, setScenes] = useState<BroadcastScene[]>([])
  const [previewSceneId, setPreviewSceneId] = useState<string>('')
  const [programSceneId, setProgramSceneId] = useState<string>('')
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0)
  const [transitionDuration, setTransitionDuration] = useState<number>(500)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [transitionSearch, setTransitionSearch] = useState<string>('')
  const [transitionCategory, setTransitionCategory] = useState<string>('all')

  // Hardware Devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [desktopSources, setDesktopSources] = useState<DesktopCaptureSource[]>([])

  // Audio Mixer State
  const [audioMixer, setAudioMixer] = useState<BroadcastAudioMixerState>({
    sources: [
      { id: 'pres_audio', name: 'Audio Presentación / Medios', type: 'presentation', volume: 1.0, muted: false, delayMs: 0 },
      { id: 'mic_main', name: 'Micrófono Principal', type: 'mic_input', volume: 0.9, muted: false, delayMs: 150 },
      { id: 'aux_line', name: 'Entrada Auxiliar / Línea', type: 'aux_input', volume: 0.8, muted: false, delayMs: 0 }
    ],
    masterVolume: 1.0,
    masterMuted: false,
    limiterEnabled: true
  })

  // Live Status & Telemetry
  const [status, setStatus] = useState<BroadcastStatus>({
    isStreaming: false,
    isRecording: false,
    durationSeconds: 0,
    formattedTime: '00:00:00',
    bitrateKbps: 0,
    fps: 30,
    droppedFrames: 0,
    totalFrames: 0,
    connectionState: 'disconnected',
    activePreset: '1080p30',
    encoderUsed: 'nvenc'
  })

  // Confirmation Modals
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    action: 'start_stream' | 'stop_stream' | 'start_record' | 'stop_record' | null
    title: string
    message: string
  }>({ open: false, action: null, title: '', message: '' })

  const [broadcastQualityPreset, setBroadcastQualityPreset] = useState<string>('720p30')
  const [captureFps, setCaptureFps] = useState<number>(0)
  const captureFrameCountRef = useRef<number>(0)

  // Pre-Broadcast Performance Diagnostic (5 seconds check before connecting to YouTube)
  const [preStreamCheck, setPreStreamCheck] = useState<{
    isOpen: boolean
    countdown: number
    measuredFps: number | null
    warning: boolean
    isChecking: boolean
  }>({
    isOpen: false,
    countdown: 5,
    measuredFps: null,
    warning: false,
    isChecking: false
  })
  const diagnosticIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const diagnosticFramesCountRef = useRef<number>(0)

  // Phase 11: Phone Cameras & WebRTC Streams
  const [phoneCameras, setPhoneCameras] = useState<PhoneCameraDevice[]>([])
  const [cameraStreams, setCameraStreams] = useState<Record<string, MediaStream | null>>({})
  const [disconnectedAlert, setDisconnectedAlert] = useState<string | null>(null)
  const [churchBranding, setChurchBranding] = useState<ChurchBrandingConfig | null>(null)
  const [sourcesTab, setSourcesTab] = useState<StudioTab>('layers')
  const [selectedTransition, setSelectedTransition] = useState<TransitionType>('fade')
  const [programScene, setProgramScene] = useState<BroadcastScene | null>(null)
  const [outgoingScene, setOutgoingScene] = useState<BroadcastScene | null>(null)
  const [overlays, setOverlays] = useState<BroadcastOverlaysConfig>(() => {
    try {
      const saved = localStorage.getItem('cp_broadcast_overlays')
      return saved ? { ...DEFAULT_OVERLAYS, ...JSON.parse(saved) } : DEFAULT_OVERLAYS
    } catch {
      return DEFAULT_OVERLAYS
    }
  })
  const [isEditingLowerThird, setIsEditingLowerThird] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Deleted/Hidden templates and user-imported custom banners
  const [deletedTemplateIds, setDeletedTemplateIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cp_broadcast_deleted_templates')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [customBanners, setCustomBanners] = useState<CustomBannerItem[]>(() => {
    try {
      const saved = localStorage.getItem('cp_broadcast_custom_banners')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [importMode, setImportMode] = useState<'add_new' | 'replace_current'>('add_new')

  // Real VU Meter Audio Context & Analyser
  const [vuLevels, setVuLevels] = useState<{ [id: string]: number }>({
    master: 0,
    pres_audio: 0,
    mic_main: 0,
    aux_line: 0
  })
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureIntervalRef = useRef<NodeJS.Timeout | number | null>(null)
  const previewContainerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    isDragging: boolean
    type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'
    startX: number
    startY: number
    initialX: number
    initialY: number
    initialW: number
    initialH: number
    layerIndex: number
  } | null>(null)

  useEffect(() => {
    loadScenesAndSettings()
    loadMediaDevices()

    // Listen for device changes (unplug/replug)
    if (navigator.mediaDevices && navigator.mediaDevices.ondevicechange !== undefined) {
      navigator.mediaDevices.ondevicechange = () => {
        loadMediaDevices()
      }
    }

    // Subscribe to broadcast engine status
    const unsub = window.churchPresenterApi.onBroadcastStatusChanged?.((st) => {
      setStatus(st)
    })

    // Setup Audio Analyser for VU Meters
    setupAudioMeter()

    // Initialize Phone Camera WebRTC Receiver
    cameraReceiverService.initialize()
    const initialDevs = cameraReceiverService.getDevices()
    if (initialDevs.length > 0) {
      setPhoneCameras(initialDevs)
    }
    setCameraStreams(cameraReceiverService.getAllStreams())
    cameraReceiverService.refreshDevices().then((devs) => {
      if (devs && devs.length > 0) setPhoneCameras(devs)
    })
    const unsubCameraDevs = cameraReceiverService.onDeviceChange((devs) => {
      setPhoneCameras(devs)
    })
    const unsubCameraStreams = cameraReceiverService.onStreamChange((cameraId, stream) => {
      setCameraStreams((prev) => ({ ...prev, [cameraId]: stream }))
      if (!stream) {
        setDisconnectedAlert('⚠️ Una cámara móvil se ha desconectado. Se activó el fondo de respaldo automático. Reconectando cuando el teléfono vuelva...')
      } else {
        setDisconnectedAlert(null)
      }
    })

    window.churchPresenterApi.getChurchBranding?.().then((cb) => {
      if (cb) setChurchBranding(cb)
    })

    return () => {
      if (unsub) unsub()
      if (unsubCameraDevs) unsubCameraDevs()
      if (unsubCameraStreams) unsubCameraStreams()
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  // Live Stream & Recording Pipeline: Composites Program output to Canvas & feeds raw RGBA frames to FFmpeg
  useEffect(() => {
    const isCapturing = status.isStreaming || status.isRecording
    if (!isCapturing) {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current as any)
        captureIntervalRef.current = null
      }
      return
    }

    const is1080p = broadcastQualityPreset === '1080p30' || broadcastQualityPreset === '1080p60'
    const targetW = is1080p ? 1920 : 1280
    const targetH = is1080p ? 1080 : 720

    if (!captureCanvasRef.current) {
      const c = document.createElement('canvas')
      c.width = targetW
      c.height = targetH
      captureCanvasRef.current = c
    } else {
      if (captureCanvasRef.current.width !== targetW || captureCanvasRef.current.height !== targetH) {
        captureCanvasRef.current.width = targetW
        captureCanvasRef.current.height = targetH
      }
    }
    const canvas = captureCanvasRef.current
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true })
    if (!ctx) return

    // Paced at 30 FPS (~33ms) so it runs consistently even when window loses focus
    captureIntervalRef.current = setInterval(() => {
      captureFrameCountRef.current++
      // 1. Fill canvas background
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 2. Draw program monitor layers
      const container = document.getElementById('broadcast-program-monitor-layers')
      if (container) {
        const layerEls = container.querySelectorAll<HTMLDivElement>('.program-layer-item')
        layerEls.forEach((el) => {
          const video = el.querySelector('video')
          const x = parseFloat(el.getAttribute('data-x') || '0') * 0.01 * canvas.width
          const y = parseFloat(el.getAttribute('data-y') || '0') * 0.01 * canvas.height
          const w = parseFloat(el.getAttribute('data-w') || '100') * 0.01 * canvas.width
          const h = parseFloat(el.getAttribute('data-h') || '100') * 0.01 * canvas.height
          const opacity = parseFloat(el.getAttribute('data-opacity') || '1')

          ctx.save()
          ctx.globalAlpha = opacity
          if (video && video.readyState >= 2) {
            ctx.drawImage(video, x, y, w, h)
          } else {
            const img = el.querySelector('img')
            if (img && img.complete) {
              ctx.drawImage(img, x, y, w, h)
            }
          }
          ctx.restore()
        })
      }

      // 3. Draw Lower-Third banner overlay if enabled
      if (overlays.lowerThird.enabled && overlays.lowerThird.speakerName) {
        ctx.save()
        const pCol = overlays.lowerThird.primaryColor || '#0F172A'
        const sCol = overlays.lowerThird.secondaryColor || '#0284C7'
        const barY = canvas.height - 110
        const barX = 40

        ctx.fillStyle = pCol
        ctx.fillRect(barX, barY, 480, 52)
        ctx.fillStyle = sCol
        ctx.fillRect(barX, barY, 8, 52)

        ctx.font = 'bold 24px sans-serif'
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(overlays.lowerThird.speakerName.toUpperCase(), barX + 24, barY + 34)

        const sub = overlays.lowerThird.topicTitle || overlays.lowerThird.speakerTitle
        if (sub) {
          ctx.fillStyle = sCol
          ctx.fillRect(barX + 8, barY + 52, 400, 28)
          ctx.font = 'bold 16px sans-serif'
          ctx.fillStyle = '#FFFFFF'
          ctx.fillText(sub, barX + 24, barY + 72)
        }
        ctx.restore()
      }

      // 4. Draw Ticker overlay if enabled
      if (overlays.ticker.enabled && overlays.ticker.text) {
        ctx.save()
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(0, canvas.height - 36, canvas.width, 36)
        ctx.fillStyle = '#FF7A00'
        ctx.fillRect(0, canvas.height - 36, 120, 36)
        ctx.font = 'bold 15px sans-serif'
        ctx.fillStyle = '#000000'
        ctx.fillText('NOTICIAS', 16, canvas.height - 12)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = '16px sans-serif'
        ctx.fillText(overlays.ticker.text, 140, canvas.height - 12)
        ctx.restore()
      }

      // 5. Extract raw RGBA buffer and feed to FFmpeg
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const frameBytes = new Uint8Array(imgData.data.buffer)
        window.churchPresenterApi?.feedBroadcastChunk?.(frameBytes)
      } catch (err) {
        console.warn('[BroadcastStudio] Error extracting raw frame:', err)
      }
    }, 1000 / 30)

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current as any)
        captureIntervalRef.current = null
      }
    }
  }, [status.isStreaming, status.isRecording, overlays, broadcastQualityPreset])

  // Track live capture FPS entering FFmpeg pipeline
  useEffect(() => {
    const isCapturing = status.isStreaming || status.isRecording
    if (!isCapturing) {
      setCaptureFps(0)
      captureFrameCountRef.current = 0
      return
    }
    const timer = setInterval(() => {
      setCaptureFps(captureFrameCountRef.current)
      captureFrameCountRef.current = 0
    }, 1000)
    return () => clearInterval(timer)
  }, [status.isStreaming, status.isRecording])

  const loadScenesAndSettings = async () => {
    try {
      const dbScenes = await window.churchPresenterApi.getBroadcastScenes()
      if (dbScenes && dbScenes.length > 0) {
        setScenes(dbScenes)
        setPreviewSceneId(dbScenes[0].id)
        setProgramSceneId(dbScenes[0].id)
        setProgramScene(JSON.parse(JSON.stringify(dbScenes[0])))
      }
      const mixerState = await window.churchPresenterApi.getAudioMixerConfig()
      if (mixerState) {
        setAudioMixer(mixerState)
      }
      const st = await window.churchPresenterApi.getBroadcastStatus()
      if (st) {
        setStatus(st)
      }
      const bSettings = await window.churchPresenterApi.getBroadcastSettings?.()
      if (bSettings && bSettings.qualityPreset) {
        setBroadcastQualityPreset(bSettings.qualityPreset)
      }
    } catch (err) {
      console.error('Failed to load broadcast scenes/settings:', err)
    }
  }

  const loadMediaDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'))
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
      }
      const screens = await window.churchPresenterApi.listDesktopSources()
      setDesktopSources(screens || [])
    } catch (err) {
      console.warn('Error loading hardware media devices:', err)
    }
  }

  const setupAudioMeter = async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      audioContextRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyserRef.current = analyser

      // Attempt to access microphone for real input metering
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          const source = ctx.createMediaStreamSource(stream)
          source.connect(analyser)
        } catch {
          // No microphone or permission denied - will run synthetic fallback meter
        }
      }

      const pcmData = new Uint8Array(analyser.frequencyBinCount)
      const renderLoop = () => {
        analyser.getByteFrequencyData(pcmData)
        let sum = 0
        for (let i = 0; i < pcmData.length; i++) {
          sum += pcmData[i]
        }
        const avg = sum / pcmData.length
        const realLevel = Math.min(100, Math.round((avg / 255) * 100))

        // Update levels with smooth decibel estimation
        setVuLevels({
          master: Math.max(8, realLevel),
          pres_audio: Math.max(12, Math.round(realLevel * 0.9)),
          mic_main: Math.max(6, Math.round(realLevel * 1.1)),
          aux_line: Math.max(4, Math.round(realLevel * 0.7))
        })
        animationFrameRef.current = requestAnimationFrame(renderLoop)
      }
      renderLoop()
    } catch (e) {
      console.warn('Web Audio Meter could not be initialized:', e)
    }
  }

  const updateOverlays = (patch: Partial<BroadcastOverlaysConfig>) => {
    setOverlays((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem('cp_broadcast_overlays', JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  // QR Code Generation for Overlays (Standalone QR and Badge Slot QR)
  useEffect(() => {
    if (!overlays.qrCode.url) return
    QRCode.toDataURL(overlays.qrCode.url, { margin: 1, width: 220 })
      .then((dataUrl) => {
        setOverlays((prev) => {
          if (prev.qrCode.qrDataUrl === dataUrl) return prev
          return {
            ...prev,
            qrCode: { ...prev.qrCode, qrDataUrl: dataUrl }
          }
        })
      })
      .catch(() => {})
  }, [overlays.qrCode.url])

  useEffect(() => {
    const targetUrl = overlays.lowerThird.badgeQrUrl || 'https://paypal.me/iglesia'
    QRCode.toDataURL(targetUrl, { margin: 1, width: 220 })
      .then((dataUrl) => {
        setOverlays((prev) => {
          if (prev.lowerThird.badgeQrDataUrl === dataUrl) return prev
          return {
            ...prev,
            lowerThird: { ...prev.lowerThird, badgeQrDataUrl: dataUrl }
          }
        })
      })
      .catch(() => {})
  }, [overlays.lowerThird.badgeQrUrl])

  // File Importer for .EPS, .SVG, .PNG Vector Graphics
  const handleImportEpsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileName = file.name.toLowerCase()
      let dataUrl = ''
      let fileType: 'eps' | 'svg' | 'raster' = 'raster'

      if (fileName.endsWith('.eps')) {
        const arrayBuffer = await file.arrayBuffer()
        const parsed = EpsBannerImporter.parseEpsArrayBuffer(arrayBuffer, file.name)
        dataUrl = parsed.dataUrl
        fileType = 'eps'
      } else if (fileName.endsWith('.svg')) {
        const text = await file.text()
        const parsed = EpsBannerImporter.parseSvgText(text, file.name)
        dataUrl = parsed.dataUrl
        fileType = 'svg'
      } else {
        // Raster PNG, JPG, WebP
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        fileType = 'raster'
      }

      if (dataUrl) {
        const isCustomSelected =
          overlays.lowerThird.template.startsWith('custom_') &&
          overlays.lowerThird.template !== 'custom_imported'

        if (importMode === 'replace_current' && isCustomSelected) {
          // Replace graphic of the currently selected custom banner
          setCustomBanners((prev) => {
            const next = prev.map((b) =>
              b.id === overlays.lowerThird.template
                ? {
                    ...b,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    type: fileType,
                    graphicUrl: dataUrl
                  }
                : b
            )
            try {
              localStorage.setItem('cp_broadcast_custom_banners', JSON.stringify(next))
            } catch {
              // ignore
            }
            return next
          })

          updateOverlays({
            lowerThird: {
              ...overlays.lowerThird,
              customGraphicUrl: dataUrl,
              customGraphicName: file.name
            }
          })
        } else {
          // Default: Always add as a NEW distinct banner preset in the library!
          const newBanner: CustomBannerItem = {
            id: `custom_${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ''),
            type: fileType,
            graphicUrl: dataUrl,
            createdAt: Date.now()
          }

          setCustomBanners((prev) => {
            const next = [...prev, newBanner]
            try {
              localStorage.setItem('cp_broadcast_custom_banners', JSON.stringify(next))
            } catch {
              // ignore
            }
            return next
          })

          updateOverlays({
            lowerThird: {
              ...overlays.lowerThird,
              template: newBanner.id,
              customGraphicUrl: dataUrl,
              customGraphicName: file.name
            }
          })
        }
        setIsEditingLowerThird(true)
      }
    } catch (err) {
      console.error('Error importing banner graphic:', err)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Delete banner template (both imported custom banners and built-in templates)
  const handleDeleteBannerTemplate = (templateId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    const isCustomBanner = customBanners.some((b) => b.id === templateId)
    let nextCustom = customBanners
    let nextDeleted = deletedTemplateIds

    if (isCustomBanner) {
      nextCustom = customBanners.filter((b) => b.id !== templateId)
      setCustomBanners(nextCustom)
      try {
        localStorage.setItem('cp_broadcast_custom_banners', JSON.stringify(nextCustom))
      } catch {
        // ignore
      }
    } else {
      nextDeleted = Array.from(new Set([...deletedTemplateIds, templateId]))
      setDeletedTemplateIds(nextDeleted)
      try {
        localStorage.setItem('cp_broadcast_deleted_templates', JSON.stringify(nextDeleted))
      } catch {
        // ignore
      }
    }

    // If the deleted template was active, switch to first available template
    if (overlays.lowerThird.template === templateId) {
      const remainingBuiltin = LOWER_THIRD_TEMPLATES.filter(
        (t) => !nextDeleted.includes(t.id) && t.id !== 'custom_imported'
      )
      const fallback =
        remainingBuiltin[0] ||
        (nextCustom.length > 0
          ? {
              id: nextCustom[0].id,
              name: nextCustom[0].name,
              subtitle: '',
              thumbnailDescription: '',
              defaultPrimary: '#181818',
              defaultSecondary: '#FF7A00',
              hasBadgeSlot: true,
              badgeShape: 'square' as const,
              customGraphicUrl: nextCustom[0].graphicUrl
            }
          : LOWER_THIRD_TEMPLATES[0])

      const fbPreset =
        typeof fallback === 'string'
          ? LOWER_THIRD_TEMPLATES.find((t) => t.id === fallback)
          : fallback

      updateOverlays({
        lowerThird: {
          ...overlays.lowerThird,
          template: (typeof fallback === 'string' ? fallback : fallback.id) as any,
          primaryColor: fbPreset?.defaultPrimary || '#0F172A',
          secondaryColor: fbPreset?.defaultSecondary || '#0284C7',
          customGraphicUrl: (fallback as any).customGraphicUrl || '',
          customGraphicName: (fallback as any).name || ''
        }
      })
    }
  }

  const handleRestoreAllTemplates = () => {
    setDeletedTemplateIds([])
    try {
      localStorage.removeItem('cp_broadcast_deleted_templates')
    } catch {
      // ignore
    }
  }

  // Active banner templates (filtering out deleted and including user-imported ones)
  const activeBannerTemplates: LowerThirdTemplatePreset[] = [
    ...LOWER_THIRD_TEMPLATES.filter((t) => !deletedTemplateIds.includes(t.id) && t.id !== 'custom_imported'),
    ...customBanners.map((b) => ({
      id: b.id,
      name: b.name || 'Banner Importado',
      subtitle: `Vector ${b.type.toUpperCase()}`,
      thumbnailDescription: 'Gráfico importado por el usuario',
      defaultPrimary: '#181818',
      defaultSecondary: '#FF7A00',
      hasBadgeSlot: true,
      badgeShape: 'square' as const,
      isCustom: true,
      customGraphicUrl: b.graphicUrl
    })),
    ...(customBanners.length === 0 && !deletedTemplateIds.includes('custom_imported')
      ? [LOWER_THIRD_TEMPLATES.find((t) => t.id === 'custom_imported')!]
      : [])
  ]

  // Scene Switching & Transitions (Preview vs Program Isolation)
  const activePreviewScene = scenes.find((s) => s.id === previewSceneId) || scenes[0]
  const activeProgramScene = programScene || scenes.find((s) => s.id === programSceneId) || scenes[0]

  const handleCutTransition = useCallback(() => {
    if (isTransitioning || !activePreviewScene) return
    setProgramSceneId(activePreviewScene.id)
    setProgramScene(JSON.parse(JSON.stringify(activePreviewScene)))
  }, [isTransitioning, activePreviewScene])

  const handleExecuteTransition = useCallback(() => {
    if (isTransitioning || !activePreviewScene) return
    const prevOnAir = programScene
      ? JSON.parse(JSON.stringify(programScene))
      : activeProgramScene
        ? JSON.parse(JSON.stringify(activeProgramScene))
        : null
    setOutgoingScene(prevOnAir)
    setProgramSceneId(activePreviewScene.id)
    setProgramScene(JSON.parse(JSON.stringify(activePreviewScene)))
    setIsTransitioning(true)
    setTimeout(() => {
      setIsTransitioning(false)
      setOutgoingScene(null)
    }, transitionDuration)
  }, [isTransitioning, activePreviewScene, programScene, activeProgramScene, transitionDuration])

  // Sync scene transitions initiated by Remote Operator
  useEffect(() => {
    if (window.churchPresenterApi?.onBroadcastSetActiveScene) {
      const unsub = window.churchPresenterApi.onBroadcastSetActiveScene((data) => {
        if (data.sceneId) {
          if (data.target === 'preview') {
            setPreviewSceneId(data.sceneId)
          } else {
            setProgramSceneId(data.sceneId)
            const target = scenes.find((s) => s.id === data.sceneId)
            if (target) setProgramScene(JSON.parse(JSON.stringify(target)))
          }
        }
        if (data.transition === 'cut') {
          handleCutTransition()
        } else if (data.transition === 'fade') {
          handleExecuteTransition()
        }
      })
      return () => unsub()
    }
    return undefined
  }, [scenes, handleCutTransition, handleExecuteTransition])

  // Scene Management
  const handleCreateScene = async () => {
    const newScene: BroadcastScene = {
      id: `scene_${Date.now()}`,
      name: `Nueva Escena ${scenes.length + 1}`,
      orderIndex: scenes.length,
      layers: [
        {
          id: `layer_${Date.now()}_1`,
          name: 'Salida de Presentación',
          type: 'presentation',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          opacity: 1,
          zIndex: 1,
          visible: true
        }
      ]
    }
    const saved = await window.churchPresenterApi.saveBroadcastScene(newScene)
    setScenes((prev) => [...prev, saved])
    setPreviewSceneId(saved.id)
  }

  const handleDuplicateScene = async () => {
    if (!activePreviewScene) return
    const dup: BroadcastScene = {
      ...activePreviewScene,
      id: `scene_${Date.now()}`,
      name: `${activePreviewScene.name} (Copia)`,
      orderIndex: scenes.length
    }
    const saved = await window.churchPresenterApi.saveBroadcastScene(dup)
    setScenes((prev) => [...prev, saved])
    setPreviewSceneId(saved.id)
  }

  const handleDeleteScene = async () => {
    if (scenes.length <= 1 || !activePreviewScene) return
    await window.churchPresenterApi.deleteBroadcastScene(activePreviewScene.id)
    const filtered = scenes.filter((s) => s.id !== activePreviewScene.id)
    setScenes(filtered)
    setPreviewSceneId(filtered[0].id)
    if (programSceneId === activePreviewScene.id) {
      setProgramSceneId(filtered[0].id)
      setProgramScene(JSON.parse(JSON.stringify(filtered[0])))
    }
  }

  // Layer Management in Preview Scene
  const handleAddLayer = async () => {
    if (!activePreviewScene) return
    const newLayer: BroadcastLayer = {
      id: `layer_${Date.now()}`,
      name: `Capa ${activePreviewScene.layers.length + 1}`,
      type: 'video_device',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
      opacity: 1,
      zIndex: activePreviewScene.layers.length + 1,
      visible: true
    }
    const updated = {
      ...activePreviewScene,
      layers: [...activePreviewScene.layers, newLayer]
    }
    await window.churchPresenterApi.saveBroadcastScene(updated)
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedLayerIndex(updated.layers.length - 1)
  }

  const handleAddPhoneCameraLayer = async (cam: PhoneCameraDevice) => {
    if (!activePreviewScene) return
    const isFirstLayer = activePreviewScene.layers.length === 0
    const newLayer: BroadcastLayer = {
      id: `layer_cam_${Date.now()}`,
      name: cam.name,
      type: 'phone_camera',
      phoneCameraId: cam.id,
      // If adding a second camera to the same scene, position it as PIP in the corner instead of covering the first camera!
      x: isFirstLayer ? 0 : 60,
      y: isFirstLayer ? 0 : 5,
      width: isFirstLayer ? 100 : 35,
      height: isFirstLayer ? 100 : 35,
      opacity: 1,
      zIndex: activePreviewScene.layers.length + 1,
      visible: true
    }
    const updated = {
      ...activePreviewScene,
      layers: [...activePreviewScene.layers, newLayer]
    }
    await window.churchPresenterApi.saveBroadcastScene(updated)
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedLayerIndex(updated.layers.length - 1)
    setSourcesTab('layers')
  }

  const handleMoveLayer = async (fromIndex: number, direction: -1 | 1) => {
    if (!activePreviewScene) return
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= activePreviewScene.layers.length) return

    const newLayers = [...activePreviewScene.layers]
    const [moved] = newLayers.splice(fromIndex, 1)
    newLayers.splice(toIndex, 0, moved)

    const updatedLayers = newLayers.map((l, i) => ({ ...l, zIndex: i + 1 }))
    const updated = { ...activePreviewScene, layers: updatedLayers }

    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedLayerIndex(toIndex)
    await window.churchPresenterApi.saveBroadcastScene(updated)
  }

  const handleUpdateLayer = async (index: number, patch: Partial<BroadcastLayer>) => {
    if (!activePreviewScene) return
    const layers = [...activePreviewScene.layers]
    layers[index] = { ...layers[index], ...patch }
    const updated = { ...activePreviewScene, layers }
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    await window.churchPresenterApi.saveBroadcastScene(updated)
  }

  const handleDeleteLayer = async (index: number) => {
    if (!activePreviewScene || activePreviewScene.layers.length <= 1) return
    const layers = activePreviewScene.layers.filter((_, i) => i !== index)
    const updated = { ...activePreviewScene, layers }
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setSelectedLayerIndex(0)
    await window.churchPresenterApi.saveBroadcastScene(updated)
  }

  // Interactive Layer Drag & Resize Handlers on Preview Monitor
  const startLayerInteraction = useCallback(
    (
      e: React.MouseEvent,
      type: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e',
      layerIndex: number
    ) => {
      e.stopPropagation()
      e.preventDefault()

      if (!activePreviewScene || !activePreviewScene.layers[layerIndex]) return
      setSelectedLayerIndex(layerIndex)

      const layer = activePreviewScene.layers[layerIndex]
      const container = previewContainerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      dragRef.current = {
        isDragging: true,
        type,
        startX: e.clientX,
        startY: e.clientY,
        initialX: layer.x,
        initialY: layer.y,
        initialW: layer.width,
        initialH: layer.height,
        layerIndex
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!dragRef.current || !dragRef.current.isDragging) return
        const { type: actionType, startX, startY, initialX, initialY, initialW, initialH, layerIndex: idx } = dragRef.current
        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
        const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100

        let newX = initialX
        let newY = initialY
        let newW = initialW
        let newH = initialH

        if (actionType === 'move') {
          newX = Math.max(0, Math.min(100 - initialW, initialX + deltaX))
          newY = Math.max(0, Math.min(100 - initialH, initialY + deltaY))
        } else if (actionType === 'se') {
          newW = Math.max(5, Math.min(100 - initialX, initialW + deltaX))
          newH = Math.max(5, Math.min(100 - initialY, initialH + deltaY))
        } else if (actionType === 'sw') {
          newX = Math.max(0, Math.min(initialX + initialW - 5, initialX + deltaX))
          newW = initialW - (newX - initialX)
          newH = Math.max(5, Math.min(100 - initialY, initialH + deltaY))
        } else if (actionType === 'ne') {
          newY = Math.max(0, Math.min(initialY + initialH - 5, initialY + deltaY))
          newW = Math.max(5, Math.min(100 - initialX, initialW + deltaX))
          newH = initialH - (newY - initialY)
        } else if (actionType === 'nw') {
          newX = Math.max(0, Math.min(initialX + initialW - 5, initialX + deltaX))
          newY = Math.max(0, Math.min(initialY + initialH - 5, initialY + deltaY))
          newW = initialW - (newX - initialX)
          newH = initialH - (newY - initialY)
        } else if (actionType === 'n') {
          newY = Math.max(0, Math.min(initialY + initialH - 5, initialY + deltaY))
          newH = initialH - (newY - initialY)
        } else if (actionType === 's') {
          newH = Math.max(5, Math.min(100 - initialY, initialH + deltaY))
        } else if (actionType === 'w') {
          newX = Math.max(0, Math.min(initialX + initialW - 5, initialX + deltaX))
          newW = initialW - (newX - initialX)
        } else if (actionType === 'e') {
          newW = Math.max(5, Math.min(100 - initialX, initialW + deltaX))
        }

        setScenes((prev) =>
          prev.map((s) => {
            if (s.id !== activePreviewScene.id) return s
            const currentLayers = [...s.layers]
            currentLayers[idx] = {
              ...currentLayers[idx],
              x: Math.round(newX),
              y: Math.round(newY),
              width: Math.round(newW),
              height: Math.round(newH)
            }
            return { ...s, layers: currentLayers }
          })
        )
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        if (!dragRef.current) return
        dragRef.current = null

        setScenes((latestScenes) => {
          const latestScene = latestScenes.find((s) => s.id === activePreviewScene.id)
          if (latestScene) {
            window.churchPresenterApi.saveBroadcastScene(latestScene).catch(() => {})
          }
          return latestScenes
        })
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [activePreviewScene]
  )

  // Keyboard Nudge for selected layer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!activePreviewScene || !activePreviewScene.layers[selectedLayerIndex]) return
        const layer = activePreviewScene.layers[selectedLayerIndex]
        const step = e.shiftKey ? 5 : 1
        let dx = 0
        let dy = 0

        if (e.key === 'ArrowLeft') dx = -step
        if (e.key === 'ArrowRight') dx = step
        if (e.key === 'ArrowUp') dy = -step
        if (e.key === 'ArrowDown') dy = step

        e.preventDefault()
        const newX = Math.max(0, Math.min(100 - layer.width, layer.x + dx))
        const newY = Math.max(0, Math.min(100 - layer.height, layer.y + dy))

        handleUpdateLayer(selectedLayerIndex, { x: newX, y: newY })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePreviewScene, selectedLayerIndex])

  // Audio Mixer Updates
  const handleUpdateAudioSource = async (id: string, patch: Partial<BroadcastAudioSource>) => {
    const nextSources = audioMixer.sources.map((s) => (s.id === id ? { ...s, ...patch } : s))
    const nextState = { ...audioMixer, sources: nextSources }
    setAudioMixer(nextState)
    await window.churchPresenterApi.saveAudioMixerConfig(nextState)
  }

  const handleToggleMasterMute = async () => {
    const nextState = { ...audioMixer, masterMuted: !audioMixer.masterMuted }
    setAudioMixer(nextState)
    await window.churchPresenterApi.saveAudioMixerConfig(nextState)
  }

  const startPreStreamDiagnostic = () => {
    diagnosticFramesCountRef.current = 0
    setPreStreamCheck({
      isOpen: true,
      countdown: 5,
      measuredFps: null,
      warning: false,
      isChecking: true
    })

    const startTime = Date.now()
    const is1080p = broadcastQualityPreset === '1080p30' || broadcastQualityPreset === '1080p60'
    const targetW = is1080p ? 1920 : 1280
    const targetH = is1080p ? 1080 : 720

    const testCanvas = document.createElement('canvas')
    testCanvas.width = targetW
    testCanvas.height = targetH
    const ctx = testCanvas.getContext('2d')

    const frameLoop = () => {
      if (ctx) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, targetW, targetH)
      }
      diagnosticFramesCountRef.current++
    }

    const frameTimer = setInterval(frameLoop, 1000 / 30)

    let remaining = 5
    diagnosticIntervalRef.current = setInterval(() => {
      remaining -= 1
      setPreStreamCheck((prev) => ({ ...prev, countdown: remaining }))
      if (remaining <= 0) {
        if (diagnosticIntervalRef.current) clearInterval(diagnosticIntervalRef.current)
        clearInterval(frameTimer)
        const elapsedSec = (Date.now() - startTime) / 1000
        const realFps = diagnosticFramesCountRef.current / (elapsedSec || 5)

        if (realFps < 25) {
          setPreStreamCheck((prev) => ({
            ...prev,
            isChecking: false,
            warning: true,
            measuredFps: realFps
          }))
        } else {
          setPreStreamCheck({
            isOpen: false,
            countdown: 5,
            measuredFps: realFps,
            warning: false,
            isChecking: false
          })
          window.churchPresenterApi.startBroadcastStream()
        }
      }
    }, 1000)
  }

  const cancelPreStreamCheck = () => {
    if (diagnosticIntervalRef.current) {
      clearInterval(diagnosticIntervalRef.current)
      diagnosticIntervalRef.current = null
    }
    setPreStreamCheck({
      isOpen: false,
      countdown: 5,
      measuredFps: null,
      warning: false,
      isChecking: false
    })
  }

  const proceedAnywayWithStream = async () => {
    cancelPreStreamCheck()
    await window.churchPresenterApi.startBroadcastStream()
  }

  // Streaming & Recording Actions with Confirmation Modals
  const triggerActionWithConfirm = (action: 'start_stream' | 'stop_stream' | 'start_record' | 'stop_record') => {
    if (action === 'start_stream') {
      startPreStreamDiagnostic()
    } else if (action === 'stop_stream') {
      setConfirmModal({
        open: true,
        action,
        title: 'DETENER Transmisión en Vivo',
        message: '¡Atención! La audiencia conectada a internet perderá la señal en vivo de inmediato. ¿Seguro que deseas detener la transmisión?'
      })
    } else if (action === 'start_record') {
      setConfirmModal({
        open: true,
        action,
        title: 'Iniciar Grabación Local',
        message: 'Se creará un archivo de video en alta calidad en disco.'
      })
    } else if (action === 'stop_record') {
      setConfirmModal({
        open: true,
        action,
        title: 'Detener Grabación Local',
        message: 'El archivo de video se cerrará y guardará en disco.'
      })
    }
  }

  const handleExecuteConfirmedAction = async () => {
    const act = confirmModal.action
    setConfirmModal({ open: false, action: null, title: '', message: '' })
    if (act === 'start_stream') {
      await window.churchPresenterApi.startBroadcastStream()
    } else if (act === 'stop_stream') {
      await window.churchPresenterApi.stopBroadcastStream()
    } else if (act === 'start_record') {
      await window.churchPresenterApi.startBroadcastRecord()
    } else if (act === 'stop_record') {
      await window.churchPresenterApi.stopBroadcastRecord()
    }
  }

  // Helper to render layer visual content
  const renderLayerInner = (layer: BroadcastLayer, isProgram = false) => {
    const camId =
      layer.phoneCameraId ||
      phoneCameras.find((c) => c.isStreaming)?.id ||
      phoneCameras[0]?.id ||
      Object.keys(cameraStreams)[0]
    const stream = layer.type === 'phone_camera' ? cameraStreams[camId || ''] : null

    if (layer.type === 'phone_camera' && stream) {
      return (
        <video
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream
          }}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )
    } else if (layer.type === 'phone_camera') {
      return (
        <div
          style={{
            textAlign: 'center',
            padding: 4,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000'
          }}
        >
          {churchBranding?.logoUrl ? (
            <img
              src={churchBranding.logoUrl}
              alt="Logo"
              style={{ maxHeight: '35%', maxWidth: '60%', objectFit: 'contain', marginBottom: 4 }}
            />
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#FF7A00' }}>
              {churchBranding?.churchName || 'CHURCH PRESENTER'}
            </span>
          )}
          <span style={{ fontSize: 9, color: '#f59e0b' }}>⚠️ Respaldo Automático</span>
        </div>
      )
    }

    if (layer.type === 'media_file') {
      if (layer.mediaUrl) {
        const isVideo =
          layer.mediaType === 'video' ||
          /\.(mp4|webm|mov|mkv)$/i.test(layer.mediaPath || layer.mediaUrl)
        if (isVideo) {
          return (
            <video
              src={layer.mediaUrl}
              autoPlay
              loop
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )
        }
        return (
          <img
            src={layer.mediaUrl}
            alt={layer.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )
      }
      return (
        <div
          style={{
            textAlign: 'center',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            backgroundColor: '#111827',
            color: '#9CA3AF'
          }}
        >
          <Film size={22} color="#6B7280" style={{ marginBottom: 4 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#FFFFFF' }}>{layer.name}</span>
          <span style={{ fontSize: 9, color: '#9CA3AF' }}>Sin archivo seleccionado</span>
        </div>
      )
    }

    if (layer.type === 'presentation') {
      return (
        <div style={{ textAlign: 'center', padding: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 3px #000' }}>
            {layer.name}
          </span>
          <div style={{ fontSize: 9, color: isProgram ? '#22c55e' : '#38BDF8' }}>
            {isProgram ? '● En Vivo en Salida RTMP' : 'Salida de Diapositivas'}
          </div>
        </div>
      )
    }

    return (
      <div style={{ textAlign: 'center', padding: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', textShadow: '0 1px 3px #000' }}>
          {layer.name}
        </span>
        <div style={{ fontSize: 9, color: isProgram ? '#22c55e' : '#38BDF8' }}>
          {isProgram
            ? '● En Vivo en Salida RTMP'
            : layer.type === 'video_device'
            ? 'Cámara / Capturadora'
            : 'Captura Pantalla'}
        </div>
      </div>
    )
  }

  // Helper to get CSS transition animation
  const getTransitionAnimation = (type: TransitionType, isIncoming: boolean) => {
    if (type === 'fade') {
      return isIncoming
        ? `fadeInScene ${transitionDuration}ms ease-in-out forwards`
        : `fadeOutScene ${transitionDuration}ms ease-in-out forwards`
    }
    if (type === 'slide-left') {
      return isIncoming
        ? `slideInFromRight ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
        : `slideOutToLeft ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
    }
    if (type === 'slide-right') {
      return isIncoming
        ? `slideInFromLeft ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
        : `slideOutToRight ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
    }
    if (type === 'slide-up') {
      return isIncoming
        ? `slideInFromBottom ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
        : `slideOutToTop ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
    }
    if (type === 'slide-down') {
      return isIncoming
        ? `slideInFromTop ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
        : `slideOutToBottom ${transitionDuration}ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards`
    }
    if (type === 'wipe-left') {
      return isIncoming
        ? `wipeInLeft ${transitionDuration}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
        : 'none'
    }
    if (type === 'wipe-right') {
      return isIncoming
        ? `wipeInRight ${transitionDuration}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
        : 'none'
    }
    if (type === 'blinds' || type === 'split') {
      return isIncoming
        ? `splitInScene ${transitionDuration}ms ease-out forwards`
        : `fadeOutScene ${transitionDuration}ms ease-out forwards`
    }
    if (type === 'flip') {
      return isIncoming
        ? `flipInScene ${transitionDuration}ms ease-out forwards`
        : `flipOutScene ${transitionDuration}ms ease-out forwards`
    }
    if (type === 'zoom') {
      return isIncoming
        ? `zoomInScene ${transitionDuration}ms ease-out forwards`
        : `zoomOutScene ${transitionDuration}ms ease-out forwards`
    }
    if (type === 'dip-black') {
      return isIncoming
        ? `dipInBlack ${transitionDuration}ms ease-in-out forwards`
        : `dipOutBlack ${transitionDuration}ms ease-in-out forwards`
    }
    return isIncoming
      ? `fadeInScene ${transitionDuration}ms ease-in-out forwards`
      : `fadeOutScene ${transitionDuration}ms ease-in-out forwards`
  }

  // Helper to render Lower Third Banners with professional TV Broadcast styles
  const renderLowerThirdBanner = (
    overrideConfig?: Partial<BroadcastOverlaysConfig['lowerThird']>,
    isMiniPreview = false
  ) => {
    const cfg = { ...overlays.lowerThird, ...overrideConfig }
    const template = cfg.template || 'qr_square'
    const primary =
      cfg.primaryColor ||
      (template === 'tv_news'
        ? '#1E3A8A'
        : template === 'modern_pill'
        ? '#1E40AF'
        : template === 'slanted_dynamic'
        ? '#1E3A8A'
        : template === 'gold_altar'
        ? '#0B0C0E'
        : '#0F172A')
    const secondary =
      cfg.secondaryColor ||
      (template === 'tv_news'
        ? '#DC2626'
        : template === 'modern_pill'
        ? '#EC4899'
        : template === 'slanted_dynamic'
        ? '#F43F5E'
        : template === 'gold_altar'
        ? '#D97706'
        : '#0284C7')
    const qrDataUrl = cfg.badgeQrDataUrl || overlays.lowerThird.badgeQrDataUrl

    const badgeContent = (
      <>
        {cfg.badgeType === 'qr_code' ? (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 4,
              padding: isMiniPreview ? 1 : 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR"
                style={{
                  width: isMiniPreview ? 34 : 50,
                  height: isMiniPreview ? 34 : 50,
                  display: 'block'
                }}
              />
            ) : (
              <QrCode size={isMiniPreview ? 24 : 36} color="#000" />
            )}
          </div>
        ) : cfg.badgeType === 'church_logo' && churchBranding?.logoUrl ? (
          <img
            src={churchBranding.logoUrl}
            alt="Logo"
            style={{ maxWidth: isMiniPreview ? 34 : 50, maxHeight: isMiniPreview ? 34 : 50, objectFit: 'contain' }}
          />
        ) : (
          <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
            <div style={{ fontSize: isMiniPreview ? 7 : 9, fontWeight: 900, color: '#93C5FD', letterSpacing: '0.1em' }}>
              FULL
            </div>
            <div style={{ fontSize: isMiniPreview ? 11 : 16, fontWeight: 900, color: '#F43F5E', letterSpacing: '0.05em' }}>
              {cfg.badgeText || 'HD'}
            </div>
          </div>
        )}
      </>
    )

    // Template 1: QR Square / Full HD (Matches Image 2 Middle)
    if (template === 'qr_square') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))',
            transform: isMiniPreview ? 'scale(0.85)' : 'none',
            transformOrigin: 'bottom left',
            zIndex: 121
          }}
        >
          {cfg.badgeType !== 'none' && (
            <div
              style={{
                width: isMiniPreview ? 48 : 68,
                minWidth: isMiniPreview ? 48 : 68,
                backgroundColor: primary,
                border: `2px solid ${secondary}`,
                borderRadius: '6px 0 0 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
              }}
            >
              {badgeContent}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: isMiniPreview ? 150 : 220 }}>
            <div
              style={{
                backgroundColor: primary,
                borderTop: '1px solid rgba(255,255,255,0.2)',
                borderRight: '1px solid rgba(255,255,255,0.15)',
                borderRadius: cfg.badgeType === 'none' ? '6px 6px 0 0' : '0 6px 0 0',
                padding: isMiniPreview ? '3px 10px' : '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span
                style={{
                  fontSize: isMiniPreview ? 11 : 14,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                {cfg.speakerName}
              </span>
              {cfg.speakerTitle && (
                <span
                  style={{
                    fontSize: isMiniPreview ? 8 : 10,
                    fontWeight: 700,
                    color: '#93C5FD',
                    textTransform: 'uppercase'
                  }}
                >
                  • {cfg.speakerTitle}
                </span>
              )}
            </div>

            <div
              style={{
                backgroundColor: secondary,
                borderRadius: cfg.badgeType === 'none' ? '0 0 6px 6px' : '0 0 6px 0',
                padding: isMiniPreview ? '2px 10px' : '3px 16px',
                fontSize: isMiniPreview ? 8 : 10,
                fontWeight: 600,
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                letterSpacing: '0.02em'
              }}
            >
              <span>{cfg.topicTitle || 'Transmisión en Vivo'}</span>
              <span style={{ fontSize: isMiniPreview ? 7 : 9, opacity: 0.9, fontWeight: 700 }}>• EN VIVO</span>
            </div>
          </div>
        </div>
      )
    }

    // Template 2: TV News Metallic (Matches Image 1)
    if (template === 'tv_news') {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))',
            transform: isMiniPreview ? 'scale(0.85)' : 'none',
            transformOrigin: 'bottom left',
            zIndex: 121
          }}
        >
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            {cfg.badgeType !== 'none' && (
              <div
                style={{
                  width: isMiniPreview ? 44 : 58,
                  backgroundColor: primary,
                  borderRadius: '8px 0 0 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4
                }}
              >
                {cfg.badgeType === 'qr_code' ? (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: 4, padding: 2 }}>
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR"
                        style={{
                          width: isMiniPreview ? 34 : 44,
                          height: isMiniPreview ? 34 : 44,
                          display: 'block'
                        }}
                      />
                    ) : (
                      <QrCode size={isMiniPreview ? 24 : 32} color="#000" />
                    )}
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: isMiniPreview ? 13 : 18,
                      fontWeight: 900,
                      color: '#FFFFFF',
                      fontStyle: 'italic'
                    }}
                  >
                    {cfg.badgeText || '24'}
                  </span>
                )}
              </div>
            )}

            <div
              style={{
                background: 'linear-gradient(180deg, #FFFFFF 0%, #E5E7EB 45%, #9CA3AF 100%)',
                padding: isMiniPreview ? '4px 12px' : '6px 20px',
                borderRadius: cfg.badgeType === 'none' ? '8px 8px 0 0' : '0 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                clipPath: 'polygon(0 0, 100% 0, 96% 100%, 0 100%)',
                flex: 1
              }}
            >
              <span
                style={{
                  fontSize: isMiniPreview ? 11 : 15,
                  fontWeight: 900,
                  color: '#111827',
                  fontStyle: 'italic',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase'
                }}
              >
                {cfg.speakerName}
              </span>
              {cfg.speakerTitle && (
                <span
                  style={{
                    fontSize: isMiniPreview ? 8 : 11,
                    fontWeight: 800,
                    color: '#DC2626',
                    textTransform: 'uppercase',
                    fontStyle: 'italic'
                  }}
                >
                  {cfg.speakerTitle}
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              backgroundColor: secondary,
              borderRadius: '0 0 8px 0',
              padding: isMiniPreview ? '2px 12px' : '4px 18px',
              color: '#FFFFFF',
              fontSize: isMiniPreview ? 8 : 11,
              fontWeight: 700,
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginLeft: cfg.badgeType !== 'none' ? (isMiniPreview ? 10 : 14) : 0
            }}
          >
            <span>{cfg.topicTitle || 'Culto en Vivo'}</span>
            <span style={{ fontSize: isMiniPreview ? 7 : 9, letterSpacing: '0.1em', fontWeight: 900, color: '#FEE2E2' }}>
              ● STREAMING
            </span>
          </div>
        </div>
      )
    }

    // Template 3: Modern Pill (Matches Image 2 Bottom)
    if (template === 'modern_pill') {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))',
            transform: isMiniPreview ? 'scale(0.85)' : 'none',
            transformOrigin: 'bottom left',
            zIndex: 121
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {cfg.badgeType !== 'none' && (
              <div
                style={{
                  width: isMiniPreview ? 42 : 56,
                  height: isMiniPreview ? 42 : 56,
                  borderRadius: '50%',
                  backgroundColor: secondary,
                  border: '3px solid #38BDF8',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: isMiniPreview ? -10 : -14,
                  zIndex: 3,
                  overflow: 'hidden'
                }}
              >
                {cfg.badgeType === 'qr_code' ? (
                  <div style={{ backgroundColor: '#ffffff', borderRadius: 4, padding: 2 }}>
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR"
                        style={{
                          width: isMiniPreview ? 30 : 40,
                          height: isMiniPreview ? 30 : 40,
                          display: 'block'
                        }}
                      />
                    ) : (
                      <QrCode size={isMiniPreview ? 20 : 30} color="#000" />
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', lineHeight: 1 }}>
                    <div style={{ fontSize: isMiniPreview ? 9 : 12, fontWeight: 900, color: '#FFFFFF' }}>
                      {cfg.badgeText || 'HD'}
                    </div>
                    <div style={{ fontSize: 6, fontWeight: 700, color: '#BAE6FD' }}>LIVE</div>
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                backgroundColor: primary,
                borderRadius: 24,
                padding: isMiniPreview ? '4px 16px 4px 20px' : '6px 24px 6px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                zIndex: 2,
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <span
                style={{
                  fontSize: isMiniPreview ? 11 : 14,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                {cfg.speakerName}
              </span>
              {cfg.speakerTitle && (
                <span style={{ fontSize: isMiniPreview ? 8 : 10, fontWeight: 700, color: '#93C5FD' }}>
                  • {cfg.speakerTitle}
                </span>
              )}
            </div>
          </div>

          {cfg.topicTitle && (
            <div
              style={{
                alignSelf: 'flex-start',
                marginLeft: cfg.badgeType !== 'none' ? (isMiniPreview ? 34 : 44) : 20,
                marginTop: -4,
                backgroundColor: secondary,
                borderRadius: '0 0 10px 10px',
                padding: isMiniPreview ? '2px 10px' : '3px 14px',
                fontSize: isMiniPreview ? 7 : 9,
                fontWeight: 700,
                color: '#FFFFFF',
                zIndex: 1,
                letterSpacing: '0.03em'
              }}
            >
              {cfg.topicTitle}
            </div>
          )}
        </div>
      )
    }

    // Template 4: Slanted Dynamic (Matches Image 2 Center)
    if (template === 'slanted_dynamic') {
      return (
        <div
          style={{
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))',
            transform: isMiniPreview ? 'scale(0.85)' : 'none',
            transformOrigin: 'bottom left',
            zIndex: 121
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              transform: 'skewX(-14deg)',
              background: primary,
              borderTop: `2px solid ${secondary}`,
              borderBottom: `2px solid ${secondary}`,
              padding: isMiniPreview ? '4px 12px' : '6px 18px',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', gap: 3, marginRight: 10, alignItems: 'center' }}>
              <div style={{ width: 3, height: 16, backgroundColor: secondary }} />
              <div style={{ width: 3, height: 16, backgroundColor: '#FFFFFF', opacity: 0.8 }} />
              <div style={{ width: 3, height: 16, backgroundColor: '#38BDF8' }} />
            </div>

            <div style={{ transform: 'skewX(14deg)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontSize: isMiniPreview ? 11 : 14,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase'
                  }}
                >
                  {cfg.speakerName}
                </span>
                {cfg.speakerTitle && (
                  <span style={{ fontSize: isMiniPreview ? 8 : 10, fontWeight: 700, color: '#38BDF8' }}>
                    {cfg.speakerTitle}
                  </span>
                )}
              </div>
              {cfg.topicTitle && (
                <span style={{ fontSize: isMiniPreview ? 8 : 10, fontWeight: 600, color: '#E2E8F0', marginTop: 1 }}>
                  {cfg.topicTitle}
                </span>
              )}
            </div>

            {cfg.badgeType === 'qr_code' && (
              <div
                style={{
                  transform: 'skewX(14deg)',
                  marginLeft: 12,
                  backgroundColor: '#FFF',
                  borderRadius: 4,
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    style={{
                      width: isMiniPreview ? 28 : 38,
                      height: isMiniPreview ? 28 : 38,
                      display: 'block'
                    }}
                  />
                ) : (
                  <QrCode size={isMiniPreview ? 20 : 28} color="#000" />
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Template 5: Gold Altar
    if (template === 'gold_altar') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))',
            transform: isMiniPreview ? 'scale(0.85)' : 'none',
            transformOrigin: 'bottom left',
            zIndex: 121
          }}
        >
          {cfg.badgeType !== 'none' && (
            <div
              style={{
                width: isMiniPreview ? 44 : 60,
                background: 'linear-gradient(135deg, #1C1917 0%, #0C0A09 100%)',
                border: '2px solid #F59E0B',
                borderRadius: '6px 0 0 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4
              }}
            >
              {cfg.badgeType === 'qr_code' ? (
                <div style={{ backgroundColor: '#ffffff', borderRadius: 4, padding: 2 }}>
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR"
                      style={{
                        width: isMiniPreview ? 32 : 44,
                        height: isMiniPreview ? 32 : 44,
                        display: 'block'
                      }}
                    />
                  ) : (
                    <QrCode size={isMiniPreview ? 22 : 32} color="#000" />
                  )}
                </div>
              ) : (
                <span style={{ fontSize: isMiniPreview ? 14 : 20 }}>✝️</span>
              )}
            </div>
          )}

          <div
            style={{
              background:
                'linear-gradient(90deg, rgba(12, 10, 9, 0.96) 0%, rgba(28, 25, 23, 0.92) 80%, rgba(12, 10, 9, 0.85) 100%)',
              borderTop: '2px solid #F59E0B',
              borderBottom: '2px solid #D97706',
              borderRight: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: cfg.badgeType === 'none' ? 6 : '0 6px 6px 0',
              padding: isMiniPreview ? '4px 12px' : '6px 18px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: isMiniPreview ? 11 : 14,
                  fontWeight: 900,
                  color: '#FEF3C7',
                  letterSpacing: '0.04em'
                }}
              >
                {cfg.speakerName}
              </span>
              {cfg.speakerTitle && (
                <span
                  style={{
                    fontSize: isMiniPreview ? 8 : 10,
                    fontWeight: 700,
                    color: '#F59E0B',
                    textTransform: 'uppercase'
                  }}
                >
                  • {cfg.speakerTitle}
                </span>
              )}
            </div>
            {cfg.topicTitle && (
              <span style={{ fontSize: isMiniPreview ? 8 : 10, color: '#D6D3D1', marginTop: 1, fontWeight: 500 }}>
                {cfg.topicTitle}
              </span>
            )}
          </div>
        </div>
      )
    }

    // Template 6: Custom Imported Vector (EPS / SVG / PNG)
    const matchedCustom = customBanners.find((b) => b.id === template)
    const customGraphic =
      overrideConfig && overrideConfig.customGraphicUrl !== undefined
        ? overrideConfig.customGraphicUrl
        : matchedCustom?.graphicUrl || (cfg.template === template ? cfg.customGraphicUrl : '') || ''

    return (
      <div
        style={{
          position: 'relative',
          filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.65))',
          transform: isMiniPreview ? 'scale(0.85)' : 'none',
          transformOrigin: 'bottom left',
          zIndex: 121,
          display: 'inline-flex'
        }}
      >
        {customGraphic && customGraphic.length > 20 ? (
          <img
            src={customGraphic}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none'
            }}
            style={{ height: isMiniPreview ? 46 : 64, objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div
            style={{
              minWidth: isMiniPreview ? 200 : 280,
              height: isMiniPreview ? 42 : 56,
              background: 'linear-gradient(90deg, #0F172A 0%, #1E293B 100%)',
              borderRadius: 6,
              border: '1px solid #38BDF8',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px'
            }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 10
          }}
        >
          {cfg.badgeType === 'qr_code' && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 4,
                padding: 2,
                display: 'flex',
                flexShrink: 0
              }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR"
                  style={{
                    width: isMiniPreview ? 28 : 40,
                    height: isMiniPreview ? 28 : 40,
                    display: 'block'
                  }}
                />
              ) : (
                <QrCode size={isMiniPreview ? 20 : 28} color="#000" />
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontSize: isMiniPreview ? 11 : 14,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  textShadow: '0 2px 4px #000'
                }}
              >
                {cfg.speakerName}
              </span>
              {cfg.speakerTitle && (
                <span
                  style={{
                    fontSize: isMiniPreview ? 8 : 10,
                    fontWeight: 700,
                    color: cfg.secondaryColor || '#FF7A00',
                    textShadow: '0 1px 3px #000'
                  }}
                >
                  • {cfg.speakerTitle}
                </span>
              )}
            </div>
            {cfg.topicTitle && (
              <span style={{ fontSize: isMiniPreview ? 8 : 10, color: '#E2E8F0', textShadow: '0 1px 3px #000' }}>
                {cfg.topicTitle}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Helper to render Lower Thirds, Tickers, QR and Live Bug Overlays
  const renderOverlaysLayer = () => {
    const l3Style = overlays.lowerThird.style
    const accentColor =
      l3Style === 'blue_accent'
        ? '#38BDF8'
        : l3Style === 'gold_accent'
        ? '#F59E0B'
        : l3Style === 'modern_dark'
        ? '#A855F7'
        : '#FF7A00'

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 120,
          overflow: 'hidden'
        }}
      >
        {/* Live Bug / Mosca "EN VIVO" */}
        {overlays.liveBug.enabled && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 10,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(239, 68, 68, 0.6)',
              borderRadius: 4,
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              zIndex: 125,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                boxShadow: '0 0 6px #ef4444',
                animation: 'studio-pulse-dot 1.4s infinite ease-in-out'
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.08em' }}>
              {overlays.liveBug.text || 'EN VIVO'}
            </span>
          </div>
        )}

        {/* QR Code Overlay (Offerings / Tithes / Prayer) */}
        {overlays.qrCode.enabled && overlays.qrCode.qrDataUrl && (
          <div
            style={{
              position: 'absolute',
              ...(overlays.qrCode.position === 'top-left'
                ? { top: 8, left: 10 }
                : overlays.qrCode.position === 'top-right'
                ? { top: overlays.liveBug.enabled ? 36 : 8, right: 10 }
                : overlays.qrCode.position === 'bottom-right'
                ? { bottom: overlays.ticker.enabled ? 32 : 10, right: 10 }
                : { bottom: overlays.ticker.enabled ? 32 : 10, left: 10 }),
              backgroundColor: 'rgba(10, 12, 16, 0.92)',
              backdropFilter: 'blur(6px)',
              border: `1px solid ${accentColor}`,
              borderRadius: 6,
              padding: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              zIndex: 122,
              boxShadow: '0 4px 14px rgba(0,0,0,0.7)'
            }}
          >
            <div style={{ backgroundColor: '#ffffff', borderRadius: 4, padding: 3, display: 'flex' }}>
              <img src={overlays.qrCode.qrDataUrl} alt="QR Code" style={{ width: 56, height: 56, display: 'block' }} />
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: '#f3f4f6',
                maxWidth: 80,
                textAlign: 'center',
                lineHeight: 1.1,
                textShadow: '0 1px 2px #000'
              }}
            >
              {overlays.qrCode.title || 'Escanear QR'}
            </span>
          </div>
        )}

        {/* Lower Third (Rótulo de Orador / Zócalo Fijo) */}
        {overlays.lowerThird.enabled && (
          <div
            style={{
              position: 'absolute',
              bottom: overlays.ticker.enabled ? 30 : 12,
              left: 14,
              animation: 'studio-lowerthird-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              zIndex: 121
            }}
          >
            {renderLowerThirdBanner()}
          </div>
        )}

        {/* Ticker / Marquesina Inferior en Movimiento */}
        {overlays.ticker.enabled && overlays.ticker.text && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 24,
              backgroundColor: 'rgba(5, 7, 10, 0.94)',
              borderTop: `1px solid ${accentColor}`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              zIndex: 123
            }}
          >
            <div
              style={{
                backgroundColor: accentColor,
                color: '#000000',
                fontSize: 9,
                fontWeight: 900,
                padding: '2px 8px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                letterSpacing: '0.08em',
                zIndex: 2,
                flexShrink: 0
              }}
            >
              ANUNCIOS
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                  animation: `studio-marquee ${
                    overlays.ticker.speed === 'slow' ? '45s' : overlays.ticker.speed === 'fast' ? '18s' : '28s'
                  } linear infinite`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#FFFFFF'
                }}
              >
                {overlays.ticker.text} &nbsp;&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;&nbsp; {overlays.ticker.text}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="broadcast-studio-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0A0A0A',
        color: '#FFFFFF',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Top Bar: Telemetry & Broadcast Control Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#121212',
          borderBottom: '1px solid #222222'
        }}
      >
        {/* Left: Studio Title & Hardware Isolation Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={18} color="#FF7A00" />
            <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.05em' }}>
              ESTUDIO DE TRANSMISIÓN
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 11,
              color: '#4ade80'
            }}
            title="Aislamiento total garantizado: La transmisión por internet nunca bloquea las pantallas de la iglesia"
          >
            <ShieldCheck size={13} color="#22c55e" />
            <span>Salidas de Proyección Aisladas</span>
          </div>
        </div>

        {/* Center: Live Telemetry Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Stream Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: status.isStreaming ? 'rgba(239, 68, 68, 0.2)' : '#181818',
              border: status.isStreaming ? '1px solid #ef4444' : '1px solid #2E2E2E',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              color: status.isStreaming ? '#ef4444' : '#9CA3AF'
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: status.isStreaming
                  ? '#ef4444'
                  : status.connectionState === 'error'
                    ? '#dc2626'
                    : status.connectionState === 'reconnecting'
                      ? '#f59e0b'
                      : '#52525b',
                boxShadow: status.isStreaming ? '0 0 8px #ef4444' : 'none'
              }}
            />
            <span>
              {status.isStreaming
                ? 'EN VIVO'
                : status.connectionState === 'error'
                  ? 'ERROR STREAM'
                  : status.connectionState === 'reconnecting'
                    ? 'RECONECTANDO'
                    : 'STREAM OFF'}
            </span>
            {status.isStreaming && <span style={{ color: '#FFFFFF' }}>{status.formattedTime}</span>}
          </div>

          {/* Record Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: status.isRecording ? 'rgba(255, 122, 0, 0.18)' : '#181818',
              border: status.isRecording ? '1px solid #FF7A00' : '1px solid #2E2E2E',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              color: status.isRecording ? '#FF7A00' : '#9CA3AF'
            }}
          >
            <HardDrive size={13} color={status.isRecording ? '#FF7A00' : '#71717a'} />
            <span>{status.isRecording ? 'REC' : 'REC OFF'}</span>
          </div>

          {/* Telemetry Bitrate, Capture FPS, Output FPS, Drops & Encoder */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#9CA3AF' }}>
            <span style={{ color: status.bitrateKbps > 0 ? '#38BDF8' : '#71717a', fontWeight: 600 }} title="Bitrate actual enviado a YouTube">
              {status.bitrateKbps > 0
                ? `${Math.round(status.bitrateKbps)} kbps`
                : status.isStreaming
                  ? '0 kbps'
                  : '-- kbps'}
            </span>
            <span title="FPS reales de captura de escena ingresados a FFmpeg">
              Captura:{' '}
              <strong style={{ color: captureFps >= 25 ? '#4ADE80' : captureFps > 0 ? '#FBBF24' : '#71717A' }}>
                {captureFps > 0 ? `${captureFps.toFixed(1)}` : (status.isStreaming ? '30.0' : '--')}
              </strong>{' '}
              FPS
            </span>
            <span title="FPS de salida codificados por FFmpeg y transmitidos a YouTube">
              Salida:{' '}
              <strong style={{ color: status.fps >= 25 ? '#4ADE80' : status.fps > 0 ? '#FBBF24' : '#71717A' }}>
                {status.fps > 0 ? `${status.fps.toFixed(1)}` : (status.isStreaming ? '0.0' : '--')}
              </strong>{' '}
              FPS
            </span>
            <span title="Fotogramas perdidos acumulados reportados por FFmpeg">
              Caídas:{' '}
              <strong style={{ color: status.droppedFrames > 0 ? '#ef4444' : '#22c55e' }}>
                {status.droppedFrames}
              </strong>
            </span>
            <span
              style={{
                backgroundColor: status.encoderUsed === 'nvenc' ? '#14532d' : '#1C1C1C',
                border: status.encoderUsed === 'nvenc' ? '1px solid #22c55e' : '1px solid #3F3F46',
                padding: '2px 6px',
                borderRadius: 4,
                color: status.encoderUsed === 'nvenc' ? '#86efac' : '#D1D5DB',
                fontWeight: 600
              }}
            >
              {status.encoderUsed === 'nvenc'
                ? 'NVENC (GPU Hardware)'
                : status.encoderUsed === 'x264'
                  ? 'libx264 (CPU)'
                  : 'Listo'}
            </span>
            {status.diskFreeFormatted && (
              <span style={{ color: '#9CA3AF', fontSize: 11 }} title="Espacio libre en disco para grabaciones">
                💾 {status.diskFreeFormatted}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions (Stream, Record, OBS, Settings) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status.isStreaming ? (
            <button
              type="button"
              onClick={() => triggerActionWithConfirm('stop_stream')}
              style={{
                backgroundColor: '#ef4444',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Square size={13} /> Detener Transmisión
            </button>
          ) : (
            <button
              type="button"
              onClick={() => triggerActionWithConfirm('start_stream')}
              style={{
                backgroundColor: '#FF7A00',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 6px rgba(255, 122, 0, 0.4)'
              }}
            >
              <Radio size={13} /> Transmitir en Vivo
            </button>
          )}

          {status.isRecording ? (
            <button
              type="button"
              onClick={() => triggerActionWithConfirm('stop_record')}
              style={{
                backgroundColor: '#27272a',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Detener Grabación
            </button>
          ) : (
            <button
              type="button"
              onClick={() => triggerActionWithConfirm('start_record')}
              style={{
                backgroundColor: '#1E1E1E',
                color: '#D1D5DB',
                border: '1px solid #3F3F46',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Grabar Local
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            title="Configurar RTMP, resolución y claves"
            style={{
              backgroundColor: '#1E1E1E',
              color: '#D1D5DB',
              border: '1px solid #2E2E2E',
              borderRadius: 6,
              padding: '6px 8px',
              cursor: 'pointer'
            }}
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Stream Error Alert Banner */}
      {status.connectionState === 'error' && status.errorMessage && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: 6,
            margin: '0 12px 10px 12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fca5a5',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span>Error de Transmisión: {status.errorMessage}</span>
          </div>
        </div>
      )}

      {/* Bitrate Drop Warning Alert Banner */}
      {status.qualityWarning && (
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            border: '1px solid #f59e0b',
            borderRadius: 6,
            margin: '0 12px 10px 12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fde68a',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <span>{status.qualityWarning}</span>
          </div>
        </div>
      )}

      {/* Disconnect Fallback Alert Banner */}
      {disconnectedAlert && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: 6,
            margin: '0 12px 10px 12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fca5a5',
            fontSize: 12,
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span>{disconnectedAlert}</span>
          </div>
          <button
            type="button"
            onClick={() => setDisconnectedAlert(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 13 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Viewport (Upper Half): Split Monitors & Transitions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px 1fr',
          gap: 12,
          padding: 12,
          backgroundColor: '#0F0F0F',
          borderBottom: '1px solid #222222',
          flex: '0 0 auto',
          minHeight: 280
        }}
      >
        {/* PREVIEW Monitor (Left) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#38BDF8' }} />
              PREVIO (PREVIEW)
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{activePreviewScene?.name}</span>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              paddingTop: '56.25%', // 16:9 aspect ratio
              backgroundColor: '#000000',
              borderRadius: 8,
              border: '2px solid #38BDF8',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.15)'
            }}
          >
            {/* Layers Rendering in Preview with Interactive Drag & Resize */}
            <div ref={previewContainerRef} style={{ position: 'absolute', inset: 0, userSelect: 'none' }}>
              {activePreviewScene?.layers.map((layer, idx) => {
                if (layer.visible === false) return null
                const isSelected = selectedLayerIndex === idx

                return (
                  <div
                    key={layer.id}
                    onMouseDown={(e) => startLayerInteraction(e, 'move', idx)}
                    style={{
                      position: 'absolute',
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.width}%`,
                      height: `${layer.height}%`,
                      opacity: layer.opacity,
                      zIndex: isSelected ? 50 : (layer.zIndex || idx + 1),
                      border: isSelected ? '2px dashed #38BDF8' : '1px solid rgba(255,255,255,0.15)',
                      boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.45)' : 'none',
                      cursor: isSelected ? 'move' : 'pointer',
                      userSelect: 'none',
                      boxSizing: 'border-box'
                    }}
                    title={isSelected ? 'Arrastra para mover o usa las esquinas para redimensionar' : `Clic para seleccionar capa "${layer.name}"`}
                  >
                    {/* Inner Content (clipped) */}
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: layer.type === 'phone_camera' ? '#000000' : layer.type === 'video_device' ? '#1c2438' : layer.type === 'presentation' ? 'rgba(0,0,0,0.6)' : '#181818',
                        pointerEvents: 'none'
                      }}
                    >
                      {renderLayerInner(layer, false)}
                    </div>

                    {/* Resize Handles and Info Badge when selected */}
                    {isSelected && (
                      <>
                        {/* Live Coordinates Tooltip */}
                        <div
                          style={{
                            position: 'absolute',
                            top: -20,
                            left: 0,
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            zIndex: 40,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                          }}
                        >
                          {layer.name} ({layer.x}%, {layer.y}%) • {layer.width}x{layer.height}%
                        </div>

                        {/* 4 Corners */}
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'nw', idx)}
                          style={{ position: 'absolute', top: -5, left: -5, width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'nwse-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar esquina superior izquierda"
                        />
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'ne', idx)}
                          style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'nesw-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar esquina superior derecha"
                        />
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'sw', idx)}
                          style={{ position: 'absolute', bottom: -5, left: -5, width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'nesw-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar esquina inferior izquierda"
                        />
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'se', idx)}
                          style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'nwse-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar esquina inferior derecha"
                        />

                        {/* 4 Edges */}
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'n', idx)}
                          style={{ position: 'absolute', top: -5, left: 'calc(50% - 5px)', width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'ns-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar arriba"
                        />
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 's', idx)}
                          style={{ position: 'absolute', bottom: -5, left: 'calc(50% - 5px)', width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'ns-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar abajo"
                        />
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'w', idx)}
                          style={{ position: 'absolute', top: 'calc(50% - 5px)', left: -5, width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'ew-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar izquierda"
                        />
                        <div
                          onMouseDown={(e) => startLayerInteraction(e, 'e', idx)}
                          style={{ position: 'absolute', top: 'calc(50% - 5px)', right: -5, width: 10, height: 10, backgroundColor: '#38BDF8', border: '2px solid #FFFFFF', borderRadius: 2, cursor: 'ew-resize', zIndex: 40, pointerEvents: 'auto' }}
                          title="Redimensionar derecha"
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Overlays preview on top of Preview Monitor */}
            {renderOverlaysLayer()}
          </div>
        </div>

        {/* Central Transition Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '10px 0'
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>TRANSICIÓN</span>

          {/* CUT Button */}
          <button
            type="button"
            onClick={handleCutTransition}
            style={{
              width: '100%',
              backgroundColor: '#1E1E1E',
              border: '1px solid #3F3F46',
              color: '#FFFFFF',
              borderRadius: 6,
              padding: '10px 0',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            CORTE <ArrowRight size={14} color="#38BDF8" />
          </button>

          {/* FADE / SELECTED TRANSITION Button */}
          <button
            type="button"
            onClick={handleExecuteTransition}
            disabled={isTransitioning}
            style={{
              width: '100%',
              backgroundColor: '#FF7A00',
              border: 'none',
              color: '#FFFFFF',
              borderRadius: 6,
              padding: '10px 6px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(255, 122, 0, 0.4)',
              opacity: isTransitioning ? 0.6 : 1
            }}
            title={`Ejecutar transición activa: ${TRANSITION_PRESETS.find((p) => p.id === selectedTransition)?.name}`}
          >
            <span>{TRANSITION_PRESETS.find((p) => p.id === selectedTransition)?.icon || '✨'}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {TRANSITION_PRESETS.find((p) => p.id === selectedTransition)?.name.split(' ')[0].toUpperCase() || 'FUNDIDO'}
            </span>
            <ArrowRight size={13} />
          </button>

          {/* Transition Duration Slider */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
            <span style={{ fontSize: 10, color: '#9CA3AF' }}>Duración: {transitionDuration}ms</span>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={transitionDuration}
              onChange={(e) => setTransitionDuration(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#FF7A00' }}
            />
          </div>
        </div>

        {/* PROGRAM Monitor (Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
              PROGRAMA (EN EL AIRE)
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>{activeProgramScene?.name}</span>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              paddingTop: '56.25%', // 16:9 aspect ratio
              backgroundColor: '#000000',
              borderRadius: 8,
              border: '2px solid #ef4444',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
            }}
          >
            {/* Outgoing Scene (only rendered during active transition animation) */}
            {isTransitioning && outgoingScene && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  animation: getTransitionAnimation(selectedTransition, false),
                  zIndex: selectedTransition === 'wipe-left' || selectedTransition === 'wipe-right' ? 1 : 2
                }}
              >
                {outgoingScene.layers.map((layer) => {
                  if (layer.visible === false) return null
                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: 'absolute',
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        width: `${layer.width}%`,
                        height: `${layer.height}%`,
                        opacity: layer.opacity,
                        zIndex: layer.zIndex,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          layer.type === 'phone_camera'
                            ? '#000000'
                            : layer.type === 'video_device'
                            ? '#1c2438'
                            : layer.type === 'presentation'
                            ? 'rgba(0,0,0,0.6)'
                            : '#181818',
                        overflow: 'hidden'
                      }}
                    >
                      {renderLayerInner(layer, true)}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Incoming / Active Program Scene */}
            <div
              id="broadcast-program-monitor-layers"
              style={{
                position: 'absolute',
                inset: 0,
                ...(isTransitioning
                  ? {
                      animation: getTransitionAnimation(selectedTransition, true),
                      zIndex: selectedTransition === 'wipe-left' || selectedTransition === 'wipe-right' ? 2 : 1
                    }
                  : {})
              }}
            >
              {activeProgramScene?.layers.map((layer) => {
                if (layer.visible === false) return null
                return (
                  <div
                    key={layer.id}
                    className="program-layer-item"
                    data-x={layer.x}
                    data-y={layer.y}
                    data-w={layer.width}
                    data-h={layer.height}
                    data-opacity={layer.opacity}
                    style={{
                      position: 'absolute',
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.width}%`,
                      height: `${layer.height}%`,
                      opacity: layer.opacity,
                      zIndex: layer.zIndex,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        layer.type === 'phone_camera'
                          ? '#000000'
                          : layer.type === 'video_device'
                          ? '#1c2438'
                          : layer.type === 'presentation'
                          ? 'rgba(0,0,0,0.6)'
                          : '#181818',
                      overflow: 'hidden'
                    }}
                  >
                    {renderLayerInner(layer, true)}
                  </div>
                )
              })}
            </div>

            {/* Live Overlays (Lower Thirds, Tickers, QR, Live Bug) rendered on Program Output */}
            {renderOverlaysLayer()}
          </div>
        </div>
      </div>

      {/* Lower Workspace (Bottom Half): Scenes, Layer Editor, Audio Mixer */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 340px',
          gap: 12,
          padding: 12,
          flex: '1 1 auto',
          overflow: 'hidden'
        }}
      >
        {/* Panel 1: Scenes List */}
        <div
          style={{
            backgroundColor: '#121212',
            border: '1px solid #222222',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #222222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#161616'
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#D1D5DB', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} color="#FF7A00" /> ESCENAS ({scenes.length})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={handleCreateScene}
                title="Nueva Escena"
                style={{
                  background: '#222',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: 4,
                  cursor: 'pointer',
                  color: '#FFF'
                }}
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={handleDuplicateScene}
                title="Duplicar Escena"
                style={{
                  background: '#222',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: 4,
                  cursor: 'pointer',
                  color: '#FFF'
                }}
              >
                <Copy size={13} />
              </button>
              <button
                type="button"
                onClick={handleDeleteScene}
                disabled={scenes.length <= 1}
                title="Eliminar Escena"
                style={{
                  background: '#222',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: 4,
                  cursor: 'pointer',
                  color: '#ef4444',
                  opacity: scenes.length <= 1 ? 0.4 : 1
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div style={{ padding: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {scenes.map((scene) => {
              const isPreview = scene.id === previewSceneId
              const isProgram = scene.id === programSceneId
              return (
                <div
                  key={scene.id}
                  onClick={() => setPreviewSceneId(scene.id)}
                  style={{
                    backgroundColor: isProgram ? 'rgba(239, 68, 68, 0.15)' : isPreview ? 'rgba(56, 189, 248, 0.12)' : '#181818',
                    border: isProgram ? '1px solid #ef4444' : isPreview ? '1px solid #38BDF8' : '1px solid #282828',
                    borderRadius: 6,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF' }}>{scene.name}</span>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{scene.layers.length} capas</span>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    {isPreview && (
                      <span style={{ backgroundColor: '#38BDF8', color: '#000', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 3 }}>
                        PREV
                      </span>
                    )}
                    {isProgram && (
                      <span style={{ backgroundColor: '#ef4444', color: '#FFF', fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 3 }}>
                        PROG
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel 2: Layers & Source Inspector for Active Preview Scene */}
        <div
          style={{
            backgroundColor: '#121212',
            border: '1px solid #222222',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #222222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#161616'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setSourcesTab('layers')}
                style={{
                  backgroundColor: sourcesTab === 'layers' ? '#38BDF8' : '#222',
                  color: sourcesTab === 'layers' ? '#000' : '#D1D5DB',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Capas ({activePreviewScene?.layers.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSourcesTab('phone_cameras')}
                style={{
                  backgroundColor: sourcesTab === 'phone_cameras' ? '#00D2FF' : '#222',
                  color: sourcesTab === 'phone_cameras' ? '#000' : '#D1D5DB',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Smartphone size={12} /> Móviles ({phoneCameras.length})
              </button>
              <button
                type="button"
                onClick={() => setSourcesTab('transitions')}
                style={{
                  backgroundColor: sourcesTab === 'transitions' ? '#FF7A00' : '#222',
                  color: sourcesTab === 'transitions' ? '#000' : '#D1D5DB',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Configurar efecto de transición de video"
              >
                <Sparkles size={12} /> Transiciones
              </button>
              <button
                type="button"
                onClick={() => setSourcesTab('overlays')}
                style={{
                  backgroundColor: sourcesTab === 'overlays' ? '#A855F7' : '#222',
                  color: sourcesTab === 'overlays' ? '#000' : '#D1D5DB',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Banners, zócalos de orador, marquesina y código QR para ofrendas"
              >
                <Tag size={12} /> Banners y Objetos
                {(overlays.lowerThird.enabled || overlays.ticker.enabled || overlays.qrCode.enabled) && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                      boxShadow: '0 0 4px #22c55e'
                    }}
                    title="Hay superposiciones activas en vivo"
                  />
                )}
              </button>
            </div>

            {sourcesTab === 'layers' && (
              <button
                type="button"
                onClick={handleAddLayer}
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38BDF8',
                  color: '#38BDF8',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Plus size={12} /> Agregar Capa
              </button>
            )}
          </div>

          {sourcesTab === 'phone_cameras' ? (
            <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {phoneCameras.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B', fontSize: 12 }}>
                  <Smartphone size={32} color="#334155" style={{ marginBottom: 8 }} />
                  <div>No hay teléfonos conectados actualmente.</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    Abra Ajustes &gt; Cámaras para escanear el código QR con su teléfono.
                  </div>
                </div>
              ) : (
                phoneCameras.map((cam, camIdx) => {
                  const stream = cameraStreams[cam.id]
                  return (
                    <div
                      key={cam.id}
                      style={{
                        backgroundColor: '#181818',
                        border: '1px solid #282828',
                        borderRadius: 6,
                        padding: 10,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center'
                      }}
                    >
                      {/* Video Preview Thumbnail */}
                      <div style={{ width: 100, height: 56, backgroundColor: '#000', borderRadius: 4, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                        {stream ? (
                          <video
                            ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream }}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748B' }}>
                            Sin Video
                          </div>
                        )}
                        <span style={{ position: 'absolute', top: 2, left: 2, backgroundColor: 'rgba(0,0,0,0.7)', color: '#00D2FF', fontSize: 9, padding: '1px 4px', borderRadius: 2 }}>
                          CAM {camIdx + 1}
                        </span>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ fontSize: 12, color: '#FFFFFF' }}>{cam.name}</strong>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 10,
                              backgroundColor: cam.isStreaming ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: cam.isStreaming ? '#4ADE80' : '#FCA5A5'
                            }}
                          >
                            {cam.isStreaming ? 'Transmitiendo' : 'Conectada'}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, display: 'flex', gap: 10 }}>
                          <span>{cam.actualFps > 0 ? `${cam.actualFps} FPS` : '30 FPS'}</span>
                          <span>{cam.bitrateKbps > 0 ? `${cam.bitrateKbps} kbps` : '720p'}</span>
                          {cam.batteryLevel !== null && <span>🔋 {cam.batteryLevel}% {cam.isCharging ? '⚡' : ''}</span>}
                        </div>
                      </div>

                      {/* Controls */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => cameraReceiverService.toggleAudio(cam.id, !cam.audioMuted)}
                          title={cam.audioMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                          style={{
                            backgroundColor: cam.audioMuted ? '#2A2A2A' : '#22C55E',
                            color: cam.audioMuted ? '#EF4444' : '#000',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {cam.audioMuted ? <MicOff size={13} /> : <Mic size={13} />}
                          <span>{cam.audioMuted ? 'MUTE' : 'ON'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddPhoneCameraLayer(cam)}
                          style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid #38BDF8',
                            color: '#38BDF8',
                            borderRadius: 4,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          + Añadir a Escena
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ) : sourcesTab === 'transitions' ? (
            <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={15} color="#FF7A00" /> Transición Activa: {TRANSITION_PRESETS.find((p) => p.id === selectedTransition)?.name}
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    Selecciona el efecto que se ejecutará al pulsar el botón naranja de FUNDIDO entre Previo y Programa.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExecuteTransition}
                  disabled={isTransitioning}
                  style={{
                    backgroundColor: '#FF7A00',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 6px rgba(255, 122, 0, 0.4)',
                    opacity: isTransitioning ? 0.6 : 1
                  }}
                >
                  <Play size={13} fill="#FFFFFF" /> Probar Transición Ahora
                </button>
              </div>

              {/* Filmora-Style Transition Search and Category Tabs */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: 'Todos los Efectos' },
                    { id: 'Corte y Fundido', label: 'Fundidos' },
                    { id: 'Deslizamientos', label: 'Deslizamientos' },
                    { id: 'Barridos y Persianas', label: 'Barridos y Persianas' },
                    { id: '3D y Zoom', label: '3D y Escala' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTransitionCategory(cat.id)}
                      style={{
                        backgroundColor: transitionCategory === cat.id ? '#FF7A00' : '#1C1C1E',
                        color: transitionCategory === cat.id ? '#000000' : '#A1A1AA',
                        border: transitionCategory === cat.id ? '1px solid #FF7A00' : '1px solid #2E2E32',
                        borderRadius: 20,
                        padding: '4px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', width: 220 }}>
                  <Search size={14} color="#6B7280" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={transitionSearch}
                    onChange={(e) => setTransitionSearch(e.target.value)}
                    placeholder="Buscar transición..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: '#121214',
                      border: '1px solid #27272A',
                      borderRadius: 6,
                      padding: '5px 10px 5px 30px',
                      color: '#FFFFFF',
                      fontSize: 12,
                      outline: 'none'
                    }}
                  />
                  {transitionSearch && (
                    <button
                      type="button"
                      onClick={() => setTransitionSearch('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Filmora-Style 16:9 Video Monitor Grid of Transition Presets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: 10 }}>
                {TRANSITION_PRESETS.filter((p) => {
                  const matchCat = transitionCategory === 'all' || p.category === transitionCategory
                  const matchQuery =
                    !transitionSearch ||
                    p.name.toLowerCase().includes(transitionSearch.toLowerCase()) ||
                    p.desc.toLowerCase().includes(transitionSearch.toLowerCase())
                  return matchCat && matchQuery
                }).map((preset) => {
                  const isSelected = selectedTransition === preset.id
                  return (
                    <div
                      key={preset.id}
                      onClick={() => setSelectedTransition(preset.id)}
                      style={{
                        backgroundColor: isSelected ? 'rgba(255, 122, 0, 0.12)' : '#12141C',
                        border: isSelected ? '2px solid #FF7A00' : '1px solid #1E293B',
                        borderRadius: 6,
                        padding: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                        position: 'relative',
                        boxShadow: isSelected ? '0 0 12px rgba(255, 122, 0, 0.35)' : 'none'
                      }}
                      title={`${preset.name}: ${preset.desc}`}
                    >
                      <TransitionDiagramThumbnail type={preset.id} isSelected={isSelected} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: isSelected ? 700 : 600, color: isSelected ? '#FF7A00' : '#E2E8F0', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preset.name}
                        </span>
                        {isSelected && <Check size={12} color="#FF7A00" />}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Transition Duration Settings */}
              <div style={{ backgroundColor: '#181818', border: '1px solid #282828', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#D1D5DB' }}>
                    Duración del Efecto: <strong style={{ color: '#FF7A00' }}>{transitionDuration} ms</strong>
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { label: '300ms (Rápido)', value: 300 },
                      { label: '500ms (Estándar)', value: 500 },
                      { label: '800ms (Suave)', value: 800 },
                      { label: '1200ms (Cine)', value: 1200 }
                    ].map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setTransitionDuration(d.value)}
                        style={{
                          backgroundColor: transitionDuration === d.value ? '#FF7A00' : '#222',
                          color: transitionDuration === d.value ? '#000' : '#D1D5DB',
                          border: 'none',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#FF7A00' }}
                />
              </div>
            </div>
          ) : sourcesTab === 'overlays' ? (
            <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={15} color="#A855F7" /> Banners, Objetos y Superposiciones en Vivo
                  </h4>
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#9CA3AF' }}>
                    Rótulos de orador (lower thirds), textos en movimiento (marquesina) y códigos QR para ofrendas directamente sobre la transmisión.
                  </p>
                </div>
              </div>

              {/* 1. VISUAL LOWER THIRD GALLERY & BANNER DESIGNER */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".eps,.svg,.png,.jpg,.jpeg,.webp"
                onChange={handleImportEpsFile}
                style={{ display: 'none' }}
              />

              <div
                style={{
                  backgroundColor: '#181818',
                  border: overlays.lowerThird.enabled ? '1px solid #FF7A00' : '1px solid #282828',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {/* Header with Title and Global Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Palette size={18} color="#FF7A00" />
                    <div>
                      <strong style={{ fontSize: 13, color: '#FFFFFF' }}>Banners y Zócalos de Transmisión (Lower Thirds)</strong>
                      <span style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>
                        Diseños visuales estilo televisión / streaming con recuadro para Código QR o Full HD
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('add_new')
                        fileInputRef.current?.click()
                      }}
                      style={{
                        backgroundColor: '#1E293B',
                        border: '1px solid #38BDF8',
                        color: '#38BDF8',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      title="Importa un archivo EPS o SVG y lo añade como un nuevo banner independiente a tu biblioteca"
                    >
                      <Upload size={13} /> + Añadir Banner a la Biblioteca (.EPS / .SVG)
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditingLowerThird(true)}
                      style={{
                        backgroundColor: '#27272A',
                        border: '1px solid #52525B',
                        color: '#F4F4F5',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Edit3 size={13} /> Personalizar Datos y Colores
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateOverlays({
                          lowerThird: { ...overlays.lowerThird, enabled: !overlays.lowerThird.enabled }
                        })
                      }
                      style={{
                        backgroundColor: overlays.lowerThird.enabled ? '#22C55E' : '#27272A',
                        color: overlays.lowerThird.enabled ? '#000000' : '#D1D5DB',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: overlays.lowerThird.enabled ? '0 0 10px rgba(34, 197, 94, 0.4)' : 'none'
                      }}
                    >
                      {overlays.lowerThird.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                      {overlays.lowerThird.enabled ? 'MOSTRAR EN VIVO' : 'OCULTAR'}
                    </button>
                  </div>
                </div>

                {/* VISUAL TEMPLATES GALLERY (The operator sees real visual banners as requested) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D1D5DB' }}>
                      Selecciona el Diseño del Banner:
                    </span>
                    {deletedTemplateIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreAllTemplates}
                        style={{
                          background: 'transparent',
                          border: '1px solid #3F3F46',
                          borderRadius: 4,
                          color: '#38BDF8',
                          fontSize: 10,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <RotateCcw size={10} /> Restaurar plantillas ocultas ({deletedTemplateIds.length})
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {activeBannerTemplates.map((tmpl) => {
                      const isSelected = overlays.lowerThird.template === tmpl.id
                      return (
                        <div
                          key={tmpl.id}
                          onClick={() => {
                            updateOverlays({
                              lowerThird: {
                                ...overlays.lowerThird,
                                template: tmpl.id,
                                primaryColor: tmpl.defaultPrimary,
                                secondaryColor: tmpl.defaultSecondary,
                                customGraphicUrl: tmpl.customGraphicUrl || '',
                                customGraphicName: tmpl.name
                              }
                            })
                          }}
                          style={{
                            backgroundColor: isSelected ? 'rgba(255, 122, 0, 0.12)' : '#111318',
                            border: isSelected ? '2px solid #FF7A00' : '1px solid #27272A',
                            borderRadius: 8,
                            padding: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <strong style={{ fontSize: 12, color: isSelected ? '#FF7A00' : '#FFFFFF' }}>{tmpl.name}</strong>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isSelected && (
                                <span style={{ backgroundColor: '#FF7A00', color: '#000', fontSize: 9, fontWeight: 900, padding: '1px 6px', borderRadius: 3 }}>
                                  ACTIVO
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteBannerTemplate(tmpl.id, e)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  borderRadius: 4,
                                  color: '#EF4444',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '2px 5px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 2
                                }}
                                title="Eliminar este banner de la lista"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>

                          {/* Miniature Live Broadcast Render of the template */}
                          <div
                            style={{
                              backgroundColor: '#000000',
                              border: '1px solid #1E222B',
                              borderRadius: 6,
                              padding: '10px 8px',
                              height: 68,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              overflow: 'hidden'
                            }}
                          >
                            {renderLowerThirdBanner(
                              {
                                template: tmpl.id,
                                primaryColor: tmpl.defaultPrimary,
                                secondaryColor: tmpl.defaultSecondary,
                                speakerName: overlays.lowerThird.speakerName || 'Pr. Juan Carlos Pérez',
                                speakerTitle: overlays.lowerThird.speakerTitle || 'Pastor Principal',
                                topicTitle: overlays.lowerThird.topicTitle || 'El Poder de la Fe',
                                customGraphicUrl: tmpl.customGraphicUrl || ''
                              },
                              true
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                              {tmpl.subtitle}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateOverlays({
                                    lowerThird: {
                                      ...overlays.lowerThird,
                                      template: tmpl.id,
                                      primaryColor: tmpl.defaultPrimary,
                                      secondaryColor: tmpl.defaultSecondary,
                                      customGraphicUrl: tmpl.customGraphicUrl || overlays.lowerThird.customGraphicUrl
                                    }
                                  })
                                  setIsEditingLowerThird(true)
                                }}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid #3F3F46',
                                  borderRadius: 4,
                                  color: '#38BDF8',
                                  fontSize: 9,
                                  padding: '2px 6px',
                                  cursor: 'pointer'
                                }}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteBannerTemplate(tmpl.id, e)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  borderRadius: 4,
                                  color: '#EF4444',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                                title="Eliminar este banner de la lista"
                              >
                                <Trash2 size={10} /> Eliminar
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Quick Inline Data Bar for Live Operation */}
                <div style={{ backgroundColor: '#111318', border: '1px solid #27272A', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D1D5DB' }}>Datos Rápidos en Vivo:</span>
                    {/* Badge Slot Quick Selector: QR Code vs HD / Text */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Recuadro Izquierdo (HD):</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateOverlays({
                            lowerThird: {
                              ...overlays.lowerThird,
                              badgeType: overlays.lowerThird.badgeType === 'qr_code' ? 'text_badge' : 'qr_code'
                            }
                          })
                        }
                        style={{
                          backgroundColor: overlays.lowerThird.badgeType === 'qr_code' ? '#0284C7' : '#27272A',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title="Pon el código QR dentro del recuadro lateral del banner para diezmos y ofrendas"
                      >
                        <QrCode size={12} />
                        {overlays.lowerThird.badgeType === 'qr_code' ? 'QR Activo en Recuadro' : 'Poner Código QR'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.5fr', gap: 8 }}>
                    <input
                      type="text"
                      value={overlays.lowerThird.speakerName}
                      onChange={(e) =>
                        updateOverlays({
                          lowerThird: { ...overlays.lowerThird, speakerName: e.target.value }
                        })
                      }
                      placeholder="Nombre del Orador"
                      style={{
                        backgroundColor: '#0B0C0E',
                        border: '1px solid #333',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: 11
                      }}
                      title="Nombre del Predicador"
                    />

                    <input
                      type="text"
                      value={overlays.lowerThird.speakerTitle}
                      onChange={(e) =>
                        updateOverlays({
                          lowerThird: { ...overlays.lowerThird, speakerTitle: e.target.value }
                        })
                      }
                      placeholder="Cargo / Rol (ej. Pastor Principal)"
                      style={{
                        backgroundColor: '#0B0C0E',
                        border: '1px solid #333',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: 11
                      }}
                      title="Cargo o Rol"
                    />

                    <input
                      type="text"
                      value={overlays.lowerThird.topicTitle}
                      onChange={(e) =>
                        updateOverlays({
                          lowerThird: { ...overlays.lowerThird, topicTitle: e.target.value }
                        })
                      }
                      placeholder="Tema del Sermón / Pasaje Bíblico"
                      style={{
                        backgroundColor: '#0B0C0E',
                        border: '1px solid #333',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: 11
                      }}
                      title="Tema del Sermón o Cita"
                    />
                  </div>
                </div>
              </div>

              {/* 2. TICKER (Marquesina en Movimiento) */}
              <div
                style={{
                  backgroundColor: '#181818',
                  border: overlays.ticker.enabled ? '1px solid #FF7A00' : '1px solid #282828',
                  borderRadius: 6,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={16} color="#38BDF8" />
                    <div>
                      <strong style={{ fontSize: 12, color: '#FFFFFF' }}>Marquesina de Anuncios / Ticker en Movimiento</strong>
                      <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block' }}>Texto animado que corre continuamente en la parte inferior de la transmisión</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateOverlays({
                        ticker: { ...overlays.ticker, enabled: !overlays.ticker.enabled }
                      })
                    }
                    style={{
                      backgroundColor: overlays.ticker.enabled ? '#22c55e' : '#27272a',
                      color: overlays.ticker.enabled ? '#000000' : '#D1D5DB',
                      border: 'none',
                      borderRadius: 4,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {overlays.ticker.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                    {overlays.ticker.enabled ? 'ACTIVAR EN VIVO' : 'DESACTIVAR'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>Velocidad:</span>
                  {[
                    { id: 'slow', label: 'Lenta (45s)' },
                    { id: 'normal', label: 'Normal (28s)' },
                    { id: 'fast', label: 'Rápida (18s)' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => updateOverlays({ ticker: { ...overlays.ticker, speed: s.id as any } })}
                      style={{
                        backgroundColor: overlays.ticker.speed === s.id ? '#38BDF8' : '#222',
                        color: overlays.ticker.speed === s.id ? '#000' : '#D1D5DB',
                        border: 'none',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#9CA3AF' }}>Mensaje de la Marquesina:</span>
                  <input
                    type="text"
                    value={overlays.ticker.text}
                    onChange={(e) => updateOverlays({ ticker: { ...overlays.ticker, text: e.target.value } })}
                    placeholder="Escribe los anuncios o versículos para la transmisión..."
                    style={{
                      backgroundColor: '#121212',
                      border: '1px solid #333',
                      borderRadius: 4,
                      padding: '6px 8px',
                      color: '#FFF',
                      fontSize: 11
                    }}
                  />
                </div>

                {/* Quick Presets for Ticker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#71717a' }}>Textos Rápidos:</span>
                  {[
                    { label: 'Bienvenida', text: 'Bienvenidos a nuestra transmisión en vivo • Culto de Adoración • Dios bendiga tu hogar' },
                    { label: 'Petición Oración', text: '¿Necesitas una oración? Escríbenos al WhatsApp de la iglesia o en los comentarios' },
                    { label: 'Cultos Semanales', text: 'Nuestros Horarios: Domingos 10:00 AM y Miércoles 7:30 PM • Te esperamos' }
                  ].map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => updateOverlays({ ticker: { ...overlays.ticker, text: t.text } })}
                      style={{
                        backgroundColor: '#222',
                        border: '1px solid #333',
                        color: '#38BDF8',
                        borderRadius: 3,
                        padding: '2px 6px',
                        fontSize: 9,
                        cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Live Preview Box */}
                <div style={{ backgroundColor: '#000', border: '1px solid #FF7A00', borderRadius: 4, height: 24, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                  <div style={{ backgroundColor: '#FF7A00', color: '#000', fontSize: 9, fontWeight: 900, padding: '2px 8px', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    ANUNCIOS
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        whiteSpace: 'nowrap',
                        animation: `studio-marquee ${
                          overlays.ticker.speed === 'slow' ? '45s' : overlays.ticker.speed === 'fast' ? '18s' : '28s'
                        } linear infinite`,
                        fontSize: 10,
                        color: '#FFF'
                      }}
                    >
                      {overlays.ticker.text} &nbsp;&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;&nbsp; {overlays.ticker.text}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. QR CODE (Diezmos, Ofrendas, Peticiones) */}
              <div
                style={{
                  backgroundColor: '#181818',
                  border: overlays.qrCode.enabled ? '1px solid #FF7A00' : '1px solid #282828',
                  borderRadius: 6,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QrCode size={16} color="#22c55e" />
                    <div>
                      <strong style={{ fontSize: 12, color: '#FFFFFF' }}>Código QR en Pantalla (Diezmos, Ofrendas y Enlaces)</strong>
                      <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block' }}>Muestra un QR escaneable con celular para donaciones en línea o WhatsApp de la iglesia</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateOverlays({
                        qrCode: { ...overlays.qrCode, enabled: !overlays.qrCode.enabled }
                      })
                    }
                    style={{
                      backgroundColor: overlays.qrCode.enabled ? '#22c55e' : '#27272a',
                      color: overlays.qrCode.enabled ? '#000000' : '#D1D5DB',
                      border: 'none',
                      borderRadius: 4,
                      padding: '5px 12px',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {overlays.qrCode.enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                    {overlays.qrCode.enabled ? 'MOSTRAR QR' : 'OCULTAR QR'}
                  </button>
                </div>

                {/* Quick Presets for QR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, color: '#71717a' }}>Plantillas Rápidas:</span>
                  {[
                    { label: '💰 Diezmos y Ofrendas (PayPal)', title: 'Diezmos y Ofrendas', url: 'https://paypal.me/iglesia' },
                    { label: '📱 Oración (WhatsApp)', title: 'Petición de Oración', url: 'https://wa.me/18001234567' },
                    { label: '🌐 Sitio Web / Redes', title: 'Visita nuestra Web', url: 'https://iglesia.org' }
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() =>
                        updateOverlays({
                          qrCode: { ...overlays.qrCode, title: p.title, url: p.url }
                        })
                      }
                      style={{
                        backgroundColor: '#222',
                        border: '1px solid #333',
                        color: '#22c55e',
                        borderRadius: 3,
                        padding: '2px 8px',
                        fontSize: 9,
                        cursor: 'pointer'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>Título sobre el QR:</span>
                    <input
                      type="text"
                      value={overlays.qrCode.title}
                      onChange={(e) =>
                        updateOverlays({
                          qrCode: { ...overlays.qrCode, title: e.target.value }
                        })
                      }
                      placeholder="Ej. Diezmos y Ofrendas"
                      style={{
                        backgroundColor: '#121212',
                        border: '1px solid #333',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: 11
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>Enlace / URL para el QR:</span>
                    <input
                      type="text"
                      value={overlays.qrCode.url}
                      onChange={(e) =>
                        updateOverlays({
                          qrCode: { ...overlays.qrCode, url: e.target.value }
                        })
                      }
                      placeholder="https://paypal.me/miiglesia o enlace Zelle/WhatsApp"
                      style={{
                        backgroundColor: '#121212',
                        border: '1px solid #333',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: 11
                      }}
                    />
                  </div>

                  {/* QR Preview Thumbnail */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>QR Generado:</span>
                    <div style={{ backgroundColor: '#FFF', padding: 3, borderRadius: 4, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {overlays.qrCode.qrDataUrl ? (
                        <img src={overlays.qrCode.qrDataUrl} alt="QR" style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <QrCode size={24} color="#000" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Position Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>Posición en Pantalla:</span>
                  {[
                    { id: 'bottom-left', label: '↙ Inferior Izq.' },
                    { id: 'bottom-right', label: '↘ Inferior Der.' },
                    { id: 'top-left', label: '↖ Superior Izq.' },
                    { id: 'top-right', label: '↗ Superior Der.' }
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() =>
                        updateOverlays({
                          qrCode: { ...overlays.qrCode, position: pos.id as any }
                        })
                      }
                      style={{
                        backgroundColor: overlays.qrCode.position === pos.id ? '#22c55e' : '#222',
                        color: overlays.qrCode.position === pos.id ? '#000' : '#D1D5DB',
                        border: 'none',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. MOSCA "EN VIVO" */}
              <div
                style={{
                  backgroundColor: '#181818',
                  border: overlays.liveBug.enabled ? '1px solid #ef4444' : '1px solid #282828',
                  borderRadius: 6,
                  padding: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <strong style={{ fontSize: 12, color: '#FFFFFF' }}>Mosca / Indicador "EN VIVO"</strong>
                  <input
                    type="text"
                    value={overlays.liveBug.text}
                    onChange={(e) => updateOverlays({ liveBug: { ...overlays.liveBug, text: e.target.value } })}
                    placeholder="EN VIVO"
                    style={{
                      backgroundColor: '#121212',
                      border: '1px solid #333',
                      borderRadius: 4,
                      padding: '3px 8px',
                      color: '#FFF',
                      fontSize: 11,
                      width: 120
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateOverlays({
                      liveBug: { ...overlays.liveBug, enabled: !overlays.liveBug.enabled }
                    })
                  }
                  style={{
                    backgroundColor: overlays.liveBug.enabled ? '#ef4444' : '#27272a',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {overlays.liveBug.enabled ? 'ACTIVO' : 'OCULTO'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', flex: 1, overflow: 'hidden' }}>
            {/* Layers List */}
            <div style={{ borderRight: '1px solid #222222', padding: 8, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activePreviewScene?.layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  onClick={() => setSelectedLayerIndex(idx)}
                  style={{
                    backgroundColor: selectedLayerIndex === idx ? 'rgba(56, 189, 248, 0.15)' : '#181818',
                    border: selectedLayerIndex === idx ? '1px solid #38BDF8' : '1px solid #282828',
                    borderRadius: 4,
                    padding: '5px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: layer.visible === false ? 0.45 : 1,
                    transition: 'opacity 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <button
                      type="button"
                      title={layer.visible === false ? 'Mostrar capa (Activar)' : 'Ocultar capa (Desactivar)'}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUpdateLayer(idx, { visible: layer.visible === false ? true : false })
                      }}
                      style={{ background: 'transparent', border: 'none', color: layer.visible === false ? '#6b7280' : '#38bdf8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      {layer.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: layer.visible === false ? '#9ca3af' : '#FFFFFF',
                        textDecoration: layer.visible === false ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {layer.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      type="button"
                      title="Traer capa al frente (Subir)"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveLayer(idx, -1)
                      }}
                      style={{ background: 'transparent', border: 'none', color: idx === 0 ? '#374151' : '#9ca3af', cursor: idx === 0 ? 'default' : 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      title="Enviar capa atrás (Bajar)"
                      disabled={idx === (activePreviewScene?.layers.length || 1) - 1}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveLayer(idx, 1)
                      }}
                      style={{ background: 'transparent', border: 'none', color: idx === (activePreviewScene?.layers.length || 1) - 1 ? '#374151' : '#9ca3af', cursor: idx === (activePreviewScene?.layers.length || 1) - 1 ? 'default' : 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      type="button"
                      title="Eliminar capa"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteLayer(idx)
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Layer Properties Inspector */}
            {activePreviewScene?.layers[selectedLayerIndex] ? (
              <div style={{ padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(() => {
                  const layer = activePreviewScene.layers[selectedLayerIndex]
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Nombre de la Capa:</span>
                          <input
                            type="text"
                            value={layer.name}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { name: e.target.value })}
                            style={{
                              backgroundColor: '#181818',
                              border: '1px solid #2E2E2E',
                              borderRadius: 4,
                              padding: '6px 8px',
                              color: '#FFF',
                              fontSize: 12
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Tipo de Fuente:</span>
                          <select
                            value={layer.type}
                            onChange={(e) => {
                              const newType = e.target.value as any
                              const defaultCam = phoneCameras.find((c) => c.isStreaming)?.id || phoneCameras[0]?.id || 'cam1'
                              handleUpdateLayer(selectedLayerIndex, {
                                type: newType,
                                ...(newType === 'phone_camera' && !layer.phoneCameraId ? { phoneCameraId: defaultCam } : {})
                              })
                            }}
                            style={{
                              backgroundColor: '#181818',
                              border: '1px solid #2E2E2E',
                              borderRadius: 4,
                              padding: '6px 8px',
                              color: '#FFF',
                              fontSize: 12
                            }}
                          >
                            <option value="presentation">Salida Presentación / Diapositivas</option>
                            <option value="video_device">Cámara o Tarjeta de Captura (Video)</option>
                            <option value="phone_camera">Cámara Móvil (OctoStream / RTMP)</option>
                            <option value="desktop_capture">Captura de Pantalla / Ventana</option>
                            <option value="media_file">Archivo Multimedia</option>
                            <option value="color">Fondo de Color Sólido</option>
                          </select>
                        </div>
                      </div>

                      {/* Device Selection if Phone Camera */}
                      {layer.type === 'phone_camera' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#00D2FF', fontWeight: 600 }}>
                            Teléfono Móvil Conectado (OctoStream):
                          </span>
                          <select
                            value={layer.phoneCameraId || (phoneCameras.find((c) => c.isStreaming)?.id) || (phoneCameras[0]?.id) || ''}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { phoneCameraId: e.target.value })}
                            style={{
                              backgroundColor: '#181818',
                              border: !layer.phoneCameraId ? '1px solid #FF7A00' : '1px solid #2E2E2E',
                              borderRadius: 4,
                              padding: '6px 8px',
                              color: '#FFF',
                              fontSize: 12
                            }}
                          >
                            <option value="">(Seleccione una cámara de teléfono)</option>
                            {phoneCameras.map((cam, camIdx) => (
                              <option key={cam.id} value={cam.id}>
                                Cámara {camIdx + 1}: {cam.name} ({cam.isStreaming ? 'Transmitiendo en Vivo' : 'Conectada'})
                              </option>
                            ))}
                          </select>
                          {!layer.phoneCameraId && phoneCameras.length > 0 && (
                            <span style={{ fontSize: 10, color: '#f59e0b' }}>
                              💡 Asignando automáticamente {phoneCameras.find((c) => c.isStreaming)?.name || phoneCameras[0]?.name}.
                            </span>
                          )}
                        </div>
                      )}

                      {/* Device Selection if Video Device */}
                      {layer.type === 'video_device' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#38BDF8' }}>Dispositivo de Video Físico:</span>
                          <select
                            value={layer.deviceId || ''}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { deviceId: e.target.value })}
                            style={{
                              backgroundColor: '#181818',
                              border: '1px solid #2E2E2E',
                              borderRadius: 4,
                              padding: '6px 8px',
                              color: '#FFF',
                              fontSize: 12
                            }}
                          >
                            <option value="">(Cámara predeterminada del sistema)</option>
                            {videoDevices.map((d) => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Cámara ${d.deviceId.slice(0, 8)}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Screen Selection if Desktop Capture */}
                      {layer.type === 'desktop_capture' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#38BDF8' }}>Pantalla o Ventana de Windows:</span>
                          <select
                            value={layer.deviceId || ''}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { deviceId: e.target.value })}
                            style={{
                              backgroundColor: '#181818',
                              border: '1px solid #2E2E2E',
                              borderRadius: 4,
                              padding: '6px 8px',
                              color: '#FFF',
                              fontSize: 12
                            }}
                          >
                            {desktopSources.map((ds) => (
                              <option key={ds.id} value={ds.id}>
                                {ds.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Media File Upload and Selection if Media File */}
                      {layer.type === 'media_file' && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            backgroundColor: '#121214',
                            border: '1px solid #27272a',
                            borderRadius: 6,
                            padding: 10
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 11, color: '#38BDF8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Film size={14} /> Archivo Multimedia (Video / Imagen):
                            </span>
                            {layer.mediaUrl && (
                              <span style={{ fontSize: 10, color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                ✓ Cargado
                              </span>
                            )}
                          </div>

                          {layer.mediaUrl ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#18181b', padding: 8, borderRadius: 6, border: '1px solid #27272a' }}>
                              {layer.mediaType === 'video' || /\.(mp4|webm|mov|mkv)$/i.test(layer.mediaPath || layer.mediaUrl) ? (
                                <video src={layer.mediaUrl} style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 4, backgroundColor: '#000' }} muted />
                              ) : (
                                <img src={layer.mediaUrl} alt="Preview" style={{ width: 64, height: 42, objectFit: 'cover', borderRadius: 4, backgroundColor: '#000' }} />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {layer.mediaPath ? layer.mediaPath.split(/[/\\]/).pop() : layer.name}
                                </div>
                                <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                                  {layer.mediaType === 'video' || /\.(mp4|webm|mov|mkv)$/i.test(layer.mediaPath || layer.mediaUrl)
                                    ? 'Video en reproducción continua (Loop)'
                                    : 'Imagen gráfica fija'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.createElement('input')
                                    input.type = 'file'
                                    input.accept = 'video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif'
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0]
                                      if (file) {
                                        const isVid = file.type.startsWith('video')
                                        const url = URL.createObjectURL(file)
                                        handleUpdateLayer(selectedLayerIndex, {
                                          mediaUrl: url,
                                          mediaPath: file.name,
                                          mediaType: isVid ? 'video' : 'image',
                                          name: file.name
                                        })
                                      }
                                    }
                                    input.click()
                                  }}
                                  style={{
                                    backgroundColor: '#27272a',
                                    border: '1px solid #3f3f46',
                                    color: '#FFFFFF',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cambiar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateLayer(selectedLayerIndex, {
                                      mediaUrl: undefined,
                                      mediaPath: undefined,
                                      mediaType: undefined
                                    })
                                  }}
                                  style={{
                                    backgroundColor: '#27272a',
                                    border: '1px solid #ef4444',
                                    color: '#ef4444',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  const input = document.createElement('input')
                                  input.type = 'file'
                                  input.accept = 'video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp,image/gif'
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0]
                                    if (file) {
                                      const isVid = file.type.startsWith('video')
                                      const url = URL.createObjectURL(file)
                                      handleUpdateLayer(selectedLayerIndex, {
                                        mediaUrl: url,
                                        mediaPath: file.name,
                                        mediaType: isVid ? 'video' : 'image',
                                        name: file.name
                                      })
                                    }
                                  }
                                  input.click()
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                                  border: '1px dashed #38BDF8',
                                  color: '#38BDF8',
                                  padding: '12px',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease'
                                }}
                              >
                                <Upload size={16} /> Subir Video o Imagen para esta Capa
                              </button>
                              <span style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>
                                Formatos admitidos: MP4, WebM, MOV, JPG, PNG, GIF (reproducción en loop continuo)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Position and Size (X, Y, W, H %) */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Pos X (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={layer.x}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { x: Number(e.target.value) })}
                            style={{ backgroundColor: '#181818', border: '1px solid #2E2E2E', borderRadius: 4, padding: 4, color: '#FFF', fontSize: 11 }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Pos Y (%)</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={layer.y}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { y: Number(e.target.value) })}
                            style={{ backgroundColor: '#181818', border: '1px solid #2E2E2E', borderRadius: 4, padding: 4, color: '#FFF', fontSize: 11 }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Ancho (%)</span>
                          <input
                            type="number"
                            min="5"
                            max="100"
                            value={layer.width}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { width: Number(e.target.value) })}
                            style={{ backgroundColor: '#181818', border: '1px solid #2E2E2E', borderRadius: 4, padding: 4, color: '#FFF', fontSize: 11 }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Alto (%)</span>
                          <input
                            type="number"
                            min="5"
                            max="100"
                            value={layer.height}
                            onChange={(e) => handleUpdateLayer(selectedLayerIndex, { height: Number(e.target.value) })}
                            style={{ backgroundColor: '#181818', border: '1px solid #2E2E2E', borderRadius: 4, padding: 4, color: '#FFF', fontSize: 11 }}
                          />
                        </div>
                      </div>

                      {/* Quick PIP Presets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>Posiciones Rápidas (PIP):</span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateLayer(selectedLayerIndex, { x: 5, y: 5, width: 35, height: 35 })}
                            style={{ backgroundColor: '#1e222b', border: '1px solid #374151', borderRadius: 4, padding: '4px 2px', color: '#e5e7eb', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                            title="Superior Izquierda (35%)"
                          >
                            ↖ Sup. Izq.
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLayer(selectedLayerIndex, { x: 60, y: 5, width: 35, height: 35 })}
                            style={{ backgroundColor: '#1e222b', border: '1px solid #374151', borderRadius: 4, padding: '4px 2px', color: '#e5e7eb', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                            title="Superior Derecha (35%)"
                          >
                            ↗ Sup. Der.
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLayer(selectedLayerIndex, { x: 5, y: 60, width: 35, height: 35 })}
                            style={{ backgroundColor: '#1e222b', border: '1px solid #374151', borderRadius: 4, padding: '4px 2px', color: '#e5e7eb', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                            title="Inferior Izquierda (35%)"
                          >
                            ↙ Inf. Izq.
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLayer(selectedLayerIndex, { x: 60, y: 60, width: 35, height: 35 })}
                            style={{ backgroundColor: '#1e222b', border: '1px solid #374151', borderRadius: 4, padding: '4px 2px', color: '#e5e7eb', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                            title="Inferior Derecha (35%)"
                          >
                            ↘ Inf. Der.
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLayer(selectedLayerIndex, { x: 25, y: 25, width: 50, height: 50 })}
                            style={{ backgroundColor: '#1e222b', border: '1px solid #374151', borderRadius: 4, padding: '4px 2px', color: '#e5e7eb', fontSize: 10, cursor: 'pointer', textAlign: 'center' }}
                            title="Centrado (50%)"
                          >
                            🎯 Centrado
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateLayer(selectedLayerIndex, { x: 0, y: 0, width: 100, height: 100 })}
                            style={{ backgroundColor: '#0284c7', border: '1px solid #38bdf8', borderRadius: 4, padding: '4px 2px', color: '#ffffff', fontSize: 10, cursor: 'pointer', fontWeight: 600, textAlign: 'center' }}
                            title="Pantalla Completa (100%)"
                          >
                            ⛶ Completa
                          </button>
                        </div>
                      </div>

                      {/* Opacity slider */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: '#9CA3AF' }}>Opacidad:</span>
                          <span style={{ color: '#38BDF8' }}>{Math.round(layer.opacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={layer.opacity}
                          onChange={(e) => handleUpdateLayer(selectedLayerIndex, { opacity: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: '#38BDF8' }}
                        />
                      </div>
                    </>
                  )
                })()}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontSize: 12 }}>
                Selecciona una capa para editar
              </div>
            )}
          </div>
          )}
        </div>

        {/* Panel 3: Real Web Audio Mixer with Lip-Sync Delay & VU Meters */}
        <div
          style={{
            backgroundColor: '#121212',
            border: '1px solid #222222',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #222222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#161616'
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#D1D5DB', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Volume2 size={14} color="#22c55e" /> MEZCLADOR DE AUDIO
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: audioMixer.limiterEnabled ? '#22c55e' : '#71717a' }}>
                LIMITADOR
              </span>
              <button
                type="button"
                onClick={handleToggleMasterMute}
                style={{
                  background: audioMixer.masterMuted ? '#ef4444' : '#222',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '3px 6px',
                  color: '#FFF',
                  cursor: 'pointer'
                }}
                title={audioMixer.masterMuted ? 'Desmutear Master' : 'Silenciar Master'}
              >
                {audioMixer.masterMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
            </div>
          </div>

          <div style={{ padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {/* Audio Channels */}
            {audioMixer.sources.map((src) => {
              const level = vuLevels[src.id] || 0
              return (
                <div
                  key={src.id}
                  style={{
                    backgroundColor: '#181818',
                    border: '1px solid #262626',
                    borderRadius: 6,
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>{src.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {src.type !== 'presentation' && audioDevices.length > 0 && (
                        <select
                          value={src.deviceId || ''}
                          onChange={(e) => handleUpdateAudioSource(src.id, { deviceId: e.target.value })}
                          style={{
                            backgroundColor: '#121212',
                            border: '1px solid #2E2E2E',
                            borderRadius: 4,
                            padding: '2px 4px',
                            color: '#A1A1AA',
                            fontSize: 10,
                            maxWidth: 130
                          }}
                          title="Seleccionar micrófono o entrada de línea física"
                        >
                          <option value="">(Dispositivo por defecto)</option>
                          {audioDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Entrada ${d.deviceId.slice(0, 6)}`}
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
                          cursor: 'pointer'
                        }}
                      >
                        {src.muted ? 'MUTE' : 'ON'}
                      </button>
                    </div>
                  </div>

                  {/* Real AnalyserNode VU Peak Meter */}
                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      backgroundColor: '#0A0A0A',
                      borderRadius: 4,
                      overflow: 'hidden',
                      display: 'flex',
                      border: '1px solid #222'
                    }}
                  >
                    <div
                      style={{
                        width: src.muted ? '0%' : `${level}%`,
                        height: '100%',
                        backgroundColor: level > 85 ? '#ef4444' : level > 70 ? '#f59e0b' : '#22c55e',
                        transition: 'width 60ms ease-out'
                      }}
                    />
                  </div>

                  {/* Controls: Volume Slider & Lip-Sync Delay */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Compensación de retardo (Lip-Sync)">
                      <Clock size={11} color="#38BDF8" />
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        step="10"
                        value={src.delayMs}
                        onChange={(e) => handleUpdateAudioSource(src.id, { delayMs: Number(e.target.value) })}
                        style={{
                          width: 48,
                          backgroundColor: '#121212',
                          border: '1px solid #333',
                          borderRadius: 4,
                          padding: '2px 4px',
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
        </div>
      </div>

      {/* Banner & Lower Third Designer Modal */}
      {isEditingLowerThird && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
        >
          <div
            style={{
              width: 820,
              maxWidth: '95vw',
              maxHeight: '90vh',
              backgroundColor: '#14161C',
              border: '1px solid #2B303C',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #232732',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#191C24'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Palette size={20} color="#FF7A00" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>
                  Diseñador de Banners y Zócalos de Transmisión
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingLowerThird(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: 2 columns (Controls on Left, Live 1:1 Preview on Right) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 16,
                padding: 20,
                overflowY: 'auto',
                flex: 1
              }}
            >
              {/* Left Column: Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* 1. Template Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#D1D5DB' }}>
                      1. Estilo Visual del Banner:
                    </label>
                    {deletedTemplateIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRestoreAllTemplates}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#38BDF8',
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 4px'
                        }}
                        title="Restaurar estilos predeterminados ocultos"
                      >
                        <RotateCcw size={11} /> Restaurar eliminados ({deletedTemplateIds.length})
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                    {activeBannerTemplates.map((tmpl) => {
                      const isSel = overlays.lowerThird.template === tmpl.id
                      return (
                        <div
                          key={tmpl.id}
                          style={{
                            position: 'relative',
                            backgroundColor: isSel ? 'rgba(255, 122, 0, 0.15)' : '#191C24',
                            border: isSel ? '2px solid #FF7A00' : '1px solid #2B303C',
                            borderRadius: 6,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              updateOverlays({
                                lowerThird: {
                                  ...overlays.lowerThird,
                                  template: tmpl.id,
                                  primaryColor: tmpl.defaultPrimary,
                                  secondaryColor: tmpl.defaultSecondary,
                                  customGraphicUrl: tmpl.customGraphicUrl || '',
                                  customGraphicName: tmpl.name
                                }
                              })
                            }
                            style={{
                              width: '100%',
                              backgroundColor: 'transparent',
                              border: 'none',
                              padding: '8px 28px 8px 10px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <strong style={{ fontSize: 11, color: isSel ? '#FF7A00' : '#FFFFFF' }}>{tmpl.name}</strong>
                              {tmpl.isCustom && (
                                <span
                                  style={{
                                    fontSize: 8,
                                    backgroundColor: '#0284C7',
                                    color: '#FFF',
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                    fontWeight: 700
                                  }}
                                >
                                  IMPORTADO
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 9, color: '#9CA3AF', lineHeight: 1.2 }}>{tmpl.subtitle}</span>
                          </button>

                          {/* Delete Banner Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteBannerTemplate(tmpl.id, e)}
                            title="Eliminar este estilo de banner"
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              backgroundColor: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#EF4444'
                              e.currentTarget.style.color = '#FFFFFF'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'
                              e.currentTarget.style.color = '#EF4444'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 2. Speaker & Topic Information */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#D1D5DB' }}>
                    2. Datos del Orador y Sermón:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>Nombre del Predicador / Orador:</span>
                    <input
                      type="text"
                      value={overlays.lowerThird.speakerName}
                      onChange={(e) =>
                        updateOverlays({
                          lowerThird: { ...overlays.lowerThird, speakerName: e.target.value }
                        })
                      }
                      placeholder="Ej. Pr. Juan Carlos Pérez"
                      style={{
                        backgroundColor: '#0F1117',
                        border: '1px solid #2B303C',
                        borderRadius: 4,
                        padding: '6px 8px',
                        color: '#FFF',
                        fontSize: 12
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Cargo / Rol:</span>
                      <input
                        type="text"
                        value={overlays.lowerThird.speakerTitle}
                        onChange={(e) =>
                          updateOverlays({
                            lowerThird: { ...overlays.lowerThird, speakerTitle: e.target.value }
                          })
                        }
                        placeholder="Ej. Pastor Principal"
                        style={{
                          backgroundColor: '#0F1117',
                          border: '1px solid #2B303C',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#FFF',
                          fontSize: 12
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Tema / Pasaje Bíblico:</span>
                      <input
                        type="text"
                        value={overlays.lowerThird.topicTitle}
                        onChange={(e) =>
                          updateOverlays({
                            lowerThird: { ...overlays.lowerThird, topicTitle: e.target.value }
                          })
                        }
                        placeholder="Ej. El Poder de la Fe • Heb. 11:1"
                        style={{
                          backgroundColor: '#0F1117',
                          border: '1px solid #2B303C',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#FFF',
                          fontSize: 12
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Badge Slot Setting (Where "FULL HD" or "HD" is, or QR Code) */}
                <div style={{ backgroundColor: '#191C24', border: '1px solid #2B303C', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <QrCode size={14} /> 3. Recuadro Lateral (Espacio donde dice HD / QR):
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {[
                      { id: 'qr_code', label: 'Código QR' },
                      { id: 'church_logo', label: 'Logo Iglesia' },
                      { id: 'text_badge', label: 'Texto (HD/4K)' },
                      { id: 'none', label: 'Sin Recuadro' }
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() =>
                          updateOverlays({
                            lowerThird: { ...overlays.lowerThird, badgeType: b.id as any }
                          })
                        }
                        style={{
                          backgroundColor: overlays.lowerThird.badgeType === b.id ? '#0284C7' : '#14161C',
                          color: overlays.lowerThird.badgeType === b.id ? '#FFFFFF' : '#9CA3AF',
                          border: '1px solid #2B303C',
                          borderRadius: 4,
                          padding: '5px 4px',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {overlays.lowerThird.badgeType === 'qr_code' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                        URL o Enlace que abrirá el Código QR al escanear:
                      </span>
                      <input
                        type="text"
                        value={overlays.lowerThird.badgeQrUrl}
                        onChange={(e) =>
                          updateOverlays({
                            lowerThird: { ...overlays.lowerThird, badgeQrUrl: e.target.value }
                          })
                        }
                        placeholder="https://paypal.me/iglesia o enlace Zelle/WhatsApp"
                        style={{
                          backgroundColor: '#0F1117',
                          border: '1px solid #2B303C',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#22C55E',
                          fontSize: 11,
                          fontWeight: 600
                        }}
                      />
                      <span style={{ fontSize: 9, color: '#6EE7B7' }}>
                        ✓ El código QR se genera en alta resolución dentro del recuadro del banner.
                      </span>
                    </div>
                  )}

                  {overlays.lowerThird.badgeType === 'text_badge' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#9CA3AF' }}>Texto dentro de la insignia:</span>
                      <input
                        type="text"
                        value={overlays.lowerThird.badgeText}
                        onChange={(e) =>
                          updateOverlays({
                            lowerThird: { ...overlays.lowerThird, badgeText: e.target.value }
                          })
                        }
                        placeholder="HD, 4K, EN VIVO, PASTOR"
                        style={{
                          backgroundColor: '#0F1117',
                          border: '1px solid #2B303C',
                          borderRadius: 4,
                          padding: '6px 8px',
                          color: '#FFF',
                          fontSize: 11
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 4. Color Palette */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#D1D5DB' }}>
                    4. Paleta de Colores:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {[
                      { name: 'Azul & Cyan', p: '#0F172A', s: '#0284C7' },
                      { name: 'Noticiero TV', p: '#1E3A8A', s: '#DC2626' },
                      { name: 'Naranja Pro', p: '#14161C', s: '#FF7A00' },
                      { name: 'Oro & Ónix', p: '#0B0C0E', s: '#D97706' },
                      { name: 'Rojo & Plata', p: '#991B1B', s: '#E5E7EB' },
                      { name: 'Púrpura Neón', p: '#1E1B4B', s: '#EC4899' }
                    ].map((pal) => (
                      <button
                        key={pal.name}
                        type="button"
                        onClick={() =>
                          updateOverlays({
                            lowerThird: {
                              ...overlays.lowerThird,
                              primaryColor: pal.p,
                              secondaryColor: pal.s
                            }
                          })
                        }
                        style={{
                          backgroundColor: '#191C24',
                          border: '1px solid #2B303C',
                          borderRadius: 4,
                          padding: '5px 8px',
                          fontSize: 10,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          color: '#E5E7EB'
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pal.p }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pal.s }} />
                        <span>{pal.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Import Buttons: Add New to Library vs Replace Image */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode('add_new')
                      fileInputRef.current?.click()
                    }}
                    style={{
                      flex: 1,
                      minWidth: 180,
                      backgroundColor: '#1E293B',
                      border: '1px dashed #38BDF8',
                      color: '#38BDF8',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Upload size={14} /> + Añadir Nuevo Banner a la Biblioteca (.EPS, .SVG)
                  </button>

                  {overlays.lowerThird.template.startsWith('custom_') &&
                    overlays.lowerThird.template !== 'custom_imported' && (
                      <button
                        type="button"
                        onClick={() => {
                          setImportMode('replace_current')
                          fileInputRef.current?.click()
                        }}
                        title="Reemplaza el diseño gráfico de este banner seleccionado sin crear un nuevo elemento en la biblioteca"
                        style={{
                          backgroundColor: '#14161C',
                          border: '1px solid #4B5563',
                          color: '#D1D5DB',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4
                        }}
                      >
                        <RotateCcw size={12} /> Reemplazar imagen actual
                      </button>
                    )}
                </div>
              </div>

              {/* Right Column: Live 1:1 Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#D1D5DB' }}>
                  Vista Previa en Tiempo Real:
                </span>

                {/* Screen Mockup */}
                <div
                  style={{
                    width: '100%',
                    paddingTop: '56.25%',
                    backgroundColor: '#000000',
                    border: '2px solid #2B303C',
                    borderRadius: 8,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                  }}
                >
                  {/* Simulated Camera Feed Background */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.85
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#64748B' }}>[ Señal de Video / Cámara ]</span>
                  </div>

                  {/* Rendered Banner in Lower Position */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 14,
                      left: 14,
                      zIndex: 10
                    }}
                  >
                    {renderLowerThirdBanner()}
                  </div>
                </div>

                <div style={{ backgroundColor: '#191C24', border: '1px solid #2B303C', borderRadius: 6, padding: 10, fontSize: 11, color: '#9CA3AF', lineHeight: 1.4 }}>
                  <strong style={{ color: '#F3F4F6' }}>Consejo para cultos:</strong>
                  {overlays.lowerThird.badgeType === 'qr_code'
                    ? ' El código QR colocado en el recuadro permite que toda la congregación (presencial o en streaming) escanee con la cámara de su teléfono directamente en pantalla para diezmos, ofrendas o peticiones.'
                    : ' Puedes cambiar el recuadro a Código QR en cualquier momento seleccionando la opción Código QR en el paso 3.'}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #232732',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#191C24'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Estado actual:</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    backgroundColor: overlays.lowerThird.enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                    color: overlays.lowerThird.enabled ? '#4ADE80' : '#9CA3AF'
                  }}
                >
                  {overlays.lowerThird.enabled ? '● EN VIVO EN PANTALLA' : '○ OCULTO'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsEditingLowerThird(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid #3F3F46',
                    color: '#D1D5DB',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateOverlays({
                      lowerThird: { ...overlays.lowerThird, enabled: true }
                    })
                    setIsEditingLowerThird(false)
                  }}
                  style={{
                    backgroundColor: '#22C55E',
                    border: 'none',
                    color: '#000000',
                    borderRadius: 6,
                    padding: '8px 18px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.4)'
                  }}
                >
                  Guardar y Activar en Vivo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Broadcast Performance Diagnostic Modal (5s benchmark before YouTube Live) */}
      {preStreamCheck.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001
          }}
        >
          <div
            style={{
              width: 460,
              backgroundColor: '#181818',
              border: preStreamCheck.warning ? '1px solid #f59e0b' : '1px solid #3F3F46',
              borderRadius: 10,
              padding: 24,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {preStreamCheck.warning ? (
                <AlertTriangle size={24} color="#f59e0b" />
              ) : (
                <Radio size={24} color="#FF7A00" />
              )}
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                {preStreamCheck.warning
                  ? 'Advertencia de Rendimiento de Captura'
                  : 'Diagnóstico de Captura Pre-Transmisión'}
              </h3>
            </div>

            {preStreamCheck.isChecking && (
              <div>
                <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#D1D5DB', lineHeight: 1.5 }}>
                  Comprobando tasa de fotogramas (FPS) de la captura de video antes de iniciar la transmisión a YouTube...
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      backgroundColor: '#27272a',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${((5 - preStreamCheck.countdown) / 5) * 100}%`,
                        backgroundColor: '#FF7A00',
                        transition: 'width 0.9s linear'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FF7A00', minWidth: 28, textAlign: 'right' }}>
                    {preStreamCheck.countdown}s
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center' }}>
                  Renderizando fotogramas y validando estabilidad a 30 FPS...
                </div>
              </div>
            )}

            {preStreamCheck.warning && (
              <div>
                <div
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: 6,
                    padding: 12,
                    marginBottom: 20
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: '#fde68a', lineHeight: 1.5 }}>
                    Advertencia: la captura de video solo alcanza {preStreamCheck.measuredFps?.toFixed(1) || '0.0'} FPS. La transmisión puede tener interrupciones.
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={cancelPreStreamCheck}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid #3F3F46',
                      color: '#D1D5DB',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar Transmisión
                  </button>
                  <button
                    type="button"
                    onClick={proceedAnywayWithStream}
                    style={{
                      backgroundColor: '#f59e0b',
                      border: 'none',
                      color: '#000000',
                      borderRadius: 6,
                      padding: '8px 16px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Continuar de todos modos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Streaming / Recording */}
      {confirmModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          <div
            style={{
              width: 420,
              backgroundColor: '#181818',
              border: '1px solid #3F3F46',
              borderRadius: 10,
              padding: 20,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={22} color={confirmModal.action === 'stop_stream' ? '#ef4444' : '#FF7A00'} />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{confirmModal.title}</h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#D1D5DB', lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, action: null, title: '', message: '' })}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #3F3F46',
                  color: '#D1D5DB',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                style={{
                  backgroundColor: confirmModal.action === 'stop_stream' ? '#ef4444' : '#FF7A00',
                  border: 'none',
                  color: '#FFFFFF',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
