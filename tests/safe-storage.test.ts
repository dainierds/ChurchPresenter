import { describe, it, expect } from 'vitest'
import { SafeStorageService } from '../src/main/security/safe-storage-service'

describe('Safe Storage Encryption Service (Phase 7)', () => {
  it('encrypts and decrypts sensitive values', () => {
    const service = new SafeStorageService()
    const sensitive = 'super-secret-church-remote-pin-987654'

    const encrypted = service.encrypt(sensitive)
    expect(encrypted).not.toBe(sensitive)
    expect(encrypted.startsWith('enc:')).toBe(true)

    const decrypted = service.decrypt(encrypted)
    expect(decrypted).toBe(sensitive)
  })

  it('handles empty string cleanly', () => {
    const service = new SafeStorageService()
    expect(service.encrypt('')).toBe('')
    expect(service.decrypt('')).toBe('')
  })
})
