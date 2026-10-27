import { describe, it, expect } from 'vitest'
import { RehearsalService } from '../src/main/rehearsal/rehearsal-service'

describe('Rehearsal Mode Service (Phase 7)', () => {
  it('starts rehearsal mode and tracks slides and incidents', () => {
    const service = new RehearsalService()
    expect(service.isRehearsalActive()).toBe(false)

    service.setRehearsalMode(true)
    expect(service.isRehearsalActive()).toBe(true)

    service.recordSlideChange('Alaba a Dios')
    service.recordSlideChange('Juan 3:16')
    service.recordIncident('Pantalla de retorno parpadeó')

    const status = service.getStatus()
    expect(status.active).toBe(true)
    expect(status.incidentsCount).toBe(1)

    service.setRehearsalMode(false)
    expect(service.isRehearsalActive()).toBe(false)

    const summary = service.getSummary()
    expect(summary).not.toBeNull()
    expect(summary?.slidesCount).toBe(2)
    expect(summary?.incidentsCount).toBe(1)
  })
})
