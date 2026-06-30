import { useEffect, useState } from 'react'

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialMode() {
  return localStorage.getItem('themeMode') || 'system'
}

export default function ThemeToggle({ className = '' }) {
  const [mode, setMode] = useState(getInitialMode)

  useEffect(() => {
    const root = document.documentElement
    const resolved = mode === 'system' ? getSystemTheme() : mode
    root.classList.toggle('dark', resolved === 'dark')
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      const root = document.documentElement
      root.classList.toggle('dark', mq.matches)
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [mode])

  function cycle() {
    setMode(prev => {
      const order = ['system', 'light', 'dark']
      const next = order[(order.indexOf(prev) + 1) % 3]
      if (next === 'system') {
        localStorage.removeItem('themeMode')
      } else {
        localStorage.setItem('themeMode', next)
      }
      return next
    })
  }

  return (
    <button
      onClick={cycle}
      title={mode === 'system' ? 'Theme: System' : mode === 'dark' ? 'Theme: Dark' : 'Theme: Light'}
      className={`w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface-alt transition ${className}`}
    >
      {mode === 'system' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      ) : mode === 'dark' ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      )}
    </button>
  )
}
