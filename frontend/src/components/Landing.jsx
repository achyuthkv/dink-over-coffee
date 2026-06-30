import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import ThemeToggle from './ThemeToggle.jsx'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]}`
}

export default function Landing() {
  const [nextSession, setNextSession] = useState(null)

  useEffect(() => {
    api.listSessions().then(({ sessions }) => {
      if (sessions?.length) setNextSession(sessions[0])
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-bg-alt flex flex-col">

      {/* Nav */}
      <nav className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-interactive text-inverse grid place-items-center font-bold text-[9px] rounded-xl">DOC</div>
          <span className="text-primary font-semibold text-sm">Dink Over Coffee</span>
        </Link>
        <ThemeToggle />
      </nav>

      {/* Hero — two-column on desktop */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-12 pb-10 md:pt-20 md:pb-16 lg:pt-24 lg:pb-20 flex flex-col lg:flex-row lg:items-center lg:gap-16">
        <div className="flex-1">
          <h1 className="text-primary text-[clamp(2rem,5vw,3.8rem)] font-extrabold leading-[1.08] tracking-tight">
            The game brings you here.
          </h1>
          <h1 className="text-secondary text-[clamp(2rem,5vw,3.8rem)] font-extrabold leading-[1.08] tracking-tight">
            The people make you stay.
          </h1>

          <p className="mt-5 text-muted text-sm md:text-base leading-relaxed">
            Pickleball sessions every week in Bangalore. All levels. No partner needed. Just show up.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link to="/events" className="inline-flex items-center gap-2 rounded-full bg-interactive text-inverse px-6 py-3 text-sm font-semibold active:scale-[.98] transition shadow-lg shadow-interactive/10">
              Book a Session
            </Link>
            <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border-2 border-border text-primary px-6 py-3 text-sm font-medium active:scale-[.98] transition">
              Join Community
            </a>
          </div>
        </div>

        {/* Right column — session card + how it works */}
        <div className="mt-10 lg:mt-0 lg:w-[380px] shrink-0 space-y-5">
          {nextSession && (
            <div>
              <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-2">Upcoming session</p>
              <Link to="/events" className="flex items-center gap-4 bg-surface rounded-2xl p-4 border border-border active:scale-[.99] transition">
                <div className="w-10 h-10 rounded-xl bg-interactive/10 grid place-items-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-primary text-sm font-semibold truncate">{nextSession.title || 'Upcoming Session'}</p>
                  <p className="text-muted text-xs truncate">{fmtDate(nextSession.date)} · {nextSession.time} · {Math.max(0, nextSession.maxSlots - nextSession.takenSlots)} spots left</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          )}

          <div className="bg-surface rounded-2xl p-5 border border-border">
            <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-4">How it works</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>, label: 'Sign up' },
                { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: 'Show up' },
                { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, label: 'Stay for coffee' },
              ].map(item => (
                <div key={item.label}>
                  <div className="w-9 h-9 rounded-xl bg-interactive/10 grid place-items-center mx-auto mb-1.5">{item.icon}</div>
                  <p className="text-primary text-xs font-semibold">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value props — horizontal on desktop */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-10 border-t border-border">
        <div className="grid md:grid-cols-3 gap-4 md:gap-8">
          {[
            { title: 'No partner needed', desc: 'Show up solo — we mix the groups and rotate partners every game. You’ll play with everyone by the end of the session.' },
            { title: 'All levels welcome', desc: 'Beginners get their own court with coaching tips. Intermediate and advanced players get competitive rallies. Everyone improves at their own pace.' },
            { title: 'Every week', desc: 'Four to five sessions across weekdays and weekends. Morning and evening slots. Pick what fits your schedule and make it a habit.' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />
              <div>
                <p className="text-primary text-sm font-semibold">{item.title}</p>
                <p className="text-muted text-sm mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The vibe */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-12 border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-4">The vibe</p>
          <p className="text-primary text-[clamp(1.2rem,3vw,1.8rem)] font-bold leading-snug">
            Strangers become doubles partners.
          </p>
          <p className="text-secondary text-[clamp(1.2rem,3vw,1.8rem)] font-bold leading-snug mt-1">
            Doubles partners become friends.
          </p>
          <p className="mt-4 text-muted text-sm leading-relaxed max-w-md mx-auto">
            The best sessions aren&apos;t about winning. They&apos;re about the conversations between games, the inside jokes, and the &ldquo;same time next week?&rdquo;
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-12 border-t border-border text-center">
        <h2 className="text-primary text-xl md:text-2xl font-extrabold">Your next favourite weekend starts here.</h2>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <Link to="/events" className="inline-flex items-center rounded-full bg-interactive text-inverse px-6 py-3 text-sm font-semibold active:scale-[.98] transition shadow-lg shadow-interactive/10">
            Book a Session
          </Link>
          <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border-2 border-border text-primary px-6 py-3 text-sm font-medium active:scale-[.98] transition">
            Join Community
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-6 mt-auto border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 bg-interactive text-inverse grid place-items-center font-bold text-[6px] rounded-md">DOC</div>
          <span className="text-primary font-bold text-sm">Dink Over Coffee</span>
        </div>
        <p className="text-muted text-xs">Play. Connect. Belong.</p>
      </footer>

    </div>
  )
}
