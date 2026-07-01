import { Routes, Route, Link } from 'react-router-dom'
import Landing from './components/Landing.jsx'
import RegisterTab from './components/RegisterTab.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import Logo from './components/Logo.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/events" element={
        <div className="min-h-full bg-pattern">
          <div className="flex flex-col min-h-full max-w-2xl mx-auto px-5 sm:px-6 md:px-8">
            <header className="pt-[env(safe-area-inset-top)]">
              <div className="flex items-center justify-between pt-5 pb-4">
                <Link to="/" className="flex items-center gap-2.5">
                  <Logo className="h-10 w-auto" />
                </Link>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              <RegisterTab />
            </main>
            <footer className="py-6 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Logo className="h-7 w-auto" />
              </div>
              <p className="text-muted text-xs">Play. Connect. Belong.</p>
            </footer>
          </div>
        </div>
      } />
    </Routes>
  )
}
