/**
 * Generates synthetic, non-copyrighted PPTX files for testing:
 * 1. sample_presentation.pptx (5 slides: notes, animations, transitions, custom font)
 * 2. benchmark_80_slides.pptx (80 slides for performance testing)
 */

const AdmZip = require('adm-zip')
const path = require('path')
const fs = require('fs')

const FIXTURES_DIR = path.resolve(__dirname, '../tests/fixtures')
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true })
}

function buildPptxZip(slidesData) {
  const zip = new AdmZip()

  // [Content_Types].xml
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`

  slidesData.forEach((s, idx) => {
    contentTypes += `\n  <Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    if (s.speakerNotes) {
      contentTypes += `\n  <Override PartName="/ppt/notesSlides/notesSlide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`
    }
  })
  contentTypes += `\n</Types>`
  zip.addFile('[Content_Types].xml', Buffer.from(contentTypes, 'utf-8'))

  // _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  zip.addFile('_rels/.rels', Buffer.from(rootRels, 'utf-8'))

  // ppt/presentation.xml
  let presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldIdLst>`
  slidesData.forEach((_, idx) => {
    presXml += `\n    <p:sldId id="${256 + idx}" r:id="rId${idx + 1}"/>`
  })
  presXml += `\n  </p:sldIdLst>
</p:presentation>`
  zip.addFile('ppt/presentation.xml', Buffer.from(presXml, 'utf-8'))

  // ppt/_rels/presentation.xml.rels
  let presRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  slidesData.forEach((_, idx) => {
    presRels += `\n  <Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>`
  })
  presRels += `\n</Relationships>`
  zip.addFile('ppt/_rels/presentation.xml.rels', Buffer.from(presRels, 'utf-8'))

  // Slides
  slidesData.forEach((s, idx) => {
    const slideNum = idx + 1
    let slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:grpSpPr/></p:nvGrpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr lang="es-ES" sz="4000">
                <a:latin typeface="${s.font || 'Calibri'}"/>
              </a:rPr>
              <a:t>${s.title}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:rPr lang="es-ES" sz="2400">
                <a:latin typeface="${s.font || 'Calibri'}"/>
              </a:rPr>
              <a:t>${s.body}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>`

    // Transition
    if (s.hasTransition) {
      slideXml += `\n  <p:transition spd="med"><p:fade/></p:transition>`
    }

    // Timing / Animation
    if (s.hasAnimation) {
      slideXml += `\n  <p:timing><p:tnLst><p:par><p:cMediaNode><p:cTn id="1" dur="1000"/></p:cMediaNode></p:par></p:tnLst></p:timing>`
    }

    // Embedded video indicator
    if (s.hasVideo) {
      slideXml += `\n  <p:videoFile xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" r:link="rIdVideo"/>`
    }

    slideXml += `\n</p:sld>`
    zip.addFile(`ppt/slides/slide${slideNum}.xml`, Buffer.from(slideXml, 'utf-8'))

    // Slide rels (links to notes slide if present)
    if (s.speakerNotes) {
      const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdNotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideNum}.xml"/>
</Relationships>`
      zip.addFile(`ppt/slides/_rels/slide${slideNum}.xml.rels`, Buffer.from(slideRels, 'utf-8'))

      // Notes slide
      const notesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:grpSpPr/></p:nvGrpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:p>
            <a:r>
              <a:t>${s.speakerNotes}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`
      zip.addFile(`ppt/notesSlides/notesSlide${slideNum}.xml`, Buffer.from(notesXml, 'utf-8'))
    }
  })

  return zip
}

// 1. Generate 5-slide sample presentation
const sampleSlides = [
  {
    title: 'Bienvenida al Servicio',
    body: 'Nos alegramos de adorar juntos hoy.',
    speakerNotes: 'Dar la bienvenida con entusiasmo a las visitas y pedir que apaguen los teléfonos.'
  },
  {
    title: 'Tiempo de Alabanza',
    body: 'Canten con gozo al Señor toda la tierra.',
    hasAnimation: true
  },
  {
    title: 'Anuncios Comunitarios',
    body: 'Reunión de jóvenes el viernes a las 7:00 PM.',
    speakerNotes: 'Recordar llevar refrigerio para compartir después de la reunión.'
  },
  {
    title: 'Lectura Bíblica',
    body: 'Filipenses 4:4-7 - Regocijaos en el Señor siempre.',
    hasTransition: true
  },
  {
    title: 'Bendición Pastoral',
    body: 'La gracia del Señor Jesucristo sea con vuestro espíritu.',
    font: 'NonExistentFantasyFont123' // To test missing font warning!
  }
]

const sampleZip = buildPptxZip(sampleSlides)
const samplePath = path.join(FIXTURES_DIR, 'sample_presentation.pptx')
sampleZip.writeZip(samplePath)
console.log(`[Fixture] Created sample presentation: ${samplePath} (${sampleSlides.length} slides)`)

// 2. Generate 80-slide benchmark presentation
const benchSlides = []
for (let i = 1; i <= 80; i++) {
  benchSlides.push({
    title: `Diapositiva del Sermón #${i}`,
    body: `Punto doctrinal número ${i}. Meditación y aplicación práctica para la vida cristiana.`,
    speakerNotes: i % 5 === 0 ? `Nota de predicación para diapositiva ${i}: enfatizar este punto con una ilustración personal.` : undefined
  })
}

const benchZip = buildPptxZip(benchSlides)
const benchPath = path.join(FIXTURES_DIR, 'benchmark_80_slides.pptx')
benchZip.writeZip(benchPath)
console.log(`[Fixture] Created 80-slide presentation: ${benchPath} (${benchSlides.length} slides)`)
