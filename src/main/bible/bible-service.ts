import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import {
  BibleImportResult,
  BibleReferenceParsed,
  BibleSearchResult,
  BibleTranslationMeta,
  BibleVerse
} from '../../shared/types'
import { BIBLE_BOOKS, parseBibleReference } from '../../shared/bible-reference-parser'
import { normalizeForSearch } from '../../shared/search-utils'
import {
  parseJsonBible,
  parseOsisXml,
  parseUsfm,
  parseZefaniaXml,
  parseSqliteBible,
  validateBibleData,
  ParsedBibleImport
} from './bible-importers'
import { databaseService } from '../db/database-service'
import { logger } from '../logger'

export class BibleService {
  private biblesDir: string = ''
  private factoryDir: string = ''
  private openDbs: Map<string, Database> = new Map()
  private SQL: SqlJsStatic | null = null

  constructor(customBiblesDir?: string) {
    if (customBiblesDir) {
      this.biblesDir = customBiblesDir
    } else {
      try {
        const userData = app.getPath('userData')
        this.biblesDir = path.join(userData, 'bibles')
      } catch {
        this.biblesDir = path.resolve(process.cwd(), 'bibles')
      }
    }

    // Resolve factory bibles location across dev, tests, and packaged production
    const candidateDirs = [
      path.join((process as any).resourcesPath || '', 'bibles'),
      path.join((process as any).resourcesPath || '', 'resources', 'bibles'),
      path.resolve(__dirname, '../../resources/bibles'),
      path.resolve(process.cwd(), 'resources', 'bibles')
    ]
    this.factoryDir = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[2]

    if (!fs.existsSync(this.biblesDir)) {
      fs.mkdirSync(this.biblesDir, { recursive: true })
    }
  }

