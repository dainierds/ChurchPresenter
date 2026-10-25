/**
 * PowerPoint (.pptx, .pptm, .ppsx) Native Inspector & Parser (Phase 5B)
 *
 * Reads speaker notes directly from the underlying OPC XML/ZIP package without requiring Office.
 * Inspects presentation structure for fidelity warnings:
 * - Slide animations
 * - Slide transitions
 * - Embedded audio / video
 * - Missing fonts (compared against Windows installed fonts)
 */

import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'
import { logger } from '../logger'

export interface SlideFidelityWarning {
  slideIndex: number
  hasAnimations: boolean
  hasTransitions: boolean
  hasEmbeddedMedia: boolean
  missingFonts: string[]
  details: string[]
}

export interface PptxAnalysisResult {
  slideCount: number
  speakerNotes: Record<number, string> // slide index (1-based) -> notes text
  fontsUsed: string[]
  missingFonts: string[]
  warnings: SlideFidelityWarning[]
  globalWarning?: string
}

let cachedInstalledFonts: Set<string> | null = null

/**
 * Discovers fonts installed in Windows (C:\Windows\Fonts).
 */
export function getInstalledWindowsFonts(): Set<string> {
  if (cachedInstalledFonts) return cachedInstalledFonts

  const fontNames = new Set<string>()
  // Always include standard universal Windows fonts
  const standardFonts = [
    'arial',
    'calibri',
    'cambria',
    'comic sans ms',
    'consolas',
    'constantia',
    'corbel',
    'courier new',
    'georgia',
    'impact',
    'lucida console',
    'lucida sans unicode',
    'microsoft sans serif',
    'palatino linotype',
    'segoe ui',
    'tahoma',
    'times new roman',
    'trebuchet ms',
    'verdana'
  ]
  standardFonts.forEach((f) => fontNames.add(f))

  const winFontsDir = 'C:\\Windows\\Fonts'
  try {
    if (fs.existsSync(winFontsDir)) {
      const files = fs.readdirSync(winFontsDir)
      for (const file of files) {
        // e.g. "arial.ttf" -> "arial", "calibri.ttf" -> "calibri"
        const base = path.basename(file, path.extname(file)).toLowerCase()
        fontNames.add(base)
        // Strip suffixes like "bd", "bi", "i" (bold, italic)
        const stripped = base.replace(/([_-]?(regular|bold|italic|light|black|medium|semibold|b|i|bi|bd))+$/g, '').trim()
        if (stripped) fontNames.add(stripped)
      }
    }
  } catch (err) {
    logger.warn('Could not read Windows Fonts folder:', err)
  }

  cachedInstalledFonts = fontNames
  return fontNames
}

