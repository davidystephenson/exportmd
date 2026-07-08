import {
  chatGptShareToMarkdown,
  CHATGPT_SHARE_HEADERS,
  decodeLoader,
  extractLoaderPayload,
  getChatGptShareId,
  isChatGptShareUrl,
  parseChatGptShareHtml
} from 'chatgpt-share-parser'

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com'])

const JSONP_TIMEOUT_MS = 20_000
const JSONP_CALLBACK_GRACE_MS = 750
const JSONP_RETRIES = 3

type ProxyKind = 'fetch-raw' | 'fetch-json' | 'jsonp'

interface CorsProxy {
  id: string
  kind: ProxyKind
  buildUrl: (shareUrl: string, callbackName?: string) => string
}

// Ordered by preference. Availability varies — failed proxies are skipped automatically.
const CORS_PROXIES: CorsProxy[] = [
  {
    id: 'corsfix',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://proxy.corsfix.com/?${url}`
  },
  {
    id: 'corsproxy.io',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  },
  {
    id: 'allorigins-raw',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  },
  {
    id: 'allorigins-get',
    kind: 'fetch-json',
    buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
  },
  {
    id: 'allorigins-jsonp',
    kind: 'jsonp',
    buildUrl: (url, callbackName = 'callback') =>
      `https://api.allorigins.win/get?callback=${encodeURIComponent(callbackName)}&url=${encodeURIComponent(url)}`
  },
  {
    id: 'cors.lol',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`
  },
  {
    id: 'cors.syrins',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://api.cors.syrins.tech/?url=${encodeURIComponent(url)}`
  },
  {
    id: 'every-origin-get',
    kind: 'fetch-json',
    buildUrl: (url) => `https://every-origin.vercel.app/get?url=${encodeURIComponent(url)}`
  }
]

interface AllOriginsPayload {
  contents?: string
  status?: {
    http_code?: number
  }
}

function readAllOriginsPayload (payload: AllOriginsPayload): string {
  if (typeof payload.contents !== 'string') {
    throw new Error('Invalid proxy response.')
  }

  const status = payload.status?.http_code
  if (status != null && (status < 200 || status >= 300)) {
    throw new Error(`Upstream request failed with status ${status}.`)
  }

  return payload.contents
}

async function fetchViaJsonp (proxyUrl: string, callbackName: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    let settled = false
    const script = document.createElement('script')
    script.async = true

    function cleanup (): void {
      Reflect.deleteProperty(window, callbackName)
      script.remove()
    }

    function settle (result: string, value?: string | Error): void {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      window.clearTimeout(callbackGraceId)
      cleanup()
      if (result === 'resolve' && typeof value === 'string') {
        resolve(value)
        return
      }
      reject(value instanceof Error ? value : new Error('JSONP request failed.'))
    }

    const timeoutId = window.setTimeout(() => {
      settle('reject', new Error('JSONP request timed out.'))
    }, JSONP_TIMEOUT_MS)

    let callbackGraceId = 0

    const windowWithCallback = window as unknown as Record<string, (payload: AllOriginsPayload) => void>
    windowWithCallback[callbackName] = (payload: AllOriginsPayload) => {
      try {
        settle('resolve', readAllOriginsPayload(payload))
      } catch (error) {
        settle('reject', error instanceof Error ? error : new Error('Invalid JSONP response.'))
      }
    }

    script.onerror = () => {
      settle('reject', new Error('JSONP script failed to load.'))
    }
    script.onload = () => {
      callbackGraceId = window.setTimeout(() => {
        settle('reject', new Error('JSONP callback was not invoked.'))
      }, JSONP_CALLBACK_GRACE_MS)
    }
    script.src = proxyUrl
    document.head.appendChild(script)
  })
}

function isLikelyShareHtml (html: string): boolean {
  const trimmed = html.trim()
  if (trimmed.length === 0) {
    return false
  }

  if (trimmed.includes('Attention Required! | Cloudflare')) {
    return false
  }

  if (trimmed.startsWith('{') && (trimmed.includes('corsfix_error') || trimmed.includes('"error"'))) {
    return false
  }

  return (
    trimmed.includes('streamController.enqueue') ||
    trimmed.includes('__NEXT_DATA__') ||
    trimmed.includes('data-build=')
  )
}

