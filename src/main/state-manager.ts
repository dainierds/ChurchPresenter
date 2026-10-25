import { EventEmitter } from 'events'
import {
  GlobalControls,
  PresenterState,
  SlideItem,
  TestSlide,
  ThemeConfig,
  DEFAULT_THEME,
  OutputLayersState
} from '../shared/types'
import {
  createInitialPresenterState,
  toggleControlInState
} from '../shared/state-utils'
import { logger } from './logger'

export class StateManager extends EventEmitter {
  private state: PresenterState

  constructor() {
    super()
    this.state = {
      ...createInitialPresenterState(),
      currentTheme: DEFAULT_THEME
    }
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

  public sendSlide(
    slide: TestSlide | SlideItem,
    targetRoles: string[] = ['main', 'lobby', 'stage'],
    nextSlide?: SlideItem
  ): PresenterState {
    const newActiveLayers: Record<string, OutputLayersState> = { ...this.state.activeLayers }
    const background = slide.background || this.state.currentTheme.background

    for (const role of targetRoles) {
      const prev = newActiveLayers[role] || {
        background,
        content: null,
        overlay: { showLogo: false },
        message: null,
        theme: this.state.currentTheme
      }

      // Special handling for stage (confidence monitor): pass current + next
      if (role === 'stage') {
        newActiveLayers[role] = {
          ...prev,
          background: { type: 'color', value: '#000000' },
          content: {
            id: slide.id,
            title: slide.title,
            body: slide.body,
            subtitle: slide.subtitle,
            nextSlideTitle: nextSlide?.title || nextSlide?.subtitle,
            nextSlideBody: nextSlide?.body
          },
          theme: this.state.currentTheme
        }
      } else {
        newActiveLayers[role] = {
          ...prev,
          background,
          content: {
            id: slide.id,
            title: slide.title,
            body: slide.body,
            subtitle: slide.subtitle
          },
          theme: this.state.currentTheme
        }
      }
    }

    this.state = {
      ...this.state,
      currentSlide: {
        id: slide.id,
        title: slide.title,
        body: slide.body,
        subtitle: slide.subtitle,
        nextSlideTitle: nextSlide?.title || nextSlide?.subtitle,
        nextSlideBody: nextSlide?.body
      },
      activeLayers: newActiveLayers,
      controls: {
        ...this.state.controls,
        clear: false // Automatically clear 'clear' blackout on new slide
      },
      updatedAt: Date.now()
    }

    logger.info(`Projected slide '${slide.title || slide.id}' to roles: ${targetRoles.join(', ')}`)
    this.emit('state-updated', this.state)
    return this.state
  }

  public setOutputMessage(role: string, text: string, visible: boolean): PresenterState {
    const currentLayers = this.state.activeLayers[role] || {
      background: this.state.currentTheme.background,
      content: null,
      overlay: { showLogo: false },
      message: null,
      theme: this.state.currentTheme
    }
    this.state = {
      ...this.state,
      activeLayers: {
        ...this.state.activeLayers,
        [role]: {
          ...currentLayers,
          message: { text, visible }
        }
      },
      updatedAt: Date.now()
    }
    logger.info(`Message for role '${role}' set to '${text}' (visible: ${visible})`)
    this.emit('state-updated', this.state)
    return this.state
  }

  public setTheme(theme: ThemeConfig): PresenterState {
    this.state = {
      ...this.state,
      currentTheme: theme,
      updatedAt: Date.now()
    }
    logger.info(`Applied theme '${theme.name}' (${theme.id})`)
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
