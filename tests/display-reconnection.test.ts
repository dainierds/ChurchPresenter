import { describe, it, expect } from 'vitest'
import {
  generateStableDisplayId,
  reconcileRoleAssignments,
  matchDisplayByStableId,
  enrichDisplaysWithStableIds
} from '../src/shared/display-utils'
import { DisplayInfo, RoleAssignment } from '../src/shared/types'

describe('Display Stable Identification & Reconnection Logic', () => {
  const rawDisplays = [
    {
      id: 1,
      name: 'DELL P2419H',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1,
      isPrimary: true
    },
    // Second identical monitor
    {
      id: 2,
      name: 'DELL P2419H',
      bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
      workArea: { x: 1920, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      isPrimary: false
    },
    // Projector
    {
      id: 3,
      name: 'Epson Projector',
      bounds: { x: 3840, y: 0, width: 1920, height: 1080 },
      workArea: { x: 3840, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
      isPrimary: false
    }
  ]

  const enriched = enrichDisplaysWithStableIds(rawDisplays)
  const displayA = enriched[0] // DELL 1 (idx 0)
  const displayB = enriched[1] // DELL 2 (idx 1)
  const displayC_Projector = enriched[2] // Epson (idx 0)

  it('generates distinct stable IDs including sibling index for identical screens', () => {
    expect(displayA.stableId).toContain('idx_0')
    expect(displayB.stableId).toContain('idx_1')
    expect(displayA.stableId).not.toEqual(displayB.stableId)
  })

  it('handles disconnection without deleting the saved assignment', () => {
    const savedAssignments: RoleAssignment = {
      main: displayC_Projector.stableId,
      stage: displayB.stableId
    }

    // Projector is disconnected
    const currentDisplays = [displayA, displayB]
    const result = reconcileRoleAssignments(savedAssignments, currentDisplays)

    expect(result.activeAssignments['stage']).toBe(displayB.stableId)
    expect(result.disconnectedRoles['main']).toBe(displayC_Projector.stableId)
    expect(result.activeAssignments['main']).toBeUndefined()
  })

  it('handles automatic reconnection when known display plugs back in', () => {
    const savedAssignments: RoleAssignment = {
      main: displayC_Projector.stableId,
      stage: displayB.stableId
    }

    const reconnectedDisplays = [displayA, displayB, displayC_Projector]
    const result = reconcileRoleAssignments(savedAssignments, reconnectedDisplays, {
      previouslyDisconnected: ['main']
    })

    expect(result.activeAssignments['main']).toBe(displayC_Projector.stableId)
    expect(result.disconnectedRoles['main']).toBeUndefined()
    expect(result.reconnectedRoles).toContain('main')
  })

  it('tolerates screen position and port changes when name and resolution match', () => {
    // Saved with original coordinates x=3840, y=0
    const originalStableId = displayC_Projector.stableId

    // Port/position changed: projector is now at x=2560, y=100
    const movedProjector: DisplayInfo = {
      ...displayC_Projector,
      bounds: { x: 2560, y: 100, width: 1920, height: 1080 },
      stableId: generateStableDisplayId({
        name: 'Epson Projector',
        bounds: { x: 2560, y: 100, width: 1920, height: 1080 },
        scaleFactor: 1
      }, 0)
    }

    const matched = matchDisplayByStableId(originalStableId, [displayA, displayB, movedProjector])
    expect(matched).toBeDefined()
    expect(matched?.name).toBe('Epson Projector')
    expect(matched?.bounds.x).toBe(2560)
  })

  it('distinguishes two identical screens by appearance order (sibling index) when positions change', () => {
    // Stage was assigned to Dell monitor #2 (sibling idx 1)
    const savedAssignments: RoleAssignment = {
      operator: displayA.stableId, // idx 0
      stage: displayB.stableId     // idx 1
    }

    // Suppose Windows swapped the monitors' virtual positions:
    // Sibling 0 is now at x=1920 and Sibling 1 is at x=0
    const swappedRaw = [
      {
        id: 10,
        name: 'DELL P2419H',
        bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
        workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1,
        isPrimary: false
      },
      {
        id: 20,
        name: 'DELL P2419H',
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
        scaleFactor: 1,
        isPrimary: true
      }
    ]

    const swappedEnriched = enrichDisplaysWithStableIds(swappedRaw)
    const result = reconcileRoleAssignments(savedAssignments, swappedEnriched)

    // Sibling 0 maps to operator, Sibling 1 maps to stage
    expect(result.activeAssignments['operator']).toBe(swappedEnriched[0].stableId)
    expect(result.activeAssignments['stage']).toBe(swappedEnriched[1].stableId)
    expect(result.activeAssignments['operator']).not.toEqual(result.activeAssignments['stage'])
  })
})
