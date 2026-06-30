import { useEffect, useState, useRef } from 'react'

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialMode() {
  return localStorage.getItem('themeMode') || 'system'
}

const options = [
  { value: 'system', label: 'System', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" stroke="none" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z"/></svg> },
  { value: 'light', label: 'Light', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
  { value: 'dark', label: 'Dark', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> },
]

export default function ThemeToggle({ className = '' }) {
  const [mode, setMode] = useState(getInitialMode)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const root = document.documentElement
    const resolved = mode === 'system' ? getSystemTheme() : mode
    root.classList.toggle('dark', resolved === 'dark')
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      document.documentElement.classList.toggle('dark', mq.matches)
    }
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [mode])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function select(value) {
    setMode(value)
    if (value === 'system') {
      localStorage.removeItem('themeMode')
    } else {
      localStorage.setItem('themeMode', value)
    }
    setOpen(false)
  }

  const current = options.find(o => o.value === mode)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface-alt transition"
        title={`Theme: ${current.label}`}
      >
        {current.icon}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-36 rounded-xl border border-border bg-surface shadow-lg py-1 z-50">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition ${opt.value === mode ? 'text-interactive font-semibold bg-interactive/5' : 'text-primary hover:bg-bg-alt'}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
