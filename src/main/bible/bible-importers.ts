import { Database, SqlJsStatic } from 'sql.js'
import { BibleBook, BibleVerse } from '../../shared/types'
import { BIBLE_BOOKS, resolveBibleBook } from '../../shared/bible-reference-parser'

export interface ParsedBibleImport {
  name: string
  abbrev: string
  language: string
  copyright: string
  licenseNotice: string
  isPublicDomain: boolean
  verses: BibleVerse[]
}

export interface BibleImportValidationSummary {
  success: boolean
  name: string
  abbrev: string
  language: string
  copyright: string
  licenseNotice: string
  bookCount: number
  verseCount: number
  missingBooks: string[]
  sampleVerses: {
    reference: string
    text: string
  }[]
}

export function cleanXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '') // strip any internal XML/HTML formatting tags
    .trim()
}

/**
 * Validates parsed Bible data and extracts sample verses for user verification.
 */
export function validateBibleData(parsed: ParsedBibleImport): BibleImportValidationSummary {
  const distinctBooks = new Set<number>()
  for (const v of parsed.verses) {
    distinctBooks.add(v.bookNumber)
  }

  const missingBooks: string[] = []
  for (const b of BIBLE_BOOKS) {
    if (!distinctBooks.has(b.number)) {
      missingBooks.push(b.name)
    }
  }

  // Key sample verses for visual verification: Génesis 1:1, Salmos 23:1, Juan 3:16
  const targetSamples = [
    { label: 'Génesis 1:1', bookNumber: 1, chapter: 1, verse: 1 },
    { label: 'Salmos 23:1', bookNumber: 19, chapter: 23, verse: 1 },
    { label: 'Juan 3:16', bookNumber: 43, chapter: 3, verse: 16 }
  ]

  const sampleVerses: { reference: string; text: string }[] = []
  for (const target of targetSamples) {
    const found = parsed.verses.find(
      (v) => v.bookNumber === target.bookNumber && v.chapter === target.chapter && v.verse === target.verse
    )
    if (found) {
      sampleVerses.push({
        reference: target.label,
        text: found.text
      })
    } else {
      sampleVerses.push({
        reference: target.label,
        text: '(No disponible en esta traducción)'
      })
    }
  }

  return {
    success: parsed.verses.length > 0,
    name: parsed.name,
    abbrev: parsed.abbrev,
    language: parsed.language,
    copyright: parsed.copyright,
    licenseNotice: parsed.licenseNotice,
    bookCount: distinctBooks.size,
    verseCount: parsed.verses.length,
    missingBooks,
    sampleVerses
  }
}

/**
 * Universal JSON Format Importer:
 * Supports:
 * 1. ChurchPresenter standard format: { books: [{ number, name, chapters: [{ chapter, verses: [{ verse, text }] }] }] }
 * 2. Generic Format A: { books: [{ name: "Genesis", chapters: [["v1", "v2"]] }] } or array of books [{ name, chapters: [...] }]
 * 3. Generic Format B: Flat verses array [{ book, chapter, verse, text }] or { verses: [...] }
 * 4. Generic Format C: Dictionary format { "Genesis": { "1": { "1": "text" } } } or { "Genesis": [["v1", "v2"]] }
 */
