import { describe, it, expect } from 'vitest'
import { OutputHealthService } from '../src/main/health/output-health-service'

describe('Output Health & Incident Recording (Phase 7)', () => {
  it('initializes standard roles main, stage and lobby', () => {
    const service = new OutputHealthService()
    const statuses = service.getStatuses()
    expect(statuses.main).toBeDefined()
    expect(statuses.stage).toBeDefined()
    expect(statuses.lobby).toBeDefined()
    expect(statuses.main.role).toBe('main')
  })

  it('records heartbeats and updates real FPS and timestamp', () => {
    const service = new OutputHealthService()
    const now = Date.now()
    service.recordHeartbeat('main', 59.8, now)

    const statuses = service.getStatuses()
    expect(statuses.main.fps).toBe(59.8)
    expect(statuses.main.lastFrameTimestamp).toBe(now)
  })

  it('records dropped frames and incidents', () => {
    const service = new OutputHealthService()
    service.recordHeartbeat('main', 22.4, Date.now())

    const statuses = service.getStatuses()
    expect(statuses.main.incidents.length).toBeGreaterThan(0)
    expect(statuses.main.incidents[0].type).toBe('fps_drop')
    expect(statuses.main.incidents[0].details).toContain('22.4 FPS')
  })

  it('records window crashes and recreation incidents', () => {
    const service = new OutputHealthService()
    service.recordIncident('stage', 'crash', 'Renderer process killed')

    const statuses = service.getStatuses()
    expect(statuses.stage.incidents[0].type).toBe('crash')
    expect(statuses.stage.incidents[0].details).toBe('Renderer process killed')
  })
})
