import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import {
  BackgroundImageItem,
  GenericPresentation,
  LibraryExportData,
  ServicePlan,
  Song,
  SongArrangement,
  SongGroup,
  ThemeConfig,
  DEFAULT_THEME
} from '../shared/types'
import { parseLyricsToGroups } from '../shared/song-parser'
import { parseAndValidateLibraryJson, serializeLibraryToJson } from '../shared/backup-export-utils'
import { databaseService } from './db/database-service'
import { logger } from './logger'

export class LibraryService {
  private backgroundsDir: string = ''

  constructor() {
    try {
      const userData = app.getPath('userData')
      this.backgroundsDir = path.join(userData, 'backgrounds')
    } catch {
      this.backgroundsDir = path.resolve(process.cwd(), 'backgrounds')
    }
    if (!fs.existsSync(this.backgroundsDir)) {
      fs.mkdirSync(this.backgroundsDir, { recursive: true })
    }
  }

  public initialize(): void {
    // Seed initial themes if none exist
    const existingThemes = this.getThemes()
    if (existingThemes.length === 0) {
      this.saveTheme(DEFAULT_THEME)
      this.saveTheme({
        ...DEFAULT_THEME,
        id: 'theme-warm-gold',
        name: 'Dorado Cálido',
        isDefault: false,
        background: {
          type: 'gradient',
          value: 'linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)'
        }
      })
      this.saveTheme({
        ...DEFAULT_THEME,
        id: 'theme-forest-green',
        name: 'Paz Profunda',
        isDefault: false,
        background: {
          type: 'gradient',
          value: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)'
        }
      })
    }

