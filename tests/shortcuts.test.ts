import { describe, it, expect } from 'vitest'
import { AppShortcutsConfig, DEFAULT_SHORTCUTS } from '../src/shared/types'
import { isAllowedGlobalShortcut, filterGlobalShortcutsToRegister } from '../src/shared/shortcut-utils'

describe('Keyboard Shortcuts Hardening & Safety', () => {
  it('strictly rejects Ctrl+C from being registered as a global shortcut', () => {
    expect(isAllowedGlobalShortcut('Ctrl+C')).toBe(false)
    expect(isAllowedGlobalShortcut('Ctrl+c')).toBe(false)
    expect(isAllowedGlobalShortcut('Command+C')).toBe(false)
    expect(isAllowedGlobalShortcut('Ctrl+B')).toBe(false)
    expect(isAllowedGlobalShortcut('Ctrl+Shift+F')).toBe(false)
    expect(isAllowedGlobalShortcut('Alt+F4')).toBe(false)
  })

  it('allows valid standalone F-keys (F1 - F12)', () => {
    expect(isAllowedGlobalShortcut('F1')).toBe(true)
    expect(isAllowedGlobalShortcut('f2')).toBe(true)
    expect(isAllowedGlobalShortcut('F4')).toBe(true)
    expect(isAllowedGlobalShortcut('F12')).toBe(true)

    // Non-F keys
    expect(isAllowedGlobalShortcut('C')).toBe(false)
    expect(isAllowedGlobalShortcut('Space')).toBe(false)
    expect(isAllowedGlobalShortcut('F13')).toBe(false)
  })

  it('defaults to global shortcuts disabled', () => {
    expect(DEFAULT_SHORTCUTS.enableGlobalFShortcuts).toBe(false)
    const registered = filterGlobalShortcutsToRegister(DEFAULT_SHORTCUTS)
    expect(Object.keys(registered)).toHaveLength(0)
  })

  it('filters out any unauthorized key even if global F-shortcuts are enabled', () => {
    const maliciousConfig: AppShortcutsConfig = {
      ...DEFAULT_SHORTCUTS,
      black: 'Ctrl+C', // User maliciously tried to bind Ctrl+C globally
      clear: 'F2',
      logo: 'Alt+Tab',
      freeze: 'F4',
      enableGlobalFShortcuts: true
    }

    const registered = filterGlobalShortcutsToRegister(maliciousConfig)
    expect(registered['black']).toBeUndefined() // Ctrl+C blocked!
    expect(registered['logo']).toBeUndefined()  // Alt+Tab blocked!
    expect(registered['clear']).toBe('F2')
    expect(registered['freeze']).toBe('F4')
  })
})
