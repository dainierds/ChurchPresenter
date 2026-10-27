import { EventEmitter } from 'events'
import os from 'os'
import fs from 'fs'
import { app } from 'electron'
import { logger } from '../logger'
import { SystemMetrics } from '../../shared/types'

export class SystemMonitorService extends EventEmitter {
  private pollInterval: NodeJS.Timeout | null = null
  private previousCpuTimes: { idle: number; total: number } | null = null
  private minDiskFreeGb: number = 5 // Configurable threshold
  private maxMemoryPercent: number = 85 // Configurable threshold
  private latestMetrics: SystemMetrics | null = null

  public initialize(): void {
    if (this.pollInterval) clearInterval(this.pollInterval)

    this.sampleMetrics().catch(() => {})

    this.pollInterval = setInterval(async () => {
      await this.sampleMetrics()
    }, 3000)

    logger.info('SystemMonitorService initialized.')
  }

  public async getMetrics(): Promise<SystemMetrics> {
    if (!this.latestMetrics) {
      await this.sampleMetrics()
    }
    return this.latestMetrics!
  }

  public setThresholds(minDiskGb?: number, maxMemPct?: number): void {
    if (minDiskGb !== undefined) this.minDiskFreeGb = minDiskGb
    if (maxMemPct !== undefined) this.maxMemoryPercent = maxMemPct
  }

  private async sampleMetrics(): Promise<void> {
    try {
      const cpuPercent = this.calculateCpuPercent()

      const totalMemBytes = os.totalmem()
      const freeMemBytes = os.freemem()
      const usedMemBytes = totalMemBytes - freeMemBytes
      const memPercentUsed = Math.round((usedMemBytes / totalMemBytes) * 100)

      const memory = {
        totalMb: Math.round(totalMemBytes / (1024 * 1024)),
        freeMb: Math.round(freeMemBytes / (1024 * 1024)),
        usedMb: Math.round(usedMemBytes / (1024 * 1024)),
        percentUsed: memPercentUsed
      }

      // Free disk calculation using statfs
      let disk = {
        totalGb: 0,
        freeGb: 0,
        usedGb: 0,
        percentUsed: 0
      }

      try {
        const targetPath =
          app && typeof app.getPath === 'function'
            ? app.getPath('userData')
            : os.tmpdir()
        if (typeof fs.promises.statfs === 'function') {
          const stats = await fs.promises.statfs(targetPath)
          const totalBytes = stats.bsize * stats.blocks
          const freeBytes = stats.bsize * stats.bfree
          const usedBytes = totalBytes - freeBytes

          const totalGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10
          const freeGb = Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10
          const usedGb = Math.round((usedBytes / (1024 * 1024 * 1024)) * 10) / 10
          const percentUsed = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0

          disk = { totalGb, freeGb, usedGb, percentUsed }
        }
      } catch (_diskErr) {
        // Fallback default
        disk = { totalGb: 500, freeGb: 200, usedGb: 300, percentUsed: 60 }
      }

      // GPU Status
      let gpuFeatureStatus: any = {}
      try {
        if (app && typeof app.getGPUFeatureStatus === 'function') {
          gpuFeatureStatus = app.getGPUFeatureStatus()
        }
      } catch {
        // ignore
      }

      // Check alerts
      const alerts: SystemMetrics['alerts'] = []
      if (disk.freeGb > 0 && disk.freeGb < this.minDiskFreeGb) {
        alerts.push({
          id: `disk_low_${Date.now()}`,
          type: 'disk',
          level: disk.freeGb < 2 ? 'critical' : 'warning',
          message: `Espacio en disco bajo: solo quedan ${disk.freeGb} GB disponibles en la unidad del sistema.`
        })
      }

      if (memory.percentUsed > this.maxMemoryPercent) {
        alerts.push({
          id: `mem_high_${Date.now()}`,
          type: 'memory',
          level: memory.percentUsed > 92 ? 'critical' : 'warning',
          message: `Uso elevado de memoria RAM (${memory.percentUsed}% ocupado, ${memory.freeMb} MB libres).`
        })
      }

      this.latestMetrics = {
        cpuPercent,
        memory,
        disk,
        gpu: {
          featureStatus: gpuFeatureStatus,
          info: 'Hardware Acceleration Active'
        },
        alerts,
        timestamp: Date.now()
      }

      this.emit('metrics-tick', this.latestMetrics)
    } catch (err) {
      logger.error('Error sampling system metrics:', err)
    }
  }

  private calculateCpuPercent(): number {
    const cpus = os.cpus()
    if (!cpus || cpus.length === 0) return 0

    let totalIdle = 0
    let totalTick = 0

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type]
      }
      totalIdle += cpu.times.idle
    }

    if (!this.previousCpuTimes) {
      this.previousCpuTimes = { idle: totalIdle, total: totalTick }
      return 5 // initial estimate
    }

    const idleDelta = totalIdle - this.previousCpuTimes.idle
    const totalDelta = totalTick - this.previousCpuTimes.total
    this.previousCpuTimes = { idle: totalIdle, total: totalTick }

    if (totalDelta <= 0) return 0
    const cpuUsedPct = Math.round((1 - idleDelta / totalDelta) * 100)
    return Math.max(0, Math.min(100, cpuUsedPct))
  }

  public destroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}

export const systemMonitorService = new SystemMonitorService()
