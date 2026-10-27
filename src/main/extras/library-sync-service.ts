import fs from 'fs'
import path from 'path'
import os from 'os'
import { libraryService } from '../library-service'
import { themeService } from '../theme/theme-service'
import { databaseService } from '../db/database-service'
import {
  SyncPackageManifest,
  SyncConflictItem,
  SyncMergeResult,
  Song,
  ServicePlan,
  ThemeConfig,
  MacroItem
} from '../../shared/types'
import { logger } from '../logger'

export class LibrarySyncService {
  /**
   * Exports local database collections to a portable folder sync package.
   */
  public async exportPackage(targetFolder: string): Promise<{
    success: boolean
    packagePath?: string
    manifest?: SyncPackageManifest
    error?: string
  }> {
    try {
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true })
      }

      const songs = libraryService.getSongs()
      const playlists = libraryService.getServices()
      const themes = themeService.getThemes()
      const macros = databaseService.getMacros()

      const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const generatedAt = new Date().toISOString()
      const sourceComputerId = os.hostname() || 'churchpresenter-node'

      const manifest: SyncPackageManifest = {
        packageId,
        generatedAt,
        sourceComputerId,
        version: 1,
        counts: {
          songs: songs.length,
          playlists: playlists.length,
          themes: themes.length,
          macros: macros.length
        }
      }

      fs.writeFileSync(path.join(targetFolder, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
      fs.writeFileSync(path.join(targetFolder, 'songs.json'), JSON.stringify(songs, null, 2), 'utf-8')
      fs.writeFileSync(path.join(targetFolder, 'playlists.json'), JSON.stringify(playlists, null, 2), 'utf-8')
      fs.writeFileSync(path.join(targetFolder, 'themes.json'), JSON.stringify(themes, null, 2), 'utf-8')
      fs.writeFileSync(path.join(targetFolder, 'macros.json'), JSON.stringify(macros, null, 2), 'utf-8')

      databaseService.saveSyncConfig({
        syncFolder: targetFolder,
        lastSyncAt: generatedAt
      })

      databaseService.recordSyncHistory({
        packageId,
        action: 'export',
        folderPath: targetFolder,
        itemsImported: songs.length + playlists.length + themes.length + macros.length
      })

      logger.info(`Sync: successfully exported package ${packageId} to ${targetFolder}`)
      return { success: true, packagePath: targetFolder, manifest }
    } catch (err: any) {
      logger.error('Sync export failed:', err)
      return { success: false, error: err?.message || String(err) }
    }
  }

  /**
   * Inspects a sync package folder, comparing remote items against local database.
   * Identifies identical items, brand new items, and conflicting modifications.
   */
  public async inspectPackage(sourceFolder: string): Promise<{
    success: boolean
    manifest?: SyncPackageManifest
    conflicts: SyncConflictItem[]
    newItemsCount: number
    identicalCount: number
    error?: string
  }> {
    try {
      const manifestPath = path.join(sourceFolder, 'manifest.json')
      if (!fs.existsSync(manifestPath)) {
        return {
          success: false,
          conflicts: [],
          newItemsCount: 0,
          identicalCount: 0,
          error: `No se encontró manifest.json en ${sourceFolder}`
        }
      }

      const manifest: SyncPackageManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
      const conflicts: SyncConflictItem[] = []
      let newItemsCount = 0
      let identicalCount = 0

      // 1. Inspect Songs
      const songsPath = path.join(sourceFolder, 'songs.json')
      if (fs.existsSync(songsPath)) {
        const remoteSongs: Song[] = JSON.parse(fs.readFileSync(songsPath, 'utf-8'))
        const localSongs = libraryService.getSongs()
        const localSongMap = new Map(localSongs.map((s) => [s.id, s]))

        for (const rSong of remoteSongs) {
          const lSong = localSongMap.get(rSong.id)
          if (!lSong) {
            newItemsCount++
          } else {
            // Compare content
            const lContent = JSON.stringify({ title: lSong.title, author: lSong.author, groups: lSong.groups })
            const rContent = JSON.stringify({ title: rSong.title, author: rSong.author, groups: rSong.groups })
            if (lContent === rContent) {
              identicalCount++
            } else {
              conflicts.push({
                id: rSong.id,
                type: 'song',
                title: rSong.title || 'Canción sin título',
                localUpdatedAt: '',
                remoteUpdatedAt: '',
                localSummary: `${lSong.groups?.length || 0} estrofas / ${lSong.author || 'Sin autor'}`,
                remoteSummary: `${rSong.groups?.length || 0} estrofas / ${rSong.author || 'Sin autor'}`
              })
            }
          }
        }
      }

      // 2. Inspect Playlists (Services)
      const playlistsPath = path.join(sourceFolder, 'playlists.json')
      if (fs.existsSync(playlistsPath)) {
        const remotePlaylists: ServicePlan[] = JSON.parse(fs.readFileSync(playlistsPath, 'utf-8'))
        const localPlaylists = libraryService.getServices()
        const localPlaylistMap = new Map(localPlaylists.map((p) => [p.id, p]))

        for (const rPl of remotePlaylists) {
          const lPl = localPlaylistMap.get(rPl.id)
          if (!lPl) {
            newItemsCount++
          } else {
            const lItems = JSON.stringify(lPl.items || [])
            const rItems = JSON.stringify(rPl.items || [])
            if (lItems === rItems && lPl.name === rPl.name) {
              identicalCount++
            } else {
              conflicts.push({
                id: rPl.id,
                type: 'playlist',
                title: rPl.name || 'Lista sin nombre',
                localUpdatedAt: lPl.updatedAt || lPl.createdAt || '',
                remoteUpdatedAt: rPl.updatedAt || rPl.createdAt || '',
                localSummary: `${lPl.items?.length || 0} elementos`,
                remoteSummary: `${rPl.items?.length || 0} elementos`
              })
            }
          }
        }
      }

      // 3. Inspect Themes
      const themesPath = path.join(sourceFolder, 'themes.json')
      if (fs.existsSync(themesPath)) {
        const remoteThemes: ThemeConfig[] = JSON.parse(fs.readFileSync(themesPath, 'utf-8'))
        const localThemes = themeService.getThemes()
        const localThemeMap = new Map(localThemes.map((t) => [t.id, t]))

        for (const rTh of remoteThemes) {
          const lTh = localThemeMap.get(rTh.id)
          if (!lTh) {
            newItemsCount++
          } else {
            const lData = JSON.stringify(lTh)
            const rData = JSON.stringify(rTh)
            if (lData === rData) {
              identicalCount++
            } else {
              conflicts.push({
                id: rTh.id,
                type: 'theme',
                title: rTh.name || 'Tema sin nombre',
                localUpdatedAt: '',
                remoteUpdatedAt: '',
                localSummary: `Fondo: ${lTh.background?.type || 'color'}, Fuente: ${lTh.fontFamily || 'default'}`,
                remoteSummary: `Fondo: ${rTh.background?.type || 'color'}, Fuente: ${rTh.fontFamily || 'default'}`
              })
            }
          }
        }
      }

      // 4. Inspect Macros
      const macrosPath = path.join(sourceFolder, 'macros.json')
      if (fs.existsSync(macrosPath)) {
        const remoteMacros: MacroItem[] = JSON.parse(fs.readFileSync(macrosPath, 'utf-8'))
        const localMacros = databaseService.getMacros()
        const localMacroMap = new Map(localMacros.map((m) => [m.id, m]))

        for (const rM of remoteMacros) {
          const lM = localMacroMap.get(rM.id)
          if (!lM) {
            newItemsCount++
          } else {
            const lActions = JSON.stringify(lM.actions || [])
            const rActions = JSON.stringify(rM.actions || [])
            if (lActions === rActions && lM.name === rM.name) {
              identicalCount++
            } else {
              conflicts.push({
                id: rM.id,
                type: 'macro',
                title: rM.name || 'Macro sin nombre',
                localUpdatedAt: lM.updatedAt || '',
                remoteUpdatedAt: rM.updatedAt || '',
                localSummary: `${lM.actions?.length || 0} acciones`,
                remoteSummary: `${rM.actions?.length || 0} acciones`
              })
            }
          }
        }
      }

      return {
        success: true,
        manifest,
        conflicts,
        newItemsCount,
        identicalCount
      }
    } catch (err: any) {
      logger.error('Sync package inspection failed:', err)
      return {
        success: false,
        conflicts: [],
        newItemsCount: 0,
        identicalCount: 0,
        error: err?.message || String(err)
      }
    }
  }

  /**
   * Merges a sync package into the local database.
   * Creates an automatic pre-sync backup that can be undone at any time.
   */
  public async mergePackage(
    sourceFolder: string,
    resolutions: Record<string, 'keep_local' | 'keep_remote' | 'duplicate_both'> = {}
  ): Promise<SyncMergeResult> {
    try {
      // 1. Mandatory Pre-Sync Backup for safety
      const backupPath = databaseService.createBackup('pre_sync') || undefined

      const songsPath = path.join(sourceFolder, 'songs.json')
      const playlistsPath = path.join(sourceFolder, 'playlists.json')
      const themesPath = path.join(sourceFolder, 'themes.json')
      const macrosPath = path.join(sourceFolder, 'macros.json')

      let importedCount = 0
      let updatedCount = 0
      const conflictsEncountered: SyncConflictItem[] = []

      // 1. Merge Songs
      if (fs.existsSync(songsPath)) {
        const remoteSongs: Song[] = JSON.parse(fs.readFileSync(songsPath, 'utf-8'))
        const localSongs = libraryService.getSongs()
        const localMap = new Map(localSongs.map((s) => [s.id, s]))

        for (const rSong of remoteSongs) {
          const lSong = localMap.get(rSong.id)
          if (!lSong) {
            libraryService.saveSong(rSong)
            importedCount++
          } else {
            const lContent = JSON.stringify({ title: lSong.title, author: lSong.author, groups: lSong.groups })
            const rContent = JSON.stringify({ title: rSong.title, author: rSong.author, groups: rSong.groups })
            if (lContent !== rContent) {
              const res = resolutions[rSong.id] || 'keep_local'
              if (res === 'keep_remote') {
                libraryService.saveSong(rSong)
                updatedCount++
              } else if (res === 'duplicate_both') {
                const dup: Song = {
                  ...rSong,
                  id: `song_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  title: `${rSong.title} (Sincronizado)`
                }
                libraryService.saveSong(dup)
                importedCount++
              }
              // keep_local = do nothing
            }
          }
        }
      }

      // 2. Merge Playlists
      if (fs.existsSync(playlistsPath)) {
        const remotePlaylists: ServicePlan[] = JSON.parse(fs.readFileSync(playlistsPath, 'utf-8'))
        const localPlaylists = libraryService.getServices()
        const localMap = new Map(localPlaylists.map((p) => [p.id, p]))

        for (const rPl of remotePlaylists) {
          const lPl = localMap.get(rPl.id)
          if (!lPl) {
            libraryService.saveService(rPl)
            importedCount++
          } else {
            const lItems = JSON.stringify(lPl.items || [])
            const rItems = JSON.stringify(rPl.items || [])
            if (lItems !== rItems || lPl.name !== rPl.name) {
              const res = resolutions[rPl.id] || 'keep_local'
              if (res === 'keep_remote') {
                libraryService.saveService(rPl)
                updatedCount++
              } else if (res === 'duplicate_both') {
                const dup: ServicePlan = {
                  ...rPl,
                  id: `service_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  name: `${rPl.name} (Sincronizado)`
                }
                libraryService.saveService(dup)
                importedCount++
              }
            }
          }
        }
      }

      // 3. Merge Themes
      if (fs.existsSync(themesPath)) {
        const remoteThemes: ThemeConfig[] = JSON.parse(fs.readFileSync(themesPath, 'utf-8'))
        const localThemes = themeService.getThemes()
        const localMap = new Map(localThemes.map((t) => [t.id, t]))

        for (const rTh of remoteThemes) {
          const lTh = localMap.get(rTh.id)
          if (!lTh) {
            themeService.saveTheme(rTh)
            importedCount++
          } else {
            const lData = JSON.stringify({ ...lTh, updatedAt: undefined })
            const rData = JSON.stringify({ ...rTh, updatedAt: undefined })
            if (lData !== rData) {
              const res = resolutions[rTh.id] || 'keep_local'
              if (res === 'keep_remote') {
                themeService.saveTheme(rTh)
                updatedCount++
              } else if (res === 'duplicate_both') {
                const dup: ThemeConfig = {
                  ...rTh,
                  id: `theme_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  name: `${rTh.name} (Sincronizado)`,
                  isDefault: false
                }
                themeService.saveTheme(dup)
                importedCount++
              }
            }
          }
        }
      }

      // 4. Merge Macros
      if (fs.existsSync(macrosPath)) {
        const remoteMacros: MacroItem[] = JSON.parse(fs.readFileSync(macrosPath, 'utf-8'))
        const localMacros = databaseService.getMacros()
        const localMap = new Map(localMacros.map((m) => [m.id, m]))

        for (const rM of remoteMacros) {
          const lM = localMap.get(rM.id)
          if (!lM) {
            databaseService.saveMacro(rM)
            importedCount++
          } else {
            const lActions = JSON.stringify(lM.actions || [])
            const rActions = JSON.stringify(rM.actions || [])
            if (lActions !== rActions || lM.name !== rM.name) {
              const res = resolutions[rM.id] || 'keep_local'
              if (res === 'keep_remote') {
                databaseService.saveMacro(rM)
                updatedCount++
              } else if (res === 'duplicate_both') {
                const dup: MacroItem = {
                  ...rM,
                  id: `macro_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  name: `${rM.name} (Sincronizada)`
                }
                databaseService.saveMacro(dup)
                importedCount++
              }
            }
          }
        }
      }

      databaseService.recordSyncHistory({
        action: 'merge',
        folderPath: sourceFolder,
        itemsImported: importedCount,
        itemsConflicted: conflictsEncountered.length,
        backupPath
      })

      databaseService.saveSyncConfig({
        syncFolder: sourceFolder,
        lastSyncAt: new Date().toISOString()
      })

      return {
        success: true,
        importedCount,
        updatedCount,
        conflictCount: conflictsEncountered.length,
        conflicts: conflictsEncountered,
        backupPath
      }
    } catch (err: any) {
      logger.error('Sync merge failed:', err)
      return {
        success: false,
        importedCount: 0,
        updatedCount: 0,
        conflictCount: 0,
        conflicts: [],
        error: err?.message || String(err)
      }
    }
  }

  /**
   * Restores the local database from the most recent pre-sync backup.
   */
  public async undoSync(): Promise<{ success: boolean; restoredFrom?: string; error?: string }> {
    const backupPath = databaseService.getLastSyncBackupPath()
    if (!backupPath || !fs.existsSync(backupPath)) {
      return {
        success: false,
        error: 'No se encontró ninguna copia de seguridad previa de sincronización para deshacer.'
      }
    }

    const restored = databaseService.restoreBackupFile(backupPath)
    if (restored) {
      logger.info(`Sync: successfully restored database from ${backupPath}`)
      return { success: true, restoredFrom: backupPath }
    } else {
      return { success: false, error: `Error al restaurar base de datos desde ${backupPath}` }
    }
  }
}

export const librarySyncService = new LibrarySyncService()
