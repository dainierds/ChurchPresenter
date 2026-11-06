import http from 'http'
import https from 'https'
import os from 'os'
import { URL } from 'url'
import { spawn } from 'child_process'
import { WebSocketServer, WebSocket } from 'ws'
import QRCode from 'qrcode'
import {
  RemoteServerConfig,
  RemoteServerStatus,
  RemoteNetworkInterface,
  RemoteClientSession,
  RemoteServerAddress
} from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-events'
import { databaseService } from '../db/database-service'
import { stateManager } from '../state-manager'
import { windowManager } from '../window-manager'
import { masterMediaSyncService } from '../media/master-media-sync-service'
import { messageService } from '../messages/message-service'
import { stageLayoutService } from '../stage/stage-layout-service'
import { macroEngine } from '../macros/macro-engine'
import {
  remoteAuthService,
  REMOTE_CONFIG_KEY,
  REMOTE_OPERATOR_SESSION_HOURS_KEY
} from './remote-auth-service'
import { getRemoteControlHtml, getStageViewerHtml, getObsBrowserSourceHtml, getSubtitlesSenderHtml } from './client-templates'
import { liveSubtitlesService } from '../extras/live-subtitles-service'
import { acmeService } from '../camera/acme-service'
import { cameraHubService } from '../camera/camera-hub-service'
import { octoStreamService } from '../camera/octostream-service'
import { getCamSetupHtml } from '../camera/cam-setup-template'
import { getCamPwaHtml, getCamManifestJson, getCamServiceWorkerJs } from '../camera/cam-pwa-template'
import { getRemoteOperatorHtml } from './remote-operator-template'
import { broadcastEngine } from '../broadcast/broadcast-engine'
import { logger } from '../logger'

export const DEFAULT_REMOTE_CONFIG: RemoteServerConfig = {
  enabled: false,
  port: 8080,
  selectedIp: '0.0.0.0',
  pin: '123456',
  remoteOperatorPin: '888888',
  remoteOperatorSessionHours: 8,
  allowReadOnlyWithoutPin: false
}

export const FORBIDDEN_ADMIN_TYPES = [
  'save-config',
  'delete-song',
  'delete-item',
  'delete-playlist',
  'import-library',
  'export-library',
  'kick-client',
  'set-displays',
  'manage-devices',
  'clear-demo-data'
]

export class RemoteServer {
  private httpServer: http.Server | null = null
  private httpsServer: https.Server | null = null
  private wss: WebSocketServer | null = null
  private cameraWss: WebSocketServer | null = null
  private config: RemoteServerConfig = { ...DEFAULT_REMOTE_CONFIG }
  private clientSockets: Map<string, WebSocket> = new Map() // sessionId -> ws
  private remoteOperatorSockets: Map<string, WebSocket> = new Map() // sessionId -> ws
  private operatorCaptureInterval: NodeJS.Timeout | null = null
  private operatorCaptureFpsMs: number = 300
  private isStartingOrStopping: boolean = false
  private actualPort: number = 8080
  private portConflictWarning: string | null = null
  private cachedAddresses: RemoteServerAddress[] | null = null
  private cachedAddressesKey: string = ''
  private cachedStageToken: string | null = null

  public initialize(): void {
    remoteAuthService.initialize()
    cameraHubService.initialize()
    this.config = this.loadConfig()
    this.config.pin = remoteAuthService.getPin()
    this.config.remoteOperatorPin = remoteAuthService.getRemoteOperatorPin()

    // Invalidate sockets whenever PIN changes
    remoteAuthService.setOnInvalidateSessions(() => {
      for (const ws of this.clientSockets.values()) {
        try {
          ws.close(4001, 'PIN regenerado: sesión invalidada')
        } catch {
          // ignore
        }
      }
      this.clientSockets.clear()

      for (const ws of this.remoteOperatorSockets.values()) {
        try {
          ws.close(4001, 'PIN de operador remoto regenerado: sesión invalidada')
        } catch {
          // ignore
        }
      }
      this.remoteOperatorSockets.clear()
      this.stopOperatorCaptureLoop()
    })

    // Listen to stateManager broadcasts
    stateManager.on('state-updated', (state: any) => {
      this.broadcastStateUpdate({ state })
    })

    // Listen to message service updates
    messageService.setOnMessageChange((activeMessage) => {
      this.broadcastStateUpdate({ activeMessage })
    })

    // Listen to broadcast engine status updates
    broadcastEngine.on('status-changed', (st) => {
      this.broadcastBroadcastStatus(st)
    })

    // Listen to camera hub updates
    cameraHubService.on('device-updated', () => {
      this.broadcastToOperators({
        type: 'cameras-update',
        cameras: cameraHubService.getConnectedDevices()
      })
    })

    if (this.config.enabled) {
      this.start().catch((err) => {
        logger.error('Failed to auto-start remote server on initialize:', err)
      })
    }
  }

  public loadConfig(): RemoteServerConfig {
    try {
      const raw = databaseService.getConfig(REMOTE_CONFIG_KEY)
      const base = raw ? JSON.parse(raw) : {}
      return {
        ...DEFAULT_REMOTE_CONFIG,
        ...base,
        pin: remoteAuthService.getPin(),
        remoteOperatorPin: remoteAuthService.getRemoteOperatorPin(),
        remoteOperatorSessionHours:
          parseInt(databaseService.getConfig(REMOTE_OPERATOR_SESSION_HOURS_KEY) || '8', 10) || 8
      }
    } catch (err) {
      logger.error('Failed to load remote server config from DB:', err)
    }
    return {
      ...DEFAULT_REMOTE_CONFIG,
      pin: remoteAuthService.getPin(),
      remoteOperatorPin: remoteAuthService.getRemoteOperatorPin()
    }
  }

