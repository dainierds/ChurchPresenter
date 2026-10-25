import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { logger } from '../logger'

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
      // In SQLite, role_assignments already accepts TEXT display_id
      // This migration ensures schema compatibility
    }
  }
]

const SQLITE_HEADER = 'SQLite format 3'
const MAX_BACKUPS = 10

export class DatabaseService {
  private db: Database | null = null
  private dbPath: string = ''
  private backupsDir: string = ''
  private saveTimeout: NodeJS.Timeout | null = null
  private restoredFromBackup: boolean = false
  private SQL: SqlJsStatic | null = null

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
          // Archive corrupt file
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
      // Create initial backup on startup if valid
      this.createBackup()
    } catch (err) {
      logger.error('Failed to initialize SQLite database:', err)
      throw err
    }
  }

  private verifyDatabaseFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false
      const stat = fs.statSync(filePath)
      if (stat.size < 100) return false

      // Check SQLite 3 header magic string (16 bytes)
      const fd = fs.openSync(filePath, 'r')
      const headerBuf = Buffer.alloc(16)
      fs.readSync(fd, headerBuf, 0, 16, 0)
      fs.closeSync(fd)

      const headerStr = headerBuf.toString('utf8', 0, 15)
      if (!headerStr.startsWith(SQLITE_HEADER)) {
        return false
      }

      // Verify that SQL.js can open and query it
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
      .sort((a, b) => b.mtime - a.mtime) // newest first

    for (const backup of backups) {
      if (this.verifyDatabaseFile(backup.fullPath)) {
        logger.warn(`Restoring verified backup: ${backup.name}`)
        fs.copyFileSync(backup.fullPath, this.dbPath)
        return true
      }
    }
    return false
  }

  public createBackup(): string | null {
    if (!this.db) return null
    try {
      if (!fs.existsSync(this.backupsDir)) {
        fs.mkdirSync(this.backupsDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(this.backupsDir, `backup_${timestamp}.sqlite`)

      const data = this.db.export()
      const buffer = Buffer.from(data)

      // Atomic write for backup
      const tmpBackup = `${backupPath}.tmp`
      const fd = fs.openSync(tmpBackup, 'w')
      fs.writeSync(fd, buffer)
      fs.fsyncSync(fd)
      fs.closeSync(fd)
      fs.renameSync(tmpBackup, backupPath)

      this.rotateBackups()
      return backupPath
    } catch (err) {
      logger.error('Failed to create database backup:', err)
      return null
    }
  }

  private rotateBackups(): void {
    try {
      if (!fs.existsSync(this.backupsDir)) return
      const files = fs.readdirSync(this.backupsDir)
        .filter((f) => f.endsWith('.sqlite'))
        .map((f) => ({
          fullPath: path.join(this.backupsDir, f),
          mtime: fs.statSync(path.join(this.backupsDir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime)

      if (files.length > MAX_BACKUPS) {
        const toDelete = files.slice(MAX_BACKUPS)
        for (const file of toDelete) {
          try {
            fs.unlinkSync(file.fullPath)
          } catch {
            // ignore unlink errors
          }
        }
      }
    } catch (err) {
      logger.error('Error rotating database backups:', err)
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

  public setConfig(key: string, value: string): void {
    if (!this.db) return
    this.db.run(
      `INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');`,
      [key, value]
    )
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
    this.schedulePersist()
  }

  private schedulePersist(): void {
    if (this.saveTimeout) return
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null
      this.persist()
    }, 200)
  }

  /**
   * Atomic flush to disk: writes to temp file, executes fsync, and atomic renames.
   */
  public persist(): void {
    if (!this.db) return
    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      const tmpPath = `${this.dbPath}.tmp`

      // Write with synchronous file descriptor flush (fsync)
      const fd = fs.openSync(tmpPath, 'w')
      fs.writeSync(fd, buffer)
      fs.fsyncSync(fd)
      fs.closeSync(fd)

      // Atomic rename
      if (fs.existsSync(this.dbPath)) {
        try {
          fs.renameSync(tmpPath, this.dbPath)
        } catch {
          // On Windows, if target exists and is briefly locked, unlink and rename
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
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    if (this.db) {
      this.persist()
      this.db.close()
      this.db = null
    }
  }
}

export const databaseService = new DatabaseService()
