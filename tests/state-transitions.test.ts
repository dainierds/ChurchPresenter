import { describe, it, expect } from 'vitest'
import {
  createInitialPresenterState,
  toggleControlInState,
  applySlideToState,
  computeLayerVisibility
} from '../src/shared/state-utils'
import { INITIAL_TEST_SLIDES } from '../src/shared/test-slides'

describe('State Transitions & Layer Logic', () => {
  it('initializes with default controls disabled', () => {
    const state = createInitialPresenterState()
    expect(state.controls.black).toBe(false)
    expect(state.controls.clear).toBe(false)
    expect(state.controls.logo).toBe(false)
    expect(state.controls.freeze).toBe(false)
    expect(state.currentSlide).toBeNull()
  })

  it('toggles controls properly', () => {
    let state = createInitialPresenterState()
    state = toggleControlInState(state, 'black')
    expect(state.controls.black).toBe(true)

    state = toggleControlInState(state, 'black')
    expect(state.controls.black).toBe(false)

    state = toggleControlInState(state, 'freeze')
    expect(state.controls.freeze).toBe(true)
  })

  it('applies slide to main, lobby and stage correctly', () => {
    const initialState = createInitialPresenterState()
    const slide = INITIAL_TEST_SLIDES[0]
    const nextState = applySlideToState(initialState, slide, ['main', 'lobby'])

    expect(nextState.currentSlide?.id).toBe(slide.id)
    expect(nextState.activeLayers['main'].content?.title).toBe(slide.title)
    expect(nextState.activeLayers['lobby'].content?.title).toBe(slide.title)
    expect(nextState.activeLayers['stage'].content?.title).toBe(slide.title)
    expect(nextState.activeLayers['main'].background.value).toBe(slide.background.value)
  })

  it('computes blackout visibility when black control is active', () => {
    const visibility = computeLayerVisibility('main', {
      black: true,
      clear: false,
      logo: false,
      freeze: false
    })

    expect(visibility.isBlackout).toBe(true)
    expect(visibility.showBackground).toBe(false)
    expect(visibility.showContent).toBe(false)
    expect(visibility.showOverlay).toBe(false)
  })

  it('computes clear visibility keeping background but hiding content', () => {
    const visibility = computeLayerVisibility('main', {
      black: false,
      clear: true,
      logo: false,
      freeze: false
    })

    expect(visibility.isBlackout).toBe(false)
    expect(visibility.showBackground).toBe(true)
    expect(visibility.showContent).toBe(false)
  })

  it('shows overlay and logo when logo control is active', () => {
    const visibility = computeLayerVisibility('main', {
      black: false,
      clear: false,
      logo: true,
      freeze: false
    })

    expect(visibility.showOverlay).toBe(true)
    expect(visibility.showContent).toBe(false)
  })
})
