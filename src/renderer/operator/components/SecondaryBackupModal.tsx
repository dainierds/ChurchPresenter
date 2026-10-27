import React, { useState, useEffect } from 'react'
import { SecondaryBackupConfig, SecondaryBackupStatus } from '../../../shared/types'

interface SecondaryBackupModalProps {
  isOpen: boolean
  onClose: () => void
}

export const SecondaryBackupModal: React.FC<SecondaryBackupModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<SecondaryBackupConfig>({
    enabled: false,
    targetDirectory: '',
    verifyIntegrity: true
  })
  const [status, setStatus] = useState<SecondaryBackupStatus | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      const cfg = await window.churchPresenterApi.getSecondaryBackupConfig()
      setConfig(cfg)
    } catch {
      // ignore
    }
  }

  const handleSaveConfig = async (updated: Partial<SecondaryBackupConfig>) => {
    const merged = { ...config, ...updated }
    setConfig(merged)
    try {
      await window.churchPresenterApi.saveSecondaryBackupConfig(merged)
      setStatusMessage('Configuración de respaldo externo guardada.')
    } catch {
      setStatusMessage('Error al guardar configuración.')
    }
  }

  const handleRunBackup = async () => {
    if (!config.targetDirectory.trim()) {
      setStatusMessage('Especifique la ruta de la carpeta secundaria o unidad USB.')
      return
    }

    setIsRunning(true)
    setStatusMessage('')
    try {
      // Save path first
      await window.churchPresenterApi.saveSecondaryBackupConfig({ targetDirectory: config.targetDirectory.trim() })
      const res = await window.churchPresenterApi.runSecondaryBackup()
      setStatus(res)
      if (res.success) {
        setStatusMessage(
          `✅ Respaldo secundario exitoso. Archivo: ${res.lastBackupFilename} ${
            res.verified ? '(Integridad SHA-256 verificada)' : ''
          }`
        )
      } else {
        setStatusMessage('❌ ' + (res.errorMessage || 'Error al ejecutar respaldo secundario.'))
      }
    } catch (err: any) {
      setStatusMessage('Error inesperado: ' + err?.message)
    } finally {
      setIsRunning(false)
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
          width: '90%',
          maxWidth: '700px',
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
            <span style={{ fontSize: '1.25rem' }}>💾</span>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#FF7A00' }}>
              Copias de Seguridad Secundarias (USB / Disco Externo)
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
          <div style={{ fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.4 }}>
            Duplica de forma automática o manual las copias de seguridad de la base de datos a un segundo destino
            (memoria USB, disco duro externo o carpeta de red), verificando la integridad de cada byte mediante suma
            de comprobación SHA-256.
          </div>

          {/* Toggle Strip */}
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
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Duplicación de Respaldo Habilitada</div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Copia los respaldos a la unidad secundaria tras guardarse
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleSaveConfig({ enabled: e.target.checked })}
                style={{ width: 18, height: 18, accentColor: '#22C55E' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: config.enabled ? '#22C55E' : '#94A3B8' }}>
                {config.enabled ? 'Habilitado' : 'Desactivado'}
              </span>
            </label>
          </div>

          {/* Directory Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#CBD5E1' }}>
              Ruta de Destino (Unidad USB o Carpeta Secundaria):
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={config.targetDirectory}
                onChange={(e) => setConfig({ ...config, targetDirectory: e.target.value })}
                onBlur={() => handleSaveConfig({ targetDirectory: config.targetDirectory })}
                placeholder="E:\RespaldosChurchPresenter o \\Servidor\Backups..."
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
                onClick={handleRunBackup}
                disabled={isRunning || !config.targetDirectory.trim()}
                style={{
                  background: '#22C55E',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: isRunning || !config.targetDirectory.trim() ? 'not-allowed' : 'pointer',
                  opacity: isRunning || !config.targetDirectory.trim() ? 0.6 : 1
                }}
              >
                {isRunning ? 'Verificando...' : 'Respaldar Ahora'}
              </button>
            </div>
          </div>

          {/* Integrity Check Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={config.verifyIntegrity}
              onChange={(e) => handleSaveConfig({ verifyIntegrity: e.target.checked })}
              style={{ width: 16, height: 16, accentColor: '#38BDF8' }}
            />
            <span>Verificar integridad byte a byte (Suma de comprobación SHA-256)</span>
          </label>

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

          {/* Status summary */}
          {status && (
            <div
              style={{
                background: '#161616',
                borderRadius: 8,
                border: '1px solid #262626',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: '0.85rem'
              }}
            >
              <div style={{ fontWeight: 700, color: status.success ? '#22C55E' : '#EF4444' }}>
                {status.success ? 'Estado: Copia Secundaria Verificada y Segura' : 'Estado: Falló la Copia'}
              </div>
              {status.lastBackupFilename && <div>Archivo: {status.lastBackupFilename}</div>}
              {status.lastBackupTime && <div>Fecha: {new Date(status.lastBackupTime).toLocaleString()}</div>}
              <div>Verificación SHA-256: {status.verified ? '✅ Correcta' : '❌ No realizada / Discrepancia'}</div>
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
