import {
  type ChatGptShareConversation,
  CHATGPT_SHARE_HEADERS,
  decodeLoader,
  extractLoaderPayload,
  getChatGptShareId,
  isChatGptShareUrl,
  parseChatGptShareHtml
} from 'chatgpt-share-parser'

const CHATGPT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com'])
const GROK_HOSTS = new Set(['grok.com', 'www.grok.com'])
const EXPORTMD_API_SOURCE = 'ExportMD API'

const JSONP_TIMEOUT_MS = 20_000
const JSONP_CALLBACK_GRACE_MS = 750
const SERVER_FETCH_RETRY_DELAYS_MS = [500, 1_500]

type ProxyKind = 'fetch-raw' | 'fetch-json' | 'jsonp'

interface CorsProxy {
  id: string
  kind: ProxyKind
  buildUrl: (shareUrl: string, callbackName?: string) => string
}

// Ordered by preference. Slow mode tries each provider once, then falls back to the API.
const CORS_PROXIES: CorsProxy[] = [
  {
    id: 'Corsfix',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://proxy.corsfix.com/?${url}`
  },
  {
    id: 'corsproxy.io',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  },
  {
    id: 'allOrigins raw',
    kind: 'fetch-raw',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  },
  {
    id: 'allOrigins get',
    kind: 'fetch-json',
    buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
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
    id: 'every-origin',
    kind: 'fetch-json',
    buildUrl: (url) => `https://every-origin.vercel.app/get?url=${encodeURIComponent(url)}`
  },
  {
    id: 'allOrigins JSONP',
    kind: 'jsonp',
    buildUrl: (url, callbackName = 'callback') =>
      `https://api.allorigins.win/get?callback=${encodeURIComponent(callbackName)}&url=${encodeURIComponent(url)}`
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

function parseJsonText (text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} returned invalid JSON.`)
  }
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

async function wait (ms: number): Promise<void> {
  return await new Promise((resolve) => setTimeout(resolve, ms))
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
    return await fetchViaJsonpProxy(proxy.buildUrl, shareUrl, proxy.id, onProgress)
  }

  reportProgress(onProgress, {
    strategy: 'client-proxy',
    source: proxy.id,
    status: `Trying ${proxy.id}...`
  })

  const proxyUrl = proxy.buildUrl(shareUrl)
  const html = await fetchViaFetchProxy(proxy, shareUrl)

  if (!isLikelyShareHtml(html)) {
    throw new Error('Invalid share page.')
  }

  return { html, proxyUrl, source: proxy.id }
}

async function fetchTextViaProxy (
  proxy: CorsProxy,
  targetUrl: string,
  onProgress?: ExportProgressCallback
): Promise<{ text: string, proxyUrl: string, source: string }> {
  if (proxy.kind === 'jsonp') {
    const callbackName = createJsonpCallbackName()
    const proxyUrl = proxy.buildUrl(targetUrl, callbackName)

    reportProgress(onProgress, {
      strategy: 'client-proxy',
      source: proxy.id,
      status: `Trying ${proxy.id}...`
    })

    return {
      text: await fetchViaJsonp(proxyUrl, callbackName),
      proxyUrl,
      source: proxy.id
    }
  }

  reportProgress(onProgress, {
    strategy: 'client-proxy',
    source: proxy.id,
    status: `Trying ${proxy.id}...`
  })

  const proxyUrl = proxy.buildUrl(targetUrl)
  return {
    text: await fetchViaFetchProxy(proxy, targetUrl),
    proxyUrl,
    source: proxy.id
  }
}

async function fetchViaJsonpProxy (
  buildProxyUrl: (shareUrl: string, callbackName: string) => string,
  shareUrl: string,
  source: string,
  onProgress?: ExportProgressCallback
): Promise<{ html: string, proxyUrl: string, source: string }> {
  const callbackName = createJsonpCallbackName()
  const proxyUrl = buildProxyUrl(shareUrl, callbackName)

  reportProgress(onProgress, {
    strategy: 'client-proxy',
    source,
    status: `Trying ${source}...`
  })

  const html = await fetchViaJsonp(proxyUrl, callbackName)
  if (html.trim().length > 0 && isLikelyShareHtml(html)) {
    return { html, proxyUrl, source }
  }

  throw new Error('JSONP proxy returned an invalid share page.')
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

export function isGrokShareUrl (input: string): boolean {
  try {
    const url = new URL(input.trim())
    if (!isGrokHost(url.hostname)) {
      return false
    }

    const segments = url.pathname.split('/').filter(Boolean)
    return segments[0] === 'share' && (segments[1]?.length ?? 0) > 0
  } catch {
    return false
  }
}

function isGrokHost (hostname: string): boolean {
  return GROK_HOSTS.has(hostname)
}

function isGrokUrl (input: string): boolean {
  try {
    const url = new URL(input.trim())
    return isGrokHost(url.hostname)
  } catch {
    return false
  }
}

function getGrokShareId (input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (!isGrokHost(url.hostname)) {
      return null
    }

    const segments = url.pathname.split('/').filter(Boolean)
    return segments[0] === 'share' && (segments[1]?.length ?? 0) > 0
      ? segments[1]
      : null
  } catch {
    return null
  }
}

export interface ExportResult {
  title: string
  markdown: string
  filename: string
  source: string
  timestamp?: string
}

interface MarkdownMessage {
  heading: string
  body: string
}

interface MarkdownDocument {
  title: string
  messages: MarkdownMessage[]
}

export type ExportStrategy = 'client-proxy' | 'server-api'

export interface ExportProgress {
  strategy: ExportStrategy
  source: string
  status: string
}

export type ExportProgressCallback = (progress: ExportProgress) => void

export interface ExportOptions {
  fastMode?: boolean
}

function reportProgress (
  onProgress: ExportProgressCallback | undefined,
  progress: ExportProgress
): void {
  onProgress?.(progress)
}

function timestampFilenameBase (): string {
  return new Date().toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:.]/g, '-')
}

function sanitizeFilename (title: string): string {
  const base = title.trim().length > 0 ? title.trim() : timestampFilenameBase()
  const sanitized = base
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  return `${sanitized.length > 0 ? sanitized : timestampFilenameBase()}-export.md`
}

function replaceMarkdownTitle (markdown: string, title: string): string {
  return markdown.replace(/^#(?: .*)?(\r?\n|$)/, `# ${title}$1`)
}

function finalizeExportResult (result: ExportResult): ExportResult {
  const trimmedTitle = result.title.trim()
  const fallbackTimestamp = result.timestamp ?? timestampFilenameBase()
  const title = trimmedTitle.length > 0
    ? trimmedTitle
    : fallbackTimestamp

  return {
    ...result,
    title,
    timestamp: result.timestamp ?? (trimmedTitle.length === 0 ? fallbackTimestamp : undefined),
    markdown: replaceMarkdownTitle(result.markdown, title),
    filename: sanitizeFilename(title)
  }
}

function renderMarkdownDocument (document: MarkdownDocument): string {
  const lines = [`# ${document.title}`]

  lines.push('')

  for (const message of document.messages) {
    lines.push(`## ${message.heading}`)
    lines.push('')
    lines.push(message.body.trim())
    lines.push('')
  }

  return `${lines.map((line) => line.trimEnd()).join('\n').trimEnd()}\n`
}

async function exportChatGptShareViaClientProxy (
  shareUrl: string,
  shareId: string,
  onProgress?: ExportProgressCallback
): Promise<ExportResult> {
  if (CORS_PROXIES.length === 0) {
    throw new Error('No client-side proxy is configured.')
  }

  const failures: string[] = []

  for (const proxy of CORS_PROXIES) {
    try {
      const { html, proxyUrl, source } = await fetchViaProxy(proxy, shareUrl, onProgress)

      reportProgress(onProgress, {
        strategy: 'client-proxy',
        source,
        status: 'Parsing conversation...'
      })

      const result = finalizeExportResult(parseShareHtml(html, shareId, shareUrl, proxyUrl, source))

      reportProgress(onProgress, {
        strategy: 'client-proxy',
        source,
        status: 'Export complete.'
      })

      return result
    } catch (error) {
      const failure = `${proxy.id}: ${error instanceof Error ? error.message : 'request failed'}`
      failures.push(failure)
    }
  }

  throw new Error(`Client-side proxies failed: ${failures.join('; ')}`)
}

async function fetchShareHtmlOnServer (shareUrl: string): Promise<string> {
  let lastTemporaryStatus: number | null = null

  for (let attempt = 0; attempt <= SERVER_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    let response: Response
    try {
      response = await fetch(shareUrl, {
        headers: CHATGPT_SHARE_HEADERS,
        cache: 'no-store'
      })
    } catch {
      if (attempt === SERVER_FETCH_RETRY_DELAYS_MS.length) {
        throw new Error('Could not reach ChatGPT. Check your connection and try again.')
      }

      await wait(SERVER_FETCH_RETRY_DELAYS_MS[attempt])
      continue
    }

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        lastTemporaryStatus = response.status

        if (attempt < SERVER_FETCH_RETRY_DELAYS_MS.length) {
          await wait(SERVER_FETCH_RETRY_DELAYS_MS[attempt])
          continue
        }

        break
      }

      throw new Error('Could not fetch this conversation. The link may be invalid or temporarily unavailable.')
    }

    const html = await response.text()
    if (!isLikelyShareHtml(html)) {
      throw new Error('Could not fetch a valid share page from ChatGPT.')
    }

    return html
  }

  if (lastTemporaryStatus != null) {
    throw new Error('ChatGPT is temporarily unavailable while fetching this share link. Please wait a moment and try again.')
  }

  throw new Error('Could not reach ChatGPT. Check your connection and try again.')
}

