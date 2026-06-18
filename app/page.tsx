'use client'

import { useRef, useState, type FormEvent, type JSX } from 'react'
import { AlertCircleIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { MarkdownPreview } from '@/components/markdown-preview'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
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
  PrivateConversationUrlError,
  type ExportProgress,
  type ExportResult
} from '@/lib/export-chatgpt'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

type PageState = 'idle' | 'loading' | 'success' | 'error'
type ErrorKind = 'generic' | 'private'

function strategyLabel (strategy: ExportProgress['strategy']): string {
  return strategy === 'client-proxy' ? 'Client CORS proxy' : 'Server API'
}

function ExportProgressPanel ({ progress }: { progress: ExportProgress }): JSX.Element {
  return (
    <div
      className='space-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground'
      aria-live='polite'
    >
      <p>
        <span className='font-medium text-foreground'>Strategy:</span>{' '}
        {strategyLabel(progress.strategy)}
      </p>
      <p>
        <span className='font-medium text-foreground'>Source:</span>{' '}
        {progress.source}
      </p>
      <p>
        <span className='font-medium text-foreground'>Status:</span>{' '}
        {progress.status}
      </p>
    </div>
  )
}

function ExportActions ({
  copied,
  onDownload,
  onCopy,
  onReset,
  className
}: {
  copied: boolean
  onDownload: () => void
  onCopy: () => void
  onReset: () => void
  className?: string
}): JSX.Element {
  return (
    <div className={cn('flex flex-row flex-wrap gap-2', className)}>
      <Button variant='outline' onClick={() => { void onCopy() }}>
        {copied
          ? (
            <>
              <CheckIcon />
              Copied!
            </>
            )
          : (
              'Copy'
            )}
      </Button>
      <Button onClick={onDownload}>Download</Button>
      <Button variant='ghost' onClick={onReset}>
        Reset
      </Button>
    </div>
  )
}

export default function Home (): JSX.Element {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic')
  const [errorMessage, setErrorMessage] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit (event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    setPageState('loading')
    setErrorKind('generic')
    setErrorMessage('')
    setCopied(false)
    setExportProgress({
      strategy: 'client-proxy',
      source: 'corsfix',
      status: 'Starting export…'
    })

    try {
      const result = await exportChatGptShare(url, setExportProgress)
      setExportResult(result)
      setPageState('success')
    } catch (error) {
      setExportResult(null)
      setPageState('error')

      if (error instanceof PrivateConversationUrlError) {
        setErrorKind('private')
        setErrorMessage('')
        setExportProgress(null)
        return
      }

      setErrorKind('generic')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setExportProgress(null)
    }
  }

  function handleReset (): void {
    setPageState('idle')
    setExportResult(null)
    setErrorKind('generic')
    setErrorMessage('')
    setCopied(false)
    setExportProgress(null)
    urlInputRef.current?.focus()
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
      setErrorKind('generic')
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Could not copy to clipboard.'
      )
    }
  }

  const isLoading = pageState === 'loading'
  const trimmedUrl = url.trim()
  const hasExport = pageState === 'success' && exportResult != null

  return (
    <main className='flex h-svh flex-col overflow-hidden'>
      <div className='mx-auto my-auto flex w-full max-w-3xl min-h-0 max-h-full flex-col gap-8 overflow-hidden px-4 py-4'>
        <header className='shrink-0 space-y-2 text-center'>
          <div className='flex items-center justify-center gap-2'>
            <h1 className='text-3xl font-semibold tracking-tight'>ExportMD</h1>
            <ThemeToggle />
          </div>
          <p className='text-muted-foreground'>
            Paste your ChatGPT share link and export it as Markdown.
          </p>
        </header>

        <Card className='shrink-0'>
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
                ref={urlInputRef}
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

            {isLoading && exportProgress != null && (
              <ExportProgressPanel progress={exportProgress} />
            )}

            {pageState === 'error' && errorKind === 'private' && (
              <Alert variant='destructive'>
                <AlertCircleIcon />
                <AlertTitle>This is a private conversation link</AlertTitle>
                <AlertDescription>
                  <p>
                    The URL you pasted opens a chat in your account. ExportMD needs a public share link instead.
                  </p>
                  <ol className='mt-2 list-decimal space-y-1 pl-4'>
                    <li>Open the conversation on chatgpt.com while signed in.</li>
                    <li>
                      Click <strong>Share</strong> in the top-right of the chat, or open the{' '}
                      <strong>⋯</strong> menu next to the chat in the sidebar and choose{' '}
                      <strong>Share</strong>.
                    </li>
                    <li>Click <strong>Create link</strong>, then <strong>Copy link</strong>.</li>
                    <li>Paste the chatgpt.com/share/... link here and export again.</li>
                  </ol>
                </AlertDescription>
              </Alert>
            )}

            {pageState === 'error' && errorKind === 'generic' && (
              <Alert variant='destructive'>
                <AlertCircleIcon />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {hasExport && (
          <Card className='flex min-h-0 flex-1 flex-col overflow-hidden'>
            <CardHeader className='shrink-0'>
              <CardTitle>{exportResult.title}</CardTitle>
              <CardAction>
                <ExportActions
                  copied={copied}
                  onDownload={handleDownload}
                  onCopy={() => { void handleCopy() }}
                  onReset={handleReset}
                />
              </CardAction>
            </CardHeader>
            <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'>
              <MarkdownPreview content={exportResult.markdown} />

              <ExportActions
                copied={copied}
                className='shrink-0'
                onDownload={handleDownload}
                onCopy={() => { void handleCopy() }}
                onReset={handleReset}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
