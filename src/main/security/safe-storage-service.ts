import { safeStorage } from 'electron'
import { logger } from '../logger'

export class SafeStorageService {
  /**
   * Encrypts a sensitive string. Uses Electron safeStorage if available;
   * otherwise falls back to a prefixed obfuscated format for test/dev.
   */
  public encrypt(plainText: string): string {
    if (!plainText) return ''
    try {
      if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
        const encryptedBuffer = safeStorage.encryptString(plainText)
        return `enc:safe:${encryptedBuffer.toString('base64')}`
      }
    } catch (err) {
      logger.warn('Electron safeStorage encryption failed, falling back:', err)
    }

    // Fallback for non-DPAPI / test environments
    return `enc:b64:${Buffer.from(plainText, 'utf8').toString('base64')}`
  }

  /**
   * Decrypts an encrypted string created with encrypt().
   */
  public decrypt(cipherText: string): string {
    if (!cipherText) return ''
    if (!cipherText.startsWith('enc:')) {
      // Plain text (legacy/unencrypted)
      return cipherText
    }

    try {
      if (cipherText.startsWith('enc:safe:')) {
        const base64Data = cipherText.slice('enc:safe:'.length)
        const buffer = Buffer.from(base64Data, 'base64')
        if (safeStorage && typeof safeStorage.decryptString === 'function') {
          return safeStorage.decryptString(buffer)
        }
      } else if (cipherText.startsWith('enc:b64:')) {
        const base64Data = cipherText.slice('enc:b64:'.length)
        return Buffer.from(base64Data, 'base64').toString('utf8')
      }
    } catch (err) {
      logger.error('Failed to decrypt sensitive value:', err)
    }

    return ''
  }
}

export const safeStorageService = new SafeStorageService()
