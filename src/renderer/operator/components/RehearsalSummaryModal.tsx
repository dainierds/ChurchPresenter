import React from 'react'
import { X, CheckCircle2, Clock, Film, AlertTriangle, FileText } from 'lucide-react'
import { RehearsalSummary } from '../../../shared/types'

interface RehearsalSummaryModalProps {
  isOpen: boolean
  summary: RehearsalSummary | null
  onClose: () => void
}

export const RehearsalSummaryModal: React.FC<RehearsalSummaryModalProps> = ({
  isOpen,
  summary,
  onClose
}) => {
  if (!isOpen || !summary) return null

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins} min ${rem} seg`
  }

  return (
    <div className="pro-modal-backdrop">
      <div
        className="pro-modal-box"
        style={{
          width: 540,
          backgroundColor: '#18191c',
          border: '1px solid #f97316',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85)',
          borderRadius: 8,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(249, 115, 22, 0.12)',
            borderBottom: '1px solid rgba(249, 115, 22, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={20} color="#f97316" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>
              Resumen del Ensayo
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 16
            }}
          >
            <div style={{ backgroundColor: '#111214', padding: 12, borderRadius: 6, border: '1px solid #27272a' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Duración</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f3f4f6', marginTop: 4 }}>
                {formatDuration(summary.durationSeconds)}
              </div>
            </div>

            <div style={{ backgroundColor: '#111214', padding: 12, borderRadius: 6, border: '1px solid #27272a' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Diapositivas</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                {summary.slidesCount}
              </div>
            </div>

            <div style={{ backgroundColor: '#111214', padding: 12, borderRadius: 6, border: '1px solid #27272a' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Incidentes</span>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: summary.incidentsCount === 0 ? '#4ade80' : '#f87171',
                  marginTop: 4
                }}
              >
                {summary.incidentsCount}
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#111214',
              borderRadius: 6,
              border: '1px solid #27272a',
              padding: 12,
              marginBottom: 16,
              fontSize: 12,
              color: '#d1d5db'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <FileText size={14} color="#38bdf8" />
              <strong>Registro del Ensayo Guardado:</strong>
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#9ca3af',
                wordBreak: 'break-all',
                backgroundColor: '#0a0a0c',
                padding: '6px 8px',
                borderRadius: 4
              }}
            >
              {summary.logFilePath}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: '#f97316',
                border: 'none',
                color: '#ffffff',
                padding: '7px 20px',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
