import fs from 'fs'
import path from 'path'
import { libraryService } from '../library-service'
import { ImportedSongPreview, SongImportResult, Song, SongGroup } from '../../shared/types'
import { logger } from '../logger'

export class SongImporterService {
  /**
   * Parses an input file based on its extension and content structure.
   */
  public async parseFile(filePath: string): Promise<{
    success: boolean
    previewSongs: ImportedSongPreview[]
    formatDetected: string
    errors: string[]
  }> {
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        previewSongs: [],
        formatDetected: 'unknown',
        errors: [`Archivo no encontrado: ${filePath}`]
      }
    }

    const filename = path.basename(filePath)
    const ext = path.extname(filePath).toLowerCase()
    let content = ''

    try {
      content = fs.readFileSync(filePath, 'utf-8')
    } catch (err: any) {
      return {
        success: false,
        previewSongs: [],
        formatDetected: ext,
        errors: [`Error al leer archivo: ${err?.message || err}`]
      }
    }

    try {
      if (ext === '.chordpro' || ext === '.chopro' || ext === '.crd' || ext === '.cho') {
        const preview = this.parseChordPro(content, filename)
        return {
          success: true,
          previewSongs: [this.enrichDuplicateStatus(preview)],
          formatDetected: 'ChordPro',
          errors: []
        }
      }

      if (ext === '.csv') {
        const parsed = this.parseCsv(content, filename)
        return {
          success: parsed.songs.length > 0,
          previewSongs: parsed.songs.map((s) => this.enrichDuplicateStatus(s)),
          formatDetected: 'CSV',
          errors: parsed.errors
        }
      }

      if (ext === '.pro6') {
        const preview = this.parseProPresenter6(content, filename)
        return {
          success: Boolean(preview),
          previewSongs: preview ? [this.enrichDuplicateStatus(preview)] : [],
          formatDetected: 'ProPresenter 6 (.pro6)',
          errors: preview ? [] : ['No se pudieron extraer diapositivas válidas de este archivo .pro6']
        }
      }

      if (ext === '.xml') {
        // Distinguish OpenLyrics vs ProPresenter vs generic XML
        if (content.includes('openlyrics') || content.includes('<song')) {
          const preview = this.parseOpenLyrics(content, filename)
          return {
            success: Boolean(preview),
            previewSongs: preview ? [this.enrichDuplicateStatus(preview)] : [],
            formatDetected: 'OpenLyrics (XML)',
            errors: preview ? [] : ['Formato OpenLyrics inválido o sin letras legibles']
          }
        }
        if (content.includes('<RVSong')) {
          const preview = this.parseProPresenter6(content, filename)
          return {
            success: Boolean(preview),
            previewSongs: preview ? [this.enrichDuplicateStatus(preview)] : [],
            formatDetected: 'ProPresenter 6 (XML)',
            errors: preview ? [] : ['No se pudieron extraer diapositivas del XML de ProPresenter']
          }
        }
      }

      // Default: Plain Text (.txt or unknown extension)
      const preview = this.parsePlainText(content, filename)
      return {
        success: true,
        previewSongs: [this.enrichDuplicateStatus(preview)],
        formatDetected: 'Texto Plano (.txt)',
        errors: []
      }
    } catch (err: any) {
      logger.error(`Error parsing song file ${filename}:`, err)
      return {
        success: false,
        previewSongs: [],
        formatDetected: ext,
        errors: [`Fallo al procesar archivo: ${err?.message || err}`]
      }
    }
  }

  /**
   * Plain text parser: Detects title, verse/chorus labels, double newline slide breaks.
   */
  public parsePlainText(content: string, filename: string): ImportedSongPreview {
    const lines = content.split(/\r?\n/).map((l) => l.trim())
    const titleFromFilename = path.basename(filename, path.extname(filename))
    let title = ''
    let artist = ''
    let ccliNumber = ''
    let copyright = ''

    // Detect header directives or title
    const bodyLines: string[] = []
    let inBody = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line) {
        if (inBody) bodyLines.push('')
        continue
      }

      // Metadata headers (e.g. "Título: ...", "Autor: ...")
      if (/^(t[ií]tulo|title):/i.test(line)) {
        title = line.replace(/^(t[ií]tulo|title):\s*/i, '')
        continue
      }
      if (/^(autor|author|artista|artist):/i.test(line)) {
        artist = line.replace(/^(autor|author|artista|artist):\s*/i, '')
        continue
      }
      if (/^(ccli|ccli_no|ccli_number):/i.test(line)) {
        ccliNumber = line.replace(/^(ccli|ccli_no|ccli_number):\s*/i, '')
        continue
      }
      if (/^(copyright|derechos):/i.test(line)) {
        copyright = line.replace(/^(copyright|derechos):\s*/i, '')
        continue
      }

      if (!title && !inBody) {
        title = line.replace(/^#\s*/, '')
        continue
      }

      inBody = true
      bodyLines.push(line)
    }

    if (!title) title = titleFromFilename

    // Group into sections separated by blank lines
    const blocks: string[] = []
    let currentBlock: string[] = []

    for (const bLine of bodyLines) {
      if (bLine === '') {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock.join('\n'))
          currentBlock = []
        }
      } else {
        currentBlock.push(bLine)
      }
    }
    if (currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'))
    }

    const groups: { name: string; content: string }[] = []
    let verseCounter = 1

    for (const block of blocks) {
      const firstLine = block.split('\n')[0].trim()
      const cleanFirstLine = firstLine.replace(/^[[(]/, '').replace(/[\])]$/, '').trim()
      let groupName = `Verso ${verseCounter}`
      let blockContent = block

      if (/^(verso|verse|estrofa)\s*(\d*):?/i.test(cleanFirstLine)) {
        groupName = cleanFirstLine.replace(/:$/, '')
        blockContent = block.substring(firstLine.length).trim()
      } else if (/^(coro|chorus):?/i.test(cleanFirstLine)) {
        groupName = 'Coro'
        blockContent = block.substring(firstLine.length).trim()
      } else if (/^(puente|bridge):?/i.test(cleanFirstLine)) {
        groupName = 'Puente'
        blockContent = block.substring(firstLine.length).trim()
      } else {
        verseCounter++
      }

      if (blockContent) {
        groups.push({ name: groupName, content: blockContent })
      }
    }

    if (groups.length === 0) {
      groups.push({ name: 'Verso 1', content: content.trim() })
    }

    return {
      title,
      artist: artist || undefined,
      ccliNumber: ccliNumber || undefined,
      copyright: copyright || undefined,
      groups,
      totalSlides: groups.length,
      isDuplicate: false,
      originalFormat: 'txt',
      filename
    }
  }

  /**
   * ChordPro Parser: Strips [Chords] and extracts directives {title:...}, {artist:...}, {soc}...
   */
  public parseChordPro(content: string, filename: string): ImportedSongPreview {
    const lines = content.split(/\r?\n/)
    let title = path.basename(filename, path.extname(filename))
    let artist = ''
    let copyright = ''
    let ccliNumber = ''

    const groups: { name: string; content: string }[] = []
    let currentGroupName = 'Verso 1'
    let currentLines: string[] = []
    let verseCount = 1
    let inChorus = false

    const flushGroup = () => {
      if (currentLines.length > 0) {
        groups.push({
          name: inChorus ? 'Coro' : currentGroupName,
          content: currentLines.join('\n').trim()
        })
        currentLines = []
        if (!inChorus) {
          verseCount++
          currentGroupName = `Verso ${verseCount}`
        }
      }
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) {
        if (currentLines.length > 0 && !inChorus) {
          flushGroup()
        }
        continue
      }

      // Directives
      if (line.startsWith('{') && line.endsWith('}')) {
        const directive = line.slice(1, -1).trim()
        const colonIdx = directive.indexOf(':')
        const tag = colonIdx > -1 ? directive.substring(0, colonIdx).toLowerCase().trim() : directive.toLowerCase()
        const val = colonIdx > -1 ? directive.substring(colonIdx + 1).trim() : ''

        if (tag === 'title' || tag === 't') {
          title = val
        } else if (tag === 'artist' || tag === 'a' || tag === 'composer') {
          artist = val
        } else if (tag === 'copyright') {
          copyright = val
        } else if (tag === 'ccli') {
          ccliNumber = val
        } else if (tag === 'start_of_chorus' || tag === 'soc') {
          flushGroup()
          inChorus = true
          currentGroupName = 'Coro'
        } else if (tag === 'end_of_chorus' || tag === 'eoc') {
          flushGroup()
          inChorus = false
          currentGroupName = `Verso ${verseCount}`
        } else if (tag === 'start_of_verse' || tag === 'sov') {
          flushGroup()
          currentGroupName = val ? `Verso ${val}` : `Verso ${verseCount}`
        } else if (tag === 'end_of_verse' || tag === 'eov') {
          flushGroup()
        } else if (tag === 'start_of_bridge' || tag === 'sob') {
          flushGroup()
          currentGroupName = 'Puente'
        } else if (tag === 'end_of_bridge' || tag === 'eob') {
          flushGroup()
          currentGroupName = `Verso ${verseCount}`
        }
        continue
      }

      // Strip chords in square brackets [Am7], [D/F#], etc.
      const cleanLyric = line.replace(/\[[^\]]+\]/g, '').trim()
      if (cleanLyric) {
        currentLines.push(cleanLyric)
      }
    }

    flushGroup()

    if (groups.length === 0) {
      groups.push({ name: 'Verso 1', content: content.replace(/\[[^\]]+\]/g, '').replace(/\{[^}]+\}/g, '').trim() })
    }

    return {
      title,
      artist: artist || undefined,
      copyright: copyright || undefined,
      ccliNumber: ccliNumber || undefined,
      groups,
      totalSlides: groups.length,
      isDuplicate: false,
      originalFormat: 'chordpro',
      filename
    }
  }

  /**
   * OpenLyrics XML Parser
   */
  public parseOpenLyrics(xmlContent: string, filename: string): ImportedSongPreview | null {
    // Basic regex-based XML extraction without heavy native dependency
    const titleMatch = xmlContent.match(/<title>([^<]+)<\/title>/i)
    const authorMatch = xmlContent.match(/<author>([^<]+)<\/author>/i)
    const ccliMatch = xmlContent.match(/<ccliNo>([^<]+)<\/ccliNo>/i)
    const copyrightMatch = xmlContent.match(/<copyright>([^<]+)<\/copyright>/i)

    const title = titleMatch ? titleMatch[1].trim() : path.basename(filename, path.extname(filename))
    const artist = authorMatch ? authorMatch[1].trim() : undefined
    const ccliNumber = ccliMatch ? ccliMatch[1].trim() : undefined
    const copyright = copyrightMatch ? copyrightMatch[1].trim() : undefined

    // Extract verses: <verse name="v1"> ... <lines> ... </lines> </verse>
    const verseRegex = /<verse\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/gi
    const groups: { name: string; content: string }[] = []
    let match: RegExpExecArray | null

    while ((match = verseRegex.exec(xmlContent)) !== null) {
      const rawName = match[1]
      let groupName = 'Verso'
      if (/^v/i.test(rawName)) groupName = `Verso ${rawName.replace(/\D/g, '') || '1'}`
      else if (/^c/i.test(rawName)) groupName = 'Coro'
      else if (/^b/i.test(rawName)) groupName = 'Puente'
      else if (/^p/i.test(rawName)) groupName = 'Pre-Coro'
      else groupName = rawName

      const innerContent = match[2]
      // Extract <lines>...</lines>
      const linesMatch = innerContent.match(/<lines[^>]*>([\s\S]*?)<\/lines>/i)
      const rawLines = linesMatch ? linesMatch[1] : innerContent

      // Replace <br/> with newline and strip XML tags
      const cleanText = rawLines
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()

      if (cleanText) {
        groups.push({ name: groupName, content: cleanText })
      }
    }

    if (groups.length === 0) {
      return null
    }

    return {
      title,
      artist,
      ccliNumber,
      copyright,
      groups,
      totalSlides: groups.length,
      isDuplicate: false,
      originalFormat: 'openlyrics',
      filename
    }
  }

  /**
   * ProPresenter 6 (.pro6) XML Parser
   */
  public parseProPresenter6(xmlContent: string, filename: string): ImportedSongPreview | null {
    const titleMatch = xmlContent.match(/<RVSong[^>]*CCLISongTitle="([^"]+)"/i) || xmlContent.match(/<RVSong[^>]*category="([^"]+)"/i)
    const authorMatch = xmlContent.match(/<RVSong[^>]*(?:CCLIArtistName|author|artist)="([^"]+)"/i)
    const ccliMatch = xmlContent.match(/<RVSong[^>]*(?:CCLISongNumber|ccliNumber|ccli)="([^"]+)"/i)

    const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : path.basename(filename, path.extname(filename))
    const artist = authorMatch ? authorMatch[1].trim() : undefined
    const ccliNumber = ccliMatch ? ccliMatch[1].trim() : undefined

    // Extract slides from <RVDisplaySlide> elements
    const slideRegex = /<RVDisplaySlide[^>]*>([\s\S]*?)<\/RVDisplaySlide>/gi
    const groups: { name: string; content: string }[] = []
    let slideIdx = 1
    let slideMatch: RegExpExecArray | null

    while ((slideMatch = slideRegex.exec(xmlContent)) !== null) {
      const slideContent = slideMatch[1]
      // Check for plainText or RTFData attribute
      const plainTextMatch = slideContent.match(/plainText="([^"]+)"/i)
      let text = ''

      if (plainTextMatch) {
        try {
          text = Buffer.from(plainTextMatch[1], 'base64').toString('utf-8')
        } catch {
          text = plainTextMatch[1]
        }
      } else {
        // Look for RTFData
        const rtfMatch = slideContent.match(/RTFData="([^"]+)"/i)
        if (rtfMatch) {
          try {
            const rawRtf = Buffer.from(rtfMatch[1], 'base64').toString('utf-8')
            text = this.stripRtf(rawRtf)
          } catch {
            // fallback
          }
        }
      }

      if (text && text.trim().length > 0) {
        groups.push({
          name: `Diapositiva ${slideIdx++}`,
          content: text.trim()
        })
      }
    }

    if (groups.length === 0) {
      return null
    }

    return {
      title,
      artist,
      ccliNumber,
      groups,
      totalSlides: groups.length,
      isDuplicate: false,
      originalFormat: 'pro6',
      filename
    }
  }

  /**
   * Helper to strip RTF formatting to clean text
   */
  private stripRtf(rtf: string): string {
    return rtf
      .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
      .replace(/[{}\\]/g, '')
      .replace(/\r?\n\s*\r?\n/g, '\n')
      .trim()
  }

  /**
   * CSV Parser with header detection and multiline support
   */
  public parseCsv(content: string, filename: string): { songs: ImportedSongPreview[]; errors: string[] } {
    const rows = this.parseCsvRows(content)
    if (rows.length < 2) {
      return { songs: [], errors: ['El archivo CSV no contiene suficientes filas (encabezado + datos)'] }
    }

    const headers = rows[0].map((h) => h.toLowerCase().trim())
    const titleIdx = headers.findIndex((h) => h.includes('title') || h.includes('titulo') || h.includes('título') || h.includes('nombre'))
    const lyricsIdx = headers.findIndex((h) => h.includes('lyrics') || h.includes('letra') || h.includes('texto') || h.includes('content') || h.includes('cuerpo'))
    const artistIdx = headers.findIndex((h) => h.includes('artist') || h.includes('author') || h.includes('autor') || h.includes('compositor'))
    const ccliIdx = headers.findIndex((h) => h.includes('ccli'))
    const copyrightIdx = headers.findIndex((h) => h.includes('copyright') || h.includes('derechos'))

    if (titleIdx === -1 || lyricsIdx === -1) {
      return {
        songs: [],
        errors: [`El archivo CSV requiere al menos columnas de Título y Letra. Columnas encontradas: ${headers.join(', ')}`]
      }
    }

    const songs: ImportedSongPreview[] = []
    const errors: string[] = []

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const title = row[titleIdx]?.trim()
      const lyrics = row[lyricsIdx]?.trim()

      if (!title || !lyrics) {
        continue
      }

      const artist = artistIdx > -1 ? row[artistIdx]?.trim() : undefined
      const ccliNumber = ccliIdx > -1 ? row[ccliIdx]?.trim() : undefined
      const copyright = copyrightIdx > -1 ? row[copyrightIdx]?.trim() : undefined

      // Split lyrics by double newlines into groups
      const parts = lyrics.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      const groups = parts.map((part, pIdx) => ({
        name: `Verso ${pIdx + 1}`,
        content: part
      }))

      songs.push({
        title,
        artist: artist || undefined,
        ccliNumber: ccliNumber || undefined,
        copyright: copyright || undefined,
        groups: groups.length > 0 ? groups : [{ name: 'Verso 1', content: lyrics }],
        totalSlides: groups.length || 1,
        isDuplicate: false,
        originalFormat: 'csv',
        filename: `${filename}#${r}`
      })
    }

    return { songs, errors }
  }

  /**
   * Simple CSV row parser honoring quotes
   */
  private parseCsvRows(text: string): string[][] {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentCell = ''
    let inQuotes = false

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const nextChar = text[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell)
        currentCell = ''
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++
        currentRow.push(currentCell)
        currentCell = ''
        if (currentRow.some((c) => c.trim().length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
      } else {
        currentCell += char
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell)
      if (currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow)
      }
    }

    return rows
  }

  /**
   * Enriches preview with duplicate check against database
   */
  private enrichDuplicateStatus(preview: ImportedSongPreview): ImportedSongPreview {
    try {
      const existing = libraryService.getSongs().find((s) => s.title.trim().toLowerCase() === preview.title.trim().toLowerCase())
      if (existing) {
        preview.isDuplicate = true
        preview.existingSongId = existing.id
      }
    } catch {
      // ignore
    }
    return preview
  }

  /**
   * Executes the import of validated preview songs into the database
   */
  public executeImport(previews: ImportedSongPreview[], _targetLibraryId?: string): SongImportResult {
    let importedCount = 0
    let skippedDuplicates = 0
    let failedCount = 0
    const errors: { filename: string; reason: string }[] = []
    const importedSongs: Song[] = []

    for (const preview of previews) {
      try {
        const existing = libraryService.getSongs().find((s) => s.title.trim().toLowerCase() === preview.title.trim().toLowerCase())
        if (existing) {
          skippedDuplicates++
          continue
        }

        const songId = `song_import_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        // Convert preview groups to SongGroup model
        const groups: SongGroup[] = preview.groups.map((g, idx) => {
          let groupType: 'verse' | 'chorus' | 'bridge' | 'pre_chorus' | 'ending' = 'verse'
          const lowerName = g.name.toLowerCase()
          if (lowerName.includes('coro') || lowerName.includes('chorus')) groupType = 'chorus'
          else if (lowerName.includes('puente') || lowerName.includes('bridge')) groupType = 'bridge'
          else if (lowerName.includes('pre')) groupType = 'pre_chorus'
          else if (lowerName.includes('fin') || lowerName.includes('ending') || lowerName.includes('outro')) groupType = 'ending'

          return {
            id: `grp_${Date.now()}_${idx}`,
            songId,
            groupType,
            groupNumber: idx + 1,
            label: g.name,
            content: g.content,
            sortOrder: idx
          }
        })

        const now = new Date().toISOString()
        const newSong: Song = {
          id: songId,
          title: preview.title,
          author: preview.artist || 'Desconocido',
          copyright: preview.copyright || '',
          ccliNumber: preview.ccliNumber || '',
          language: 'es',
          tags: ['Importado', preview.originalFormat],
          groups,
          arrangements: [
            {
              id: `arr_${Date.now()}`,
              songId,
              name: 'Predeterminado',
              groupIds: groups.map((g) => g.id),
              isDefault: true
            }
          ],
          createdAt: now,
          updatedAt: now
        }

        libraryService.saveSong(newSong)
        importedSongs.push(newSong)
        importedCount++
      } catch (err: any) {
        failedCount++
        errors.push({
          filename: preview.filename || preview.title,
          reason: err?.message || String(err)
        })
      }
    }

    return {
      success: importedCount > 0,
      totalProcessed: previews.length,
      importedCount,
      skippedDuplicates,
      failedCount,
      errors,
      importedSongs
    }
  }
}

export const songImporterService = new SongImporterService()
