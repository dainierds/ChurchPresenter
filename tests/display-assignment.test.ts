import { describe, it, expect } from 'vitest'
import {
  reconcileRoleAssignments,
  formatDisplayTitle,
  enrichDisplaysWithStableIds,
  matchDisplayByStableId
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

  it('determines role status as unassigned/deactivated when display is disconnected or absent', () => {
    // Single connected monitor (e.g. laptop only)
    const singleDisplay = [mockDisplays[0]]
    const savedAssignments: RoleAssignment = {
      main: 'disp_saved-projector_1920x1080_idx_1',
      stage: 'disp_saved-stage_1920x1080_idx_2',
      lobby: null
    }

    // Role is connected only if assigned AND matched with currently connected displays
    const isMainConnected = Boolean(savedAssignments.main && matchDisplayByStableId(savedAssignments.main, singleDisplay))
    const isStageConnected = Boolean(savedAssignments.stage && matchDisplayByStableId(savedAssignments.stage, singleDisplay))
    const isLobbyConnected = Boolean(savedAssignments.lobby && matchDisplayByStableId(savedAssignments.lobby, singleDisplay))

    expect(isMainConnected).toBe(false)
    expect(isStageConnected).toBe(false)
    expect(isLobbyConnected).toBe(false)

    // Toolbar status class must be 'unassigned' (deactivated / grey dot) for all of them
    const audienceStatus = isMainConnected ? 'connected' : 'unassigned'
    const stageStatus = isStageConnected ? 'connected' : 'unassigned'
    const lobbyStatus = isLobbyConnected ? 'connected' : 'unassigned'

    expect(audienceStatus).toBe('unassigned')
    expect(stageStatus).toBe('unassigned')
    expect(lobbyStatus).toBe('unassigned')
  })
})
