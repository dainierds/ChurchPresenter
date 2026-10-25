import { BibleBook, BibleReferenceParsed } from './types'
import { normalizeForSearch } from './search-utils'

export const BIBLE_BOOKS: (BibleBook & { aliases: string[] })[] = [
  // Antiguo Testamento (Old Testament - 1 to 39)
  { number: 1, name: 'Génesis', englishName: 'Genesis', abbrev: 'Gén', testament: 'OT', chapterCount: 50, aliases: ['genesis', 'gen', 'gn', 'ge', 'génesis', 'gén'] },
  { number: 2, name: 'Éxodo', englishName: 'Exodus', abbrev: 'Éx', testament: 'OT', chapterCount: 40, aliases: ['exodo', 'exod', 'ex', 'exo', 'éxodo', 'éx'] },
  { number: 3, name: 'Levítico', englishName: 'Leviticus', abbrev: 'Lev', testament: 'OT', chapterCount: 27, aliases: ['levitico', 'lev', 'lv', 'levítico'] },
  { number: 4, name: 'Números', englishName: 'Numbers', abbrev: 'Núm', testament: 'OT', chapterCount: 36, aliases: ['numeros', 'num', 'nm', 'nb', 'números', 'núm'] },
  { number: 5, name: 'Deuteronomio', englishName: 'Deuteronomy', abbrev: 'Deut', testament: 'OT', chapterCount: 34, aliases: ['deuteronomio', 'deut', 'dt', 'deu'] },
  { number: 6, name: 'Josué', englishName: 'Joshua', abbrev: 'Jos', testament: 'OT', chapterCount: 24, aliases: ['josue', 'jos', 'jsh', 'josh', 'josué'] },
  { number: 7, name: 'Jueces', englishName: 'Judges', abbrev: 'Jue', testament: 'OT', chapterCount: 21, aliases: ['jueces', 'jue', 'jdg', 'judg', 'jc'] },
  { number: 8, name: 'Rut', englishName: 'Ruth', abbrev: 'Rut', testament: 'OT', chapterCount: 4, aliases: ['rut', 'rt', 'rth', 'ruth'] },
  { number: 9, name: '1 Samuel', englishName: '1 Samuel', abbrev: '1 S', testament: 'OT', chapterCount: 31, aliases: ['1 samuel', '1 sam', '1 s', '1sa', '1s', '1sam', 'i samuel', 'i sam', '1st samuel'] },
  { number: 10, name: '2 Samuel', englishName: '2 Samuel', abbrev: '2 S', testament: 'OT', chapterCount: 24, aliases: ['2 samuel', '2 sam', '2 s', '2sa', '2s', '2sam', 'ii samuel', 'ii sam', '2nd samuel'] },
  { number: 11, name: '1 Reyes', englishName: '1 Kings', abbrev: '1 R', testament: 'OT', chapterCount: 22, aliases: ['1 reyes', '1 rey', '1 r', '1ki', '1k', '1 k', '1 kings', '1kings', 'i reyes', '1reyes'] },
  { number: 12, name: '2 Reyes', englishName: '2 Kings', abbrev: '2 R', testament: 'OT', chapterCount: 25, aliases: ['2 reyes', '2 rey', '2 r', '2ki', '2k', '2 k', '2 kings', '2kings', 'ii reyes', '2reyes'] },
  { number: 13, name: '1 Crónicas', englishName: '1 Chronicles', abbrev: '1 Cr', testament: 'OT', chapterCount: 29, aliases: ['1 cronicas', '1 cron', '1 cr', '1ch', '1 ch', '1 chronicles', 'i cronicas', '1cronicas', '1 crónicas'] },
  { number: 14, name: '2 Crónicas', englishName: '2 Chronicles', abbrev: '2 Cr', testament: 'OT', chapterCount: 36, aliases: ['2 cronicas', '2 cron', '2 cr', '2ch', '2 ch', '2 chronicles', 'ii cronicas', '2cronicas', '2 crónicas'] },
  { number: 15, name: 'Esdras', englishName: 'Ezra', abbrev: 'Esd', testament: 'OT', chapterCount: 10, aliases: ['esdras', 'esd', 'ezr', 'ezra'] },
  { number: 16, name: 'Nehemías', englishName: 'Nehemiah', abbrev: 'Neh', testament: 'OT', chapterCount: 13, aliases: ['nehemias', 'neh', 'ne', 'nehemiah', 'nehemías'] },
  { number: 17, name: 'Ester', englishName: 'Esther', abbrev: 'Est', testament: 'OT', chapterCount: 10, aliases: ['ester', 'est', 'esth', 'esther'] },
  { number: 18, name: 'Job', englishName: 'Job', abbrev: 'Job', testament: 'OT', chapterCount: 42, aliases: ['job', 'jb'] },
  { number: 19, name: 'Salmos', englishName: 'Psalms', abbrev: 'Sal', testament: 'OT', chapterCount: 150, aliases: ['salmos', 'salmo', 'sal', 'psalms', 'psalm', 'psa', 'ps', 'sl'] },
  { number: 20, name: 'Proverbios', englishName: 'Proverbs', abbrev: 'Prov', testament: 'OT', chapterCount: 31, aliases: ['proverbios', 'proverbio', 'prov', 'prv', 'pro', 'pr', 'proverbs'] },
  { number: 21, name: 'Eclesiastés', englishName: 'Ecclesiastes', abbrev: 'Ecl', testament: 'OT', chapterCount: 12, aliases: ['eclesiastes', 'ecl', 'ec', 'ecc', 'eccles', 'ecclesiastes', 'eclesiastés'] },
  { number: 22, name: 'Cantares', englishName: 'Song of Solomon', abbrev: 'Cnt', testament: 'OT', chapterCount: 8, aliases: ['cantares', 'cantar', 'cnt', 'ct', 'cant', 'song of solomon', 'song', 'sos', 'cantar de los cantares'] },
  { number: 23, name: 'Isaías', englishName: 'Isaiah', abbrev: 'Is', testament: 'OT', chapterCount: 66, aliases: ['isaias', 'isa', 'is', 'isaiah', 'isaías'] },
  { number: 24, name: 'Jeremías', englishName: 'Jeremiah', abbrev: 'Jer', testament: 'OT', chapterCount: 52, aliases: ['jeremias', 'jer', 'jr', 'jeremiah', 'jeremías'] },
  { number: 25, name: 'Lamentaciones', englishName: 'Lamentations', abbrev: 'Lam', testament: 'OT', chapterCount: 5, aliases: ['lamentaciones', 'lam', 'lm', 'lamentations'] },
  { number: 26, name: 'Ezequiel', englishName: 'Ezekiel', abbrev: 'Ez', testament: 'OT', chapterCount: 48, aliases: ['ezequiel', 'ezeq', 'ezk', 'ez', 'ezekiel'] },
  { number: 27, name: 'Daniel', englishName: 'Daniel', abbrev: 'Dan', testament: 'OT', chapterCount: 12, aliases: ['daniel', 'dan', 'dn'] },
  { number: 28, name: 'Oseas', englishName: 'Hosea', abbrev: 'Os', testament: 'OT', chapterCount: 14, aliases: ['oseas', 'os', 'hos', 'hosea'] },
  { number: 29, name: 'Joel', englishName: 'Joel', abbrev: 'Jl', testament: 'OT', chapterCount: 3, aliases: ['joel', 'jl', 'jol'] },
  { number: 30, name: 'Amós', englishName: 'Amos', abbrev: 'Am', testament: 'OT', chapterCount: 9, aliases: ['amos', 'am', 'amo', 'amós'] },
  { number: 31, name: 'Abdías', englishName: 'Obadiah', abbrev: 'Abd', testament: 'OT', chapterCount: 1, aliases: ['abdias', 'abd', 'obad', 'oba', 'ob', 'obadiah', 'abdías'] },
  { number: 32, name: 'Jonás', englishName: 'Jonah', abbrev: 'Jon', testament: 'OT', chapterCount: 4, aliases: ['jonas', 'jon', 'jnh', 'jonah', 'jonás'] },
  { number: 33, name: 'Miqueas', englishName: 'Micah', abbrev: 'Miq', testament: 'OT', chapterCount: 7, aliases: ['miqueas', 'miq', 'mic', 'micah'] },
  { number: 34, name: 'Nahúm', englishName: 'Nahum', abbrev: 'Nah', testament: 'OT', chapterCount: 3, aliases: ['nahum', 'nah', 'na', 'nam', 'nahúm'] },
  { number: 35, name: 'Habacuc', englishName: 'Habakkuk', abbrev: 'Hab', testament: 'OT', chapterCount: 3, aliases: ['habacuc', 'hab', 'hb', 'habakkuk'] },
  { number: 36, name: 'Sofonías', englishName: 'Zephaniah', abbrev: 'Sof', testament: 'OT', chapterCount: 3, aliases: ['sofonias', 'sof', 'zep', 'zeph', 'zephaniah', 'sofonías'] },
  { number: 37, name: 'Hageo', englishName: 'Haggai', abbrev: 'Hag', testament: 'OT', chapterCount: 2, aliases: ['hageo', 'hag', 'hg', 'haggai'] },
  { number: 38, name: 'Zacarías', englishName: 'Zechariah', abbrev: 'Zac', testament: 'OT', chapterCount: 14, aliases: ['zacarias', 'zac', 'zec', 'zech', 'zechariah', 'zacarías'] },
  { number: 39, name: 'Malaquías', englishName: 'Malachi', abbrev: 'Mal', testament: 'OT', chapterCount: 4, aliases: ['malaquias', 'mal', 'ml', 'malachi', 'malaquías'] },

  // Nuevo Testamento (New Testament - 40 to 66)
  { number: 40, name: 'Mateo', englishName: 'Matthew', abbrev: 'Mt', testament: 'NT', chapterCount: 28, aliases: ['mateo', 'mat', 'mt', 'matt', 'matthew'] },
  { number: 41, name: 'Marcos', englishName: 'Mark', abbrev: 'Mc', testament: 'NT', chapterCount: 16, aliases: ['marcos', 'marc', 'mc', 'mrk', 'mk', 'mark'] },
  { number: 42, name: 'Lucas', englishName: 'Luke', abbrev: 'Lc', testament: 'NT', chapterCount: 24, aliases: ['lucas', 'luc', 'lc', 'lk', 'luk', 'luke'] },
  { number: 43, name: 'Juan', englishName: 'John', abbrev: 'Jn', testament: 'NT', chapterCount: 21, aliases: ['juan', 'jn', 'jhn', 'joh', 'john'] },
  { number: 44, name: 'Hechos', englishName: 'Acts', abbrev: 'Hch', testament: 'NT', chapterCount: 28, aliases: ['hechos', 'hch', 'hech', 'act', 'acts'] },
  { number: 45, name: 'Romanos', englishName: 'Romans', abbrev: 'Rom', testament: 'NT', chapterCount: 16, aliases: ['romanos', 'rom', 'ro', 'rm', 'romans'] },
  { number: 46, name: '1 Corintios', englishName: '1 Corinthians', abbrev: '1 Co', testament: 'NT', chapterCount: 16, aliases: ['1 corintios', '1 cor', '1 co', '1cor', '1co', '1corinthians', '1 corinthians', 'i corintios', '1corintios'] },
  { number: 47, name: '2 Corintios', englishName: '2 Corinthians', abbrev: '2 Co', testament: 'NT', chapterCount: 13, aliases: ['2 corintios', '2 cor', '2 co', '2cor', '2co', '2corinthians', '2 corinthians', 'ii corintios', '2corintios'] },
  { number: 48, name: 'Gálatas', englishName: 'Galatians', abbrev: 'Gál', testament: 'NT', chapterCount: 6, aliases: ['galatas', 'gal', 'ga', 'galatians', 'gálatas', 'gál'] },
  { number: 49, name: 'Efesios', englishName: 'Ephesians', abbrev: 'Ef', testament: 'NT', chapterCount: 6, aliases: ['efesios', 'efe', 'ef', 'eph', 'ephesians'] },
  { number: 50, name: 'Filipenses', englishName: 'Philippians', abbrev: 'Flp', testament: 'NT', chapterCount: 4, aliases: ['filipenses', 'flp', 'fil', 'php', 'phil', 'philippians'] },
  { number: 51, name: 'Colosenses', englishName: 'Colossians', abbrev: 'Col', testament: 'NT', chapterCount: 4, aliases: ['colosenses', 'col', 'cl', 'colossians'] },
  { number: 52, name: '1 Tesalonicenses', englishName: '1 Thessalonians', abbrev: '1 Ts', testament: 'NT', chapterCount: 5, aliases: ['1 tesalonicenses', '1 tes', '1 ts', '1th', '1thess', '1thessalonians', '1 tesalonicenses', 'i tesalonicenses', '1tesalonicenses'] },
  { number: 53, name: '2 Tesalonicenses', englishName: '2 Thessalonians', abbrev: '2 Ts', testament: 'NT', chapterCount: 3, aliases: ['2 tesalonicenses', '2 tes', '2 ts', '2th', '2thess', '2thessalonians', '2 tesalonicenses', 'ii tesalonicenses', '2tesalonicenses'] },
  { number: 54, name: '1 Timoteo', englishName: '1 Timothy', abbrev: '1 Ti', testament: 'NT', chapterCount: 6, aliases: ['1 timoteo', '1 tim', '1 ti', '1tm', '1tim', '1timothy', '1 timothy', 'i timoteo', '1timoteo'] },
  { number: 55, name: '2 Timoteo', englishName: '2 Timothy', abbrev: '2 Ti', testament: 'NT', chapterCount: 4, aliases: ['2 timoteo', '2 tim', '2 ti', '2tm', '2tim', '2timothy', '2 timothy', 'ii timoteo', '2timoteo'] },
  { number: 56, name: 'Tito', englishName: 'Titus', abbrev: 'Tit', testament: 'NT', chapterCount: 3, aliases: ['tito', 'tit', 'ti', 'titus'] },
  { number: 57, name: 'Filemón', englishName: 'Philemon', abbrev: 'Flm', testament: 'NT', chapterCount: 1, aliases: ['filemon', 'flm', 'phm', 'philem', 'philemon', 'filemón'] },
  { number: 58, name: 'Hebreos', englishName: 'Hebrews', abbrev: 'Heb', testament: 'NT', chapterCount: 13, aliases: ['hebreos', 'heb', 'he', 'hebrews'] },
  { number: 59, name: 'Santiago', englishName: 'James', abbrev: 'Stg', testament: 'NT', chapterCount: 5, aliases: ['santiago', 'stg', 'sant', 'jas', 'jam', 'james'] },
  { number: 60, name: '1 Pedro', englishName: '1 Peter', abbrev: '1 P', testament: 'NT', chapterCount: 5, aliases: ['1 pedro', '1 ped', '1 p', '1pe', '1pt', '1pet', '1peter', '1 peter', 'i pedro', '1pedro'] },
  { number: 61, name: '2 Pedro', englishName: '2 Peter', abbrev: '2 P', testament: 'NT', chapterCount: 3, aliases: ['2 pedro', '2 ped', '2 p', '2pe', '2pt', '2pet', '2peter', '2 peter', 'ii pedro', '2pedro'] },
  { number: 62, name: '1 Juan', englishName: '1 John', abbrev: '1 Jn', testament: 'NT', chapterCount: 5, aliases: ['1 juan', '1 jn', '1 jhn', '1 j', '1jn', '1john', '1 john', 'i juan', '1juan'] },
  { number: 63, name: '2 Juan', englishName: '2 John', abbrev: '2 Jn', testament: 'NT', chapterCount: 1, aliases: ['2 juan', '2 jn', '2 jhn', '2 j', '2jn', '2john', '2 john', 'ii juan', '2juan'] },
  { number: 64, name: '3 Juan', englishName: '3 John', abbrev: '3 Jn', testament: 'NT', chapterCount: 1, aliases: ['3 juan', '3 jn', '3 jhn', '3 j', '3jn', '3john', '3 john', 'iii juan', '3juan'] },
  { number: 65, name: 'Judas', englishName: 'Jude', abbrev: 'Jud', testament: 'NT', chapterCount: 1, aliases: ['judas', 'jud', 'jd', 'jude'] },
  { number: 66, name: 'Apocalipsis', englishName: 'Revelation', abbrev: 'Apoc', testament: 'NT', chapterCount: 22, aliases: ['apocalipsis', 'apoc', 'ap', 'rev', 'revelation', 'revelations'] }
]

