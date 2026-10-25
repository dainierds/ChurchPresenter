import { describe, it, expect } from 'vitest'
import { serializeLibraryToJson, parseAndValidateLibraryJson } from '../src/shared/backup-export-utils'
import { LibraryExportData } from '../src/shared/types'

describe('Library Backup & Export/Import', () => {
  const exportData: LibraryExportData = {
    version: 1,
    exportedAt: '2026-10-24T22:00:00Z',
    songs: [
      {
        id: 's1',
        title: 'Cuán Grande es Él',
        author: 'Carl Boberg',
        copyright: 'Dominio Público',
        language: 'es',
        tags: ['Himno'],
        groups: [
          {
            id: 'g1',
            songId: 's1',
            groupType: 'verse',
            groupNumber: 1,
            label: 'Verso 1',
            content: 'Señor mi Dios...',
            sortOrder: 0
          }
        ],
        arrangements: [
          {
            id: 'a1',
            songId: 's1',
            name: 'Predeterminado',
            groupIds: ['g1'],
            isDefault: true
          }
        ],
        createdAt: '2026-10-24',
        updatedAt: '2026-10-24'
      }
    ],
    presentations: [
      {
        id: 'p1',
        title: 'Anuncios',
        description: 'Avisos semanales',
        slides: [
          { id: 'sl1', title: 'Bienvenida', body: 'Nos alegra verte' }
        ],
        createdAt: '2026-10-24',
        updatedAt: '2026-10-24'
      }
    ],
    themes: []
  }

  it('serializes library data into formatted JSON string', () => {
    const json = serializeLibraryToJson(exportData)
    expect(json).toContain('"Cuán Grande es Él"')
    expect(json).toContain('"Anuncios"')
  })

  it('parses and validates JSON backup format accurately', () => {
    const json = serializeLibraryToJson(exportData)
    const restored = parseAndValidateLibraryJson(json)

    expect(restored.songs).toHaveLength(1)
    expect(restored.songs[0].title).toBe('Cuán Grande es Él')
    expect(restored.presentations).toHaveLength(1)
    expect(restored.presentations[0].title).toBe('Anuncios')
  })

  it('throws an error when invalid or corrupted JSON is supplied', () => {
    expect(() => parseAndValidateLibraryJson('{"invalid": true}')).toThrow(
      'Formato de archivo inválido: falta la colección de canciones.'
    )
  })
})
