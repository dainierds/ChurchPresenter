import { DisplayInfo, RoleAssignment } from './types'

export interface DisplayReconciliationResult {
  activeAssignments: RoleAssignment
  disconnectedRoles: Record<string, string> // role -> savedStableId
  unassignedRoles: string[]
  reconnectedRoles: string[]
  missingDisplayWarnings: { role: string; previousStableId: string }[]
}

/**
 * Generates a deterministic stable identifier for a physical screen.
 * Combines sanitized display name, resolution, and spatial bounds coordinates.
 */
export function generateStableDisplayId(display: {
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary?: boolean
}): string {
  const cleanName = (display.name || 'display')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
  return `disp_${cleanName}_${display.bounds.width}x${display.bounds.height}_pos_${display.bounds.x}_${display.bounds.y}`
}

/**
 * Matches a display given a saved stableId against the currently connected displays.
 * Performs exact match first, and falls back to fuzzy match (same model name + resolution)
 * if Windows shifted the virtual coordinates or display layout order.
 */
export function matchDisplayByStableId(
  savedStableId: string,
  currentDisplays: DisplayInfo[]
): DisplayInfo | undefined {
  if (!savedStableId) return undefined

  // 1. Exact match on stableId
  const exact = currentDisplays.find((d) => d.stableId === savedStableId)
  if (exact) return exact

  // 2. Fuzzy match: parse name and resolution from savedStableId
  // Format: disp_{cleanName}_{width}x{height}_pos_{x}_{y}
  const match = savedStableId.match(/^disp_(.+)_(\d+x\d+)_pos_(-?\d+)_(-?\d+)$/)
  if (match) {
    const [, modelName, resolution] = match
    const candidates = currentDisplays.filter((d) => {
      const dCleanName = (d.name || 'display')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
      const dRes = `${d.bounds.width}x${d.bounds.height}`
      return dCleanName === modelName && dRes === resolution
    })

    // If there is an unambiguous candidate matching model and resolution, use it
    if (candidates.length === 1) {
      return candidates[0]
    }
  }

  return undefined
}

/**
 * Reconciles saved role assignments with currently detected physical displays.
 * - If a display is missing, the role is kept in saved assignments, marked disconnected, and warning generated.
 * - When a missing display reappears, it is flagged as reconnected so its window can be reopened automatically.
 */
export function reconcileRoleAssignments(
  savedAssignments: RoleAssignment,
  currentDisplays: DisplayInfo[],
  options?: { previouslyDisconnected?: string[] }
): DisplayReconciliationResult {
  const activeAssignments: RoleAssignment = {}
  const disconnectedRoles: Record<string, string> = {}
  const unassignedRoles: string[] = []
  const reconnectedRoles: string[] = []
  const missingDisplayWarnings: { role: string; previousStableId: string }[] = []

  const previouslyDisconnectedSet = new Set(options?.previouslyDisconnected || [])

  for (const [role, savedStableId] of Object.entries(savedAssignments)) {
    if (!savedStableId) {
      unassignedRoles.push(role)
      continue
    }

    const matchedDisplay = matchDisplayByStableId(savedStableId, currentDisplays)

    if (matchedDisplay) {
      activeAssignments[role] = matchedDisplay.stableId
      if (previouslyDisconnectedSet.has(role)) {
        reconnectedRoles.push(role)
      }
    } else {
      // Screen is disconnected; preserve savedStableId so it can auto-reconnect later
      disconnectedRoles[role] = savedStableId
      missingDisplayWarnings.push({ role, previousStableId: savedStableId })
    }
  }

  return {
    activeAssignments,
    disconnectedRoles,
    unassignedRoles,
    reconnectedRoles,
    missingDisplayWarnings
  }
}

/**
 * Formats display name with resolution and refresh rate/scale factor.
 */
export function formatDisplayTitle(display: DisplayInfo): string {
  const primaryTag = display.isPrimary ? ' (Principal)' : ''
  return `Pantalla ${display.id}: ${display.name} (${display.bounds.width}x${display.bounds.height})${primaryTag}`
}
