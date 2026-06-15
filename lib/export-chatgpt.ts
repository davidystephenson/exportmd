import {
  chatGptShareToMarkdown,
  getChatGptShareId,
  isChatGptShareUrl,
  parseChatGptShareHtml
} from 'chatgpt-share-parser'

const ALLORIGINS_RAW = 'https://api.allorigins.win/raw?url='

export interface ExportResult {
  title: string
  markdown: string
  filename: string
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

export async function exportChatGptShare (url: string): Promise<ExportResult> {
  const trimmed = url.trim()

  if (!isChatGptShareUrl(trimmed)) {
    throw new Error('Please enter a valid ChatGPT share link (chatgpt.com/share/... or chat.openai.com/share/...).')
  }

  const shareId = getChatGptShareId(trimmed) ?? ''
  const proxyUrl = ALLORIGINS_RAW + encodeURIComponent(trimmed)

  let response: Response
  try {
    response = await fetch(proxyUrl)
  } catch {
    throw new Error('Could not reach the export service. Check your connection and try again.')
  }

  if (!response.ok) {
    throw new Error('Could not fetch this conversation. The link may be invalid or the service is temporarily unavailable.')
  }

  const html = await response.text()

  if (html.trim().length === 0) {
    throw new Error('Could not read this conversation — check the link is public and try again.')
  }

  let chat
  try {
    chat = parseChatGptShareHtml(html)
  } catch {
    throw new Error('Could not parse this conversation — the page format may have changed or the link is not public.')
  }

  if (chat.replies.length === 0) {
    throw new Error('Could not read this conversation — check the link is public and try again.')
  }

  const markdown = chatGptShareToMarkdown(chat)
  const resolvedShareId = chat.shareId.length > 0 ? chat.shareId : shareId
  const filename = sanitizeFilename(chat.title, resolvedShareId)

  return {
    title: chat.title.length > 0 ? chat.title : 'ChatGPT Export',
    markdown,
    filename
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
