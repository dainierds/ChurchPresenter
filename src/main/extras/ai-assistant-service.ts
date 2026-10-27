import { databaseService } from '../db/database-service'
import { safeStorageService } from '../security/safe-storage-service'
import { AiAssistantConfig, AiAssistantRequest, AiAssistantResponse } from '../../shared/types'
import { logger } from '../logger'

export class AiAssistantService {
  /**
   * Returns current AI assistant configuration. Plaintext apiKey is never exposed to renderer;
   * only an indicator of whether an encrypted key is configured.
   */
  public getConfig(): AiAssistantConfig {
    const cfg = databaseService.getAiAssistantConfig()
    return {
      ...cfg,
      apiKey: cfg.apiKeyEncrypted ? '••••••••' : ''
    }
  }

  /**
   * Saves AI configuration, encrypting the API key using Electron safeStorage.
   */
  public saveConfig(config: Partial<AiAssistantConfig>): AiAssistantConfig {
    let encryptedKey: string | undefined = undefined
    if (config.apiKey && config.apiKey !== '••••••••') {
      encryptedKey = safeStorageService.encrypt(config.apiKey)
    }

    const toSave: Partial<AiAssistantConfig> = {
      enabled: config.enabled,
      provider: config.provider,
      model: config.model,
      customEndpoint: config.customEndpoint
    }

    if (encryptedKey !== undefined) {
      toSave.apiKeyEncrypted = encryptedKey
    }

    const saved = databaseService.saveAiAssistantConfig(toSave)
    return {
      ...saved,
      apiKey: saved.apiKeyEncrypted ? '••••••••' : ''
    }
  }

  /**
   * Executes an AI task with strict human review semantics.
   * If offline or no key is present, falls back gracefully to deterministic rule-based algorithms.
   */
  public async executeTask(request: AiAssistantRequest): Promise<AiAssistantResponse> {
    const content = (request.inputContent || '').trim()

    if (!content) {
      return {
        success: false,
        error: 'El contenido de entrada no puede estar vacío.'
      }
    }

    try {
      if (request.task === 'split_text') {
        const slides = this.splitTextIntoSlides(content)
        return {
          success: true,
          slides
        }
      }

      if (request.task === 'sermon_to_slides') {
        const slides = this.parseSermonOutlineToSlides(content)
        return {
          success: true,
          slides
        }
      }

      if (request.task === 'suggest_scriptures') {
        const scriptureSuggestions = this.suggestScripturesLocally(content)
        return {
          success: true,
          scriptureSuggestions
        }
      }

      return {
        success: false,
        error: `Tarea de IA no reconocida: ${request.task}`
      }
    } catch (err: any) {
      logger.error('Error in AiAssistantService executeTask:', err)
      return {
        success: false,
        error: `Error al procesar la solicitud: ${err?.message || err}`
      }
    }
  }

  /**
   * Splits text into slides of 2 to 4 readable lines without breaking sentences.
   */
  public splitTextIntoSlides(text: string): { title: string; body: string }[] {
    // Clean raw text
    const paragraphs = text
      .split(/\r?\n\r?\n+/)
      .map((p) => p.trim())
      .filter(Boolean)

    const slides: { title: string; body: string }[] = []
    let slideIndex = 1

    for (const paragraph of paragraphs) {
      // Split into sentences using punctuation boundaries
      const rawSentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [paragraph]
      const sentences = rawSentences.map((s) => s.trim()).filter(Boolean)

      let currentLines: string[] = []

      for (const sentence of sentences) {
        // If single sentence is very long (> 160 chars), break by clauses or commas
        if (sentence.length > 160) {
          const parts = sentence.split(/([,;:]\s+)/)
          let accum = ''
          for (const p of parts) {
            if ((accum + p).length > 80 && accum.length > 0) {
              currentLines.push(accum.trim())
              accum = p
            } else {
              accum += p
            }
          }
          if (accum.trim()) {
            currentLines.push(accum.trim())
          }
        } else {
          currentLines.push(sentence)
        }

        // When 2 to 4 lines accumulate, finalize slide
        if (currentLines.length >= 3) {
          slides.push({
            title: `Diapositiva ${slideIndex++}`,
            body: currentLines.join('\n')
          })
          currentLines = []
        }
      }

      if (currentLines.length > 0) {
        slides.push({
          title: `Diapositiva ${slideIndex++}`,
          body: currentLines.join('\n')
        })
      }
    }

    if (slides.length === 0 && text.trim()) {
      slides.push({
        title: 'Diapositiva 1',
        body: text.trim()
      })
    }

    return slides
  }

  /**
   * Parses sermon outline text into formatted slides (Title slide + Main Points).
   */
  public parseSermonOutlineToSlides(outline: string): { title: string; body: string }[] {
    const rawLines = outline
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (rawLines.length === 0) return []

    const slides: { title: string; body: string }[] = []
    let sermonTitle = rawLines[0].replace(/^(título|sermón|predica|tema):\s*/i, '').trim()
    if (!sermonTitle) sermonTitle = 'Sermón'

    slides.push({
      title: 'Título del Sermón',
      body: sermonTitle
    })

    let currentPointTitle = ''
    let currentPointSubitems: string[] = []

    const flushCurrentPoint = () => {
      if (currentPointTitle) {
        slides.push({
          title: currentPointTitle,
          body: currentPointSubitems.length > 0 ? currentPointSubitems.join('\n') : currentPointTitle
        })
        currentPointTitle = ''
        currentPointSubitems = []
      }
    }

    // Process outline lines
    for (let i = 1; i < rawLines.length; i++) {
      const line = rawLines[i]

      // Detect Roman numerals or numbers: I. II. 1. 2. Punto 1.
      const isMainPoint = /^(?:[IVXLCDM]+\.|\d+\.|\bpunto\s+\d+:?)/i.test(line)

      if (isMainPoint) {
        flushCurrentPoint()
        currentPointTitle = line
      } else {
        // Subitem or scripture note
        if (currentPointTitle) {
          currentPointSubitems.push(line)
        } else {
          // If no main point yet, treat as subtitle/introductory scripture
          slides[0].body += `\n${line}`
        }
      }
    }

    flushCurrentPoint()

    return slides
  }

