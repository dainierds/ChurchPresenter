import React from 'react'
import { RefreshCw, X, AlertTriangle } from 'lucide-react'
import { FileChangedEvent } from '../../../shared/types'

interface FileWatcherToastProps {
  event: FileChangedEvent | null
  onRefresh: (event: FileChangedEvent) => void
  onDismiss: () => void
}

export const FileWatcherToast: React.FC<FileWatcherToastProps> = ({
  event,
  onRefresh,
  onDismiss
}) => {
  if (!event) return null

  const fileName = event.filePath.split(/[\\/]/).pop() || event.filePath

  return (
    <div className="pro-watcher-toast">
      <div className="pro-watcher-icon-box">
        <AlertTriangle size={16} />
      </div>

      <div className="pro-watcher-content">
        <div className="pro-watcher-title">Archivo externo modificado</div>
        <div className="pro-watcher-desc">
          "{fileName}" fue actualizado fuera de ChurchPresenter.
        </div>
      </div>

      <div className="pro-watcher-actions">
        <button
          className="pro-watcher-btn-refresh"
          onClick={() => onRefresh(event)}
          title="Recargar archivo manteniendo posición en el servicio"
        >
          <RefreshCw size={12} />
          <span>Actualizar</span>
        </button>
        <button
          className="pro-watcher-btn-close"
          onClick={onDismiss}
          title="Descartar aviso"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
