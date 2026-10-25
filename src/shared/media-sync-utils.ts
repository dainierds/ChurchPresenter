/**
 * Pure utility functions for media synchronization, drift correction and trim calculations.
 */

/**
 * Calculates drift between local playback time and master clock.
 */
export function calculateDrift(localTime: number, masterTime: number): number {
  return localTime - masterTime
}

/**
 * Determines if playback requires correction (seek or rate adjustment).
 * Typical tolerance threshold is 0.150 seconds (150ms).
 */
export function shouldCorrectDrift(drift: number, thresholdSeconds: number = 0.15): boolean {
  return Math.abs(drift) > thresholdSeconds
}

/**
 * Clamps playback time between inPoint, outPoint, and media duration.
 */
export function clampMediaTime(
  time: number,
  inPoint: number = 0,
  outPoint?: number,
  duration?: number
): number {
  const min = Math.max(0, inPoint)
  let max = duration && duration > 0 ? duration : Number.MAX_SAFE_INTEGER
  if (outPoint !== undefined && outPoint > min) {
    max = Math.min(max, outPoint)
  }
  return Math.max(min, Math.min(time, max))
}

/**
 * Calculates dynamic volume multiplier during fade-in and fade-out periods.
 */
export function calculateFadeVolume(
  currentTime: number,
  inPoint: number = 0,
  outPoint?: number,
  duration?: number,
  fadeInSeconds: number = 0,
  fadeOutSeconds: number = 0,
  baseVolume: number = 1.0
): number {
  const effectiveEnd = outPoint && outPoint > inPoint ? outPoint : (duration || currentTime + 1)
  const timeFromStart = currentTime - inPoint
  const timeToEnd = effectiveEnd - currentTime

  let multiplier = 1.0

  if (fadeInSeconds > 0 && timeFromStart < fadeInSeconds) {
    multiplier = Math.max(0, timeFromStart / fadeInSeconds)
  } else if (fadeOutSeconds > 0 && timeToEnd < fadeOutSeconds) {
    multiplier = Math.max(0, timeToEnd / fadeOutSeconds)
  }

  return Math.min(1.0, Math.max(0.0, baseVolume * multiplier))
}
