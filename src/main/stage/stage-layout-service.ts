import { StageLayoutConfig } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export const STAGE_ASSIGNMENT_CONFIG_KEY = 'stage_layout_assignment'
export const STAGE_ASSIGNMENTS_MAP_KEY = 'stage_layout_assignments_map'

export const BUILTIN_STAGE_LAYOUTS: StageLayoutConfig[] = [
  {
    id: 'factory-stage-classic',
    name: 'Escenario - Clásico Pro',
    isBuiltIn: true,
    backgroundColor: '#0a0a0a',
    elements: [
      {
        id: 'el-current-slide',
        type: 'current-slide',
        x: 3,
        y: 8,
        width: 58,
        height: 72,
        visible: true,
        fontSizeVmin: 6.8,
        fontColor: '#ffffff',
        fontWeight: '700',
        alignment: 'left',
        showLabel: true,
        label: 'DIAPOSITIVA ACTUAL'
      },
      {
        id: 'el-next-slide',
        type: 'next-slide',
        x: 64,
        y: 22,
        width: 33,
        height: 58,
        visible: true,
        fontSizeVmin: 4.5,
        fontColor: '#94a3b8',
        fontWeight: '600',
        alignment: 'left',
        showLabel: true,
        label: 'SIGUIENTE'
      },
      {
        id: 'el-clock',
        type: 'clock',
        x: 64,
        y: 8,
        width: 33,
        height: 12,
        visible: true,
        fontSizeVmin: 4.8,
        fontColor: '#38bdf8',
        fontWeight: '700',
        alignment: 'right',
        showLabel: false
      },
      {
        id: 'el-timers',
        type: 'timers',
        x: 3,
        y: 82,
        width: 45,
        height: 15,
        visible: true,
        fontSizeVmin: 4.5,
        fontColor: '#22c55e',
        fontWeight: '700',
        alignment: 'left',
        showLabel: true,
        label: 'TEMPORIZADOR'
      },
      {
        id: 'el-messages',
        type: 'messages',
        x: 50,
        y: 82,
        width: 47,
        height: 15,
        visible: true,
        fontSizeVmin: 4.2,
        fontColor: '#fbbf24',
        fontWeight: '700',
        alignment: 'right',
        showLabel: true,
        label: 'AVISO ESCENARIO'
      },
      {
        id: 'el-notes',
        type: 'notes',
        x: 3,
        y: 82,
        width: 94,
        height: 15,
        visible: false,
        fontSizeVmin: 3.5,
        fontColor: '#e2e8f0',
        alignment: 'left',
        showLabel: true,
        label: 'NOTAS'
      },
      {
        id: 'el-video-time',
        type: 'video-time',
        x: 3,
        y: 82,
        width: 30,
        height: 15,
        visible: false,
        fontSizeVmin: 4.0,
        fontColor: '#f97316',
        alignment: 'left',
        showLabel: true,
        label: 'VIDEO RESTANTE'
      }
    ]
  },
  {
    id: 'factory-stage-large-lyrics',
    name: 'Escenario - Letras Grandes',
    isBuiltIn: true,
    backgroundColor: '#050505',
    elements: [
      {
        id: 'el-current-slide',
        type: 'current-slide',
        x: 4,
        y: 6,
        width: 92,
        height: 74,
        visible: true,
        fontSizeVmin: 8.5,
        fontColor: '#ffffff',
        fontWeight: '700',
        alignment: 'center',
        showLabel: false
      },
      {
        id: 'el-next-slide',
        type: 'next-slide',
        x: 4,
        y: 82,
        width: 60,
        height: 14,
        visible: true,
        fontSizeVmin: 4.0,
        fontColor: '#94a3b8',
        fontWeight: '600',
        alignment: 'left',
        showLabel: true,
        label: 'SIGUIENTE'
      },
      {
        id: 'el-clock',
        type: 'clock',
        x: 68,
        y: 82,
        width: 28,
        height: 14,
        visible: true,
        fontSizeVmin: 4.6,
        fontColor: '#38bdf8',
        fontWeight: '700',
        alignment: 'right',
        showLabel: false
      },
      {
        id: 'el-messages',
        type: 'messages',
        x: 4,
        y: 6,
        width: 92,
        height: 18,
        visible: true,
        fontSizeVmin: 4.5,
        fontColor: '#f97316',
        fontWeight: '700',
        alignment: 'center',
        showLabel: true,
        label: 'ALERTA'
      }
    ]
  },
  {
    id: 'factory-stage-worship-leader',
    name: 'Escenario - Líder de Alabanza',
    isBuiltIn: true,
    backgroundColor: '#0a0a0a',
    elements: [
      {
        id: 'el-current-slide',
        type: 'current-slide',
        x: 4,
        y: 6,
        width: 92,
        height: 40,
        visible: true,
        fontSizeVmin: 6.8,
        fontColor: '#ffffff',
        fontWeight: '700',
        alignment: 'left',
        showLabel: true,
        label: 'ACTUAL'
      },
      {
        id: 'el-next-slide',
        type: 'next-slide',
        x: 4,
        y: 48,
        width: 92,
        height: 32,
        visible: true,
        fontSizeVmin: 5.5,
        fontColor: '#f97316',
        fontWeight: '600',
        alignment: 'left',
        showLabel: true,
        label: 'PRÓXIMO VERSO / CORO'
      },
      {
        id: 'el-clock',
        type: 'clock',
        x: 4,
        y: 84,
        width: 26,
        height: 12,
        visible: true,
        fontSizeVmin: 4.2,
        fontColor: '#38bdf8',
        fontWeight: '700',
        alignment: 'left'
      },
      {
        id: 'el-timers',
        type: 'timers',
        x: 32,
        y: 84,
        width: 34,
        height: 12,
        visible: true,
        fontSizeVmin: 4.5,
        fontColor: '#22c55e',
        fontWeight: '700',
        alignment: 'center',
        showLabel: true,
        label: 'TIEMPO'
      },
      {
        id: 'el-messages',
        type: 'messages',
        x: 68,
        y: 84,
        width: 28,
        height: 12,
        visible: true,
        fontSizeVmin: 4.0,
        fontColor: '#fbbf24',
        fontWeight: '700',
        alignment: 'right',
        showLabel: true,
        label: 'MENSAJE'
      }
    ]
  },
  {
    id: 'factory-stage-speaker-notes',
    name: 'Escenario - Notas del Predicador',
    isBuiltIn: true,
    backgroundColor: '#000000',
    elements: [
      {
        id: 'el-clock',
        type: 'clock',
        x: 4,
        y: 6,
        width: 44,
        height: 14,
        visible: true,
        fontSizeVmin: 5.2,
        fontColor: '#38bdf8',
        fontWeight: '700',
        alignment: 'left'
      },
      {
        id: 'el-timers',
        type: 'timers',
        x: 52,
        y: 6,
        width: 44,
        height: 14,
        visible: true,
        fontSizeVmin: 5.2,
        fontColor: '#22c55e',
        fontWeight: '700',
        alignment: 'right',
        showLabel: true,
        label: 'PREDICACIÓN'
      },
      {
        id: 'el-notes',
        type: 'notes',
        x: 4,
        y: 22,
        width: 92,
        height: 58,
        visible: true,
        fontSizeVmin: 4.5,
        fontColor: '#f8fafc',
        fontWeight: '400',
        alignment: 'left',
        showLabel: true,
        label: 'NOTAS DEL SERMÓN'
      },
      {
        id: 'el-current-slide',
        type: 'current-slide',
        x: 4,
        y: 82,
        width: 44,
        height: 14,
        visible: true,
        fontSizeVmin: 3.5,
        fontColor: '#94a3b8',
        alignment: 'left',
        showLabel: true,
        label: 'SLIDE'
      },
      {
        id: 'el-messages',
        type: 'messages',
        x: 52,
        y: 82,
        width: 44,
        height: 14,
        visible: true,
        fontSizeVmin: 4.0,
        fontColor: '#fbbf24',
        alignment: 'right',
        showLabel: true,
        label: 'AVISO'
      }
    ]
  }
]

