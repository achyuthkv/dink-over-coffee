import RegisterTab from './components/RegisterTab.jsx'

export default function App() {
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

      <main className="flex-1 px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <RegisterTab />
      </main>

      <footer className="px-5 py-4 text-center text-xs text-coffee-600/70">
        Dink Over Coffee
      </footer>
    </div>
  )
}
