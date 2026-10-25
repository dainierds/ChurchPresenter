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

function cleanXmlEntities(str: string): string {
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
 * Standard Simple JSON Format Importer
 */
export function parseJsonBible(rawJson: string): ParsedBibleImport {
  let parsed: any
  try {
    parsed = JSON.parse(rawJson)
  } catch (err: any) {
    throw new Error(`Error de sintaxis JSON en archivo bíblico: ${err.message}`)
  }

  if (!parsed.books || !Array.isArray(parsed.books)) {
    throw new Error('El archivo JSON no contiene el arreglo "books" requerido.')
  }

  const verses: BibleVerse[] = []
  const abbrev = parsed.abbrev || parsed.name || 'BIBLIA'

  for (const b of parsed.books) {
    const bookObj = BIBLE_BOOKS.find((bk) => bk.number === b.number) || resolveBibleBook(b.name || '')
    const bookNumber = bookObj ? bookObj.number : b.number || 1
    const bookName = bookObj ? bookObj.name : b.name || `Libro ${bookNumber}`

    if (!b.chapters || !Array.isArray(b.chapters)) continue

    for (const c of b.chapters) {
      const chapter = Number(c.chapter) || 1
      if (!c.verses || !Array.isArray(c.verses)) continue

      for (const v of c.verses) {
        const verseNum = Number(v.verse) || 1
        const text = String(v.text || '').trim()
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

  if (verses.length === 0) {
    throw new Error('El archivo JSON no contiene ningún versículo válido.')
  }

  return {
    name: parsed.name || 'Biblia Importada',
    abbrev: parsed.abbrev || 'BIB',
    language: parsed.language || 'es',
    copyright: parsed.copyright || 'No especificado',
    licenseNotice: parsed.licenseNotice || 'Texto importado por el usuario',
    isPublicDomain: Boolean(parsed.isPublicDomain),
    verses
  }
}

/**
 * Zefania XML Format Importer
 * Supported standard in OpenLP, Sword, and church projection tools.
 */
export function parseZefaniaXml(xmlContent: string): ParsedBibleImport {
  if (!xmlContent || typeof xmlContent !== 'string') {
    throw new Error('Contenido XML vacío o inválido.')
  }

  const verses: BibleVerse[] = []

  // Extract Bible metadata from root or header tags
  const nameMatch = xmlContent.match(/biblename=["']([^"']+)["']/i) || xmlContent.match(/<title>([^<]+)<\/title>/i)
  const name = nameMatch ? nameMatch[1].trim() : 'Biblia Zefania'
  const abbrev = name.substring(0, 10).toUpperCase()

  // Match each BIBLEBOOK tag
  const bookRegex = /<BIBLEBOOK\s+[^>]*bnumber=["'](\d+)["'][^>]*>([\s\S]*?)<\/BIBLEBOOK>/gi
  let bookMatch: RegExpExecArray | null

  while ((bookMatch = bookRegex.exec(xmlContent)) !== null) {
    const bookNumber = parseInt(bookMatch[1], 10)
    const bookContent = bookMatch[2]
    const bookObj = BIBLE_BOOKS.find((b) => b.number === bookNumber)
    const bookName = bookObj ? bookObj.name : `Libro ${bookNumber}`

    // Match each CHAPTER
    const chapRegex = /<CHAPTER\s+[^>]*cnumber=["'](\d+)["'][^>]*>([\s\S]*?)<\/CHAPTER>/gi
    let chapMatch: RegExpExecArray | null

    while ((chapMatch = chapRegex.exec(bookContent)) !== null) {
      const chapter = parseInt(chapMatch[1], 10)
      const chapContent = chapMatch[2]

      // Match each VERS
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

  if (verses.length === 0) {
    throw new Error('El archivo Zefania XML no contiene elementos BIBLEBOOK/CHAPTER/VERS válidos.')
  }

  return {
    name,
    abbrev,
    language: 'es',
    copyright: 'Dominio Público',
    licenseNotice: 'Importado desde Zefania XML',
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
