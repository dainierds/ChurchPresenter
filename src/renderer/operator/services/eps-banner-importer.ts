/**
 * EPS & Vector Banner Importer Service
 * Parses EPS (Encapsulated PostScript), SVG, and raster image files
 * into usable vector/raster overlay graphics for Church Presenter Lower Thirds.
 */

export interface ParsedBannerGraphic {
  id: string
  name: string
  type: 'eps' | 'svg' | 'raster'
  dataUrl: string
  width: number
  height: number
  aspectRatio: number
  hasVector: boolean
  rawSvg?: string
}

export class EpsBannerImporter {
  /**
   * Parse an EPS file from an ArrayBuffer
   */
  public static parseEpsArrayBuffer(buffer: ArrayBuffer, fileName: string): ParsedBannerGraphic {
    const bytes = new Uint8Array(buffer)

    // Check for DOS EPS binary header (0xC5, 0xD0, 0xD3, 0xC6)
    if (bytes.length >= 30 && bytes[0] === 0xc5 && bytes[1] === 0xd0 && bytes[2] === 0xd3 && bytes[3] === 0xc6) {
      const view = new DataView(buffer)
      const psOffset = view.getUint32(4, true)
      const psLength = view.getUint32(8, true)
      const tiffOffset = view.getUint32(20, true)
      const tiffLength = view.getUint32(24, true)

      // If an embedded TIFF preview is present, extract it
      if (tiffOffset > 0 && tiffLength > 0 && tiffOffset + tiffLength <= bytes.length) {
        const tiffBytes = bytes.slice(tiffOffset, tiffOffset + tiffLength)
        // Check if TIFF is actually JPEG/JFIF or standard TIFF
        const isJpeg = tiffBytes.length > 3 && tiffBytes[0] === 0xff && tiffBytes[1] === 0xd8
        const mime = isJpeg ? 'image/jpeg' : 'image/tiff'
        const base64 = this.uint8ArrayToBase64(tiffBytes)
        const dataUrl = `data:${mime};base64,${base64}`

        return {
          id: `banner_eps_${Date.now()}`,
          name: fileName,
          type: 'eps',
          dataUrl,
          width: 800,
          height: 180,
          aspectRatio: 800 / 180,
          hasVector: false
        }
      }

      // If no TIFF preview, extract PostScript section and parse as PostScript text
      if (psOffset > 0 && psLength > 0 && psOffset + psLength <= bytes.length) {
        const psBytes = bytes.slice(psOffset, psOffset + psLength)
        const psText = new TextDecoder('utf-8', { fatal: false }).decode(psBytes)
        return this.parsePostScriptText(psText, fileName)
      }
    }

    // Standard ASCII PostScript EPS
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    return this.parsePostScriptText(text, fileName)
  }

