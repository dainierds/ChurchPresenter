import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import http from 'http'
import { WebSocketServer } from 'ws'
import crypto from 'crypto'
import { getObsBrowserSourceHtml } from '../src/main/remote/client-templates'
import { ObsWebSocketService } from '../src/main/broadcast/obs-websocket-service'
import { databaseService } from '../src/main/db/database-service'
import {  } from '../src/main/security/safe-storage-service'

describe('Phase 9 - Stage A: OBS Bridge & Browser Source', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    await databaseService.initialize()
  })

  describe('1. OBS Browser Source HTML Templates', () => {
    it('generates transparent browser source template for alpha overlays', () => {
      const html = getObsBrowserSourceHtml({
        role: 'program',
        transparent: true
      })

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('background-color: transparent !important')
      expect(html).toContain('targetRole = "program"')
      expect(html).toContain('isTransparent = true')
      expect(html).toContain('id="slideBox"')
      expect(html).toContain('id="propsLayer"')
      expect(html).toContain('id="messageOverlay"')
    })

    it('generates opaque browser source template when transparent is false', () => {
      const html = getObsBrowserSourceHtml({
        role: 'audience',
        transparent: false
      })

      expect(html).toContain('background-color: #000000 !important')
      expect(html).toContain('targetRole = "audience"')
      expect(html).toContain('isTransparent = false')
    })
  })

  describe('2. OBS WebSocket v5 Protocol and Encryption', () => {
    let mockObsServer: http.Server
    let wss: WebSocketServer
    let serverPort: number

    beforeEach(async () => {
      mockObsServer = http.createServer()
      wss = new WebSocketServer({ server: mockObsServer })

      await new Promise<void>((resolve) => {
        mockObsServer.listen(0, '127.0.0.1', () => {
          const addr = mockObsServer.address()
          serverPort = typeof addr === 'object' && addr ? addr.port : 4455
          resolve()
        })
      })
    })

    afterEach(async () => {
      wss.close()
      await new Promise<void>((resolve) => mockObsServer.close(() => resolve()))
    })

    it('encrypts and decrypts OBS password via safeStorage without plaintext leak', () => {
      const obsService = new ObsWebSocketService()
      const testPassword = 'SecretChurchStreamingKey123!'

      obsService.saveConfig({
        host: '127.0.0.1',
        port: 4455,
        password: testPassword,
        autoConnect: false
      })

      const rawDbValue = databaseService.getConfig('obs_password_enc')
      expect(rawDbValue).toBeDefined()
      expect(rawDbValue).not.toBe(testPassword)
      expect(rawDbValue?.startsWith('enc:')).toBe(true)

      const config = obsService.getConfig()
      expect(config.password).toBe(testPassword)
    })

    it('successfully completes obs-websocket v5 authentication challenge-response', async () => {
      const obsPassword = 'MyObsChurchPassword'
      const salt = 'randomSaltValue123'
      const challenge = 'challengeString456'

      // Precompute expected auth string according to obs-websocket v5
      const secretHash = crypto
        .createHash('sha256')
        .update(obsPassword + salt)
        .digest('base64')
      const expectedAuthResponse = crypto
        .createHash('sha256')
        .update(secretHash + challenge)
        .digest('base64')

      let clientIdentified = false
      let clientCurrentScene = 'Escena Predicación'

      wss.on('connection', (ws) => {
        // Send op: 0 Hello
        ws.send(
          JSON.stringify({
            op: 0,
            d: {
              obsWebSocketVersion: '5.4.0',
              rpcVersion: 1,
              authentication: {
                challenge,
                salt
              }
            }
          })
        )

        ws.on('message', (raw) => {
          const msg = JSON.parse(raw.toString())
          // Receive op: 1 Identify
          if (msg.op === 1) {
            if (msg.d?.authentication === expectedAuthResponse) {
              clientIdentified = true
              ws.send(
                JSON.stringify({
                  op: 2,
                  d: {
                    negotiatedRpcVersion: 1
                  }
                })
              )
            } else {
              ws.close(4009, 'Authentication failed')
            }
          } else if (msg.op === 6) {
            // Request
            const reqType = msg.d.requestType
            const reqId = msg.d.requestId
            if (reqType === 'GetSceneList') {
              ws.send(
                JSON.stringify({
                  op: 7,
                  d: {
                    requestId: reqId,
                    requestType: reqType,
                    requestStatus: { result: true, code: 100 },
                    responseData: {
                      currentProgramSceneName: clientCurrentScene,
                      scenes: [
                        { sceneName: 'Escena Cámara Completa' },
                        { sceneName: 'Escena Predicación' },
                        { sceneName: 'Escena Alabanza' }
                      ]
                    }
                  }
                })
              )
            } else if (reqType === 'SetCurrentProgramScene') {
              clientCurrentScene = msg.d.requestData.sceneName
              ws.send(
                JSON.stringify({
                  op: 7,
                  d: {
                    requestId: reqId,
                    requestType: reqType,
                    requestStatus: { result: true, code: 100 }
                  }
                })
              )
            } else if (reqType === 'StartStream' || reqType === 'StopStream' || reqType === 'StartRecord' || reqType === 'StopRecord') {
              ws.send(
                JSON.stringify({
                  op: 7,
                  d: {
                    requestId: reqId,
                    requestType: reqType,
                    requestStatus: { result: true, code: 100 }
                  }
                })
              )
            }
          }
        })
      })

      const obsService = new ObsWebSocketService()
      const connectRes = await obsService.connect({
        host: '127.0.0.1',
        port: serverPort,
        password: obsPassword
      })

      expect(connectRes.success).toBe(true)
      expect(clientIdentified).toBe(true)

      const status = obsService.getStatus()
      expect(status.connected).toBe(true)

      // Test scene retrieval
      const scenes = await obsService.getScenes()
      expect(scenes).toEqual(['Escena Cámara Completa', 'Escena Predicación', 'Escena Alabanza'])

      // Test switching program scene
      const switchRes = await obsService.setCurrentProgramScene('Escena Alabanza')
      expect(switchRes.success).toBe(true)
      expect(obsService.getStatus().currentScene).toBe('Escena Alabanza')

      // Test start and stop streaming
      const streamStartRes = await obsService.startStreaming()
      expect(streamStartRes.success).toBe(true)

      const streamStopRes = await obsService.stopStreaming()
      expect(streamStopRes.success).toBe(true)

      obsService.disconnect()
      expect(obsService.getStatus().connected).toBe(false)
    })
  })

  describe('3. Macro Engine OBS Integration', () => {
    it('dispatches scene change and streaming actions via obs_control', async () => {
      const { macroEngine } = await import('../src/main/macros/macro-engine')
      const { obsWebSocketService } = await import('../src/main/broadcast/obs-websocket-service')

      const setSceneSpy = vi.spyOn(obsWebSocketService, 'setCurrentProgramScene').mockResolvedValue({ success: true })
      const startStreamSpy = vi.spyOn(obsWebSocketService, 'startStreaming').mockResolvedValue({ success: true })
      const _stopStreamSpy = vi.spyOn(obsWebSocketService, 'stopStreaming').mockResolvedValue({ success: true })

      // Create a test macro with OBS actions
      databaseService.saveMacro({
        id: 'macro_test_obs',
        name: 'Cambio de Escena OBS',
        color: '#FF7A00',
        icon: 'Video',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        actions: [
          {
            id: 'act_1',
            type: 'obs_control',
            params: {
              obsAction: 'change_scene',
              obsSceneName: 'Escena Predicación'
            }
          },
          {
            id: 'act_2',
            type: 'obs_control',
            params: {
              obsAction: 'start_stream'
            }
          }
        ]
      })

      const res = await macroEngine.runMacro('macro_test_obs')
      expect(res.success).toBe(true)
      expect(setSceneSpy).toHaveBeenCalledWith('Escena Predicación')
      expect(startStreamSpy).toHaveBeenCalled()

      databaseService.deleteMacro('macro_test_obs')
    })
  })
})
