import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'
import { logger } from '../logger'
import {
  ServicePlan,
  ServiceChecklistResult,
  ChecklistItem,
  ChecklistStatus
} from '../../shared/types'
import { databaseService } from '../db/database-service'
import { displayManager } from '../display-manager'
import { bibleService } from '../bible/bible-service'
import { powerpointService } from '../powerpoint/powerpoint-service'
import { systemMonitorService } from '../health/system-monitor-service'

export class ChecklistService {
  public async runChecklist(plan?: ServicePlan | null): Promise<ServiceChecklistResult> {
    logger.info('Running Pre-Service Checklist...')
    const items: ChecklistItem[] = []

    // 1. Assigned Displays Check
    try {
      const assignments = databaseService.getRoleAssignments()
      const displays = displayManager.getDisplays()
      const mainAssigned = assignments['main']
      const isMainConnected =
        mainAssigned && displays.some((d) => d.stableId === mainAssigned || String(d.id) === mainAssigned)

      if (!mainAssigned) {
        items.push({
          id: 'display_main_unassigned',
          category: 'displays',
          title: 'Pantalla de Audiencia (Sala Principal)',
          status: 'warning',
          details: 'No se ha asignado un monitor físico para la salida de Audiencia.',
          actionType: 'open_displays_modal',
          actionLabel: 'Asignar Pantalla'
        })
      } else if (!isMainConnected) {
        items.push({
          id: 'display_main_disconnected',
          category: 'displays',
          title: 'Pantalla de Audiencia (Desconectada)',
          status: 'error',
          details: 'El monitor asignado para la Audiencia no está detectado o está apagado.',
          actionType: 'reconnect_display',
          actionLabel: 'Reintentar Detección'
        })
      } else {
        items.push({
          id: 'display_main_ok',
          category: 'displays',
          title: 'Pantalla de Audiencia',
          status: 'ok',
          details: 'Monitor conectado y listo para proyección a la congregación.'
        })
      }

      const stageAssigned = assignments['stage']
      const isStageConnected =
        stageAssigned && displays.some((d) => d.stableId === stageAssigned || String(d.id) === stageAssigned)
      if (stageAssigned && !isStageConnected) {
        items.push({
          id: 'display_stage_disconnected',
          category: 'displays',
          title: 'Monitor de Escenario (Desconectado)',
          status: 'warning',
          details: 'El monitor asignado para el retorno de músicos/oradores está apagado o desconectado.',
          actionType: 'reconnect_display',
          actionLabel: 'Reintentar Detección'
        })
      } else if (stageAssigned) {
        items.push({
          id: 'display_stage_ok',
          category: 'displays',
          title: 'Monitor de Escenario',
          status: 'ok',
          details: 'Monitor de retorno conectado y activo.'
        })
      }
    } catch (err) {
      logger.error('Error verifying displays in checklist:', err)
    }

    // 2. Media Files Readability Check
    if (plan && plan.items && plan.items.length > 0) {
      let missingMediaCount = 0
      for (const item of plan.items) {
        const filePath =
          item.videoConfig?.mediaPath ||
          item.pdfConfig?.mediaPath ||
          item.imageConfig?.images?.[0]?.filePath ||
          (item as any).sourceData?.path
        if (filePath) {
          try {
            await fs.promises.access(filePath, fs.constants.R_OK)
          } catch {
            missingMediaCount++
          }
        }
      }

      if (missingMediaCount > 0) {
        items.push({
          id: 'media_missing',
          category: 'media',
          title: 'Archivos de Medios del Culto',
          status: 'error',
          details: `Hay ${missingMediaCount} archivo(s) de video, imagen o PDF en la lista que no se encuentran en disco o no son legibles.`,
          actionType: 'check_integrity',
          actionLabel: 'Comprobar Integridad'
        })
      } else {
        items.push({
          id: 'media_ok',
          category: 'media',
          title: 'Archivos de Medios',
          status: 'ok',
          details: 'Todos los videos, imágenes y pistas de la lista de reproducción están disponibles y legibles.'
        })
      }
    } else {
      items.push({
        id: 'media_plan_empty',
        category: 'media',
        title: 'Archivos de Medios',
        status: 'ok',
        details: 'No hay elementos de medios en la lista activa o la lista está vacía.'
      })
    }

    // 3. YouTube Items Check
    if (plan && plan.items) {
      const youtubeItems = plan.items.filter((i) => i.type === 'youtube')
      if (youtubeItems.length > 0) {
        const invalidYt = youtubeItems.filter(
          (i) => !i.youtubeConfig?.youtubeId || i.youtubeConfig.youtubeId.length !== 11
        )
        if (invalidYt.length > 0) {
          items.push({
            id: 'youtube_invalid',
            category: 'youtube',
            title: 'Videos de YouTube en la Lista',
            status: 'warning',
            details: `Hay ${invalidYt.length} elemento(s) de YouTube con ID de video inválido o incompleto.`
          })
        } else {
          items.push({
            id: 'youtube_ok',
            category: 'youtube',
            title: 'Videos de YouTube',
            status: 'ok',
            details: `${youtubeItems.length} video(s) de YouTube validados en la lista de reproducción.`
          })
        }
      }
    }

    // 4. PowerPoint Cache vs Original Check
    if (plan && plan.items) {
      const pptItems = plan.items.filter((i) => i.type === 'presentation' && i.powerpointConfig?.originalPath)
      let outdatedPptCount = 0
      for (const item of pptItems) {
        const pptPath = item.powerpointConfig!.originalPath
        const recordedHash = item.powerpointConfig!.hash || ''
        try {
          const isModified = await powerpointService.checkIfModified(pptPath, recordedHash)
          if (isModified) outdatedPptCount++
        } catch {
          // ignore
        }
      }

      if (outdatedPptCount > 0) {
        items.push({
          id: 'ppt_outdated',
          category: 'powerpoint',
          title: 'Presentaciones PowerPoint',
          status: 'warning',
          details: `Hay ${outdatedPptCount} archivo(s) PowerPoint cuyo archivo original ha sido modificado y requiere regenerar diapositivas.`,
          actionType: 'convert_powerpoint',
          actionLabel: 'Reconvertir Presentaciones'
        })
      } else if (pptItems.length > 0) {
        items.push({
          id: 'ppt_ok',
          category: 'powerpoint',
          title: 'Presentaciones PowerPoint',
          status: 'ok',
          details: 'Todas las presentaciones PowerPoint están convertidas y actualizadas con respecto al archivo original.'
        })
      }
    }

    // 5. Bible Translations Check
    try {
      const bibles = await bibleService.getTranslations()
      if (!bibles || bibles.length === 0) {
        items.push({
          id: 'bible_none',
          category: 'bible',
          title: 'Traducciones Bíblicas',
          status: 'error',
          details: 'No hay ninguna traducción bíblica instalada o accesible.',
          actionType: 'import_bible',
          actionLabel: 'Instalar Biblia'
        })
      } else {
        items.push({
          id: 'bible_ok',
          category: 'bible',
          title: 'Traducciones Bíblicas',
          status: 'ok',
          details: `${bibles.length} traducción(es) cargada(s) (ej. ${bibles.map((b: any) => b.shortName || b.abbrev).join(', ')}).`
        })
      }
    } catch {
      items.push({
        id: 'bible_error',
        category: 'bible',
        title: 'Traducciones Bíblicas',
        status: 'error',
        details: 'Error accediendo al servicio de Biblias.'
      })
    }

    // 6. Free Disk Space Check
    try {
      const metrics = await systemMonitorService.getMetrics()
      if (metrics.disk.freeGb < 2) {
        items.push({
          id: 'disk_critical',
          category: 'disk',
          title: 'Espacio en Disco Duro',
          status: 'error',
          details: `Espacio crítico: solo quedan ${metrics.disk.freeGb} GB libres en disco.`,
          actionLabel: 'Liberar Espacio'
        })
      } else if (metrics.disk.freeGb < 5) {
        items.push({
          id: 'disk_low',
          category: 'disk',
          title: 'Espacio en Disco Duro',
          status: 'warning',
          details: `Quedan ${metrics.disk.freeGb} GB disponibles en disco. Se recomiendan al menos 5 GB para cultos.`
        })
      } else {
        items.push({
          id: 'disk_ok',
          category: 'disk',
          title: 'Espacio en Disco Duro',
          status: 'ok',
          details: `${metrics.disk.freeGb} GB disponibles en el disco principal.`
        })
      }
    } catch (err) {
      logger.error('Error checking disk in checklist:', err)
    }

    // 7. Recent Database Backup Check
    try {
      const userData =
        app && typeof app.getPath === 'function' ? app.getPath('userData') : os.tmpdir()
      const backupsDir = path.join(userData, 'backups')
      let hasRecentBackup = false
      if (fs.existsSync(backupsDir)) {
        const files = await fs.promises.readdir(backupsDir)
        const now = Date.now()
        for (const file of files) {
          if (file.endsWith('.sqlite')) {
            const stats = await fs.promises.stat(path.join(backupsDir, file))
            if (now - stats.mtimeMs < 24 * 60 * 60 * 1000) {
              hasRecentBackup = true
              break
            }
          }
        }
      }

      if (!hasRecentBackup) {
        items.push({
          id: 'backup_old',
          category: 'backup',
          title: 'Copia de Seguridad de Base de Datos',
          status: 'warning',
          details: 'No se ha realizado una copia de seguridad en las últimas 24 horas.',
          actionType: 'create_backup',
          actionLabel: 'Crear Copia Ahora'
        })
      } else {
        items.push({
          id: 'backup_ok',
          category: 'backup',
          title: 'Copia de Seguridad de la Base de Datos',
          status: 'ok',
          details: 'Copia de seguridad reciente (< 24h) disponible para restauración rápida.'
        })
      }
    } catch (err) {
      logger.error('Error checking backups in checklist:', err)
    }

    // Summary calculation
    const summary = {
      total: items.length,
      ok: items.filter((i) => i.status === 'ok').length,
      warning: items.filter((i) => i.status === 'warning').length,
      error: items.filter((i) => i.status === 'error').length
    }

    let overallStatus: ChecklistStatus = 'ok'
    if (summary.error > 0) overallStatus = 'error'
    else if (summary.warning > 0) overallStatus = 'warning'

    return {
      overallStatus,
      checkedAt: Date.now(),
      items,
      summary
    }
  }

  public async fixItem(itemId: string, actionType: string): Promise<boolean> {
    logger.info(`Attempting to fix checklist item '${itemId}' with action '${actionType}'`)
    if (actionType === 'create_backup') {
      databaseService.createBackup('pre_service')
      return true
    }
    if (actionType === 'reconnect_display') {
      displayManager.getDisplays()
      return true
    }
    return false
  }
}

export const checklistService = new ChecklistService()
