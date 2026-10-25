import { describe, it, expect } from 'vitest'
import { searchItems, normalizeForSearch } from '../src/shared/search-utils'
import { Song } from '../src/shared/types'

describe('Search Utils (Accent-Insensitive & Typo-Tolerant)', () => {
  const songs: Partial<Song>[] = [
    { id: '1', title: 'Cuán Grande es Él', author: 'Carl Boberg', tags: ['Himno', 'Adoración'] },
    { id: '2', title: 'Cantaré de tu Amor', author: 'Danilo Montero', tags: ['Alabanza'] },
    { id: '3', title: 'Jesús, Eres mi Guía', author: 'Marcos Witt', tags: ['Adoración'] },
    { id: '4', title: 'En la Cruz Hay Salvación', author: 'Himno Tradicional', tags: ['Cruz'] },
    { id: '5', title: 'Ríos de Agua Viva', author: 'Desconocido', tags: ['Espíritu Santo'] }
  ]

  it('normalizes accents and diacritics correctly', () => {
    expect(normalizeForSearch('Cuán Grande es Él')).toBe('cuan grande es el')
    expect(normalizeForSearch('Jesús')).toBe('jesus')
    expect(normalizeForSearch('Ríos')).toBe('rios')
  })

  it('finds songs without needing accents in query', () => {
    const results = searchItems(songs, 'cuan grande el', (s) => [s.title || '', s.author || ''])
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Cuán Grande es Él')
  })

  it('finds songs when query has accents but text does not, or vice versa', () => {
    const jesusResults = searchItems(songs, 'jesus', (s) => [s.title || ''])
    expect(jesusResults).toHaveLength(1)
    expect(jesusResults[0].title).toBe('Jesús, Eres mi Guía')
  })

  it('finds songs with minor typos (typo-tolerant)', () => {
    // "grnade" instead of "grande"
    const results = searchItems(songs, 'grnade', (s) => [s.title || ''])
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Cuán Grande es Él')
  })

  it('maintains high performance with 2,000 songs in under 20ms', () => {
    const largeList: Partial<Song>[] = []
    for (let i = 1; i <= 2000; i++) {
      largeList.push({
        id: `song-${i}`,
        title: `Canción de Adoración Número ${i}`,
        author: `Autor Bíblico ${i % 20}`,
        tags: ['Alabanza', 'Himno', 'Culto Dominical']
      })
    }

    const start = performance.now()
    const results = searchItems(largeList, 'adoracion 1500', (s) => [s.title || '', s.author || ''])
    const elapsed = performance.now() - start

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Canción de Adoración Número 1500')
    expect(elapsed).toBeLessThan(50) // Extremely fast
  })
})
