'use client'

import { useEffect, useState, type JSX } from 'react'
import { MoonIcon, SunIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark'

function getStoredTheme (): Theme | null {
  try {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return null
}

function getSystemTheme (): Theme {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function ThemeToggle (): JSX.Element {
  const [theme, setTheme] = useState<Theme>('light')
  const [stored, setStored] = useState(false)

  useEffect(() => {
    const saved = getStoredTheme()
    if (saved !== null) {
      setTheme(saved)
      setStored(true)
    } else {
      setTheme(getSystemTheme())
      setStored(false)
    }
  }, [])

  function toggle (): void {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setStored(true)
    try {
      localStorage.setItem('theme', next)
    } catch {}
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  function clearStored (): void {
    try {
      localStorage.removeItem('theme')
    } catch {}
    const system = getSystemTheme()
    setTheme(system)
    setStored(false)
    document.documentElement.classList.toggle('dark', system === 'dark')
  }

  return (
    <div>
      <Button variant='ghost' size='icon' onClick={toggle} aria-label='Toggle theme'>
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </Button>
      {stored && (
        <Button variant='ghost' size='icon' onClick={clearStored} aria-label='Reset to system theme'>
          <XIcon />
        </Button>
      )}
    </div>
  )
}