export async function exportChatGptShareOnServer (url: string): Promise<ExportResult> {
  const { trimmed, shareId } = validateShareUrl(url)
  const html = await fetchShareHtmlOnServer(trimmed)
  return parseShareHtml(html, shareId, trimmed, 'server', EXPORTMD_API_SOURCE)
}

type GrokSender = 'human' | 'ASSISTANT' | string

interface GrokResponse {
  message?: unknown
  sender?: GrokSender
  isControl?: unknown
}

interface GrokSharePayload {
  conversation?: {
    title?: unknown
  }
  responses?: GrokResponse[]
}

function senderLabel (sender: GrokSender | undefined): string {
  if (sender === 'human') {
    return 'User'
  }

  if (sender === 'ASSISTANT') {
    return 'Grok'
  }

  return typeof sender === 'string' && sender.trim().length > 0
    ? sender.trim()
    : 'Message'
}

function parseGrokSharePayload (
  payload: GrokSharePayload,
  shareId: string,
  source: string
): ExportResult {
  const conversationTitle = typeof payload.conversation?.title === 'string'
    ? payload.conversation.title.trim()
    : ''
  const responses = Array.isArray(payload.responses)
    ? payload.responses.filter((response) => {
      return response.isControl !== true &&
        typeof response.message === 'string' &&
        response.message.trim().length > 0
    })
    : []

  const markdown = renderMarkdownDocument({
    title: conversationTitle,
    messages: responses.map((response) => ({
      heading: senderLabel(response.sender),
      body: String(response.message).trim()
    }))
  })

  return {
    title: conversationTitle,
    markdown,
    filename: sanitizeFilename(conversationTitle),
    source
  }
}

