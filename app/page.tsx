'use client'

import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react'
import { AlertCircleIcon, Loader2Icon } from 'lucide-react'
import { ExportSuccessFooter } from '@/components/export-success-footer'
import { MarkdownPreview } from '@/components/markdown-preview'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  copyMarkdown,
  downloadMarkdown,
  exportConversationShare,
  PrivateConversationUrlError,
  type ExportProgress,
  type ExportResult
} from '@/lib/export-chatgpt'
import { ThemeToggle } from '@/components/theme-toggle'

type PageState = 'idle' | 'loading' | 'success' | 'error'
type ErrorKind = 'generic' | 'private'

const FAST_MODE_STORAGE_KEY = 'exportmd-fast-mode'

function strategyLabel (strategy: ExportProgress['strategy']): string {
  return strategy === 'client-proxy' ? 'Client CORS proxy' : 'ExportMD API'
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

export default function Home (): JSX.Element {
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [pageState, setPageState] = useState<PageState>('idle')
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic')
  const [errorMessage, setErrorMessage] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null)
  const [copied, setCopied] = useState(false)
  const [fastMode, setFastMode] = useState(false)

  useEffect(() => {
    try {
      setFastMode(window.localStorage.getItem(FAST_MODE_STORAGE_KEY) === 'true')
    } catch {}
  }, [])

  function handleFastModeChange (checked: boolean): void {
    setFastMode(checked)

    try {
      window.localStorage.setItem(FAST_MODE_STORAGE_KEY, String(checked))
    } catch {}
  }

  async function handleSubmit (event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    setPageState('loading')
    setErrorKind('generic')
    setErrorMessage('')
    setCopied(false)
    setExportProgress({
      strategy: fastMode ? 'server-api' : 'client-proxy',
      source: fastMode ? 'ExportMD API' : 'Corsfix',
      status: fastMode ? 'Starting fast export...' : 'Starting export...'
    })

    try {
      const result = await exportConversationShare(url, setExportProgress, { fastMode })
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
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Could not copy to clipboard.'
      setErrorMessage(
        message
      )
    }
  }

  const isLoading = pageState === 'loading'
  const trimmedUrl = url.trim()
  const hasExport = pageState === 'success' && exportResult != null

  return (
    <main className='flex h-svh flex-col overflow-hidden'>
      <div className='mx-auto my-auto flex w-full max-w-3xl min-h-0 max-h-full flex-col gap-8 overflow-hidden px-4 py-4'>
        <div className='mx-auto flex w-fit max-w-full shrink-0 flex-col gap-8'>
          <header className='text-center'>
            <div className='flex w-full items-center justify-between gap-4'>
              <h1 className='shrink-0 text-3xl font-semibold tracking-tight'>ExportMD</h1>
              <ThemeToggle />
              <label className='flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground'>
                <input
                  type='checkbox'
                  className='size-4 accent-primary'
                  checked={fastMode}
                  onChange={(event) => handleFastModeChange(event.target.checked)}
                  disabled={isLoading}
                />
                <span>
                  Fast mode <span className='hidden sm:inline'>(less private)</span>
                </span>
              </label>
            </div>
            <p className='mt-2 text-muted-foreground'>
              Paste a ChatGPT or Grok share link and export it as Markdown.
            </p>
          </header>

          <section className='w-full shrink-0 space-y-4'>
            <form
              className='flex flex-col gap-3 sm:flex-row'
              onSubmit={(event) => { void handleSubmit(event) }}
            >
              <Input
                ref={urlInputRef}
                type='url'
                placeholder='https://chatgpt.com/share/... or https://grok.com/share/...'
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isLoading}
                aria-label='ChatGPT or Grok share link'
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
                <AlertTitle>Export failed</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </section>
        </div>

        {hasExport && (
          <Card className='flex min-h-0 flex-1 flex-col overflow-hidden pt-0'>
            <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-0'>
              <MarkdownPreview content={exportResult.markdown} />

              <ExportSuccessFooter
                copied={copied}
                source={exportResult.source}
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
