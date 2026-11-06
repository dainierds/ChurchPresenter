import { describe, it, expect } from 'vitest'
import { EpsBannerImporter } from '../src/renderer/operator/services/eps-banner-importer'

describe('EpsBannerImporter', () => {
  it('parses ASCII PostScript EPS with BoundingBox', () => {
    const epsText = `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: Adobe Illustrator
%%BoundingBox: 0 0 960 220
%%EndComments
0.1 0.5 0.9 setrgbcolor
0 0 960 220 rectfill
%%EOF`

    const parsed = EpsBannerImporter.parsePostScriptText(epsText, 'lower_third.eps')
    expect(parsed).toBeDefined()
    expect(parsed.name).toBe('lower_third.eps')
    expect(parsed.width).toBe(960)
    expect(parsed.height).toBe(220)
    expect(parsed.type).toBe('eps')
    expect(parsed.dataUrl.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('parses SVG text correctly', () => {
    const svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240"><rect width="100%" height="100%" fill="#FF7A00"/></svg>`
    const parsed = EpsBannerImporter.parseSvgText(svgText, 'banner.svg')
    expect(parsed).toBeDefined()
    expect(parsed.width).toBe(1200)
    expect(parsed.height).toBe(240)
    expect(parsed.type).toBe('svg')
    expect(parsed.dataUrl).toContain('image/svg+xml')
  })

  it('handles binary DOS EPS with embedded TIFF or PostScript', () => {
    // Construct 30-byte header
    const buffer = new ArrayBuffer(50)
    const view = new DataView(buffer)
    const bytes = new Uint8Array(buffer)

    // Magic number 0xC5, 0xD0, 0xD3, 0xC6
    bytes[0] = 0xc5
    bytes[1] = 0xd0
    bytes[2] = 0xd3
    bytes[3] = 0xc6

    // PS Offset 30, length 20
    view.setUint32(4, 30, true)
    view.setUint32(8, 20, true)

    // Put PostScript string in buffer at offset 30
    const psStr = '%!PS-Adobe-3.0 EPSF'
    for (let i = 0; i < psStr.length; i++) {
      bytes[30 + i] = psStr.charCodeAt(i)
    }

    const parsed = EpsBannerImporter.parseEpsArrayBuffer(buffer, 'vector_graphic.eps')
    expect(parsed).toBeDefined()
    expect(parsed.name).toBe('vector_graphic.eps')
    expect(parsed.type).toBe('eps')
  })
})
