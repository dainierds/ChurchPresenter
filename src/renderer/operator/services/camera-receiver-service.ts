import { PhoneCameraDevice, CameraSignalMessage } from '../../../shared/types'

export type StreamChangeCallback = (cameraId: string, stream: MediaStream | null) => void
export type DeviceChangeCallback = (devices: PhoneCameraDevice[]) => void

export class CameraReceiverService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private mediaStreams: Map<string, MediaStream> = new Map()
  private canvasMap: Map<string, HTMLCanvasElement> = new Map()
  private ctxMap: Map<string, CanvasRenderingContext2D> = new Map()
  private lastFrameTimes: Map<string, number> = new Map()
  private frameWatchdog: NodeJS.Timeout | null = null
  private devices: PhoneCameraDevice[] = []
  private streamListeners: Set<StreamChangeCallback> = new Set()
  private deviceListeners: Set<DeviceChangeCallback> = new Set()
  private unsubSignals: (() => void) | null = null
  private unsubDevices: (() => void) | null = null
  private unsubFrames: (() => void) | null = null
  private isInitialized = false

  public initialize(): void {
    if (this.isInitialized) return
    this.isInitialized = true

    if (window.churchPresenterApi?.onCameraSignal) {
      this.unsubSignals = window.churchPresenterApi.onCameraSignal((signal: CameraSignalMessage) => {
        this.handleIncomingSignal(signal)
      })
    }

    if (window.churchPresenterApi?.onPhoneCameraUpdated) {
      this.unsubDevices = window.churchPresenterApi.onPhoneCameraUpdated((devs: PhoneCameraDevice[]) => {
        this.devices = devs
        this.notifyDeviceListeners()
      })
    }

    if (window.churchPresenterApi?.onCameraFrame) {
      this.unsubFrames = window.churchPresenterApi.onCameraFrame((data) => {
        this.handleCameraFrame(data.cameraId, data.frame)
      })
    }

    this.frameWatchdog = setInterval(() => {
      const now = Date.now()
      for (const [camId, lastTime] of this.lastFrameTimes.entries()) {
        if (now - lastTime > 3000) {
          this.lastFrameTimes.delete(camId)
          if (this.mediaStreams.has(camId)) {
            this.mediaStreams.delete(camId)
            this.notifyStreamListeners(camId, null)
          }
        }
      }
    }, 1000)

    this.refreshDevices()
  }

  private handleCameraFrame(cameraId: string, base64: string): void {
    this.lastFrameTimes.set(cameraId, Date.now())

    let canvas = this.canvasMap.get(cameraId)
    let ctx = this.ctxMap.get(cameraId)
    if (!canvas || !ctx) {
      canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const context = canvas.getContext('2d')
      if (context) {
        ctx = context
        this.canvasMap.set(cameraId, canvas)
        this.ctxMap.set(cameraId, context)
      }
    }

    if (!ctx || !canvas) return

    const img = new Image()
    img.onload = () => {
      ctx!.drawImage(img, 0, 0, 1280, 720)
      if (!this.mediaStreams.has(cameraId)) {
        try {
          const stream = canvas!.captureStream(30)
          this.mediaStreams.set(cameraId, stream)
          this.notifyStreamListeners(cameraId, stream)
        } catch (e) {
          console.warn('captureStream error:', e)
        }
      }
    }
    img.src = 'data:image/jpeg;base64,' + base64
  }

  public async refreshDevices(): Promise<PhoneCameraDevice[]> {
    try {
      if (window.churchPresenterApi?.getConnectedPhoneCameras) {
        const devs = await window.churchPresenterApi.getConnectedPhoneCameras()
        this.devices = devs || []
        this.notifyDeviceListeners()
      }
    } catch (e) {
      console.warn('Error refreshing camera devices:', e)
    }
    return this.devices
  }

  public getDevices(): PhoneCameraDevice[] {
    return [...this.devices]
  }

  public getAllStreams(): Record<string, MediaStream> {
    const res: Record<string, MediaStream> = {}
    for (const [id, stream] of this.mediaStreams.entries()) {
      res[id] = stream
    }
    return res
  }

  public getStream(cameraId: string): MediaStream | null {
    return this.mediaStreams.get(cameraId) || null
  }

  public onStreamChange(cb: StreamChangeCallback): () => void {
    this.streamListeners.add(cb)
    return () => {
      this.streamListeners.delete(cb)
    }
  }

  public onDeviceChange(cb: DeviceChangeCallback): () => void {
    this.deviceListeners.add(cb)
    return () => {
      this.deviceListeners.delete(cb)
    }
  }

  public async toggleAudio(cameraId: string, muted: boolean): Promise<boolean> {
    try {
      if (window.churchPresenterApi?.togglePhoneCameraAudio) {
        return await window.churchPresenterApi.togglePhoneCameraAudio(cameraId, muted)
      }
    } catch {
      // ignore
    }
    return false
  }

  public async revokeDevice(cameraId: string): Promise<boolean> {
    try {
      this.closePeer(cameraId)
      if (window.churchPresenterApi?.revokePhoneCamera) {
        return await window.churchPresenterApi.revokePhoneCamera(cameraId)
      }
    } catch {
      // ignore
    }
    return false
  }

  private async handleIncomingSignal(signal: CameraSignalMessage): Promise<void> {
    const cameraId = signal.cameraId
    if (!cameraId) return

    if (signal.type === 'offer' && signal.sdp) {
      await this.handleOffer(cameraId, signal.sdp)
    } else if (signal.type === 'candidate' && signal.candidate) {
      await this.handleCandidate(cameraId, signal.candidate)
    }
  }

  private async handleOffer(cameraId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    // Close existing connection for this camera if any
    this.closePeer(cameraId)

    const pc = new RTCPeerConnection({
      iceServers: [] // LAN/Tailscale: local candidates only
    })
    this.peerConnections.set(cameraId, pc)

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.mediaStreams.set(cameraId, event.streams[0])
        this.notifyStreamListeners(cameraId, event.streams[0])
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && window.churchPresenterApi?.sendCameraSignal) {
        window.churchPresenterApi.sendCameraSignal({
          type: 'candidate',
          cameraId,
          candidate: event.candidate
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.mediaStreams.delete(cameraId)
        this.notifyStreamListeners(cameraId, null)
      }
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      if (window.churchPresenterApi?.sendCameraSignal) {
        await window.churchPresenterApi.sendCameraSignal({
          type: 'answer',
          cameraId,
          sdp: pc.localDescription
        })
      }
    } catch (err) {
      console.error(`Error answering WebRTC offer for camera ${cameraId}:`, err)
    }
  }

  private async handleCandidate(cameraId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(cameraId)
    if (!pc) return
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (e) {
      console.warn(`Error adding ICE candidate for camera ${cameraId}:`, e)
    }
  }

  private closePeer(cameraId: string): void {
    const pc = this.peerConnections.get(cameraId)
    if (pc) {
      try {
        pc.close()
      } catch {
        // ignore
      }
      this.peerConnections.delete(cameraId)
    }
    if (this.mediaStreams.has(cameraId)) {
      this.mediaStreams.delete(cameraId)
      this.notifyStreamListeners(cameraId, null)
    }
  }

  private notifyStreamListeners(cameraId: string, stream: MediaStream | null): void {
    for (const listener of this.streamListeners) {
      try {
        listener(cameraId, stream)
      } catch (e) {
        console.error('Error notifying stream listener:', e)
      }
    }
  }

  private notifyDeviceListeners(): void {
    for (const listener of this.deviceListeners) {
      try {
        listener([...this.devices])
      } catch (e) {
        console.error('Error notifying device listener:', e)
      }
    }
  }

  public dispose(): void {
    if (this.unsubSignals) {
      this.unsubSignals()
      this.unsubSignals = null
    }
    if (this.unsubDevices) {
      this.unsubDevices()
      this.unsubDevices = null
    }
    if (this.unsubFrames) {
      this.unsubFrames()
      this.unsubFrames = null
    }
    if (this.frameWatchdog) {
      clearInterval(this.frameWatchdog)
      this.frameWatchdog = null
    }
    for (const pc of this.peerConnections.values()) {
      try {
        pc.close()
      } catch {
        // ignore
      }
    }
    this.peerConnections.clear()
    this.mediaStreams.clear()
    this.canvasMap.clear()
    this.ctxMap.clear()
    this.lastFrameTimes.clear()
    this.isInitialized = false
  }
}

export const cameraReceiverService = new CameraReceiverService()
