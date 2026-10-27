import React, { useState, useEffect } from 'react'
import { X, Activity, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Monitor, Clock, HardDrive } from 'lucide-react'
import { OutputHealthStatus } from '../../../shared/types'

interface OutputHealthModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenDisplaysModal?: () => void
}

export const OutputHealthModal: React.FC<OutputHealthModalProps> = ({
  isOpen,
  onClose,
  onOpenDisplaysModal
}) => {
  const [statuses, setStatuses] = useState<Record<string, OutputHealthStatus>>({})
  const [loading, setLoading] = useState<boolean>(false)

  const loadStatuses = async () => {
    setLoading(true)
    try {
      if (window.churchPresenterApi?.getOutputHealthStatuses) {
        const data = await window.churchPresenterApi.getOutputHealthStatuses()
        setStatuses(data)
      }
    } catch (err) {
      console.error('Error fetching output health statuses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadStatuses()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(loadStatuses, 2000)
    return () => clearInterval(interval)
  }, [isOpen])

  if (!isOpen) return null

  const roles = [
    { id: 'main', label: 'Audiencia (Sala Principal)', desc: 'Proyección principal a la congregación' },
    { id: 'stage', label: 'Monitor de Escenario', desc: 'Retorno de confianza para músicos y oradores' },
    { id: 'lobby', label: 'Vestíbulo / Lobby', desc: 'Pantalla de bienvenida y anuncios generales' }
  ]

  return (
    <div className="pro-modal-backdrop">
      <div
        className="pro-modal-box"
        style={{
          width: 760,
          maxHeight: '85vh',
          backgroundColor: '#18191c',
          border: '1px solid #27272a',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.85)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1f2024',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={20} color="#22c55e" />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>
                Salud y Rendimiento de Salidas
              </h3>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Estado en vivo de ventanas de proyección, fotogramas, memoria y registro de incidentes
              </span>
            </div>
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

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {roles.map((r) => {
              const s = statuses[r.id]
              const isHealthy = s?.status === 'healthy'
              const isWarning = s?.status === 'warning'
              const isError = s?.status === 'error'

              return (
                <div
                  key={r.id}
                  style={{
                    backgroundColor: '#111214',
                    border: `1px solid ${isHealthy ? '#22c55e' : isWarning ? '#eab308' : '#ef4444'}`,
                    borderRadius: 6,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ fontSize: 13, color: '#f3f4f6' }}>{r.label}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 3,
                        textTransform: 'uppercase',
                        backgroundColor: isHealthy
                          ? 'rgba(34, 197, 94, 0.15)'
                          : isWarning
                          ? 'rgba(234, 179, 8, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        color: isHealthy ? '#4ade80' : isWarning ? '#fde047' : '#f87171'
                      }}
                    >
                      {isHealthy ? 'Saludable' : isWarning ? 'Aviso' : 'Fallo'}
                    </span>
                  </div>

                  <span style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>{r.desc}</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Monitor físico:</span>
                      <strong style={{ color: s?.displayConnected ? '#4ade80' : '#f87171' }}>
                        {s?.displayConnected ? 'Conectado' : 'Desconectado'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Ventana activa:</span>
                      <strong style={{ color: s?.windowAlive ? '#4ade80' : '#9ca3af' }}>
                        {s?.windowAlive ? 'En ejecución' : 'Cerrada / Inactiva'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>FPS reales:</span>
                      <strong style={{ color: (s?.fps || 0) >= 45 ? '#4ade80' : '#fde047' }}>
                        {s?.windowAlive ? `${(s?.fps || 0).toFixed(0)} FPS` : '--'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Memoria RAM:</span>
                      <strong style={{ color: '#f3f4f6' }}>
                        {s?.memoryUsageMb ? `${s.memoryUsageMb} MB` : '--'}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Incidents Table */}
          <div style={{ backgroundColor: '#111214', borderRadius: 6, border: '1px solid #27272a', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Clock size={15} color="#38bdf8" />
              <strong style={{ fontSize: 13, color: '#f3f4f6' }}>Registro de Incidentes y Recreaciones</strong>
            </div>

            {Object.values(statuses).flatMap((s) => s.incidents || []).length === 0 ? (
              <div style={{ fontSize: 12, color: '#4ade80', padding: '10px 0' }}>
                <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 6 }} />
                Cero incidentes registrados en esta sesión. Todas las salidas han operado de forma continua.
              </div>
            ) : (
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {Object.entries(statuses).flatMap(([role, s]) =>
                  (s.incidents || []).map((inc, idx) => (
                    <div
                      key={`${role}-${idx}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        fontSize: 11.5,
                        borderBottom: '1px solid #1f2024'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 3,
                            backgroundColor: '#27272a',
                            color: '#f97316'
                          }}
                        >
                          {role.toUpperCase()}
                        </span>
                        <span style={{ color: '#e5e7eb' }}>{inc.details}</span>
                      </div>
                      <span style={{ color: '#6b7280' }}>
                        {new Date(inc.timestamp).toLocaleTimeString('es-ES')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#1f2024',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenDisplaysModal?.()
            }}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              color: '#38bdf8',
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Monitor size={14} />
            <span>Configurar Pantallas...</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              color: '#f3f4f6',
              padding: '6px 16px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
