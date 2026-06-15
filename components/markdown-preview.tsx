'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

export function MarkdownPreview ({
  content,
  className
}: {
  content: string
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'markdown-preview max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className='mb-4 mt-6 text-xl font-semibold first:mt-0'>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className='mb-3 mt-5 text-lg font-semibold first:mt-0'>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className='mb-2 mt-4 text-base font-semibold first:mt-0'>{children}</h3>
          ),
          p: ({ children }) => <p className='mb-3 last:mb-0'>{children}</p>,
          ul: ({ children }) => <ul className='mb-3 list-disc space-y-1 pl-5'>{children}</ul>,
          ol: ({ children }) => <ol className='mb-3 list-decimal space-y-1 pl-5'>{children}</ol>,
          li: ({ children }) => <li className='leading-relaxed'>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className='mb-3 border-l-2 border-border pl-4 text-muted-foreground'>
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className='mb-3 overflow-x-auto rounded-md bg-background p-3 ring-1 ring-foreground/10'>
              {children}
            </pre>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isBlock = codeClassName?.includes('language-') === true

            if (isBlock) {
              return (
                <code className={cn('font-mono text-xs', codeClassName)} {...props}>
                  {children}
                </code>
              )
            }

            return (
              <code
                className='rounded bg-background px-1 py-0.5 font-mono text-xs ring-1 ring-foreground/10'
                {...props}
              >
                {children}
              </code>
            )
          },
          a: ({ href, children }) => (
            <a
              href={href}
              className='text-primary underline underline-offset-2 hover:text-primary/80'
              target='_blank'
              rel='noopener noreferrer'
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className='mb-3 overflow-x-auto'>
              <table className='w-full border-collapse text-left'>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className='border border-border bg-muted px-3 py-2 font-medium'>{children}</th>
          ),
          td: ({ children }) => (
            <td className='border border-border px-3 py-2'>{children}</td>
          ),
          hr: () => <hr className='my-6 border-border' />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
