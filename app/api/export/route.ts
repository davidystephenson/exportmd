import {
  exportChatGptShareOnServer,
  PrivateConversationUrlError
} from '@/lib/export-chatgpt'

export const runtime = 'nodejs'

export async function POST (request: Request): Promise<Response> {
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
    const result = await exportChatGptShareOnServer(url)
    return Response.json(result)
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
