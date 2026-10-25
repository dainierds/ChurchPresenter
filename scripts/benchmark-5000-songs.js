const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

async function runBenchmark() {
  console.log('====================================================')
  console.log(' CHURCHPRESENTER - BANCO DE PRUEBAS DE 5.000 CANCIONES')
  console.log('====================================================')

  const benchDir = path.resolve(__dirname, '..', 'bench_5000_temp')
  if (fs.existsSync(benchDir)) {
    fs.rmSync(benchDir, { recursive: true, force: true })
  }
  fs.mkdirSync(benchDir, { recursive: true })

  const dbFile = path.join(benchDir, 'church_presenter.sqlite')
  const tmpFile = path.join(benchDir, 'church_presenter.sqlite.tmp')

  const SQL = await initSqlJs()
  const db = new SQL.Database()

  // Create full schema
  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      copyright TEXT DEFAULT '',
      ccli_number TEXT DEFAULT '',
      language TEXT DEFAULT 'es',
      tags TEXT DEFAULT '',
      is_demo INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS song_groups (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      group_type TEXT NOT NULL,
      group_number INTEGER DEFAULT 1,
      label TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS song_arrangements (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      name TEXT NOT NULL,
      group_order TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_song_groups_song_id ON song_groups(song_id);
    CREATE INDEX IF NOT EXISTS idx_song_arrangements_song_id ON song_arrangements(song_id);
  `)

  // Initial Memory
  global.gc && global.gc()
  const memBefore = process.memoryUsage()
  console.log(`Memoria inicial: Heap ${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB | RSS ${(memBefore.rss / 1024 / 1024).toFixed(2)} MB`)

  console.log('\nInsertando 5.000 canciones estructuradas con 4 grupos y 1 arreglo cada una...')
  const tInsert0 = performance.now()
  db.run('BEGIN TRANSACTION;')

  for (let i = 1; i <= 5000; i++) {
    const songId = `song_bench_${i}`
    const title = `Canción de Alabanza #${i} - Señor de Toda Gloria`
    const author = `Compositor de Prueba ${i % 100}`
    const tags = i % 2 === 0 ? 'Adoración,Himno' : 'Alabanza,Gratitud'

    db.run(
      'INSERT INTO songs (id, title, author, copyright, ccli_number, language, tags, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      [songId, title, author, 'Dominio Público', `CCLI-${i}`, 'es', tags, 0]
    )

    const groupIds = []
    const sections = [
      { type: 'verse', num: 1, label: 'Verso 1', text: `Cantan los cielos tu majestad verso 1 estrofa ${i}\nTu gran poder y fidelidad jamás cesarán.` },
      { type: 'chorus', num: 1, label: 'Coro', text: `¡Santo, digno es el Señor!\nPor siempre reinarás con gloria y honor.` },
      { type: 'verse', num: 2, label: 'Verso 2', text: `Toda la tierra te adorará verso 2 estrofa ${i}\nNuestra alabanza se elevará a ti buen Jesús.` },
      { type: 'bridge', num: 1, label: 'Puente', text: `Por los siglos de los siglos\nAmén, amén, aleluya.` }
    ]

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const gId = `grp_${songId}_${sIdx + 1}`
      groupIds.push(gId)
      db.run(
        'INSERT INTO song_groups (id, song_id, group_type, group_number, label, content, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [gId, songId, sections[sIdx].type, sections[sIdx].num, sections[sIdx].label, sections[sIdx].text, sIdx]
      )
    }

    db.run(
      'INSERT INTO song_arrangements (id, song_id, name, group_order, is_default) VALUES (?, ?, ?, ?, ?);',
      [`arr_${songId}_def`, songId, 'Arreglo Predeterminado', JSON.stringify(groupIds), 1]
    )
  }

  db.run('COMMIT;')
  const tInsert = performance.now() - tInsert0
  console.log(`Tiempo de inserción total (5.000 canciones, 20.000 grupos): ${tInsert.toFixed(2)} ms`)

  // Memory after populating
  const memPopulated = process.memoryUsage()
  console.log(`Memoria tras carga de 5.000 canciones: Heap ${(memPopulated.heapUsed / 1024 / 1024).toFixed(2)} MB | RSS ${(memPopulated.rss / 1024 / 1024).toFixed(2)} MB`)

  // Atomic Disk Save Benchmark
  console.log('\nEjecutando guardado atómico a disco (export + fsync + rename)...')
  const tSave0 = performance.now()
  const binaryData = db.export()
  const tExport = performance.now() - tSave0

  const tWrite0 = performance.now()
  const buffer = Buffer.from(binaryData)
  const fd = fs.openSync(tmpFile, 'w')
  fs.writeSync(fd, buffer, 0, buffer.length)
  fs.fsyncSync(fd)
  fs.closeSync(fd)
  fs.renameSync(tmpFile, dbFile)
  const tWrite = performance.now() - tWrite0
  const tTotalSave = performance.now() - tSave0

  const diskStat = fs.statSync(dbFile)
  const sizeMB = diskStat.size / (1024 * 1024)

  console.log(`Tiempo de exportación de buffer sql.js: ${tExport.toFixed(2)} ms`)
  console.log(`Tiempo de escritura física atómica con fsync: ${tWrite.toFixed(2)} ms`)
  console.log(`Tiempo de guardado atómico total: ${tTotalSave.toFixed(2)} ms`)
  console.log(`Tamaño real del archivo .sqlite en disco: ${sizeMB.toFixed(2)} MB (${diskStat.size.toLocaleString()} bytes)`)

  // Startup / Load Time Benchmark
  console.log('\nSimulando arranque en frío: lectura de disco + inicialización + carga de 5.000 canciones...')
  const tStartup0 = performance.now()
  const readBuffer = fs.readFileSync(dbFile)
  const dbLoaded = new SQL.Database(new Uint8Array(readBuffer.buffer.slice(readBuffer.byteOffset, readBuffer.byteOffset + readBuffer.byteLength)))
  const tDbOpen = performance.now() - tStartup0

  // Query all 5,000 songs and groups
  const tQuery0 = performance.now()
  const songRows = dbLoaded.exec('SELECT * FROM songs ORDER BY title ASC;')
  const groupRows = dbLoaded.exec('SELECT * FROM song_groups;')
  const arrangementRows = dbLoaded.exec('SELECT * FROM song_arrangements;')
  const tQuery = performance.now() - tQuery0
  const tTotalStartup = performance.now() - tStartup0

  console.log(`Tiempo de lectura y parseo SQLite WebAssembly: ${tDbOpen.toFixed(2)} ms`)
  console.log(`Tiempo de consulta SQL para 5.000 canciones y 20.000 grupos: ${tQuery.toFixed(2)} ms`)
  console.log(`Tiempo de arranque total: ${tTotalStartup.toFixed(2)} ms`)
  console.log(`Canciones recuperadas: ${songRows[0].values.length} | Grupos: ${groupRows[0].values.length}`)

  // Clean up benchmark temp dir
  db.close()
  dbLoaded.close()
  fs.rmSync(benchDir, { recursive: true, force: true })

  console.log('\n====================================================')
  console.log(' RESUMEN FINAL DE MÉTRICAS MEDIDAS')
  console.log('====================================================')
  console.log(`- Canciones: 5.000 (20.000 estrofas/coros)`)
  console.log(`- Tiempo de guardado atómico en disco: ${tTotalSave.toFixed(2)} ms`)
  console.log(`- Tamaño del archivo SQLite en disco: ${sizeMB.toFixed(2)} MB`)
  console.log(`- Memoria Heap del proceso: ${(memPopulated.heapUsed / 1024 / 1024).toFixed(2)} MB (Delta: ${((memPopulated.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`- Memoria RSS del proceso: ${(memPopulated.rss / 1024 / 1024).toFixed(2)} MB`)
  console.log(`- Tiempo de arranque / carga completa: ${tTotalStartup.toFixed(2)} ms`)
  console.log('====================================================')
}

runBenchmark().catch(console.error)
