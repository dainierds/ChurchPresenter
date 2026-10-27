import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { SongImporterService } from '../src/main/extras/song-importer-service'

describe('Phase 10: Song Importers (100% Offline Multi-Format)', () => {
  let importer: SongImporterService
  let tempDir: string

  beforeEach(() => {
    importer = new SongImporterService()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-song-import-test-'))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('parses Plain Text songs with Verso/Coro/Puente detection', async () => {
    const txtContent = `Grande es Tu Fidelidad
Autor: Thomas Chisholm
CCLI: 18723

[Verso 1]
Oh Dios eterno, tu misericordia
Ni una sombra de duda tendrá.

[Coro]
¡Grande es tu fidelidad!
¡Grande es tu fidelidad!
Cada mañana renuevas tu amor.

[Verso 2]
El sol y la luna con todas las estrellas
Cantan alegres tu gloria sin fin.
`
    const filePath = path.join(tempDir, 'fidelidad.txt')
    fs.writeFileSync(filePath, txtContent, 'utf-8')

    const res = await importer.parseFile(filePath)
    expect(res.success).toBe(true)
    expect(res.formatDetected).toContain('Texto')
    expect(res.previewSongs.length).toBe(1)

    const song = res.previewSongs[0]
    expect(song.title).toBe('Grande es Tu Fidelidad')
    expect(song.artist).toBe('Thomas Chisholm')
    expect(song.ccliNumber).toBe('18723')
    expect(song.groups.length).toBe(3)
    expect(song.groups[0].name).toBe('Verso 1')
    expect(song.groups[1].name).toBe('Coro')
    expect(song.groups[2].name).toBe('Verso 2')
  })

  it('parses ChordPro files, stripping bracketed chords and reading directives', async () => {
    const chordproContent = `{title: Sublimidad de Tu Gracia}
{artist: John Newton}
{ccli: 22025}
{comment: Verso 1}
[G]Sublime [C]gracia [G]del Señor
Que a un [Em]infeliz [D]salvó
Yo [G]ciego fui, mas [C]veo [G]hoy,
Per[Em]dido y [D]Él me ha[G]lló.

{comment: Coro}
[C]Gracia que al corazón en[G]señó
A [Em]temer y a con[D]fiar.
`
    const filePath = path.join(tempDir, 'sublime.chordpro')
    fs.writeFileSync(filePath, chordproContent, 'utf-8')

    const res = await importer.parseFile(filePath)
    expect(res.success).toBe(true)
    expect(res.formatDetected).toBe('ChordPro')
    expect(res.previewSongs.length).toBe(1)

    const song = res.previewSongs[0]
    expect(song.title).toBe('Sublimidad de Tu Gracia')
    expect(song.artist).toBe('John Newton')
    expect(song.ccliNumber).toBe('22025')
    expect(song.groups.length).toBe(2)
    // Chords must be stripped from projection slides
    expect(song.groups[0].content).not.toContain('[G]')
    expect(song.groups[0].content).toContain('Sublime gracia del Señor')
  })

  it('parses batch CSV song files with multiple rows and quotes', async () => {
    const csvContent = `"Título","Autor","CCLI","Letra"
"Cántico de Victoria","Moisés","1001","[Verso 1]\nCantaré yo a Jehová\nPorque se ha magnificado en gran manera."
"Salmo 23","David","1002","[Verso 1]\nJehová es mi pastor;\nNada me faltará."
`
    const filePath = path.join(tempDir, 'canciones.csv')
    fs.writeFileSync(filePath, csvContent, 'utf-8')

    const res = await importer.parseFile(filePath)
    expect(res.success).toBe(true)
    expect(res.formatDetected).toBe('CSV')
    expect(res.previewSongs.length).toBe(2)

    expect(res.previewSongs[0].title).toBe('Cántico de Victoria')
    expect(res.previewSongs[0].artist).toBe('Moisés')
    expect(res.previewSongs[1].title).toBe('Salmo 23')
    expect(res.previewSongs[1].artist).toBe('David')
  })

  it('parses OpenLyrics XML files with verses and lines tags', async () => {
    const openLyricsXml = `<?xml version="1.0" encoding="UTF-8"?>
<song xmlns="http://openlyrics.info/namespace/2009/song" version="0.8">
  <properties>
    <titles>
      <title>Castillo Fuerte es Nuestro Dios</title>
    </titles>
    <authors>
      <author>Martín Lutero</author>
    </authors>
    <ccliNo>123456</ccliNo>
  </properties>
  <lyrics>
    <verse name="v1">
      <lines>
        Castillo fuerte es nuestro Dios,<br/>
        Defensa y buen escudo.
      </lines>
    </verse>
    <verse name="c1">
      <lines>
        Luchad con furor,<br/>
        Dios nuestro amparo es.
      </lines>
    </verse>
  </lyrics>
</song>`

    const filePath = path.join(tempDir, 'castillo.xml')
    fs.writeFileSync(filePath, openLyricsXml, 'utf-8')

    const res = await importer.parseFile(filePath)
    expect(res.success).toBe(true)
    expect(res.formatDetected).toContain('OpenLyrics')
    expect(res.previewSongs.length).toBe(1)

    const song = res.previewSongs[0]
    expect(song.title).toBe('Castillo Fuerte es Nuestro Dios')
    expect(song.artist).toBe('Martín Lutero')
    expect(song.ccliNumber).toBe('123456')
    expect(song.groups.length).toBe(2)
    expect(song.groups[0].content).toContain('Castillo fuerte es nuestro Dios')
  })

  it('parses ProPresenter 6 (.pro6) XML with base64 encoded RTF text', async () => {
    // Plain RTF representation of "Alabad al Señor en las alturas"
    const rtfSample = '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Arial;}} \\f0\\fs24 Alabad al Senor en las alturas\\par }'
    const base64Rtf = Buffer.from(rtfSample).toString('base64')

    const pro6Xml = `<?xml version="1.0" encoding="utf-8"?>
<RVSong CCLLicense="" CCLISongTitle="Salmo de Alabanza" CCLIArtistName="Coro Asaf" CCLISongNumber="9988">
  <array rvXMLIvarName="groups">
    <RVSongGrouping name="Verso 1" color="0 0 1 1">
      <array rvXMLIvarName="slides">
        <RVDisplaySlide>
          <array rvXMLIvarName="displayElements">
            <RVTextElement RTFData="${base64Rtf}">
            </RVTextElement>
          </array>
        </RVDisplaySlide>
      </array>
    </RVSongGrouping>
  </array>
</RVSong>`

    const filePath = path.join(tempDir, 'alabanza.pro6')
    fs.writeFileSync(filePath, pro6Xml, 'utf-8')

    const res = await importer.parseFile(filePath)
    expect(res.success).toBe(true)
    expect(res.formatDetected).toContain('ProPresenter 6')
    expect(res.previewSongs.length).toBe(1)

    const song = res.previewSongs[0]
    expect(song.title).toBe('Salmo de Alabanza')
    expect(song.artist).toBe('Coro Asaf')
    expect(song.ccliNumber).toBe('9988')
    expect(song.groups.length).toBe(1)
    expect(song.groups[0].content).toContain('Alabad al Senor en las alturas')
  })
})
