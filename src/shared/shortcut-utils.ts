import { AppShortcutsConfig } from './types'

/**
 * Validates a shortcut for global registration.
 * Disallows modifier keys (Ctrl, Alt, Shift, Meta) to prevent hijacking clipboard, etc.
 * Only standalone function keys F1-F12 are permitted when global shortcuts are active.
 */
export function isAllowedGlobalShortcut(shortcut: string): boolean {
  if (!shortcut) return false
  const trimmed = shortcut.trim().toUpperCase()

  // Strictly reject any shortcut with modifiers (Ctrl, Cmd, Alt, Shift)
  if (
    trimmed.includes('CTRL') ||
    trimmed.includes('CONTROL') ||
    trimmed.includes('ALT') ||
    trimmed.includes('SHIFT') ||
    trimmed.includes('COMMAND') ||
    trimmed.includes('META')
  ) {
    return false
  }

  // Only allow standalone function keys F1 through F12
  const fKeyRegex = /^F([1-9]|1[0-2])$/
  return fKeyRegex.test(trimmed)
}

export function filterGlobalShortcutsToRegister(
  config: AppShortcutsConfig
): Record<string, string> {
  if (!config.enableGlobalFShortcuts) {
    return {}
  }

  const toRegister: Record<string, string> = {}
  const actionKeys: (keyof Pick<AppShortcutsConfig, 'black' | 'clear' | 'logo' | 'freeze'>)[] = [
    'black',
    'clear',
    'logo',
    'freeze'
  ]

  for (const action of actionKeys) {
    const key = config[action]
    if (isAllowedGlobalShortcut(key)) {
      toRegister[action] = key.toUpperCase()
    }
  }

  return toRegister
}