function createJsonpCallbackName (): string {
  return `exportmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

async function fetchViaFetchProxy (proxy: CorsProxy, shareUrl: string): Promise<string> {
  const proxyUrl = proxy.buildUrl(shareUrl)
  const response = await fetch(proxyUrl)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  if (proxy.kind === 'fetch-json') {
    const payload: unknown = await response.json()
    if (payload == null || typeof payload !== 'object') {
      throw new Error('Invalid JSON response.')
    }
    return readAllOriginsPayload(payload as AllOriginsPayload)
  }

  return await response.text()
}

async function fetchViaProxy (
  proxy: CorsProxy,
  shareUrl: string,
  onProgress?: ExportProgressCallback
): Promise<{ html: string, proxyUrl: string, source: string }> {
  if (proxy.kind === 'jsonp') {
    return await fetchViaJsonpWithRetries(proxy.buildUrl, shareUrl, proxy.id, onProgress)
  }

  reportProgress(onProgress, {
    strategy: 'client-proxy',
    source: proxy.id,
    status: `Trying ${proxy.id}…`
  })

  const proxyUrl = proxy.buildUrl(shareUrl)
  const html = await fetchViaFetchProxy(proxy, shareUrl)

  if (!isLikelyShareHtml(html)) {
    throw new Error('Invalid share page.')
  }

  return { html, proxyUrl, source: proxy.id }
}

async function fetchViaJsonpWithRetries (
  buildProxyUrl: (shareUrl: string, callbackName: string) => string,
  shareUrl: string,
  source: string,
  onProgress?: ExportProgressCallback
): Promise<{ html: string, proxyUrl: string, source: string }> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= JSONP_RETRIES; attempt += 1) {
    const callbackName = createJsonpCallbackName()
    const proxyUrl = buildProxyUrl(shareUrl, callbackName)
    const attemptLabel = JSONP_RETRIES > 1 ? ` (attempt ${attempt}/${JSONP_RETRIES})` : ''

    reportProgress(onProgress, {
      strategy: 'client-proxy',
      source,
      status: `Trying ${source}${attemptLabel}…`
    })

    try {
      const html = await fetchViaJsonp(proxyUrl, callbackName)
      if (html.trim().length > 0 && isLikelyShareHtml(html)) {
        return { html, proxyUrl, source }
      }
      lastError = new Error('JSONP proxy returned an invalid share page.')
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('JSONP request failed.')
    }

    if (attempt < JSONP_RETRIES) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 500))
    }
  }

  throw lastError ?? new Error('JSONP request failed.')
}

export class PrivateConversationUrlError extends Error {
  constructor () {
    super('This is a private conversation link, not a public share link.')
    this.name = 'PrivateConversationUrlError'
  }
}

export function isChatGptPrivateConversationUrl (input: string): boolean {
  try {
    const url = new URL(input.trim())
    if (!CHATGPT_HOSTS.has(url.hostname)) {
      return false
    }

    const segments = url.pathname.split('/').filter(Boolean)
    return segments[0] === 'c' && (segments[1]?.length ?? 0) > 0
  } catch {
    return false
  }
}

export interface ExportResult {
  title: string
  markdown: string
  filename: string
  source: string
}

export type ExportStrategy = 'client-proxy' | 'server-api'

export interface ExportProgress {
  strategy: ExportStrategy
  source: string
  status: string
}

export type ExportProgressCallback = (progress: ExportProgress) => void

function reportProgress (
  onProgress: ExportProgressCallback | undefined,
  progress: ExportProgress
): void {
  onProgress?.(progress)
}

function sanitizeFilename (title: string, shareId: string): string {
  const base = title.trim().length > 0 ? title.trim() : shareId.length > 0 ? shareId : 'chatgpt-export'
  const sanitized = base
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  const fallback = shareId.length > 0 ? shareId : 'chatgpt-export'
  return `${sanitized.length > 0 ? sanitized : fallback}-export.md`
}

async function fetchShareHtml (
  shareUrl: string,
  onProgress?: ExportProgressCallback
): Promise<{
    html: string
    proxyUrl: string
    source: string
  }> {
  const failures: string[] = []

  for (const proxy of CORS_PROXIES) {
    try {
      return await fetchViaProxy(proxy, shareUrl, onProgress)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'request failed'
      failures.push(`${proxy.id}: ${message}`)
      const nextProxy = CORS_PROXIES[CORS_PROXIES.indexOf(proxy) + 1]
      if (nextProxy != null) {
        reportProgress(onProgress, {
          strategy: 'client-proxy',
          source: nextProxy.id,
          status: `${proxy.id} unavailable, trying ${nextProxy.id}…`
        })
      }
    }
  }

  console.error('[ExportMD] Client-side proxies failed', { shareUrl, failures })

  throw new Error('Client-side proxies failed.')
}

async function fetchShareHtmlOnServer (shareUrl: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(shareUrl, {
      headers: CHATGPT_SHARE_HEADERS,
      cache: 'no-store'
    })
  } catch {
    throw new Error('Could not reach ChatGPT. Check your connection and try again.')
  }

  if (!response.ok) {
    throw new Error('Could not fetch this conversation. The link may be invalid or temporarily unavailable.')
  }

  const html = await response.text()
  if (!isLikelyShareHtml(html)) {
    throw new Error('Could not fetch a valid share page from ChatGPT.')
  }

  return html
}

export async function exportChatGptShareOnServer (url: string): Promise<ExportResult> {
  const { trimmed, shareId } = validateShareUrl(url)
  const html = await fetchShareHtmlOnServer(trimmed)
  return parseShareHtml(html, shareId, trimmed, 'server', '/api/export')
}

async function exportViaApiFallback (
  url: string,
  onProgress?: ExportProgressCallback,
  clientFailures?: string[]
): Promise<ExportResult> {
  reportProgress(onProgress, {
    strategy: 'server-api',
    source: '/api/export',
    status: 'Fetching share page via server…'
  })

  let response: Response
  try {
    response = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
  } catch {
    console.error('[ExportMD] Server export fallback failed', { url, clientFailures })
    throw new Error('Could not fetch this conversation. Client proxies and the server fallback are unavailable.')
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (
      payload != null &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error === 'private'
    ) {
      throw new PrivateConversationUrlError()
    }

    const message =
      payload != null &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : 'Could not export this conversation. Please try again.'

    console.error('[ExportMD] Server export fallback failed', { url, clientFailures, message })
    throw new Error(message)
  }

  if (
    payload == null ||
    typeof payload !== 'object' ||
    !('title' in payload) ||
    !('markdown' in payload) ||
    !('filename' in payload) ||
    !('source' in payload) ||
    typeof payload.title !== 'string' ||
    typeof payload.markdown !== 'string' ||
    typeof payload.filename !== 'string' ||
    typeof payload.source !== 'string'
  ) {
    throw new Error('Could not export this conversation. Please try again.')
  }

  reportProgress(onProgress, {
    strategy: 'server-api',
    source: '/api/export',
    status: 'Export complete.'
  })

  return {
    title: payload.title,
    markdown: payload.markdown,
    filename: payload.filename,
    source: payload.source
  }
}

function htmlDebugPreview (html: string): {
  length: number
  start: string
  end: string
} {
  return {
    length: html.length,
    start: html.slice(0, 500),
    end: html.length > 500 ? html.slice(-200) : ''
  }
}

function logParseFailure (
  reason: string,
  context: {
    shareUrl: string
    shareId: string
    proxyUrl?: string
    html: string
    cause?: unknown
    details?: Record<string, unknown>
  }
): void {
  const cause = context.cause
  console.error(`[ExportMD] ${reason}`, {
    shareUrl: context.shareUrl,
    shareId: context.shareId,
    proxyUrl: context.proxyUrl,
    html: htmlDebugPreview(context.html),
    cause: cause instanceof Error
      ? {
          name: cause.name,
          message: cause.message,
          stack: cause.stack
        }
      : cause,
    ...context.details
  })
}

function getShareAccessError (html: string): string | null {
  const loader = extractLoaderPayload(html)
  if (loader == null) {
    return null
  }

  const decoded = decodeLoader(loader)
  const loaderData = decoded.loaderData
  if (loaderData == null || typeof loaderData !== 'object') {
    return null
  }

  const route = (loaderData as Record<string, unknown>)['routes/share.$shareId.($action)']
  if (route == null || typeof route !== 'object') {
    return null
  }

  const serverResponse = (route as Record<string, unknown>).serverResponse
  if (serverResponse == null || typeof serverResponse !== 'object') {
    return null
  }

  const error = (serverResponse as Record<string, unknown>).error
  return typeof error === 'string' && error.trim().length > 0
    ? error.trim()
    : null
}

function parseShareHtml (
  html: string,
  shareId: string,
  shareUrl: string,
  proxyUrl: string | undefined,
  source: string
): ExportResult {
  const accessError = getShareAccessError(html)
  if (accessError != null) {
    throw new Error(accessError)
  }

  let chat
  try {
    chat = parseChatGptShareHtml(html)
  } catch (cause) {
    logParseFailure('Could not parse share page HTML', {
      shareUrl,
      shareId,
      proxyUrl,
      html,
      cause
    })
    throw new Error('Could not parse this conversation — the page format may have changed or the link is not public.')
  }

  if (chat.replies.length === 0) {
    logParseFailure('Parsed share page has no replies', {
      shareUrl,
      shareId,
      proxyUrl,
      html,
      details: {
        title: chat.title,
        parsedShareId: chat.shareId,
        replyCount: chat.replies.length
      }
    })
    throw new Error('Could not read this conversation — check the link is public and try again.')
  }

  const markdown = chatGptShareToMarkdown(chat)
  const resolvedShareId = chat.shareId.length > 0 ? chat.shareId : shareId
  const filename = sanitizeFilename(chat.title, resolvedShareId)

  return {
    title: chat.title.length > 0 ? chat.title : 'ChatGPT Export',
    markdown,
    filename,
    source
  }
}

function validateShareUrl (url: string): { trimmed: string, shareId: string } {
  const trimmed = url.trim()

  if (isChatGptPrivateConversationUrl(trimmed)) {
    throw new PrivateConversationUrlError()
  }

  if (!isChatGptShareUrl(trimmed)) {
    throw new Error('Please enter a valid ChatGPT share link (chatgpt.com/share/... or chat.openai.com/share/...).')
  }

  return {
    trimmed,
    shareId: getChatGptShareId(trimmed) ?? ''
  }
}

export async function exportChatGptShare (
  url: string,
  onProgress?: ExportProgressCallback
): Promise<ExportResult> {
  const { trimmed, shareId } = validateShareUrl(url)

  const firstProxy = CORS_PROXIES[0]
  if (firstProxy != null) {
    reportProgress(onProgress, {
      strategy: 'client-proxy',
      source: firstProxy.id,
      status: `Trying ${firstProxy.id}…`
    })
  }

  try {
    const { html, proxyUrl, source } = await fetchShareHtml(trimmed, onProgress)
    reportProgress(onProgress, {
      strategy: 'client-proxy',
      source,
      status: 'Parsing conversation…'
    })
    const result = parseShareHtml(html, shareId, trimmed, proxyUrl, source)
    reportProgress(onProgress, {
      strategy: 'client-proxy',
      source,
      status: 'Export complete.'
    })
    return result
  } catch {
    console.warn('[ExportMD] Falling back to server export')
    reportProgress(onProgress, {
      strategy: 'server-api',
      source: '/api/export',
      status: 'Client proxies failed, trying server export…'
    })
    return await exportViaApiFallback(url, onProgress)
  }
}

export function downloadMarkdown (filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function copyMarkdown (content: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText !== 'function') {
    throw new Error('Copy is not supported in this browser.')
  }

  await navigator.clipboard.writeText(content)
}
