import React, { useState, useEffect } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  WifiOff,
  Lock,
  Tv,
  X
} from 'lucide-react'
import { ServiceItem, YouTubeAvailabilityStatus } from '../../../shared/types'

interface YouTubeVerifyModalProps {
  items: ServiceItem[]
  isOpen: boolean
  onClose: () => void
}

interface VerificationResult {
  itemId: string
  title: string
  videoId: string
  status: YouTubeAvailabilityStatus
}

export const YouTubeVerifyModal: React.FC<YouTubeVerifyModalProps> = ({
  items,
  isOpen,
  onClose
}) => {
  const [verifying, setVerifying] = useState(false)
  const [results, setResults] = useState<VerificationResult[]>([])
  const [okCount, setOkCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  const runVerification = async () => {
    setVerifying(true)
    try {
      const res = await window.churchPresenterApi?.verifyYouTubePlaylist(items)
      if (res) {
        setResults(res.results)
        setOkCount(res.okCount)
        setFailedCount(res.failedCount)
      }
    } catch (err) {
      console.error('Error verifying YouTube playlist:', err)
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      runVerification()
    }
  }, [isOpen, items])

  if (!isOpen) return null

  const getStatusBadge = (status: YouTubeAvailabilityStatus) => {
    switch (status) {
      case 'ok':
        return (
          <span className="pro-yt-badge pro-yt-badge-ok">
            <CheckCircle2 size={13} />
            <span>Disponible</span>
          </span>
        )
      case 'unembeddable':
        return (
          <span className="pro-yt-badge pro-yt-badge-warn">
            <AlertTriangle size={13} />
            <span>No incrustable</span>
          </span>
        )
      case 'requires_auth':
        return (
          <span className="pro-yt-badge pro-yt-badge-auth">
            <Lock size={13} />
            <span>Requiere cuenta</span>
          </span>
        )
      case 'offline':
        return (
          <span className="pro-yt-badge pro-yt-badge-offline">
            <WifiOff size={13} />
            <span>Sin conexión</span>
          </span>
        )
      case 'unavailable':
      default:
        return (
          <span className="pro-yt-badge pro-yt-badge-error">
            <XCircle size={13} />
            <span>No disponible</span>
          </span>
        )
    }
  }

  return (
    <div className="pro-modal-backdrop">
      <div className="pro-modal-dialog pro-verify-modal">
        <div className="pro-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tv size={20} color="#38bdf8" />
            <h3 style={{ margin: 0, fontSize: 18, color: '#f8fafc' }}>
              Verificación de Videos de YouTube (Pre-Culto)
            </h3>
          </div>
          <button className="pro-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pro-modal-body">
          <div className="pro-verify-summary">
            <div className="pro-verify-stat-card">
              <span className="pro-stat-num">{results.length}</span>
              <span className="pro-stat-label">Videos en Culto</span>
            </div>
            <div className="pro-verify-stat-card stat-ok">
              <span className="pro-stat-num">{okCount}</span>
              <span className="pro-stat-label">Listos para Proyectar</span>
            </div>
            <div className={`pro-verify-stat-card ${failedCount > 0 ? 'stat-warn' : ''}`}>
              <span className="pro-stat-num">{failedCount}</span>
              <span className="pro-stat-label">Con Advertencias</span>
            </div>
          </div>

          {verifying ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
              <div className="pro-yt-loading-spinner" style={{ margin: '0 auto 12px' }} />
              <p>Verificando disponibilidad y permisos de incrustación...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
              No hay elementos de YouTube en la lista de culto actual.
            </div>
          ) : (
            <div className="pro-verify-list">
              {results.map((res) => (
                <div key={res.itemId} className="pro-verify-item">
                  <img
                    src={`https://i.ytimg.com/vi/${res.videoId}/default.jpg`}
                    alt=""
                    className="pro-verify-thumb"
                  />
                  <div className="pro-verify-info">
                    <div className="pro-verify-title">{res.title}</div>
                    <div className="pro-verify-id">ID: {res.videoId}</div>
                  </div>
                  <div className="pro-verify-badge-col">
                    {getStatusBadge(res.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pro-modal-footer">
          <button
            className="pro-btn-secondary"
            onClick={runVerification}
            disabled={verifying}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RotateCw size={14} className={verifying ? 'spin' : ''} />
            <span>Re-verificar</span>
          </button>
          <button className="pro-btn-primary" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
