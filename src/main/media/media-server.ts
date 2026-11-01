import http from 'http'
import fs from 'fs'
import path from 'path'
import { logger } from '../logger'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
}

export class MediaServer {
  private server: http.Server | null = null
  private port = 58999

  public getPort(): number {
    return this.port
  }

  public getStreamUrl(filePath: string): string {
    const cleanPath = filePath.replace(/\\/g, '/')
    return `http://127.0.0.1:${this.port}/stream?file=${encodeURIComponent(cleanPath)}`
  }

  public async initialize(preferredPort = 58999): Promise<number> {
    if (this.server) {
      return this.port
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // Universal CORS headers for Electron renderer processes
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')
        res.setHeader(
          'Access-Control-Expose-Headers',
          'Content-Range, Accept-Ranges, Content-Length, Content-Type'
        )

        if (req.method === 'OPTIONS') {
          res.writeHead(204)
          res.end()
          return
        }

        try {
          const u = new URL(req.url || '', `http://127.0.0.1:${this.port}`)
          let rawPath = u.searchParams.get('file') || ''
          try {
            if (rawPath.includes('%')) {
              rawPath = decodeURIComponent(rawPath)
            }
          } catch {
            // ignore
          }

          if (/^\/[a-zA-Z]:/.test(rawPath)) {
            rawPath = rawPath.slice(1)
          }

          const normalizedPath = path.normalize(rawPath)

          if (!normalizedPath || !fs.existsSync(normalizedPath)) {
            logger.warn(`[MediaServer] File not found: ${normalizedPath}`)
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Media file not found')
            return
          }

          const stat = fs.statSync(normalizedPath)
          const fileSize = stat.size
          const ext = path.extname(normalizedPath).toLowerCase()
          const contentType = MIME_TYPES[ext] || 'application/octet-stream'

          const range = req.headers.range
          if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
            const chunksize = end - start + 1

            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType
            })

            const stream = fs.createReadStream(normalizedPath, { start, end })
            stream.pipe(res)
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Accept-Ranges': 'bytes',
              'Content-Type': contentType
            })
            fs.createReadStream(normalizedPath).pipe(res)
          }
        } catch (err: any) {
          logger.error('[MediaServer] Stream error:', err)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' })
          }
          res.end(err?.message || 'Server error')
        }
      })

      const tryListen = (p: number) => {
        server.once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            logger.warn(`[MediaServer] Port ${p} is in use, attempting next port...`)
            tryListen(p === 0 ? 0 : p + 1)
          } else {
            logger.error('[MediaServer] Listen error:', err)
            reject(err)
          }
        })

        server.listen(p, '127.0.0.1', () => {
          const addr = server.address()
          this.port = typeof addr === 'object' && addr ? addr.port : p
          this.server = server
          logger.info(`[MediaServer] Streaming server running at http://127.0.0.1:${this.port}`)
          resolve(this.port)
        })
      }

      tryListen(preferredPort)
    })
  }

  public close(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}

export const mediaServer = new MediaServer()
