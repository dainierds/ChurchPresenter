import { describe, it, expect } from 'vitest'
import { buildBibleSlides } from '../src/shared/bible-slide-generator'
import { BibleVerse } from '../src/shared/types'

describe('Bible Slide Generator', () => {
  const sampleVerses: BibleVerse[] = [
    {
      bookNumber: 43,
      bookName: 'Juan',
      chapter: 3,
      verse: 16,
      text: 'Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
      translationAbbrev: 'RVR1909'
    },
    {
      bookNumber: 43,
      bookName: 'Juan',
      chapter: 3,
      verse: 17,
      text: 'Porque no envió Dios á su Hijo al mundo, para que condene al mundo, mas para que el mundo sea salvo por él.',
      translationAbbrev: 'RVR1909'
    }
  ]

  const sampleSecondary: BibleVerse[] = [
    {
      bookNumber: 43,
      bookName: 'Juan',
      chapter: 3,
      verse: 16,
      text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
      translationAbbrev: 'KJV'
    },
    {
      bookNumber: 43,
      bookName: 'Juan',
      chapter: 3,
      verse: 17,
      text: 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
      translationAbbrev: 'KJV'
    }
  ]

  it('generates a clean slide for a single verse', () => {
    const slides = buildBibleSlides([sampleVerses[0]], [], {
      translationAbbrev: 'RVR1909'
    })
    expect(slides).toHaveLength(1)
    expect(slides[0].title).toBe('Juan 3:16')
    expect(slides[0].subtitle).toBe('Juan 3:16 (RVR1909)')
    expect(slides[0].body).toContain('Porque de tal manera amó Dios al mundo')
    expect(slides[0].sourceType).toBe('scripture')
  })

  it('generates multiple verses without breaking verses in half unless limit reached', () => {
    const slides = buildBibleSlides(sampleVerses, [], {
      translationAbbrev: 'RVR1909',
      maxCharsPerSlide: 500
    })
    expect(slides).toHaveLength(1)
    expect(slides[0].title).toBe('Juan 3:16-17')
    expect(slides[0].body).toContain('[16]')
    expect(slides[0].body).toContain('[17]')
  })

  it('splits into separate slides when total characters exceed maxCharsPerSlide', () => {
    const slides = buildBibleSlides(sampleVerses, [], {
      translationAbbrev: 'RVR1909',
      maxCharsPerSlide: 120 // forces each verse into its own slide
    })
    expect(slides.length).toBeGreaterThanOrEqual(2)
    expect(slides[0].title).toBe('Juan 3:16')
    expect(slides[1].title).toBe('Juan 3:17')
  })

  it('supports dual translation stacked layout', () => {
    const slides = buildBibleSlides([sampleVerses[0]], [sampleSecondary[0]], {
      translationAbbrev: 'RVR1909',
      secondaryAbbrev: 'KJV',
      dualLayout: 'stacked'
    })
    expect(slides).toHaveLength(1)
    expect(slides[0].body).toContain('Porque de tal manera amó Dios al mundo')
    expect(slides[0].body).toContain('── KJV ──')
    expect(slides[0].body).toContain('For God so loved the world')
    expect(slides[0].subtitle).toContain('RVR1909 / KJV')
  })

  it('supports dual translation sideBySide layout', () => {
    const slides = buildBibleSlides([sampleVerses[0]], [sampleSecondary[0]], {
      translationAbbrev: 'RVR1909',
      secondaryAbbrev: 'KJV',
      dualLayout: 'sideBySide'
    })
    expect(slides).toHaveLength(1)
    expect(slides[0].body).toContain('[RVR1909]')
    expect(slides[0].body).toContain('[KJV]')
  })
})