export class StageLayoutService {
  public initialize(): void {
    this.seedBuiltInLayouts()
  }

  public seedBuiltInLayouts(): void {
    try {
      const existing = this.getStageLayouts()
      const existingIds = new Set(existing.map((l) => l.id))

      for (const layout of BUILTIN_STAGE_LAYOUTS) {
        if (!existingIds.has(layout.id)) {
          databaseService.run(
            `INSERT INTO stage_layouts (id, name, is_builtin, background_color, config_json, created_at, updated_at)
             VALUES (?, ?, 1, ?, ?, datetime('now'), datetime('now'));`,
            [layout.id, layout.name, layout.backgroundColor, JSON.stringify(layout.elements)]
          )
        }
      }
    } catch (err) {
      logger.error('Failed to seed built-in stage layouts:', err)
    }
  }

  public getStageLayouts(): StageLayoutConfig[] {
    try {
      const rows = databaseService.query('SELECT * FROM stage_layouts ORDER BY is_builtin DESC, name ASC;')
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: String(r.id),
          name: String(r.name),
          isBuiltIn: Boolean(r.is_builtin),
          backgroundColor: String(r.background_color || '#000000'),
          elements: JSON.parse(r.config_json || '[]')
        }))
      }
    } catch (err) {
      logger.error('Failed to query stage_layouts:', err)
    }

    return [...BUILTIN_STAGE_LAYOUTS]
  }

  public getStageLayoutById(id: string): StageLayoutConfig | null {
    const all = this.getStageLayouts()
    return all.find((l) => l.id === id) || null
  }

  public saveStageLayout(layout: StageLayoutConfig): StageLayoutConfig {
    if (!layout.id || !layout.name.trim()) {
      throw new Error('ID y Nombre de diseño de escenario son obligatorios.')
    }

    const elementsJson = JSON.stringify(layout.elements || [])
    const isBuiltIn = layout.isBuiltIn ? 1 : 0
    const bgColor = layout.backgroundColor || '#000000'

    databaseService.run(
      `INSERT OR REPLACE INTO stage_layouts (id, name, is_builtin, background_color, config_json, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'));`,
      [layout.id, layout.name.trim(), isBuiltIn, bgColor, elementsJson]
    )

    logger.info(`Saved stage layout: ${layout.name} (${layout.id})`)
    return layout
  }

  public deleteStageLayout(layoutId: string): boolean {
    const layout = this.getStageLayoutById(layoutId)
    if (!layout) return false
    if (layout.isBuiltIn) {
      throw new Error('No se pueden eliminar los diseños de escenario de fábrica.')
    }

    databaseService.run('DELETE FROM stage_layouts WHERE id = ?;', [layoutId])
    logger.info(`Deleted custom stage layout: ${layoutId}`)
    return true
  }

  public getAssignedStageLayout(targetKey: string = 'default'): StageLayoutConfig {
    try {
      // 1. Direct layout ID passed (e.g. from /stage?layout=factory-stage-compact)
      if (targetKey && (targetKey.startsWith('factory-stage-') || targetKey.startsWith('custom-'))) {
        const directFound = this.getStageLayoutById(targetKey)
        if (directFound) return directFound
      }

      // 2. Lookup in assignments map
      const rawMap = databaseService.getConfig(STAGE_ASSIGNMENTS_MAP_KEY)
      if (rawMap) {
        const map = JSON.parse(rawMap)
        const layoutId = map[targetKey] || map['default']
        if (layoutId) {
          const found = this.getStageLayoutById(layoutId)
          if (found) return found
        }
      }

      // 3. Fallback to legacy single assignment
      const assignedId = databaseService.getConfig(STAGE_ASSIGNMENT_CONFIG_KEY)
      if (assignedId) {
        const found = this.getStageLayoutById(assignedId)
        if (found) return found
      }
    } catch (err) {
      logger.error(`Failed to get assigned stage layout for target '${targetKey}':`, err)
    }

    return BUILTIN_STAGE_LAYOUTS[0]
  }

  public setAssignedStageLayout(layoutId: string, targetKey: string = 'default'): boolean {
    const found = this.getStageLayoutById(layoutId)
    if (!found) {
      throw new Error(`Diseño de escenario '${layoutId}' no encontrado.`)
    }

    let map: Record<string, string> = { default: layoutId }
    try {
      const rawMap = databaseService.getConfig(STAGE_ASSIGNMENTS_MAP_KEY)
      if (rawMap) {
        map = JSON.parse(rawMap)
      }
    } catch {
      // Ignore corrupted layout map JSON
    }

    map[targetKey] = layoutId
    databaseService.setConfig(STAGE_ASSIGNMENTS_MAP_KEY, JSON.stringify(map))
    databaseService.setConfig(STAGE_ASSIGNMENT_CONFIG_KEY, layoutId)
    logger.info(`Assigned stage layout for '${targetKey}' set to: ${found.name} (${layoutId})`)
    return true
  }

  public getStageLayoutAssignments(): Record<string, string> {
    try {
      const rawMap = databaseService.getConfig(STAGE_ASSIGNMENTS_MAP_KEY)
      if (rawMap) {
        return JSON.parse(rawMap)
      }
    } catch {
      // Ignore corrupted layout map JSON
    }
    return { default: BUILTIN_STAGE_LAYOUTS[0].id }
  }
}

export const stageLayoutService = new StageLayoutService()
