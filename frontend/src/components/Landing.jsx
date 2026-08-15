import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../api.js'
import ThemeToggle from './ThemeToggle.jsx'
import Logo from './Logo.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import NavTabs from './NavTabs.jsx'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]}`
}

export default function Landing() {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    api.listSessions().then(({ sessions }) => {
      if (sessions?.length) setSessions(sessions)
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-bg flex flex-col overflow-x-hidden">

      {/* Hero with aurora orbs */}
      <div className="aurora relative">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <div className="mesh-blob mesh-blob-3" />

        {/* Nav */}
        <nav className="relative z-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-12 w-auto" />
          </Link>
          <div className="flex items-center gap-2.5">
            <NavTabs />
            <a href="https://www.instagram.com/dinkovercoffee" target="_blank" rel="noopener noreferrer" className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full border border-border/40 text-muted hover:text-primary hover:border-border transition" title="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <ThemeToggle />
          </div>
        </nav>

        {/* Hero content */}
        <section className="relative z-10 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-20 pb-20 md:pt-28 md:pb-24 lg:pt-32 lg:pb-28 flex flex-col lg:flex-row lg:items-center lg:gap-20">
          <div className="flex-1">
            <p className="text-interactive text-xs font-semibold uppercase tracking-[0.2em] mb-4">Find your court. Build your crew.</p>
            <h1 className="text-primary text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">
              The game brings you here.
            </h1>
            <h1 className="text-secondary text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.02] tracking-tight">
              The people make you stay.
            </h1>

            <p className="mt-6 text-muted text-base md:text-lg leading-relaxed max-w-lg">
              Bangalore's pickleball community. Sessions every week in Jayanagar. All levels. No partner needed. Just show up.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link to="/events" className="glow-interactive inline-flex items-center justify-center gap-2 rounded-full bg-interactive text-inverse px-8 py-4 text-sm font-semibold active:scale-[.98] transition w-full sm:w-auto">
                Book a Session
              </Link>
              <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="glass inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-medium text-primary active:scale-[.98] transition hover:bg-surface/80 w-full sm:w-auto">
                Join Community
              </a>
              <Link to="/shop" className="glass inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-medium text-primary active:scale-[.98] transition hover:bg-surface/80 w-full sm:w-auto">
                Shop Merch
              </Link>
            </div>
          </div>

          {/* Right column — sessions + how it works */}
          <div className="mt-14 lg:mt-0 lg:w-[400px] shrink-0 space-y-4">
            {sessions.length > 0 && (
              <div>
                <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-3 font-medium">Upcoming sessions</p>
                <div className="space-y-2.5">
                  {sessions.slice(0, 5).map(s => {
                    const remaining = Math.max(0, s.maxSlots - s.takenSlots)
                    const full = remaining <= 0
                    return (
                      <Link key={s.id} to={`/events?session=${s.id}`} className="glass flex items-center gap-3.5 rounded-2xl p-4 active:scale-[.99] transition hover:border-interactive/30">
                        <div className="w-11 h-11 rounded-xl bg-interactive/10 grid place-items-center shrink-0">
                          <div className="text-center leading-none">
                            <p className="text-interactive text-[9px] font-bold uppercase">{new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</p>
                            <p className="text-interactive text-sm font-bold">{new Date(s.date + 'T00:00:00').getDate()}</p>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-primary text-sm font-semibold truncate">{s.title || s.venue}</p>
                          <p className="text-muted text-xs truncate">{s.time} · {s.venue}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-semibold ${full ? 'text-error' : 'text-interactive'}`}>
                            {full ? 'Full' : `${remaining} left`}
                          </p>
                          <p className="text-muted text-[10px]">{'₹'}{s.price}</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
                {sessions.length > 5 && (
                  <Link to="/events" className="block text-center text-interactive text-xs font-medium mt-3 hover:underline">
                    +{sessions.length - 5} more sessions →
                  </Link>
                )}
              </div>
            )}

            <div className="glass rounded-2xl p-6">
              <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-5 font-medium">How it works</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>, label: 'Sign up' },
                  { icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, label: 'Show up' },
                  { icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, label: 'Stay for coffee' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="w-10 h-10 rounded-xl bg-interactive/10 grid place-items-center mx-auto mb-2">{item.icon}</div>
                    <p className="text-primary text-xs font-semibold">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Value props */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-16 md:py-20">
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {[
            { title: 'No partner needed', desc: 'Show up solo — we mix the groups and rotate partners every game. You\'ll play with everyone by the end of the session.' },
            { title: 'All levels welcome', desc: 'Beginners get their own court with coaching tips. Intermediate and advanced players get competitive rallies. Everyone improves at their own pace.' },
            { title: 'Every week', desc: 'Four to five sessions across weekdays and weekends. Morning and evening slots. Pick what fits your schedule and make it a habit.' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3.5">
              <span className="w-2 h-2 rounded-full bg-interactive shrink-0 mt-2" />
              <div>
                <p className="text-primary text-base font-bold">{item.title}</p>
                <p className="text-muted text-sm mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity streak */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-14 border-t border-border/30">
        <ActivityHeatmap />
      </section>

      {/* The vibe */}
      <section className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-20 border-t border-border/30">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-5 font-medium">The vibe</p>
          <p className="text-primary text-[clamp(1.4rem,3.5vw,2rem)] font-bold leading-snug">
            Strangers become doubles partners.
          </p>
          <p className="text-secondary text-[clamp(1.4rem,3.5vw,2rem)] font-bold leading-snug mt-1">
            Doubles partners become friends.
          </p>
          <p className="mt-6 text-muted text-sm md:text-base leading-relaxed max-w-md mx-auto">
            The best sessions aren&apos;t about winning. They&apos;re about the conversations between games, the inside jokes, and the &ldquo;same time next week?&rdquo;
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-20 border-t border-border/30 text-center">
        <h2 className="text-primary text-xl md:text-2xl font-extrabold">Your next favourite weekend starts here.</h2>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link to="/events" className="glow-interactive inline-flex items-center rounded-full bg-interactive text-inverse px-8 py-4 text-sm font-semibold active:scale-[.98] transition">
            Book a Session
          </Link>
          <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="glass inline-flex items-center rounded-full px-8 py-4 text-sm font-medium text-primary active:scale-[.98] transition hover:border-interactive/30">
            Join Community
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-8 mt-auto border-t border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo className="h-9 w-auto" />
          </div>
          <p className="text-muted text-xs hidden sm:block">Play. Connect. Belong.</p>
          <div className="flex items-center gap-2">
            <a href="https://www.instagram.com/dinkovercoffee" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-full border border-border/40 text-muted hover:text-primary transition" title="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="w-8 h-8 flex items-center justify-center rounded-full border border-border/40 text-muted hover:text-primary transition" title="WhatsApp Community">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-4 text-muted text-[11px]">
          <Link to="/terms" className="hover:text-primary transition">Guidelines</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-primary transition">Privacy</Link>
          <span>·</span>
          <a href="mailto:connect@dinkovercoffee.com" className="hover:text-primary transition">connect@dinkovercoffee.com</a>
        </div>
      </footer>

    </div>
  )
}
