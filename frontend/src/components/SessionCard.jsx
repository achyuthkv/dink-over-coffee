import { useState } from 'react'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return String(d)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}

function CancellationPolicy() {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div
        role="button"
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        className="flex items-center gap-1.5 text-muted text-[11px] font-medium hover:text-primary transition w-full cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={`transition-transform ${open ? 'rotate-90' : ''}`}><polyline points="9 18 15 12 9 6"/></svg>
        Cancellation Policy
      </div>
      {open && (
        <div className="mt-2 text-muted text-[11px] leading-relaxed space-y-1.5 pl-4">
          <p>Refund is subject to a replacement taking up your slot.</p>
          <p>Once a replacement is confirmed, the refund will be processed.</p>
          <p>If no replacement is found, the amount may not be refundable.</p>
          <p className="pt-1 text-interactive font-medium">Organizer cancellations (weather, venue, safety) are fully refunded within 24 hours.</p>
        </div>
      )}
    </div>
  )
}

export default function SessionCard({ session, onSelect, selected }) {
  const taken = Number(session.takenSlots || 0)
  const max = Number(session.maxSlots || 0)
  const remaining = Math.max(0, max - taken)
  const full = remaining <= 0
  const pct = max > 0 ? Math.min(100, Math.round((taken / max) * 100)) : 0

  const beginnerSlots = Number(session.beginnerSlots || 0)
  const beginnerTaken = Number(session.beginnerTaken || 0)
  const otherTaken = Number(session.otherTaken || 0)
  const hasSplit = beginnerSlots > 0

  const beginnerRemaining = hasSplit ? Math.max(0, beginnerSlots - beginnerTaken) : null
  const beginnerOverflow = hasSplit ? Math.max(0, beginnerTaken - beginnerSlots) : 0
  const otherSlots = hasSplit ? max - beginnerSlots : null
  const otherRemaining = hasSplit ? Math.max(0, otherSlots - beginnerOverflow - otherTaken) : null

  const waitlistMax = Number(session.waitlistMax || 0)
  const waitlistCount = Number(session.waitlistCount || 0)
  const beginnerWaitlistMax = Number(session.beginnerWaitlistMax || 0)
  const beginnerWaitlistCount = Number(session.beginnerWaitlistCount || 0)
  const otherWaitlistCount = Number(session.otherWaitlistCount || 0)

  const hasAnyWaitlist = waitlistMax > 0 || beginnerWaitlistMax > 0
  const someWaitlistOpen = (hasSplit
    ? (beginnerRemaining <= 0 && beginnerWaitlistMax > 0 && beginnerWaitlistCount < beginnerWaitlistMax) ||
      (otherRemaining <= 0 && waitlistMax > 0 && otherWaitlistCount < waitlistMax)
    : (full && waitlistMax > 0 && waitlistCount < waitlistMax)
  )

  const disabled = full && !someWaitlistOpen

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(session)}
      disabled={disabled}
      className={`card text-left w-full transition ${selected ? 'ring-2 ring-secondary' : ''} ${disabled ? 'opacity-60' : 'active:scale-[.99]'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-secondary-dark text-[11px] font-semibold uppercase tracking-wide">{fmtDate(session.date)} · {session.time}</span>
        {session.event_type === 'dupr' && <span className="text-[9px] font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded">DUPR</span>}
        {session.event_type === 'dupr_doubles' && <span className="text-[9px] font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded">DUPR Doubles</span>}
        {session.event_type === 'dupr_teams' && <span className="text-[9px] font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded">DUPR Teams</span>}
        {session.event_type === 'non_pickleball' && <span className="text-[9px] font-bold uppercase tracking-wide text-interactive bg-interactive/10 px-1.5 py-0.5 rounded">Event</span>}
      </div>
      {session.title && <div className="text-text font-bold text-base mt-1">{session.title}</div>}
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-primary text-sm">{session.venue}</div>
        <div className="text-text text-sm font-bold whitespace-nowrap">{Number(session.price) === 0 ? <span className="text-secondary">Free</span> : session.event_type === 'dupr_teams' ? <>₹{session.price} <span className="text-secondary font-normal text-xs">per team</span></> : <>₹{session.price} <span className="text-secondary font-normal text-xs">per person</span></>}</div>
      </div>
      {session.description && <p className="text-secondary text-xs mt-2 leading-relaxed">{session.description}</p>}

      {hasSplit ? (
        <div className="mt-4 space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={beginnerRemaining <= 0 ? 'text-interactive-pressed' : 'text-secondary'}>
                Beginner: {beginnerRemaining <= 0 ? 'Full' : `${beginnerRemaining} left`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full ${beginnerRemaining <= 0 ? 'bg-interactive-pressed' : 'bg-secondary'}`}
                style={{ width: `${beginnerSlots > 0 ? Math.min(100, Math.round((beginnerTaken / beginnerSlots) * 100)) : 0}%` }}
              />
            </div>
            {beginnerRemaining <= 0 && beginnerWaitlistMax > 0 && beginnerWaitlistCount < beginnerWaitlistMax && (
              <div className="mt-1 text-[11px] text-warning-muted font-medium">
                Waitlist: {beginnerWaitlistMax - beginnerWaitlistCount} spot{beginnerWaitlistMax - beginnerWaitlistCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={otherRemaining <= 0 ? 'text-interactive-pressed' : 'text-secondary'}>
                Intermediate+: {otherRemaining <= 0 ? 'Full' : `${otherRemaining} left`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full ${otherRemaining <= 0 ? 'bg-interactive-pressed' : 'bg-secondary'}`}
                style={{ width: `${(otherSlots - beginnerOverflow) > 0 ? Math.min(100, Math.round((otherTaken / (otherSlots - beginnerOverflow)) * 100)) : 100}%` }}
              />
            </div>
            {otherRemaining <= 0 && waitlistMax > 0 && otherWaitlistCount < waitlistMax && (
              <div className="mt-1 text-[11px] text-warning-muted font-medium">
                Waitlist: {waitlistMax - otherWaitlistCount} spot{waitlistMax - otherWaitlistCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={full ? 'text-interactive-pressed' : 'text-secondary'}>
              {full ? 'Full' : `${remaining} slot${remaining === 1 ? '' : 's'} left`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className={`h-full ${full ? 'bg-interactive-pressed' : 'bg-secondary'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {full && waitlistMax > 0 && waitlistCount < waitlistMax && (
            <div className="mt-2 text-xs text-warning-muted font-medium">
              Waitlist open — {waitlistMax - waitlistCount} spot{waitlistMax - waitlistCount === 1 ? '' : 's'} left
            </div>
          )}
          {full && waitlistMax > 0 && waitlistCount >= waitlistMax && (
            <div className="mt-2 text-xs text-error font-medium">Waitlist full</div>
          )}
        </div>
      )}

      <CancellationPolicy />
    </button>
  )
}
