const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

function normalizeText(text) {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

async function buildFactoryBible(options) {
  const { sourceUrl, targetFile, id, name, abbrev, language, copyright, licenseNotice, tableName } = options
  console.log(`\nDescargando y construyendo Biblia: ${name} (${abbrev})...`)

  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${sourceUrl}`)
  const arrayBuf = await res.arrayBuffer()

  const SQL = await initSqlJs()
  const sourceDb = new SQL.Database(new Uint8Array(arrayBuf))
  const targetDb = new SQL.Database()

  // Create target schema
  targetDb.run(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE verses (
      id INTEGER PRIMARY KEY,
      book_number INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL,
      normalized_text TEXT NOT NULL
    );

    CREATE INDEX idx_book_chap_verse ON verses(book_number, chapter, verse);
    CREATE INDEX idx_norm_text ON verses(normalized_text);
    CREATE VIRTUAL TABLE verses_fts USING fts4(normalized_text);
  `)

  // Extract unique 31,102 verses
  console.log(`Extrayendo versículos de ${tableName}...`)
  const rows = sourceDb.exec(`
    SELECT book_id, chapter, verse, text
    FROM ${tableName}
    GROUP BY book_id, chapter, verse
    ORDER BY book_id ASC, chapter ASC, verse ASC;
  `)

  const verseList = rows[0]?.values || []
  console.log(`Versículos únicos encontrados: ${verseList.length}`)

  targetDb.run('BEGIN TRANSACTION;')

  for (let i = 0; i < verseList.length; i++) {
    const [bookId, chapter, verse, rawText] = verseList[i]
    const text = String(rawText || '').trim()
    const norm = normalizeText(text)
    const verseId = bookId * 1000000 + chapter * 1000 + verse

    targetDb.run(
      'INSERT INTO verses (id, book_number, chapter, verse, text, normalized_text) VALUES (?, ?, ?, ?, ?, ?);',
      [verseId, bookId, chapter, verse, text, norm]
    )
    targetDb.run(
      'INSERT INTO verses_fts (rowid, normalized_text) VALUES (?, ?);',
      [verseId, norm]
    )
  }

  // Insert metadata
  const metaEntries = [
    ['id', id],
    ['name', name],
    ['abbrev', abbrev],
    ['language', language],
    ['copyright', copyright],
    ['license_notice', licenseNotice],
    ['is_public_domain', '1'],
    ['verse_count', String(verseList.length)]
  ]

  for (const [k, v] of metaEntries) {
    targetDb.run('INSERT INTO metadata (key, value) VALUES (?, ?);', [k, v])
  }

  targetDb.run('COMMIT;')

  // Export and write to disk
  const exported = targetDb.export()
  const dir = path.dirname(targetFile)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(targetFile, Buffer.from(exported))

  const stat = fs.statSync(targetFile)
  console.log(`¡Archivo generado exitosamente!: ${targetFile} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`)

  sourceDb.close()
  targetDb.close()
}

async function main() {
  const resourcesDir = path.resolve(__dirname, '..', 'resources', 'bibles')

  // 1. Reina-Valera 1909 (Spanish Public Domain)
  await buildFactoryBible({
    sourceUrl: 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/sqlite/SpaRV.db',
    targetFile: path.join(resourcesDir, 'RVR1909.bible'),
    id: 'bible_rvr1909',
    name: 'Reina-Valera 1909',
    abbrev: 'RVR1909',
    language: 'es',
    copyright: 'Dominio Público',
    licenseNotice: 'Texto bíblico de Dominio Público en español (Revisión de 1909 de Casiodoro de Reina y Cipriano de Valera).',
    tableName: 'SpaRV_verses'
  })

  // 2. King James Version (English Public Domain)
  await buildFactoryBible({
    sourceUrl: 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/sqlite/KJV.db',
    targetFile: path.join(resourcesDir, 'KJV.bible'),
    id: 'bible_kjv',
    name: 'King James Version',
    abbrev: 'KJV',
    language: 'en',
    copyright: 'Public Domain',
    licenseNotice: 'Public Domain English Bible translation (King James Version 1611/1769).',
    tableName: 'KJV_verses'
  })
}

main().catch((err) => {
  console.error('Error generando biblias de fábrica:', err)
  process.exit(1)
})
