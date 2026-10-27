import { describe, it, expect, beforeAll } from 'vitest'
import initSqlJs, { SqlJsStatic } from 'sql.js'
import {
  parseJsonBible,
  parseZefaniaXml,
  parseOsisXml,
  parseUsfm,
  parseSqliteBible,
  validateBibleData
} from '../src/main/bible/bible-importers'

describe('Bible Importers (All Formats & Requirements)', () => {
  let SQL: SqlJsStatic

  beforeAll(async () => {
    SQL = await initSqlJs()
  })

  describe('JSON Importer', () => {
    it('parses valid simple ChurchPresenter JSON format', () => {
      const json = JSON.stringify({
        name: 'Traducción de Prueba',
        abbrev: 'TEST',
        language: 'es',
        books: [
          {
            number: 43,
            name: 'Juan',
            chapters: [
              {
                chapter: 1,
                verses: [
                  { verse: 1, text: 'En el principio era el Verbo.' },
                  { verse: 2, text: 'Este era en el principio con Dios.' }
                ]
              }
            ]
          }
        ]
      })

      const res = parseJsonBible(json)
      expect(res.name).toBe('Traducción de Prueba')
      expect(res.abbrev).toBe('TEST')
      expect(res.verses).toHaveLength(2)
      expect(res.verses[0].bookNumber).toBe(43)
      expect(res.verses[0].verse).toBe(1)
      expect(res.verses[0].text).toBe('En el principio era el Verbo.')
    })

    it('parses Generic Format A: chapters as array of verse strings', () => {
      const json = JSON.stringify({
        name: 'Genérico A',
        abbrev: 'GENA',
        books: [
          {
            name: 'Génesis',
            chapters: [
              ['En el principio creó Dios los cielos y la tierra.', 'Y la tierra estaba desordenada y vacía.'],
              ['Fueron, pues, acabados los cielos y la tierra.']
            ]
          }
        ]
      })

      const res = parseJsonBible(json)
      expect(res.name).toBe('Genérico A')
      expect(res.verses).toHaveLength(3)
      expect(res.verses[0].bookNumber).toBe(1)
      expect(res.verses[0].chapter).toBe(1)
      expect(res.verses[0].verse).toBe(1)
      expect(res.verses[2].chapter).toBe(2)
      expect(res.verses[2].verse).toBe(1)
    })

    it('parses Generic Format B: flat verses array', () => {
      const json = JSON.stringify([
        { book: 'Juan', chapter: 3, verse: 16, text: 'Porque de tal manera amó Dios al mundo.' },
        { book: 'Juan', chapter: 3, verse: 17, text: 'Porque no envió Dios a su Hijo al mundo para condenar.' }
      ])

      const res = parseJsonBible(json)
      expect(res.verses).toHaveLength(2)
      expect(res.verses[0].bookNumber).toBe(43)
      expect(res.verses[0].chapter).toBe(3)
      expect(res.verses[0].verse).toBe(16)
      expect(res.verses[0].text).toContain('amó Dios al mundo')
    })

    it('parses Generic Format C: dictionary by book names and chapters', () => {
      const json = JSON.stringify({
        name: 'Diccionario Bíblico',
        abbrev: 'DICT',
        Génesis: {
          1: {
            1: 'En el principio creó Dios los cielos y la tierra.'
          }
        },
        Salmos: {
          23: {
            1: 'Jehová es mi pastor; nada me faltará.'
          }
        }
      })

      const res = parseJsonBible(json)
      expect(res.verses).toHaveLength(2)
      expect(res.verses[0].bookNumber).toBe(1)
      expect(res.verses[0].chapter).toBe(1)
      expect(res.verses[0].verse).toBe(1)
      expect(res.verses[1].bookNumber).toBe(19)
      expect(res.verses[1].chapter).toBe(23)
      expect(res.verses[1].verse).toBe(1)
    })

    it('throws descriptive error on malformed JSON', () => {
      expect(() => parseJsonBible('{ malformed json')).toThrow(/Error de sintaxis JSON/)
      expect(() => parseJsonBible(JSON.stringify({ empty: true }))).toThrow(/estructura bíblica reconocible/)
    })
  })

  describe('SQLite Database Importer (.sqlite, .db, .bible)', () => {
    it('auto-detects table and columns and imports SQLite database correctly', () => {
      const db = new SQL.Database()
      db.run(`
        CREATE TABLE metadata (key TEXT, value TEXT);
        INSERT INTO metadata VALUES ('name', 'Biblia SQLite Test');
        INSERT INTO metadata VALUES ('abbrev', 'SQLTEST');
        INSERT INTO metadata VALUES ('language', 'es');

        CREATE TABLE scripture_verses (
          b_number INTEGER,
          chap_id INTEGER,
          verse_num INTEGER,
          body_text TEXT
        );
        INSERT INTO scripture_verses VALUES (1, 1, 1, 'En el principio creó Dios los cielos.');
        INSERT INTO scripture_verses VALUES (43, 3, 16, 'Porque de tal manera amó Dios al mundo.');
      `)

      const buffer = db.export()
      db.close()

      const res = parseSqliteBible(buffer, SQL)
      expect(res.name).toBe('Biblia SQLite Test')
      expect(res.abbrev).toBe('SQLTEST')
      expect(res.verses).toHaveLength(2)
      expect(res.verses[0].bookNumber).toBe(1)
      expect(res.verses[0].text).toBe('En el principio creó Dios los cielos.')
      expect(res.verses[1].bookNumber).toBe(43)
      expect(res.verses[1].verse).toBe(16)
    })
  })

  describe('Validation & Verification Summary', () => {
    it('calculates book count, alerts missing books, and extracts sample verses (Gen 1:1, Sal 23:1, Juan 3:16)', () => {
      const testImport = {
        name: 'Nuevo Testamento Parcial',
        abbrev: 'NTP',
        language: 'es',
        copyright: 'Dominio Público',
        licenseNotice: 'Libre',
        isPublicDomain: true,
        verses: [
          { bookNumber: 1, bookName: 'Génesis', chapter: 1, verse: 1, text: 'En el principio...', translationAbbrev: 'NTP' },
          { bookNumber: 43, bookName: 'Juan', chapter: 3, verse: 16, text: 'De tal manera...', translationAbbrev: 'NTP' }
        ]
      }

      const summary = validateBibleData(testImport)
      expect(summary.success).toBe(true)
      expect(summary.bookCount).toBe(2)
      expect(summary.verseCount).toBe(2)
      expect(summary.missingBooks.length).toBe(64) // 66 - 2 = 64
      expect(summary.missingBooks).toContain('Éxodo')
      expect(summary.missingBooks).toContain('Salmos')

      // Check sample verses
      expect(summary.sampleVerses).toHaveLength(3)
      const g11 = summary.sampleVerses.find((s) => s.reference === 'Génesis 1:1')
      expect(g11?.text).toBe('En el principio...')
      const j316 = summary.sampleVerses.find((s) => s.reference === 'Juan 3:16')
      expect(j316?.text).toBe('De tal manera...')
      const s231 = summary.sampleVerses.find((s) => s.reference === 'Salmos 23:1')
      expect(s231?.text).toContain('No disponible')
    })
  })

  describe('Zefania XML Importer', () => {
    it('parses valid Zefania XML format', () => {
      const zefaniaXml = `
        <XMLBIBLE biblename="Reina-Valera 1909 Zefania">
          <BIBLEBOOK bnumber="1" bname="Genesis">
            <CHAPTER cnumber="1">
              <VERS vnumber="1">En el principio crió Dios los cielos y la tierra.</VERS>
              <VERS vnumber="2">Y la tierra estaba desordenada y vacía.</VERS>
            </CHAPTER>
          </BIBLEBOOK>
        </XMLBIBLE>
      `

      const res = parseZefaniaXml(zefaniaXml)
      expect(res.name).toBe('Reina-Valera 1909 Zefania')
      expect(res.verses).toHaveLength(2)
      expect(res.verses[0].bookNumber).toBe(1)
      expect(res.verses[0].chapter).toBe(1)
      expect(res.verses[0].verse).toBe(1)
      expect(res.verses[0].text).toContain('crió Dios los cielos')
    })

    it('throws error on empty or malformed Zefania XML', () => {
      expect(() => parseZefaniaXml('')).toThrow(/vacío o inválido/)
      expect(() => parseZefaniaXml('<XMLBIBLE></XMLBIBLE>')).toThrow(/no contiene elementos BIBLEBOOK/)
    })
  })

  describe('OSIS XML Importer', () => {
    it('parses valid OSIS XML format with osisID attributes', () => {
      const osisXml = `
        <osis>
          <osisText>
            <header><work><title>English KJV OSIS</title></work></header>
            <div type="book" osisID="John">
              <chapter osisID="John.3">
                <verse osisID="John.3.16">For God so loved the world.</verse>
              </chapter>
            </div>
          </osisText>
        </osis>
      `

      const res = parseOsisXml(osisXml)
      expect(res.name).toBe('English KJV OSIS')
      expect(res.verses).toHaveLength(1)
      expect(res.verses[0].bookNumber).toBe(43)
      expect(res.verses[0].chapter).toBe(3)
      expect(res.verses[0].verse).toBe(16)
      expect(res.verses[0].text).toBe('For God so loved the world.')
    })

    it('throws error on OSIS without verses', () => {
      expect(() => parseOsisXml('<osis><osisText></osisText></osis>')).toThrow(/No se encontraron versículos/)
    })
  })

  describe('USFM Importer', () => {
    it('parses valid USFM format markers', () => {
      const usfm = `
        \\id GEN Genesis
        \\h Génesis
        \\c 1
        \\v 1 En el principio creó Dios los cielos y la tierra.
        \\v 2 Y la tierra estaba sin orden y vacía.
      `

      const res = parseUsfm(usfm)
      expect(res.verses).toHaveLength(2)
      expect(res.verses[0].bookNumber).toBe(1)
      expect(res.verses[0].chapter).toBe(1)
      expect(res.verses[0].verse).toBe(1)
      expect(res.verses[0].text).toContain('creó Dios los cielos')
    })

    it('throws error on USFM without \\c or \\v', () => {
      expect(() => parseUsfm('\\id GEN Genesis\n\\h Genesis\n')).toThrow(/no contiene marcas válidas/)
    })
  })
})
