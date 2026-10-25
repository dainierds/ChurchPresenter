import { describe, it, expect } from 'vitest'
import {
  parseLyricsToGroups,
  splitGroupContentIntoSlides,
  buildSlidesFromSong
} from '../src/shared/song-parser'
import { Song } from '../src/shared/types'

describe('Song Parser & Slide Generator', () => {
  const sampleLyrics = `
Verso 1
Señor mi Dios al contemplar los cielos
El firmamento y las mil estrellas
Al oír tu voz en los potentes truenos
Y ver brillar al sol en su cenit

Coro
¡Mi corazón entona la canción!
¡Cuán grande es Él! ¡Cuán grande es Él!
¡Mi corazón entona la canción!
¡Cuán grande es Él! ¡Cuán grande es Él!

Verso 2
Al recorrer los montes y los valles
Y ver las bellas flores al pasar
Al escuchar el canto de las aves
Y el murmurar del claro manantial

Puente
Y cuando pienso en ti Señor
Me postro en adoración y loor
`

  it('correctly parses raw lyrics into groups with proper labels and types', () => {
    const groups = parseLyricsToGroups(sampleLyrics, 'song-1')

    expect(groups).toHaveLength(4)
    expect(groups[0].label).toBe('Verso 1')
    expect(groups[0].groupType).toBe('verse')
    expect(groups[0].content).toContain('Señor mi Dios')

    expect(groups[1].label).toBe('Coro')
    expect(groups[1].groupType).toBe('chorus')
    expect(groups[1].content).toContain('¡Mi corazón entona la canción!')

    expect(groups[2].label).toBe('Verso 2')
    expect(groups[2].groupType).toBe('verse')

    expect(groups[3].label).toBe('Puente')
    expect(groups[3].groupType).toBe('bridge')
  })

  it('preserves Spanish characters, accents and punctuation perfectly', () => {
    const spanishLyrics = `
Verso 1
¿Quién es el Rey de gloria?
¡Jehová el fuerte y valiente!
Él nos dio salvación y perdón
En la cruz murió por amor
`
    const groups = parseLyricsToGroups(spanishLyrics, 'song-es')
    expect(groups[0].content).toContain('¿Quién es el Rey de gloria?')
    expect(groups[0].content).toContain('¡Jehová el fuerte y valiente!')
    expect(groups[0].content).toContain('Él nos dio salvación y perdón')
  })

  it('splits group into slides according to configured linesPerSlide', () => {
    const group = {
      id: 'grp-1',
      songId: 's-1',
      groupType: 'verse' as const,
      groupNumber: 1,
      label: 'Verso 1',
      content: 'Línea 1\nLínea 2\nLínea 3\nLínea 4\nLínea 5\nLínea 6',
      sortOrder: 0
    }

    // Split 2 lines per slide -> 3 slides
    const slides2 = splitGroupContentIntoSlides(group, 2, 'Himno')
    expect(slides2).toHaveLength(3)
    expect(slides2[0].body).toBe('Línea 1\nLínea 2')
    expect(slides2[1].body).toBe('Línea 3\nLínea 4')
    expect(slides2[2].body).toBe('Línea 5\nLínea 6')

    // Split 4 lines per slide -> 2 slides (4 lines + 2 lines)
    const slides4 = splitGroupContentIntoSlides(group, 4, 'Himno')
    expect(slides4).toHaveLength(2)
    expect(slides4[0].body).toBe('Línea 1\nLínea 2\nLínea 3\nLínea 4')
    expect(slides4[1].body).toBe('Línea 5\nLínea 6')
  })

  it('builds complete slides following chosen song arrangement', () => {
    const groups = parseLyricsToGroups(sampleLyrics, 'song-1')
    const verse1Id = groups[0].id
    const chorusId = groups[1].id
    const verse2Id = groups[2].id

    const song: Song = {
      id: 'song-1',
      title: 'Cuán Grande es Él',
      author: 'Carl Boberg',
      copyright: 'Dominio Público',
      language: 'es',
      tags: ['Adoración', 'Himno'],
      groups,
      linesPerSlide: 4,
      arrangements: [
        {
          id: 'arr-default',
          songId: 'song-1',
          name: 'Predeterminado (V1, C, V2, C)',
          groupIds: [verse1Id, chorusId, verse2Id, chorusId],
          isDefault: true
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const slides = buildSlidesFromSong(song, 'arr-default')
    // Each group is 4 lines, linesPerSlide = 4, so each group = 1 slide
    // Total slides: V1 (1) + C (1) + V2 (1) + C (1) = 4 slides
    expect(slides).toHaveLength(4)
    expect(slides[0].groupLabel).toBe('Verso 1')
    expect(slides[1].groupLabel).toBe('Coro')
    expect(slides[2].groupLabel).toBe('Verso 2')
    expect(slides[3].groupLabel).toBe('Coro')
  })
})
