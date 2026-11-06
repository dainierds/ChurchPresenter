import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { CameraHubService } from '../src/main/camera/camera-hub-service'
import { AcmeService } from '../src/main/camera/acme-service'
import { databaseService } from '../src/main/db/database-service'
import { RemoteAuthService } from '../src/main/remote/remote-auth-service'

describe('Fase 11: Wi-Fi Phone Cameras (PWA + WebRTC & ACME Service)', () => {
  let testDir: string
  let cameraHub: CameraHubService
  let acmeSvc: AcmeService
  let authService: RemoteAuthService

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-cam-test-'))
    const dbPath = path.join(testDir, 'test_camera.sqlite')

    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(testDir, 'backups')
    await databaseService.initialize()
    databaseService.setConfig('remote_server_pin', '654321')

    authService = new RemoteAuthService()
    authService.initialize()

    cameraHub = new CameraHubService()
    cameraHub.initialize()

    acmeSvc = new AcmeService()
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    cameraHub.removeAllListeners()
    acmeSvc.dispose()
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('1. Authentication & Role Enforcement', () => {
    it('authenticates camera with correct 6-digit PIN and issues a camera token', () => {
      // Stub databaseService to use our test db
      const spyGetConfig = vi.spyOn(cameraHub as any, 'getSettings').mockReturnValue({
        domain: 'cam.example.org',
        hasCloudflareToken: true,
        tailscaleIp: '100.73.59.102',
        maxCameras: 4,
        tokenExpiryDays: 7,
        httpsPort: 8443,
        httpPort: 8080,
        lastKnownLocalIp: '192.168.1.50',
        certStatus: { status: 'valid' }
      })

      const res = cameraHub.authenticateCamera('654321', '192.168.1.101', 'iPhone Juan')
      expect(res.success).toBe(true)
      expect(res.token).toBeDefined()
      expect(typeof res.token).toBe('string')
      expect(res.token!.length).toBe(64) // hex 32 bytes

      const verified = cameraHub.verifyCameraToken(res.token!)
      expect(verified).not.toBeNull()
      expect(verified?.device.name).toBe('iPhone Juan')
      expect(verified?.device.ip).toBe('192.168.1.101')
      expect(verified?.device.isOnline).toBe(true)

      spyGetConfig.mockRestore()
    })

    it('rejects camera authentication with incorrect PIN', () => {
      const res = cameraHub.authenticateCamera('000000', '192.168.1.101', 'iPhone Falso')
      expect(res.success).toBe(false)
      expect(res.token).toBeUndefined()
      expect(res.error).toContain('PIN incorrecto')
    })

    it('enforces maximum simultaneous camera limit (max 4)', () => {
      databaseService.saveCameraSettings({ maxCameras: 2 })

      const cam1 = cameraHub.authenticateCamera('654321', '192.168.1.101', 'Cámara 1')
      expect(cam1.success).toBe(true)
      const rec1 = cameraHub.verifyCameraToken(cam1.token!)!
      rec1.device.isStreaming = true

      const cam2 = cameraHub.authenticateCamera('654321', '192.168.1.102', 'Cámara 2')
      expect(cam2.success).toBe(true)
      const rec2 = cameraHub.verifyCameraToken(cam2.token!)!
      rec2.device.isStreaming = true

      // 3rd camera should be blocked by limit of 2
      const cam3 = cameraHub.authenticateCamera('654321', '192.168.1.103', 'Cámara 3')
      expect(cam3.success).toBe(false)
      expect(cam3.error).toContain('Límite máximo de cámaras simultáneas alcanzado')
    })
  })

  describe('2. Token Expiration & Individual Revocation', () => {
    it('revokes an individual phone camera and disconnects its session', () => {
      const auth = cameraHub.authenticateCamera('654321', '192.168.1.105', 'Galaxy S24')
      expect(auth.success).toBe(true)
      const token = auth.token!

      const record = cameraHub.verifyCameraToken(token)
      expect(record).not.toBeNull()
      const deviceId = record!.device.id

      // Mock mock WebSocket
      const mockWs = {
        close: vi.fn(),
        send: vi.fn(),
        readyState: 1
      }
      cameraHub.registerSocket(token, mockWs as any)

      // Operator revokes device
      const revoked = cameraHub.revokeDevice(deviceId)
      expect(revoked).toBe(true)
      expect(mockWs.close).toHaveBeenCalledWith(4001, expect.stringContaining('revocada'))

      // Verification fails after revocation
      const verifiedAfter = cameraHub.verifyCameraToken(token)
      expect(verifiedAfter).toBeNull()
    })

    it('expires camera token after TTL passes', () => {
      const auth = cameraHub.authenticateCamera('654321', '192.168.1.106', 'Xiaomi 13')
      const token = auth.token!

      const record = cameraHub.verifyCameraToken(token)
      expect(record).not.toBeNull()

      // Artificially expire the token
      record!.expiresAt = Date.now() - 1000

      const expiredCheck = cameraHub.verifyCameraToken(token)
      expect(expiredCheck).toBeNull()
    })
  })

  describe('3. WebRTC Signaling & mDNS Obfuscation Resolution', () => {
    it('resolves .local mDNS hostnames in WebRTC candidates with the client IP', () => {
      const auth = cameraHub.authenticateCamera('654321', '192.168.1.108', 'Pixel 9')
      const token = auth.token!

      let emittedSignal: any = null
      cameraHub.on('signal-to-renderer', (sig) => {
        emittedSignal = sig
      })

      // Simulate client sending a candidate with Chromium .local mDNS obfuscation
      const candidateMsg = JSON.stringify({
        type: 'candidate',
        candidate: {
          candidate: 'candidate:123456 1 udp 2122260223 93b6e8d1-1234-abcd-ef01-1234567890ab.local 54321 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        }
      })

      cameraHub.handleCameraMessage(token, candidateMsg)

      expect(emittedSignal).not.toBeNull()
      expect(emittedSignal.type).toBe('candidate')
      // The .local hostname must be replaced with the real IP address
      expect(emittedSignal.candidate.candidate).toContain('192.168.1.108')
      expect(emittedSignal.candidate.candidate).not.toContain('.local')
    })

    it('processes telemetry updates and computes quality scores', () => {
      const auth = cameraHub.authenticateCamera('654321', '192.168.1.109', 'OnePlus 12')
      const token = auth.token!

      // Telemetry: 30 FPS, 2400 kbps, 85% battery
      const telMsg = JSON.stringify({
        type: 'telemetry',
        telemetry: {
          actualFps: 30,
          bitrateKbps: 2400,
          batteryLevel: 85,
          isCharging: true,
          resolution: '1280x720'
        }
      })

      cameraHub.handleCameraMessage(token, telMsg)

      const rec = cameraHub.verifyCameraToken(token)!
      expect(rec.device.actualFps).toBe(30)
      expect(rec.device.bitrateKbps).toBe(2400)
      expect(rec.device.batteryLevel).toBe(85)
      expect(rec.device.isCharging).toBe(true)
      expect(rec.device.qualityRating).toBe('excelente')
    })
  })

  describe('4. Disconnect Handling & Failover Event Emission', () => {
    it('notifies renderer and emits disconnect event when camera socket terminates', () => {
      const auth = cameraHub.authenticateCamera('654321', '192.168.1.110', 'iPhone 15')
      const token = auth.token!

      const mockWs = {
        close: vi.fn(),
        send: vi.fn(),
        readyState: 1
      }
      cameraHub.registerSocket(token, mockWs as any)

      let disconnectedDevice: any = null
      cameraHub.on('camera-disconnected', (dev) => {
        disconnectedDevice = dev
      })

      // Simulate socket unregister on connection drop
      cameraHub.unregisterSocket(token)

      expect(disconnectedDevice).not.toBeNull()
      expect(disconnectedDevice.name).toBe('iPhone 15')
      expect(disconnectedDevice.isOnline).toBe(false)
      expect(disconnectedDevice.isStreaming).toBe(false)
      expect(disconnectedDevice.qualityRating).toBe('sin_senal')
    })
  })

  describe('5. ACME Service & SSL Status', () => {
    it('reports unconfigured status when domain or Cloudflare token are empty', async () => {
      const status = await acmeSvc.getCertificateStatus()
      expect(status.status).toBe('unconfigured')
      expect(status.errorMessage).toContain('no configurados')
    })

    it('generates fallback ALPN SSL certificate for local server boot when no real cert is present', async () => {
      const certs = await acmeSvc.getCertificate()
      expect(certs).toBeDefined()
      expect(certs.cert).toContain('BEGIN CERTIFICATE')
      expect(certs.key).toContain('BEGIN PRIVATE KEY')
    })
  })
})
