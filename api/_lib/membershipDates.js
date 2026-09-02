// Pure date helpers for the membership feature, split out from api/membership.js
// so they can be unit tested without mocking Supabase (same reasoning as
// api/_lib/tournamentSync.js).

export function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// These operate on plain YYYY-MM-DD calendar dates, not instants -- anchoring
// to UTC midnight (rather than IST midnight) keeps the arithmetic pure
// calendar math with no timezone-conversion day-shift risk. Only todayIST()
// above needs to reason about the actual current instant.

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Mon/Wed are the only weekdays this feature reserves slots for -- a session
// flagged is_member_slot on any other weekday still resolves to one of these
// two ledger reasons rather than failing, since the membership_credits check
// constraint only knows about these two reasons.
export function weekdayReason(dateStr) {
  const day = new Date(dateStr + 'T00:00:00Z').getUTCDay();
  return day === 3 ? 'declined_wednesday' : 'declined_monday';
}
