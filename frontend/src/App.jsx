import { Routes, Route, Link } from 'react-router-dom'
import Landing from './components/Landing.jsx'
import RegisterTab from './components/RegisterTab.jsx'
import ShopTab from './components/ShopTab.jsx'
import TournamentTab from './components/TournamentTab.jsx'
import Terms from './components/Terms.jsx'
import Privacy from './components/Privacy.jsx'
import NotFound from './components/NotFound.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Logo from './components/Logo.jsx'
import NavTabs from './components/NavTabs.jsx'

function PageLayout({ children }) {
  return (
    <div className="min-h-full bg-pattern">
      <div className="flex flex-col min-h-full max-w-2xl mx-auto px-5 sm:px-6 md:px-8">
        <header className="pt-[env(safe-area-inset-top)]">
          {/* Wraps to a second row on narrow screens instead of overflowing
              horizontally: logo + toggle stay on row 1, the tab pill (the
              widest element) drops to its own centered row 2. */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 pb-4">
            <Link to="/" className="order-1 flex items-center gap-2.5 shrink-0">
              <Logo className="h-12 w-auto" />
            </Link>
            <div className="order-2 sm:order-3">
              <ThemeToggle />
            </div>
            <div className="order-3 sm:order-2 w-full sm:w-auto flex justify-center">
              <NavTabs />
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
          <div className="flex items-center justify-center gap-3 mt-3 text-muted text-2xs">
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
      <Route path="/tournament" element={<PageLayout><TournamentTab /></PageLayout>} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
