import React from 'react'
import { AlertTriangle, RefreshCw, XCircle, CheckCircle, Clock } from 'lucide-react'
import { SessionSnapshot } from '../../../shared/types'

interface SessionRecoveryModalProps {
  isOpen: boolean
  snapshot: SessionSnapshot | null
  onResume: () => void
  onDismiss: () => void
}

export const SessionRecoveryModal: React.FC<SessionRecoveryModalProps> = ({
  isOpen,
  snapshot,
  onResume,
  onDismiss
}) => {
  if (!isOpen || !snapshot) return null

  const snapshotDate = new Date(snapshot.timestamp).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  })

  return (
    <div className="pro-modal-backdrop">
      <div
        className="pro-modal-box"
        style={{
          maxWidth: 580,
          backgroundColor: '#18191c',
          border: '1px solid #f97316',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.85)',
          borderRadius: 8,
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            borderBottom: '1px solid rgba(249, 115, 22, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <AlertTriangle size={24} color="#f97316" />
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>
              Recuperación Tras Cierre Inesperado
            </h3>
            <span style={{ fontSize: 12, color: '#d1d5db' }}>
              Se detectó que la aplicación no se cerró limpiamente en la sesión anterior
            </span>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#e5e7eb', lineHeight: 1.5 }}>
            ChurchPresenter ha preservado automáticamente el estado exacto en el que te encontrabas antes del cierre.
          </p>

          <div
            style={{
              backgroundColor: '#111214',
              borderRadius: 6,
              padding: 14,
              border: '1px solid #27272a',
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, color: '#9ca3af' }}>
              <Clock size={14} color="#38bdf8" />
              <span>Instante guardado: <strong style={{ color: '#f3f4f6' }}>{snapshotDate}</strong></span>
            </div>

            {snapshot.activePlanTitle && (
              <div style={{ fontSize: 13, color: '#f3f4f6', marginBottom: 6 }}>
                Lista de servicio: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{snapshot.activePlanTitle}</span>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Elemento #{snapshot.activeItemIndex + 1} | Diapositiva #{snapshot.activeSlideIndex + 1}
              {snapshot.currentSlide?.title && (
                <span style={{ color: '#e5e7eb' }}> ({snapshot.currentSlide.title})</span>
              )}
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: 6,
              padding: 12,
              marginBottom: 20,
              fontSize: 12,
              color: '#4ade80',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Operación Segura:</strong> Al reanudar, se cargará tu área de trabajo (lista y diapositiva seleccionada en previo), pero <strong>no</strong> se proyectará nada a las salidas hasta que tú decidas enviarlo en vivo.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onDismiss}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #3f3f46',
                color: '#9ca3af',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              Descartar e Iniciar Nueva
            </button>
            <button
              type="button"
              onClick={onResume}
              style={{
                backgroundColor: '#f97316',
                border: 'none',
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={14} />
              <span>Reanudar Sesión Anterior</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
