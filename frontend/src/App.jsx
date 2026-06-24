import { useState } from 'react'
import RegisterTab from './components/RegisterTab.jsx'
import PlayersTab from './components/PlayersTab.jsx'

export default function App() {
  const [tab, setTab] = useState('register')

  return (
    <div className="min-h-full flex flex-col max-w-md mx-auto">
      <header className="px-5 pt-[env(safe-area-inset-top)] pb-3">
        <div className="flex flex-col items-center gap-2 pt-4">
          <div className="h-12 w-12 bg-coffee-800 text-coffee-50 grid place-items-center font-bold text-xs" style={{borderRadius:'2rem'}}>DOC</div>
          <div className="text-center leading-tight">
            <div className="text-coffee-900 font-extrabold text-lg">Dink Over Coffee</div>
            <div className="text-coffee-600 text-xs">Pickleball | Coffee | Community</div>
          </div>
        </div>
      </header>

      <nav className="px-5 mt-2">
        <div className="grid grid-cols-2 rounded-2xl bg-coffee-100 p-1 text-sm font-semibold">
          <button
            onClick={() => setTab('register')}
            className={`rounded-xl py-2.5 transition ${tab === 'register' ? 'bg-white text-coffee-900 shadow' : 'text-coffee-800/70'}`}
          >Register</button>
          <button
            onClick={() => setTab('players')}
            className={`rounded-xl py-2.5 transition ${tab === 'players' ? 'bg-white text-coffee-900 shadow' : 'text-coffee-800/70'}`}
          >Who's playing</button>
        </div>
      </nav>

      <main className="flex-1 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {tab === 'register' ? <RegisterTab /> : <PlayersTab />}
      </main>

      <footer className="px-5 py-4 text-center text-xs text-coffee-600/70">
        Dink Over Coffee
      </footer>
    </div>
  )
}
