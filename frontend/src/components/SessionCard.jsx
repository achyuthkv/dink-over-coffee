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

  const waitlistMax = Number(session.waitlistMax || 0)
  const waitlistCount = Number(session.waitlistCount || 0)
  const waitlistAvailable = full && waitlistMax > 0 && waitlistCount < waitlistMax
  const waitlistFull = full && waitlistMax > 0 && waitlistCount >= waitlistMax
  const disabled = full && !waitlistAvailable

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect(session)}
      disabled={disabled}
      className={`card text-left w-full transition ${selected ? 'ring-2 ring-coffee-600' : ''} ${disabled ? 'opacity-60' : 'active:scale-[.99]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-coffee-600 text-xs font-semibold uppercase tracking-wide">{fmtDate(session.date)}</div>
          <div className="text-coffee-900 text-lg font-bold leading-tight">{session.time}</div>
          <div className="text-coffee-800 text-sm mt-0.5">{session.venue}</div>
        </div>
        <div className="text-right">
          <div className="text-coffee-900 text-xl font-extrabold">₹{session.price}</div>
          <div className="text-coffee-600 text-xs">per player</div>
        </div>
      </div>

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
        {waitlistAvailable && (
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Waitlist open — {waitlistMax - waitlistCount} spot{waitlistMax - waitlistCount === 1 ? '' : 's'} left
          </div>
        )}
        {waitlistFull && (
          <div className="mt-2 text-xs text-red-600 font-medium">
            Waitlist full
          </div>
        )}
      </div>
    </button>
  )
}
