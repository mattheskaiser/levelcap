import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { Readable } from 'stream'
import { protocol } from 'electron'
import { MEDIA_PROTOCOL } from '@shared/media'

// Must run before app.whenReady() — Electron requires privileged schemes to be
// declared at module load time.
export function registerMediaProtocolPrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true
      }
    }
  ])
}

function nodeStreamToWeb(stream: ReturnType<typeof createReadStream>): ReadableStream {
  return Readable.toWeb(stream) as ReadableStream
}

// Streams a clip's source file straight from disk into <video>/<audio> elements.
// net.fetch on file:// URLs doesn't reliably honor Range headers, so byte-range
// requests are handled by hand here — required for <video> seeking/scrubbing to work.
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_PROTOCOL, async (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))

    let fileSize: number
    try {
      fileSize = (await stat(filePath)).size
    } catch {
      return new Response('Not found', { status: 404 })
    }

    const rangeHeader = request.headers.get('range')
    if (!rangeHeader) {
      return new Response(nodeStreamToWeb(createReadStream(filePath)), {
        status: 200,
        headers: {
          'content-length': String(fileSize),
          'accept-ranges': 'bytes'
        }
      })
    }

    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
    if (!match) {
      return new Response('Invalid range', { status: 416 })
    }
    const [, startStr, endStr] = match
    const start = startStr ? parseInt(startStr, 10) : 0
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1
    const chunkSize = end - start + 1

    return new Response(nodeStreamToWeb(createReadStream(filePath, { start, end })), {
      status: 206,
      headers: {
        'content-range': `bytes ${start}-${end}/${fileSize}`,
        'content-length': String(chunkSize),
        'accept-ranges': 'bytes'
      }
    })
  })
}