  public async initialize(): Promise<void> {
    if (!this.SQL) {
      this.SQL = await initSqlJs()
    }

    // Copy factory bibles (RVR1909 and KJV) to biblesDir if not yet present
    if (fs.existsSync(this.factoryDir)) {
      const factoryFiles = fs.readdirSync(this.factoryDir).filter((f) => f.endsWith('.bible'))
      for (const file of factoryFiles) {
        const dest = path.join(this.biblesDir, file)
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(path.join(this.factoryDir, file), dest)
          logger.info(`Installed factory Bible translation: ${file}`)
        }
      }
    }
  }

  private async getSqlInstance(): Promise<SqlJsStatic> {
    if (!this.SQL) {
      this.SQL = await initSqlJs()
    }
    return this.SQL
  }

  /**
   * Opens or returns the cached SQLite database instance for a translation.
   * Opened on demand and kept in memory while in use.
   */
  public async getTranslationDb(abbrev: string): Promise<{ db: Database; meta: BibleTranslationMeta } | null> {
    const cleanAbbrev = abbrev.toUpperCase().trim()
    const translations = await this.getTranslations()
    const meta = translations.find((t) => t.abbrev.toUpperCase() === cleanAbbrev)
    if (!meta) return null

    if (this.openDbs.has(cleanAbbrev)) {
      return { db: this.openDbs.get(cleanAbbrev)!, meta }
    }

    if (!fs.existsSync(meta.filePath)) {
      logger.error(`Bible file does not exist: ${meta.filePath}`)
      return null
    }

    const SQL = await this.getSqlInstance()
    const buf = fs.readFileSync(meta.filePath)
    const db = new SQL.Database(new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
    this.openDbs.set(cleanAbbrev, db)
    return { db, meta }
  }

  /**
   * Lists all installed Bible translations by scanning the bibles/ directory.
   */
  public async getTranslations(): Promise<BibleTranslationMeta[]> {
    if (!fs.existsSync(this.biblesDir)) return []
    const files = fs.readdirSync(this.biblesDir).filter((f) => f.endsWith('.bible') || f.endsWith('.sqlite'))
    const translations: BibleTranslationMeta[] = []
    const SQL = await this.getSqlInstance()

    const defaultAbbrev = (databaseService.getConfig('default_bible_abbrev', 'RVR1909') || 'RVR1909').toUpperCase()
    for (const file of files) {
      const filePath = path.join(this.biblesDir, file)
      try {
        const buf = fs.readFileSync(filePath)
        const db = new SQL.Database(new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
        const metaRows = db.exec('SELECT key, value FROM metadata;')
        const metaMap = new Map<string, string>()
        if (metaRows.length > 0) {
          for (const [k, v] of metaRows[0].values) {
            metaMap.set(String(k), String(v))
          }
        }

        const abbrev = metaMap.get('abbrev') || path.basename(file, path.extname(file))
        translations.push({
          id: metaMap.get('id') || `bible_${abbrev.toLowerCase()}`,
          name: metaMap.get('name') || abbrev,
          abbrev,
          language: metaMap.get('language') || 'es',
          copyright: metaMap.get('copyright') || 'Dominio Público',
          licenseNotice: metaMap.get('license_notice') || 'Texto de dominio público.',
          isPublicDomain: metaMap.get('is_public_domain') === '1',
          verseCount: parseInt(metaMap.get('verse_count') || '31102', 10),
          filePath,
          isDefault: abbrev.toUpperCase() === defaultAbbrev
        })
        db.close()
      } catch (err) {
        logger.error(`Error reading Bible metadata from ${filePath}:`, err)
      }
    }

    return translations
  }

  /**
   * Retrieves verses by parsed reference, with optional secondary translation for dual display.
   */
  public async getVersesByReference(
    referenceInput: string,
    translationAbbrev: string = 'RVR1909',
    secondaryAbbrev?: string
  ): Promise<{ parsed: BibleReferenceParsed; verses: BibleVerse[]; secondaryVerses?: BibleVerse[] }> {
    const parsed = parseBibleReference(referenceInput)
    if (!parsed) {
      throw new Error(`Referencia bíblica no válida o formato desconocido: "${referenceInput}"`)
    }

    const primaryDbResult = await this.getTranslationDb(translationAbbrev)
    if (!primaryDbResult) {
      throw new Error(`Traducción bíblica no encontrada: "${translationAbbrev}"`)
    }

    const { db: primaryDb, meta: primaryMeta } = primaryDbResult

    // Query primary verses
    const rows = primaryDb.exec(
      `SELECT book_number, chapter, verse, text
       FROM verses
       WHERE book_number = ?
         AND (
           (chapter = ? AND verse >= ?) OR (chapter > ?)
         )
         AND (
           (chapter = ? AND verse <= ?) OR (chapter < ?)
         )
       ORDER BY chapter ASC, verse ASC;`,
      [
        parsed.bookNumber,
        parsed.startChapter,
        parsed.startVerse,
        parsed.startChapter,
        parsed.endChapter,
        parsed.endVerse,
        parsed.endChapter
      ]
    )

    const verses: BibleVerse[] = (rows[0]?.values || []).map((row) => ({
      bookNumber: Number(row[0]),
      bookName: parsed.bookName,
      chapter: Number(row[1]),
      verse: Number(row[2]),
      text: String(row[3]).trim(),
      translationAbbrev: primaryMeta.abbrev
    }))

    // Query secondary verses if dual mode requested
    let secondaryVerses: BibleVerse[] | undefined = undefined
    if (secondaryAbbrev && secondaryAbbrev.trim().toUpperCase() !== translationAbbrev.trim().toUpperCase()) {
      const secDbResult = await this.getTranslationDb(secondaryAbbrev)
      if (secDbResult) {
        const secRows = secDbResult.db.exec(
          `SELECT book_number, chapter, verse, text
           FROM verses
           WHERE book_number = ?
             AND (
               (chapter = ? AND verse >= ?) OR (chapter > ?)
             )
             AND (
               (chapter = ? AND verse <= ?) OR (chapter < ?)
             )
           ORDER BY chapter ASC, verse ASC;`,
          [
            parsed.bookNumber,
            parsed.startChapter,
            parsed.startVerse,
            parsed.startChapter,
            parsed.endChapter,
            parsed.endVerse,
            parsed.endChapter
          ]
        )

        secondaryVerses = (secRows[0]?.values || []).map((row) => ({
          bookNumber: Number(row[0]),
          bookName: parsed.bookName,
          chapter: Number(row[1]),
          verse: Number(row[2]),
          text: String(row[3]).trim(),
          translationAbbrev: secDbResult.meta.abbrev
        }))
      }
    }

    return { parsed, verses, secondaryVerses }
  }

  /**
   * Case-insensitive, accent-insensitive full-text search with highlighting and filters.
   */
  public async searchBibleText(
    query: string,
    translationAbbrev: string = 'RVR1909',
    filter?: { bookNumber?: number; testament?: 'OT' | 'NT' }
  ): Promise<BibleSearchResult[]> {
    const normQuery = normalizeForSearch(query)
    if (!normQuery) return []

    const dbResult = await this.getTranslationDb(translationAbbrev)
    if (!dbResult) return []
    const { db, meta } = dbResult

    const queryWords = normQuery.split(/\s+/).filter((w) => w.length > 0)
    if (queryWords.length === 0) return []

    // Build query conditions
    const whereClauses: string[] = []
    const params: (number | string)[] = []

    for (const w of queryWords) {
      whereClauses.push('normalized_text LIKE ?')
      params.push(`%${w}%`)
    }

    if (filter?.bookNumber) {
      whereClauses.push('book_number = ?')
      params.push(filter.bookNumber)
    } else if (filter?.testament === 'OT') {
      whereClauses.push('book_number <= 39')
    } else if (filter?.testament === 'NT') {
      whereClauses.push('book_number >= 40')
    }

    const sql = `
      SELECT book_number, chapter, verse, text
      FROM verses
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY book_number ASC, chapter ASC, verse ASC
      LIMIT 80;
    `

    const rows = db.exec(sql, params)
    if (rows.length === 0) return []

    return rows[0].values.map((row) => {
      const bookNumber = Number(row[0])
      const chapter = Number(row[1])
      const verse = Number(row[2])
      const text = String(row[3]).trim()
      const bookObj = BIBLE_BOOKS.find((b) => b.number === bookNumber)
      const bookName = bookObj ? bookObj.name : `Libro ${bookNumber}`
      const formattedReference = `${bookName} ${chapter}:${verse}`

      // Highlight matched terms in text
      let highlightedText = text
      for (const w of queryWords) {
        if (w.length >= 2) {
          const reg = new RegExp(`(${w})`, 'gi')
          highlightedText = highlightedText.replace(reg, '<mark>$1</mark>')
        }
      }

      return {
        bookNumber,
        bookName,
        chapter,
        verse,
        text,
        translationAbbrev: meta.abbrev,
        highlightedText,
        formattedReference
      }
    })
  }

  /**
   * Imports a new Bible translation into its own standalone SQLite file.
   */
  public async importTranslation(
    format: 'zefania' | 'osis' | 'usfm' | 'json' | 'sqlite',
    rawContent: string | Buffer | Uint8Array,
    metaOverrides: Partial<BibleTranslationMeta> = {}
  ): Promise<BibleImportResult> {
    const SQL = await this.getSqlInstance()
    let parsed: ParsedBibleImport

    switch (format) {
      case 'json':
        parsed = parseJsonBible(typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8'))
        break
      case 'sqlite': {
        const buf = typeof rawContent === 'string' ? Buffer.from(rawContent, 'binary') : rawContent
        parsed = parseSqliteBible(buf, SQL, metaOverrides as any)
        break
      }
      case 'zefania':
        parsed = parseZefaniaXml(typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8'))
        break
      case 'osis':
        parsed = parseOsisXml(typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8'))
        break
      case 'usfm':
        parsed = parseUsfm(typeof rawContent === 'string' ? rawContent : rawContent.toString('utf-8'))
        break
      default:
        throw new Error(`Formato bíblico no soportado: ${format}`)
    }

    const name = metaOverrides.name || parsed.name
    const abbrev = (metaOverrides.abbrev || parsed.abbrev || 'CUSTOM').toUpperCase()
    const language = metaOverrides.language || parsed.language || 'es'
    const copyright = metaOverrides.copyright || parsed.copyright || 'No especificado'
    const licenseNotice = metaOverrides.licenseNotice || parsed.licenseNotice || 'Aviso de licencia'
    const isPublicDomain = metaOverrides.isPublicDomain ?? parsed.isPublicDomain

    const targetFileName = `${abbrev}.bible`
    const targetPath = path.join(this.biblesDir, targetFileName)

    const db = new SQL.Database()

    db.run(`
      CREATE TABLE metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE verses (
        id INTEGER PRIMARY KEY,
        book_number INTEGER NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        normalized_text TEXT NOT NULL
      );

      CREATE INDEX idx_book_chap_verse ON verses(book_number, chapter, verse);
      CREATE INDEX idx_norm_text ON verses(normalized_text);
      CREATE VIRTUAL TABLE verses_fts USING fts4(normalized_text);
    `)

    db.run('BEGIN TRANSACTION;')

    for (let i = 0; i < parsed.verses.length; i++) {
      const v = parsed.verses[i]
      const norm = normalizeForSearch(v.text)
      const verseId = v.bookNumber * 1000000 + v.chapter * 1000 + v.verse

      db.run(
        'INSERT INTO verses (id, book_number, chapter, verse, text, normalized_text) VALUES (?, ?, ?, ?, ?, ?);',
        [verseId, v.bookNumber, v.chapter, v.verse, v.text, norm]
      )
      db.run(
        'INSERT INTO verses_fts (rowid, normalized_text) VALUES (?, ?);',
        [verseId, norm]
      )
    }

    const metadataRows = [
      ['id', `bible_${abbrev.toLowerCase()}`],
      ['name', name],
      ['abbrev', abbrev],
      ['language', language],
      ['copyright', copyright],
      ['license_notice', licenseNotice],
      ['is_public_domain', isPublicDomain ? '1' : '0'],
      ['verse_count', String(parsed.verses.length)]
    ]

    for (const [k, val] of metadataRows) {
      db.run('INSERT INTO metadata (key, value) VALUES (?, ?);', [k, val])
    }

    db.run('COMMIT;')

    // Atomic write to disk
    const binary = db.export()
    const tmpPath = `${targetPath}.tmp`
    fs.writeFileSync(tmpPath, Buffer.from(binary))
    fs.renameSync(tmpPath, targetPath)

    db.close()
    logger.info(`Successfully imported translation ${name} (${abbrev}) with ${parsed.verses.length} verses.`)

    const validation = validateBibleData({
      ...parsed,
      name,
      abbrev,
      language,
      copyright,
      licenseNotice,
      isPublicDomain
    })

    const translation: BibleTranslationMeta = {
      id: `bible_${abbrev.toLowerCase()}`,
      name,
      abbrev,
      language,
      copyright,
      licenseNotice,
      isPublicDomain,
      verseCount: parsed.verses.length,
      filePath: targetPath
    }

    return {
      success: true,
      translation,
      bookCount: validation.bookCount,
      verseCount: validation.verseCount,
      missingBooks: validation.missingBooks,
      sampleVerses: validation.sampleVerses
    }
  }

  /**
   * Imports a translation directly from a file on disk, automatically detecting format.
   */
  public async importTranslationFromFile(
    filePath: string,
    metaOverrides: Partial<BibleTranslationMeta> = {}
  ): Promise<BibleImportResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo bíblico no existe: ${filePath}`)
    }

    const ext = path.extname(filePath).toLowerCase()
    let format: 'zefania' | 'osis' | 'usfm' | 'json' | 'sqlite' = 'json'

    if (ext === '.sqlite' || ext === '.db' || ext === '.bible') {
      format = 'sqlite'
      const buf = fs.readFileSync(filePath)
      return this.importTranslation(format, buf, metaOverrides)
    }

    if (ext === '.osis') {
      format = 'osis'
    } else if (ext === '.usfm') {
      format = 'usfm'
    } else if (ext === '.xml') {
      const sample = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).substring(0, 1000)
      if (sample.includes('<osis') || sample.includes('osisID=')) {
        format = 'osis'
      } else {
        format = 'zefania'
      }
    } else if (ext === '.txt') {
      const sample = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).substring(0, 1000)
      if (sample.includes('\\c') && sample.includes('\\v')) {
        format = 'usfm'
      } else {
        format = 'json'
      }
    } else {
      format = 'json'
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    return this.importTranslation(format, content, metaOverrides)
  }

  /**
   * Sets the user's preferred default Bible translation.
   */
  public async setDefaultTranslation(abbrev: string): Promise<boolean> {
    const cleanAbbrev = abbrev.toUpperCase().trim()
    databaseService.setConfig('default_bible_abbrev', cleanAbbrev)
    logger.info(`Set default Bible translation to: ${cleanAbbrev}`)
    return true
  }

  public async deleteTranslation(id: string): Promise<boolean> {
    const translations = await this.getTranslations()
    const found = translations.find((t) => t.id === id || t.abbrev === id)
    if (!found) return false

    const defaultAbbrev = (databaseService.getConfig('default_bible_abbrev', 'RVR1909') || 'RVR1909').toUpperCase()
    if (
      found.abbrev.toUpperCase() === 'RVR1909' ||
      found.abbrev.toUpperCase() === 'KJV' ||
      found.abbrev.toUpperCase() === defaultAbbrev
    ) {
      throw new Error(`No se puede eliminar la traducción de fábrica o predeterminada (${found.abbrev}).`)
    }

    // Close in-memory database if open
    if (this.openDbs.has(found.abbrev.toUpperCase())) {
      this.openDbs.get(found.abbrev.toUpperCase())?.close()
      this.openDbs.delete(found.abbrev.toUpperCase())
    }

    if (fs.existsSync(found.filePath)) {
      fs.unlinkSync(found.filePath)
    }

    logger.info(`Deleted Bible translation ${found.name} (${found.abbrev})`)
    return true
  }

  // --- FAVORITES & RECENT HISTORY (Stored in Main DB) ---

  public getFavorites(): string[] {
    const rows = databaseService.query('SELECT reference FROM bible_favorites ORDER BY created_at DESC;')
    return rows.map((r) => String(r.reference))
  }

  public toggleFavorite(reference: string): string[] {
    const cleanRef = reference.trim()
    const exists = databaseService.queryOne('SELECT reference FROM bible_favorites WHERE reference = ?;', [cleanRef])
    if (exists) {
      databaseService.run('DELETE FROM bible_favorites WHERE reference = ?;', [cleanRef])
    } else {
      databaseService.run('INSERT INTO bible_favorites (reference) VALUES (?);', [cleanRef])
    }
    return this.getFavorites()
  }

  public getRecentHistory(): string[] {
    const rows = databaseService.query('SELECT reference FROM bible_recent_history ORDER BY id DESC LIMIT 15;')
    return rows.map((r) => String(r.reference))
  }

  public addRecentHistory(reference: string): void {
    const cleanRef = reference.trim()
    databaseService.run('DELETE FROM bible_recent_history WHERE reference = ?;', [cleanRef])
    databaseService.run('INSERT INTO bible_recent_history (reference) VALUES (?);', [cleanRef])
  }
}

export const bibleService = new BibleService()
