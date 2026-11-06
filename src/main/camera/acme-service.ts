import fs from 'fs'
import path from 'path'
import https from 'https'
import { app } from 'electron'
import * as acme from 'acme-client'
import { CameraCertStatus } from '../../shared/types'
import { databaseService } from '../db/database-service'
import { safeStorageService } from '../security/safe-storage-service'
import { logger } from '../logger'

export class AcmeService {
  private certsDir: string = path.join(process.cwd(), 'certs')
  private checkInterval: NodeJS.Timeout | null = null
  private isRenewing: boolean = false
  private cachedFallbackCert: { cert: string; key: string } | null = null

  public initialize(): void {
    try {
      this.certsDir = app ? path.join(app.getPath('userData'), 'certs') : path.join(process.cwd(), 'certs')
    } catch {
      this.certsDir = path.join(process.cwd(), 'certs')
    }

    if (!fs.existsSync(this.certsDir)) {
      try {
        fs.mkdirSync(this.certsDir, { recursive: true })
      } catch (err) {
        logger.error('Failed to create certs directory:', err)
      }
    }

    // Check certificate status at startup and schedule periodic 12-hour checks
    this.checkAndRenewIfNeeded().catch((err) => {
      logger.warn('Initial ACME certificate check failed or unconfigured:', err)
    })

    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => {
        this.checkAndRenewIfNeeded().catch((err) => {
          logger.warn('Periodic ACME renewal check encountered error:', err)
        })
      }, 12 * 60 * 60 * 1000) // Every 12 hours
    }
  }

  public getCertsDir(): string {
    return this.certsDir
  }

  public getFullchainPath(): string {
    return path.join(this.certsDir, 'camera_fullchain.pem')
  }

  public getPrivkeyPath(): string {
    return path.join(this.certsDir, 'camera_privkey.pem')
  }

  public getAccountKeyPath(): string {
    return path.join(this.certsDir, 'acme_account_key.pem')
  }

  public hasRealCertificate(): boolean {
    return fs.existsSync(this.getFullchainPath()) && fs.existsSync(this.getPrivkeyPath())
  }

  public async getCertificateStatus(): Promise<CameraCertStatus> {
    const settings = databaseService.getCameraSettings()
    const domain = settings.domain.trim()
    const hasToken = settings.hasCloudflareToken

    if (!domain || !hasToken) {
      return {
        status: 'unconfigured',
        domain: domain || undefined,
        errorMessage: 'Dominio o Token de Cloudflare no configurados en Ajustes -> Cámaras.'
      }
    }

    if (!this.hasRealCertificate()) {
      return {
        status: 'pending',
        domain,
        errorMessage: 'Certificado no emitido aún. Presione "Renovar Certificado Ahora" para solicitarlo.'
      }
    }

    try {
      const certPem = fs.readFileSync(this.getFullchainPath(), 'utf8')
      const info = await acme.crypto.readCertificateInfo(certPem)
      const expiresAt = info.notAfter
      const now = new Date()
      const diffMs = expiresAt.getTime() - now.getTime()
      const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffMs <= 0) {
        return {
          status: 'expired',
          expiresAt: expiresAt.toISOString(),
          domain: (info.domains as any)?.commonName || domain,
          issuer: info.issuer?.commonName || 'Let\'s Encrypt',
          daysUntilExpiry,
          errorMessage: 'El certificado ha vencido. Requiere renovación.'
        }
      }

      if (daysUntilExpiry <= 30) {
        return {
          status: 'expiring',
          expiresAt: expiresAt.toISOString(),
          domain: (info.domains as any)?.commonName || domain,
          issuer: info.issuer?.commonName || 'Let\'s Encrypt',
          daysUntilExpiry
        }
      }

      return {
        status: 'valid',
        expiresAt: expiresAt.toISOString(),
        domain: (info.domains as any)?.commonName || domain,
        issuer: info.issuer?.commonName || 'Let\'s Encrypt',
        daysUntilExpiry
      }
    } catch (err: any) {
      logger.error('Error reading certificate info:', err)
      return {
        status: 'error',
        domain,
        errorMessage: `Error leyendo certificado: ${err?.message || String(err)}`
      }
    }
  }

  public async getCertificate(): Promise<{ cert: string; key: string }> {
    if (this.hasRealCertificate()) {
      try {
        const cert = fs.readFileSync(this.getFullchainPath(), 'utf8')
        const key = fs.readFileSync(this.getPrivkeyPath(), 'utf8')
        return { cert, key }
      } catch (err) {
        logger.error('Failed to read real certificates from disk, using fallback:', err)
      }
    }

    // Fallback: Generate or retrieve self-signed cert for local / dev operation
    if (this.cachedFallbackCert) {
      return this.cachedFallbackCert
    }

    const fallbackCertPath = path.join(this.certsDir, 'fallback_cert.pem')
    const fallbackKeyPath = path.join(this.certsDir, 'fallback_key.pem')

    if (fs.existsSync(fallbackCertPath) && fs.existsSync(fallbackKeyPath)) {
      try {
        const cert = fs.readFileSync(fallbackCertPath, 'utf8')
        const key = fs.readFileSync(fallbackKeyPath, 'utf8')
        this.cachedFallbackCert = { cert, key }
        return this.cachedFallbackCert
      } catch {
        // ignore and regenerate
      }
    }

    try {
      const [key, cert] = await acme.crypto.createAlpnCertificate(
        { identifier: { type: 'dns', value: 'localhost' } } as any,
        'church_presenter_dev_token'
      )
      const certStr = cert.toString('utf8')
      const keyStr = key.toString('utf8')
      try {
        fs.writeFileSync(fallbackCertPath, certStr, 'utf8')
        fs.writeFileSync(fallbackKeyPath, keyStr, 'utf8')
      } catch {
        // ignore write failures
      }
      this.cachedFallbackCert = { cert: certStr, key: keyStr }
      return this.cachedFallbackCert
    } catch (err) {
      logger.error('Failed to generate fallback ALPN certificate:', err)
      throw new Error('No valid SSL certificate available for Camera HTTPS Server.')
    }
  }

  public async checkAndRenewIfNeeded(): Promise<CameraCertStatus> {
    const status = await this.getCertificateStatus()
    if (status.status === 'expiring' || status.status === 'expired') {
      logger.info(`Certificate needs renewal (status: ${status.status}, days: ${status.daysUntilExpiry}). Starting ACME renewal...`)
      await this.renewCertificate()
      return this.getCertificateStatus()
    }
    return status
  }

  public async renewCertificate(): Promise<{ success: boolean; error?: string; certStatus: CameraCertStatus }> {
    if (this.isRenewing) {
      const status = await this.getCertificateStatus()
      return { success: false, error: 'La renovación ya se encuentra en proceso.', certStatus: status }
    }

    this.isRenewing = true
    try {
      const settings = databaseService.getCameraSettings()
      const domain = settings.domain.trim()
      const encryptedToken = settings.cloudflareTokenEncrypted

      if (!domain) {
        throw new Error('Debe configurar el Dominio de Cámaras en Ajustes antes de renovar.')
      }
      if (!encryptedToken) {
        throw new Error('Debe introducir el Token de Cloudflare en Ajustes antes de renovar.')
      }

      const cloudflareToken = safeStorageService.decrypt(encryptedToken).trim()
      if (!cloudflareToken) {
        throw new Error('No fue posible desencriptar el Token de Cloudflare.')
      }

      logger.info(`Starting ACME Let's Encrypt DNS-01 certificate issuance for domain: ${domain}`)

      // 1. Account Key
      let accountKey: Buffer | string
      if (fs.existsSync(this.getAccountKeyPath())) {
        accountKey = fs.readFileSync(this.getAccountKeyPath(), 'utf8')
      } else {
        accountKey = await acme.crypto.createPrivateKey()
        fs.writeFileSync(this.getAccountKeyPath(), accountKey, 'utf8')
      }

      // 2. Client
      const client = new acme.Client({
        directoryUrl: acme.directory.letsencrypt.production,
        accountKey
      })

      // 3. Create CSR
      const [key, csr] = await acme.crypto.createCsr({
        commonName: domain
      })

      // 4. DNS-01 Challenge Handlers via Cloudflare
      const createdRecords = new Map<string, string>() // keyAuth -> recordId

      const challengeCreateFn = async (authz: any, challenge: any, keyAuthorization: string) => {
        if (challenge.type !== 'dns-01') return
        const challengeDomain = `_acme-challenge.${authz.identifier.value}`
        logger.info(`Creating Cloudflare DNS TXT record for ${challengeDomain}...`)

        const zoneId = await this.findCloudflareZoneId(authz.identifier.value, cloudflareToken)
        const recordId = await this.createCloudflareTxtRecord(zoneId, challengeDomain, keyAuthorization, cloudflareToken)
        createdRecords.set(keyAuthorization, `${zoneId}:${recordId}`)

        // Wait 15 seconds for DNS propagation across Cloudflare Anycast edge
        logger.info('Waiting 15 seconds for Cloudflare DNS edge propagation...')
        await new Promise((r) => setTimeout(r, 15000))
      }

      const challengeRemoveFn = async (authz: any, challenge: any, keyAuthorization: string) => {
        if (challenge.type !== 'dns-01') return
        const entry = createdRecords.get(keyAuthorization)
        if (entry) {
          const [zoneId, recordId] = entry.split(':')
          logger.info(`Cleaning up Cloudflare DNS TXT record ${recordId}...`)
          await this.deleteCloudflareRecord(zoneId, recordId, cloudflareToken).catch((err) => {
            logger.warn('Failed to delete Cloudflare DNS record after challenge:', err)
          })
          createdRecords.delete(keyAuthorization)
        }
      }

      // 5. Order certificate
      const cert = await client.auto({
        csr,
        challengePriority: ['dns-01'],
        challengeCreateFn,
        challengeRemoveFn
      })

      // 6. Write certificates to disk
      fs.writeFileSync(this.getFullchainPath(), cert, 'utf8')
      fs.writeFileSync(this.getPrivkeyPath(), key, 'utf8')

      logger.info(`Certificate issued successfully for ${domain}! Saved to ${this.certsDir}`)
      this.isRenewing = false

      const status = await this.getCertificateStatus()
      return { success: true, certStatus: status }
    } catch (err: any) {
      this.isRenewing = false
      logger.error('ACME certificate issuance failed:', err)
      const status: CameraCertStatus = {
        status: 'error',
        errorMessage: err?.message || String(err)
      }
      return { success: false, error: err?.message || String(err), certStatus: status }
    }
  }

  // Cloudflare API Helpers
  private async findCloudflareZoneId(domain: string, token: string): Promise<string> {
    const res = await this.cloudflareFetch('/zones?per_page=50', token)
    if (!res.success || !Array.isArray(res.result)) {
      throw new Error(`Cloudflare error consultando zonas: ${JSON.stringify(res.errors || res)}`)
    }

    // Match zone whose name is a suffix of the domain (longest match wins)
    const sortedZones = res.result.sort((a: any, b: any) => b.name.length - a.name.length)
    for (const zone of sortedZones) {
      if (domain === zone.name || domain.endsWith(`.${zone.name}`)) {
        return zone.id
      }
    }

    throw new Error(`No se encontró una zona de Cloudflare compatible para el dominio '${domain}'. Verifique que el dominio esté agregado a su cuenta de Cloudflare.`)
  }

  private async createCloudflareTxtRecord(zoneId: string, name: string, content: string, token: string): Promise<string> {
    const body = {
      type: 'TXT',
      name,
      content,
      ttl: 120
    }
    const res = await this.cloudflareFetch(`/zones/${zoneId}/dns_records`, token, 'POST', body)
    if (!res.success || !res.result?.id) {
      throw new Error(`Error creando registro TXT en Cloudflare: ${JSON.stringify(res.errors || res)}`)
    }
    return res.result.id
  }

  private async deleteCloudflareRecord(zoneId: string, recordId: string, token: string): Promise<void> {
    await this.cloudflareFetch(`/zones/${zoneId}/dns_records/${recordId}`, token, 'DELETE')
  }

  private cloudflareFetch(endpoint: string, token: string, method: string = 'GET', body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null
      const req = https.request(
        `https://api.cloudflare.com/client/v4${endpoint}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
          }
        },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => {
            try {
              const json = JSON.parse(data)
              resolve(json)
            } catch {
              resolve({ success: false, raw: data })
            }
          })
        }
      )

      req.on('error', (err) => reject(err))
      if (payload) {
        req.write(payload)
      }
      req.end()
    })
  }

  public dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}

export const acmeService = new AcmeService()
