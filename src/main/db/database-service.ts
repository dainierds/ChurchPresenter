import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from '../logger'
import {
  DEFAULT_ROLE_BIBLE_CONFIGS,
  MediaItem,
  MediaType,
  RoleBibleConfig,
  RoleBibleConfigsMap
} from '../../shared/types'

export interface Migration {
  version: number
  name: string
  up: (db: Database) => void
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_config_and_assignments_tables',
    up: (db: Database) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)

      db.run(`
        CREATE TABLE IF NOT EXISTS role_assignments (
          role TEXT PRIMARY KEY,
          display_id TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)
    }
  },
  {
    version: 2,
    name: 'alter_role_assignments_to_stable_id',
    up: (_db: Database) => {
      // Schema compatibility for TEXT stable IDs
    }
  },
  {
    version: 3,
    name: 'create_content_and_service_tables',
    up: (db: Database) => {
      // Songs library
      db.run(`
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT DEFAULT '',
          copyright TEXT DEFAULT '',
          ccli_number TEXT DEFAULT '',
          language TEXT DEFAULT 'es',
          tags TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)

      // Song section groups (Verso 1, Coro, Puente, etc.)
      db.run(`
        CREATE TABLE IF NOT EXISTS song_groups (
          id TEXT PRIMARY KEY,
          song_id TEXT NOT NULL,
          group_type TEXT NOT NULL,
          group_number INTEGER DEFAULT 1,
          label TEXT NOT NULL,
          content TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0,
          FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
      `)

      // Song arrangements
      db.run(`
        CREATE TABLE IF NOT EXISTS song_arrangements (
          id TEXT PRIMARY KEY,
          song_id TEXT NOT NULL,
          name TEXT NOT NULL,
          group_order TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        );
      `)

      // Generic presentations (announcements, liturgies, sermons)
      db.run(`
        CREATE TABLE IF NOT EXISTS generic_presentations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          slides_json TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)

      // Themes
      db.run(`
        CREATE TABLE IF NOT EXISTS themes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          config_json TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)

      // Background media
      db.run(`
        CREATE TABLE IF NOT EXISTS background_images (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          original_filename TEXT NOT NULL,
          file_path TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `)

      // Services / Playlists & Templates
      db.run(`
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          items_json TEXT NOT NULL,
          is_template INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)
    }
  },
  {
    version: 4,
    name: 'demo_data_and_bible_support',
    up: (db: Database) => {
      // Safe addition of is_demo to content tables
      const addColumnSafe = (table: string, columnDef: string) => {
        try {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`)
        } catch {
          // Column may already exist
        }
      }
      addColumnSafe('songs', 'is_demo INTEGER DEFAULT 0')
      addColumnSafe('generic_presentations', 'is_demo INTEGER DEFAULT 0')
      addColumnSafe('services', 'is_demo INTEGER DEFAULT 0')

      // Phase 4: Bible favorites & recent history in main DB (verses stay in separate .bible SQLite files)
      db.run(`
        CREATE TABLE IF NOT EXISTS bible_favorites (
          reference TEXT PRIMARY KEY,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS bible_recent_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          reference TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `)
    }
  },
  {
    version: 5,
    name: 'role_bible_configs_and_media_items',
    up: (db: Database) => {
      // Role Bible configs per output (main, stage, lobby)
      db.run(`
        CREATE TABLE IF NOT EXISTS role_bible_configs (
          role TEXT PRIMARY KEY,
          mode TEXT NOT NULL DEFAULT 'single',
          primary_translation TEXT NOT NULL DEFAULT 'RVR1909',
          secondary_translation TEXT
        );
        INSERT OR IGNORE INTO role_bible_configs (role, mode, primary_translation, secondary_translation)
        VALUES ('main', 'single', 'RVR1909', NULL);
        INSERT OR IGNORE INTO role_bible_configs (role, mode, primary_translation, secondary_translation)
        VALUES ('lobby', 'single', 'RVR1909', NULL);
        INSERT OR IGNORE INTO role_bible_configs (role, mode, primary_translation, secondary_translation)
        VALUES ('stage', 'stacked', 'RVR1909', 'KJV');

        CREATE TABLE IF NOT EXISTS media_items (
          id TEXT PRIMARY KEY,
          hash TEXT NOT NULL,
          file_name TEXT NOT NULL,
          original_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          media_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          duration REAL DEFAULT 0,
          width INTEGER DEFAULT 0,
          height INTEGER DEFAULT 0,
          codec TEXT,
          container TEXT,
          tags TEXT,
          thumbnail_path TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_media_hash ON media_items(hash);
        CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
      `)
    }
  }
]

