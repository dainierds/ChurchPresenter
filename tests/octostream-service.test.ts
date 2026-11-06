import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { OctoStreamService } from '../src/main/camera/octostream-service'
import { databaseService } from '../src/main/db/database-service'

describe('OctoStream Native iPhone Cameras (RTMP & RTSP)', () => {
  let testDir: string
  let service: OctoStreamService

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-octostream-test-'))
    const dbPath = path.join(testDir, 'test_octostream.sqlite')

    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(testDir, 'backups')
    await databaseService.initialize()

    service = new OctoStreamService()
  })

  afterEach(async () => {
    await service.shutdown()
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('1. Initializes default 4 slots with ports 1935 through 1938', async () => {
    const slots = await service.loadSlots()
    expect(slots).toHaveLength(4)
    expect(slots[0].id).toBe('cam1')
    expect(slots[0].rtmpPort).toBe(1935)
    expect(slots[1].id).toBe('cam2')
    expect(slots[1].rtmpPort).toBe(1936)
    expect(slots[2].id).toBe('cam3')
    expect(slots[2].rtmpPort).toBe(1937)
    expect(slots[3].id).toBe('cam4')
    expect(slots[3].rtmpPort).toBe(1938)
  })

  it('2. Generates RTMP URLs and QR code data URLs for OctoStream', async () => {
    const slots = await service.getSlotsWithUrls()
    expect(slots[0].rtmpUrl).toContain(':1935/live/cam1')
    expect(slots[0].qrDataUrl).toBeDefined()
    expect(slots[0].qrDataUrl).toMatch(/^data:image\/png;base64,/)
    expect(slots[0].tailscaleRtmpUrl).toContain(':1935/live/cam1')
  })

  it('3. Allows updating camera slot mode, RTSP URL and custom name', async () => {
    await service.loadSlots()
    const updated = await service.saveSlot({
      id: 'cam1',
      name: 'iPhone Pastor Altar',
      mode: 'rtsp',
      rtspUrl: 'rtsp://192.168.1.55:8554/live'
    })

    const cam1 = updated.find((s) => s.id === 'cam1')
    expect(cam1).toBeDefined()
    expect(cam1?.name).toBe('iPhone Pastor Altar')
    expect(cam1?.mode).toBe('rtsp')
    expect(cam1?.rtspUrl).toBe('rtsp://192.168.1.55:8554/live')
  })

  it('4. Converts active slots into PhoneCameraDevice objects for broadcast mixing', async () => {
    await service.loadSlots()
    const devices = service.toPhoneCameraDevices()
    expect(devices.length).toBeGreaterThanOrEqual(1)
    const dev1 = devices.find((d) => d.id === 'cam1')
    expect(dev1).toBeDefined()
    expect(dev1?.name).toContain('Cámara 1')
    expect(dev1?.resolution).toBe('1280x720')
    expect(dev1?.targetFps).toBe(30)
  })

  it('5. Stops slot and clears state gracefully', async () => {
    await service.loadSlots()
    const stopRes = await service.stopSlot('cam1')
    expect(stopRes.success).toBe(true)
    const slots = await service.getSlotsWithUrls()
    const cam1 = slots.find((s) => s.id === 'cam1')
    expect(cam1?.enabled).toBe(false)
    expect(cam1?.isStreaming).toBe(false)
  })
})
