import {
  GlobalControls,
  OutputLayersState,
  PresenterState,
  TestSlide,
  DEFAULT_THEME,
  DEFAULT_CHURCH_BRANDING
} from './types'

export function createInitialOutputLayersState(): OutputLayersState {
  return {
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #181818 0%, #242424 100%)'
    },
    content: null,
    overlay: {
      showLogo: false,
      logoUrl: undefined,
      text: undefined
    },
    message: null
  }
}

export function createInitialPresenterState(): PresenterState {
  return {
    controls: {
      black: false,
      clear: false,
      logo: false,
      freeze: false
    },
    currentSlide: null,
    activeLayers: {
      main: createInitialOutputLayersState(),
      stage: createInitialOutputLayersState(),
      lobby: createInitialOutputLayersState()
    },
    currentTheme: DEFAULT_THEME,
    stressTestMode: false,
    churchBranding: { ...DEFAULT_CHURCH_BRANDING },
    updatedAt: Date.now()
  }
}

/**
 * Toggles a global control in the presenter state.
 */
export function toggleControlInState(
  state: PresenterState,
  control: keyof GlobalControls
): PresenterState {
  const newControls = {
    ...state.controls,
    [control]: !state.controls[control]
  }

  return {
    ...state,
    controls: newControls,
    updatedAt: Date.now()
  }
}

/**
 * Sets a slide as current content for specified roles (defaults to main and lobby).
 */
export function applySlideToState(
  state: PresenterState,
  slide: TestSlide,
  targetRoles: string[] = ['main', 'lobby']
): PresenterState {
  const newActiveLayers = { ...state.activeLayers }

  for (const role of targetRoles) {
    const prevLayer = newActiveLayers[role] || createInitialOutputLayersState()
    newActiveLayers[role] = {
      ...prevLayer,
      background: slide.background,
      content: {
        id: slide.id,
        title: slide.title,
        body: slide.body,
        subtitle: slide.subtitle
      }
    }
  }

  // Also stage gets the text content for the musicians / confidence monitor
  if (!targetRoles.includes('stage')) {
    const prevStage = newActiveLayers['stage'] || createInitialOutputLayersState()
    newActiveLayers['stage'] = {
      ...prevStage,
      content: {
        id: slide.id,
        title: slide.title,
        body: slide.body,
        subtitle: slide.subtitle
      }
    }
  }

  return {
    ...state,
    currentSlide: {
      id: slide.id,
      title: slide.title,
      body: slide.body,
      subtitle: slide.subtitle
    },
    activeLayers: newActiveLayers,
    // Sending a slide automatically clears the 'clear' blackout if it was active
    controls: {
      ...state.controls,
      clear: false
    },
    updatedAt: Date.now()
  }
}

export interface ComputedLayerVisibility {
  showBackground: boolean
  showContent: boolean
  showOverlay: boolean
  showMessage: boolean
  isBlackout: boolean
}

/**
 * Computes layer visibility based on role and global controls.
 */
export function computeLayerVisibility(
  role: string,
  controls: GlobalControls
): ComputedLayerVisibility {
  if (controls.black) {
    return {
      showBackground: false,
      showContent: false,
      showOverlay: false,
      showMessage: false,
      isBlackout: true
    }
  }

  const isClear = controls.clear
  const isLogo = controls.logo

  // Main screen: displays background + content (if not clear) + logo (if active) + messages
  if (role === 'main') {
    return {
      showBackground: true,
      showContent: !isClear && !isLogo,
      showOverlay: isLogo,
      showMessage: true,
      isBlackout: false
    }
  }

  // Stage monitor: confidence display, always shows content & message, background can be minimal
  if (role === 'stage') {
    return {
      showBackground: true,
      showContent: !isClear,
      showOverlay: isLogo,
      showMessage: true,
      isBlackout: false
    }
  }

  // Lobby: general announcements and welcome
  return {
    showBackground: true,
    showContent: !isClear && !isLogo,
    showOverlay: isLogo,
    showMessage: true,
    isBlackout: false
  }
}
