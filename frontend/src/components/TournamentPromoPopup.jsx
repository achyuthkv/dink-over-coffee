import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const REGISTRATION_URL = 'https://hudle.in/events/doc-open-20/545225'
const DISMISS_KEY = 'docOpen2Promo_dismissed'
const TOURNAMENT_DATE_LONG = 'Sunday, 25 October'
const TOURNAMENT_DATE_SHORT = 'Sun, 25 Oct'

const CATEGORIES = [
  { label: 'Singles < 3.6', first: 5000, second: 2500 },
  { label: 'Singles 3.6 – 4.2', first: 5000, second: 2500 },
  { label: 'Doubles < 3.6', first: 6000, second: 3000 },
  { label: 'Doubles 3.6 – 4.2', first: 6000, second: 3000 },
  { label: 'Open Mixed Doubles', first: 5000, second: 2500 },
  { label: 'Open Doubles', first: 6000, second: 3000 }
]

const SPONSORS = [
  { name: 'FerroHub Sports', role: 'Venue Partner' },
  { name: 'Attivi', role: 'Recovery Partner' },
  { name: 'Sake of Health', role: 'Wellness Partner' },
  { name: 'Press & Dress', role: 'Refreshment Partner' }
]

// The actual promo content -- shared by the auto-popup and the persistent
// banner's "View Details" trigger, so there's one place to update if the
// prize/category details change.
export function TournamentPromoModal({ onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <span className="badge-success">🏓 New Tournament</span>
            <h3 className="text-primary font-extrabold text-xl mt-2 leading-tight">The DoC Open 2.0</h3>
            <p className="text-secondary text-sm mt-0.5">A pickleball tournament for all</p>
            <p className="text-interactive text-2xs font-bold mt-1">📅 {TOURNAMENT_DATE_LONG}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-border text-muted active:bg-bg transition" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="rounded-2xl bg-interactive/10 border border-interactive/20 px-4 py-3 text-center mb-4">
          <p className="text-3xs font-bold uppercase tracking-wide text-interactive">Cash Prizes</p>
          <p className="text-primary font-extrabold text-2xl mt-0.5">Up to ₹50,000</p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {CATEGORIES.map(c => (
            <div key={c.label} className="card-compact px-3 py-2.5">
              <p className="text-2xs font-bold text-primary leading-tight">{c.label}</p>
              <div className="flex items-center justify-between mt-1.5 text-2xs">
                <span className="text-muted">1st</span>
                <span className="font-semibold text-primary">₹{c.first.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-2xs">
                <span className="text-muted">2nd</span>
                <span className="font-semibold text-secondary">₹{c.second.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-3xs text-muted mb-4">*Cash prizes applicable with a minimum of 12 team registrations in the respective category.</p>

        <a
          href={REGISTRATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="btn-primary w-full"
        >
          Register Now
        </a>

        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-3xs text-muted text-center mb-2">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            {SPONSORS.map(s => (
              <span key={s.name} className="text-3xs text-secondary">{s.name} <span className="text-muted">· {s.role}</span></span>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// A one-time promo for an externally-hosted tournament (registration runs on
// Hudle, not through this site's own tournament module) -- shown once per
// browser session so it doesn't nag a visitor browsing multiple pages.
export default function TournamentPromoPopup() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(DISMISS_KEY)) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }

  if (!open) return null
  return <TournamentPromoModal onClose={dismiss} />
}

// A persistent, always-visible entry point back into the same promo --
// dropped into pages so a visitor who dismissed the one-time popup (by
// accident or on purpose) can still find tournament details. Styled as a
// solid announcement strip rather than another card, so it reads as "live
// news" at a glance instead of blending into surrounding content.
export function TournamentPromoBanner({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`glow-interactive w-full flex items-center gap-3 rounded-2xl bg-interactive px-4 py-3 text-left active:scale-[.99] transition ease-spring ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-inverse shrink-0 animate-pulse" />
        <span className="flex-1 min-w-0">
          <span className="block text-inverse text-sm font-bold truncate">🏓 The DoC Open 2.0</span>
          <span className="block text-inverse/80 text-2xs font-medium truncate">{TOURNAMENT_DATE_SHORT} · Cash prizes up to ₹50,000</span>
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-inverse shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      {open && <TournamentPromoModal onClose={() => setOpen(false)} />}
    </>
  )
}