  public async saveConfig(partial: Partial<RemoteServerConfig>): Promise<RemoteServerConfig> {
    const prevPort = this.config.port
    const prevIp = this.config.selectedIp

    this.config = {
      ...this.config,
      ...partial
    }

    if (partial.pin) {
      remoteAuthService.setPin(partial.pin)
      this.config.pin = partial.pin
    }

    if (partial.remoteOperatorPin) {
      remoteAuthService.setRemoteOperatorPin(partial.remoteOperatorPin)
      this.config.remoteOperatorPin = partial.remoteOperatorPin
    }

    if (partial.remoteOperatorSessionHours) {
      databaseService.setConfig(REMOTE_OPERATOR_SESSION_HOURS_KEY, String(partial.remoteOperatorSessionHours))
      this.config.remoteOperatorSessionHours = partial.remoteOperatorSessionHours
    }

    databaseService.setConfig(REMOTE_CONFIG_KEY, JSON.stringify(this.config))
    logger.info(`Remote server config saved: enabled=${this.config.enabled}, port=${this.config.port}`)
    this.cachedAddresses = null
    this.cachedAddressesKey = ''

    // Restart server if running or config changed
    if (this.httpServer && (!this.config.enabled || prevPort !== this.config.port || prevIp !== this.config.selectedIp)) {
      await this.stop()
    }

    if (this.config.enabled && !this.httpServer) {
      await this.start()
    }

    return { ...this.config }
  }

