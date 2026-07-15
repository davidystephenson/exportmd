'use client'

import type { JSX } from 'react'
import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

export function ExportSuccessFooter ({
  copied,
  source,
  onDownload,
  onCopy,
  onReset
}: {
  copied: boolean
  source: string
  onDownload: () => void
  onCopy: () => void
  onReset: () => void
}): JSX.Element {
  return (
    <footer className='flex shrink-0 flex-col gap-3 px-(--card-spacing) sm:flex-row sm:items-center sm:justify-between'>
      <p className='text-sm text-muted-foreground'>
        <span className='font-medium text-foreground'>Source:</span>{' '}
        {source}
      </p>
      <ExportActions
        copied={copied}
        className='sm:justify-end'
        onDownload={onDownload}
        onCopy={onCopy}
        onReset={onReset}
      />
    </footer>
  )
}
