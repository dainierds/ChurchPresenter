import React, { useState, useEffect } from 'react'
import { X, RefreshCw, Download, Search, Terminal, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { LogEntry } from '../../../shared/types'

interface DiagnosticsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [exporting, setExporting] = useState<boolean>(false)
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadLogs = async () => {
    setLoading(true)
    try {
      if (window.churchPresenterApi?.getDiagnosticsLogs) {
        const fetched = await window.churchPresenterApi.getDiagnosticsLogs({
          filterLevel,
          query: searchQuery,
          limit: 250
        })
        setLogs(fetched)
      }
    } catch (err) {
      console.error('Failed to load diagnostics logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadLogs()
      setExportMessage(null)
    }
  }, [isOpen, filterLevel])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadLogs()
    }
  }

  const handleExportZip = async () => {
    setExporting(true)
    setExportMessage(null)
    try {
      if (window.churchPresenterApi?.exportDiagnosticsZip) {
        const res = await window.churchPresenterApi.exportDiagnosticsZip()
        if (res.success && res.filePath) {
          setExportMessage({
            type: 'success',
            text: `Diagnóstico exportado correctamente en: ${res.filePath}`
          })
        } else if (res.error && !res.error.includes('cancelada')) {
          setExportMessage({ type: 'error', text: res.error })
        }
      }
    } catch (err: any) {
      setExportMessage({ type: 'error', text: err?.message || 'Error al exportar diagnóstico' })
    } finally {
      setExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="pro-modal-backdrop">
      <div
        className="pro-modal-box"
        style={{
          width: 820,
          maxHeight: '88vh',
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
            <Terminal size={20} color="#38bdf8" />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f3f4f6' }}>
                Visor de Registros y Diagnóstico
              </h3>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Auditoría en vivo de eventos del sistema, errores y exportación técnica
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

        {/* Controls Toolbar */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#141517',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', backgroundColor: '#1f2024', borderRadius: 4, padding: 2 }}>
              {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterLevel(lvl)}
                  style={{
                    backgroundColor: filterLevel === lvl ? '#f97316' : 'transparent',
                    border: 'none',
                    color: filterLevel === lvl ? '#ffffff' : '#9ca3af',
                    padding: '4px 10px',
                    borderRadius: 3,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {lvl === 'all' ? 'Todos' : lvl === 'warn' ? 'Avisos' : lvl === 'error' ? 'Errores' : 'Info'}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#1f2024',
                borderRadius: 4,
                padding: '4px 8px',
                border: '1px solid #27272a'
              }}
            >
              <Search size={14} color="#9ca3af" />
              <input
                type="text"
                placeholder="Buscar en registros (Enter)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f3f4f6',
                  fontSize: 12,
                  marginLeft: 6,
                  width: 170
                }}
              />
            </div>

            <button
              type="button"
              onClick={loadLogs}
              disabled={loading}
              title="Refrescar registros"
              style={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                color: '#f3f4f6',
                padding: '6px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12
              }}
            >
              <RefreshCw size={13} className={loading ? 'pro-spin' : ''} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportZip}
            disabled={exporting}
            style={{
              backgroundColor: '#22c55e',
              border: 'none',
              color: '#ffffff',
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
            <Download size={14} />
            <span>{exporting ? 'Exportando...' : 'Exportar Diagnóstico (.ZIP)'}</span>
          </button>
        </div>

        {/* Message Banner if Exported */}
        {exportMessage && (
          <div
            style={{
              padding: '8px 20px',
              fontSize: 12,
              backgroundColor: exportMessage.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: exportMessage.type === 'success' ? '#4ade80' : '#f87171',
              borderBottom: '1px solid #27272a'
            }}
          >
            {exportMessage.text}
          </div>
        )}

        {/* Monospace Log Viewer */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: '#0a0a0c',
            padding: 14,
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: 11.5,
            lineHeight: 1.5
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>
              {loading ? 'Cargando registros...' : 'No se encontraron registros con los filtros actuales.'}
            </div>
          ) : (
            logs.map((entry, idx) => {
              const isError = entry.level === 'error'
              const isWarn = entry.level === 'warn'

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    color: isError ? '#f87171' : isWarn ? '#fde047' : '#d1d5db',
                    marginBottom: 3,
                    wordBreak: 'break-all'
                  }}
                >
                  {isError ? (
                    <AlertCircle size={12} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : isWarn ? (
                    <AlertTriangle size={12} color="#eab308" style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <Info size={12} color="#38bdf8" style={{ flexShrink: 0, marginTop: 2 }} />
                  )}
                  {entry.timestamp && (
                    <span style={{ color: '#6b7280', flexShrink: 0 }}>[{entry.timestamp}]</span>
                  )}
                  <span>{entry.message}</span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#1f2024',
            borderTop: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: '#9ca3af'
          }}
        >
          <span>Mostrando {logs.length} entradas más recientes (sin contraseñas ni tokens)</span>
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
