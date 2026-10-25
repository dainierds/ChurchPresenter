import { EventEmitter } from 'events'
import {
  GlobalControls,
  PresenterState,
  TestSlide
} from '../shared/types'
import {
  createInitialPresenterState,
  toggleControlInState,
  applySlideToState
} from '../shared/state-utils'
import { logger } from './logger'

export class StateManager extends EventEmitter {
  private state: PresenterState

  constructor() {
    super()
    this.state = createInitialPresenterState()
  }

  public getState(): PresenterState {
    return this.state
  }

  public setGlobalControl(control: keyof GlobalControls, value: boolean): PresenterState {
    this.state = {
      ...this.state,
      controls: {
        ...this.state.controls,
        [control]: value
      },
      updatedAt: Date.now()
    }
    logger.info(`Global control '${control}' set to ${value}`)
    this.emit('state-updated', this.state)
    return this.state
  }

  public toggleGlobalControl(control: keyof GlobalControls): PresenterState {
    this.state = toggleControlInState(this.state, control)
    logger.info(`Global control '${control}' toggled to ${this.state.controls[control]}`)
    this.emit('state-updated', this.state)
    return this.state
  }

  public sendSlide(slide: TestSlide, targetRoles?: string[]): PresenterState {
    this.state = applySlideToState(this.state, slide, targetRoles)
    logger.info(`Slide '${slide.title}' (${slide.id}) sent to roles: ${targetRoles?.join(', ') || 'default'}`)
    this.emit('state-updated', this.state)
    return this.state
  }

  public setStressTestMode(enabled: boolean): PresenterState {
    this.state = {
      ...this.state,
      stressTestMode: enabled,
      updatedAt: Date.now()
    }
    logger.info(`Stress test mode set to: ${enabled}`)
    this.emit('state-updated', this.state)
    return this.state
  }
}

export const stateManager = new StateManager()
