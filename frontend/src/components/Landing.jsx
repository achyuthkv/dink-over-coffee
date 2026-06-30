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
      <nav className="px-6 md:px-12 max-w-5xl mx-auto w-full pt-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 bg-interactive text-inverse grid place-items-center font-bold text-[9px] rounded-xl">DOC</div>
          <span className="text-primary font-semibold text-sm">Dink Over Coffee</span>
        </div>
        <ThemeToggle />
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 max-w-5xl mx-auto w-full pt-12 pb-10 md:pt-16 md:pb-14">
        <h1 className="text-primary text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight">
          The game brings you here.
        </h1>
        <h1 className="text-secondary text-[clamp(2rem,6vw,3.5rem)] font-extrabold leading-[1.08] tracking-tight">
          The people make you stay.
        </h1>

        <p className="mt-4 text-muted text-sm md:text-base max-w-[38ch] leading-relaxed">
          Pickleball sessions every week in Bangalore. All levels. No partner needed. Just show up.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link to="/events" className="inline-flex items-center gap-2 rounded-full bg-interactive text-inverse px-5 py-3 text-sm font-semibold active:scale-[.98] transition shadow-lg shadow-interactive/10">
            Book a Session
          </Link>
          <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border-2 border-border text-primary px-5 py-3 text-sm font-medium active:scale-[.98] transition">
            Join WhatsApp
          </a>
        </div>
      </section>

      {/* Next session — inline if available */}
      {nextSession && (
        <section className="px-6 md:px-12 max-w-5xl mx-auto w-full pb-10">
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
        </section>
      )}

      {/* How it works */}
      <section className="px-6 md:px-12 max-w-5xl mx-auto w-full py-10 border-t border-border">
        <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-5">How it works</p>
        <div className="grid grid-cols-3 gap-3 md:gap-5">
          {[
            { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>, label: 'Sign up' },
            { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: 'Show up' },
            { icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, label: 'Stay for coffee' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="w-10 h-10 rounded-2xl bg-interactive/10 grid place-items-center mx-auto mb-2">{item.icon}</div>
              <p className="text-primary text-xs font-semibold">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="px-6 md:px-12 max-w-5xl mx-auto w-full py-10 border-t border-border">
        <div className="space-y-3">
          {[
            { title: 'No partner needed', desc: 'Come solo — we rotate partners every game.' },
            { title: 'All levels welcome', desc: 'Separate groups for beginners and experienced.' },
            { title: 'Every week', desc: 'Multiple sessions on weekdays and weekends.' },
          ].map(item => (
            <div key={item.title} className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0" />
              <p className="text-sm"><span className="text-primary font-semibold">{item.title}</span> <span className="text-muted">— {item.desc}</span></p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 md:px-12 max-w-5xl mx-auto w-full py-10 mt-auto border-t border-border text-center">
        <p className="text-primary font-bold text-lg">Your next favourite weekend starts here.</p>
        <p className="text-muted text-xs mt-1">Play. Connect. Belong.</p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <Link to="/events" className="inline-flex items-center rounded-full bg-interactive text-inverse px-5 py-2.5 text-sm font-semibold active:scale-[.98] transition">
            Book a Session
          </Link>
          <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-full border-2 border-border text-primary px-5 py-2.5 text-sm font-medium active:scale-[.98] transition">
            WhatsApp
          </a>
        </div>
      </section>

    </div>
  )
}
