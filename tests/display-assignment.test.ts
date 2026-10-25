import { describe, it, expect } from 'vitest'
import {
  reconcileRoleAssignments,
  formatDisplayTitle,
  enrichDisplaysWithStableIds
} from '../src/shared/display-utils'
import { RoleAssignment } from '../src/shared/types'

describe('Display Assignment Logic', () => {
  const rawDisplays = [
    {
      id: 1,
      name: 'Primary Display',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      isPrimary: true
    },
    {
      id: 2,
      name: 'Auditorium Projector via Splitter',
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      isPrimary: false
    },
    {
      id: 3,
      name: 'Stage Monitor',
      bounds: { x: 3840, y: 0, width: 1920, height: 1080 },
      workArea: { x: 3840, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      isPrimary: false
    }
  ]

  const mockDisplays = enrichDisplaysWithStableIds(rawDisplays)

  it('keeps valid assignments when physical displays exist', () => {
    const saved: RoleAssignment = {
      main: mockDisplays[1].stableId,
      stage: mockDisplays[2].stableId,
      lobby: null
    }

    const res = reconcileRoleAssignments(saved, mockDisplays)
    expect(res.activeAssignments['main']).toBe(mockDisplays[1].stableId)
    expect(res.activeAssignments['stage']).toBe(mockDisplays[2].stableId)
    expect(res.unassignedRoles).toContain('lobby')
    expect(res.missingDisplayWarnings).toHaveLength(0)
  })

  it('preserves saved assignment in disconnectedRoles when display disconnects', () => {
    const saved: RoleAssignment = {
      main: mockDisplays[1].stableId,
      stage: mockDisplays[2].stableId,
      lobby: 'disp_unknown-screen_1920x1080_idx_0_pos_9999_0'
    }

    const res = reconcileRoleAssignments(saved, mockDisplays)
    expect(res.activeAssignments['main']).toBe(mockDisplays[1].stableId)
    expect(res.activeAssignments['stage']).toBe(mockDisplays[2].stableId)
    expect(res.disconnectedRoles['lobby']).toBe('disp_unknown-screen_1920x1080_idx_0_pos_9999_0')
    expect(res.missingDisplayWarnings).toEqual([
      { role: 'lobby', previousStableId: 'disp_unknown-screen_1920x1080_idx_0_pos_9999_0' }
    ])
  })

  it('formats display title clearly with primary flag', () => {
    const primaryTitle = formatDisplayTitle(mockDisplays[0])
    expect(primaryTitle).toContain('Pantalla 1: Primary Display (1920x1080) (Principal)')

    const secondaryTitle = formatDisplayTitle(mockDisplays[1])
    expect(secondaryTitle).toContain('Pantalla 2: Auditorium Projector via Splitter (1920x1080)')
    expect(secondaryTitle).not.toContain('(Principal)')
  })
})
