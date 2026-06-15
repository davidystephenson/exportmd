import type { Metadata } from 'next'
import './globals.css'
import { JSX } from 'react'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'ExportMD',
  description: 'One click ChatGPT to Markdown'
}

export default function RootLayout (props: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <html lang='en' className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}else if(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()` // eslint-disable-line
          }}
        />
      </head>
      <body>
        {props.children}
      </body>
    </html>
  )
}
