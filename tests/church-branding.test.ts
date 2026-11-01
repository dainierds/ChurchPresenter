import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { DatabaseService } from '../src/main/db/database-service'
import { stateManager } from '../src/main/state-manager'
import { ChurchBrandingConfig } from '../src/shared/types'

describe('Church Branding & Background System', () => {
  const testDbPath = path.resolve(__dirname, 'test_branding.sqlite')
  let dbService: DatabaseService

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
    dbService = new DatabaseService(testDbPath)
    await dbService.initialize()
  })

  afterEach(() => {
    dbService.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  it('retrieves default church branding when no custom configuration exists', () => {
    const branding = dbService.getChurchBranding()
    expect(branding.churchName).toBe('CHURCH PRESENTER')
    expect(branding.logoUrl).toBe('')
    expect(branding.defaultBackground.type).toBe('gradient')
  })

  it('persists and retrieves custom church logo and church name', () => {
    const customConfig: Partial<ChurchBrandingConfig> = {
      churchName: 'Iglesia Gracia y Verdad',
      logoUrl: 'C:/Users/Church/Media/logo.png',
      logoWidthVmin: 26,
      logoTextPosition: 'bottom'
    }

    const saved = dbService.saveChurchBranding(customConfig)
    expect(saved.churchName).toBe('Iglesia Gracia y Verdad')
    expect(saved.logoUrl).toBe('C:/Users/Church/Media/logo.png')
    expect(saved.logoWidthVmin).toBe(26)

    // Re-fetch from DB
    const fetched = dbService.getChurchBranding()
    expect(fetched.churchName).toBe('Iglesia Gracia y Verdad')
    expect(fetched.logoUrl).toBe('C:/Users/Church/Media/logo.png')
    expect(fetched.logoWidthVmin).toBe(26)
  })

  it('persists custom background image and video in church branding', () => {
    const imageBg: Partial<ChurchBrandingConfig> = {
      defaultBackground: {
        type: 'image',
        value: 'C:/Users/Church/Media/fondo_montana.jpg'
      }
    }

    const saved = dbService.saveChurchBranding(imageBg)
    expect(saved.defaultBackground.type).toBe('image')
    expect(saved.defaultBackground.value).toBe('C:/Users/Church/Media/fondo_montana.jpg')

    const videoBg: Partial<ChurchBrandingConfig> = {
      defaultBackground: {
        type: 'video',
        value: 'C:/Users/Church/Media/motion_clouds.mp4'
      }
    }
    const savedVideo = dbService.saveChurchBranding(videoBg)
    expect(savedVideo.defaultBackground.type).toBe('video')
    expect(savedVideo.defaultBackground.value).toBe('C:/Users/Church/Media/motion_clouds.mp4')
  })

  it('updates stateManager and broadcasts updated branding and default background', () => {
    const listener = vi.fn()
    stateManager.on('state-updated', listener)

    const updated = stateManager.setChurchBranding({
      churchName: 'Comunidad Cristiana Vida',
      logoUrl: 'C:/Media/logo_vida.png',
      logoWidthVmin: 24,
      logoOpacity: 0.95,
      logoTextPosition: 'right',
      defaultBackground: {
        type: 'gradient',
        value: 'linear-gradient(135deg, #091e3a 0%, #1e3a8a 50%, #030712 100%)'
      }
    })

    expect(updated.churchBranding?.churchName).toBe('Comunidad Cristiana Vida')
    expect(updated.churchBranding?.logoUrl).toBe('C:/Media/logo_vida.png')
    expect(updated.currentTheme.background.value).toContain('#091e3a')
    expect(updated.activeLayers.main.background.value).toContain('#091e3a')
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      churchBranding: expect.objectContaining({ churchName: 'Comunidad Cristiana Vida' })
    }))

    stateManager.removeListener('state-updated', listener)
  })
})
