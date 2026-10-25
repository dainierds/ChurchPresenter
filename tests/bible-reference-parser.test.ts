import { describe, it, expect } from 'vitest'
import { parseBibleReference, resolveBibleBook, BIBLE_BOOKS } from '../src/shared/bible-reference-parser'

describe('Bible Reference Parser', () => {
  it('contains all 66 canonical books of the Bible', () => {
    expect(BIBLE_BOOKS.length).toBe(66)
    expect(BIBLE_BOOKS[0].name).toBe('Génesis')
    expect(BIBLE_BOOKS[65].name).toBe('Apocalipsis')
  })

  describe('resolveBibleBook', () => {
    it('resolves canonical Spanish and English book names', () => {
      expect(resolveBibleBook('Génesis')?.number).toBe(1)
      expect(resolveBibleBook('Genesis')?.number).toBe(1)
      expect(resolveBibleBook('gen')?.number).toBe(1)
      expect(resolveBibleBook('Juan')?.number).toBe(43)
      expect(resolveBibleBook('John')?.number).toBe(43)
      expect(resolveBibleBook('jn')?.number).toBe(43)
      expect(resolveBibleBook('Apocalipsis')?.number).toBe(66)
      expect(resolveBibleBook('Revelation')?.number).toBe(66)
    })

    it('resolves numbered books with numbers and roman numerals', () => {
      expect(resolveBibleBook('1 Corintios')?.number).toBe(46)
      expect(resolveBibleBook('1co')?.number).toBe(46)
      expect(resolveBibleBook('1 cor')?.number).toBe(46)
      expect(resolveBibleBook('I Corintios')?.number).toBe(46)
      expect(resolveBibleBook('2 Reyes')?.number).toBe(12)
      expect(resolveBibleBook('II Reyes')?.number).toBe(12)
      expect(resolveBibleBook('3 Juan')?.number).toBe(64)
      expect(resolveBibleBook('III Juan')?.number).toBe(64)
    })

    it('returns null for unknown books', () => {
      expect(resolveBibleBook('Inventado')).toBeNull()
      expect(resolveBibleBook('Macabeos')).toBeNull()
      expect(resolveBibleBook('')).toBeNull()
    })
  })

  describe('parseBibleReference - Valid Cases', () => {
    it('parses standard "Juan 3:16"', () => {
      const res = parseBibleReference('Juan 3:16')
      expect(res).not.toBeNull()
      expect(res?.bookNumber).toBe(43)
      expect(res?.bookName).toBe('Juan')
      expect(res?.startChapter).toBe(3)
      expect(res?.startVerse).toBe(16)
      expect(res?.endChapter).toBe(3)
      expect(res?.endVerse).toBe(16)
      expect(res?.isFullChapter).toBe(false)
      expect(res?.formattedReference).toBe('Juan 3:16')
    })

    it('parses space-separated "jn 3 16"', () => {
      const res = parseBibleReference('jn 3 16')
      expect(res).not.toBeNull()
      expect(res?.bookNumber).toBe(43)
      expect(res?.startChapter).toBe(3)
      expect(res?.startVerse).toBe(16)
    })

    it('parses range "1 co 13:4-7"', () => {
      const res = parseBibleReference('1 co 13:4-7')
      expect(res).not.toBeNull()
      expect(res?.bookNumber).toBe(46)
      expect(res?.startChapter).toBe(13)
      expect(res?.startVerse).toBe(4)
      expect(res?.endChapter).toBe(13)
      expect(res?.endVerse).toBe(7)
      expect(res?.formattedReference).toBe('1 Corintios 13:4-7')
    })

    it('parses full chapter "Salmos 23"', () => {
      const res = parseBibleReference('Salmos 23')
      expect(res).not.toBeNull()
      expect(res?.bookNumber).toBe(19)
      expect(res?.startChapter).toBe(23)
      expect(res?.isFullChapter).toBe(true)
      expect(res?.formattedReference).toBe('Salmos 23')
    })

    it('parses dot separated "Gén 1.1-5"', () => {
      const res = parseBibleReference('Gén 1.1-5')
      expect(res).not.toBeNull()
      expect(res?.bookNumber).toBe(1)
      expect(res?.startChapter).toBe(1)
      expect(res?.startVerse).toBe(1)
      expect(res?.endVerse).toBe(5)
    })

    it('parses cross-chapter range "Lucas 1:38-2:4"', () => {
      const res = parseBibleReference('Lucas 1:38-2:4')
      expect(res).not.toBeNull()
      expect(res?.bookNumber).toBe(42)
      expect(res?.startChapter).toBe(1)
      expect(res?.startVerse).toBe(38)
      expect(res?.endChapter).toBe(2)
      expect(res?.endVerse).toBe(4)
    })
  })

  describe('parseBibleReference - Invalid & Malformed Cases', () => {
    it('rejects chapters exceeding book chapter count (e.g. Judas 2:1 - Jude has 1 chapter)', () => {
      expect(parseBibleReference('Judas 2:1')).toBeNull()
      expect(parseBibleReference('Filemón 2:1')).toBeNull()
      expect(parseBibleReference('Abdías 2:5')).toBeNull()
    })

    it('rejects verse numbers less than 1 or inverted ranges', () => {
      expect(parseBibleReference('Juan 3:0')).toBeNull()
      expect(parseBibleReference('Juan 3:10-5')).toBeNull()
    })

    it('rejects non-existent books', () => {
      expect(parseBibleReference('Evangelio de Tomás 1:1')).toBeNull()
      expect(parseBibleReference('Fantasía 5:2')).toBeNull()
    })

    it('rejects empty or random strings', () => {
      expect(parseBibleReference('')).toBeNull()
      expect(parseBibleReference('   ')).toBeNull()
      expect(parseBibleReference('!@#$%^&*()')).toBeNull()
    })
  })
})
