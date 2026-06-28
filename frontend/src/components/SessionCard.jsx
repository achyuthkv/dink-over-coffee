function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return String(d)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
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
  const otherSlots = hasSplit ? max - beginnerSlots : null
  const otherRemaining = hasSplit ? Math.max(0, otherSlots - otherTaken) : null

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
      className={`card text-left w-full transition ${selected ? 'ring-2 ring-coffee-600' : ''} ${disabled ? 'opacity-60' : 'active:scale-[.99]'}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-court-600 text-[11px] font-semibold uppercase tracking-wide">{fmtDate(session.date)} · {session.time}</span>
        {session.event_type === 'dupr' && <span className="text-[9px] font-bold uppercase tracking-wide text-[#C75A2B] bg-[#C75A2B]/10 px-1.5 py-0.5 rounded">DUPR</span>}
      </div>
      {session.title && <div className="text-coffee-900 font-bold text-base mt-1">{session.title}</div>}
      <div className="flex items-baseline justify-between gap-3 mt-1">
        <div className="text-coffee-700 text-sm">{session.venue}</div>
        <div className="text-coffee-900 text-sm font-bold whitespace-nowrap">₹{session.price}</div>
      </div>
      {session.description && <p className="text-coffee-600 text-xs mt-2 leading-relaxed">{session.description}</p>}

      {hasSplit ? (
        <div className="mt-4 space-y-2">
          <div>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={beginnerRemaining <= 0 ? 'text-red-600' : 'text-court-600'}>
                Beginner: {beginnerRemaining <= 0 ? 'Full' : `${beginnerRemaining} left`}
              </span>
              <span className="text-coffee-600">{beginnerTaken}/{beginnerSlots}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-coffee-100 overflow-hidden">
              <div
                className={`h-full ${beginnerRemaining <= 0 ? 'bg-red-500' : 'bg-court-500'}`}
                style={{ width: `${beginnerSlots > 0 ? Math.min(100, Math.round((beginnerTaken / beginnerSlots) * 100)) : 0}%` }}
              />
            </div>
            {beginnerRemaining <= 0 && beginnerWaitlistMax > 0 && beginnerWaitlistCount < beginnerWaitlistMax && (
              <div className="mt-1 text-[11px] text-amber-700 font-medium">
                Waitlist: {beginnerWaitlistMax - beginnerWaitlistCount} spot{beginnerWaitlistMax - beginnerWaitlistCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={otherRemaining <= 0 ? 'text-red-600' : 'text-court-600'}>
                Intermediate+: {otherRemaining <= 0 ? 'Full' : `${otherRemaining} left`}
              </span>
              <span className="text-coffee-600">{otherTaken}/{otherSlots}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-coffee-100 overflow-hidden">
              <div
                className={`h-full ${otherRemaining <= 0 ? 'bg-red-500' : 'bg-court-500'}`}
                style={{ width: `${otherSlots > 0 ? Math.min(100, Math.round((otherTaken / otherSlots) * 100)) : 0}%` }}
              />
            </div>
            {otherRemaining <= 0 && waitlistMax > 0 && otherWaitlistCount < waitlistMax && (
              <div className="mt-1 text-[11px] text-amber-700 font-medium">
                Waitlist: {waitlistMax - otherWaitlistCount} spot{waitlistMax - otherWaitlistCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={full ? 'text-red-600' : 'text-court-600'}>
              {full ? 'Full' : `${remaining} slot${remaining === 1 ? '' : 's'} left`}
            </span>
            <span className="text-coffee-600">{taken}/{max}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-coffee-100 overflow-hidden">
            <div
              className={`h-full ${full ? 'bg-red-500' : 'bg-court-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {full && waitlistMax > 0 && waitlistCount < waitlistMax && (
            <div className="mt-2 text-xs text-amber-700 font-medium">
              Waitlist open — {waitlistMax - waitlistCount} spot{waitlistMax - waitlistCount === 1 ? '' : 's'} left
            </div>
          )}
          {full && waitlistMax > 0 && waitlistCount >= waitlistMax && (
            <div className="mt-2 text-xs text-red-600 font-medium">Waitlist full</div>
          )}
        </div>
      )}
    </button>
  )
}
