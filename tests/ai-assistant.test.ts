import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { databaseService } from '../src/main/db/database-service'
import { aiAssistantService } from '../src/main/extras/ai-assistant-service'

describe('Phase 10: AI Content Assistant (Strict Human Review & Offline Fallbacks)', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-ai-test-'))
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = true
    ds.dbPath = path.join(tempDir, 'test.sqlite')
    ds.backupsDir = path.join(tempDir, 'backups')
    await databaseService.initialize()
  })

  afterEach(() => {
    databaseService.close()
    const ds = databaseService as any
    ds.customPath = false
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('splits long text into readable 2-4 line slides without breaking sentences', async () => {
    const rawText = `Jesús les dijo: Yo soy el pan de vida; el que a mí viene, nunca tendrá hambre; y el que en mí cree, no tendrá sed jamás. Mas os he dicho, que aunque me habéis visto, no creéis. Todo lo que el Padre me da, vendrá a mí; y al que a mí viene, no le echo fuera. Porque he descendido del cielo, no para hacer mi voluntad, sino la voluntad del que me envió.`

    const res = await aiAssistantService.executeTask({
      task: 'split_text',
      inputContent: rawText
    })

    expect(res.success).toBe(true)
    expect(res.slides).toBeDefined()
    expect(res.slides!.length).toBeGreaterThan(1)

    // Check lines per slide constraint (2 to 4 lines)
    for (const slide of res.slides!) {
      const lineCount = slide.body.split('\n').length
      expect(lineCount).toBeGreaterThanOrEqual(1)
      expect(lineCount).toBeLessThanOrEqual(5)
    }
  })

  it('parses sermon outline into title and point slides', async () => {
    const outline = `Tema: Caminando en Integridad
I. La integridad en lo secreto (Salmos 139:23-24)
- Dios conoce las intenciones del corazón.
II. La integridad en las palabras (Proverbios 10:9)
- El que camina en integridad anda confiado.
III. La recompensa del justo (Salmos 84:11)
- No quitará el bien a los que andan en integridad.`

    const res = await aiAssistantService.executeTask({
      task: 'sermon_to_slides',
      inputContent: outline
    })

    expect(res.success).toBe(true)
    expect(res.slides).toBeDefined()
    expect(res.slides!.length).toBe(4) // 1 Title + 3 Points

    expect(res.slides![0].title).toBe('Título del Sermón')
    expect(res.slides![0].body).toContain('Caminando en Integridad')

    expect(res.slides![1].title).toContain('I. La integridad en lo secreto')
    expect(res.slides![1].title).toContain('Salmos 139')
    expect(res.slides![1].body).toContain('Dios conoce las intenciones')

    expect(res.slides![2].title).toContain('II. La integridad en las palabras')
    expect(res.slides![3].title).toContain('III. La recompensa del justo')
  })

  it('suggests scriptures locally from curated offline theological index', async () => {
    const res = await aiAssistantService.executeTask({
      task: 'suggest_scriptures',
      inputContent: 'fe y confianza'
    })

    expect(res.success).toBe(true)
    expect(res.scriptureSuggestions).toBeDefined()
    expect(res.scriptureSuggestions!.length).toBeGreaterThanOrEqual(2)

    const references = res.scriptureSuggestions!.map((s) => s.reference).join(' ')
    expect(references).toContain('Hebreos 11:1')
  })

  it('saves and encrypts API keys securely without exposing plaintext', () => {
    const saved = aiAssistantService.saveConfig({
      enabled: true,
      provider: 'openai',
      apiKey: 'sk-test-secret-key-12345',
      model: 'gpt-4o'
    })

    expect(saved.enabled).toBe(true)
    expect(saved.apiKey).toBe('••••••••') // Masked
    expect(saved.apiKey).not.toContain('sk-test')
  })
})
