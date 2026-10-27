import { describe, it, expect } from 'vitest'
import { SystemMonitorService } from '../src/main/health/system-monitor-service'

describe('System Monitor Metrics (Phase 7)', () => {
  it('samples valid CPU, Memory and Disk metrics', async () => {
    const monitor = new SystemMonitorService()
    const metrics = await monitor.getMetrics()

    expect(metrics).toBeDefined()
    expect(typeof metrics.cpuPercent).toBe('number')
    expect(metrics.cpuPercent).toBeGreaterThanOrEqual(0)
    expect(metrics.cpuPercent).toBeLessThanOrEqual(100)

    expect(metrics.memory).toBeDefined()
    expect(metrics.memory.totalMb).toBeGreaterThan(0)
    expect(metrics.memory.percentUsed).toBeGreaterThanOrEqual(0)

    expect(metrics.disk).toBeDefined()
    expect(metrics.timestamp).toBeGreaterThan(0)
  })

  it('triggers alerts when memory threshold is exceeded', async () => {
    const monitor = new SystemMonitorService()
    // Configure artificial threshold: max 1% memory
    monitor.setThresholds(10, 1)

    const metrics = await monitor.getMetrics()
    expect(metrics.alerts.some((a) => a.type === 'memory')).toBe(true)
  })
})