export function parseJsonBible(rawJson: string): ParsedBibleImport {
  let parsed: any
  try {
    parsed = JSON.parse(rawJson)
  } catch (err: any) {
    throw new Error(`Error de sintaxis JSON en archivo bíblico: ${err.message}`)
  }

  const verses: BibleVerse[] = []
  const name = parsed.name || parsed.title || 'Biblia Importada'
  const abbrev = (parsed.abbrev || parsed.short_name || 'BIB').toUpperCase().substring(0, 10)
  const language = parsed.language || parsed.lang || 'es'
  const copyright = parsed.copyright || 'No especificado'
  const licenseNotice = parsed.licenseNotice || 'Texto importado por el usuario'
  const isPublicDomain = Boolean(parsed.isPublicDomain)

  // Helper to resolve book obj or fallback
  const resolveBook = (rawBook: any): { bookNumber: number; bookName: string } => {
    if (typeof rawBook === 'number' && rawBook >= 1 && rawBook <= 66) {
      const bObj = BIBLE_BOOKS.find((bk) => bk.number === rawBook)
      return { bookNumber: rawBook, bookName: bObj ? bObj.name : `Libro ${rawBook}` }
    }
    const str = String(rawBook || '').trim()
    const bObj = resolveBibleBook(str)
    if (bObj) return { bookNumber: bObj.number, bookName: bObj.name }
    const num = parseInt(str, 10)
    if (!isNaN(num) && num >= 1 && num <= 66) {
      const bByNum = BIBLE_BOOKS.find((bk) => bk.number === num)
      return { bookNumber: num, bookName: bByNum ? bByNum.name : `Libro ${num}` }
    }
    return { bookNumber: 1, bookName: str || 'Libro' }
  }

  // CASE 1: Flat verses array: [{ book, chapter, verse, text }] or { verses: [...] }
  const flatVerses = Array.isArray(parsed) && parsed.length > 0 && (parsed[0].verse !== undefined || parsed[0].v !== undefined)
    ? parsed
    : Array.isArray(parsed.verses)
      ? parsed.verses
      : null

  if (flatVerses) {
    for (const item of flatVerses) {
      const { bookNumber, bookName } = resolveBook(item.book ?? item.bookNumber ?? item.b ?? item.book_number ?? 1)
      const chapter = Number(item.chapter ?? item.c ?? item.chapter_number ?? 1)
      const verse = Number(item.verse ?? item.v ?? item.verse_number ?? 1)
      const text = String(item.text ?? item.content ?? item.words ?? '').trim()
      if (text) {
        verses.push({
          bookNumber,
          bookName,
          chapter,
          verse,
          text,
          translationAbbrev: abbrev
        })
      }
    }
  }

  // CASE 2: Books array: parsed.books or directly parsed as array of books
  const booksArray = !flatVerses && Array.isArray(parsed.books)
    ? parsed.books
    : !flatVerses && Array.isArray(parsed) && parsed.length > 0 && (parsed[0].chapters || parsed[0].name)
      ? parsed
      : null

  if (booksArray) {
    for (let bIndex = 0; bIndex < booksArray.length; bIndex++) {
      const b = booksArray[bIndex]
      const { bookNumber, bookName } = resolveBook(b.number ?? b.bookNumber ?? b.name ?? bIndex + 1)

      if (!b.chapters) continue

      if (Array.isArray(b.chapters)) {
        for (let cIndex = 0; cIndex < b.chapters.length; cIndex++) {
          const c = b.chapters[cIndex]

          // Subcase 2A: chapter is array of string verses: [["v1", "v2"], ...]
          if (Array.isArray(c)) {
            const chapterNum = cIndex + 1
            for (let vIndex = 0; vIndex < c.length; vIndex++) {
              const text = String(c[vIndex] || '').trim()
              if (text) {
                verses.push({
                  bookNumber,
                  bookName,
                  chapter: chapterNum,
                  verse: vIndex + 1,
                  text,
                  translationAbbrev: abbrev
                })
              }
            }
          }
          // Subcase 2B: chapter is object { chapter: 1, verses: [...] }
          else if (c && typeof c === 'object') {
            const chapterNum = Number(c.chapter ?? c.c ?? cIndex + 1)
            const rawVerses = c.verses ?? c.v ?? []

            if (Array.isArray(rawVerses)) {
              for (let vIndex = 0; vIndex < rawVerses.length; vIndex++) {
                const v = rawVerses[vIndex]
                if (typeof v === 'string') {
                  const text = v.trim()
                  if (text) {
                    verses.push({
                      bookNumber,
                      bookName,
                      chapter: chapterNum,
                      verse: vIndex + 1,
                      text,
                      translationAbbrev: abbrev
                    })
                  }
                } else if (v && typeof v === 'object') {
                  const verseNum = Number(v.verse ?? v.v ?? vIndex + 1)
                  const text = String(v.text ?? v.content ?? v.words ?? '').trim()
                  if (text) {
                    verses.push({
                      bookNumber,
                      bookName,
                      chapter: chapterNum,
                      verse: verseNum,
                      text,
                      translationAbbrev: abbrev
                    })
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // CASE 3: Dictionary keyed by book names: { "Génesis": { "1": { "1": "..." } } } or { "Genesis": [["v1", "v2"]] }
  if (verses.length === 0 && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [bookKey, bookVal] of Object.entries(parsed)) {
      if (['name', 'abbrev', 'title', 'language', 'lang', 'copyright', 'licenseNotice', 'isPublicDomain', 'version'].includes(bookKey)) {
        continue
      }
      const { bookNumber, bookName } = resolveBook(bookKey)

      if (Array.isArray(bookVal)) {
        // Chapters as array of verse strings
        for (let cIndex = 0; cIndex < bookVal.length; cIndex++) {
          const chapArray = bookVal[cIndex]
          if (Array.isArray(chapArray)) {
            for (let vIndex = 0; vIndex < chapArray.length; vIndex++) {
              const text = String(chapArray[vIndex] || '').trim()
              if (text) {
                verses.push({
                  bookNumber,
                  bookName,
                  chapter: cIndex + 1,
                  verse: vIndex + 1,
                  text,
                  translationAbbrev: abbrev
                })
              }
            }
          }
        }
      } else if (bookVal && typeof bookVal === 'object') {
        // Chapters as object keys { "1": { "1": "..." } }
        for (const [chapKey, chapVal] of Object.entries(bookVal as Record<string, any>)) {
          const chapterNum = parseInt(chapKey, 10) || 1
          if (Array.isArray(chapVal)) {
            for (let vIndex = 0; vIndex < chapVal.length; vIndex++) {
              const text = String(chapVal[vIndex] || '').trim()
              if (text) {
                verses.push({
                  bookNumber,
                  bookName,
                  chapter: chapterNum,
                  verse: vIndex + 1,
                  text,
                  translationAbbrev: abbrev
                })
              }
            }
          } else if (chapVal && typeof chapVal === 'object') {
            for (const [verseKey, verseText] of Object.entries(chapVal as Record<string, any>)) {
              const verseNum = parseInt(verseKey, 10) || 1
              const text = String(verseText || '').trim()
              if (text) {
                verses.push({
                  bookNumber,
                  bookName,
                  chapter: chapterNum,
                  verse: verseNum,
                  text,
                  translationAbbrev: abbrev
                })
              }
            }
          }
        }
      }
    }
  }

  if (verses.length === 0) {
    throw new Error('El archivo JSON no contiene una estructura bíblica reconocible (se admiten books[], versículos planos o diccionario de libros).')
  }

  return {
    name,
    abbrev,
    language,
    copyright,
    licenseNotice,
    isPublicDomain,
    verses
  }
}

/**
 * SQLite Database Importer (.sqlite, .db, .bible)
 * Intelligently inspects database schema, discovers verse and metadata tables,
 * maps columns automatically and extracts verses without crashing.
 */
export function parseSqliteBible(
  buffer: Buffer | Uint8Array,
  SQL: SqlJsStatic,
  metaOverrides?: Partial<ParsedBibleImport>
): ParsedBibleImport {
  let db: Database | null = null
  try {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
    db = new SQL.Database(uint8)

    // 1. Discover tables in SQLite database
    const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    if (tablesRes.length === 0 || tablesRes[0].values.length === 0) {
      throw new Error('La base de datos SQLite no contiene tablas de datos.')
    }

    const tableNames = tablesRes[0].values.map((v) => String(v[0]))

    // 2. Extract metadata if available (metadata, info, details, config)
    let metaName = metaOverrides?.name || ''
    let metaAbbrev = metaOverrides?.abbrev || ''
    let metaLang = metaOverrides?.language || 'es'
    let metaCopyright = metaOverrides?.copyright || 'Dominio Público'

    const metaTable = tableNames.find((t) => /^(metadata|info|details|config|bible_version)$/i.test(t))
    if (metaTable) {
      try {
        const metaRows = db.exec(`SELECT * FROM "${metaTable}";`)
        if (metaRows.length > 0 && metaRows[0].values.length > 0) {
          const cols = metaRows[0].columns.map((c) => c.toLowerCase())
          // Key-Value structure
          if (cols.includes('key') && cols.includes('value')) {
            const keyIdx = cols.indexOf('key')
            const valIdx = cols.indexOf('value')
            for (const row of metaRows[0].values) {
              const k = String(row[keyIdx]).toLowerCase()
              const val = String(row[valIdx])
              if (!metaName && (k === 'name' || k === 'title')) metaName = val
              if (!metaAbbrev && (k === 'abbrev' || k === 'short_name' || k === 'id')) metaAbbrev = val
              if (k === 'language' || k === 'lang') metaLang = val
              if (k === 'copyright') metaCopyright = val
            }
          } else {
            // Row-based metadata
            const firstRow = metaRows[0].values[0]
            cols.forEach((col, idx) => {
              const val = String(firstRow[idx] || '')
              if (!metaName && (col.includes('name') || col.includes('title'))) metaName = val
              if (!metaAbbrev && (col.includes('abbrev') || col.includes('short'))) metaAbbrev = val
              if (col.includes('lang')) metaLang = val
              if (col.includes('copyright')) metaCopyright = val
            })
          }
        }
      } catch {
        // Continue with defaults if metadata query fails
      }
    }

    // 3. Locate verses table
    // Priority check for known standard table names
    let verseTable = tableNames.find((t) => /^(verses|verse|bible|scripture|content|words|verse_list|tbl_verse)$/i.test(t))

    let bookCol = ''
    let chapCol = ''
    let verseCol = ''
    let textCol = ''

    // Helper to test if a table has book, chapter, verse, and text columns
    const inspectTableColumns = (tName: string): boolean => {
      try {
        const colRes = db!.exec(`PRAGMA table_info("${tName}");`)
        if (colRes.length === 0) return false
        const cols = colRes[0].values.map((v) => String(v[1]).toLowerCase())

        const bCol = cols.find((c) => /^(book.*|id_book|b_?num.*|b_?id|bk|b|libro.*)$/i.test(c))
        const cCol = cols.find((c) => /^(chap.*|c_?num.*|c_?id|c|cap.*)$/i.test(c))
        const vCol = cols.find((c) => /^(verse.*|v_?num.*|v_?id|vers.*|v)$/i.test(c))
        const tCol = cols.find((c) => /^(verse_text|scripture_text|body_text|text.*|content.*|body.*|words.*|scripture.*|t|texto.*)$/i.test(c))

        if (bCol && cCol && vCol && tCol) {
          bookCol = bCol
          chapCol = cCol
          verseCol = vCol
          textCol = tCol
          return true
        }
      } catch {
        return false
      }
      return false
    }

    if (verseTable && inspectTableColumns(verseTable)) {
      // Confirmed standard table
    } else {
      // Search all tables in DB
      for (const t of tableNames) {
        if (inspectTableColumns(t)) {
          verseTable = t
          break
        }
      }
    }

    if (!verseTable || !bookCol || !chapCol || !verseCol || !textCol) {
      throw new Error(
        `No se pudo detectar la tabla de versículos en la base de datos SQLite. Tablas encontradas: ${tableNames.join(', ')}.`
      )
    }

    // 4. Query all verses
    const versesQuery = `SELECT "${bookCol}", "${chapCol}", "${verseCol}", "${textCol}" FROM "${verseTable}" ORDER BY rowid ASC;`
    const versesRes = db.exec(versesQuery)

    if (versesRes.length === 0 || versesRes[0].values.length === 0) {
      throw new Error(`La tabla "${verseTable}" no contiene filas de versículos.`)
    }

    const name = metaName || metaOverrides?.name || 'Biblia SQLite Importada'
    const abbrev = (metaAbbrev || metaOverrides?.abbrev || name.substring(0, 8)).toUpperCase()
    const verses: BibleVerse[] = []

    for (const row of versesRes[0].values) {
      const rawBook = row[0]
      const rawChap = row[1]
      const rawVerse = row[2]
      const rawText = row[3]

      let bookNumber = 1
      let bookName = 'Génesis'

      if (typeof rawBook === 'number' && rawBook >= 1 && rawBook <= 66) {
        bookNumber = rawBook
        const bObj = BIBLE_BOOKS.find((b) => b.number === bookNumber)
        bookName = bObj ? bObj.name : `Libro ${bookNumber}`
      } else {
        const bookObj = resolveBibleBook(String(rawBook || ''))
        if (bookObj) {
          bookNumber = bookObj.number
          bookName = bookObj.name
        } else {
          const num = parseInt(String(rawBook), 10)
          if (!isNaN(num) && num >= 1 && num <= 66) {
            bookNumber = num
            const bByNum = BIBLE_BOOKS.find((b) => b.number === num)
            bookName = bByNum ? bByNum.name : `Libro ${num}`
          }
        }
      }

      const chapter = parseInt(String(rawChap), 10) || 1
      const verseNum = parseInt(String(rawVerse), 10) || 1
      const text = cleanXmlEntities(String(rawText || '')).trim()

      if (text) {
        verses.push({
          bookNumber,
          bookName,
          chapter,
          verse: verseNum,
          text,
          translationAbbrev: abbrev
        })
      }
    }

    if (verses.length === 0) {
      throw new Error('No se extrajo ningún versículo válido de la base de datos SQLite.')
    }

    return {
      name,
      abbrev,
      language: metaLang,
      copyright: metaCopyright,
      licenseNotice: metaOverrides?.licenseNotice || 'Importado desde base de datos SQLite',
      isPublicDomain: true,
      verses
    }
  } finally {
    if (db) {
      try {
        db.close()
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Zefania XML & Standard Bible XML Format Importer
 * Supported standards:
 * 1. Zefania XML: <BIBLEBOOK bnumber="..."> <CHAPTER cnumber="..."> <VERS vnumber="...">
 * 2. Standard Bible XML / YouVersion / OpenSong: <bible translation="..."> <book number="..."> <chapter number="..."> <verse number="...">
 */
export function parseZefaniaXml(xmlContent: string): ParsedBibleImport {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Contenido XML vacío o inválido.')
  }

  const verses: BibleVerse[] = []

  // Extract Bible metadata from root or header tags
  const nameMatch =
    xmlContent.match(/translation=["']([^"']+)["']/i) ||
    xmlContent.match(/biblename=["']([^"']+)["']/i) ||
    xmlContent.match(/<title>([^<]+)<\/title>/i)

  let name = nameMatch ? nameMatch[1].trim() : 'Biblia XML'
  // Clean translation name if it contains descriptive notes in parentheses
  if (name.includes('(Más información')) {
    name = name.split('(Más información')[0].trim()
  }

  const statusMatch = xmlContent.match(/status=["']([^"']+)["']/i) || xmlContent.match(/copyright=["']([^"']+)["']/i)
  const copyright = statusMatch ? statusMatch[1].trim() : 'Dominio Público'

  // Determine abbreviation
  let abbrev = ''
  if (/RVR\s*1960|Reina[- ]Valera\s*1960/i.test(name) || /RVR1960/i.test(xmlContent.substring(0, 500))) {
    abbrev = 'RVR60'
  } else if (/RVA\s*2015|Reina[- ]Valera\s*Actualizada/i.test(name) || /RVA2015/i.test(xmlContent.substring(0, 500))) {
    abbrev = 'RVA15'
  } else {
    abbrev = name.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase() || 'BIBLIA'
  }

  // Dialect A: Zefania XML (<BIBLEBOOK>)
  const isZefania = /<BIBLEBOOK[\s>]/i.test(xmlContent)
  // Dialect B: Standard Bible XML (<book>)
  const isStandardXml = /<book[\s>]/i.test(xmlContent)

  if (isZefania) {
    const bookRegex = /<BIBLEBOOK\s+[^>]*bnumber=["'](\d+)["'][^>]*>([\s\S]*?)<\/BIBLEBOOK>/gi
    let bookMatch: RegExpExecArray | null

    while ((bookMatch = bookRegex.exec(xmlContent)) !== null) {
      const bookNumber = parseInt(bookMatch[1], 10)
      const bookContent = bookMatch[2]
      const bookObj = BIBLE_BOOKS.find((b) => b.number === bookNumber)
      const bookName = bookObj ? bookObj.name : `Libro ${bookNumber}`

      const chapRegex = /<CHAPTER\s+[^>]*cnumber=["'](\d+)["'][^>]*>([\s\S]*?)<\/CHAPTER>/gi
      let chapMatch: RegExpExecArray | null

      while ((chapMatch = chapRegex.exec(bookContent)) !== null) {
        const chapter = parseInt(chapMatch[1], 10)
        const chapContent = chapMatch[2]

        const verseRegex = /<VERS\s+[^>]*vnumber=["'](\d+)["'][^>]*>([\s\S]*?)<\/VERS>/gi
        let verseMatch: RegExpExecArray | null

        while ((verseMatch = verseRegex.exec(chapContent)) !== null) {
          const verseNum = parseInt(verseMatch[1], 10)
          const text = cleanXmlEntities(verseMatch[2])

          if (text) {
            verses.push({
              bookNumber,
              bookName,
              chapter,
              verse: verseNum,
              text,
              translationAbbrev: abbrev
            })
          }
        }
      }
    }
  } else if (isStandardXml) {
    const bookRegex = /<book\s+[^>]*(?:number|id|bnumber)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/book>/gi
    let bookMatch: RegExpExecArray | null

    while ((bookMatch = bookRegex.exec(xmlContent)) !== null) {
      const rawBookId = bookMatch[1].trim()
      let bookNumber = parseInt(rawBookId, 10)
      let bookObj: BibleBook | null | undefined = !isNaN(bookNumber) && bookNumber >= 1 && bookNumber <= 66
        ? BIBLE_BOOKS.find((b) => b.number === bookNumber)
        : null

      if (!bookObj) {
        bookObj = resolveBibleBook(rawBookId)
        if (bookObj) {
          bookNumber = bookObj.number
        }
      }

      if (!bookObj && (!bookNumber || isNaN(bookNumber))) {
        continue
      }

      const bookName = bookObj ? bookObj.name : `Libro ${bookNumber}`
      const bookContent = bookMatch[2]

      const chapRegex = /<chapter\s+[^>]*(?:number|cnumber)=["'](\d+)["'][^>]*>([\s\S]*?)<\/chapter>/gi
      let chapMatch: RegExpExecArray | null

      while ((chapMatch = chapRegex.exec(bookContent)) !== null) {
        const chapter = parseInt(chapMatch[1], 10)
        const chapContent = chapMatch[2]

        const verseRegex = /<verse\s+[^>]*(?:number|vnumber)=["'](\d+)["'][^>]*>([\s\S]*?)<\/verse>/gi
        let verseMatch: RegExpExecArray | null

        while ((verseMatch = verseRegex.exec(chapContent)) !== null) {
          const verseNum = parseInt(verseMatch[1], 10)
          const text = cleanXmlEntities(verseMatch[2])

          if (text) {
            verses.push({
              bookNumber,
              bookName,
              chapter,
              verse: verseNum,
              text,
              translationAbbrev: abbrev
            })
          }
        }
      }
    }
  }

  if (verses.length === 0) {
    throw new Error('El archivo Zefania XML no contiene elementos BIBLEBOOK/CHAPTER/VERS válidos.')
  }

  return {
    name,
    abbrev,
    language: 'es',
    copyright,
    licenseNotice: isZefania ? 'Importado desde Zefania XML' : 'Importado desde Bible XML',
    isPublicDomain: true,
    verses
  }
}

/**
 * OSIS XML (Open Scriptural Information Standard) Importer
 */
export function parseOsisXml(xmlContent: string): ParsedBibleImport {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Contenido OSIS vacío o inválido.')
  }

  const verses: BibleVerse[] = []

  // Extract title
  const titleMatch = xmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
  const name = titleMatch ? titleMatch[1].trim() : 'Biblia OSIS'
  const abbrev = name.substring(0, 8).toUpperCase()

  // Match verses with osisID attribute: e.g. osisID="Gen.1.1" or osisID="Matt.3.16"
  const verseRegex = /<verse\s+[^>]*osisID=["']([A-Za-z0-9]+)\.(\d+)\.(\d+)["'][^>]*>([\s\S]*?)<\/verse>/gi
  let match: RegExpExecArray | null

  while ((match = verseRegex.exec(xmlContent)) !== null) {
    const osisBook = match[1]
    const chapter = parseInt(match[2], 10)
    const verseNum = parseInt(match[3], 10)
    const rawText = match[4]
    const text = cleanXmlEntities(rawText)

    const bookObj = resolveBibleBook(osisBook)
    const bookNumber = bookObj ? bookObj.number : 1
    const bookName = bookObj ? bookObj.name : osisBook

    if (text) {
      verses.push({
        bookNumber,
        bookName,
        chapter,
        verse: verseNum,
        text,
        translationAbbrev: abbrev
      })
    }
  }

  if (verses.length === 0) {
    throw new Error('No se encontraron versículos en formato OSIS XML (osisID="Book.Chap.Verse").')
  }

  return {
    name,
    abbrev,
    language: 'es',
    copyright: 'Dominio Público',
    licenseNotice: 'Importado desde formato OSIS XML',
    isPublicDomain: true,
    verses
  }
}

/**
 * USFM (Unified Standard Format Markers) Importer
 * Standard format used by Paratext and Bible translation teams worldwide.
 */
export function parseUsfm(rawUsfm: string): ParsedBibleImport {
  if (!rawUsfm || typeof rawUsfm !== 'string') {
    throw new Error('Contenido USFM vacío o inválido.')
  }

  const lines = rawUsfm.split(/\r?\n/)
  const verses: BibleVerse[] = []

  let currentBookObj: BibleBook | null = null
  let currentChapter = 1
  let translationName = 'Biblia USFM'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // \id GEN Genesis
    if (line.startsWith('\\id')) {
      const parts = line.split(/\s+/)
      const bookCode = parts[1] || ''
      currentBookObj = resolveBibleBook(bookCode)
    } else if (line.startsWith('\\h ') || line.startsWith('\\toc1 ')) {
      translationName = line.substring(line.indexOf(' ')).trim()
    } else if (line.startsWith('\\c ')) {
      const cParts = line.split(/\s+/)
      currentChapter = parseInt(cParts[1], 10) || 1
    } else if (line.startsWith('\\v ')) {
      // \v 1 En el principio...
      const vMatch = line.match(/^\\v\s+(\d+)\s+(.*)$/)
      if (vMatch) {
        const verseNum = parseInt(vMatch[1], 10)
        let vText = vMatch[2]

        // Strip internal USFM markers like \wj, \f...\f*, \add...\add*, etc.
        vText = vText
          .replace(/\\[a-z0-9*]+\b/g, '')
          .replace(/[{}]/g, '')
          .trim()

        const bookNumber = currentBookObj ? currentBookObj.number : 1
        const bookName = currentBookObj ? currentBookObj.name : 'Génesis'

        if (vText) {
          verses.push({
            bookNumber,
            bookName,
            chapter: currentChapter,
            verse: verseNum,
            text: vText,
            translationAbbrev: 'USFM'
          })
        }
      }
    }
  }

  if (verses.length === 0) {
    throw new Error('El archivo USFM no contiene marcas válidas de capítulos (\\c) y versículos (\\v).')
  }

  return {
    name: translationName,
    abbrev: 'USFM',
    language: 'es',
    copyright: 'Dominio Público',
    licenseNotice: 'Importado desde formato USFM',
    isPublicDomain: true,
    verses
  }
}