/**
 * Maps normalized book alias strings directly to their corresponding BibleBook.
 */
const ALIAS_LOOKUP_MAP = new Map<string, BibleBook>()

for (const book of BIBLE_BOOKS) {
  for (const alias of book.aliases) {
    const norm = normalizeForSearch(alias).replace(/\./g, '').trim()
    ALIAS_LOOKUP_MAP.set(norm, book)
  }
}

/**
 * Resolves a book string into a canonical BibleBook.
 */
export function resolveBibleBook(input: string): BibleBook | null {
  if (!input) return null

  // Normalize: replace Roman numerals, periods, trim spaces
  const clean = normalizeForSearch(input)
    .replace(/\./g, '')
    .replace(/^iii\s+/, '3 ')
    .replace(/^ii\s+/, '2 ')
    .replace(/^i\s+/, '1 ')
    .trim()

  // Direct lookup
  if (ALIAS_LOOKUP_MAP.has(clean)) {
    return ALIAS_LOOKUP_MAP.get(clean)!
  }

  // Handle number prefixes glued to book name: e.g. "1juan" -> "1 juan"
  const gluedMatch = clean.match(/^([1-3])([a-z]+)$/)
  if (gluedMatch) {
    const spaced = `${gluedMatch[1]} ${gluedMatch[2]}`
    if (ALIAS_LOOKUP_MAP.has(spaced)) {
      return ALIAS_LOOKUP_MAP.get(spaced)!
    }
  }

  return null
}

