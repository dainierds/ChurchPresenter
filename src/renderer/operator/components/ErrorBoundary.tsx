import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  panelName?: string
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error(`[ErrorBoundary] Error caught in panel "${this.props.panelName || 'Unknown'}":`, error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className="pro-error-boundary-card"
          style={{
            margin: '24px',
            padding: '24px',
            backgroundColor: '#1E1E1E',
            border: '1px solid #DC2626',
            borderRadius: '8px',
            color: '#F3F4F6',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: 'rgba(220, 38, 38, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444'
              }}
            >
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#F9FAFB' }}>
                Error al cargar {this.props.panelName ? `el panel "${this.props.panelName}"` : 'este componente'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9CA3AF' }}>
                El resto de la aplicación y las pantallas de salida continúan funcionando normalmente.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              className="primary-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#2563EB',
                border: 'none',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              <RefreshCw size={14} />
              <span>Reintentar</span>
            </button>

            <button
              type="button"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'transparent',
                border: '1px solid #374151',
                color: '#D1D5DB',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <span>{this.state.showDetails ? 'Ocultar detalles' : 'Ver detalles técnicos'}</span>
              {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {this.state.showDetails && (
            <div
              style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: '#111827',
                borderRadius: '6px',
                border: '1px solid #374151',
                fontSize: '12px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                color: '#F87171',
                maxHeight: '200px',
                overflowY: 'auto'
              }}
            >
              <div>{this.state.error?.toString()}</div>
              {this.state.errorInfo?.componentStack && (
                <pre style={{ margin: '8px 0 0', color: '#9CA3AF', whiteSpace: 'pre-wrap' }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
