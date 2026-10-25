import { EventEmitter } from 'events'
import {
  GlobalControls,
  PresenterState,
  SlideItem,
  TestSlide,
  ThemeConfig,
  DEFAULT_THEME,
  OutputLayersState,
  DEFAULT_ROLE_BIBLE_CONFIGS,
  IndependentAudioState,
  MediaSyncTick,
  RoleBibleConfigsMap
} from '../shared/types'
import {
  createInitialPresenterState,
  toggleControlInState
} from '../shared/state-utils'
import { parseYouTubeUrl } from '../shared/youtube-utils'
import { logger } from './logger'

export class StateManager extends EventEmitter {
  private state: PresenterState

  constructor() {
    super()
    this.state = {
      ...createInitialPresenterState(),
      currentTheme: DEFAULT_THEME,
      roleBibleConfigs: { ...DEFAULT_ROLE_BIBLE_CONFIGS },
      mediaSyncTick: null,
      independentAudio: {
        isPlaying: false,
        mediaId: null,
        filePath: null,
        title: null,
        currentTime: 0,
        duration: 0,
        volume: 0.8,
        isFadingOut: false
      }
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

      // Bible content tailored by each role's configured Bible settings
      let roleBody = slide.body
      const sItem = slide as SlideItem
      if (sItem.scripturePayload && this.state.roleBibleConfigs?.[role]) {
        const rConfig = this.state.roleBibleConfigs[role]
        if (rConfig.mode === 'single') {
          roleBody = sItem.scripturePayload.primaryText
        } else if (rConfig.mode === 'stacked') {
          roleBody = sItem.scripturePayload.secondaryText
            ? `${sItem.scripturePayload.primaryText}\n\n${sItem.scripturePayload.secondaryText}`
            : sItem.scripturePayload.primaryText
        } else if (rConfig.mode === 'sideBySide') {
          roleBody = sItem.scripturePayload.secondaryText
            ? `${sItem.scripturePayload.primaryText} ||| ${sItem.scripturePayload.secondaryText}`
            : sItem.scripturePayload.primaryText
        }
      }

      const mediaUrl = (slide as any).mediaUrl
      const mediaType =
        (slide as any).mediaType ||
        ((slide as any).sourceType === 'video'
          ? 'video'
          : (slide as any).sourceType === 'pdf'
            ? 'pdf'
            : (slide as any).sourceType === 'powerpoint'
              ? 'powerpoint'
              : (slide as any).sourceType === 'image'
                ? 'image'
                : undefined)
      const pdfPage = (slide as any).pdfPage
      const pdfPageCount = (slide as any).pdfPageCount
      const fitMode = (slide as any).fitMode || 'contain'
      const speakerNotes = (slide as any).speakerNotes
      const warnings = (slide as any).warnings
      const youtubeId =
        (slide as any).youtubeId ||
        (mediaType === 'youtube' && mediaUrl ? parseYouTubeUrl(mediaUrl).videoId || undefined : undefined)
      const youtubeDuration = (slide as any).youtubeDuration

      // Special handling for stage (confidence monitor): pass current + next
      if (role === 'stage') {
        newActiveLayers[role] = {
          ...prev,
          background: { type: 'color', value: '#000000' },
          content: {
            id: slide.id,
            title: slide.title,
            body: roleBody,
            subtitle: slide.subtitle,
            nextSlideTitle: nextSlide?.title || nextSlide?.subtitle,
            nextSlideBody: nextSlide?.body,
            mediaUrl,
            mediaType,
            youtubeId,
            youtubeDuration,
            pdfPage,
            pdfPageCount,
            fitMode,
            speakerNotes,
            warnings
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
            body: roleBody,
            subtitle: slide.subtitle,
            mediaUrl,
            mediaType,
            youtubeId,
            youtubeDuration,
            pdfPage,
            pdfPageCount,
            fitMode,
            speakerNotes,
            warnings
          },
          theme: this.state.currentTheme
        }
      }
    }

    const currentSlideMediaType =
      (slide as any).mediaType ||
      ((slide as any).sourceType === 'video'
        ? 'video'
        : (slide as any).sourceType === 'pdf'
          ? 'pdf'
          : (slide as any).sourceType === 'powerpoint'
            ? 'powerpoint'
            : (slide as any).sourceType === 'image'
              ? 'image'
              : undefined)

    const currentSlideMediaUrl = (slide as any).mediaUrl
    const currentSlideYoutubeId =
      (slide as any).youtubeId ||
      (currentSlideMediaType === 'youtube' && currentSlideMediaUrl
        ? parseYouTubeUrl(currentSlideMediaUrl).videoId || undefined
        : undefined)

    this.state = {
      ...this.state,
      currentSlide: {
        id: slide.id,
        title: slide.title,
        body: slide.body,
        subtitle: slide.subtitle,
        nextSlideTitle: nextSlide?.title || nextSlide?.subtitle,
        nextSlideBody: nextSlide?.body,
        mediaUrl: currentSlideMediaUrl,
        mediaType: currentSlideMediaType,
        youtubeId: currentSlideYoutubeId,
        youtubeDuration: (slide as any).youtubeDuration,
        pdfPage: (slide as any).pdfPage,
        pdfPageCount: (slide as any).pdfPageCount,
        fitMode: (slide as any).fitMode,
        speakerNotes: (slide as any).speakerNotes,
        warnings: (slide as any).warnings
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

  public updateRoleBibleConfigs(configs: RoleBibleConfigsMap): PresenterState {
    this.state = {
      ...this.state,
      roleBibleConfigs: { ...configs },
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public updateIndependentAudio(audio: IndependentAudioState): PresenterState {
    this.state = {
      ...this.state,
      independentAudio: { ...audio },
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public updateMediaSyncTick(tick: MediaSyncTick | null): PresenterState {
    this.state = {
      ...this.state,
      mediaSyncTick: tick,
      updatedAt: Date.now()
    }
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
