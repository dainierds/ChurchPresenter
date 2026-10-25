import { describe, it, expect } from 'vitest'
import { reconcileRoleAssignments, formatDisplayTitle } from '../src/shared/display-utils'
import { DisplayInfo, RoleAssignment } from '../src/shared/types'

describe('Display Assignment Logic', () => {
  const mockDisplays: DisplayInfo[] = [
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

  it('keeps valid assignments when physical displays exist', () => {
    const saved: RoleAssignment = {
      main: 2,
      stage: 3,
      lobby: null
    }

    const res = reconcileRoleAssignments(saved, mockDisplays)
    expect(res.validAssignments['main']).toBe(2)
    expect(res.validAssignments['stage']).toBe(3)
    expect(res.validAssignments['lobby']).toBeNull()
    expect(res.missingDisplayWarnings).toHaveLength(0)
  })

  it('unassigns role and generates warning when a saved display is disconnected', () => {
    const saved: RoleAssignment = {
      main: 2,
      stage: 3,
      lobby: 99 // Disconnected display ID 99
    }

    const res = reconcileRoleAssignments(saved, mockDisplays)
    expect(res.validAssignments['main']).toBe(2)
    expect(res.validAssignments['stage']).toBe(3)
    expect(res.validAssignments['lobby']).toBeNull()
    expect(res.unassignedRoles).toContain('lobby')
    expect(res.missingDisplayWarnings).toEqual([
      { role: 'lobby', previousDisplayId: 99 }
    ])
  })

  it('supports multiple roles sharing the same physical screen', () => {
    const saved: RoleAssignment = {
      main: 2,
      lobby: 2 // Both main and lobby mapped to display 2
    }

    const res = reconcileRoleAssignments(saved, mockDisplays)
    expect(res.validAssignments['main']).toBe(2)
    expect(res.validAssignments['lobby']).toBe(2)
    expect(res.missingDisplayWarnings).toHaveLength(0)
  })

  it('formats display title clearly with primary flag', () => {
    const primaryTitle = formatDisplayTitle(mockDisplays[0])
    expect(primaryTitle).toContain('Pantalla 1: 1920x1080 (Principal)')

    const secondaryTitle = formatDisplayTitle(mockDisplays[1])
    expect(secondaryTitle).toContain('Pantalla 2: 1920x1080')
    expect(secondaryTitle).not.toContain('(Principal)')
  })
})
