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
  RoleBibleConfigsMap,
  ThemeContentType,
  OutputRole,
  PresentationMessage,
  StageLayoutConfig,
  PropItem,
  LoopStatus,
  MacroExecutionState,
  ChurchBrandingConfig
} from '../shared/types'
import {
  createInitialPresenterState,
  toggleControlInState
} from '../shared/state-utils'
import { parseYouTubeUrl } from '../shared/youtube-utils'
import { themeService, resolveEffectiveTheme } from './theme/theme-service'
import { databaseService } from './db/database-service'
import { logger } from './logger'

export class StateManager extends EventEmitter {
  private state: PresenterState

  constructor() {
    super()
    const branding = databaseService.getChurchBranding()
    const defaultTheme = {
      ...DEFAULT_THEME,
      background: branding.defaultBackground || DEFAULT_THEME.background
    }
    this.state = {
      ...createInitialPresenterState(),
      currentTheme: defaultTheme,
      churchBranding: branding,
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
    if (this.state.activeLayers.main) {
      this.state.activeLayers.main.background = branding.defaultBackground
    }
    if (this.state.activeLayers.lobby) {
      this.state.activeLayers.lobby.background = branding.defaultBackground
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

    let contentType: ThemeContentType | undefined
    const sItem = slide as SlideItem
    if (sItem.contentType) {
      contentType = sItem.contentType
    } else if (sItem.sourceType === 'song') {
      contentType = 'songs'
    } else if (sItem.sourceType === 'scripture') {
      contentType = 'bible'
    } else if (sItem.sourceType === 'presentation') {
      contentType = 'announcements'
    }

    const allThemes = themeService.getThemes()
    const typeDefaults = themeService.getTypeDefaultThemes()
    const resolvedBaseTheme = resolveEffectiveTheme({
      elementThemeId: sItem.themeId || sItem.theme?.id,
      contentType,
      typeDefaults,
      themes: allThemes
    })

    const background = slide.background || resolvedBaseTheme.background || this.state.currentTheme.background

    for (const role of targetRoles) {
      const roleTheme = resolveEffectiveTheme({
        elementThemeId: sItem.themeId || sItem.theme?.id,
        contentType,
        typeDefaults,
        themes: allThemes,
        role: role as OutputRole
      })

      const prev = newActiveLayers[role] || {
        background,
        content: null,
        overlay: { showLogo: false },
        message: null,
        theme: roleTheme
      }

      // Bible content tailored by each role's configured Bible settings
      let roleBody = slide.body
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
            warnings,
            scripturePayload: (slide as SlideItem).scripturePayload
          },
          theme: roleTheme
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
            warnings,
            scripturePayload: (slide as SlideItem).scripturePayload
          },
          theme: roleTheme
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

    const isVid = currentSlideMediaType === 'video'
    this.state = {
      ...this.state,
      currentTheme: resolvedBaseTheme,
      mediaSyncTick: isVid ? this.state.mediaSyncTick : null,
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

  public setChurchBranding(branding: ChurchBrandingConfig): PresenterState {
    this.state = {
      ...this.state,
      churchBranding: { ...branding },
      currentTheme: {
        ...this.state.currentTheme,
        background: branding.defaultBackground || this.state.currentTheme.background
      },
      updatedAt: Date.now()
    }
    if (this.state.activeLayers.main) {
      this.state.activeLayers.main.background = branding.defaultBackground
    }
    if (this.state.activeLayers.lobby) {
      this.state.activeLayers.lobby.background = branding.defaultBackground
    }
    logger.info(`Church branding updated: "${branding.churchName}", logo: ${branding.logoUrl || 'none'}`)
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

  public setActiveMessage(message: PresentationMessage | null): PresenterState {
    this.state = {
      ...this.state,
      activeMessage: message,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setActiveStageLayout(layout: StageLayoutConfig | null): PresenterState {
    this.state = {
      ...this.state,
      activeStageLayout: layout,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setActiveProps(props: PropItem[]): PresenterState {
    this.state = {
      ...this.state,
      activeProps: [...props],
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setLoopStatus(status: LoopStatus | null): PresenterState {
    this.state = {
      ...this.state,
      activeLoopStatus: status,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setDisableTransitions(disabled: boolean): PresenterState {
    this.state = {
      ...this.state,
      disableTransitions: disabled,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setMacroExecutionState(macroState: MacroExecutionState | null): PresenterState {
    this.state = {
      ...this.state,
      macroExecutionState: macroState,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setActiveSubtitle(subtitle: any | null): PresenterState {
    this.state = {
      ...this.state,
      activeSubtitle: subtitle,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }

  public setSubtitlesConfig(config: any | null): PresenterState {
    this.state = {
      ...this.state,
      subtitlesConfig: config,
      updatedAt: Date.now()
    }
    this.emit('state-updated', this.state)
    return this.state
  }
}

export const stateManager = new StateManager()
