import { ServicePlan, ServiceItem } from './types'

export function createServiceFromTemplate(
  template: ServicePlan,
  newName: string,
  newDate: string
): ServicePlan {
  const clonedItems: ServiceItem[] = template.items.map((item, idx) => ({
    ...item,
    id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`
  }))

  return {
    id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: newName,
    date: newDate,
    items: clonedItems,
    isTemplate: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export function duplicateService(
  service: ServicePlan,
  newName?: string
): ServicePlan {
  const clonedItems: ServiceItem[] = service.items.map((item, idx) => ({
    ...item,
    id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`
  }))

  return {
    id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: newName || `${service.name} (Copia)`,
    date: service.date,
    items: clonedItems,
    isTemplate: service.isTemplate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}
