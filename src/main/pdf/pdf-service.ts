import fs from 'fs'
import { logger } from '../logger'

export class PdfService {
  private pageCountCache = new Map<string, number>()

  /**
   * Retrieves page count of a PDF file.
   * Uses pdfjs-dist or fast header/trailer parsing with caching.
   */
  public async getPdfPageCount(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file does not exist: ${filePath}`)
    }

    if (this.pageCountCache.has(filePath)) {
      return this.pageCountCache.get(filePath)!
    }

    try {
      // Dynamic import of pdfjs-dist legacy build
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const data = new Uint8Array(fs.readFileSync(filePath))
      const loadingTask = pdfjsLib.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true
      })
      const doc = await loadingTask.promise
      const count = doc.numPages
      this.pageCountCache.set(filePath, count)
      logger.info(`PdfService: '${filePath}' has ${count} pages.`)
      return count
    } catch (err) {
      logger.warn(`PdfService pdfjs fallback parsing for: ${filePath}`, err)
      // Fast fallback: count /Type /Page occurrences in PDF buffer
      const buffer = fs.readFileSync(filePath)
      const content = buffer.toString('latin1')
      const matches = content.match(/\/Type\s*\/Page[^s]/g)
      const count = matches ? matches.length : 1
      this.pageCountCache.set(filePath, count)
      return count
    }
  }
}

export const pdfService = new PdfService()
