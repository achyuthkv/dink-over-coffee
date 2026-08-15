import { Link, useLocation } from 'react-router-dom'

const NAV_TABS = [
  { to: '/events', label: 'Sessions', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { to: '/shop', label: 'Shop', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
  { to: '/tournament', label: 'Live', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg> }
]

export default function NavTabs() {
  const location = useLocation()
  return (
    <nav className="flex items-center gap-0.5 rounded-full bg-surface-alt border border-border p-1" aria-label="Primary">
      {NAV_TABS.map(tab => {
        const active = location.pathname === tab.to
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              active ? 'bg-interactive text-inverse shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
