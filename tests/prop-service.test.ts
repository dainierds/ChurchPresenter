import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PropService } from '../src/main/props/prop-service'
import { PropItem } from '../src/shared/types'
import { databaseService } from '../src/main/db/database-service'

describe('PropService Unit Test Suite (Phase 8)', () => {
  let service: PropService

  const sampleProp: PropItem = {
    id: 'prop_test_lower_third',
    name: 'Tercio Inferior Predicador',
    type: 'lower_third',
    content: {
      text: 'Pastor Juan Pérez',
      subtitle: 'Tema: Fe en Tiempos Difíciles'
    },
    position: { alignment: 'bottom-center', x: 10, y: 78, width: 80, height: 16 },
    style: { opacity: 0.95, fontSizeVmin: 3, fontColor: '#ffffff', backgroundColor: '#181818' },
    transition: { inType: 'slide_up', outType: 'slide_down', durationMs: 400 },
    targetRoles: ['main'],
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(databaseService, 'getProps').mockReturnValue([{ ...sampleProp }])
    vi.spyOn(databaseService, 'setPropActive').mockReturnValue(true)
    service = new PropService()
  })

  it('retrieves stored props with their current runtime active status', () => {
    const list = service.getProps()
    expect(list.length).toBe(1)
    expect(list[0].id).toBe('prop_test_lower_third')
    expect(list[0].isActive).toBe(false)
  })

  it('toggles a prop to active state and reflects in getActiveProps', () => {
    const toggled = service.toggleProp('prop_test_lower_third', true)
    expect(toggled.isActive).toBe(true)

    const activeList = service.getActiveProps()
    expect(activeList.length).toBe(1)
    expect(activeList[0].id).toBe('prop_test_lower_third')
  })

  it('clears all active props cleanly', () => {
    service.toggleProp('prop_test_lower_third', true)
    expect(service.getActiveProps().length).toBe(1)

    service.clearAllProps()
    expect(service.getActiveProps().length).toBe(0)
    expect(service.getProps()[0].isActive).toBe(false)
  })
})
