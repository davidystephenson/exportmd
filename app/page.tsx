'use client'

import { useState, type FormEvent, type JSX } from 'react'
import { AlertCircleIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { MarkdownPreview } from '@/components/markdown-preview'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  copyMarkdown,
  downloadMarkdown,
  exportChatGptShare,
  type ExportResult
} from '@/lib/export-chatgpt'
import { ThemeToggle } from '@/components/theme-toggle'

type PageState = 'idle' | 'loading' | 'success' | 'error'

export default function Home (): JSX.Element {
  const [url, setUrl] = useState('')
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit (event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    setPageState('loading')
    setErrorMessage('')
    setCopied(false)

    try {
      const result = await exportChatGptShare(url)
      setExportResult(result)
      setPageState('success')
    } catch (error) {
      setExportResult(null)
      setPageState('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      )
    }
  }

  function handleExportAnother (): void {
    setPageState('idle')
    setExportResult(null)
    setErrorMessage('')
    setCopied(false)
  }

  function handleDownload (): void {
    if (exportResult == null) return
    downloadMarkdown(exportResult.filename, exportResult.markdown)
  }

  async function handleCopy (): Promise<void> {
    if (exportResult == null) return

    try {
      await copyMarkdown(exportResult.markdown)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      setPageState('error')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not copy to clipboard.'
      )
    }
  }

  const isLoading = pageState === 'loading'
  const trimmedUrl = url.trim()

  return (
    <main className='mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-4 py-12'>
      <header className='space-y-2 text-center'>
        <div className='flex items-center justify-center gap-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>ExportMD</h1>
          <ThemeToggle />
        </div>
        <p className='text-muted-foreground'>
          Paste your ChatGPT share link and export it as Markdown.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Export conversation</CardTitle>
          <CardDescription>
            Works with public share links from chatgpt.com or chat.openai.com.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <form
            className='flex flex-col gap-3 sm:flex-row'
            onSubmit={(event) => { void handleSubmit(event) }}
          >
            <Input
              type='url'
              placeholder='https://chatgpt.com/share/...'
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={isLoading}
              aria-label='ChatGPT share link'
              required
            />
            <Button type='submit' disabled={isLoading || trimmedUrl.length === 0} className='sm:min-w-28'>
              {isLoading
                ? (
                  <>
                    <Loader2Icon className='animate-spin' />
                    Exporting
                  </>
                  )
                : (
                    'Export'
                  )}
            </Button>
          </form>

          {pageState === 'error' && (
            <Alert variant='destructive'>
              <AlertCircleIcon />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {pageState === 'success' && exportResult != null && (
        <Card>
          <CardHeader>
            <CardTitle>{exportResult.title}</CardTitle>
            <CardDescription>Preview your exported Markdown below.</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <MarkdownPreview content={exportResult.markdown} />

            <div className='flex flex-col gap-2 sm:flex-row'>
              <Button onClick={handleDownload}>Download .md</Button>
              <Button variant='outline' onClick={() => { void handleCopy() }}>
                {copied
                  ? (
                    <>
                      <CheckIcon />
                      Copied!
                    </>
                    )
                  : (
                      'Copy Markdown'
                    )}
              </Button>
              <Button variant='ghost' onClick={handleExportAnother}>
                Export another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
