import React, { useState, useEffect } from 'react'
import { SongUsageReport } from '../../../shared/types'

interface SongUsageReportModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SongUsageReportModal: React.FC<SongUsageReportModalProps> = ({ isOpen, onClose }) => {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [report, setReport] = useState<SongUsageReport | null>(null)
  const [isEnabled, setIsEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadConfigAndReport()
    }
  }, [isOpen])

  const loadConfigAndReport = async () => {
    setLoading(true)
    setStatusMessage('')
    try {
      const cfg = await window.churchPresenterApi.getCcliConfig()
      setIsEnabled(cfg.enabled)
      const rep = await window.churchPresenterApi.getSongUsageReport(fromDate || undefined, toDate || undefined)
      setReport(rep)
    } catch (err: any) {
      setStatusMessage('Error al cargar reporte: ' + (err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = () => {
    loadConfigAndReport()
  }

  const handleToggleTracking = async (enabled: boolean) => {
    try {
      const saved = await window.churchPresenterApi.saveCcliConfig({ enabled })
      setIsEnabled(saved.enabled)
      setStatusMessage(saved.enabled ? 'Registro CCLI activado.' : 'Registro CCLI desactivado.')
    } catch {
      setStatusMessage('Error al guardar configuración CCLI.')
    }
  }

  const handleExportCsv = async () => {
    try {
      const res = await window.churchPresenterApi.exportSongUsageCsv(fromDate || undefined, toDate || undefined)
      if (res.success) {
        // Trigger client-side download of CSV string
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_ccli_${new Date().toISOString().substring(0, 10)}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setStatusMessage(`CSV exportado exitosamente (${res.recordCount} registros).`)
      }
    } catch (err: any) {
      setStatusMessage('Error al exportar CSV: ' + (err?.message || err))
    }
  }

  const handleClearHistory = async () => {
    const confirm = window.confirm(
      '¿Está seguro de que desea eliminar TODO el historial de uso de canciones CCLI? Esta acción no se puede deshacer.'
    )
    if (!confirm) return

    try {
      const ok = await window.churchPresenterApi.clearSongUsageHistory()
      if (ok) {
        setStatusMessage('Historial CCLI borrado exitosamente.')
        loadConfigAndReport()
      }
    } catch {
      setStatusMessage('Error al borrar historial CCLI.')
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="pro-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}
    >
      <div
        className="pro-modal-box"
        style={{
          width: '92%',
          maxWidth: '850px',
          maxHeight: '90vh',
          backgroundColor: '#121212',
          border: '1px solid #262626',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
          color: '#F8FAFC'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #262626',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#38BDF8' }}>
              Reporte de Uso de Canciones (Licencia CCLI)
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tracking On/Off Toggle Strip */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#171717',
              borderRadius: 8,
              border: '1px solid #262626',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Registro Automático de Proyecciones</div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Guarda fecha, hora, CCLI y título cada vez que una canción se envía en vivo
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => handleToggleTracking(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#22C55E' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: isEnabled ? '#22C55E' : '#94A3B8' }}>
                {isEnabled ? 'Activo' : 'Desactivado'}
              </span>
            </label>
          </div>

          {/* Filters & Actions */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'flex-end',
              backgroundColor: '#0A0A0A',
              padding: '12px',
              borderRadius: 8,
              border: '1px solid #262626'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Desde (Fecha ISO o YYYY-MM-DD):</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  background: '#1A1A1A',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: '0.85rem'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Hasta (Fecha ISO o YYYY-MM-DD):</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  background: '#1A1A1A',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#FFF',
                  fontSize: '0.85rem'
                }}
              />
            </div>
            <button
              onClick={handleFilter}
              style={{
                background: '#38BDF8',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 4,
                padding: '7px 14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Filtrar
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!report || report.records.length === 0}
              style={{
                background: '#22C55E',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 4,
                padding: '7px 16px',
                fontWeight: 700,
                cursor: !report || report.records.length === 0 ? 'not-allowed' : 'pointer',
                opacity: !report || report.records.length === 0 ? 0.5 : 1,
                marginLeft: 'auto'
              }}
            >
              📥 Exportar CSV para CCLI
            </button>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #38BDF8',
                borderRadius: 4,
                fontSize: '0.85rem',
                color: '#38BDF8'
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Summary Stats */}
          {report && (
            <div style={{ display: 'flex', gap: 16 }}>
              <div
                style={{
                  flex: 1,
                  background: '#1A1A1A',
                  border: '1px solid #262626',
                  borderRadius: 6,
                  padding: '12px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Total de Reproducciones</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38BDF8' }}>{report.totalPlays}</div>
              </div>
              <div
                style={{
                  flex: 1,
                  background: '#1A1A1A',
                  border: '1px solid #262626',
                  borderRadius: 6,
                  padding: '12px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Canciones Distintas</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#22C55E' }}>{report.uniqueSongs}</div>
              </div>
            </div>
          )}

          {/* Table of Records */}
          <div
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              border: '1px solid #262626',
              borderRadius: 6,
              background: '#0A0A0A'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#161616', color: '#94A3B8', borderBottom: '1px solid #262626' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Fecha y Hora</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Título</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Autor / Artista</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nº CCLI</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Culto / Servicio</th>
                </tr>
              </thead>
              <tbody>
                {report && report.records.length > 0 ? (
                  report.records.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #1F1F1F' }}>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>
                        {new Date(r.projectedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#FFFFFF' }}>{r.title}</td>
                      <td style={{ padding: '8px 12px', color: '#CBD5E1' }}>{r.artist || '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#38BDF8' }}>{r.ccliNumber || '-'}</td>
                      <td style={{ padding: '8px 12px', color: '#94A3B8' }}>{r.serviceTitle || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                      {loading ? 'Cargando registros...' : 'No hay registros en el rango seleccionado'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #262626',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <button
            onClick={handleClearHistory}
            style={{
              background: '#FF7A00',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: 6,
              padding: '8px 14px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            🗑️ Limpiar Historial CCLI
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#262626',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