  /**
   * Parse ASCII PostScript EPS text into SVG
   */
  public static parsePostScriptText(psText: string, fileName: string): ParsedBannerGraphic {
    // 1. Extract BoundingBox
    const bbMatch = psText.match(/%%BoundingBox:\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i)
    let minX = 0
    let minY = 0
    let maxX = 800
    let maxY = 180

    if (bbMatch) {
      minX = parseFloat(bbMatch[1])
      minY = parseFloat(bbMatch[2])
      maxX = parseFloat(bbMatch[3])
      maxY = parseFloat(bbMatch[4])
    }

    const width = Math.max(20, Math.round(maxX - minX))
    const height = Math.max(10, Math.round(maxY - minY))
    const aspectRatio = width / height

    // 2. Check for embedded hex preview (BeginPreview ... EndPreview)
    const previewMatch = psText.match(/%BeginPreview:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)[\r\n]+([\s\S]*?)%EndPreview/i)
    if (previewMatch) {
      const pWidth = parseInt(previewMatch[1], 10) || width
      const pHeight = parseInt(previewMatch[2], 10) || height
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pWidth} ${pHeight}" width="${pWidth}" height="${pHeight}"><rect width="100%" height="100%" fill="#1e293b"/></svg>`
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
      return {
        id: `banner_eps_${Date.now()}`,
        name: fileName,
        type: 'eps',
        dataUrl,
        width: pWidth,
        height: pHeight,
        aspectRatio: pWidth / pHeight,
        hasVector: true,
        rawSvg: svg
      }
    }

    // 3. Extract basic PostScript vector shapes (paths, rectangles, colors)
    const svgElements: string[] = []
    const lines = psText.split(/[\r\n]+/)
    let currentFill = '#38bdf8'

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line || line.startsWith('%')) continue

      // RGB Color: r g b setrgbcolor OR r g b rg
      const rgbMatch = line.match(/^([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(?:setrgbcolor|rg)$/i)
      if (rgbMatch) {
        const r = Math.round(parseFloat(rgbMatch[1]) * 255)
        const g = Math.round(parseFloat(rgbMatch[2]) * 255)
        const b = Math.round(parseFloat(rgbMatch[3]) * 255)
        currentFill = `rgb(${r},${g},${b})`
        continue
      }

      // CMYK Color: c m y k setcmykcolor OR c m y k k
      const cmykMatch = line.match(/^([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(?:setcmykcolor|k)$/i)
      if (cmykMatch) {
        const c = parseFloat(cmykMatch[1])
        const m = parseFloat(cmykMatch[2])
        const y = parseFloat(cmykMatch[3])
        const k = parseFloat(cmykMatch[4])
        const r = Math.round(255 * (1 - c) * (1 - k))
        const g = Math.round(255 * (1 - m) * (1 - k))
        const b = Math.round(255 * (1 - y) * (1 - k))
        currentFill = `rgb(${r},${g},${b})`
        continue
      }

      // Rectangle: x y w h rectfill OR x y w h re f
      const rectMatch = line.match(/^([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+(?:rectfill|re\s+f)$/i)
      if (rectMatch) {
        const rx = parseFloat(rectMatch[1]) - minX
        const ry = maxY - (parseFloat(rectMatch[2]) + parseFloat(rectMatch[4])) // Invert Y
        const rw = parseFloat(rectMatch[3])
        const rh = parseFloat(rectMatch[4])
        svgElements.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${currentFill}" />`)
        continue
      }
    }

    // If PostScript commands yielded shapes, assemble SVG
    let svg: string
    if (svgElements.length > 0) {
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    ${svgElements.join('\n    ')}
  </g>
</svg>`
    } else {
      // Fallback clean modern vector lower-third background matching dimensions
      svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="60%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff7a00" />
      <stop offset="100%" stop-color="#ff9d3b" />
    </linearGradient>
  </defs>
  <!-- Background Body -->
  <path d="M 0,0 L ${width - 30},0 L ${width},${height} L 0,${height} Z" fill="url(#mainGrad)" />
  <!-- Left QR / Logo Badge Slot -->
  <rect x="8" y="8" width="${height - 16}" height="${height - 16}" rx="6" fill="#0284c7" />
  <!-- Accent bottom stripe -->
  <rect x="0" y="${height - 6}" width="${width}" height="6" fill="url(#accentGrad)" />
</svg>`
    }

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

    return {
      id: `banner_eps_${Date.now()}`,
      name: fileName,
      type: 'eps',
      dataUrl,
      width,
      height,
      aspectRatio,
      hasVector: true,
      rawSvg: svg
    }
  }

  /**
   * Parse an SVG text into a ParsedBannerGraphic
   */
  public static parseSvgText(svgText: string, fileName: string): ParsedBannerGraphic {
    const vbMatch = svgText.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)["']/i)
    let width = 800
    let height = 180

    if (vbMatch) {
      width = Math.round(parseFloat(vbMatch[3]))
      height = Math.round(parseFloat(vbMatch[4]))
    } else {
      const wMatch = svgText.match(/width=["'](\d+)["']/i)
      const hMatch = svgText.match(/height=["'](\d+)["']/i)
      if (wMatch && hMatch) {
        width = parseInt(wMatch[1], 10)
        height = parseInt(hMatch[1], 10)
      }
    }

    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`

    return {
      id: `banner_svg_${Date.now()}`,
      name: fileName,
      type: 'svg',
      dataUrl,
      width,
      height,
      aspectRatio: width / height,
      hasVector: true,
      rawSvg: svgText
    }
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
}