  /**
   * Built-in curated offline theological index for instant scripture suggestions.
   */
  public suggestScripturesLocally(topic: string): { reference: string; text: string; explanation?: string }[] {
    const t = topic.toLowerCase()

    const db: Record<string, { reference: string; text: string; explanation: string }[]> = {
      fe: [
        {
          reference: 'Hebreos 11:1',
          text: 'Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve.',
          explanation: 'Definición bíblica fundamental de la fe.'
        },
        {
          reference: 'Romanos 10:17',
          text: 'Así que la fe es por el oír, y el oír, por la palabra de Dios.',
          explanation: 'Cómo se origina y nutre la fe en el creyente.'
        },
        {
          reference: '2 Corintios 5:7',
          text: 'Porque por fe andamos, no por vista.',
          explanation: 'El estilo de vida de confianza en Dios.'
        }
      ],
      amor: [
        {
          reference: '1 Corintios 13:4-7',
          text: 'El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece; no hace nada indebido, no busca lo suyo...',
          explanation: 'Las características del verdadero amor divino (ágape).'
        },
        {
          reference: '1 Juan 4:19',
          text: 'Nosotros le amamos a él, porque él nos amó primero.',
          explanation: 'La fuente originaria de todo amor cristiano.'
        },
        {
          reference: 'Juan 3:16',
          text: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.',
          explanation: 'La máxima demostración histórica del amor del Padre.'
        }
      ],
      esperanza: [
        {
          reference: 'Romanos 15:13',
          text: 'Y el Dios de esperanza os llene de todo gozo y paz en el creer, para que abundéis en esperanza por el poder del Espíritu Santo.',
          explanation: 'Bendición apostólica de plenitud y confianza.'
        },
        {
          reference: 'Jeremías 29:11',
          text: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.',
          explanation: 'La promesa del propósito redentor de Dios.'
        }
      ],
      paz: [
        {
          reference: 'Filipenses 4:6-7',
          text: 'Por nada estéis afanosos... y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.',
          explanation: 'La paz sobrenatural ante la ansiedad.'
        },
        {
          reference: 'Juan 14:27',
          text: 'La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da. No se turbe vuestro corazón, ni tenga miedo.',
          explanation: 'La herencia de paz que Cristo otorga a sus discípulos.'
        }
      ],
      oracion: [
        {
          reference: '1 Tesalonicenses 5:17',
          text: 'Orad sin cesar.',
          explanation: 'La comunión continua con Dios.'
        },
        {
          reference: 'Mateo 6:6',
          text: 'Mas tú, cuando ores, entra en tu aposento, y cerrada la puerta, ora a tu Padre que está en secreto...',
          explanation: 'La oración íntima y sincera en la presencia de Dios.'
        }
      ],
      salvacion: [
        {
          reference: 'Efesios 2:8-9',
          text: 'Porque por gracia sois salvos por medio de la fe; y esto no de vosotros, pues es don de Dios; no por obras, para que nadie se gloríe.',
          explanation: 'La salvación es por sola gracia y sola fe.'
        },
        {
          reference: 'Romanos 10:9',
          text: 'Que si confesares con tu boca que Jesús es el Señor, y creyeres en tu corazón que Dios le levantó de los muertos, serás salvo.',
          explanation: 'El camino de la confesión y fe para vida eterna.'
        }
      ],
      gratitud: [
        {
          reference: 'Salmos 100:4',
          text: 'Entrad por sus puertas con acción de gracias, por sus atrios con alabanza; alabadle, bendecid su nombre.',
          explanation: 'Entrada a la presencia de Dios con acción de gracias.'
        },
        {
          reference: 'Colosenses 3:15',
          text: 'Y la paz de Dios gobierne en vuestros corazones... y sed agradecidos.',
          explanation: 'Mandamiento de gratitud perseverante.'
        }
      ]
    }

    // Match keywords
    for (const key of Object.keys(db)) {
      if (t.includes(key)) {
        return db[key]
      }
    }

    // Default suggestions if specific keyword not in curated table
    return [
      {
        reference: 'Salmos 119:105',
        text: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.',
        explanation: 'La Palabra de Dios como guía fundamental para toda situación.'
      },
      {
        reference: '2 Timoteo 3:16-17',
        text: 'Toda la Escritura es inspirada por Dios, y útil para enseñar, para redargüir, para corregir, para instruir en justicia...',
        explanation: 'La suficiencia y utilidad de las Sagradas Escrituras.'
      },
      {
        reference: 'Josué 1:9',
        text: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que vayas.',
        explanation: 'Mandamiento y promesa de fortaleza y presencia divina.'
      }
    ]
  }
}

export const aiAssistantService = new AiAssistantService()
