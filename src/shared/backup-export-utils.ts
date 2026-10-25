import { LibraryExportData } from './types'

export function serializeLibraryToJson(data: LibraryExportData): string {
  return JSON.stringify(data, null, 2)
}

export function parseAndValidateLibraryJson(jsonString: string): LibraryExportData {
  const parsed = JSON.parse(jsonString)

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Formato de archivo inválido: no es un objeto JSON válido.')
  }

  if (!Array.isArray(parsed.songs)) {
    throw new Error('Formato de archivo inválido: falta la colección de canciones.')
  }

  return {
    version: parsed.version || 1,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    songs: parsed.songs,
    presentations: Array.isArray(parsed.presentations) ? parsed.presentations : [],
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    services: Array.isArray(parsed.services) ? parsed.services : []
  }
}