async function fetchGrokSharePayload (shareId: string): Promise<GrokSharePayload> {
  let response: Response
  try {
    response = await fetch(`https://grok.com/rest/app-chat/share_links/${encodeURIComponent(shareId)}`, {
      headers: {
        accept: 'application/json'
      },
      cache: 'no-store'
    })
  } catch {
    throw new Error('Could not reach Grok. Check your connection and try again.')
  }

  if (!response.ok) {
    throw new Error('Could not fetch this Grok conversation. The link may be invalid or temporarily unavailable.')
  }

  const payload: unknown = await response.json().catch(() => null)
  if (payload == null || typeof payload !== 'object') {
    throw new Error('Grok returned an invalid response.')
  }

  return payload as GrokSharePayload
}

function buildGrokShareDataUrl (shareId: string): string {
  return `https://grok.com/rest/app-chat/share_links/${encodeURIComponent(shareId)}`
}

async function exportGrokShareViaClientProxy (
  shareId: string,
  onProgress?: ExportProgressCallback
): Promise<ExportResult> {
  if (CORS_PROXIES.length === 0) {
    throw new Error('No client-side proxy is configured.')
  }

  const dataUrl = buildGrokShareDataUrl(shareId)
  const failures: string[] = []

  for (const proxy of CORS_PROXIES) {
    try {
      const { text, source } = await fetchTextViaProxy(proxy, dataUrl, onProgress)
      const payload = parseJsonText(text, 'Grok') as GrokSharePayload

      reportProgress(onProgress, {
        strategy: 'client-proxy',
        source,
        status: 'Parsing conversation...'
      })

      const result = finalizeExportResult(parseGrokSharePayload(payload, shareId, source))

      reportProgress(onProgress, {
        strategy: 'client-proxy',
        source,
        status: 'Export complete.'
      })

      return result
    } catch (cause) {
      const failure = `${proxy.id}: ${cause instanceof Error ? cause.message : 'request failed'}`
      failures.push(failure)
    }
  }

  throw new Error(`Client-side proxies failed: ${failures.join('; ')}`)
}

export async function exportGrokShareOnServer (url: string): Promise<ExportResult> {
  const shareId = getGrokShareId(url)
  if (shareId == null) {
    throw new Error('Please enter a valid Grok share link (grok.com/share/...).')
  }

  const payload = await fetchGrokSharePayload(shareId)
  return parseGrokSharePayload(payload, shareId, EXPORTMD_API_SOURCE)
}

export async function exportConversationShareOnServer (url: string): Promise<ExportResult> {
  if (isGrokUrl(url)) {
    return finalizeExportResult(await exportGrokShareOnServer(url))
  }

  return finalizeExportResult(await exportChatGptShareOnServer(url))
}

