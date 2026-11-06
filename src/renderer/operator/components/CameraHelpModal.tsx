import React, { useState } from 'react'
import { X, Smartphone, QrCode, AlertTriangle, CheckCircle2, Copy, Check } from 'lucide-react'

interface CameraHelpModalProps {
  isOpen: boolean
  onClose: () => void
  cameraUrl: string
  qrDataUrl: string
}

export const CameraHelpModal: React.FC<CameraHelpModalProps> = ({
  isOpen,
  onClose,
  cameraUrl,
  qrDataUrl
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android')
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(cameraUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-backdrop" style={{ zIndex: 99999 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: 680,
          backgroundColor: '#0F172A',
          border: '1px solid #1E293B',
          borderRadius: 12,
          color: '#F8FAFC'
        }}
      >
        <div className="modal-header" style={{ borderBottom: '1px solid #1E293B', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone size={22} color="#00D2FF" />
            <span style={{ fontSize: 17, fontWeight: 700 }}>Cómo instalar la PWA de Cámara en Teléfonos</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} style={{ color: '#94A3B8' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* QR Code and Quick URL Box */}
          <div
            style={{
              display: 'flex',
              gap: 20,
              backgroundColor: '#0A0E17',
              border: '1px solid #1E293B',
              borderRadius: 10,
              padding: 16,
              alignItems: 'center',
              marginBottom: 20
            }}
          >
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Código QR de Cámara"
                style={{ width: 140, height: 140, borderRadius: 8, backgroundColor: '#fff', padding: 6 }}
              />
            ) : (
              <div
                style={{
                  width: 140,
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1E293B',
                  borderRadius: 8
                }}
              >
                <QrCode size={48} color="#64748B" />
              </div>
            )}

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#00D2FF', marginBottom: 4 }}>
                PASO 1: ESCANEE CON LA CÁMARA DEL TELÉFONO
              </div>
              <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12, lineHeight: 1.4 }}>
                Abra la cámara del teléfono y apunte a este código QR para abrir la interfaz de transmisión.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="text"
                  readOnly
                  value={cameraUrl}
                  style={{
                    flex: 1,
                    backgroundColor: '#1E293B',
                    border: '1px solid #334155',
                    color: '#F8FAFC',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    backgroundColor: '#00D2FF',
                    color: '#000',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* OS Switcher Tabs */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeTab === 'android' ? '#00D2FF' : '#1E293B',
                color: activeTab === 'android' ? '#000' : '#94A3B8',
                border: 'none',
                transition: 'all 0.2s'
              }}
            >
              📱 Android (Google Chrome)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeTab === 'ios' ? '#00D2FF' : '#1E293B',
                color: activeTab === 'ios' ? '#000' : '#94A3B8',
                border: 'none',
                transition: 'all 0.2s'
              }}
            >
              🍎 iPhone (Apple Safari)
            </button>
          </div>

          {/* Android Steps */}
          {activeTab === 'android' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>1</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Conexión a la red Wi-Fi</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    Asegúrese de conectar el teléfono a la red Wi-Fi de 5 GHz de la iglesia (la misma subred de la PC).
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>2</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Instalar como aplicación (PWA)</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    En Google Chrome, toque el menú de tres puntos (⋮) en la esquina superior derecha y elija <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>3</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Autenticación con PIN de 6 dígitos</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    Introduzca el PIN de 6 dígitos del operador. El teléfono guardará el token de forma segura durante 7 días para no requerir PIN en futuros cultos.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>4</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Orientación Horizontal & Transmisión</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    Gire el teléfono a posición horizontal y presione <strong>"▶ Iniciar Transmisión"</strong>. La cámara emitirá en 720p a 30 FPS hacia el panel de Estudio de ChurchPresenter.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* iOS Steps */}
          {activeTab === 'ios' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>1</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Abrir exclusivamente en Safari</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    En iOS, el acceso a la cámara y WebRTC para PWA está restringido por Apple al motor Safari. No use Chrome ni Firefox en iPhone.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>2</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Agregar al Inicio (Home Screen)</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    Toque el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba en la barra inferior) y seleccione <strong>"Agregar al inicio"</strong>.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ backgroundColor: '#1E293B', color: '#00D2FF', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>3</span>
                <div>
                  <strong style={{ color: '#F8FAFC', fontSize: 14 }}>Permisos y PIN</strong>
                  <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    Abra el icono creado en la pantalla de inicio, conceda permisos de Cámara y Micrófono e introduzca el PIN de 6 dígitos.
                  </p>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  borderRadius: 8,
                  padding: 12,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  marginTop: 6
                }}
              >
                <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#FCA5A5', lineHeight: 1.4 }}>
                  <strong>Aviso Crítico para iPhone:</strong> iOS detiene automáticamente el sensor de video de la cámara si la pantalla se bloquea o si cambia a otra aplicación. Mantenga la pantalla encendida y la app visible en primer plano durante el culto.
                </span>
              </div>
            </div>
          )}

          {/* General Tips */}
          <div
            style={{
              marginTop: 20,
              padding: 14,
              backgroundColor: '#0A0E17',
              border: '1px solid #1E293B',
              borderRadius: 8
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <CheckCircle2 size={15} />
              RECOMENDACIONES PARA EL OPERADOR
            </div>
            <ul style={{ fontSize: 12, color: '#94A3B8', paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Mantenga los teléfonos conectados a cargadores para evitar que el ahorro de batería ralentice los fotogramas.</li>
              <li>Ajuste el brillo de la pantalla del teléfono al mínimo para evitar sobrecalentamiento en transmisiones largas.</li>
              <li>El operador puede silenciar o activar el micrófono de cada teléfono individualmente desde el estudio.</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid #1E293B', padding: '14px 20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="primary-action-btn"
            onClick={onClose}
            style={{ backgroundColor: '#00D2FF', color: '#000', fontWeight: 700 }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
