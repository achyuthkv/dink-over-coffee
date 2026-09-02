import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const NAV_TABS = [
  { to: '/events', label: 'Sessions', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { to: '/shop', label: 'Shop', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
  { to: '/tournament', label: 'Live', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg> },
  { to: '/membership', label: 'Membership', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="14" y1="14" x2="18" y2="14"/></svg> }
]

export default function NavTabs() {
  const location = useLocation()
  const [open, setOpen] = useState(false)

  // Close the drawer on route change and stop background scroll while it's open.
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      {/* Tablet/desktop: horizontal pill, all tabs visible */}
      <nav className="hidden sm:flex items-center gap-0.5 rounded-full bg-surface-alt border border-border p-1" aria-label="Primary">
        {NAV_TABS.map(tab => {
          const active = location.pathname === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ease-spring ${
                active ? 'bg-interactive text-inverse shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Mobile: hamburger trigger, opens a slide-in drawer instead of a squeezed pill row */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="sm:hidden w-9 h-9 flex items-center justify-center rounded-full border border-border text-primary active:bg-surface-alt active:scale-[.98] transition ease-spring"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
      </button>

      {open && (
        <div className="sm:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 backdrop-in" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="drawer-in absolute top-0 right-0 h-full w-72 max-w-[80%] bg-surface shadow-xl flex flex-col px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-primary font-bold text-sm">Menu</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="w-8 h-8 flex items-center justify-center rounded-full text-muted active:bg-bg transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Primary">
              {NAV_TABS.map(tab => {
                const active = location.pathname === tab.to
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                      active ? 'bg-interactive text-inverse' : 'text-secondary active:bg-bg'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
