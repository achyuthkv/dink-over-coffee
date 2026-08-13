import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Landing from './components/Landing.jsx'
import RegisterTab from './components/RegisterTab.jsx'
import ShopTab from './components/ShopTab.jsx'
import Terms from './components/Terms.jsx'
import Privacy from './components/Privacy.jsx'
import NotFound from './components/NotFound.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Logo from './components/Logo.jsx'

const NAV_TABS = [
  { to: '/events', label: 'Sessions', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { to: '/shop', label: 'Shop', icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> }
]

function NavTabs() {
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

function PageLayout({ children }) {
  return (
    <div className="min-h-full bg-pattern">
      <div className="flex flex-col min-h-full max-w-2xl mx-auto px-5 sm:px-6 md:px-8">
        <header className="pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between pt-5 pb-4 gap-3">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <Logo className="h-12 w-auto" />
            </Link>
            <div className="flex items-center gap-2.5">
              <NavTabs />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="flex-1 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          {children}
        </main>
        <footer className="py-6 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo className="h-9 w-auto" />
            </div>
            <p className="text-muted text-xs">Play. Connect. Belong.</p>
          </div>
          <div className="flex items-center justify-center gap-3 mt-3 text-muted text-[11px]">
            <Link to="/terms" className="hover:text-primary transition">Guidelines</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-primary transition">Privacy</Link>
            <span>·</span>
            <a href="mailto:connect@dinkovercoffee.com" className="hover:text-primary transition">connect@dinkovercoffee.com</a>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/events" element={<PageLayout><RegisterTab /></PageLayout>} />
      <Route path="/shop" element={<PageLayout><ShopTab /></PageLayout>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
