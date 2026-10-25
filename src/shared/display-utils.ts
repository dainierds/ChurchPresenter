import { DisplayInfo, RoleAssignment } from './types'

export interface RoleResolutionResult {
  validAssignments: RoleAssignment
  unassignedRoles: string[]
  missingDisplayWarnings: { role: string; previousDisplayId: number }[]
}

/**
 * Reconciles stored role assignments with currently detected physical displays.
 * If a previously assigned display is no longer present, the role becomes unassigned
 * and a warning is produced for the operator without crashing or breaking state.
 */
export function reconcileRoleAssignments(
  savedAssignments: RoleAssignment,
  currentDisplays: DisplayInfo[]
): RoleResolutionResult {
  const currentDisplayIds = new Set(currentDisplays.map((d) => d.id))
  const validAssignments: RoleAssignment = {}
  const unassignedRoles: string[] = []
  const missingDisplayWarnings: { role: string; previousDisplayId: number }[] = []

  for (const [role, displayId] of Object.entries(savedAssignments)) {
    if (displayId === null || displayId === undefined) {
      validAssignments[role] = null
      unassignedRoles.push(role)
    } else if (currentDisplayIds.has(displayId)) {
      validAssignments[role] = displayId
    } else {
      // Display was unplugged / disappeared
      validAssignments[role] = null
      unassignedRoles.push(role)
      missingDisplayWarnings.push({ role, previousDisplayId: displayId })
    }
  }

  return {
    validAssignments,
    unassignedRoles,
    missingDisplayWarnings
  }
}

/**
 * Formats display name with resolution and refresh rate/scale factor.
 */
export function formatDisplayTitle(display: DisplayInfo): string {
  const primaryTag = display.isPrimary ? ' (Principal)' : ''
  return `Pantalla ${display.id}: ${display.bounds.width}x${display.bounds.height}${primaryTag}`
}