export class PptxParser {
  /**
   * Inspects a .pptx/.pptm/.ppsx archive and extracts speaker notes and fidelity diagnostics.
   */
  public parsePptx(filePath: string): PptxAnalysisResult {
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo de PowerPoint no existe: ${filePath}`)
    }

    const zip = new AdmZip(filePath)
    const zipEntries = zip.getEntries()

    // 1. Discover all slide XML entries and map slide numbers
    const slideEntries: { index: number; name: string; content: string }[] = []
    const notesMap: Record<number, string> = {}
    const allFontsUsed = new Set<string>()
    const warnings: SlideFidelityWarning[] = []

    for (const entry of zipEntries) {
      const entryName = entry.entryName.replace(/\\/g, '/')

      // Matches ppt/slides/slide1.xml, ppt/slides/slide2.xml, etc.
      const slideMatch = entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/i)
      if (slideMatch) {
        const slideIndex = parseInt(slideMatch[1], 10)
        const text = entry.getData().toString('utf-8')
        slideEntries.push({ index: slideIndex, name: entryName, content: text })
      }
    }

    // Sort slides by index
    slideEntries.sort((a, b) => a.index - b.index)
    const slideCount = slideEntries.length

    // 2. Discover slide relationships to find speaker notes slides
    // ppt/slides/_rels/slide1.xml.rels -> Target="../notesSlides/notesSlide1.xml"
    const installedFonts = getInstalledWindowsFonts()

    for (const s of slideEntries) {
      const relsEntryName = `ppt/slides/_rels/slide${s.index}.xml.rels`
      const relsEntry = zip.getEntry(relsEntryName)

      if (relsEntry) {
        const relsXml = relsEntry.getData().toString('utf-8')
        // Look for relationship with Type containing notesSlide
        const notesMatch = relsXml.match(/Type="[^"]*\/notesSlide"\s+Target="([^"]+)"/i)
        if (notesMatch) {
          let target = notesMatch[1].replace(/\\/g, '/')
          // Target could be "../notesSlides/notesSlide1.xml" or "notesSlides/notesSlide1.xml"
          if (target.startsWith('../')) {
            target = `ppt/${target.substring(3)}`
          } else if (!target.startsWith('ppt/')) {
            target = `ppt/slides/${target}`
          }

          const notesEntry = zip.getEntry(target)
          if (notesEntry) {
            const notesXml = notesEntry.getData().toString('utf-8')
            const extractedNotes = this.extractTextFromXml(notesXml)
            if (extractedNotes.trim()) {
              notesMap[s.index] = extractedNotes.trim()
            }
          }
        }
      }

      // 3. Fidelity Warning Checks on Slide XML
      const xml = s.content
      const hasAnimations = /<p:timing|<p:anim|<p:cMediaNode|<p:seq|<p:bldLst/i.test(xml)
      const hasTransitions = /<p:transition/i.test(xml)
      const hasEmbeddedMedia = /<p:videoFile|<a:videoFile|<a:audioFile|<p:video|<p:audio|<a:quickTime/i.test(xml)

      // Extract fonts used
      const slideFonts = new Set<string>()
      const fontMatches = xml.matchAll(/typeface="([^"]+)"/g)
      for (const m of fontMatches) {
        const fontName = m[1].trim()
        if (fontName && !fontName.startsWith('+mj-') && !fontName.startsWith('+mn-')) {
          allFontsUsed.add(fontName)
          slideFonts.add(fontName)
        }
      }

      const missingForSlide: string[] = []
      for (const f of slideFonts) {
        const norm = f.toLowerCase().replace(/\s+/g, '')
        let found = false
        for (const inst of installedFonts) {
          if (inst.replace(/\s+/g, '') === norm || inst.includes(norm) || norm.includes(inst)) {
            found = true
            break
          }
        }
        if (!found) {
          missingForSlide.push(f)
        }
      }

      const details: string[] = []
      if (hasAnimations) {
        details.push('Contiene animaciones de objetos que se proyectarán como elementos estáticos.')
      }
      if (hasTransitions) {
        details.push('Contiene transiciones automáticas de diapositiva.')
      }
      if (hasEmbeddedMedia) {
        details.push('Contiene video o audio incrustado. Se recomienda importar el medio aparte.')
      }
      if (missingForSlide.length > 0) {
        details.push(`Fuentes no instaladas en esta PC: ${missingForSlide.join(', ')}.`)
      }

      if (details.length > 0) {
        warnings.push({
          slideIndex: s.index,
          hasAnimations,
          hasTransitions,
          hasEmbeddedMedia,
          missingFonts: missingForSlide,
          details
        })
      }
    }

    // Global missing fonts summary
    const globalMissingFonts: string[] = []
    for (const f of allFontsUsed) {
      const norm = f.toLowerCase().replace(/\s+/g, '')
      let found = false
      for (const inst of installedFonts) {
        if (inst.replace(/\s+/g, '') === norm || inst.includes(norm) || norm.includes(inst)) {
          found = true
          break
        }
      }
      if (!found) {
        globalMissingFonts.push(f)
      }
    }

    let globalWarning: string | undefined
    if (warnings.length > 0) {
      globalWarning =
        'Esta presentación contiene animaciones, transiciones, medios incrustados o fuentes no instaladas. La proyección se realizará mediante diapositivas estáticas de alta resolución.'
    }

    return {
      slideCount,
      speakerNotes: notesMap,
      fontsUsed: Array.from(allFontsUsed),
      missingFonts: globalMissingFonts,
      warnings,
      globalWarning
    }
  }

  /**
   * Helper to extract clean text from OpenXML drawing/text paragraphs.
   */
  private extractTextFromXml(xml: string): string {
    const textPieces: string[] = []
    // Match paragraphs <a:p>...</a:p>
    const pRegex = /<a:p[\s>]([\s\S]*?)<\/a:p>/gi
    let pMatch: RegExpExecArray | null

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[1]
      const tRegex = /<a:t>([\s\S]*?)<\/a:t>/gi
      let tMatch: RegExpExecArray | null
      const paragraphPieces: string[] = []

      while ((tMatch = tRegex.exec(pContent)) !== null) {
        paragraphPieces.push(tMatch[1])
      }

      const pText = paragraphPieces.join('').trim()
      // Filter out slide number placeholders like "‹#›" or page numbers
      if (pText && !pText.includes('‹#›') && !pText.match(/^\d+$/)) {
        textPieces.push(pText)
      }
    }

    return textPieces.join('\n')
  }
}

export const pptxParser = new PptxParser()