/**
 * Tolerant reference parser supporting all standard formats:
 * - "Juan 3:16", "jn 3 16", "Jn 3,16"
 * - "1 co 13:4-7", "1 Corintios 13.4-7"
 * - "Salmos 23" (full chapter)
 * - "Gén 1.1-5"
 * - Range across chapters: "Lucas 1:38-2:4"
 */
export function parseBibleReference(input: string): BibleReferenceParsed | null {
  if (!input || typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // Regular expression to break down book part and chapter/verse part
  // Examples:
  // "Juan 3:16" -> book="Juan", numbers="3:16"
  // "1 Corintios 13:4-7" -> book="1 Corintios", numbers="13:4-7"
  // "Salmos 23" -> book="Salmos", numbers="23"
  const regex = /^([1-3]?\s*[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)\s*[:.\s]?\s*(\d.*)?$/i
  const match = trimmed.match(regex)
  if (!match) return null

  const bookPart = match[1].trim()
  const numbersPart = match[2] ? match[2].trim() : ''

  const book = resolveBibleBook(bookPart)
  if (!book) return null

  // If no numbers at all, e.g. "Juan", defaults to chapter 1
  if (!numbersPart) {
    return {
      rawInput: trimmed,
      bookNumber: book.number,
      bookName: book.name,
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 1000,
      isFullChapter: true,
      formattedReference: `${book.name} 1`
    }
  }

  // Case A: Full chapter reference, e.g. "23" or "capitulo 23"
  if (/^\d+$/.test(numbersPart)) {
    const chap = parseInt(numbersPart, 10)
    if (chap < 1 || chap > book.chapterCount) return null

    return {
      rawInput: trimmed,
      bookNumber: book.number,
      bookName: book.name,
      startChapter: chap,
      startVerse: 1,
      endChapter: chap,
      endVerse: 1000,
      isFullChapter: true,
      formattedReference: `${book.name} ${chap}`
    }
  }

  // Case B: Chapter and Verse with possible range, e.g.:
  // "3:16", "3 16", "3,16", "3.16"
  // "13:4-7", "13 4-7", "13:4 - 7"
  // "1:38-2:4" (cross-chapter range)
  const normNumbers = numbersPart
    .replace(/,/g, ':')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ':')

  // Check cross-chapter range: "1:38-2:4"
  const crossChapMatch = normNumbers.match(/^(\d+)[:.](\d+)-(\d+)[:.](\d+)$/)
  if (crossChapMatch) {
    const sChap = parseInt(crossChapMatch[1], 10)
    const sVerse = parseInt(crossChapMatch[2], 10)
    const eChap = parseInt(crossChapMatch[3], 10)
    const eVerse = parseInt(crossChapMatch[4], 10)

    if (sChap < 1 || sChap > book.chapterCount || eChap < sChap || eChap > book.chapterCount) {
      return null
    }

    return {
      rawInput: trimmed,
      bookNumber: book.number,
      bookName: book.name,
      startChapter: sChap,
      startVerse: sVerse,
      endChapter: eChap,
      endVerse: eVerse,
      isFullChapter: false,
      formattedReference: `${book.name} ${sChap}:${sVerse}-${eChap}:${eVerse}`
    }
  }

  // Check single chapter range or single verse: "3:16" or "13:4-7"
  const singleChapMatch = normNumbers.match(/^(\d+)[:.](\d+)(?:-(\d+))?$/)
  if (singleChapMatch) {
    const chap = parseInt(singleChapMatch[1], 10)
    const sVerse = parseInt(singleChapMatch[2], 10)
    const eVerse = singleChapMatch[3] ? parseInt(singleChapMatch[3], 10) : sVerse

    if (chap < 1 || chap > book.chapterCount) return null
    if (sVerse < 1 || eVerse < sVerse) return null

    const formattedReference =
      sVerse === eVerse
        ? `${book.name} ${chap}:${sVerse}`
        : `${book.name} ${chap}:${sVerse}-${eVerse}`

    return {
      rawInput: trimmed,
      bookNumber: book.number,
      bookName: book.name,
      startChapter: chap,
      startVerse: sVerse,
      endChapter: chap,
      endVerse: eVerse,
      isFullChapter: false,
      formattedReference
    }
  }

  return null
}
