import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import AdmZip from 'adm-zip'
import { app, dialog } from 'electron'
import {
  ThemeConfig,
  ThemeContentType,
  TypeDefaultThemesMap,
  CustomFontItem,
  ThemeExportOptions,
  ThemeImportResult,
  DEFAULT_THEME,
  OutputRole,
  BackgroundImageItem
} from '../../shared/types'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export const TYPE_DEFAULTS_CONFIG_KEY = 'type_default_themes'

/**
 * Built-in Factory Themes covering all content types.
 * Pure code-generated backgrounds (no copyrighted external images).
 * Modern Pro Dark palette (Charcoal, Deep Slate, Neon Green, Vibrant Orange, Light Blue/Cyan).
 */
export const FACTORY_THEMES: ThemeConfig[] = [
  // 1. General Default
  DEFAULT_THEME,

  // 2. Songs (Canciones)
  {
    id: 'theme-factory-songs-dark',
    name: 'Canciones - Contraste Puro',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'songs',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 5.2,
    autoFit: true,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#ffffff',
    textTransform: 'none',
    lineHeight: 1.25,
    letterSpacing: 0.5,
    outlineColor: '#000000',
    outlineWidthPx: 3,
    outlineBlurPx: 0,
    shadowBlurPx: 16,
    shadowColor: 'rgba(0,0,0,0.9)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 4,
    safeMarginsPercent: { top: 7, bottom: 7, left: 8, right: 8 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #121212 0%, #1f1f1f 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.3,
    songShowTitleOnFirstSlide: true,
    songShowCopyrightOnLastSlide: true,
    roleOverrides: {
      stage: {
        fontSizeVmin: 5.8,
        color: '#f97316',
        alignment: 'left',
        background: { type: 'color', value: '#000000' }
      }
    }
  },
  {
    id: 'theme-factory-songs-glow',
    name: 'Canciones - Resplandor Verde',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'songs',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 5.0,
    autoFit: true,
    fontWeight: '600',
    fontStyle: 'normal',
    color: '#f0fdf4',
    textTransform: 'none',
    lineHeight: 1.3,
    letterSpacing: 0.8,
    outlineColor: '#022c22',
    outlineWidthPx: 2,
    outlineBlurPx: 4,
    shadowBlurPx: 14,
    shadowColor: 'rgba(34, 197, 94, 0.4)',
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 4,
    safeMarginsPercent: { top: 6, bottom: 6, left: 9, right: 9 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #091319 0%, #0c201a 50%, #142a22 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.2,
    songShowTitleOnFirstSlide: true,
    songShowCopyrightOnLastSlide: true
  },
  {
    id: 'theme-factory-songs-warm',
    name: 'Canciones - Calidez Naranja',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'songs',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 4.8,
    autoFit: true,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#fff7ed',
    textTransform: 'none',
    lineHeight: 1.3,
    letterSpacing: 0,
    outlineColor: '#431407',
    outlineWidthPx: 2,
    shadowBlurPx: 14,
    shadowColor: 'rgba(249, 115, 22, 0.35)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 4,
    safeMarginsPercent: { top: 6, bottom: 6, left: 8, right: 8 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #18110b 0%, #291b10 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.25,
    songShowTitleOnFirstSlide: true,
    songShowCopyrightOnLastSlide: true
  },

  // 3. Bible (Biblia)
  {
    id: 'theme-factory-bible-classic',
    name: 'Biblia - Clásico Solemne',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'bible',
    fontFamily: 'Georgia, Cambria, serif',
    fontSizeVmin: 4.5,
    autoFit: true,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#ffffff',
    textTransform: 'none',
    lineHeight: 1.45,
    letterSpacing: 0.3,
    outlineColor: '#000000',
    outlineWidthPx: 2,
    shadowBlurPx: 10,
    shadowColor: 'rgba(0,0,0,0.85)',
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 5,
    safeMarginsPercent: { top: 7, bottom: 7, left: 9, right: 9 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #141414 0%, #1e1e1e 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.3,
    bibleRefPosition: 'bottom',
    bibleRefFontSizeVmin: 3.5,
    bibleShowVersionTag: true,
    bibleShowVerseNumbers: true,
    roleOverrides: {
      stage: {
        fontSizeVmin: 5.2,
        color: '#38bdf8',
        alignment: 'left',
        background: { type: 'color', value: '#000000' }
      }
    }
  },
  {
    id: 'theme-factory-bible-amber',
    name: 'Biblia - Luz Ámbar',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'bible',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 4.6,
    autoFit: true,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#fef3c7',
    textTransform: 'none',
    lineHeight: 1.4,
    letterSpacing: 0.4,
    outlineColor: '#1c1917',
    outlineWidthPx: 2,
    shadowBlurPx: 12,
    shadowColor: 'rgba(0,0,0,0.8)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 5,
    safeMarginsPercent: { top: 8, bottom: 8, left: 9, right: 9 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.25,
    bibleRefPosition: 'top',
    bibleRefFontSizeVmin: 3.6,
    bibleShowVersionTag: true,
    bibleShowVerseNumbers: true
  },
  {
    id: 'theme-factory-bible-teal',
    name: 'Biblia - Verde Esperanza',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'bible',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 4.6,
    autoFit: true,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#ecfdf5',
    textTransform: 'none',
    lineHeight: 1.4,
    letterSpacing: 0.2,
    outlineColor: '#022c22',
    outlineWidthPx: 2,
    shadowBlurPx: 12,
    shadowColor: 'rgba(0,0,0,0.85)',
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 5,
    safeMarginsPercent: { top: 7, bottom: 7, left: 8, right: 8 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #06241c 0%, #0c382b 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.2,
    bibleRefPosition: 'bottom',
    bibleRefFontSizeVmin: 3.4,
    bibleShowVersionTag: true,
    bibleShowVerseNumbers: true
  },

  // 4. Announcements (Anuncios)
  {
    id: 'theme-factory-announce-warm',
    name: 'Anuncios - Énfasis Naranja',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'announcements',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 5.6,
    autoFit: true,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#ffffff',
    textTransform: 'none',
    lineHeight: 1.3,
    letterSpacing: 0.5,
    outlineColor: '#000000',
    outlineWidthPx: 2,
    shadowBlurPx: 14,
    shadowColor: 'rgba(249, 115, 22, 0.4)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 4,
    safeMarginsPercent: { top: 8, bottom: 8, left: 10, right: 10 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #1c1917 0%, #201a14 50%, #2e2014 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.25
  },
  {
    id: 'theme-factory-announce-clean',
    name: 'Anuncios - Minimalista Moderno',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'announcements',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 5.2,
    autoFit: true,
    fontWeight: '600',
    fontStyle: 'normal',
    color: '#ffffff',
    textTransform: 'none',
    lineHeight: 1.35,
    letterSpacing: 0,
    outlineColor: '#000000',
    outlineWidthPx: 2,
    shadowBlurPx: 12,
    shadowColor: 'rgba(0,0,0,0.85)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'left',
    verticalAlign: 'middle',
    maxLinesPerSlide: 5,
    safeMarginsPercent: { top: 8, bottom: 8, left: 10, right: 10 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #161616 0%, #222222 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.2
  },

  // 5. Messages (Avisos a la audiencia)
  {
    id: 'theme-factory-msg-amber',
    name: 'Mensaje - Aviso Urgente Ámbar',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'messages',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 5.2,
    autoFit: true,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#fef08a',
    textTransform: 'none',
    lineHeight: 1.25,
    letterSpacing: 0.5,
    outlineColor: '#451a03',
    outlineWidthPx: 3,
    shadowBlurPx: 16,
    shadowColor: 'rgba(234, 179, 8, 0.45)',
    shadowOffsetX: 0,
    shadowOffsetY: 3,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 3,
    safeMarginsPercent: { top: 6, bottom: 6, left: 8, right: 8 },
    background: {
      type: 'color',
      value: 'rgba(24, 20, 10, 0.92)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.2
  },
  {
    id: 'theme-factory-msg-clean',
    name: 'Mensaje - Notificación Discreta',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'messages',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeVmin: 4.6,
    autoFit: true,
    fontWeight: '600',
    fontStyle: 'normal',
    color: '#ffffff',
    textTransform: 'none',
    lineHeight: 1.3,
    letterSpacing: 0,
    outlineColor: '#000000',
    outlineWidthPx: 2,
    shadowBlurPx: 10,
    shadowColor: 'rgba(0,0,0,0.85)',
    shadowOffsetX: 0,
    shadowOffsetY: 2,
    alignment: 'center',
    verticalAlign: 'bottom',
    maxLinesPerSlide: 2,
    safeMarginsPercent: { top: 10, bottom: 10, left: 12, right: 12 },
    background: {
      type: 'color',
      value: 'rgba(18, 18, 18, 0.88)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.1
  },

  // 6. Timer (Temporizador)
  {
    id: 'theme-factory-timer-neon',
    name: 'Temporizador - Digital Neón',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'timer',
    fontFamily: 'Consolas, monospace, sans-serif',
    fontSizeVmin: 8.5,
    autoFit: true,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#22c55e',
    textTransform: 'none',
    lineHeight: 1.1,
    letterSpacing: 2,
    outlineColor: '#052e16',
    outlineWidthPx: 3,
    shadowBlurPx: 20,
    shadowColor: 'rgba(34, 197, 94, 0.5)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 2,
    safeMarginsPercent: { top: 6, bottom: 6, left: 8, right: 8 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #091310 0%, #11221b 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.2,
    roleOverrides: {
      stage: {
        fontSizeVmin: 9.5,
        color: '#fbbf24',
        background: { type: 'color', value: '#000000' }
      }
    }
  },
  {
    id: 'theme-factory-timer-amber',
    name: 'Temporizador - Alerta Ámbar',
    isDefault: false,
    isBuiltIn: true,
    targetContentType: 'timer',
    fontFamily: 'Consolas, monospace, sans-serif',
    fontSizeVmin: 8.5,
    autoFit: true,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#f97316',
    textTransform: 'none',
    lineHeight: 1.1,
    letterSpacing: 2,
    outlineColor: '#431407',
    outlineWidthPx: 3,
    shadowBlurPx: 18,
    shadowColor: 'rgba(249, 115, 22, 0.5)',
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    alignment: 'center',
    verticalAlign: 'middle',
    maxLinesPerSlide: 2,
    safeMarginsPercent: { top: 6, bottom: 6, left: 8, right: 8 },
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #18110b 0%, #261609 100%)'
    },
    overlayColor: '#000000',
    overlayOpacity: 0.2
  }
]

export const DEFAULT_TYPE_DEFAULTS: TypeDefaultThemesMap = {
  songs: 'theme-factory-songs-dark',
  bible: 'theme-factory-bible-classic',
  announcements: 'theme-factory-announce-warm',
  messages: 'theme-factory-msg-amber',
  timer: 'theme-factory-timer-neon'
}

/**
 * Resolves the effective ThemeConfig following the strict 4-level priority order:
 * 1. Element-specific theme (assigned to a song, presentation, or scripture passage).
 * 2. Content-type default theme (songs, bible, announcements, messages, timer).
 * 3. General default theme.
 * 4. Screen/Output role override (e.g. stage display high contrast yellow/black).
 */
export function resolveEffectiveTheme(params: {
  elementThemeId?: string | null
  contentType?: ThemeContentType | null
  typeDefaults?: TypeDefaultThemesMap | null
  themes: ThemeConfig[]
  role?: OutputRole
}): ThemeConfig {
  const { elementThemeId, contentType, typeDefaults, themes, role } = params

  let baseTheme: ThemeConfig | undefined

  // 1. Element-specific theme
  if (elementThemeId) {
    baseTheme = themes.find((t) => t.id === elementThemeId)
  }

  // 2. Default theme for content type
  if (!baseTheme && contentType && typeDefaults?.[contentType]) {
    const typeThemeId = typeDefaults[contentType]
    baseTheme = themes.find((t) => t.id === typeThemeId)
  }

  // 3. General default theme
  if (!baseTheme) {
    baseTheme = themes.find((t) => t.isDefault) || themes[0] || DEFAULT_THEME
  }

  // 4. Role Override (Stage, Audience, Lobby)
  if (role && baseTheme.roleOverrides?.[role]) {
    const override = baseTheme.roleOverrides[role]!
    return {
      ...baseTheme,
      ...override,
      safeMarginsPercent: {
        ...baseTheme.safeMarginsPercent,
        ...(override.safeMarginsPercent || {})
      }
    }
  }

  return baseTheme
}

export class ThemeService {
  private fontsDir: string = ''
  private backgroundsDir: string = ''

  public initialize(userDataPath?: string): void {
    const basePath = userDataPath || app.getPath('userData')
    this.fontsDir = path.join(basePath, 'fonts')
    this.backgroundsDir = path.join(basePath, 'backgrounds')

    if (!fs.existsSync(this.fontsDir)) {
      fs.mkdirSync(this.fontsDir, { recursive: true })
    }
    if (!fs.existsSync(this.backgroundsDir)) {
      fs.mkdirSync(this.backgroundsDir, { recursive: true })
    }

    this.seedFactoryThemes()
    this.ensureTypeDefaults()
  }

  public seedFactoryThemes(): void {
    const existing = this.getThemes()
    const existingMap = new Map(existing.map((t) => [t.id, t]))

    for (const factory of FACTORY_THEMES) {
      if (!existingMap.has(factory.id)) {
        this.saveTheme(factory, true)
      }
    }
  }

  public getThemes(): ThemeConfig[] {
    const rows = databaseService.query('SELECT * FROM themes ORDER BY is_default DESC, name ASC;')
    return rows.map((r) => {
      try {
        const parsed = JSON.parse(String(r.config_json))
        return {
          ...DEFAULT_THEME,
          ...parsed,
          id: String(r.id),
          name: String(r.name),
          isDefault: Boolean(r.is_default)
        }
      } catch {
        return {
          ...DEFAULT_THEME,
          id: String(r.id),
          name: String(r.name),
          isDefault: Boolean(r.is_default)
        }
      }
    })
  }

  public getThemeById(id: string): ThemeConfig | null {
    return this.getThemes().find((t) => t.id === id) || null
  }

  public saveTheme(theme: ThemeConfig, skipDefaultReset = false): ThemeConfig {
    if (theme.isDefault && !skipDefaultReset) {
      databaseService.run('UPDATE themes SET is_default = 0;')
    }

    databaseService.run(
      `INSERT INTO themes (id, name, is_default, config_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         is_default = excluded.is_default,
         config_json = excluded.config_json,
         updated_at = datetime('now');`,
      [theme.id, theme.name, theme.isDefault ? 1 : 0, JSON.stringify(theme)]
    )

    logger.info(`Saved theme '${theme.name}' (${theme.id})`)
    return theme
  }

  public setDefaultTheme(id: string): boolean {
    databaseService.run('UPDATE themes SET is_default = 0;')
    databaseService.run('UPDATE themes SET is_default = 1 WHERE id = ?;', [id])
    logger.info(`Set theme ${id} as general default`)
    return true
  }

  public duplicateTheme(id: string, newName?: string): ThemeConfig {
    const original = this.getThemeById(id)
    if (!original) {
      throw new Error(`Theme ${id} not found to duplicate.`)
    }

    const newId = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const duplicated: ThemeConfig = {
      ...original,
      id: newId,
      name: newName || `${original.name} (Copia)`,
      isDefault: false,
      isBuiltIn: false
    }

    return this.saveTheme(duplicated)
  }

  public deleteTheme(id: string, reassignToThemeId?: string): { success: boolean; reassignedCount: number } {
    const target = this.getThemeById(id)
    if (!target) {
      throw new Error(`Theme ${id} not found.`)
    }

    if (target.isBuiltIn) {
      throw new Error(`El tema '${target.name}' es de fábrica y no se puede eliminar.`)
    }

    // Determine replacement theme
    const typeDefaults = this.getTypeDefaultThemes()
    const contentType = target.targetContentType && target.targetContentType !== 'all' ? target.targetContentType : 'songs'
    const fallbackThemeId = reassignToThemeId || typeDefaults[contentType] || DEFAULT_THEME.id

    // Check if target is a type default and reassign type default
    let typeDefaultsModified = false
    const updatedTypeDefaults = { ...typeDefaults }
    for (const [key, val] of Object.entries(updatedTypeDefaults) as [ThemeContentType, string][]) {
      if (val === id) {
        updatedTypeDefaults[key] = fallbackThemeId
        typeDefaultsModified = true
      }
    }
    if (typeDefaultsModified) {
      this.saveTypeDefaults(updatedTypeDefaults)
    }

    // If target was general default, assign fallback as general default
    if (target.isDefault) {
      this.setDefaultTheme(fallbackThemeId)
    }

    // Reassign items in songs and generic_presentations
    let reassignedCount = 0
    try {
      const songRows = databaseService.query('SELECT COUNT(*) as cnt FROM songs WHERE theme_id = ?;', [id])
      const songCount = Number(songRows[0]?.cnt || 0)
      if (songCount > 0) {
        databaseService.run('UPDATE songs SET theme_id = ? WHERE theme_id = ?;', [fallbackThemeId, id])
        reassignedCount += songCount
      }
    } catch {
      /* ignore */
    }

    try {
      const presRows = databaseService.query('SELECT COUNT(*) as cnt FROM generic_presentations WHERE theme_id = ?;', [id])
      const presCount = Number(presRows[0]?.cnt || 0)
      if (presCount > 0) {
        databaseService.run('UPDATE generic_presentations SET theme_id = ? WHERE theme_id = ?;', [fallbackThemeId, id])
        reassignedCount += presCount
      }
    } catch {
      /* ignore */
    }

    // Delete from database
    databaseService.run('DELETE FROM themes WHERE id = ?;', [id])
    logger.info(`Deleted theme ${id}, reassigned ${reassignedCount} items to ${fallbackThemeId}`)
    return { success: true, reassignedCount }
  }

  // --- TYPE DEFAULTS ---

  public getTypeDefaultThemes(): TypeDefaultThemesMap {
    const raw = databaseService.getConfig(TYPE_DEFAULTS_CONFIG_KEY)
    if (raw) {
      try {
        return {
          ...DEFAULT_TYPE_DEFAULTS,
          ...JSON.parse(raw)
        }
      } catch {
        /* ignore invalid json */
      }
    }
    return { ...DEFAULT_TYPE_DEFAULTS }
  }

  public setTypeDefaultTheme(contentType: ThemeContentType, themeId: string): boolean {
    const current = this.getTypeDefaultThemes()
    current[contentType] = themeId
    this.saveTypeDefaults(current)
    logger.info(`Set content type default theme for '${contentType}' -> ${themeId}`)
    return true
  }

  public saveTypeDefaults(map: TypeDefaultThemesMap): void {
    databaseService.setConfig(TYPE_DEFAULTS_CONFIG_KEY, JSON.stringify(map))
  }

  private ensureTypeDefaults(): void {
    const existing = databaseService.getConfig(TYPE_DEFAULTS_CONFIG_KEY)
    if (!existing) {
      this.saveTypeDefaults(DEFAULT_TYPE_DEFAULTS)
    }
  }

  // --- BATCH APPLICATION TO SCOPE ---

  public applyThemeToScope(
    themeId: string,
    scope: 'playlist' | 'library' | 'all_songs',
    playlistId?: string
  ): { affectedItems: number } {
    let affectedItems = 0

    if (scope === 'all_songs' || scope === 'library') {
      const rows = databaseService.query('SELECT id FROM songs;')
      databaseService.run('UPDATE songs SET theme_id = ?;', [themeId])
      affectedItems += rows.length
    }

    if (scope === 'playlist') {
      const services = databaseService.query(
        playlistId ? 'SELECT id, items_json FROM services WHERE id = ?;' : 'SELECT id, items_json FROM services ORDER BY updated_at DESC LIMIT 1;',
        playlistId ? [playlistId] : []
      )
      if (services.length > 0) {
        const s = services[0]
        let items: any[] = []
        try {
          items = JSON.parse(String(s.items_json))
        } catch {
          items = []
        }
        for (const item of items) {
          if (['song', 'presentation', 'scripture'].includes(item.type)) {
            item.themeId = themeId
            affectedItems++
          }
        }
        databaseService.run('UPDATE services SET items_json = ?, updated_at = datetime(\'now\') WHERE id = ?;', [
          JSON.stringify(items),
          s.id
        ])
      }
    }

    logger.info(`Applied theme ${themeId} to scope '${scope}', affected: ${affectedItems}`)
    return { affectedItems }
  }

  // --- CUSTOM FONTS ---

  public getCustomFonts(): CustomFontItem[] {
    try {
      const rows = databaseService.query('SELECT * FROM custom_fonts ORDER BY name ASC;')
      return rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        fileName: String(r.file_name),
        format: r.format as any,
        filePath: String(r.file_path),
        url: `file://${String(r.file_path).replace(/\\/g, '/')}`,
        createdAt: String(r.created_at)
      }))
    } catch {
      return []
    }
  }

  public importCustomFont(sourcePath?: string): CustomFontItem | null {
    let chosenPath = sourcePath
    if (!chosenPath) {
      const result = dialog.showOpenDialogSync({
        title: 'Seleccionar fuente tipográfica',
        filters: [{ name: 'Fuentes Tipográficas', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
        properties: ['openFile']
      })
      if (!result || result.length === 0) return null
      chosenPath = result[0]
    }

    if (!fs.existsSync(chosenPath)) {
      throw new Error(`El archivo de fuente no existe: ${chosenPath}`)
    }

    const ext = path.extname(chosenPath).toLowerCase()
    let format: 'truetype' | 'opentype' | 'woff' | 'woff2' = 'truetype'
    if (ext === '.otf') format = 'opentype'
    else if (ext === '.woff') format = 'woff'
    else if (ext === '.woff2') format = 'woff2'

    const baseName = path.basename(chosenPath, ext)
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'CustomFont'
    const id = `font_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const targetFileName = `${id}${ext}`
    const targetPath = path.join(this.fontsDir, targetFileName)

    fs.copyFileSync(chosenPath, targetPath)

    databaseService.run(
      `INSERT INTO custom_fonts (id, name, file_name, format, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'));`,
      [id, sanitizedName, targetFileName, format, targetPath]
    )

    logger.info(`Imported custom font '${sanitizedName}' to ${targetPath}`)
    return {
      id,
      name: sanitizedName,
      fileName: targetFileName,
      format,
      filePath: targetPath,
      url: `file://${targetPath.replace(/\\/g, '/')}`,
      createdAt: new Date().toISOString()
    }
  }

  public deleteCustomFont(id: string): boolean {
    const rows = databaseService.query('SELECT file_path FROM custom_fonts WHERE id = ?;', [id])
    if (rows.length > 0 && rows[0].file_path && fs.existsSync(String(rows[0].file_path))) {
      try {
        fs.unlinkSync(String(rows[0].file_path))
      } catch (err) {
        logger.error(`Error deleting font file:`, err)
      }
    }
    databaseService.run('DELETE FROM custom_fonts WHERE id = ?;', [id])
    logger.info(`Deleted custom font ${id}`)
    return true
  }

  // --- THEME PACKAGE EXPORT & IMPORT (.cptheme) ---

  public exportThemePackage(options: ThemeExportOptions): { success: boolean; filePath?: string; error?: string } {
    const { themeId, includeFonts, targetPath } = options
    const theme = this.getThemeById(themeId)
    if (!theme) {
      return { success: false, error: `Tema con ID ${themeId} no encontrado.` }
    }

    let savePath = targetPath
    if (!savePath) {
      const sanitizedName = theme.name.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'tema'
      savePath = dialog.showSaveDialogSync({
        title: 'Exportar Paquete de Tema',
        defaultPath: `${sanitizedName}.cptheme`,
        filters: [{ name: 'ChurchPresenter Theme (*.cptheme)', extensions: ['cptheme'] }]
      })
      if (!savePath) {
        return { success: false, error: 'Exportación cancelada por el usuario.' }
      }
    }

    try {
      const zip = new AdmZip()
      const manifest: any = {
        format: 'churchpresenter-theme',
        version: 1,
        exportedAt: new Date().toISOString(),
        theme: { ...theme }
      }

      // If background has image or video, bundle asset
      if (theme.background && ['image', 'video'].includes(theme.background.type) && theme.background.value) {
        let localPath = theme.background.value
        if (localPath.startsWith('file:///')) {
          localPath = decodeURIComponent(localPath.replace('file:///', ''))
        }
        if (fs.existsSync(localPath)) {
          const assetName = path.basename(localPath)
          zip.addLocalFile(localPath, 'assets')
          manifest.theme.background.value = `assets/${assetName}`
        }
      }

      // If watermark has local asset, bundle
      if (theme.watermarkUrl) {
        let wmPath = theme.watermarkUrl
        if (wmPath.startsWith('file:///')) {
          wmPath = decodeURIComponent(wmPath.replace('file:///', ''))
        }
        if (fs.existsSync(wmPath)) {
          const wmName = path.basename(wmPath)
          zip.addLocalFile(wmPath, 'assets')
          manifest.theme.watermarkUrl = `assets/${wmName}`
        }
      }

      // If user allowed including custom fonts
      if (includeFonts) {
        const customFonts = this.getCustomFonts()
        const matchingFont = customFonts.find(
          (f) => f.name.toLowerCase() === (theme.fontFamily || '').toLowerCase()
        )
        if (matchingFont && fs.existsSync(matchingFont.filePath)) {
          zip.addLocalFile(matchingFont.filePath, 'fonts')
          manifest.font = {
            name: matchingFont.name,
            fileName: matchingFont.fileName,
            format: matchingFont.format
          }
        }
      }

      zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'))
      zip.writeZip(savePath)

      logger.info(`Exported theme package '${theme.name}' to ${savePath}`)
      return { success: true, filePath: savePath }
    } catch (err: any) {
      logger.error(`Error exporting theme package:`, err)
      return { success: false, error: err.message || 'Error al exportar tema.' }
    }
  }

  public importThemePackage(sourcePath?: string): ThemeImportResult {
    let chosenPath = sourcePath
    if (!chosenPath) {
      const result = dialog.showOpenDialogSync({
        title: 'Importar Paquete de Tema (.cptheme)',
        filters: [{ name: 'ChurchPresenter Theme (*.cptheme)', extensions: ['cptheme', 'zip'] }],
        properties: ['openFile']
      })
      if (!result || result.length === 0) {
        return { success: false, error: 'Importación cancelada.' }
      }
      chosenPath = result[0]
    }

    if (!fs.existsSync(chosenPath)) {
      return { success: false, error: `El archivo ${chosenPath} no existe.` }
    }

    const warnings: string[] = []

    try {
      const zip = new AdmZip(chosenPath)
      const zipEntries = zip.getEntries()

      // Path traversal check
      for (const entry of zipEntries) {
        if (entry.entryName.includes('..') || path.isAbsolute(entry.entryName)) {
          return { success: false, error: 'Archivo sospechoso: contiene rutas relativas no seguras.' }
        }
      }

      const manifestEntry = zip.getEntry('manifest.json')
      if (!manifestEntry) {
        return { success: false, error: 'El paquete no contiene manifest.json válido.' }
      }

      const manifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
      if (manifest.format !== 'churchpresenter-theme' || !manifest.theme || !manifest.theme.name) {
        return { success: false, error: 'Estructura de paquete no compatible.' }
      }

      const rawTheme: ThemeConfig = manifest.theme

      // Extract assets if any
      const assetMap = new Map<string, string>()
      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('assets/') && !entry.isDirectory) {
          const buffer = entry.getData()
          const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 12)
          const ext = path.extname(entry.entryName)
          const targetName = `bg_theme_${hash}${ext}`
          const targetPath = path.join(this.backgroundsDir, targetName)

          if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, buffer)
          }
          const fileUrl = `file://${targetPath.replace(/\\/g, '/')}`
          assetMap.set(entry.entryName, fileUrl)
        }
      }

      // Update background URL
      if (rawTheme.background && rawTheme.background.value && assetMap.has(rawTheme.background.value)) {
        rawTheme.background.value = assetMap.get(rawTheme.background.value)!
      }
      if (rawTheme.watermarkUrl && assetMap.has(rawTheme.watermarkUrl)) {
        rawTheme.watermarkUrl = assetMap.get(rawTheme.watermarkUrl)!
      }

      // Extract custom font if included
      if (manifest.font && manifest.font.fileName) {
        const fontEntry = zip.getEntry(`fonts/${manifest.font.fileName}`)
        if (fontEntry) {
          const fontBuffer = fontEntry.getData()
          const fontExt = path.extname(manifest.font.fileName)
          const fontId = `font_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
          const targetFontName = `${fontId}${fontExt}`
          const targetFontPath = path.join(this.fontsDir, targetFontName)

          if (!fs.existsSync(targetFontPath)) {
            fs.writeFileSync(targetFontPath, fontBuffer)
          }

          try {
            databaseService.run(
              `INSERT INTO custom_fonts (id, name, file_name, format, file_path, created_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'));`,
              [fontId, manifest.font.name, targetFontName, manifest.font.format, targetFontPath]
            )
          } catch {
            /* font already exists in db */
          }
        }
      }

      // Check if theme font is installed or standard
      const systemFonts = ['Inter', 'Arial', 'Georgia', 'Helvetica', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Consolas', 'Courier New', 'system-ui', 'sans-serif', 'serif', 'monospace']
      const customFonts = this.getCustomFonts()
      const requestedFont = (rawTheme.fontFamily || '').split(',')[0].trim().replace(/['"]/g, '')
      const fontFound = systemFonts.some((sf) => sf.toLowerCase() === requestedFont.toLowerCase()) ||
        customFonts.some((cf) => cf.name.toLowerCase() === requestedFont.toLowerCase())

      if (!fontFound && requestedFont) {
        warnings.push(`La fuente '${requestedFont}' no está instalada en este sistema. Se usará la fuente de respaldo del sistema.`)
      }

      // Avoid ID clash
      const existingThemes = this.getThemes()
      let finalId = rawTheme.id
      let finalName = rawTheme.name
      if (existingThemes.some((t) => t.id === finalId)) {
        finalId = `theme_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        finalName = `${rawTheme.name} (Importado)`
      }

      const importedTheme: ThemeConfig = {
        ...DEFAULT_THEME,
        ...rawTheme,
        id: finalId,
        name: finalName,
        isDefault: false,
        isBuiltIn: false
      }

      const saved = this.saveTheme(importedTheme)
      logger.info(`Successfully imported theme '${saved.name}' (${saved.id})`)
      return { success: true, theme: saved, warnings }
    } catch (err: any) {
      logger.error(`Error importing theme package:`, err)
      return { success: false, error: err.message || 'Error al importar paquete de tema.' }
    }
  }

  // --- BACKGROUND UPLOAD WITH SHA-256 DEDUPLICATION ---

  public uploadBackground(sourcePath?: string): BackgroundImageItem | null {
    let chosenPath = sourcePath
    if (!chosenPath) {
      const result = dialog.showOpenDialogSync({
        title: 'Seleccionar imagen o video de fondo',
        filters: [
          { name: 'Fondos Multimedia', extensions: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm', 'mov'] }
        ],
        properties: ['openFile']
      })
      if (!result || result.length === 0) return null
      chosenPath = result[0]
    }

    if (!fs.existsSync(chosenPath)) return null

    const buffer = fs.readFileSync(chosenPath)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    const ext = path.extname(chosenPath).toLowerCase()
    const baseName = path.basename(chosenPath, ext)

    // Check if duplicate file exists by hash
    const rows = databaseService.query('SELECT * FROM background_images;')
    for (const row of rows) {
      const existingPath = String(row.file_path)
      if (fs.existsSync(existingPath)) {
        const existingHash = crypto.createHash('sha256').update(fs.readFileSync(existingPath)).digest('hex')
        if (existingHash === hash) {
          logger.info(`Background '${baseName}' already exists (hash matched). Reusing ID: ${row.id}`)
          return {
            id: String(row.id),
            name: String(row.name),
            originalFilename: String(row.original_filename),
            filePath: existingPath,
            url: `file://${existingPath.replace(/\\/g, '/')}`,
            createdAt: String(row.created_at)
          }
        }
      }
    }

    const id = `bg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const targetFileName = `${id}${ext}`
    const targetPath = path.join(this.backgroundsDir, targetFileName)

    fs.writeFileSync(targetPath, buffer)

    databaseService.run(
      `INSERT INTO background_images (id, name, original_filename, file_path)
       VALUES (?, ?, ?, ?);`,
      [id, baseName, path.basename(chosenPath), targetPath]
    )

    logger.info(`Uploaded theme background '${baseName}' (${targetPath})`)
    return {
      id,
      name: baseName,
      originalFilename: path.basename(chosenPath),
      filePath: targetPath,
      url: `file://${targetPath.replace(/\\/g, '/')}`,
      createdAt: new Date().toISOString()
    }
  }
}

export const themeService = new ThemeService()
