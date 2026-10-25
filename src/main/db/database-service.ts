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
          display_id INTEGER,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `)
    }
  }
]

export class DatabaseService {
  private db: Database | null = null
  private dbPath: string = ''
  private saveTimeout: NodeJS.Timeout | null = null

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath
    } else {
      try {
        const userData = app.getPath('userData')
        this.dbPath = path.join(userData, 'church_presenter.sqlite')
      } catch {
        this.dbPath = path.resolve(process.cwd(), 'church_presenter.sqlite')
      }
    }
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

      let SQL: SqlJsStatic
      if (fs.existsSync(wasmPath)) {
        const buf = fs.readFileSync(wasmPath)
        const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
        SQL = await initSqlJs({ wasmBinary })
      } else {
        SQL = await initSqlJs()
      }

      // Load from disk if exists
      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath)
        this.db = new SQL.Database(new Uint8Array(fileBuffer))
        logger.info(`Loaded existing SQLite database from ${this.dbPath}`)
      } else {
        this.db = new SQL.Database()
        logger.info(`Created fresh SQLite database at ${this.dbPath}`)
      }

      this.runMigrations()
      this.persist()
    } catch (err) {
      logger.error('Failed to initialize SQLite database:', err)
      throw err
    }
  }

  private runMigrations(): void {
    if (!this.db) return

    // Ensure migrations tracker table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `)

    // Get applied versions
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

  public getRoleAssignments(): Record<string, number | null> {
    if (!this.db) return {}
    const res = this.db.exec('SELECT role, display_id FROM role_assignments;')
    const assignments: Record<string, number | null> = {}
    if (res.length > 0 && res[0].values) {
      for (const [role, displayId] of res[0].values) {
        assignments[String(role)] = displayId !== null ? Number(displayId) : null
      }
    }
    return assignments
  }

  public setRoleAssignment(role: string, displayId: number | null): void {
    if (!this.db) return
    if (displayId === null) {
      this.db.run('DELETE FROM role_assignments WHERE role = ?;', [role])
    } else {
      this.db.run(
        `INSERT INTO role_assignments (role, display_id, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(role) DO UPDATE SET display_id = excluded.display_id, updated_at = datetime('now');`,
        [role, displayId]
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

  public persist(): void {
    if (!this.db) return
    try {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      const tmpPath = `${this.dbPath}.tmp`
      fs.writeFileSync(tmpPath, buffer)
      fs.renameSync(tmpPath, this.dbPath)
    } catch (err) {
      logger.error('Failed to persist SQLite database to disk:', err)
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
