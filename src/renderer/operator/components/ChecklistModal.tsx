import React, { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ShieldCheck,
  HardDrive,
  Tv,
  Film,
  BookOpen,
  FileText,
  Database
} from 'lucide-react'
import { ServiceChecklistResult, ChecklistItem, ServicePlan } from '../../../shared/types'

interface ChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  activePlan?: ServicePlan | null
  onOpenDisplaysModal?: () => void
  onOpenBibleManager?: () => void
}

export const ChecklistModal: React.FC<ChecklistModalProps> = ({
  isOpen,
  onClose,
  activePlan,
  onOpenDisplaysModal,
  onOpenBibleManager
}) => {
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<ServiceChecklistResult | null>(null)

  const runCheck = async () => {
    setLoading(true)
    try {
      if (window.churchPresenterApi?.runPreServiceChecklist) {
        const res = await window.churchPresenterApi.runPreServiceChecklist(activePlan)
        setResult(res)
      }
    } catch (err) {
      console.error('Error running pre-service checklist:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      runCheck()
    }
  }, [isOpen, activePlan])

  const handleFixAction = async (item: ChecklistItem) => {
    if (item.actionType === 'open_displays_modal') {
      onClose()
      onOpenDisplaysModal?.()
      return
    }
    if (item.actionType === 'import_bible') {
      onClose()
      onOpenBibleManager?.()
      return
    }

    if (window.churchPresenterApi?.fixChecklistItem && item.actionType) {
      await window.churchPresenterApi.fixChecklistItem(item.id, item.actionType)
      runCheck()
    }
  }

  if (!isOpen) return null

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'displays':
        return <Tv size={16} color="#38bdf8" />
      case 'media':
      case 'youtube':
        return <Film size={16} color="#f97316" />
      case 'bible':
        return <BookOpen size={16} color="#22c55e" />
      case 'powerpoint':
        return <FileText size={16} color="#eab308" />
      case 'disk':
        return <HardDrive size={16} color="#a855f7" />
      case 'backup':
        return <Database size={16} color="#38bdf8" />
      default:
        return <ShieldCheck size={16} color="#9ca3af" />
    }
  }

  const overallStatus = result?.overallStatus || 'ok'

  return (
    <div className="pro-modal-backdrop">
      <div
        className="pro-modal-box"
        style={{
          width: 680,
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
            <ShieldCheck size={20} color="#22c55e" />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>
                Verificación Previa al Culto
              </h3>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Inspección integral de medios, pantallas, fuentes, biblias y hardware
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

        {/* Overall Status Banner */}
        <div style={{ padding: '16px 20px 8px 20px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor:
                overallStatus === 'ok'
                  ? 'rgba(34, 197, 94, 0.12)'
                  : overallStatus === 'warning'
                  ? 'rgba(234, 179, 8, 0.12)'
                  : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${
                overallStatus === 'ok'
                  ? 'rgba(34, 197, 94, 0.35)'
                  : overallStatus === 'warning'
                  ? 'rgba(234, 179, 8, 0.35)'
                  : 'rgba(239, 68, 68, 0.4)'
              }`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {overallStatus === 'ok' ? (
                <CheckCircle2 size={22} color="#22c55e" />
              ) : overallStatus === 'warning' ? (
                <AlertTriangle size={22} color="#eab308" />
              ) : (
                <XCircle size={22} color="#ef4444" />
              )}
              <div>
                <strong
                  style={{
                    fontSize: 14,
                    color:
                      overallStatus === 'ok'
                        ? '#4ade80'
                        : overallStatus === 'warning'
                        ? '#fde047'
                        : '#f87171'
                  }}
                >
                  {overallStatus === 'ok'
                    ? 'TODO LISTO PARA EL CULTO'
                    : overallStatus === 'warning'
                    ? 'ADVERTENCIAS DETECTADAS'
                    : 'ERRORES CRÍTICOS DETECTADOS'}
                </strong>
                <div style={{ fontSize: 12, color: '#d1d5db' }}>
                  {result
                    ? `${result.summary.ok} comprobaciones correctas, ${result.summary.warning} advertencias, ${result.summary.error} errores`
                    : 'Ejecutando comprobaciones...'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={runCheck}
              disabled={loading}
              style={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                color: '#f3f4f6',
                padding: '6px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <RefreshCw size={12} className={loading ? 'pro-spin' : ''} />
              <span>Volver a Verificar</span>
            </button>
          </div>
        </div>

        {/* Checklist Items Scroll Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 16px 20px' }}>
          {result?.items.map((item) => {
            const isOk = item.status === 'ok'
            const isWarn = item.status === 'warning'
            const isErr = item.status === 'error'

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#111214',
                  borderRadius: 6,
                  border: '1px solid #27272a',
                  marginBottom: 8
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ marginTop: 2 }}>{getCategoryIcon(item.category)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#f3f4f6' }}>{item.title}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          backgroundColor: isOk
                            ? 'rgba(34, 197, 94, 0.15)'
                            : isWarn
                            ? 'rgba(234, 179, 8, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          color: isOk ? '#4ade80' : isWarn ? '#fde047' : '#f87171'
                        }}
                      >
                        {isOk ? 'OK' : isWarn ? 'Aviso' : 'Error'}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#9ca3af',
                        marginTop: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={item.details}
                    >
                      {item.details}
                    </div>
                  </div>
                </div>

                {item.actionLabel && (
                  <button
                    type="button"
                    onClick={() => handleFixAction(item)}
                    style={{
                      marginLeft: 12,
                      backgroundColor: isErr ? '#ef4444' : '#f97316',
                      border: 'none',
                      color: '#ffffff',
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#1f2024',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              color: '#f3f4f6',
              padding: '7px 20px',
              borderRadius: 4,
              fontSize: 13,
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
