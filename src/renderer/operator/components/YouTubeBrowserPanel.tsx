import React, { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Tv,
  PlusCircle,
  Download,
  AlertTriangle,
  BookmarkPlus,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Info
} from 'lucide-react'
import { ServiceItem, YouTubeItem, YouTubeDownloadProgress } from '../../../shared/types'
import { parseYouTubeUrl } from '../../../shared/youtube-utils'

interface YouTubeBrowserPanelProps {
  onAddToPlaylist: (item: ServiceItem) => void
  onProjectNow: (item: ServiceItem) => void
  isVisible?: boolean
}

export const YouTubeBrowserPanel: React.FC<YouTubeBrowserPanelProps> = ({
  onAddToPlaylist,
  onProjectNow,
  isVisible = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string>('https://www.youtube.com')
  const [inputUrl, setInputUrl] = useState<string>('https://www.youtube.com')
  const [isAdActive, setIsAdActive] = useState<boolean>(false)
  const [isLoadingMeta, setIsLoadingMeta] = useState<boolean>(false)
  const [disclaimerOpen, setDisclaimerOpen] = useState<boolean>(false)
  const [statusToast, setStatusToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' | 'error' } | null>(null)
  const [downloading, setDownloading] = useState<boolean>(false)
  const [downloadProgress, setDownloadProgress] = useState<YouTubeDownloadProgress | null>(null)

  // Check first-time disclaimer
  useEffect(() => {
    const accepted = localStorage.getItem('cp_youtube_disclaimer_accepted')
    if (!accepted) {
      setDisclaimerOpen(true)
      window.churchPresenterApi?.setYouTubeBrowserVisible?.(false)
    }
  }, [])

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('cp_youtube_disclaimer_accepted', 'true')
    setDisclaimerOpen(false)
    if (isVisible) {
      window.churchPresenterApi?.setYouTubeBrowserVisible?.(true)
    }
  }

  // Manage WebContentsView positioning and lifecycle
  useEffect(() => {
    if (!isVisible) {
      window.churchPresenterApi?.setYouTubeBrowserVisible?.(false)
      return
    }

    const updateBounds = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      // Bounds relative to the window
      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
      if (bounds.width > 50 && bounds.height > 50) {
        window.churchPresenterApi?.openYouTubeBrowser(bounds)
        window.churchPresenterApi?.setYouTubeBrowserVisible?.(true)
      }
    }

    // Delay slightly to let layout settle
    const timer = setTimeout(updateBounds, 120)
    window.addEventListener('resize', updateBounds)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateBounds)
      window.churchPresenterApi?.setYouTubeBrowserVisible?.(false)
    }
  }, [isVisible])

  // Listen to events and poll URL only when visible
  useEffect(() => {
    // Listen to ad status
    const unsubAd = window.churchPresenterApi?.onYouTubeAdStatus((isAd) => {
      setIsAdActive(isAd)
    })

    // Listen to download progress
    const unsubProgress = window.churchPresenterApi?.onYouTubeDownloadProgress?.((progress) => {
      setDownloadProgress(progress)
    })

    // Poll current URL periodically only when visible
    const pollInterval = setInterval(async () => {
      if (!isVisible) return
      try {
        const url = await window.churchPresenterApi?.getYouTubeBrowserUrl()
        if (url && url !== currentUrl) {
          setCurrentUrl(url)
          setInputUrl(url)
        }
      } catch {
        // Ignore poll error if view not active
      }
    }, 1000)

    return () => {
      clearInterval(pollInterval)
      unsubAd?.()
      unsubProgress?.()
    }
  }, [isVisible, currentUrl])

  // Re-adjust browser bounds when download progress bar toggles
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      window.churchPresenterApi?.setYouTubeBrowserBounds({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
    }, 60)
    return () => clearTimeout(timer)
  }, [downloading, downloadProgress !== null])

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (!statusToast) return
    const t = setTimeout(() => setStatusToast(null), 4000)
    return () => clearTimeout(t)
  }, [statusToast])

  const handleNavigate = (action: 'back' | 'forward' | 'home' | 'reload') => {
    window.churchPresenterApi?.navigateYouTubeBrowser(action)
  }

  const handleGoUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputUrl) return
    window.churchPresenterApi?.navigateYouTubeBrowser('go', inputUrl)
  }

  const getActiveVideoData = async (): Promise<ServiceItem | null> => {
    setIsLoadingMeta(true)
    try {
      const url = await window.churchPresenterApi?.getYouTubeBrowserUrl() || currentUrl
      const parsed = parseYouTubeUrl(url)
      if (!parsed.isValid || !parsed.videoId) {
        setStatusToast({
          message: 'No hay ningún video de YouTube abierto. Abre un video para proyectarlo.',
          type: 'warn'
        })
        return null
      }

      const meta = await window.churchPresenterApi?.getYouTubeMetadata(parsed.videoId)
      const availability = await window.churchPresenterApi?.checkYouTubeAvailability(parsed.videoId)

      const serviceItem: ServiceItem = {
        id: `yt_item_${Date.now()}`,
        type: 'youtube',
        name: meta.title || `YouTube (${parsed.videoId})`,
        notes: `Canal: ${meta.channelTitle}`,
        youtubeConfig: {
          youtubeId: parsed.videoId,
          url: parsed.canonicalUrl || url,
          title: meta.title,
          channelTitle: meta.channelTitle,
          thumbnailUrl: meta.thumbnailUrl,
          duration: meta.duration || 0,
          inPoint: parsed.inPointSeconds || 0,
          targetRoles: ['main'],
          audioRole: 'main',
          endAction: 'freeze',
          availabilityStatus: availability || 'ok'
        }
      }

      return serviceItem
    } catch (err: any) {
      setStatusToast({
        message: `Error al leer información del video: ${err.message}`,
        type: 'error'
      })
      return null
    } finally {
      setIsLoadingMeta(false)
    }
  }

  const handleProjectCurrentVideo = async () => {
    const item = await getActiveVideoData()
    if (!item) return

    if (item.youtubeConfig?.availabilityStatus === 'unembeddable') {
      setStatusToast({
        message: 'Aviso: Este video tiene la opción de incrustación desactivada por su autor.',
        type: 'warn'
      })
    }

    onProjectNow(item)
    setStatusToast({
      message: `Proyectando en vivo: "${item.name}"`,
      type: 'success'
    })
  }

  const handleAddToPlaylist = async () => {
    const item = await getActiveVideoData()
    if (!item) return
    onAddToPlaylist(item)
    setStatusToast({
      message: `Añadido a la lista de culto: "${item.name}"`,
      type: 'success'
    })
  }

  const handleSaveToLibrary = async () => {
    const item = await getActiveVideoData()
    if (!item || !item.youtubeConfig) return

    try {
      const ytItem: YouTubeItem = {
        id: `yt_lib_${Date.now()}`,
        youtubeId: item.youtubeConfig.youtubeId,
        url: item.youtubeConfig.url,
        title: item.youtubeConfig.title,
        channelTitle: item.youtubeConfig.channelTitle,
        thumbnailUrl: item.youtubeConfig.thumbnailUrl,
        duration: item.youtubeConfig.duration,
        inPoint: item.youtubeConfig.inPoint,
        outPoint: item.youtubeConfig.outPoint,
        targetRoles: item.youtubeConfig.targetRoles,
        audioRole: item.youtubeConfig.audioRole,
        endAction: item.youtubeConfig.endAction,
        availabilityStatus: item.youtubeConfig.availabilityStatus || 'ok',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await window.churchPresenterApi?.saveYouTubeItem(ytItem)
      setStatusToast({
        message: `Guardado en la biblioteca de YouTube: "${ytItem.title}"`,
        type: 'success'
      })
    } catch (err: any) {
      setStatusToast({
        message: `Error al guardar en biblioteca: ${err.message}`,
        type: 'error'
      })
    }
  }

  const handleDownloadLocal = async () => {
    const url = await window.churchPresenterApi?.getYouTubeBrowserUrl() || currentUrl
    const parsed = parseYouTubeUrl(url)
    if (!parsed.isValid || !parsed.videoId) {
      setStatusToast({
        message: 'Abre un video de YouTube para poder descargarlo localmente.',
        type: 'warn'
      })
      return
    }

    setDownloading(true)
    setDownloadProgress({ percent: 0, statusText: 'Iniciando conexión con yt-dlp...' })
    setStatusToast({
      message: 'Iniciando descarga local con yt-dlp hacia la biblioteca de medios...',
      type: 'info'
    })

    try {
      const res = await window.churchPresenterApi?.downloadYouTubeVideo(url)
      if (res.success && res.item) {
        setStatusToast({
          message: `Video descargado con éxito y añadido a Medios: "${res.item.originalName}"`,
          type: 'success'
        })
      } else {
        setStatusToast({
          message: res.error || 'No se pudo descargar el video localmente.',
          type: 'error'
        })
      }
    } catch (err: any) {
      setStatusToast({
        message: `Error en descarga: ${err.message}`,
        type: 'error'
      })
    } finally {
      setDownloading(false)
      setTimeout(() => setDownloadProgress(null), 2500)
    }
  }

  return (
    <div className="pro-yt-browser-panel">
      {/* Top Browser Navigation Bar */}
      <div className="pro-yt-nav-bar">
        <div className="pro-yt-nav-buttons">
          <button className="pro-yt-btn" onClick={() => handleNavigate('back')} title="Atrás">
            <ArrowLeft size={16} />
          </button>
          <button className="pro-yt-btn" onClick={() => handleNavigate('forward')} title="Adelante">
            <ArrowRight size={16} />
          </button>
          <button className="pro-yt-btn" onClick={() => handleNavigate('reload')} title="Recargar">
            <RotateCw size={15} />
          </button>
          <button className="pro-yt-btn" onClick={() => handleNavigate('home')} title="Inicio (YouTube)">
            <Home size={16} />
          </button>
        </div>

        {/* Address / Search Bar */}
        <form className="pro-yt-address-form" onSubmit={handleGoUrl}>
          <input
            type="text"
            className="pro-yt-address-input"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Introduce URL o busca en YouTube..."
          />
          <button type="submit" className="pro-yt-go-btn">
            Ir
          </button>
        </form>

        {/* Action Controls for Operator */}
        <div className="pro-yt-actions">
          {isAdActive && (
            <div className="pro-yt-ad-badge" title="Detectada publicidad de YouTube">
              <ShieldAlert size={14} />
              <span>ANUNCIO EN CURSO</span>
            </div>
          )}

          <button
            className="pro-yt-action-btn pro-yt-project-btn"
            onClick={handleProjectCurrentVideo}
            disabled={isLoadingMeta}
            title="Proyectar este video inmediatamente en las salidas (Ctrl+Y)"
          >
            <Tv size={15} />
            <span>Proyectar este video</span>
            <kbd className="pro-kbd-badge">Ctrl+Y</kbd>
          </button>

          <button
            className="pro-yt-action-btn"
            onClick={handleAddToPlaylist}
            disabled={isLoadingMeta}
            title="Añadir el video a la lista del culto"
          >
            <PlusCircle size={15} />
            <span>Añadir a Culto</span>
          </button>

          <button
            className="pro-yt-action-btn"
            onClick={handleSaveToLibrary}
            disabled={isLoadingMeta}
            title="Guardar en biblioteca de YouTube"
          >
            <BookmarkPlus size={15} />
            <span>Guardar</span>
          </button>

          <button
            className="pro-yt-action-btn"
            onClick={handleDownloadLocal}
            disabled={downloading}
            title="Descargar archivo MP4 local a la biblioteca de medios"
          >
            <Download size={15} />
            <span>
              {downloading
                ? downloadProgress && downloadProgress.percent > 0
                  ? `Descargando (${Math.round(downloadProgress.percent)}%)...`
                  : 'Descargando...'
                : 'Descargar'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Download Progress Bar */}
      {(downloading || downloadProgress !== null) && (
        <div className="pro-yt-progress-container">
          <div className="pro-yt-progress-header">
            <div className="pro-yt-progress-status">
              <Download size={14} className="pro-yt-progress-icon spinning" />
              <span className="pro-yt-progress-label">
                {downloadProgress?.statusText || 'Descargando video...'}
              </span>
            </div>
            <div className="pro-yt-progress-meta">
              {downloadProgress?.speed && (
                <span className="pro-yt-progress-badge">{downloadProgress.speed}</span>
              )}
              {downloadProgress?.eta && (
                <span className="pro-yt-progress-badge">ETA: {downloadProgress.eta}</span>
              )}
              {downloadProgress?.totalSize && (
                <span className="pro-yt-progress-badge">{downloadProgress.totalSize}</span>
              )}
              <span className="pro-yt-progress-percent">
                {Math.round(downloadProgress?.percent || 0)}%
              </span>
            </div>
          </div>
          <div className="pro-yt-progress-track">
            <div
              className="pro-yt-progress-fill"
              style={{ width: `${Math.min(100, Math.max(0, downloadProgress?.percent || 0))}%` }}
            />
          </div>
        </div>
      )}

      {/* Embedded Native WebContentsView Container */}
      <div className="pro-yt-view-container" ref={containerRef}>
        {/* Placeholder text visible only when WebContentsView is loading or inactive */}
        <div className="pro-yt-placeholder">
          <div className="pro-yt-loading-spinner" />
          <p>Cargando navegador seguro de YouTube...</p>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Sesión persistente aislada ({currentUrl})
          </span>
        </div>
      </div>

      {/* Floating Status Toast */}
      {statusToast && (
        <div className={`pro-yt-toast pro-yt-toast-${statusToast.type}`}>
          {statusToast.type === 'success' && <CheckCircle2 size={16} />}
          {statusToast.type === 'error' && <XCircle size={16} />}
          {statusToast.type === 'warn' && <AlertTriangle size={16} />}
          {statusToast.type === 'info' && <Info size={16} />}
          <span>{statusToast.message}</span>
        </div>
      )}

      {/* Legal & Connectivity Disclaimer Modal */}
      {disclaimerOpen && (
        <div className="pro-modal-backdrop">
          <div className="pro-modal-dialog pro-disclaimer-dialog">
            <div className="pro-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
                  Aviso de Reproducción de YouTube
                </h3>
              </div>
            </div>

            <div className="pro-modal-body" style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 }}>
              <p>
                <strong>Conectividad:</strong> La reproducción de videos de YouTube depende de una conexión activa
                y estable a internet. En caso de corte o lentitud de red, la salida mantendrá el fondo configurado.
              </p>
              <p>
                <strong>Restricciones de autor:</strong> Algunos videos tienen deshabilitada la opción de incrustación
                externa por decisión de sus propietarios o discográficas. ChurchPresenter verificará la disponibilidad
                automáticamente.
              </p>
              <p>
                <strong>Responsabilidad Legal:</strong> La iglesia o congregación es la única responsable de contar con
                las licencias necesarias (como licencias CCLI, derechos de ejecución pública o autorización expresa del
                autor) para proyectar contenidos audiovisuales de terceros durante reuniones públicas.
              </p>
            </div>

            <div className="pro-modal-footer">
              <button className="pro-btn-primary" onClick={handleAcceptDisclaimer}>
                He leído y acepto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