const SQLITE_HEADER = 'SQLite format 3'
const DEFAULT_RECENT_LIMIT = 10
const DEFAULT_RETENTION_DAYS = 14
const DEFAULT_INTERVAL_MINUTES = 15

export class DatabaseService {
  private db: Database | null = null
  private dbPath: string = ''
  private backupsDir: string = ''
  private saveTimeout: NodeJS.Timeout | null = null
  private periodicBackupTimer: NodeJS.Timeout | null = null
  private restoredFromBackup: boolean = false
  private SQL: SqlJsStatic | null = null
  private isDirty: boolean = false
  private lastBackupTimestamp: number = 0

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath
      this.backupsDir = path.join(path.dirname(customPath), 'backups')
    } else {
      try {
        const userData = app.getPath('userData')
        this.dbPath = path.join(userData, 'church_presenter.sqlite')
        this.backupsDir = path.join(userData, 'backups')
      } catch {
        this.dbPath = path.resolve(process.cwd(), 'church_presenter.sqlite')
        this.backupsDir = path.resolve(process.cwd(), 'backups')
      }
    }
  }

  public wasRestoredFromBackup(): boolean {
    return this.restoredFromBackup
  }

  public getBackupsDirectory(): string {
    return this.backupsDir
  }

  public setLastBackupTimestampForTest(timestamp: number): void {
    this.lastBackupTimestamp = timestamp
  }

  public getDatabaseInstance(): Database | null {
    return this.db
  }

  public async initialize(): Promise<void> {
    try {
      // Locate sql-wasm.wasm
      let wasmPath = path.resolve(__dirname, 'sql-wasm.wasm')
      if (!fs.existsSync(wasmPath)) {
        wasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')
      }
      if (!fs.existsSync(wasmPath)) {
        wasmPath = path.resolve(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm')
      }

      if (fs.existsSync(wasmPath)) {
        const buf = fs.readFileSync(wasmPath)
        const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        this.SQL = await initSqlJs({ wasmBinary })
      } else {
        this.SQL = await initSqlJs()
      }

      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }
      if (!fs.existsSync(this.backupsDir)) {
        fs.mkdirSync(this.backupsDir, { recursive: true })
      }

      // Check existing file integrity
      let loadedValidDb = false
      if (fs.existsSync(this.dbPath)) {
        const isValid = this.verifyDatabaseFile(this.dbPath)
        if (isValid) {
          const fileBuffer = fs.readFileSync(this.dbPath)
          this.db = new this.SQL.Database(new Uint8Array(fileBuffer))
          logger.info(`Loaded existing SQLite database from ${this.dbPath}`)
          loadedValidDb = true
        } else {
          logger.error(`Database file at ${this.dbPath} is CORRUPTED. Attempting recovery from backup...`)
          const corruptArchive = `${this.dbPath}.corrupt_${Date.now()}`
          try {
            fs.renameSync(this.dbPath, corruptArchive)
          } catch {
            // ignore rename error
          }

          const restored = this.restoreLatestBackup()
          if (restored) {
            const fileBuffer = fs.readFileSync(this.dbPath)
            this.db = new this.SQL.Database(new Uint8Array(fileBuffer))
            this.restoredFromBackup = true
            logger.info(`Successfully restored database from backup into ${this.dbPath}`)
            loadedValidDb = true
          }
        }
      }

      if (!loadedValidDb) {
        this.db = new this.SQL.Database()
        logger.info(`Created fresh SQLite database at ${this.dbPath}`)
      }

      this.runMigrations()
      this.persist()

      // Time-based policy: 1. Backup on app open
      this.createBackup('startup')
      this.createDailyBackupIfNeeded()

      // 2. Start periodic backup check timer (runs every minute to check interval)
      this.startPeriodicBackupTimer()
    } catch (err) {
      logger.error('Failed to initialize SQLite database:', err)
      throw err
    }
  }

  private startPeriodicBackupTimer(): void {
    if (this.periodicBackupTimer) clearInterval(this.periodicBackupTimer)
    this.periodicBackupTimer = setInterval(() => {
      this.checkPeriodicBackup(false)
    }, 60 * 1000)
  }

  /**
   * Checks whether a periodic backup is due (every 15 min, only if modified/dirty).
   */
  public checkPeriodicBackup(force: boolean = false): boolean {
    if (!this.db) return false
    const intervalMinutes = this.getConfigNumber('backup_interval_minutes', DEFAULT_INTERVAL_MINUTES)
    const intervalMs = intervalMinutes * 60 * 1000
    const now = Date.now()

    if (force) {
      if (!this.isDirty) return false
      this.createBackup('periodic')
      this.isDirty = false
      this.lastBackupTimestamp = now
      return true
    }

    if (this.isDirty && now - this.lastBackupTimestamp >= intervalMs) {
      this.createBackup('periodic')
      this.isDirty = false
      this.lastBackupTimestamp = now
      this.createDailyBackupIfNeeded()
      return true
    }

    return false
  }

  private createDailyBackupIfNeeded(): void {
    if (!this.db) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const dailyBackupPath = path.join(this.backupsDir, `daily_${today}.sqlite`)
      if (!fs.existsSync(dailyBackupPath)) {
        logger.info(`Creating daily backup for ${today}`)
        const data = this.db.export()
        const buffer = Buffer.from(data)
        const tmp = `${dailyBackupPath}.tmp`
        fs.writeFileSync(tmp, buffer)
        fs.renameSync(tmp, dailyBackupPath)
      }
      const retentionDays = this.getConfigNumber('daily_retention_days', DEFAULT_RETENTION_DAYS)
      this.cleanExpiredBackups(retentionDays)
    } catch (err) {
      logger.error('Error creating daily backup:', err)
    }
  }

  public cleanExpiredBackups(retentionDays: number = DEFAULT_RETENTION_DAYS): void {
    if (!fs.existsSync(this.backupsDir)) return
    const now = Date.now()
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000

    try {
      const files = fs.readdirSync(this.backupsDir)
      for (const file of files) {
        if (file.startsWith('daily_') && file.endsWith('.sqlite')) {
          const filePath = path.join(this.backupsDir, file)
          const stat = fs.statSync(filePath)
          if (now - stat.mtimeMs > maxAgeMs) {
            logger.info(`Deleting expired daily backup: ${file}`)
            try {
              fs.unlinkSync(filePath)
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      logger.error('Error cleaning expired daily backups:', err)
    }
  }

  private verifyDatabaseFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false
      const stat = fs.statSync(filePath)
      if (stat.size < 100) return false

      const fd = fs.openSync(filePath, 'r')
      const headerBuf = Buffer.alloc(16)
      fs.readSync(fd, headerBuf, 0, 16, 0)
      fs.closeSync(fd)

      const headerStr = headerBuf.toString('utf8', 0, 15)
      if (!headerStr.startsWith(SQLITE_HEADER)) {
        return false
      }

      if (this.SQL) {
        const buffer = fs.readFileSync(filePath)
        const tempDb = new this.SQL.Database(new Uint8Array(buffer))
        tempDb.exec('SELECT 1;')
        tempDb.close()
      }
      return true
    } catch {
      return false
    }
  }

  private restoreLatestBackup(): boolean {
    if (!fs.existsSync(this.backupsDir)) return false

    const backups = fs.readdirSync(this.backupsDir)
      .filter((f) => f.endsWith('.sqlite'))
      .map((f) => ({
        name: f,
        fullPath: path.join(this.backupsDir, f),
        mtime: fs.statSync(path.join(this.backupsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime)

    for (const backup of backups) {
      if (this.verifyDatabaseFile(backup.fullPath)) {
        logger.warn(`Restoring verified backup: ${backup.name}`)
        fs.copyFileSync(backup.fullPath, this.dbPath)
        return true
      }
    }
    return false
  }

  public createBackup(tag: string = 'backup'): string | null {
    if (!this.db) return null
    try {
      if (!fs.existsSync(this.backupsDir)) {
        fs.mkdirSync(this.backupsDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(this.backupsDir, `${tag}_${timestamp}.sqlite`)

      const data = this.db.export()
      const buffer = Buffer.from(data)

      const tmpBackup = `${backupPath}.tmp`
      const fd = fs.openSync(tmpBackup, 'w')
      fs.writeSync(fd, buffer)
      fs.fsyncSync(fd)
      fs.closeSync(fd)
      fs.renameSync(tmpBackup, backupPath)

      this.lastBackupTimestamp = Date.now()
      this.rotateRecentBackups()
      return backupPath
    } catch (err) {
      logger.error('Failed to create database backup:', err)
      return null
    }
  }

  private rotateRecentBackups(): void {
    try {
      if (!fs.existsSync(this.backupsDir)) return
      const recentLimit = this.getConfigNumber('recent_backups_limit', DEFAULT_RECENT_LIMIT)

      // Only rotate non-daily backups (startup, periodic, exit, backup)
      const files = fs.readdirSync(this.backupsDir)
        .filter((f) => f.endsWith('.sqlite') && !f.startsWith('daily_'))
        .map((f) => ({
          fullPath: path.join(this.backupsDir, f),
          mtime: fs.statSync(path.join(this.backupsDir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime)

      if (files.length > recentLimit) {
        const toDelete = files.slice(recentLimit)
        for (const file of toDelete) {
          try {
            fs.unlinkSync(file.fullPath)
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      logger.error('Error rotating recent backups:', err)
    }
  }

  private runMigrations(): void {
    if (!this.db) return

    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `)

    const result = this.db.exec('SELECT version FROM schema_migrations;')
    const appliedVersions = new Set<number>()
    if (result.length > 0 && result[0].values) {
      for (const row of result[0].values) {
        appliedVersions.add(row[0] as number)
      }
    }

    for (const migration of MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        logger.info(`Running database migration ${migration.version}: ${migration.name}`)
        migration.up(this.db)
        this.db.run('INSERT INTO schema_migrations (version, name) VALUES (?, ?);', [
          migration.version,
          migration.name
        ])
      }
    }
  }

  public getConfig(key: string, defaultValue: string | null = null): string | null {
    if (!this.db) return defaultValue
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ? LIMIT 1;')
    try {
      stmt.bind([key])
      if (stmt.step()) {
        const row = stmt.getAsObject()
        return (row.value as string) ?? defaultValue
      }
      return defaultValue
    } finally {
      stmt.free()
    }
  }

  public getConfigNumber(key: string, defaultValue: number): number {
    const val = this.getConfig(key)
    if (val === null) return defaultValue
    const num = Number(val)
    return isNaN(num) ? defaultValue : num
  }

  public setConfig(key: string, value: string): void {
    if (!this.db) return
    this.db.run(
      `INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');`,
      [key, value]
    )
    this.isDirty = true
    this.schedulePersist()
  }

  public getAllConfigs(): Record<string, string> {
    if (!this.db) return {}
    const res = this.db.exec('SELECT key, value FROM config;')
    const configs: Record<string, string> = {}
    if (res.length > 0 && res[0].values) {
      for (const [k, v] of res[0].values) {
        configs[String(k)] = String(v)
      }
    }
    return configs
  }

  public getRoleAssignments(): Record<string, string | null> {
    if (!this.db) return {}
    const res = this.db.exec('SELECT role, display_id FROM role_assignments;')
    const assignments: Record<string, string | null> = {}
    if (res.length > 0 && res[0].values) {
      for (const [role, displayId] of res[0].values) {
        assignments[String(role)] = displayId !== null ? String(displayId) : null
      }
    }
    return assignments
  }

  public setRoleAssignment(role: string, displayId: string | null): void {
    if (!this.db) return
    if (displayId === null) {
      this.db.run('DELETE FROM role_assignments WHERE role = ?;', [role])
    } else {
      this.db.run(
        `INSERT INTO role_assignments (role, display_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(role) DO UPDATE SET display_id = excluded.display_id, updated_at = datetime('now');`,
        [role, String(displayId)]
      )
    }
    this.isDirty = true
    this.schedulePersist()
  }

  // --- Phase 3 SQL Query Helpers ---

  public run(sql: string, params: any[] = []): void {
    if (!this.db) return
    this.db.run(sql, params)
    this.isDirty = true
    this.schedulePersist()
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) return []
    const stmt = this.db.prepare(sql)
    const rows: T[] = []
    try {
      stmt.bind(params)
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T)
      }
      return rows
    } finally {
      stmt.free()
    }
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const rows = this.query<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  // --- Phase 4 / Phase 5A: Role Bible Configurations ---

  public getRoleBibleConfigs(): RoleBibleConfigsMap {
    const rows = this.query<{
      role: string
      mode: string
      primary_translation: string
      secondary_translation: string | null
    }>('SELECT role, mode, primary_translation, secondary_translation FROM role_bible_configs;')

    if (!rows || rows.length === 0) {
      return { ...DEFAULT_ROLE_BIBLE_CONFIGS }
    }

    const map: RoleBibleConfigsMap = { ...DEFAULT_ROLE_BIBLE_CONFIGS }
    for (const r of rows) {
      map[r.role] = {
        role: r.role,
        mode: (r.mode as any) || 'single',
        primaryTranslation: r.primary_translation || 'RVR1909',
        secondaryTranslation: r.secondary_translation || undefined
      }
    }
    return map
  }

  public saveRoleBibleConfig(config: RoleBibleConfig): void {
    const primary = config.primaryTranslation || (config as any).primaryTranslationId || 'RVR1909'
    const secondary = config.secondaryTranslation || (config as any).secondaryTranslationId || null
    this.run(
      `INSERT OR REPLACE INTO role_bible_configs (role, mode, primary_translation, secondary_translation)
       VALUES (?, ?, ?, ?);`,
      [config.role, config.mode || 'single', primary, secondary]
    )
  }

  // --- Phase 5A: Media Items Database Helpers ---

  public getMediaItems(type?: MediaType): MediaItem[] {
    let sql = 'SELECT * FROM media_items'
    const params: any[] = []
    if (type) {
      sql += ' WHERE media_type = ?'
      params.push(type)
    }
    sql += ' ORDER BY created_at DESC;'

    const rows = this.query<any>(sql, params)
    return rows.map((r) => ({
      id: r.id,
      hash: r.hash,
      fileName: r.file_name,
      originalName: r.original_name,
      filePath: r.file_path,
      mediaType: r.media_type,
      fileSize: r.file_size,
      duration: r.duration || 0,
      width: r.width || 0,
      height: r.height || 0,
      codec: r.codec || undefined,
      container: r.container || undefined,
      tags: r.tags ? JSON.parse(r.tags) : [],
      thumbnailPath: r.thumbnail_path || undefined,
      createdAt: r.created_at
    }))
  }

  public getMediaItemByHash(hash: string): MediaItem | null {
    const r = this.queryOne<any>('SELECT * FROM media_items WHERE hash = ? LIMIT 1;', [hash])
    if (!r) return null
    return {
      id: r.id,
      hash: r.hash,
      fileName: r.file_name,
      originalName: r.original_name,
      filePath: r.file_path,
      mediaType: r.media_type,
      fileSize: r.file_size,
      duration: r.duration || 0,
      width: r.width || 0,
      height: r.height || 0,
      codec: r.codec || undefined,
      container: r.container || undefined,
      tags: r.tags ? JSON.parse(r.tags) : [],
      thumbnailPath: r.thumbnail_path || undefined,
      createdAt: r.created_at
    }
  }

  public getMediaItemById(id: string): MediaItem | null {
    const r = this.queryOne<any>('SELECT * FROM media_items WHERE id = ? LIMIT 1;', [id])
    if (!r) return null
    return {
      id: r.id,
      hash: r.hash,
      fileName: r.file_name,
      originalName: r.original_name,
      filePath: r.file_path,
      mediaType: r.media_type,
      fileSize: r.file_size,
      duration: r.duration || 0,
      width: r.width || 0,
      height: r.height || 0,
      codec: r.codec || undefined,
      container: r.container || undefined,
      tags: r.tags ? JSON.parse(r.tags) : [],
      thumbnailPath: r.thumbnail_path || undefined,
      createdAt: r.created_at
    }
  }

  public insertMediaItem(item: MediaItem): void {
    this.run(
      `INSERT OR REPLACE INTO media_items (
        id, hash, file_name, original_name, file_path, media_type,
        file_size, duration, width, height, codec, container, tags, thumbnail_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        item.id,
        item.hash,
        item.fileName,
        item.originalName,
        item.filePath,
        item.mediaType,
        item.fileSize,
        item.duration,
        item.width,
        item.height,
        item.codec || null,
        item.container || null,
        JSON.stringify(item.tags || []),
        item.thumbnailPath || null,
        item.createdAt
      ]
    )
  }

  public deleteMediaItem(id: string): void {
    this.run('DELETE FROM media_items WHERE id = ?;', [id])
  }

  private schedulePersist(): void {
    if (this.saveTimeout) return
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null
      this.persist()
    }, 200)
  }

  public persist(): void {
    if (!this.db) return
    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      const tmpPath = `${this.dbPath}.tmp`

      const fd = fs.openSync(tmpPath, 'w')
      fs.writeSync(fd, buffer)
      fs.fsyncSync(fd)
      fs.closeSync(fd)

      if (fs.existsSync(this.dbPath)) {
        try {
          fs.renameSync(tmpPath, this.dbPath)
        } catch {
          fs.unlinkSync(this.dbPath)
          fs.renameSync(tmpPath, this.dbPath)
        }
      } else {
        fs.renameSync(tmpPath, this.dbPath)
      }
    } catch (err) {
      logger.error('Failed to atomically persist SQLite database to disk:', err)
    }
  }

  public close(): void {
    if (this.periodicBackupTimer) {
      clearInterval(this.periodicBackupTimer)
      this.periodicBackupTimer = null
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    if (this.db) {
      this.persist()
      // 3. Backup on app exit if there were changes
      if (this.isDirty) {
        this.createBackup('exit')
        this.isDirty = false
      }
      this.db.close()
      this.db = null
    }
  }
}

export const databaseService = new DatabaseService()
