import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { ThemeService, resolveEffectiveTheme, FACTORY_THEMES } from '../src/main/theme/theme-service'
import { ThemeConfig, DEFAULT_THEME } from '../src/shared/types'
import AdmZip from 'adm-zip'

describe('Theme Service & Priority Resolution', () => {
  let tempDir: string
  let dbPath: string
  let service: ThemeService

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-theme-test-'))
    dbPath = path.join(tempDir, 'test.sqlite')
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = dbPath
    ds.backupsDir = path.join(tempDir, 'backups')
    await databaseService.initialize()

    service = new ThemeService()
    service.initialize(tempDir)
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  describe('resolveEffectiveTheme (4-Tier Priority & Role Override)', () => {
    const customGeneralTheme: ThemeConfig = {
      ...DEFAULT_THEME,
      id: 'general-dark',
      name: 'General Dark',
      color: '#ffffff',
      fontSizeVmin: 6.0
    }

    const songTypeTheme: ThemeConfig = {
      ...DEFAULT_THEME,
      id: 'song-default',
      name: 'Song Default',
      color: '#f97316',
      fontSizeVmin: 7.5
    }

    const itemSpecificTheme: ThemeConfig = {
      ...DEFAULT_THEME,
      id: 'hymn-classic',
      name: 'Hymn Classic',
      color: '#38bdf8',
      fontSizeVmin: 8.0,
      roleOverrides: {
        stage: {
          fontSizeVmin: 10.0,
          color: '#22c55e'
        }
      }
    }

    const testThemes = [customGeneralTheme, songTypeTheme, itemSpecificTheme]
    const testTypeDefaults = {
      songs: 'song-default',
      bible: 'theme-factory-bible-classic',
      announcements: 'theme-factory-announce-warm',
      messages: 'theme-factory-msg-amber',
      timer: 'theme-factory-timer-neon'
    }

    it('Priority 1: Uses item-specific theme when specified', () => {
      const resolved = resolveEffectiveTheme({
        contentType: 'songs',
        elementThemeId: 'hymn-classic',
        themes: testThemes,
        typeDefaults: testTypeDefaults
      })
      expect(resolved.id).toBe('hymn-classic')
      expect(resolved.color).toBe('#38bdf8')
      expect(resolved.fontSizeVmin).toBe(8.0)
    })

    it('Priority 2: Falls back to content-type default theme when element has no theme', () => {
      const resolved = resolveEffectiveTheme({
        contentType: 'songs',
        elementThemeId: undefined,
        themes: testThemes,
        typeDefaults: testTypeDefaults
      })
      expect(resolved.id).toBe('song-default')
      expect(resolved.color).toBe('#f97316')
      expect(resolved.fontSizeVmin).toBe(7.5)
    })

    it('Priority 3: Falls back to general default theme when content-type has no matching theme', () => {
      const resolved = resolveEffectiveTheme({
        contentType: null,
        elementThemeId: undefined,
        themes: [customGeneralTheme],
        typeDefaults: testTypeDefaults
      })
      expect(resolved.id).toBe('general-dark')
      expect(resolved.color).toBe('#ffffff')
      expect(resolved.fontSizeVmin).toBe(6.0)
    })

    it('Priority 4: Overlays stage display role overrides on top of resolved theme', () => {
      const resolved = resolveEffectiveTheme({
        contentType: 'songs',
        elementThemeId: 'hymn-classic',
        themes: testThemes,
        typeDefaults: testTypeDefaults,
        role: 'stage'
      })
      expect(resolved.id).toBe('hymn-classic')
      expect(resolved.fontSizeVmin).toBe(10.0) // stage override
      expect(resolved.color).toBe('#22c55e') // stage override
    })
  })

  describe('Theme Management CRUD & Built-in Protection', () => {
    it('initializes factory themes into database', () => {
      const themes = service.getThemes()
      expect(themes.length).toBeGreaterThanOrEqual(11)

      const worshipDark = themes.find((t) => t.id === 'theme-factory-songs-dark')
      expect(worshipDark).toBeDefined()
      expect(worshipDark?.isBuiltIn).toBe(true)
    })

    it('prevents deleting built-in factory themes', () => {
      expect(() => {
        service.deleteTheme('theme-factory-songs-dark')
      }).toThrow(/no se puede eliminar/i)
    })

    it('duplicates a theme successfully with a new ID and non-builtin flag', () => {
      const original = FACTORY_THEMES[1]
      const duplicate = service.duplicateTheme(original.id)
      expect(duplicate.id).not.toBe(original.id)
      expect(duplicate.name).toBe(`${original.name} (Copia)`)
      expect(duplicate.isBuiltIn).toBe(false)
      expect(duplicate.isDefault).toBe(false)

      const themes = service.getThemes()
      expect(themes.some((t) => t.id === duplicate.id)).toBe(true)
    })

    it('reassigns songs when a custom theme is deleted (Cascade Reassignment)', () => {
      // 1. Create a custom theme
      const custom = service.saveTheme({
        ...DEFAULT_THEME,
        id: 'custom-to-delete',
        name: 'Custom Theme',
        isBuiltIn: false
      })

      const uniqueSongId = `song-cascade-${Date.now()}-${Math.floor(Math.random() * 10000)}`
      // 2. Insert a song using this theme
      databaseService.run(
        `INSERT OR REPLACE INTO songs (id, title, author, copyright, ccli_number, language, tags, created_at, updated_at, theme_id)
         VALUES (?, 'Test Song', 'Author', '', '', 'es', '', datetime('now'), datetime('now'), 'custom-to-delete');`,
        [uniqueSongId]
      )

      const songBefore = databaseService.query('SELECT theme_id FROM songs WHERE id = ?;', [uniqueSongId])
      expect(songBefore[0].theme_id).toBe('custom-to-delete')

      // 3. Delete the custom theme with fallback to theme-factory-songs-gradient
      service.deleteTheme('custom-to-delete', 'theme-factory-songs-gradient')

      // 4. Verify song theme_id was reassigned
      const songAfter = databaseService.query('SELECT theme_id FROM songs WHERE id = ?;', [uniqueSongId])
      expect(songAfter[0].theme_id).toBe('theme-factory-songs-gradient')
    })
  })

  describe('Theme Package (.cptheme) Export and Import', () => {
    it('exports a theme to a valid zip package', () => {
      const theme = FACTORY_THEMES[1]
      const outZip = path.join(tempDir, 'exported.cptheme')

      const result = service.exportThemePackage({ themeId: theme.id, targetPath: outZip, includeFonts: false })
      expect(result.success).toBe(true)
      expect(fs.existsSync(outZip)).toBe(true)

      const zip = new AdmZip(outZip)
      const manifestEntry = zip.getEntry('manifest.json')
      expect(manifestEntry).not.toBeNull()

      const manifest = JSON.parse(manifestEntry!.getData().toString('utf8'))
      expect(manifest.version).toBe(1)
      expect(manifest.format).toBe('churchpresenter-theme')
      expect(manifest.theme.id).toBe(theme.id)
      expect(manifest.theme.name).toBe(theme.name)
    })

    it('imports a theme from a .cptheme package', () => {
      // Create a test theme package
      const outZip = path.join(tempDir, 'import_test.cptheme')
      const testTheme: ThemeConfig = {
        ...DEFAULT_THEME,
        id: 'pkg-theme-1',
        name: 'Package Theme 1',
        fontSizeVmin: 9.2,
        isBuiltIn: false
      }

      service.saveTheme(testTheme)
      service.exportThemePackage({ themeId: testTheme.id, targetPath: outZip })

      // Delete from service to simulate importing onto another machine
      service.deleteTheme(testTheme.id)

      // Now import
      const result = service.importThemePackage(outZip)

      expect(result.success).toBe(true)
      expect(result.theme).toBeDefined()
      expect(result.theme?.name).toBe('Package Theme 1')
      expect(result.theme?.fontSizeVmin).toBe(9.2)
    })

    it('rejects zip packages with zip-slip path traversal entries', () => {
      const maliciousZipPath = path.join(tempDir, 'malicious.cptheme')
      const zip = new AdmZip()
      zip.addFile('manifest.json', Buffer.from(JSON.stringify({
        version: 1,
        format: 'churchpresenter-theme',
        theme: { ...DEFAULT_THEME, id: 'bad-theme', name: 'Bad' }
      })))
      const evilEntry = zip.addFile('evil.txt', Buffer.from('malicious payload'))
      evilEntry.entryName = '../../evil.txt'
      zip.writeZip(maliciousZipPath)

      const result = service.importThemePackage(maliciousZipPath)
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/contiene rutas relativas no seguras/)
    })
  })

  describe('Content Type Default Themes Configuration', () => {
    it('sets and persists content type defaults', () => {
      const current = service.getTypeDefaultThemes()
      expect(current.songs).toBeDefined()
      expect(current.bible).toBeDefined()

      service.setTypeDefaultTheme('bible', 'theme-factory-bible-modern')
      const updated = service.getTypeDefaultThemes()
      expect(updated.bible).toBe('theme-factory-bible-modern')
    })
  })
})
