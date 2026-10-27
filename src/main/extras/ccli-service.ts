import { databaseService } from '../db/database-service'
import { SongUsageRecord, SongUsageReport } from '../../shared/types'
import { logger } from '../logger'

export class CcliService {
  /**
   * Records a song projection if CCLI tracking is enabled.
   */
  public recordUsage(params: {
    songId: string
    title: string
    artist?: string
    ccliNumber?: string
    copyright?: string
    serviceId?: string
    serviceTitle?: string
    projectedBy?: string
  }): boolean {
    const config = databaseService.getCcliConfig()
    if (!config.enabled) {
      return false
    }

    const record: Omit<SongUsageRecord, 'id'> = {
      songId: params.songId,
      title: params.title,
      artist: params.artist,
      ccliNumber: params.ccliNumber,
      copyright: params.copyright,
      projectedAt: new Date().toISOString(),
      serviceId: params.serviceId,
      serviceTitle: params.serviceTitle,
      projectedBy: params.projectedBy || 'operator'
    }

    logger.info(`CCLI: recording projection for song "${params.title}" (CCLI: ${params.ccliNumber || 'N/A'})`)
    return databaseService.recordSongUsage(record)
  }

  /**
   * Retrieves usage records filtered by date range and calculates summary statistics.
   */
  public getReport(from?: string, to?: string): SongUsageReport {
    const records = databaseService.getSongUsageRecords(from, to)
    const uniqueSongIds = new Set(records.map((r) => r.songId))

    return {
      records,
      totalPlays: records.length,
      uniqueSongs: uniqueSongIds.size,
      dateRange: {
        from: from || (records.length > 0 ? records[records.length - 1].projectedAt : ''),
        to: to || (records.length > 0 ? records[0].projectedAt : '')
      }
    }
  }

  /**
   * Generates a CSV file adhering to CCLI reporting standards.
   */
  public exportCsv(from?: string, to?: string): { success: boolean; csvContent: string; recordCount: number } {
    const records = databaseService.getSongUsageRecords(from, to)

    const headers = [
      'Fecha y Hora',
      'Título de Canción',
      'Autor / Artista',
      'Número CCLI',
      'Copyright',
      'Culto / Servicio',
      'Operador'
    ]

    const escapeCsv = (val?: string) => {
      if (!val) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = records.map((r) => [
      escapeCsv(r.projectedAt),
      escapeCsv(r.title),
      escapeCsv(r.artist),
      escapeCsv(r.ccliNumber),
      escapeCsv(r.copyright),
      escapeCsv(r.serviceTitle || r.serviceId),
      escapeCsv(r.projectedBy)
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n')

    return {
      success: true,
      csvContent,
      recordCount: records.length
    }
  }

  /**
   * Clears usage history after user confirmation.
   */
  public clearHistory(): boolean {
    logger.warn('CCLI: clearing all song usage history records')
    return databaseService.clearSongUsageHistory()
  }

  public getConfig(): { enabled: boolean } {
    return databaseService.getCcliConfig()
  }

  public saveConfig(config: { enabled: boolean }): { enabled: boolean } {
    return databaseService.saveCcliConfig(config)
  }
}

export const ccliService = new CcliService()
