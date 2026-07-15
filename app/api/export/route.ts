import {
  exportConversationShareOnServer,
  PrivateConversationUrlError
} from '@/lib/export-chatgpt'

export const runtime = 'nodejs'

const EXPORTMD_CLIENT_HEADER = 'X-ExportMD-Client'
const EXPORTMD_CLIENT_VALUE = 'web'

function getRequestOrigin (request: Request): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = request.headers.get('host')

  if (forwardedHost != null && forwardedHost.length > 0) {
    return `${forwardedProto != null && forwardedProto.length > 0 ? forwardedProto : 'https'}://${forwardedHost}`
  }

  if (host != null && host.length > 0) {
    return `${forwardedProto != null && forwardedProto.length > 0 ? forwardedProto : new URL(request.url).protocol.replace(':', '')}://${host}`
  }

  return new URL(request.url).origin
}

function hasAllowedFetchMetadata (request: Request): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')

  return fetchSite == null || fetchSite === 'same-origin'
}

function isAllowedAppBrowserRequest (request: Request): boolean {
  const origin = request.headers.get('origin')
  const client = request.headers.get(EXPORTMD_CLIENT_HEADER)

  return origin === getRequestOrigin(request) &&
    client === EXPORTMD_CLIENT_VALUE &&
    hasAllowedFetchMetadata(request)
}

export async function POST (request: Request): Promise<Response> {
  if (!isAllowedAppBrowserRequest(request)) {
    return Response.json({ message: 'ExportMD API access is restricted to the web app.' }, { status: 403 })
  }

  let url: unknown

  try {
    const body: unknown = await request.json()
    url = body != null && typeof body === 'object' && 'url' in body
      ? body.url
      : undefined
  } catch {
    return Response.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  if (typeof url !== 'string' || url.trim().length === 0) {
    return Response.json({ message: 'A share URL is required.' }, { status: 400 })
  }

  try {
    const { title, markdown, filename, timestamp } = await exportConversationShareOnServer(url)
    return Response.json({
      ...(title.trim().length > 0 ? { title } : {}),
      timestamp: timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:.]/g, '-'),
      markdown,
      filename
    })
  } catch (error) {
    if (error instanceof PrivateConversationUrlError) {
      return Response.json({ error: 'private' }, { status: 400 })
    }

    const message = error instanceof Error
      ? error.message
      : 'Could not export this conversation. Please try again.'

    return Response.json({ message }, { status: 400 })
  }
}
