import { describe, it, expect } from 'vitest'
import { createServiceFromTemplate, duplicateService } from '../src/shared/service-utils'
import { ServicePlan } from '../src/shared/types'

describe('Service Templates & Duplication', () => {
  const template: ServicePlan = {
    id: 'tpl-sunday',
    name: 'Plantilla Culto Dominical',
    date: '2026-10-25',
    isTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      { id: '1', type: 'header', name: 'PRELUDIO Y ORACIÓN INICIAL' },
      { id: '2', type: 'song', name: 'Bienvenidos a Casa', songId: 's1' },
      { id: '3', type: 'song', name: 'Cuán Grande es Él', songId: 's2' },
      { id: '4', type: 'header', name: 'ANUNCIOS Y OFRENDA' },
      { id: '5', type: 'presentation', name: 'Avisos Semanales', presentationId: 'p1' },
      { id: '6', type: 'song', name: 'Cantaré de tu Amor', songId: 's3' },
      { id: '7', type: 'header', name: 'MENSAJE PASTORAL' },
      { id: '8', type: 'blank', name: 'Pantalla en Blanco' }
    ]
  }

  it('creates a new service instance from template with new IDs and isTemplate=false', () => {
    const newService = createServiceFromTemplate(template, 'Culto Domingo Mañana', '2026-11-01')

    expect(newService.id).not.toEqual(template.id)
    expect(newService.name).toBe('Culto Domingo Mañana')
    expect(newService.date).toBe('2026-11-01')
    expect(newService.isTemplate).toBe(false)
    expect(newService.items).toHaveLength(8)
    expect(newService.items[0].name).toBe('PRELUDIO Y ORACIÓN INICIAL')
    expect(newService.items[0].id).not.toEqual(template.items[0].id)
  })

  it('duplicates existing service correctly', () => {
    const dup = duplicateService(template, 'Copia de Culto')

    expect(dup.id).not.toEqual(template.id)
    expect(dup.name).toBe('Copia de Culto')
    expect(dup.items).toHaveLength(8)
    expect(dup.items[1].name).toBe('Bienvenidos a Casa')
  })
})
