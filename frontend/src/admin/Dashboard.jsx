import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../supabase.js'
import SessionForm from './SessionForm.jsx'
import PlayerList from './PlayerList.jsx'
import UpiAccounts from './UpiAccounts.jsx'
import Waivers from './Waivers.jsx'
import Metrics from './Metrics.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

function MiniCalendar({ sessions, selectedDate, onSelect }) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const sessionDates = useMemo(() => {
    const set = new Set()
    sessions.forEach(s => { if (s.date) set.add(s.date) })
    return set
  }, [sessions])

  const today = new Date().toISOString().slice(0, 10)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  function prev() { setViewDate(new Date(year, month - 1, 1)) }
  function next() { setViewDate(new Date(year, month + 1, 1)) }

  function dateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-full text-muted active:bg-bg transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-primary text-sm font-semibold">{monthNames[month]} {year}</span>
        <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-full text-muted active:bg-bg transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />
          const ds = dateStr(d)
          const hasSession = sessionDates.has(ds)
          const isToday = ds === today
          const isSelected = ds === selectedDate
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(isSelected ? null : ds)}
              className={`relative w-full aspect-square flex items-center justify-center rounded-lg text-xs transition
                ${isSelected ? 'bg-interactive text-inverse font-bold' : isToday ? 'font-bold text-interactive' : 'text-primary'}
                ${hasSession && !isSelected ? 'font-semibold' : ''}
                active:scale-90
              `}
            >
              {d}
              {hasSession && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-interactive" />
              )}
            </button>
          )
        })}
      </div>
      {selectedDate && (
        <button onClick={() => onSelect(null)} className="mt-2 text-[11px] text-interactive font-medium w-full text-center">
          Clear filter
        </button>
      )}
    </div>
  )
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return String(d)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [viewPlayers, setViewPlayers] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [calendarDate, setCalendarDate] = useState(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletePlayerCount, setDeletePlayerCount] = useState(0)
  const [showUpi, setShowUpi] = useState(false)
  const [showWaivers, setShowWaivers] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)

  async function loadSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .order('date', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { loadSessions() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const filtered = sessions.filter(s => {
    if (calendarDate) return s.date === calendarDate
    if (filter === 'upcoming') return s.date >= today
    if (filter === 'past') return s.date < today
    if (filter === 'active') return s.active
    if (filter === 'inactive') return !s.active
    return true
  })

  function handleEdit(session) {
    setEditing(session)
    setShowForm(true)
  }

  function handleNew() {
    setEditing(null)
    setShowForm(true)
  }

  function handleSaved() {
    setShowForm(false)
    setEditing(null)
    loadSessions()
  }

  async function toggleActive(session) {
    await supabase.from('sessions').update({ active: !session.active }).eq('id', session.id)
    loadSessions()
  }

  async function deleteSession(session) {
    const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('session_id', session.id)
    setDeletePlayerCount(count || 0)
    setDeleteConfirm(session)
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    await supabase.from('sessions').update({ active: false }).eq('id', deleteConfirm.id)
    await supabase.from('holds').delete().eq('session_id', deleteConfirm.id)
    setDeleteConfirm(null)
    setDeletePlayerCount(0)
    loadSessions()
  }

  function duplicateSession(session) {
    const nextWeek = new Date(session.date + 'T00:00:00')
    nextWeek.setDate(nextWeek.getDate() + 7)
    const newDate = nextWeek.toISOString().slice(0, 10)
    setEditing({
      ...session,
      id: undefined,
      date: newDate,
      active: true
    })
    setShowForm(true)
  }

  async function exportCSV(session) {
    const { data } = await supabase
      .from('players')
      .select('name, phone, skill, status, paid, created_at')
      .eq('session_id', session.id)
      .order('created_at')
    if (!data || data.length === 0) { alert('No players to export'); return }
    const header = 'Name,Phone,Skill,Status,Paid,Registered At'
    const rows = data.map(p => `"${p.name}","${p.phone}","${p.skill}","${p.status}","${p.paid ? 'Yes' : 'No'}","${p.created_at}"`)
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${session.title || session.id}_players.csv`
    a.click()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (showMetrics) {
    return <Metrics onBack={() => setShowMetrics(false)} />
  }

  if (showWaivers) {
    return <Waivers onBack={() => setShowWaivers(false)} />
  }

  if (showUpi) {
    return <UpiAccounts onBack={() => setShowUpi(false)} />
  }

  if (viewPlayers) {
    return <PlayerList session={viewPlayers} onBack={() => setViewPlayers(null)} />
  }

  if (showForm) {
    return <SessionForm session={editing} onSave={handleSaved} onCancel={() => { setShowForm(false); setEditing(null) }} />
  }

  const filters = ['upcoming', 'past', 'active', 'inactive', 'all']

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-primary font-bold text-lg">Sessions</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setShowMetrics(true)} title="Metrics" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </button>
            <button onClick={() => setShowWaivers(true)} title="Waivers" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </button>
            <button onClick={() => setShowUpi(true)} title="Payment methods" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </button>
            <button onClick={handleNew} title="New session" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-secondary active:bg-bg transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button onClick={handleLogout} title="Logout" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-muted active:bg-bg transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>

        <div className="md:flex md:gap-6 md:items-start">
          {/* Desktop: sticky sidebar calendar */}
          <div className="hidden md:block md:w-72 md:shrink-0 md:sticky md:top-8">
            <MiniCalendar sessions={sessions} selectedDate={calendarDate} onSelect={(d) => { setCalendarDate(d); if (d) setFilter('all') }} />
          </div>

          {/* Mobile: collapsible calendar */}
          <div className="md:hidden">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setCalendarOpen(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-interactive active:opacity-70 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {calendarOpen ? 'Hide calendar' : 'Show calendar'}
              </button>
              {calendarDate && (
                <button
                  onClick={() => { setCalendarDate(null); setFilter('upcoming') }}
                  className="flex items-center gap-1 text-[11px] bg-interactive/10 text-interactive px-2.5 py-1 rounded-full font-medium active:opacity-70 transition"
                >
                  {calendarDate}
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
            {calendarOpen && (
              <MiniCalendar sessions={sessions} selectedDate={calendarDate} onSelect={(d) => { setCalendarDate(d); if (d) setFilter('all') }} />
            )}
          </div>

          {/* Session list */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-1 mb-4 overflow-x-auto">
              {filters.map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setCalendarDate(null) }}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize transition ${filter === f && !calendarDate ? 'bg-interactive text-inverse' : 'text-muted'}`}
                >{f}</button>
              ))}
            </div>

        {loading && <p className="text-muted text-sm text-center py-8">Loading…</p>}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-surface rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm text-primary font-medium text-center">
                Remove <strong>{deleteConfirm.title || deleteConfirm.id}</strong>?
              </p>
              {deletePlayerCount > 0 && (
                <p className="text-xs text-warning-muted text-center font-medium">
                  This session has {deletePlayerCount} registered player{deletePlayerCount === 1 ? '' : 's'}.
                </p>
              )}
              <p className="text-xs text-muted text-center">Session will be deactivated. Player data is preserved.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium text-muted active:bg-bg transition">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-full bg-tertiary text-white text-sm font-medium active:scale-[.98] transition">Deactivate</button>
              </div>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-muted text-sm text-center py-8">No sessions.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-border divide-y divide-bg">
            {filtered.map(s => (
              <div key={s.id} className="bg-surface px-4 py-3">
                <div className={`flex items-center justify-between ${!s.active ? 'opacity-40' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-semibold text-sm truncate">{s.title || s.venue}</span>
                      {s.event_type === 'dupr' && <span className="text-[9px] font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded shrink-0">DUPR</span>}
                      {s.event_type === 'dupr_doubles' && <span className="text-[9px] font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded shrink-0">DUPR Doubles</span>}
                    </div>
                    <div className="text-muted text-xs mt-0.5">{fmtDate(s.date)} · {s.time} · {s.venue} · ₹{s.price}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[11px] text-muted">{s.max_slots}</span>
                    <span className={`w-2 h-2 rounded-full ${s.active ? 'bg-secondary' : 'bg-border-muted'}`} />
                  </div>
                </div>
                <div className="flex justify-between mt-2.5">
                  <button onClick={() => setViewPlayers(s)} title="Players" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </button>
                  <button onClick={() => handleEdit(s)} title="Edit" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => duplicateSession(s)} title="Duplicate" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <button onClick={() => exportCSV(s)} title="Export CSV" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-primary active:bg-bg transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/recap/${s.id}`); alert('Recap link copied!') }} title="Copy recap link" className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-interactive active:bg-bg transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  </button>
                  <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'} className="w-10 h-10 flex items-center justify-center rounded-full border border-border text-muted active:bg-bg transition">
                    {s.active ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </button>
                  <button onClick={() => deleteSession(s)} title="Delete" className="w-10 h-10 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  )
}
