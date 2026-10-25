import { describe, it, expect } from 'vitest'
import {
  generateStableDisplayId,
  reconcileRoleAssignments,
  matchDisplayByStableId,
  DisplayReconciliationResult
} from '../src/shared/display-utils'
import { DisplayInfo, RoleAssignment } from '../src/shared/types'

describe('Display Stable Identification & Reconnection Logic', () => {
  const displayA: DisplayInfo = {
    id: 1,
    stableId: 'disp_dell-p2419h_1920x1080_pos_0_0',
    name: 'DELL P2419H',
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
    isPrimary: true
  }

  // Identical model to Display A, but positioned as second monitor
  const displayB: DisplayInfo = {
    id: 2,
    stableId: 'disp_dell-p2419h_1920x1080_pos_1920_0',
    name: 'DELL P2419H',
    bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
    workArea: { x: 1920, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: false
  }

  const displayC_Projector: DisplayInfo = {
    id: 3,
    stableId: 'disp_epson-projector_1920x1080_pos_3840_0',
    name: 'Epson Projector',
    bounds: { x: 3840, y: 0, width: 1920, height: 1080 },
    workArea: { x: 3840, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
    isPrimary: false
  }

  it('generates distinct stable IDs for two identical screen models based on position', () => {
    const idA = generateStableDisplayId(displayA)
    const idB = generateStableDisplayId(displayB)

    expect(idA).not.toEqual(idB)
    expect(idA).toBe('disp_dell-p2419h_1920x1080_pos_0_0')
    expect(idB).toBe('disp_dell-p2419h_1920x1080_pos_1920_0')
  })

  it('handles disconnection without deleting the saved assignment', () => {
    const savedAssignments: RoleAssignment = {
      main: displayC_Projector.stableId,
      stage: displayB.stableId
    }

    // Projector (displayC) is disconnected
    const currentDisplays = [displayA, displayB]

    const result: DisplayReconciliationResult = reconcileRoleAssignments(
      savedAssignments,
      currentDisplays
    )

    // Stage is still actively connected
    expect(result.activeAssignments['stage']).toBe(displayB.stableId)
    // Main assignment is preserved in saved assignments, but marked disconnected
    expect(result.disconnectedRoles['main']).toBe(displayC_Projector.stableId)
    expect(result.activeAssignments['main']).toBeUndefined()
    expect(result.reconnectedRoles).toHaveLength(0)
  })

  it('handles automatic reconnection when known display plugs back in', () => {
    const savedAssignments: RoleAssignment = {
      main: displayC_Projector.stableId,
      stage: displayB.stableId
    }

    // Initially projector was disconnected
    const initiallyConnected = [displayA, displayB]
    const res1 = reconcileRoleAssignments(savedAssignments, initiallyConnected)
    expect(res1.disconnectedRoles['main']).toBe(displayC_Projector.stableId)

    // Now projector plugs back in
    const reconnectedDisplays = [displayA, displayB, displayC_Projector]
    const res2 = reconcileRoleAssignments(savedAssignments, reconnectedDisplays, {
      previouslyDisconnected: ['main']
    })

    expect(res2.activeAssignments['main']).toBe(displayC_Projector.stableId)
    expect(res2.disconnectedRoles['main']).toBeUndefined()
    expect(res2.reconnectedRoles).toContain('main')
  })

  it('handles screen order or position shifts gracefully (fuzzy fallback)', () => {
    // Windows shifted the projector's virtual coordinate from x=3840 to x=2560
    const shiftedProjector: DisplayInfo = {
      ...displayC_Projector,
      bounds: { x: 2560, y: 0, width: 1920, height: 1080 },
      stableId: 'disp_epson-projector_1920x1080_pos_2560_0'
    }

    const currentDisplays = [displayA, shiftedProjector]
    const matched = matchDisplayByStableId(
      'disp_epson-projector_1920x1080_pos_3840_0',
      currentDisplays
    )

    expect(matched).toBeDefined()
    expect(matched?.name).toBe('Epson Projector')
    expect(matched?.bounds.x).toBe(2560)
  })

  it('differentiates two identical screens properly without mixing assignments', () => {
    const savedAssignments: RoleAssignment = {
      operator: displayA.stableId,
      stage: displayB.stableId
    }

    const currentDisplays = [displayA, displayB]
    const result = reconcileRoleAssignments(savedAssignments, currentDisplays)

    expect(result.activeAssignments['operator']).toBe(displayA.stableId)
    expect(result.activeAssignments['stage']).toBe(displayB.stableId)
  })
})
