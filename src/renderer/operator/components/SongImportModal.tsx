import React, { useState } from 'react'
import { ImportedSongPreview, SongImportResult, UserLibrary } from '../../../shared/types'

interface SongImportModalProps {
  isOpen: boolean
  onClose: () => void
  libraries?: UserLibrary[]
  onImportComplete?: () => void
}

export const SongImportModal: React.FC<SongImportModalProps> = ({
  isOpen,
  onClose,
  libraries = [],
  onImportComplete
}) => {
  const [filePath, setFilePath] = useState('')
  const [detectedFormat, setDetectedFormat] = useState('')
  const [previews, setPreviews] = useState<ImportedSongPreview[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<SongImportResult | null>(null)
  const [targetLibraryId, setTargetLibraryId] = useState<string>('')

  if (!isOpen) return null

  const handleParse = async () => {
    if (!filePath.trim()) return
    setIsParsing(true)
    setParseErrors([])
    setImportResult(null)
    try {
      const res = await window.churchPresenterApi.parseSongImportFile(filePath.trim())
      if (res.success) {
        setPreviews(res.previewSongs)
        setDetectedFormat(res.formatDetected)
      } else {
        setPreviews([])
        setParseErrors(res.errors && res.errors.length > 0 ? res.errors : ['Error al analizar archivo.'])
      }
    } catch (err: any) {
      setParseErrors([err?.message || 'Error inesperado al leer el archivo.'])
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (previews.length === 0) return
    setIsImporting(true)
    try {
      const res = await window.churchPresenterApi.executeSongImport(previews, targetLibraryId || undefined)
      setImportResult(res)
      if (res.success && onImportComplete) {
        onImportComplete()
      }
    } catch (err: any) {
      setParseErrors([err?.message || 'Error durante la importación.'])
    } finally {
      setIsImporting(false)
    }
  }

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
          width: '90%',
          maxWidth: '750px',
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
            <span style={{ fontSize: '1.25rem' }}>📥</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#FF7A00' }}>
              Importar Canciones de Otros Programas
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
          {/* Format Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.8rem' }}>
            <span style={{ padding: '3px 8px', background: '#1E1E1E', border: '1px solid #333', borderRadius: 4, color: '#38BDF8' }}>
              Texto Plano (.txt)
            </span>
            <span style={{ padding: '3px 8px', background: '#1E1E1E', border: '1px solid #333', borderRadius: 4, color: '#38BDF8' }}>
              ChordPro (.chordpro/.chopro/.crd)
            </span>
            <span style={{ padding: '3px 8px', background: '#1E1E1E', border: '1px solid #333', borderRadius: 4, color: '#38BDF8' }}>
              CSV por Lotes (.csv)
            </span>
            <span style={{ padding: '3px 8px', background: '#1E1E1E', border: '1px solid #333', borderRadius: 4, color: '#38BDF8' }}>
              OpenLyrics (XML)
            </span>
            <span style={{ padding: '3px 8px', background: '#1E1E1E', border: '1px solid #333', borderRadius: 4, color: '#38BDF8' }}>
              ProPresenter 6 (.pro6)
            </span>
          </div>

          {/* File input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8' }}>
              Ruta del Archivo a Importar:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="C:\canciones\alabanza.chordpro o ruta absoluta..."
                style={{
                  flex: 1,
                  background: '#0A0A0A',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '8px 12px',
                  color: '#FFF',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleParse}
                disabled={isParsing || !filePath.trim()}
                style={{
                  background: '#38BDF8',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: isParsing || !filePath.trim() ? 'not-allowed' : 'pointer',
                  opacity: isParsing || !filePath.trim() ? 0.5 : 1
                }}
              >
                {isParsing ? 'Analizando...' : 'Examinar / Previsualizar'}
              </button>
            </div>
          </div>

          {/* Error alerts */}
          {parseErrors.length > 0 && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #EF4444',
                borderRadius: 6,
                padding: '10px 14px',
                color: '#F87171',
                fontSize: '0.85rem'
              }}
            >
              {parseErrors.map((err, idx) => (
                <div key={idx}>⚠️ {err}</div>
              ))}
            </div>
          )}

          {/* Preview list */}
          {previews.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#22C55E' }}>
                  Formato Detectado: {detectedFormat} ({previews.length} canción(es))
                </span>
                {libraries.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                    <span style={{ color: '#94A3B8' }}>Biblioteca destino:</span>
                    <select
                      value={targetLibraryId}
                      onChange={(e) => setTargetLibraryId(e.target.value)}
                      style={{
                        background: '#1A1A1A',
                        border: '1px solid #333',
                        color: '#FFF',
                        padding: '4px 8px',
                        borderRadius: 4
                      }}
                    >
                      <option value="">(Principal / Por defecto)</option>
                      {libraries.map((lib) => (
                        <option key={lib.id} value={lib.id}>
                          {lib.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid #262626',
                  borderRadius: 6,
                  background: '#0A0A0A',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                {previews.map((song, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 12px',
                      background: '#161616',
                      border: song.isDuplicate ? '1px solid #FF7A00' : '1px solid #262626',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.95rem' }}>
                        {song.title}
                      </span>
                      {song.isDuplicate && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 6px',
                            background: 'rgba(255, 122, 0, 0.2)',
                            color: '#FF7A00',
                            borderRadius: 4,
                            fontWeight: 600
                          }}
                        >
                          ⚠️ Posible duplicado existente
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', gap: 12 }}>
                      {song.artist && <span>Autor: {song.artist}</span>}
                      {song.ccliNumber && <span>CCLI #: {song.ccliNumber}</span>}
                      <span>Diapositivas estimadas: {song.totalSlides}</span>
                    </div>
                    {/* Estrofas / Grupos */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {song.groups.map((g, gi) => (
                        <span
                          key={gi}
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            background: '#222',
                            borderRadius: 3,
                            color: '#38BDF8'
                          }}
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Result Feedback */}
          {importResult && (
            <div
              style={{
                backgroundColor: importResult.success ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${importResult.success ? '#22C55E' : '#EF4444'}`,
                borderRadius: 6,
                padding: '12px 16px',
                fontSize: '0.85rem',
                color: importResult.success ? '#22C55E' : '#EF4444'
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {importResult.success ? '✅ Importación completada con éxito' : '⚠️ Fallaron algunas canciones'}
              </div>
              <div>
                Importadas: {importResult.importedCount} | Duplicados omitidos: {importResult.skippedDuplicates} | Fallidas:{' '}
                {importResult.failedCount}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #262626',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#262626',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Cerrar
          </button>
          {previews.length > 0 && (
            <button
              onClick={handleImport}
              disabled={isImporting}
              style={{
                background: '#22C55E',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 6,
                padding: '8px 20px',
                cursor: isImporting ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                opacity: isImporting ? 0.6 : 1
              }}
            >
              {isImporting ? 'Guardando en biblioteca...' : `Importar ${previews.length} Canción(es)`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
