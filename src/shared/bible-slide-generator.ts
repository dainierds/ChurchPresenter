import { BibleVerse, SlideItem } from './types'

export interface BibleSlideOptions {
  translationAbbrev: string
  secondaryAbbrev?: string
  dualLayout?: 'single' | 'stacked' | 'sideBySide'
  maxCharsPerSlide?: number
}

/**
 * Builds presentation slides for Bible passages with verse grouping,
 * auto-fit splitting without breaking verses in half, and dual-translation support.
 */
export function buildBibleSlides(
  verses: BibleVerse[],
  secondaryVerses: BibleVerse[] = [],
  options: BibleSlideOptions
): SlideItem[] {
  if (!verses || verses.length === 0) return []

  const maxChars = options.maxCharsPerSlide || 320
  const isDual = Boolean(options.secondaryAbbrev && secondaryVerses.length > 0)
  const dualLayout = options.dualLayout || (isDual ? 'stacked' : 'single')

  // Map secondary verses by key: "chap_verse"
  const secMap = new Map<string, string>()
  for (const sv of secondaryVerses) {
    secMap.set(`${sv.chapter}_${sv.verse}`, sv.text)
  }

  const slides: SlideItem[] = []

  let currentChunk: BibleVerse[] = []
  let currentChunkLen = 0

  const flushChunk = () => {
    if (currentChunk.length === 0) return

    const first = currentChunk[0]
    const last = currentChunk[currentChunk.length - 1]
    const refTitle =
      first.verse === last.verse
        ? `${first.bookName} ${first.chapter}:${first.verse}`
        : `${first.bookName} ${first.chapter}:${first.verse}-${last.verse}`

    let slideBody = ''

    if (!isDual) {
      if (currentChunk.length === 1) {
        slideBody = currentChunk[0].text
      } else {
        slideBody = currentChunk.map((v) => `[${v.verse}] ${v.text}`).join('\n\n')
      }
    } else {
      // Dual translation mode
      if (dualLayout === 'stacked') {
        const primaryText = currentChunk
          .map((v) => (currentChunk.length > 1 ? `[${v.verse}] ${v.text}` : v.text))
          .join('\n')
        const secText = currentChunk
          .map((v) => {
            const st = secMap.get(`${v.chapter}_${v.verse}`) || ''
            return currentChunk.length > 1 ? `[${v.verse}] ${st}` : st
          })
          .join('\n')

        slideBody = `${primaryText}\n\n── ${options.secondaryAbbrev} ──\n${secText}`
      } else {
        // sideBySide format
        const primaryText = currentChunk
          .map((v) => (currentChunk.length > 1 ? `[${v.verse}] ${v.text}` : v.text))
          .join('\n')
        const secText = currentChunk
          .map((v) => {
            const st = secMap.get(`${v.chapter}_${v.verse}`) || ''
            return currentChunk.length > 1 ? `[${v.verse}] ${st}` : st
          })
          .join('\n')

        slideBody = `[${options.translationAbbrev}]\n${primaryText}\n\n[${options.secondaryAbbrev}]\n${secText}`
      }
    }

    const subtitle = isDual
      ? `${refTitle} (${options.translationAbbrev} / ${options.secondaryAbbrev})`
      : `${refTitle} (${options.translationAbbrev})`

    const slideIdx = slides.length + 1

    slides.push({
      id: `bible_${first.bookNumber}_${first.chapter}_${first.verse}_${slideIdx}`,
      sourceId: `bible_${first.bookNumber}_${first.chapter}`,
      sourceType: 'scripture',
      groupLabel: refTitle,
      slideIndex: slideIdx,
      totalSlidesInGroup: 0, // updated after loop
      title: refTitle,
      body: slideBody.trim(),
      subtitle
    })

    currentChunk = []
    currentChunkLen = 0
  }

  for (let i = 0; i < verses.length; i++) {
    const v = verses[i]
    const verseLen = v.text.length + (isDual ? (secMap.get(`${v.chapter}_${v.verse}`) || '').length : 0)

    // If single verse is extremely long, flush previous and output this verse
    if (verseLen > maxChars * 1.5 && currentChunk.length > 0) {
      flushChunk()
    }

    if (currentChunkLen + verseLen > maxChars && currentChunk.length > 0) {
      flushChunk()
    }

    currentChunk.push(v)
    currentChunkLen += verseLen
  }

  flushChunk()

  // Update totalSlidesInGroup for all generated slides
  for (const s of slides) {
    s.totalSlidesInGroup = slides.length
  }

  return slides
}
