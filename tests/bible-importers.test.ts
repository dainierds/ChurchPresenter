import { describe, it, expect } from 'vitest'
import {
  parseJsonBible,
  parseZefaniaXml,
  parseOsisXml,
  parseUsfm
} from '../src/main/bible/bible-importers'

describe('Bible Importers (All 4 Standard Formats)', () => {
  describe('JSON Importer', () => {
    it('parses valid simple JSON format', () => {
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

    it('throws descriptive error on malformed JSON', () => {
      expect(() => parseJsonBible('{ malformed json')).toThrow(/Error de sintaxis JSON/)
      expect(() => parseJsonBible(JSON.stringify({ empty: true }))).toThrow(/arreglo "books"/)
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
