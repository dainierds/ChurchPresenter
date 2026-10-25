import React from 'react'
import { UploadCloud } from 'lucide-react'

interface FileDropOverlayProps {
  isDragging: boolean
}

export const FileDropOverlay: React.FC<FileDropOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null

  return (
    <div className="pro-drop-overlay">
      <div className="pro-drop-modal-box">
        <UploadCloud size={48} className="pro-drop-icon" />
        <h2 className="pro-drop-title">Importación Rápida de Archivos</h2>
        <p className="pro-drop-subtitle">
          Suelte presentaciones PowerPoint (.pptx), documentos PDF, videos (.mp4, .webm) o imágenes para importarlos a la biblioteca
        </p>
        <div className="pro-drop-supported-tags">
          <span className="pro-drop-tag">PowerPoint (.pptx)</span>
          <span className="pro-drop-tag">Documentos (.pdf)</span>
          <span className="pro-drop-tag">Videos (.mp4, .webm)</span>
          <span className="pro-drop-tag">Imágenes (.jpg, .png)</span>
        </div>
      </div>
    </div>
  )
}
