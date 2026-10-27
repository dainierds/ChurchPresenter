import http from 'http'
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
import { remoteAuthService, REMOTE_CONFIG_KEY } from './remote-auth-service'
import { getRemoteControlHtml, getStageViewerHtml } from './client-templates'
import { logger } from '../logger'

export const DEFAULT_REMOTE_CONFIG: RemoteServerConfig = {
  enabled: false,
  port: 8080,
  selectedIp: '0.0.0.0',
  pin: '123456',
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
  private wss: WebSocketServer | null = null
  private config: RemoteServerConfig = { ...DEFAULT_REMOTE_CONFIG }
  private clientSockets: Map<string, WebSocket> = new Map() // sessionId -> ws
  private isStartingOrStopping: boolean = false
  private actualPort: number = 8080
  private portConflictWarning: string | null = null

  public initialize(): void {
    remoteAuthService.initialize()
    this.config = this.loadConfig()
    this.config.pin = remoteAuthService.getPin()

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
    })

    // Listen to stateManager broadcasts
    stateManager.on('state-updated', (state: any) => {
      this.broadcastStateUpdate({ state })
    })

    // Listen to message service updates
    messageService.setOnMessageChange((activeMessage) => {
      this.broadcastStateUpdate({ activeMessage })
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
      if (raw) {
        return {
          ...DEFAULT_REMOTE_CONFIG,
          ...JSON.parse(raw)
        }
      }
    } catch (err) {
      logger.error('Failed to load remote server config from DB:', err)
    }
    return { ...DEFAULT_REMOTE_CONFIG }
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

    databaseService.setConfig(REMOTE_CONFIG_KEY, JSON.stringify(this.config))
    logger.info(`Remote server config saved: enabled=${this.config.enabled}, port=${this.config.port}`)

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

    const addresses: RemoteServerAddress[] = []

    if (isRunning) {
      for (const net of netInterfaces) {
        if (net.ip === '0.0.0.0') continue
        const url = `http://${net.ip}:${port}`
        let qrDataUrl = ''
        try {
          qrDataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 })
        } catch {
          // ignore qr generation error
        }

        // Generate pre-authorized Stage Viewer URL and QR Code for tablets
        const stageSession = remoteAuthService.createReadOnlyStageSession(net.ip, `Monitor Escenario (${net.name})`)
        const stageUrl = `http://${net.ip}:${port}/stage?token=${stageSession.id}`
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
        const stageSession = remoteAuthService.createReadOnlyStageSession('127.0.0.1', 'Monitor Escenario Local')
        const stageUrl = `http://127.0.0.1:${port}/stage?token=${stageSession.id}`
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
    }

    const netCategory = await this.checkWindowsNetworkCategory()

    return {
      running: isRunning,
      port,
      pin,
      addresses,
      connectedClients: remoteAuthService.getSessions(),
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

      this.isStartingOrStopping = false
      return true
    } catch (err) {
      this.isStartingOrStopping = false
      this.httpServer = null
      this.wss = null
      logger.error('Failed to start Remote Server:', err)
      return false
    }
  }

  public async stop(): Promise<boolean> {
    if (!this.httpServer && !this.wss) return true
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

      if (this.wss) {
        this.wss.close()
        this.wss = null
      }

      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer!.close(() => resolve())
        })
        this.httpServer = null
      }

      logger.info('Remote HTTP and WebSocket server stopped completely. Port is now free.')
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

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
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
      default:
        logger.warn(`Unknown or unsupported remote command received: ${msg.type}`)
    }
  }

  private broadcastStateUpdate(payload: any): void {
    if (!this.wss || this.clientSockets.size === 0) return

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
