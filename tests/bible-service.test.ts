import { describe, it, expect, beforeAll } from 'vitest'
import path from 'path'
import { BibleService } from '../src/main/bible/bible-service'
import { DatabaseService } from '../src/main/db/database-service'

describe('Bible Service Integration', () => {
  const factoryDir = path.resolve(__dirname, '..', 'resources', 'bibles')
  let bibleService: BibleService
  let testDb: DatabaseService

  beforeAll(async () => {
    testDb = new DatabaseService(':memory:')
    await testDb.initialize()

    bibleService = new BibleService(factoryDir)
    await bibleService.initialize()
  })

  it('lists installed factory translations (RVR1909 and KJV)', async () => {
    const translations = await bibleService.getTranslations()
    const abbrevs = translations.map((t) => t.abbrev.toUpperCase())
    expect(abbrevs).toContain('RVR1909')
    expect(abbrevs).toContain('KJV')
  })

  it('retrieves Juan 3:16 correctly from RVR1909', async () => {
    const res = await bibleService.getVersesByReference('Juan 3:16', 'RVR1909')
    expect(res.verses).toHaveLength(1)
    expect(res.verses[0].bookNumber).toBe(43)
    expect(res.verses[0].chapter).toBe(3)
    expect(res.verses[0].verse).toBe(16)
    expect(res.verses[0].text).toContain('Porque de tal manera amó Dios al mundo')
  })

  it('retrieves dual translation verses for John 3:16 in RVR1909 and KJV', async () => {
    const res = await bibleService.getVersesByReference('Juan 3:16', 'RVR1909', 'KJV')
    expect(res.verses).toHaveLength(1)
    expect(res.verses[0].text).toContain('amó Dios al mundo')
    expect(res.secondaryVerses).toHaveLength(1)
    expect(res.secondaryVerses![0].text).toContain('For God so loved the world')
  })

  it('performs accent-insensitive full-text search', async () => {
    // Search "mundo" without accents should find verses containing "mundo"
    const results = await bibleService.searchBibleText('mundo', 'RVR1909', { bookNumber: 43 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => r.chapter === 3 && r.verse === 16)).toBe(true)

    // Highlight mark tags should be present
    const j316 = results.find((r) => r.chapter === 3 && r.verse === 16)
    expect(j316?.highlightedText).toContain('<mark>')
  })

  it('filters search by Old or New Testament', async () => {
    const otResults = await bibleService.searchBibleText('principio', 'RVR1909', { testament: 'OT' })
    expect(otResults.every((r) => r.bookNumber <= 39)).toBe(true)

    const ntResults = await bibleService.searchBibleText('principio', 'RVR1909', { testament: 'NT' })
    expect(ntResults.every((r) => r.bookNumber >= 40)).toBe(true)
  })
})
