import React, { useState, useEffect } from 'react'
import { SyncConflictItem, SyncPackageManifest } from '../../../shared/types'

interface LibrarySyncModalProps {
  isOpen: boolean
  onClose: () => void
  onSyncCompleted?: () => void
}

export const LibrarySyncModal: React.FC<LibrarySyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted
}) => {
  const [syncFolder, setSyncFolder] = useState('')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [manifest, setManifest] = useState<SyncPackageManifest | null>(null)
  const [conflicts, setConflicts] = useState<SyncConflictItem[]>([])
  const [resolutions, setResolutions] = useState<Record<string, 'keep_local' | 'keep_remote' | 'duplicate_both'>>({})
  const [newItemsCount, setNewItemsCount] = useState(0)
  const [identicalCount, setIdenticalCount] = useState(0)

  const [isExporting, setIsExporting] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      const cfg = await window.churchPresenterApi.getSyncConfig()
      if (cfg.syncFolder) setSyncFolder(cfg.syncFolder)
      if (cfg.lastSyncAt) setLastSyncAt(cfg.lastSyncAt)
    } catch {
      // ignore
    }
  }

  const handleExport = async () => {
    if (!syncFolder.trim()) {
      setStatusMessage('Por favor especifique la carpeta de destino.')
      return
    }
    setIsExporting(true)
    setStatusMessage('')
    try {
      const res = await window.churchPresenterApi.exportSyncPackage(syncFolder.trim())
      if (res.success) {
        setStatusMessage(`✅ Paquete exportado exitosamente (${res.manifest?.counts.songs} canciones, ${res.manifest?.counts.playlists} listas).`)
        setManifest(res.manifest || null)
        loadConfig()
      } else {
        setStatusMessage('❌ Error al exportar: ' + res.error)
      }
    } catch (err: any) {
      setStatusMessage('Error inesperado: ' + err?.message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleInspect = async () => {
    if (!syncFolder.trim()) {
      setStatusMessage('Por favor especifique la carpeta donde está el paquete.')
      return
    }
    setIsInspecting(true)
    setStatusMessage('')
    try {
      const res = await window.churchPresenterApi.inspectSyncPackage(syncFolder.trim())
      if (res.success) {
        setManifest(res.manifest || null)
        setConflicts(res.conflicts)
        setNewItemsCount(res.newItemsCount)
        setIdenticalCount(res.identicalCount)

        // Initialize default resolutions to 'keep_remote'
        const initialRes: Record<string, 'keep_local' | 'keep_remote' | 'duplicate_both'> = {}
        res.conflicts.forEach((c) => {
          initialRes[c.id] = 'keep_remote'
        })
        setResolutions(initialRes)

        setStatusMessage(
          `Inspección completa: ${res.newItemsCount} nuevos, ${res.identicalCount} idénticos, ${res.conflicts.length} conflictos.`
        )
      } else {
        setStatusMessage('❌ ' + (res.error || 'No se pudo leer el paquete de sincronización.'))
      }
    } catch (err: any) {
      setStatusMessage('Error al inspeccionar: ' + err?.message)
    } finally {
      setIsInspecting(false)
    }
  }

  const handleMerge = async () => {
    setIsMerging(true)
    setStatusMessage('')
    try {
      const res = await window.churchPresenterApi.mergeSyncPackage(syncFolder.trim(), resolutions)
      if (res.success) {
        setStatusMessage(`✅ Sincronización completada. Se importaron ${res.importedCount} elementos y se actualizaron ${res.updatedCount}.`)
        setConflicts([])
        loadConfig()
        if (onSyncCompleted) onSyncCompleted()
      } else {
        setStatusMessage('❌ Error al sincronizar: ' + res.error)
      }
    } catch (err: any) {
      setStatusMessage('Error al fusionar datos: ' + err?.message)
    } finally {
      setIsMerging(false)
    }
  }

  const handleUndo = async () => {
    const confirm = window.confirm(
      '¿Desea revertir los cambios de la última sincronización restaurando la copia de seguridad previa?'
    )
    if (!confirm) return

    setIsUndoing(true)
    setStatusMessage('')
    try {
      const res = await window.churchPresenterApi.undoSync()
      if (res.success) {
        setStatusMessage(`✅ Sincronización deshecha. Se restauró el estado desde: ${res.restoredFrom}`)
        if (onSyncCompleted) onSyncCompleted()
      } else {
        setStatusMessage('❌ No se pudo deshacer: ' + (res.error || 'Error desconocido'))
      }
    } catch (err: any) {
      setStatusMessage('Error al deshacer sincronización: ' + err?.message)
    } finally {
      setIsUndoing(false)
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
            <span style={{ fontSize: '1.25rem' }}>🔄</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#38BDF8' }}>
              Sincronización de Biblioteca entre Computadoras
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
          {/* Informational description */}
          <div style={{ fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.4 }}>
            Sincronice canciones, listas de culto, temas y macros sin depender de servicios en la nube. Seleccione
            una carpeta compartida en red local, memoria USB o servicio de sincronización externo (Google Drive, OneDrive, Syncthing).
          </div>

          {/* Sync Folder Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FFFFFF' }}>
              Carpeta de Sincronización:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={syncFolder}
                onChange={(e) => setSyncFolder(e.target.value)}
                placeholder="C:\CarpetaCompartida\ChurchPresenterSync o D:\USB..."
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
                onClick={handleExport}
                disabled={isExporting || !syncFolder.trim()}
                style={{
                  background: '#FF7A00',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontWeight: 700,
                  cursor: isExporting || !syncFolder.trim() ? 'not-allowed' : 'pointer',
                  opacity: isExporting || !syncFolder.trim() ? 0.6 : 1
                }}
              >
                {isExporting ? 'Exportando...' : 'Exportar Paquete'}
              </button>
              <button
                onClick={handleInspect}
                disabled={isInspecting || !syncFolder.trim()}
                style={{
                  background: '#38BDF8',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontWeight: 700,
                  cursor: isInspecting || !syncFolder.trim() ? 'not-allowed' : 'pointer',
                  opacity: isInspecting || !syncFolder.trim() ? 0.6 : 1
                }}
              >
                {isInspecting ? 'Inspeccionando...' : 'Inspeccionar Carpeta'}
              </button>
            </div>
          </div>

          {lastSyncAt && (
            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              Última sincronización registrada: {new Date(lastSyncAt).toLocaleString()}
            </div>
          )}

          {/* Status Alert */}
          {statusMessage && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid #38BDF8',
                borderRadius: 6,
                fontSize: '0.85rem',
                color: '#38BDF8'
              }}
            >
              {statusMessage}
            </div>
          )}

          {/* Manifest & Stats after Inspect */}
          {manifest && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                background: '#161616',
                padding: 12,
                borderRadius: 8,
                border: '1px solid #262626',
                textAlign: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Canciones en Paquete</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38BDF8' }}>{manifest.counts.songs}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Nuevos Elementos</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22C55E' }}>{newItemsCount}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Ya Idénticos</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#94A3B8' }}>{identicalCount}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Conflictos</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: conflicts.length > 0 ? '#FF7A00' : '#22C55E' }}>
                  {conflicts.length}
                </div>
              </div>
            </div>
          )}

          {/* Conflict Resolution Screen */}
          {conflicts.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FF7A00' }}>
                ⚠️ Resolución de Conflictos ({conflicts.length} elementos modificados en ambos equipos):
              </div>
              <div
                style={{
                  maxHeight: '250px',
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
                {conflicts.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: 10,
                      background: '#181818',
                      borderRadius: 6,
                      border: '1px solid #333',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#FFF' }}>
                        [{c.type.toUpperCase()}] {c.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: '#94A3B8' }}>
                      <div>Local: {c.localSummary} ({c.localUpdatedAt ? new Date(c.localUpdatedAt).toLocaleTimeString() : 'N/A'})</div>
                      <div>Remoto: {c.remoteSummary} ({c.remoteUpdatedAt ? new Date(c.remoteUpdatedAt).toLocaleTimeString() : 'N/A'})</div>
                    </div>
                    {/* Resolution Choice Radios */}
                    <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', paddingTop: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`res_${c.id}`}
                          checked={resolutions[c.id] === 'keep_remote'}
                          onChange={() => setResolutions({ ...resolutions, [c.id]: 'keep_remote' })}
                          style={{ accentColor: '#22C55E' }}
                        />
                        <span style={{ color: resolutions[c.id] === 'keep_remote' ? '#22C55E' : '#94A3B8' }}>
                          Usar versión remota (Actualizar)
                        </span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`res_${c.id}`}
                          checked={resolutions[c.id] === 'keep_local'}
                          onChange={() => setResolutions({ ...resolutions, [c.id]: 'keep_local' })}
                          style={{ accentColor: '#38BDF8' }}
                        />
                        <span style={{ color: resolutions[c.id] === 'keep_local' ? '#38BDF8' : '#94A3B8' }}>
                          Conservar versión local
                        </span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`res_${c.id}`}
                          checked={resolutions[c.id] === 'duplicate_both'}
                          onChange={() => setResolutions({ ...resolutions, [c.id]: 'duplicate_both' })}
                          style={{ accentColor: '#FF7A00' }}
                        />
                        <span style={{ color: resolutions[c.id] === 'duplicate_both' ? '#FF7A00' : '#94A3B8' }}>
                          Guardar ambas (Duplicar)
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merge Trigger Button */}
          {manifest && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={handleMerge}
                disabled={isMerging}
                style={{
                  background: '#22C55E',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: isMerging ? 'not-allowed' : 'pointer',
                  opacity: isMerging ? 0.6 : 1
                }}
              >
                {isMerging ? 'Fusionando base de datos...' : 'Sincronizar y Aplicar Cambios'}
              </button>
            </div>
          )}
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
            onClick={handleUndo}
            disabled={isUndoing}
            style={{
              background: 'transparent',
              color: '#FF7A00',
              border: '1px solid #FF7A00',
              borderRadius: 6,
              padding: '6px 14px',
              cursor: isUndoing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {isUndoing ? 'Restaurando...' : '↩️ Deshacer Última Sincronización'}
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