async function exportViaApiFallback (
  url: string,
  onProgress?: ExportProgressCallback,
  clientFailures?: string[]
): Promise<ExportResult> {
  reportProgress(onProgress, {
    strategy: 'server-api',
    source: EXPORTMD_API_SOURCE,
    status: 'Fetching share page via server...'
  })

  let response: Response
  try {
    response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ExportMD-Client': 'web'
      },
      body: JSON.stringify({ url })
    })
  } catch {
    throw new Error('Could not fetch this conversation. Client proxies and the server fallback are unavailable.')
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('ExportMD API is temporarily rate limited. Please wait a moment and try again.')
    }

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

    throw new Error(message)
  }

  if (
    payload == null ||
    typeof payload !== 'object' ||
    !('markdown' in payload) ||
    !('filename' in payload) ||
    !('timestamp' in payload) ||
    ('title' in payload && typeof payload.title !== 'string') ||
    typeof payload.markdown !== 'string' ||
    typeof payload.filename !== 'string' ||
    typeof payload.timestamp !== 'string'
  ) {
    throw new Error('Could not export this conversation. Please try again.')
  }

  reportProgress(onProgress, {
    strategy: 'server-api',
    source: EXPORTMD_API_SOURCE,
    status: 'Export complete.'
  })

  return {
    title: 'title' in payload && typeof payload.title === 'string' ? payload.title : '',
    markdown: payload.markdown,
    filename: payload.filename,
    source: EXPORTMD_API_SOURCE,
    timestamp: payload.timestamp
  }
}

function filterChatGptExportMessages (chat: ChatGptShareConversation): ChatGptShareConversation {
  return {
    ...chat,
    replies: chat.replies.filter((reply) => {
      return reply.type !== 'tool' && reply.statement.trim().length > 0
    })
  }
}

function renderChatGptShareMarkdown (chat: ChatGptShareConversation): string {
  return renderMarkdownDocument({
    title: chat.title.trim(),
    messages: chat.replies.map((reply) => ({
      heading: reply.authorName.trim().length > 0 ? reply.authorName.trim() : reply.type,
      body: reply.statement.trim()
    }))
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
  } catch {
    throw new Error('Could not parse this conversation — the page format may have changed or the link is not public.')
  }

  const exportChat = filterChatGptExportMessages(chat)

  const markdown = renderChatGptShareMarkdown(exportChat)
  const filename = sanitizeFilename(exportChat.title)

  return {
    title: exportChat.title,
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
    throw new Error('Please enter a valid ChatGPT or Grok share link (chatgpt.com/share/..., chat.openai.com/share/..., or grok.com/share/...).')
  }

  return {
    trimmed,
    shareId: getChatGptShareId(trimmed) ?? ''
  }
}

function validateSupportedShareUrl (url: string): { trimmed: string, shareId: string, source: 'chatgpt' | 'grok' } {
  const trimmed = url.trim()

  if (isGrokUrl(trimmed)) {
    const shareId = getGrokShareId(trimmed)
    if (shareId == null) {
      throw new Error('Please enter a valid Grok share link (grok.com/share/...).')
    }

    return {
      trimmed,
      shareId,
      source: 'grok'
    }
  }

  const chatGpt = validateShareUrl(trimmed)
  return {
    ...chatGpt,
    source: 'chatgpt'
  }
}

export async function exportConversationShare (
  url: string,
  onProgress?: ExportProgressCallback,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const { trimmed, shareId, source: shareSource } = validateSupportedShareUrl(url)

  if (options.fastMode === true) {
    return finalizeExportResult(await exportViaApiFallback(trimmed, onProgress))
  }

  if (shareSource === 'grok') {
    try {
      return await exportGrokShareViaClientProxy(shareId, onProgress)
    } catch {
      reportProgress(onProgress, {
        strategy: 'server-api',
        source: EXPORTMD_API_SOURCE,
        status: 'Client proxy failed, trying server export...'
      })
      return finalizeExportResult(await exportViaApiFallback(trimmed, onProgress))
    }
  }

  const firstProxy = CORS_PROXIES[0]
  if (firstProxy != null) {
    reportProgress(onProgress, {
      strategy: 'client-proxy',
      source: firstProxy.id,
      status: 'Starting client export...'
    })
  }

  try {
    return await exportChatGptShareViaClientProxy(trimmed, shareId, onProgress)
  } catch {
    reportProgress(onProgress, {
      strategy: 'server-api',
      source: EXPORTMD_API_SOURCE,
      status: 'Client proxies failed, trying server export...'
    })
    return finalizeExportResult(await exportViaApiFallback(url, onProgress))
  }
}

export const exportChatGptShare = exportConversationShare

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
