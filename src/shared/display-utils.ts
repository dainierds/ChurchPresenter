import { DisplayInfo, RoleAssignment } from './types'

export interface DisplayReconciliationResult {
  activeAssignments: RoleAssignment
  disconnectedRoles: Record<string, string> // role -> savedStableId
  unassignedRoles: string[]
  reconnectedRoles: string[]
  missingDisplayWarnings: { role: string; previousStableId: string }[]
}

/**
 * Normalizes display name string.
 */
export function sanitizeDisplayName(name: string): string {
  return (name || 'display')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
}

/**
 * Generates a deterministic stable identifier for a physical screen.
 * Format: disp_{cleanName}_{width}x{height}_idx_{siblingIndex}_pos_{x}_{y}
 */
export function generateStableDisplayId(
  display: {
    name: string
    bounds: { x: number; y: number; width: number; height: number }
    scaleFactor: number
  },
  siblingIndex: number = 0
): string {
  const cleanName = sanitizeDisplayName(display.name)
  return `disp_${cleanName}_${display.bounds.width}x${display.bounds.height}_idx_${siblingIndex}_pos_${display.bounds.x}_${display.bounds.y}`
}

/**
 * Assigns sibling indices to a list of displays based on system enumeration order
 * for screens that share the exact same model name and resolution.
 */
export function enrichDisplaysWithStableIds(
  rawDisplays: {
    id: number
    name: string
    bounds: { x: number; y: number; width: number; height: number }
    workArea: { x: number; y: number; width: number; height: number }
    scaleFactor: number
    isPrimary: boolean
    isInternal?: boolean
  }[]
): DisplayInfo[] {
  const siblingCounts: Record<string, number> = {}

  return rawDisplays.map((d) => {
    const key = `${sanitizeDisplayName(d.name)}_${d.bounds.width}x${d.bounds.height}`
    const idx = siblingCounts[key] || 0
    siblingCounts[key] = idx + 1

    const stableId = generateStableDisplayId(d, idx)

    return {
      ...d,
      stableId
    }
  })
}

/**
 * Parses the constituent parts of a stableId.
 */
export function parseStableDisplayId(stableId: string): {
  cleanName: string
  resolution: string
  siblingIndex: number
  x: number
  y: number
} | null {
  // Format: disp_{cleanName}_{width}x{height}_idx_{siblingIndex}_pos_{x}_{y}
  const match = stableId.match(/^disp_(.+)_(\d+x\d+)_idx_(\d+)_pos_(-?\d+)_(-?\d+)$/)
  if (match) {
    return {
      cleanName: match[1],
      resolution: match[2],
      siblingIndex: Number(match[3]),
      x: Number(match[4]),
      y: Number(match[5])
    }
  }

  // Legacy format support without idx: disp_{cleanName}_{width}x{height}_pos_{x}_{y}
  const legacyMatch = stableId.match(/^disp_(.+)_(\d+x\d+)_pos_(-?\d+)_(-?\d+)$/)
  if (legacyMatch) {
    return {
      cleanName: legacyMatch[1],
      resolution: legacyMatch[2],
      siblingIndex: 0,
      x: Number(legacyMatch[3]),
      y: Number(legacyMatch[4])
    }
  }

  return null
}

/**
 * Matches a display given a saved stableId against the currently connected displays.
 * Multi-stage resolution:
 * 1. Exact match on stableId (same name, resolution, sibling index, position).
 * 2. Position or port changed: match by (name, resolution, siblingIndex) among available candidates.
 * 3. Unambiguous model & resolution match (single screen of this model).
 */
export function matchDisplayByStableId(
  savedStableId: string,
  currentDisplays: DisplayInfo[],
  claimedDisplayIds: Set<string> = new Set()
): DisplayInfo | undefined {
  if (!savedStableId) return undefined

  // 1. Exact match
  const exact = currentDisplays.find((d) => d.stableId === savedStableId && !claimedDisplayIds.has(d.stableId))
  if (exact) return exact

  const parsed = parseStableDisplayId(savedStableId)
  if (!parsed) return undefined

  // 2. Position or port changed: match candidate with same name, resolution and sibling index
  const availableSameModel = currentDisplays.filter((d) => {
    if (claimedDisplayIds.has(d.stableId)) return false
    const dParsed = parseStableDisplayId(d.stableId)
    return dParsed && dParsed.cleanName === parsed.cleanName && dParsed.resolution === parsed.resolution
  })

  // Check matching sibling index first
  const siblingMatch = availableSameModel.find((d) => {
    const dParsed = parseStableDisplayId(d.stableId)
    return dParsed && dParsed.siblingIndex === parsed.siblingIndex
  })
  if (siblingMatch) return siblingMatch

  // 3. If there is only one available screen of this model/resolution, match it
  if (availableSameModel.length === 1) {
    return availableSameModel[0]
  }

  return undefined
}

/**
 * Reconciles saved role assignments with currently detected physical displays.
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
  const claimedDisplayIds = new Set<string>()

  for (const [role, savedStableId] of Object.entries(savedAssignments)) {
    if (!savedStableId) {
      unassignedRoles.push(role)
      continue
    }

    const matchedDisplay = matchDisplayByStableId(savedStableId, currentDisplays, claimedDisplayIds)

    if (matchedDisplay) {
      activeAssignments[role] = matchedDisplay.stableId
      // Mark as claimed so two roles don't unintentionally claim the same identical sibling
      claimedDisplayIds.add(matchedDisplay.stableId)

      if (previouslyDisconnectedSet.has(role)) {
        reconnectedRoles.push(role)
      }
    } else {
      // Screen is disconnected; keep saved assignment for future auto-reconnection
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
