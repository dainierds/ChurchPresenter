import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Configure worker using local bundled worker or inline fallback
if (typeof window !== 'undefined' && !(pdfjsLib as any).GlobalWorkerOptions.workerSrc) {
  // Use ESM worker or standard build
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()
}

interface PdfPageViewProps {
  pdfUrl: string
  pageNumber: number
  fitMode?: 'contain' | 'cover' | 'center'
  className?: string
  onPageRendered?: () => void
}

export const PdfPageView: React.FC<PdfPageViewProps> = ({
  pdfUrl,
  pageNumber,
  fitMode = 'contain',
  className = '',
  onPageRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const renderPage = async () => {
      setLoading(true)
      setError(null)

      try {
        const canvas = canvasRef.current
        if (!canvas) return

        // Fetch PDF document
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true
        })

        const pdfDoc = await loadingTask.promise
        if (isCancelled) return

        const page = await pdfDoc.getPage(pageNumber)
        if (isCancelled) return

        const container = containerRef.current
        const containerWidth = container ? container.clientWidth || 1920 : 1920
        const containerHeight = container ? container.clientHeight || 1080 : 1080

        const unscaledViewport = page.getViewport({ scale: 1.0 })
        const scaleX = containerWidth / unscaledViewport.width
        const scaleY = containerHeight / unscaledViewport.height

        let scale = scaleX
        if (fitMode === 'contain') {
          scale = Math.min(scaleX, scaleY)
        } else if (fitMode === 'cover') {
          scale = Math.max(scaleX, scaleY)
        }

        // Account for Retina / HiDPI crispness
        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: scale * dpr })

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / dpr}px`
        canvas.style.height = `${viewport.height / dpr}px`

        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) return

        const renderContext = {
          canvasContext: ctx,
          viewport,
          canvas
        }

        await page.render(renderContext).promise
        if (isCancelled) return

        setLoading(false)
        onPageRendered?.()

        // Background preload next page for instant navigation
        if (pageNumber < pdfDoc.numPages) {
          pdfDoc.getPage(pageNumber + 1).catch(() => {})
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Error al cargar página PDF')
          setLoading(false)
        }
      }
    }

    renderPage()

    return () => {
      isCancelled = true
    }
  }, [pdfUrl, pageNumber, fitMode, onPageRendered])

  return (
    <div
      ref={containerRef}
      className={`pdf-page-container ${fitMode} ${className}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#000000'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: fitMode === 'contain' ? '100%' : 'none',
          maxHeight: fitMode === 'contain' ? '100%' : 'none',
          objectFit: fitMode as any,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)'
        }}
      />
      {loading && (
        <div
          style={{
            position: 'absolute',
            color: '#94a3b8',
            fontSize: 13,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            padding: '6px 14px',
            borderRadius: 6
          }}
        >
          Cargando página {pageNumber}...
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            color: '#ef4444',
            fontSize: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            padding: '8px 14px',
            borderRadius: 6
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
