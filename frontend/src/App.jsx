import { Routes, Route, Link } from 'react-router-dom'
import Landing from './components/Landing.jsx'
import RegisterTab from './components/RegisterTab.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/events" element={
        <div className="min-h-full bg-pattern">
          <div className="flex flex-col min-h-full">
            <header className="px-5 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-[env(safe-area-inset-top)]">
              <div className="flex items-center justify-between pt-5 pb-4">
                <Link to="/" className="flex items-center gap-2.5">
                  <div className="h-9 w-9 bg-interactive text-inverse grid place-items-center font-bold text-[9px] rounded-xl">DOC</div>
                  <div className="leading-tight">
                    <div className="text-text font-bold text-sm">Dink Over Coffee</div>
                    <div className="text-secondary text-[11px]">Play. Connect. Belong.</div>
                  </div>
                </Link>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 px-5 md:px-8 w-full pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              <RegisterTab />
            </main>
            <footer className="px-5 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-6 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-interactive text-inverse grid place-items-center font-bold text-[6px] rounded-md">DOC</div>
                <span className="text-primary font-bold text-sm">Dink Over Coffee</span>
              </div>
              <p className="text-muted text-xs">Play. Connect. Belong.</p>
            </footer>
          </div>
        </div>
      } />
    </Routes>
  )
}