  public getNetworkInterfaces(): RemoteNetworkInterface[] {
    const interfaces = os.networkInterfaces()
    const results: RemoteNetworkInterface[] = [
      { name: 'Todas las interfaces (0.0.0.0)', ip: '0.0.0.0', isDefault: true }
    ]

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          results.push({
            name: `${name} (${addr.address})`,
            ip: addr.address
          })
        }
      }
    }

    return results
  }

  public async checkWindowsNetworkCategory(): Promise<'Public' | 'Private' | 'DomainAuthenticated' | 'Unknown'> {
    if (process.platform !== 'win32') return 'Private'
    return new Promise((resolve) => {
      try {
        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-NetConnectionProfile | Select-Object -ExpandProperty NetworkCategory'
        ])
        let out = ''
        child.stdout.on('data', (d) => {
          out += d.toString()
        })
        child.on('close', () => {
          const trimmed = out.trim()
          if (trimmed.includes('Public')) resolve('Public')
          else if (trimmed.includes('Private')) resolve('Private')
          else if (trimmed.includes('Domain')) resolve('DomainAuthenticated')
          else resolve('Unknown')
        })
        child.on('error', () => resolve('Unknown'))
      } catch {
        resolve('Unknown')
      }
    })
  }

  public async getStatus(): Promise<RemoteServerStatus> {
    const isRunning = Boolean(this.httpServer && this.httpServer.listening)
    const pin = remoteAuthService.getPin()
    const netInterfaces = this.getNetworkInterfaces()
    const port = isRunning ? this.actualPort : (this.config.port || 8080)

    let addresses: RemoteServerAddress[] = []

    if (isRunning) {
      const cacheKey = `${port}_${Boolean(this.config.allowReadOnlyWithoutPin)}_${netInterfaces.map((n) => `${n.name}:${n.ip}`).join(';')}`

      if (this.cachedAddresses && this.cachedAddressesKey === cacheKey) {
        addresses = this.cachedAddresses
      } else {
        addresses = []

        // If allowReadOnlyWithoutPin is false and we don't have a valid cached stage token, create ONE stable token for QR
        if (!this.config.allowReadOnlyWithoutPin) {
          if (!this.cachedStageToken || !remoteAuthService.verifySession(this.cachedStageToken)) {
            const stageSess = remoteAuthService.createReadOnlyStageSession('0.0.0.0', 'Monitor Escenario (Acceso QR)')
            this.cachedStageToken = stageSess.id
          }
        } else {
          // If allowReadOnlyWithoutPin is true, revoke any old cached stage QR token
          if (this.cachedStageToken) {
            remoteAuthService.revokeSession(this.cachedStageToken)
            this.cachedStageToken = null
          }
        }

        for (const net of netInterfaces) {
          if (net.ip === '0.0.0.0') continue
          const url = `http://${net.ip}:${port}`
          let qrDataUrl = ''
          try {
            qrDataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 })
          } catch {
            // ignore qr generation error
          }

          const stageUrl = this.config.allowReadOnlyWithoutPin || !this.cachedStageToken
            ? `http://${net.ip}:${port}/stage`
            : `http://${net.ip}:${port}/stage?token=${this.cachedStageToken}`

          let stageQrDataUrl = ''
          try {
            stageQrDataUrl = await QRCode.toDataURL(stageUrl, { width: 220, margin: 2 })
          } catch {
            // ignore
          }

          addresses.push({
            interfaceName: net.name,
            ip: net.ip,
            url,
            qrDataUrl,
            stageUrl,
            stageQrDataUrl
          })
        }

        // If no external interface found, fallback to localhost
        if (addresses.length === 0) {
          const url = `http://127.0.0.1:${port}`
          let qr = ''
          try {
            qr = await QRCode.toDataURL(url, { width: 220, margin: 2 })
          } catch {
            // Ignore QR generation failure
          }
          const stageUrl = this.config.allowReadOnlyWithoutPin || !this.cachedStageToken
            ? `http://127.0.0.1:${port}/stage`
            : `http://127.0.0.1:${port}/stage?token=${this.cachedStageToken}`
          let stageQr = ''
          try {
            stageQr = await QRCode.toDataURL(stageUrl, { width: 220, margin: 2 })
          } catch {
            // Ignore stage QR generation failure
          }
          addresses.push({
            interfaceName: 'Localhost (127.0.0.1)',
            ip: '127.0.0.1',
            url,
            qrDataUrl: qr,
            stageUrl,
            stageQrDataUrl: stageQr
          })
        }

        this.cachedAddresses = addresses
        this.cachedAddressesKey = cacheKey
      }
    } else {
      this.cachedAddresses = null
      this.cachedAddressesKey = ''
      if (this.cachedStageToken) {
        remoteAuthService.revokeSession(this.cachedStageToken)
        this.cachedStageToken = null
      }
    }

    // Purge any orphan/stale stage-viewer sessions from memory (never leave ghosts!)
    for (const s of remoteAuthService.getSessions()) {
      if (s.role === 'stage-viewer' && s.id !== this.cachedStageToken && !this.clientSockets.has(s.id)) {
        remoteAuthService.revokeSession(s.id)
      }
    }

    // Filter connected clients: exclude the static QR token template, and only include stage viewers if their socket is active
    const connectedClients = remoteAuthService.getSessions().filter((s) => {
      if (this.cachedStageToken && (s.id === this.cachedStageToken || (s as any).token === this.cachedStageToken)) {
        return false
      }
      if (s.role === 'stage-viewer') {
        return this.clientSockets.has(s.id)
      }
      return true
    })

    const netCategory = await this.checkWindowsNetworkCategory()

    return {
      running: isRunning,
      port,
      pin,
      addresses,
      connectedClients,
      portConflictWarning: this.portConflictWarning,
      isWindowsPublicNetwork: netCategory === 'Public'
    }
  }

  private async getAvailablePort(startPort: number, host: string): Promise<number> {
    const isPortFree = (p: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const testServer = http.createServer()
        testServer.once('error', () => resolve(false))
        testServer.once('listening', () => {
          testServer.close(() => resolve(true))
        })
        testServer.listen(p, host)
      })
    }

    if (await isPortFree(startPort)) {
      return startPort
    }

    let nextPort = startPort + 1
    while (nextPort < startPort + 50) {
      if (await isPortFree(nextPort)) {
        return nextPort
      }
      nextPort++
    }
    return startPort
  }

  public async start(): Promise<boolean> {
    if (this.httpServer) return true
    if (this.isStartingOrStopping) return false
    this.isStartingOrStopping = true

    try {
      const desiredPort = this.config.port || 8080
      const host = this.config.selectedIp === '0.0.0.0' ? '0.0.0.0' : this.config.selectedIp

      // Detect port collisions and auto-select next available port
      const actualPort = await this.getAvailablePort(desiredPort, host)
      if (actualPort !== desiredPort) {
        this.portConflictWarning = `El puerto ${desiredPort} estaba ocupado. Se asignó automáticamente el puerto libre ${actualPort}.`
        logger.warn(this.portConflictWarning)
      } else {
        this.portConflictWarning = null
      }
      this.actualPort = actualPort

      this.httpServer = http.createServer((req, res) => {
        this.handleHttpRequest(req, res)
      })

      this.wss = new WebSocketServer({ noServer: true })

      this.httpServer.on('upgrade', (request, socket, head) => {
        this.handleWebSocketUpgrade(request, socket, head)
      })

      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(actualPort, host, () => {
          logger.info(`ChurchPresenter Remote HTTP & WebSocket Server listening on http://${host}:${actualPort}`)
          resolve()
        })
        this.httpServer!.on('error', (err) => {
          logger.error('Remote HTTP server listen error:', err)
          reject(err)
        })
      })

      // Start Camera HTTPS Server on port 8443 (Dual-listening architecture)
      try {
        const cameraSettings = databaseService.getCameraSettings()
        const httpsPort = cameraSettings.httpsPort || 8443
        const certs = await acmeService.getCertificate()

        this.httpsServer = https.createServer({ key: certs.key, cert: certs.cert }, (req, res) => {
          this.handleCameraHttpsRequest(req, res)
        })

        this.cameraWss = new WebSocketServer({ noServer: true })

        this.httpsServer.on('upgrade', (request, socket, head) => {
          this.handleCameraWebSocketUpgrade(request, socket, head)
        })

        await new Promise<void>((resolve) => {
          this.httpsServer!.listen(httpsPort, host, () => {
            logger.info(`ChurchPresenter Camera HTTPS Server listening on https://${host}:${httpsPort}`)
            resolve()
          })
          this.httpsServer!.on('error', (err) => {
            logger.warn(`Camera HTTPS server listen error on port ${httpsPort}:`, err)
            resolve()
          })
        })
      } catch (err) {
        logger.warn('Failed to start Camera HTTPS server:', err)
      }

      this.isStartingOrStopping = false
      return true
    } catch (err) {
      this.isStartingOrStopping = false
      this.httpServer = null
      this.httpsServer = null
      this.wss = null
      this.cameraWss = null
      logger.error('Failed to start Remote Server:', err)
      return false
    }
  }

  public async stop(): Promise<boolean> {
    if (!this.httpServer && !this.httpsServer && !this.wss && !this.cameraWss) return true
    if (this.isStartingOrStopping) return false
    this.isStartingOrStopping = true

    try {
      // Close all active web sockets with explicit termination code
      for (const ws of this.clientSockets.values()) {
        try {
          ws.close(1001, 'Servidor de control remoto detenido')
        } catch {
          // ignore
        }
      }
      this.clientSockets.clear()

      for (const ws of this.remoteOperatorSockets.values()) {
        try {
          ws.close(1001, 'Servidor de operador remoto detenido')
        } catch {
          // ignore
        }
      }
      this.remoteOperatorSockets.clear()
      this.stopOperatorCaptureLoop()

      if (this.wss) {
        this.wss.close()
        this.wss = null
      }

      if (this.cameraWss) {
        this.cameraWss.close()
        this.cameraWss = null
      }

      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => resolve())
        })
        this.httpServer = null
      }

      if (this.httpsServer) {
        await new Promise<void>((resolve) => {
          this.httpsServer!.close(() => resolve())
        })
        this.httpsServer = null
      }

      this.cachedAddresses = null
      this.cachedAddressesKey = ''
      if (this.cachedStageToken) {
        remoteAuthService.revokeSession(this.cachedStageToken)
        this.cachedStageToken = null
      }

      logger.info('Remote HTTP, Camera HTTPS and WebSocket servers stopped completely. Ports are now free.')
      this.isStartingOrStopping = false
      return true
    } catch (err) {
      logger.error('Error stopping Remote Server:', err)
      this.isStartingOrStopping = false
      return false
    }
  }

  public kickClient(clientId: string): boolean {
    const revoked = remoteAuthService.revokeSession(clientId)
    for (const [sid, ws] of this.clientSockets.entries()) {
      if (sid === clientId || !remoteAuthService.verifySession(sid)) {
        try {
          ws.close(4001, 'Sesión expulsada por el operador')
        } catch {
          // ignore
        }
        this.clientSockets.delete(sid)
      }
    }
    return revoked
  }

  // --- HTTP ROUTING & SECURITY ---

  private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const clientIp = this.getClientIp(req)
    const reqUrl = req.url || '/'
    let parsedUrl: URL

    try {
      parsedUrl = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('URL inválida.')
      return
    }

    const rawUrl = req.url || ''
    const pathname = parsedUrl.pathname

    // Strict Path Traversal Protection (handles raw, encoded %2e%2e and //)
    let decodedUrl = ''
    try {
      decodedUrl = decodeURIComponent(rawUrl)
    } catch {
      decodedUrl = rawUrl
    }

    if (
      pathname.includes('..') ||
      pathname.includes('//') ||
      rawUrl.includes('..') ||
      rawUrl.includes('//') ||
      decodedUrl.includes('..') ||
      decodedUrl.includes('//')
    ) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Acceso denegado: ruta no permitida.')
      return
    }

    // CORS Headers for LAN
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // OctoStream Mobile Setup Route (/setup-cam or /cam-setup)
    if (pathname === '/setup-cam' || pathname === '/cam-setup') {
      const slotId = parsedUrl.searchParams.get('id') || 'cam1'
      const slots = await octoStreamService.loadSlots()
      const slot = slots.find((s) => s.id === slotId) || slots[0]
      const { localIp, tailscaleIp } = octoStreamService.getNetworkIps()
      const html = getCamSetupHtml(slot, localIp, tailscaleIp)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // Camera Redirect / Prompt from HTTP to HTTPS
    if (pathname === '/cam' || pathname === '/cam/' || pathname === '/cam/index.html') {
      const cameraSettings = databaseService.getCameraSettings()
      const httpsPort = cameraSettings.httpsPort || 8443
      const host = (req.headers.host || 'localhost').split(':')[0]
      const targetUrl = `https://${host}:${httpsPort}/cam`
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChurchPresenter Cámara</title></head><body style="font-family:system-ui,sans-serif;background:#0a0e17;color:#fff;text-align:center;padding:40px;">
        <h2 style="color:#00D2FF;">ChurchPresenter Cámara Móvil</h2>
        <p style="color:#94a3b8;margin:16px 0;">Las cámaras en Android e iPhone requieren conexión segura (HTTPS) para habilitar el sensor de video.</p>
        <p style="margin-top:24px;"><a href="${targetUrl}" style="background:#00D2FF;color:#000;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:bold;">Abrir Cámara en HTTPS (${httpsPort})</a></p>
      </body></html>`)
      return
    }

    // 1. Mobile Operator Remote Control
    if (pathname === '/' || pathname === '/index.html') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const html = getRemoteControlHtml()
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // 2. Tablet Stage Monitor
    if (pathname === '/stage' || pathname === '/stage.html') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }

      // Check token requirement for Stage Monitor
      const token = parsedUrl.searchParams.get('token')
      const hasValidToken = token ? Boolean(remoteAuthService.verifySession(token)) : false

      if (!this.config.allowReadOnlyWithoutPin && !hasValidToken) {
        // Render Stage viewer with PIN prompt requirement
        const html = getStageViewerHtml({ requirePin: true })
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        })
        res.end(html)
        return
      }

      const html = getStageViewerHtml({ requirePin: false })
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // 2.B. OBS Browser Source Outputs (/outputs/:role?transparent=true)
    if (pathname.startsWith('/outputs/')) {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const rawRole = pathname.replace('/outputs/', '').split('/')[0] || 'audience'
      const normalizedRole = rawRole === 'main' ? 'audience' : rawRole
      const transparent = parsedUrl.searchParams.get('transparent') === 'true'
      const token = parsedUrl.searchParams.get('token')
      const hasValidToken = token ? Boolean(remoteAuthService.verifySession(token)) : false

      if (!this.config.allowReadOnlyWithoutPin && !hasValidToken && !['127.0.0.1', '::1', 'localhost'].includes(clientIp)) {
        // Enforce PIN security on external LAN requests if read-only without PIN is disabled
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Autenticación requerida para acceder a las salidas.' }))
        return
      }

      const html = getObsBrowserSourceHtml({
        role: normalizedRole,
        transparent,
        requirePin: !this.config.allowReadOnlyWithoutPin
      })
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // 2.C. Live Subtitles Web Sender (/subtitles or /subtitles.html)
    if (pathname === '/subtitles' || pathname === '/subtitles.html') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const html = getSubtitlesSenderHtml()
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // 3. API Status
    if (pathname === '/api/status') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          app: 'ChurchPresenter Remote Server',
          version: '1.1.0',
          authRequired: true
        })
      )
      return
    }

    // 4. API Authentication
    if (pathname === '/api/auth') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'POST' })
        res.end('Método no permitido.')
        return
      }
      let body = ''
      let isOversized = false
      req.on('data', (chunk) => {
        body += chunk
        // Strict body size limit: 10KB
        if (body.length > 10240) {
          isOversized = true
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }))
          req.destroy()
        }
      })
      req.on('end', () => {
        if (isOversized) return
        try {
          const payload = JSON.parse(body || '{}')
          const result = remoteAuthService.authenticate({
            pin: String(payload.pin || ''),
            ip: clientIp,
            deviceName: String(payload.deviceName || ''),
            role: payload.role === 'stage-viewer' ? 'stage-viewer' : 'operator'
          })

          if (result.success && result.session) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, token: result.session.id, role: result.session.role }))
          } else {
            const statusCode = (result.remainingLockSeconds && result.remainingLockSeconds > 0) ? 429 : 401
            res.writeHead(statusCode, { 'Content-Type': 'application/json' })
            res.end(
              JSON.stringify({
                success: false,
                error: result.error,
                remainingLockSeconds: result.remainingLockSeconds
              })
            )
          }
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Cuerpo de solicitud JSON no válido.' }))
        }
      })
      return
    }

    // Helper to extract bearer token or query token
    const extractToken = (): string | null => {
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim()
      }
      return parsedUrl.searchParams.get('token')
    }

    // 5. API State
    if (pathname === '/api/state') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const token = extractToken()
      const session = token ? remoteAuthService.verifySession(token) : null
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing or invalid token' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, state: stateManager.getState() }))
      return
    }

    // 5.B API Macros List
    if (pathname === '/api/macros' || pathname === '/api/macros/') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const token = extractToken()
      const session = token ? remoteAuthService.verifySession(token) : null
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing or invalid token' }))
        return
      }
      const macros = databaseService.getMacros().map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        icon: m.icon,
        description: m.description,
        shortcut: m.shortcut,
        actionsCount: m.actions.length
      }))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, macros }))
      return
    }

    // 5.C API Run Macro (HTTP Trigger for Stream Deck & Automations)
    if (pathname.startsWith('/api/macros/') && pathname.endsWith('/run')) {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'POST' })
        res.end('Método no permitido.')
        return
      }
      const token = extractToken()
      const session = token ? remoteAuthService.verifySession(token) : null
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing or invalid token' }))
        return
      }
      if (session.role !== 'operator') {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Read-only token cannot execute macros' }))
        return
      }
      const parts = pathname.split('/')
      const macroId = parts[3]
      if (!macroId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'ID de macro no especificado.' }))
        return
      }
      macroEngine.runMacro(macroId).then((result) => {
        const statusCode = result.success ? 200 : 400
        res.writeHead(statusCode, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      }).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: err.message }))
      })
      return
    }

    // 6. API Control
    if (pathname === '/api/control') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'POST' })
        res.end('Método no permitido.')
        return
      }
      const token = extractToken()
      const session = token ? remoteAuthService.verifySession(token) : null
      if (!session) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Missing or invalid token' }))
        return
      }
      if (session.role !== 'operator') {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Forbidden: Read-only token cannot execute control actions' }))
        return
      }

      let body = ''
      let isOversized = false
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 10240) {
          isOversized = true
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }))
          req.destroy()
        }
      })
      req.on('end', () => {
        if (isOversized) return
        try {
          const action = JSON.parse(body || '{}')
          const actionType = String(action.type || '')
          if (FORBIDDEN_ADMIN_TYPES.includes(actionType)) {
            res.writeHead(403, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: 'Unauthorized control action: administrative action not permitted' }))
            return
          }
          this.dispatchControlAction(action)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }))
        }
      })
      return
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Recurso no encontrado.')
  }

  // --- WEBSOCKET HANDLING & VALIDATION ---

  private handleWebSocketUpgrade(request: http.IncomingMessage, socket: any, head: Buffer): void {
    const clientIp = this.getClientIp(request)
    let parsedUrl: URL

    try {
      parsedUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    } catch {
      socket.destroy()
      return
    }

    if (parsedUrl.pathname !== '/ws') {
      socket.destroy()
      return
    }

    // Validate Origin header for security against malicious web sites
    const origin = request.headers['origin']
    if (origin) {
      try {
        const originUrl = new URL(origin)
        const host = originUrl.hostname
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
        const isPrivateRange =
          /^10\.\d+\.\d+\.\d+$/.test(host) ||
          /^192\.168\.\d+\.\d+$/.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)
        const isCurrentHost = host === (request.headers.host || '').split(':')[0]

        if (!isLocal && !isPrivateRange && !isCurrentHost) {
          logger.warn(`WebSocket upgrade rejected: untrusted external origin '${origin}'`)
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
          socket.destroy()
          return
        }
      } catch {
        socket.destroy()
        return
      }
    }

    const token = parsedUrl.searchParams.get('token') || ''
    const roleParam = parsedUrl.searchParams.get('role')

    let session: RemoteClientSession | null = null

    if (token) {
      session = remoteAuthService.verifySession(token)
    } else if (roleParam === 'stage-viewer' && this.config.allowReadOnlyWithoutPin) {
      // Auto-assign read-only stage session ONLY if explicitly allowed in settings
      session = remoteAuthService.createReadOnlyStageSession(clientIp, 'Monitor Escenario Tableta')
    }

    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    // If connecting with the shared cachedStageToken or if this stage session is already in use by another socket,
    // generate an individual session for this specific tablet connection
    if (session.role === 'stage-viewer' && (session.id === this.cachedStageToken || this.clientSockets.has(session.id))) {
      session = remoteAuthService.createReadOnlyStageSession(clientIp, `Monitor Escenario (${clientIp})`)
    }

    const requestedLayout = parsedUrl.searchParams.get('layout') || session.id

    this.wss!.handleUpgrade(request, socket, head, (ws) => {
      this.onWebSocketConnection(ws, session!, requestedLayout)
    })
  }

  private onWebSocketConnection(ws: WebSocket, session: RemoteClientSession, requestedLayout?: string): void {
    logger.info(`WebSocket client connected: ${session.name} [${session.role}] from ${session.ip}`)
    this.clientSockets.set(session.id, ws)

    // Resolve layout specific to this tablet or requested layout target
    const currentState = stateManager.getState()
    const activeLayout = stageLayoutService.getAssignedStageLayout(requestedLayout || session.id)
    const activeMsg = messageService.getActiveMessage()

    ws.send(
      JSON.stringify({
        type: 'init',
        state: currentState,
        stageLayout: activeLayout,
        activeMessage: activeMsg
      })
    )

    ws.on('message', (data) => {
      this.handleWebSocketMessage(ws, session, data)
    })

    ws.on('close', () => {
      this.clientSockets.delete(session.id)
      if (session.role === 'stage-viewer') {
        remoteAuthService.revokeSession(session.id)
      }
      logger.info(`WebSocket client disconnected: ${session.name} [${session.id}]`)
    })
  }

  private handleWebSocketMessage(ws: WebSocket, session: RemoteClientSession, rawData: any): void {
    // 1. Message size check (Max 64KB)
    if (rawData && rawData.length > 65536) {
      ws.send(JSON.stringify({ type: 'error', error: 'Mensaje demasiado grande (máximo 64KB).' }))
      return
    }

    let msg: any
    try {
      const text = rawData ? rawData.toString('utf-8').trim() : ''
      if (!text) return
      msg = JSON.parse(text)
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Mensaje JSON malformado.' }))
      return
    }

    // Ping / Pong for latency measurement
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t0: msg.t0 }))
      return
    }

    // Authorization check: Stage viewer is STRICTLY read-only
    if (session.role === 'stage-viewer') {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Operación denegada: esta sesión es de solo lectura (Monitor de Escenario).'
        })
      )
      return
    }

    // Minimum Privilege Enforcement: Control tokens CANNOT execute admin/destructive actions
    const FORBIDDEN_ADMIN_TYPES = [
      'save-config',
      'delete-song',
      'delete-item',
      'delete-playlist',
      'import-library',
      'export-library',
      'kick-client',
      'set-displays',
      'manage-devices'
    ]
    if (FORBIDDEN_ADMIN_TYPES.includes(msg.type)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Comando no permitido: el control remoto no tiene permisos administrativos ni de configuración.'
        })
      )
      return
    }

    // Process Operator Commands with strict payload validation
    try {
      this.dispatchControlAction(msg)
    } catch (err: any) {
      logger.error('Error executing remote command:', err)
      ws.send(JSON.stringify({ type: 'error', error: err.message || 'Error al ejecutar comando remoto.' }))
    }
  }

  private dispatchControlAction(msg: any): void {
    switch (msg.type) {
      case 'global-control':
      case 'emergency-action': {
        const action = msg.action
        if (['black', 'clear', 'logo', 'freeze'].includes(action)) {
          stateManager.toggleGlobalControl(action)
        }
        break
      }
      case 'clear-layer': {
        const layer = msg.layer
        if (['audio', 'background', 'slide', 'message', 'media', 'all'].includes(layer)) {
          windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, msg)
        }
        break
      }
      case 'send-slide': {
        if (msg.slide && typeof msg.slide.body === 'string') {
          stateManager.sendSlide(msg.slide)
        }
        break
      }
      case 'next-slide':
      case 'prev-slide':
      case 'next-item':
      case 'prev-item':
      case 'select-item': {
        windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, msg)
        break
      }
      case 'send-message': {
        if (typeof msg.text === 'string' && msg.text.trim()) {
          const target = ['stage', 'audience', 'both'].includes(msg.target) ? msg.target : 'stage'
          const duration = typeof msg.durationSeconds === 'number' ? msg.durationSeconds : undefined
          messageService.sendMessage({ text: msg.text, target, durationSeconds: duration })
        }
        break
      }
      case 'clear-message': {
        messageService.clearMessage()
        break
      }
      case 'control-video':
      case 'video-control': {
        const action = msg.command || msg.action
        if (action === 'seek-rel') {
          const delta = typeof msg.deltaSeconds === 'number' ? msg.deltaSeconds : (typeof msg.seconds === 'number' ? msg.seconds : 0)
          const currentTick = stateManager.getState().mediaSyncTick
          const curTime = currentTick?.currentTime || 0
          const newTime = Math.max(0, curTime + delta)
          masterMediaSyncService.controlVideo('seek', newTime)
        } else if (['play', 'pause', 'stop', 'seek'].includes(action)) {
          masterMediaSyncService.controlVideo(action, msg.time)
        }
        break
      }
      case 'control-timer':
      case 'timer-action': {
        const timers = databaseService.getTimers()
        if (timers.length > 0) {
          const targetTimer = msg.timerId ? timers.find((t) => t.id === msg.timerId) || timers[0] : timers[0]
          const action = msg.action
          if (action === 'start') {
            targetTimer.isRunning = true
          } else if (action === 'pause') {
            targetTimer.isRunning = false
          } else if (action === 'reset') {
            targetTimer.isRunning = false
            targetTimer.currentSeconds = targetTimer.type === 'stopwatch' ? 0 : targetTimer.durationSeconds
          }
          databaseService.saveTimer(targetTimer)
          const updated = databaseService.getTimers()
          windowManager.broadcastToAll(IPC_CHANNELS.TIMERS_TICK, updated)
          this.broadcastStateUpdate({ activeTimer: targetTimer })
        }
        break
      }
      case 'run-macro': {
        const macroId = msg.macroId || msg.id
        if (macroId) {
          macroEngine.runMacro(macroId).catch((err) => {
            logger.error(`Error running macro '${macroId}' via remote WebSocket:`, err)
          })
        }
        break
      }
      case 'subtitle':
      case 'send_subtitle': {
        if (typeof msg.text === 'string' && msg.text.trim()) {
          liveSubtitlesService.sendSubtitle({
            text: msg.text,
            translation: typeof msg.translation === 'string' ? msg.translation : undefined,
            targetRoles: Array.isArray(msg.targetRoles) ? msg.targetRoles : undefined,
            durationSec: typeof msg.durationSec === 'number' ? msg.durationSec : undefined
          })
        }
        break
      }
      case 'clear_subtitle':
      case 'clear-subtitle': {
        liveSubtitlesService.clearSubtitle()
        break
      }
      default:
        logger.warn(`Unknown or unsupported remote command received: ${msg.type}`)
    }
  }

  private broadcastStateUpdate(payload: any): void {
    if ((!this.wss || this.clientSockets.size === 0) && this.remoteOperatorSockets.size === 0) return

    const message = JSON.stringify({
      type: 'state-update',
      ...payload
    })

    for (const ws of this.clientSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message)
        } catch {
          // ignore broken socket
        }
      }
    }

    for (const ws of this.remoteOperatorSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message)
        } catch {
          // ignore broken socket
        }
      }
    }
  }

  // --- CAMERA HTTPS ROUTING & WEBSOCKET HANDLING (PHASE 11) ---

  private handleCameraHttpsRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const clientIp = this.getClientIp(req)
    const reqUrl = req.url || '/'
    let parsedUrl: URL

    try {
      parsedUrl = new URL(reqUrl, `https://${req.headers.host || 'localhost'}`)
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('URL inválida.')
      return
    }

    const pathname = parsedUrl.pathname

    // Strict Path Traversal Protection
    if (pathname.includes('..') || pathname.includes('//')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Acceso denegado: ruta no permitida.')
      return
    }

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // 1. Remote Operator HTML (/operator)
    if (pathname === '/operator' || pathname === '/operator/' || pathname === '/operator/index.html') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const cameraSettings = databaseService.getCameraSettings()
      const html = getRemoteOperatorHtml({
        tailscaleIp: cameraSettings.tailscaleIp || '100.73.59.102',
        churchIp: clientIp
      })
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // 2. Remote Operator Auth API (/api/operator-auth)
    if (pathname === '/api/operator-auth') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
        res.end(JSON.stringify({ success: false, error: 'Método no permitido.' }))
        return
      }

      let body = ''
      let isOversized = false
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 10240) {
          isOversized = true
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }))
          req.destroy()
        }
      })
      req.on('end', () => {
        if (isOversized) return
        try {
          const payload = JSON.parse(body || '{}')
          const result = remoteAuthService.authenticate({
            pin: String(payload.pin || ''),
            ip: clientIp,
            deviceName: payload.deviceName ? String(payload.deviceName) : 'Laptop Remota (Tailscale)',
            role: 'remote-operator'
          })
          const statusCode = result.success ? 200 : 401
          res.writeHead(statusCode, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              success: result.success,
              token: result.session?.id,
              role: 'remote-operator',
              error: result.error
            })
          )
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Cuerpo de solicitud JSON no válido.' }))
        }
      })
      return
    }

    // 3. Remote Operator Initial State API (/api/operator-state)
    if (pathname === '/api/operator-state') {
      const token =
        parsedUrl.searchParams.get('token') || (req.headers.authorization || '').replace('Bearer ', '').trim()
      const session = remoteAuthService.verifySession(token)
      if (!session || session.role !== 'remote-operator') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Unauthorized: Sesión de operador remoto no válida.' }))
        return
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          state: stateManager.getState(),
          scenes: databaseService.getBroadcastScenes(),
          cameras: cameraHubService.getConnectedDevices(),
          timers: databaseService.getTimers(),
          broadcastStatus: broadcastEngine.getStatus()
        })
      )
      return
    }

    // Strict Security Isolation: Port 8443 does NOT serve unauthenticated control actions, presentation slides, or macros
    if (
      pathname.startsWith('/api/state') ||
      pathname.startsWith('/api/control') ||
      pathname.startsWith('/api/macros') ||
      pathname.startsWith('/stage') ||
      pathname.startsWith('/outputs')
    ) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: false,
          error: 'Acceso denegado: el puerto seguro 8443 está reservado para la transmisión de cámaras PWA y el operador remoto.'
        })
      )
      return
    }

    // 4. Camera PWA HTML
    if (pathname === '/cam' || pathname === '/cam/' || pathname === '/cam/index.html' || pathname === '/') {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain', Allow: 'GET' })
        res.end('Método no permitido.')
        return
      }
      const html = getCamPwaHtml()
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(html)
      return
    }

    // 5. Camera Web App Manifest
    if (pathname === '/cam/manifest.json') {
      res.writeHead(200, {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'public, max-age=86400'
      })
      res.end(getCamManifestJson())
      return
    }

    // 6. Camera Service Worker
    if (pathname === '/cam/sw.js') {
      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      })
      res.end(getCamServiceWorkerJs())
      return
    }

    // 7. Camera Authentication API
    if (pathname === '/api/cam-auth') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
        res.end(JSON.stringify({ success: false, error: 'Método no permitido.' }))
        return
      }

      let body = ''
      let isOversized = false
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > 10240) {
          isOversized = true
          res.writeHead(413, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }))
          req.destroy()
        }
      })
      req.on('end', () => {
        if (isOversized) return
        try {
          const payload = JSON.parse(body || '{}')
          const result = cameraHubService.authenticateCamera(
            String(payload.pin || ''),
            clientIp,
            payload.deviceName ? String(payload.deviceName) : undefined
          )
          const statusCode = result.success ? 200 : 401
          res.writeHead(statusCode, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Cuerpo de solicitud JSON no válido.' }))
        }
      })
      return
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Recurso no encontrado.')
  }

  private handleCameraWebSocketUpgrade(request: http.IncomingMessage, socket: any, head: Buffer): void {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(request.url || '/', `https://${request.headers.host || 'localhost'}`)
    } catch {
      socket.destroy()
      return
    }

    const pathname = parsedUrl.pathname
    const token = parsedUrl.searchParams.get('token') || ''

    // Route A: Camera WebRTC Signaling (/cam-ws)
    if (pathname === '/cam-ws' || (pathname === '/ws' && parsedUrl.searchParams.get('role') === 'camera')) {
      const record = cameraHubService.verifyCameraToken(token)
      if (!record) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      if (!this.cameraWss) {
        socket.destroy()
        return
      }

      this.cameraWss.handleUpgrade(request, socket, head, (ws) => {
        const registered = cameraHubService.registerSocket(token, ws)
        if (!registered) return

        ws.on('message', (data) => {
          cameraHubService.handleCameraMessage(token, data.toString('utf8'))
        })

        ws.on('close', () => {
          cameraHubService.unregisterSocket(token)
        })
      })
      return
    }

    // Route B: Remote Operator WebSocket (/operator-ws)
    if (
      pathname === '/operator-ws' ||
      (pathname === '/ws' && parsedUrl.searchParams.get('role') === 'remote-operator')
    ) {
      const session = remoteAuthService.verifySession(token)
      if (!session || session.role !== 'remote-operator') {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }

      if (!this.cameraWss) {
        socket.destroy()
        return
      }

      this.cameraWss.handleUpgrade(request, socket, head, (ws) => {
        this.onRemoteOperatorWebSocketConnection(ws, session)
      })
      return
    }

    socket.destroy()
  }

  // --- REMOTE OPERATOR WEBSOCKET & MONITOR CAPTURE ---

  private onRemoteOperatorWebSocketConnection(ws: WebSocket, session: RemoteClientSession): void {
    logger.info(`Remote Operator connected: ${session.name} [${session.id}] from ${session.ip}`)
    this.remoteOperatorSockets.set(session.id, ws)

    this.broadcastOperatorCount()

    // Send complete initial state
    const currentState = stateManager.getState()
    const scenes = databaseService.getBroadcastScenes()
    const cameras = cameraHubService.getConnectedDevices()
    const timers = databaseService.getTimers()
    const broadcastStatus = broadcastEngine.getStatus()

    try {
      ws.send(
        JSON.stringify({
          type: 'init',
          state: currentState,
          scenes,
          cameras,
          timers,
          broadcastStatus,
          operatorCount: this.clientSockets.size + this.remoteOperatorSockets.size
        })
      )
    } catch {
      // ignore
    }

    // Start video frame capture loop for remote monitor
    this.startOperatorCaptureLoop()

    ws.on('message', (data) => {
      this.handleRemoteOperatorMessage(ws, session, data)
    })

    ws.on('close', () => {
      this.remoteOperatorSockets.delete(session.id)
      logger.info(`Remote Operator disconnected: ${session.name} [${session.id}]`)
      this.broadcastOperatorCount()
      if (this.remoteOperatorSockets.size === 0) {
        this.stopOperatorCaptureLoop()
      }
    })
  }

  private handleRemoteOperatorMessage(ws: WebSocket, session: RemoteClientSession, rawData: any): void {
    if (rawData && rawData.length > 65536) {
      ws.send(JSON.stringify({ type: 'error', error: 'Mensaje demasiado grande (máximo 64KB).' }))
      return
    }

    let msg: any
    try {
      const text = rawData ? rawData.toString('utf-8').trim() : ''
      if (!text) return
      msg = JSON.parse(text)
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'Mensaje JSON malformado.' }))
      return
    }

    // Ping / Pong for latency measurement
    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', t0: msg.t0 }))
      return
    }

    // Adaptive framerate adjustment for high Tailscale latency
    if (msg.type === 'adaptive-framerate') {
      const latency = typeof msg.latencyMs === 'number' ? msg.latencyMs : 0
      if (latency > 200) {
        this.operatorCaptureFpsMs = 1000 // 1 FPS on high latency
      } else {
        this.operatorCaptureFpsMs = 300 // ~3.3 FPS on good latency
      }
      return
    }

    // Check sliding renewal
    remoteAuthService.verifySession(session.id)

    // Minimum privilege check: Block forbidden admin types (changing PIN, revoking devices, certs, deleting songs)
    if (FORBIDDEN_ADMIN_TYPES.includes(msg.type) || FORBIDDEN_ADMIN_TYPES.includes(msg.action)) {
      ws.send(JSON.stringify({ type: 'error', error: 'Acción prohibida para el rol de operador remoto.' }))
      return
    }

    // Audit log every action with timestamp and IP
    remoteAuthService.auditLog(session, msg.type, msg)

    // Dispatch action
    switch (msg.type) {
      case 'global-control':
      case 'emergency-action': {
        const action = msg.action
        if (['black', 'clear', 'logo', 'freeze'].includes(action)) {
          stateManager.toggleGlobalControl(action)
        }
        break
      }
      case 'clear-layer': {
        const layer = msg.layer
        if (['audio', 'background', 'slide', 'message', 'media', 'all'].includes(layer)) {
          windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, msg)
        }
        break
      }
      case 'next-slide':
      case 'prev-slide':
      case 'next-item':
      case 'prev-item':
      case 'select-item':
      case 'select-slide': {
        windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.REMOTE_ACTION_DISPATCH, msg)
        break
      }
      case 'send-slide': {
        if (msg.slide && typeof msg.slide.body === 'string') {
          stateManager.sendSlide(msg.slide)
        }
        break
      }
      case 'send-message': {
        if (typeof msg.text === 'string' && msg.text.trim()) {
          const target = ['stage', 'audience', 'both'].includes(msg.target) ? msg.target : 'stage'
          const duration = typeof msg.durationSeconds === 'number' ? msg.durationSeconds : undefined
          messageService.sendMessage({ text: msg.text, target, durationSeconds: duration })
        }
        break
      }
      case 'clear-message': {
        messageService.clearMessage()
        break
      }
      case 'control-timer': {
        const timers = databaseService.getTimers()
        if (timers.length > 0) {
          const targetTimer = msg.timerId ? timers.find((t) => t.id === msg.timerId) || timers[0] : timers[0]
          const action = msg.action
          if (action === 'start') {
            targetTimer.isRunning = true
          } else if (action === 'pause') {
            targetTimer.isRunning = false
          } else if (action === 'reset') {
            targetTimer.isRunning = false
            targetTimer.currentSeconds = targetTimer.type === 'stopwatch' ? 0 : targetTimer.durationSeconds
          }
          databaseService.saveTimer(targetTimer)
          const updated = databaseService.getTimers()
          windowManager.broadcastToAll(IPC_CHANNELS.TIMERS_TICK, updated)
          this.broadcastToOperators({ type: 'timers-tick', timers: updated })
        }
        break
      }
      case 'studio-set-scene': {
        if (msg.sceneId) {
          const state = stateManager.getState()
          if (msg.target === 'preview') {
            state.activeStudioPreviewSceneId = msg.sceneId
          } else {
            state.activeStudioProgramSceneId = msg.sceneId
          }
          stateManager.emit('state-updated', state)
          windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.BROADCAST_SET_ACTIVE_SCENE, {
            sceneId: msg.sceneId,
            target: msg.target || 'program',
            transition: msg.transition,
            duration: msg.duration
          })
          this.broadcastToOperators({
            type: 'scenes-update',
            scenes: databaseService.getBroadcastScenes()
          })
        }
        break
      }
      case 'studio-transition': {
        windowManager.getOperatorWindow()?.webContents.send(IPC_CHANNELS.BROADCAST_SET_ACTIVE_SCENE, {
          transition: msg.transition || 'fade',
          duration: msg.duration || 500
        })
        break
      }
      case 'studio-start-stream': {
        broadcastEngine.start({ stream: true }).then(() => {
          this.broadcastBroadcastStatus()
        })
        break
      }
      case 'studio-stop-stream': {
        broadcastEngine.stop({ stream: true }).then(() => {
          this.broadcastBroadcastStatus()
        })
        break
      }
      case 'studio-start-record': {
        broadcastEngine.start({ record: true }).then(() => {
          this.broadcastBroadcastStatus()
        })
        break
      }
      case 'studio-stop-record': {
        broadcastEngine.stop({ record: true }).then(() => {
          this.broadcastBroadcastStatus()
        })
        break
      }
      case 'camera-mute-device': {
        if (msg.deviceId) {
          cameraHubService.toggleAudio(msg.deviceId, Boolean(msg.audioMuted))
          this.broadcastToOperators({
            type: 'cameras-update',
            cameras: cameraHubService.getConnectedDevices()
          })
        }
        break
      }
    }
  }

  private startOperatorCaptureLoop(): void {
    if (this.operatorCaptureInterval) return
    this.operatorCaptureInterval = setInterval(async () => {
      if (this.remoteOperatorSockets.size === 0) {
        this.stopOperatorCaptureLoop()
        return
      }

      try {
        const jpegBuf = await windowManager.captureProgramJpeg(320, 180)
        if (jpegBuf && this.remoteOperatorSockets.size > 0) {
          const base64 = jpegBuf.toString('base64')
          const msg = JSON.stringify({ type: 'program-frame', frame: base64, timestamp: Date.now() })
          for (const ws of this.remoteOperatorSockets.values()) {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(msg)
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // ignore capture errors
      }
    }, this.operatorCaptureFpsMs)
  }

  private stopOperatorCaptureLoop(): void {
    if (this.operatorCaptureInterval) {
      clearInterval(this.operatorCaptureInterval)
      this.operatorCaptureInterval = null
    }
  }

  public broadcastToOperators(payload: any): void {
    const msg = JSON.stringify(payload)
    for (const ws of this.remoteOperatorSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg)
        } catch {
          // ignore
        }
      }
    }
  }

  public broadcastBroadcastStatus(status?: any): void {
    const st = status || broadcastEngine.getStatus()
    this.broadcastToOperators({ type: 'broadcast-status', status: st })
  }

  private broadcastOperatorCount(): void {
    const total = this.clientSockets.size + this.remoteOperatorSockets.size
    const msg = JSON.stringify({ type: 'operator-count', operatorCount: total })
    for (const ws of this.remoteOperatorSockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg)
        } catch {
          // ignore
        }
      }
    }
  }

  private getClientIp(req: http.IncomingMessage): string {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim()
    }
    return req.socket.remoteAddress || '127.0.0.1'
  }
}

export const remoteServer = new RemoteServer()
