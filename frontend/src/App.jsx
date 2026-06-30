import { Routes, Route } from 'react-router-dom'
import Landing from './components/Landing.jsx'
import RegisterTab from './components/RegisterTab.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/events" element={
        <div className="min-h-full flex flex-col max-w-md mx-auto bg-pattern">
          <header className="px-5 pt-[env(safe-area-inset-top)] pb-3">
            <div className="flex justify-end pt-3">
              <ThemeToggle />
            </div>
            <div className="flex flex-col items-center gap-2 pt-1">
              <div className="h-12 w-12 bg-interactive text-inverse grid place-items-center font-bold text-xs" style={{borderRadius:'2rem'}}>DOC</div>
              <div className="text-center leading-tight">
                <div className="text-text font-extrabold text-lg">Dink Over Coffee</div>
                <div className="text-secondary text-xs">Play. Connect. Belong.</div>
              </div>
            </div>
          </header>
          <main className="flex-1 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            <RegisterTab />
          </main>
          <footer className="px-5 py-4 text-center text-xs text-secondary/70">
            Dink Over Coffee
          </footer>
        </div>
      } />
    </Routes>
  )
}