    // Seed initial songs and templates if library is empty
    const existingSongs = this.getSongs()
    if (existingSongs.length === 0) {
      this.seedInitialContent()
    }
  }

  // --- SONGS ---

  public getSongs(): Song[] {
    const songRows = databaseService.query('SELECT * FROM songs ORDER BY title ASC;')
    const groupRows = databaseService.query('SELECT * FROM song_groups ORDER BY sort_order ASC;')
    const arrangementRows = databaseService.query('SELECT * FROM song_arrangements;')

    const groupsBySong = new Map<string, SongGroup[]>()
    for (const r of groupRows) {
      const songId = String(r.song_id)
      if (!groupsBySong.has(songId)) groupsBySong.set(songId, [])
      groupsBySong.get(songId)!.push({
        id: String(r.id),
        songId,
        groupType: r.group_type,
        groupNumber: Number(r.group_number),
        label: String(r.label),
        content: String(r.content),
        sortOrder: Number(r.sort_order)
      })
    }

    const arrangementsBySong = new Map<string, SongArrangement[]>()
    for (const r of arrangementRows) {
      const songId = String(r.song_id)
      if (!arrangementsBySong.has(songId)) arrangementsBySong.set(songId, [])
      let groupIds: string[] = []
      try {
        groupIds = JSON.parse(String(r.group_order))
      } catch {
        groupIds = []
      }
      arrangementsBySong.get(songId)!.push({
        id: String(r.id),
        songId,
        name: String(r.name),
        groupIds,
        isDefault: Boolean(r.is_default)
      })
    }

    return songRows.map((s) => ({
      id: String(s.id),
      title: String(s.title),
      author: String(s.author || ''),
      copyright: String(s.copyright || ''),
      ccliNumber: s.ccli_number ? String(s.ccli_number) : undefined,
      language: String(s.language || 'es'),
      tags: s.tags ? String(s.tags).split(',').map((t) => t.trim()).filter((t) => t.length > 0) : [],
      groups: groupsBySong.get(String(s.id)) || [],
      arrangements: arrangementsBySong.get(String(s.id)) || [],
      linesPerSlide: 4,
      createdAt: String(s.created_at),
      updatedAt: String(s.updated_at)
    }))
  }

  public getSongById(id: string): Song | null {
    return this.getSongs().find((s) => s.id === id) || null
  }

  public saveSong(song: Song): Song {
    const tagsStr = (song.tags || []).join(',')

    databaseService.run(
      `INSERT INTO songs (id, title, author, copyright, ccli_number, language, tags, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         author = excluded.author,
         copyright = excluded.copyright,
         ccli_number = excluded.ccli_number,
         language = excluded.language,
         tags = excluded.tags,
         updated_at = datetime('now');`,
      [song.id, song.title, song.author, song.copyright, song.ccliNumber || '', song.language || 'es', tagsStr]
    )

    // Clear existing groups & arrangements and re-insert
    databaseService.run('DELETE FROM song_groups WHERE song_id = ?;', [song.id])
    databaseService.run('DELETE FROM song_arrangements WHERE song_id = ?;', [song.id])

    for (const g of song.groups) {
      databaseService.run(
        `INSERT INTO song_groups (id, song_id, group_type, group_number, label, content, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [g.id, song.id, g.groupType, g.groupNumber, g.label, g.content, g.sortOrder]
      )
    }

    for (const a of song.arrangements) {
      databaseService.run(
        `INSERT INTO song_arrangements (id, song_id, name, group_order, is_default)
         VALUES (?, ?, ?, ?, ?);`,
        [a.id, song.id, a.name, JSON.stringify(a.groupIds), a.isDefault ? 1 : 0]
      )
    }

    logger.info(`Saved song '${song.title}' (${song.id})`)
    return song
  }

  public deleteSong(id: string): boolean {
    databaseService.run('DELETE FROM songs WHERE id = ?;', [id])
    databaseService.run('DELETE FROM song_groups WHERE song_id = ?;', [id])
    databaseService.run('DELETE FROM song_arrangements WHERE song_id = ?;', [id])
    logger.info(`Deleted song ${id}`)
    return true
  }

  // --- GENERIC PRESENTATIONS ---

  public getPresentations(): GenericPresentation[] {
    const rows = databaseService.query('SELECT * FROM generic_presentations ORDER BY title ASC;')
    return rows.map((r) => {
      let slides = []
      try {
        slides = JSON.parse(String(r.slides_json))
      } catch {
        slides = []
      }
      return {
        id: String(r.id),
        title: String(r.title),
        description: String(r.description || ''),
        slides,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at)
      }
    })
  }

  public savePresentation(p: GenericPresentation): GenericPresentation {
    databaseService.run(
      `INSERT INTO generic_presentations (id, title, description, slides_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         slides_json = excluded.slides_json,
         updated_at = datetime('now');`,
      [p.id, p.title, p.description, JSON.stringify(p.slides)]
    )
    logger.info(`Saved presentation '${p.title}' (${p.id})`)
    return p
  }

  public deletePresentation(id: string): boolean {
    databaseService.run('DELETE FROM generic_presentations WHERE id = ?;', [id])
    logger.info(`Deleted presentation ${id}`)
    return true
  }

  // --- THEMES ---

  public getThemes(): ThemeConfig[] {
    const rows = databaseService.query('SELECT * FROM themes ORDER BY is_default DESC, name ASC;')
    return rows.map((r) => {
      try {
        const parsed = JSON.parse(String(r.config_json))
        return {
          ...parsed,
          id: String(r.id),
          name: String(r.name),
          isDefault: Boolean(r.is_default)
        }
      } catch {
        return {
          ...DEFAULT_THEME,
          id: String(r.id),
          name: String(r.name),
          isDefault: Boolean(r.is_default)
        }
      }
    })
  }

  public saveTheme(theme: ThemeConfig): ThemeConfig {
    if (theme.isDefault) {
      databaseService.run('UPDATE themes SET is_default = 0;')
    }

    databaseService.run(
      `INSERT INTO themes (id, name, is_default, config_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         is_default = excluded.is_default,
         config_json = excluded.config_json,
         updated_at = datetime('now');`,
      [theme.id, theme.name, theme.isDefault ? 1 : 0, JSON.stringify(theme)]
    )
    logger.info(`Saved theme '${theme.name}' (${theme.id})`)
    return theme
  }

  public setDefaultTheme(id: string): boolean {
    databaseService.run('UPDATE themes SET is_default = 0;')
    databaseService.run('UPDATE themes SET is_default = 1 WHERE id = ?;', [id])
    return true
  }

  // --- BACKGROUND IMAGES ---

  public getBackgroundImages(): BackgroundImageItem[] {
    const rows = databaseService.query('SELECT * FROM background_images ORDER BY created_at DESC;')
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      originalFilename: String(r.original_filename),
      filePath: String(r.file_path),
      url: `file://${String(r.file_path).replace(/\\/g, '/')}`,
      createdAt: String(r.created_at)
    }))
  }

  public importBackgroundImage(sourcePath: string, name?: string): BackgroundImageItem {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`El archivo de origen no existe: ${sourcePath}`)
    }

    const ext = path.extname(sourcePath)
    const baseName = path.basename(sourcePath, ext)
    const id = `bg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const targetFileName = `${id}${ext}`
    const targetPath = path.join(this.backgroundsDir, targetFileName)

    fs.copyFileSync(sourcePath, targetPath)

    const displayName = name || baseName
    databaseService.run(
      `INSERT INTO background_images (id, name, original_filename, file_path)
       VALUES (?, ?, ?, ?);`,
      [id, displayName, path.basename(sourcePath), targetPath]
    )

    logger.info(`Imported background image '${displayName}' to ${targetPath}`)
    return {
      id,
      name: displayName,
      originalFilename: path.basename(sourcePath),
      filePath: targetPath,
      url: `file://${targetPath.replace(/\\/g, '/')}`,
      createdAt: new Date().toISOString()
    }
  }

  public deleteBackgroundImage(id: string): boolean {
    const row = databaseService.queryOne('SELECT file_path FROM background_images WHERE id = ?;', [id])
    if (row && row.file_path && fs.existsSync(row.file_path)) {
      try {
        fs.unlinkSync(row.file_path)
      } catch (err) {
        logger.error(`Error deleting background file ${row.file_path}:`, err)
      }
    }
    databaseService.run('DELETE FROM background_images WHERE id = ?;', [id])
    return true
  }

  // --- SERVICES & TEMPLATES ---

  public getServices(): ServicePlan[] {
    const rows = databaseService.query('SELECT * FROM services ORDER BY is_template DESC, date DESC, name ASC;')
    return rows.map((r) => {
      let items = []
      try {
        items = JSON.parse(String(r.items_json))
      } catch {
        items = []
      }
      return {
        id: String(r.id),
        name: String(r.name),
        date: String(r.date),
        items,
        isTemplate: Boolean(r.is_template),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at)
      }
    })
  }

  public getTemplates(): ServicePlan[] {
    return this.getServices().filter((s) => s.isTemplate)
  }

  public saveService(service: ServicePlan): ServicePlan {
    databaseService.run(
      `INSERT INTO services (id, name, date, items_json, is_template, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         date = excluded.date,
         items_json = excluded.items_json,
         is_template = excluded.is_template,
         updated_at = datetime('now');`,
      [service.id, service.name, service.date, JSON.stringify(service.items), service.isTemplate ? 1 : 0]
    )
    logger.info(`Saved service '${service.name}' (template: ${service.isTemplate})`)
    return service
  }

  public deleteService(id: string): boolean {
    databaseService.run('DELETE FROM services WHERE id = ?;', [id])
    logger.info(`Deleted service ${id}`)
    return true
  }

  // --- EXPORT & IMPORT ---

  public exportLibrary(): string {
    const exportData: LibraryExportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      songs: this.getSongs(),
      presentations: this.getPresentations(),
      themes: this.getThemes(),
      services: this.getServices()
    }

    return serializeLibraryToJson(exportData)
  }

  public importLibrary(jsonData: string): { importedSongs: number; importedPresentations: number } {
    const data = parseAndValidateLibraryJson(jsonData)

    let songCount = 0
    for (const song of data.songs) {
      this.saveSong(song)
      songCount++
    }

    let presCount = 0
    for (const pres of data.presentations) {
      this.savePresentation(pres)
      presCount++
    }

    for (const theme of data.themes) {
      this.saveTheme(theme)
    }

    if (data.services) {
      for (const s of data.services) {
        this.saveService(s)
      }
    }

    logger.info(`Imported library backup: ${songCount} songs, ${presCount} presentations.`)
    return {
      importedSongs: songCount,
      importedPresentations: presCount
    }
  }

  // --- INITIAL CONTENT SEEDING (6 Worship Songs & Sunday Template) ---

  private seedInitialContent(): void {
    logger.info('Seeding initial church songs library and Sunday worship service template...')

    const initialSongs = [
      {
        title: 'Cuán Grande es Él',
        author: 'Carl Boberg',
        tags: ['Himno', 'Adoración'],
        lyrics: `Verso 1
Señor mi Dios, al contemplar los cielos
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

Verso 3
Cuando recuerdo del amor divino
Que desde el cielo al Salvador envió
Aquel Jesús que por salvarme vino
Y en una cruz por mí murió`
      },
      {
        title: 'Cantaré de tu Amor por Siempre',
        author: 'Martin Smith',
        tags: ['Alabanza', 'Gratitud'],
        lyrics: `Verso 1
Sobre los montes y el mar
Tu río de amor fluye hacia mí
Y abriré mi corazón
Para que el sanador me haga libre

Coro
Cantaré de tu amor por siempre
Cantaré de tu amor por siempre
Cantaré de tu amor por siempre
Cantaré de tu amor por siempre

Puente
Quisiera celebrar con gozo en el corazón
Y cuando el mundo vea tu luz
Danzarán de gozo como nosotros hoy`
      },
      {
        title: 'En la Cruz Hay Salvación',
        author: 'Isaac Watts / Ralph E. Hudson',
        tags: ['Himno', 'Redención'],
        lyrics: `Verso 1
Me hirió el pecado, fui a Jesús
Mostréle mi dolor
Perdido errante vi su luz
Bendíjome en su amor

Coro
En la cruz, en la cruz
Do primero vi la luz
Y las manchas de mi alma yo lavé
Fue allí por fe do vi a Jesús
Y siempre feliz con Él seré

Verso 2
Sobre una cruz mi Salvador
Su sangre derramó
Por este pobre pecador
A quien así salvó`
      },
      {
        title: 'Al Contemplar la Excelsa Cruz',
        author: 'Isaac Watts',
        tags: ['Himno', 'Comunión'],
        lyrics: `Verso 1
Al contemplar la excelsa cruz
Do el Rey de gloria sucumbió
Cuanto estimaba tengo en poco
Y todo orgullo desprecio

Coro
¡Oh qué amor tan grande y santo!
Exige mi alma y todo mi ser
A ti me entrego, Dios bendito
Tu dulce gracia he de tener

Verso 2
Mira en su frente, manos, pies
Preciosa sangre cómo fluye
Corona tal de espinas crueles
Nadie en la tierra conoció`
      },
      {
        title: 'A Ti Sea la Gloria',
        author: 'Marcos Witt',
        tags: ['Adoración', 'Soberanía'],
        lyrics: `Verso 1
No existen fuerzas ni poder
Que puedan con tu majestad
El universo canta a una voz
Tú eres Santo, Señor

Coro
A ti sea la gloria, honra y honor
A ti sea el dominio por siempre Señor
Grande y temible en poderío
Nadie se iguala a ti, Dios mío

Puente
Por los siglos de los siglos
Reinarás Jesús, reinarás Señor`
      },
      {
        title: 'Gracia Sublime Es',
        author: 'Phil Wickham',
        tags: ['Alabanza', 'Victoria'],
        lyrics: `Verso 1
¿Quién rompe el poder del pecado?
Su amor es fuerte y poderoso
El Rey de gloria, el Rey de majestad

Coro
Gracia sublime es, perfecto es su amor
Tomó mi lugar, cargó con mi cruz
Su vida entregó, libre soy en Jesús
Todo lo que hago es para honrarte a ti

Verso 2
¿Quién sacude la tierra con truenos?
¿Y nos asombra con maravillas?
El Rey de gloria, el Rey de majestad`
      }
    ]

    const createdSongs: Song[] = []

    for (let i = 0; i < initialSongs.length; i++) {
      const item = initialSongs[i]
      const songId = `song_seed_${i + 1}`
      const groups = parseLyricsToGroups(item.lyrics, songId)
      const defaultArrangement: SongArrangement = {
        id: `arr_${songId}_default`,
        songId,
        name: 'Arreglo Predeterminado',
        groupIds: groups.map((g) => g.id),
        isDefault: true
      }

      const song: Song = {
        id: songId,
        title: item.title,
        author: item.author,
        copyright: 'Uso congregacional interno',
        language: 'es',
        tags: item.tags,
        groups,
        arrangements: [defaultArrangement],
        linesPerSlide: 4,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      this.saveSong(song)
      createdSongs.push(song)
    }

    // Seed Announcements Presentation
    const presId = 'pres_anuncios_seed'
    const announcements: GenericPresentation = {
      id: presId,
      title: 'Avisos Semanales y Bienvenida',
      description: 'Anuncios oficiales para el servicio dominical',
      slides: [
        {
          id: 'sl_seed_1',
          title: 'Bienvenidos a ChurchPresenter',
          body: 'Nos gozamos de adorar juntos hoy.\n"Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía."'
        },
        {
          id: 'sl_seed_2',
          title: 'Estudio Bíblico y Oración',
          body: '• Miércoles 7:30 PM: Escuela Bíblica y Clamor\n• Viernes 7:00 PM: Reunión de Jóvenes en el Salón Principal\n• Sábado 8:00 AM: Desayuno de Varones'
        },
        {
          id: 'sl_seed_3',
          title: 'Ministerio de Niños (Semillero de Fe)',
          body: 'Las clases para niños de 3 a 11 años inician inmediatamente tras el tiempo de alabanza y adoración.'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.savePresentation(announcements)

    // Seed Sunday Service Template with 6 songs and announcements
    const sundayTemplate: ServicePlan = {
      id: 'tpl_domingo_general',
      name: 'Plantilla Culto Dominical Completo',
      date: new Date().toISOString().split('T')[0],
      isTemplate: true,
      items: [
        { id: 'item_1', type: 'header', name: 'PRELUDIO Y BIENVENIDA' },
        { id: 'item_2', type: 'presentation', name: 'Avisos Semanales y Bienvenida', presentationId: presId },
        { id: 'item_3', type: 'blank', name: 'Pausa en Blanco' },
        { id: 'item_4', type: 'header', name: 'BLOQUE DE ALABANZA Y ADORACIÓN' },
        { id: 'item_5', type: 'song', name: createdSongs[0].title, songId: createdSongs[0].id, arrangementId: createdSongs[0].arrangements[0].id },
        { id: 'item_6', type: 'song', name: createdSongs[1].title, songId: createdSongs[1].id, arrangementId: createdSongs[1].arrangements[0].id },
        { id: 'item_7', type: 'song', name: createdSongs[2].title, songId: createdSongs[2].id, arrangementId: createdSongs[2].arrangements[0].id },
        { id: 'item_8', type: 'header', name: 'OFRENDA Y GRATITUD' },
        { id: 'item_9', type: 'song', name: createdSongs[3].title, songId: createdSongs[3].id, arrangementId: createdSongs[3].arrangements[0].id },
        { id: 'item_10', type: 'header', name: 'MENSAJE DE LA PALABRA' },
        { id: 'item_11', type: 'blank', name: 'Pantalla en Blanco (Predicación)' },
        { id: 'item_12', type: 'header', name: 'MINISTRACIÓN Y DESPEDIDA' },
        { id: 'item_13', type: 'song', name: createdSongs[4].title, songId: createdSongs[4].id, arrangementId: createdSongs[4].arrangements[0].id },
        { id: 'item_14', type: 'song', name: createdSongs[5].title, songId: createdSongs[5].id, arrangementId: createdSongs[5].arrangements[0].id }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.saveService(sundayTemplate)

    logger.info('Finished seeding initial content.')
  }
}

export const libraryService = new LibraryService()
