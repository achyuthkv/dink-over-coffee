import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../supabase.js'
import SessionForm from './SessionForm.jsx'
import PlayerList from './PlayerList.jsx'
import UpiAccounts from './UpiAccounts.jsx'
import Waivers from './Waivers.jsx'
import Finances from './Finances.jsx'
import Venues from './Venues.jsx'
import ShopOrders from './ShopOrders.jsx'
import Security from './Security.jsx'
import Tournaments from './Tournaments.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

function DateStrip({ selectedDate, onSelect, sessionDates }) {
  const scrollRef = useRef(null)
  const selectedRef = useRef(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00')
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const days = useMemo(() => {
    const { year, month } = viewMonth
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const result = []
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(year, month, d))
    }
    return result
  }, [viewMonth])

  const didMount = useRef(false)
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      requestAnimationFrame(() => {
        if (selectedRef.current && scrollRef.current) {
          const container = scrollRef.current
          const el = selectedRef.current
          container.scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
        }
      })
    }
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => {
      if (selectedRef.current && scrollRef.current) {
        const container = scrollRef.current
        const el = selectedRef.current
        container.scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
      }
    })
  }, [viewMonth])

  function prevMonth() {
    setViewMonth(v => {
      const m = v.month === 0 ? 11 : v.month - 1
      const y = v.month === 0 ? v.year - 1 : v.year
      const lastDay = new Date(y, m + 1, 0).getDate()
      onSelect(`${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
      return { year: y, month: m }
    })
  }

  function nextMonth() {
    setViewMonth(v => {
      const m = v.month === 11 ? 0 : v.month + 1
      const y = v.month === 11 ? v.year + 1 : v.year
      onSelect(`${y}-${String(m + 1).padStart(2, '0')}-01`)
      return { year: y, month: m }
    })
  }

  function goToToday() {
    const n = new Date()
    const todayStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
    setViewMonth({ year: n.getFullYear(), month: n.getMonth() })
    onSelect(todayStr)
  }

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isCurrentMonth = viewMonth.year === new Date().getFullYear() && viewMonth.month === new Date().getMonth()

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-primary font-bold text-lg">Schedule</h1>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button onClick={goToToday} className="text-2xs text-interactive font-medium px-2 py-1 rounded-full active:opacity-70 transition mr-1">
              Today
            </button>
          )}
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-full text-muted active:bg-bg transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-primary text-sm font-semibold min-w-[120px] text-center">{monthNames[viewMonth.month]} {viewMonth.year}</span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-full text-muted active:bg-bg transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
        {days.map(d => {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          const isSelected = ds === selectedDate
          const isToday = ds === today
          const hasSession = sessionDates.has(ds)
          return (
            <button
              key={ds}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(ds)}
              className={`flex flex-col items-center shrink-0 w-[52px] py-2 rounded-xl transition ease-spring
                ${isSelected ? 'bg-interactive text-inverse' : 'text-primary'}
                ${!isSelected && isToday ? 'border-2 border-interactive' : !isSelected ? 'border border-border' : ''}
                active:scale-[.98]
              `}
            >
              <span className={`text-3xs font-semibold tracking-wide ${isSelected ? 'text-inverse/70' : 'text-muted'}`}>
                {dayNames[d.getDay()]}
              </span>
              <span className={`text-lg font-bold mt-0.5`}>
                {d.getDate()}
              </span>
              {hasSession && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-interactive mt-0.5" />
              )}
              {hasSession && isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-inverse/60 mt-0.5" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ManageMenu({ open, onClose, items, onLogout }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="dropdown-in absolute right-0 top-11 z-50 w-64 card-compact shadow-lg overflow-hidden">
        <div className="py-1.5">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-primary active:bg-bg transition"
            >
              <span className="w-7 h-7 rounded-full bg-interactive/10 text-interactive flex items-center justify-center shrink-0">{item.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{item.label}</span>
                {item.hint && <span className="block text-2xs text-muted truncate">{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t border-border py-1.5">
          <button
            onClick={() => { onLogout(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-muted active:bg-bg transition"
          >
            <span className="w-7 h-7 rounded-full bg-bg flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span className="font-medium">Log out</span>
          </button>
        </div>
      </div>
    </>
  )
}

function SessionCard({ session, playerCount, paidCount, onViewPlayers, onEdit, onDuplicate, onToggleActive, onDelete, onExport }) {
  const [expanded, setExpanded] = useState(false)
  const total = Number(session.max_slots || 0)

  return (
    <div className="card-compact overflow-hidden">
      <button
        type="button"
        onClick={() => onViewPlayers(session)}
        className="w-full text-left px-5 py-4"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="text-interactive font-bold text-base">{session.time}</div>
            <div className="text-primary font-semibold text-sm mt-0.5 truncate">{session.title || session.venue}</div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-primary font-bold text-base">{playerCount}<span className="text-muted font-normal">/{total}</span></div>
            <div className="text-3xs text-muted uppercase tracking-wide">Players</div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {session.venue && (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-primary bg-bg border border-border px-2.5 py-1 rounded-full">
              {session.venue}
            </span>
          )}
          {session.event_type === 'dupr' && (
            <span className="text-3xs font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-2 py-1 rounded-full">DUPR</span>
          )}
          {session.event_type === 'dupr_doubles' && (
            <span className="text-3xs font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-2 py-1 rounded-full">DUPR Doubles</span>
          )}
          {session.event_type === 'dupr_teams' && (
            <span className="text-3xs font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 px-2 py-1 rounded-full">DUPR Teams</span>
          )}
          {session.event_type === 'non_pickleball' && (
            <span className="text-3xs font-bold uppercase tracking-wide text-interactive bg-interactive/10 px-2 py-1 rounded-full">Event</span>
          )}
          {paidCount != null && (
            <span className={paidCount === playerCount ? 'badge-success' : 'badge-warning'}>
              {paidCount}/{playerCount} paid
            </span>
          )}
        </div>
      </button>

      <div className="border-t border-border px-5 py-3 flex items-center justify-between">
        <span className={`text-2xs font-medium ${session.active ? 'text-success' : 'text-muted'}`}>
          {session.active ? 'Active' : 'Inactive'}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-2xs text-muted font-medium flex items-center gap-1 active:opacity-70 transition"
        >
          Actions
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border px-5 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-3xs text-muted font-mono select-all">{session.id}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(session.id); }}
              className="text-3xs text-interactive font-medium active:opacity-70"
            >
              Copy ID
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onEdit(session)} className="text-xs font-medium text-primary px-3 py-1.5 rounded-full border border-border active:bg-bg transition">Edit</button>
            <button onClick={() => onDuplicate(session)} className="text-xs font-medium text-primary px-3 py-1.5 rounded-full border border-border active:bg-bg transition">Duplicate</button>
            <button onClick={() => onExport(session)} className="text-xs font-medium text-primary px-3 py-1.5 rounded-full border border-border active:bg-bg transition">Export CSV</button>
            <button onClick={() => onToggleActive(session)} className="text-xs font-medium text-primary px-3 py-1.5 rounded-full border border-border active:bg-bg transition">
              {session.active ? 'Deactivate' : 'Activate'}
            </button>
            <button onClick={() => onDelete(session)} className="text-xs font-medium text-error px-3 py-1.5 rounded-full border border-error/30 active:bg-error-subtle transition">Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [playerCounts, setPlayerCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [viewPlayers, setViewPlayers] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deletePlayerCount, setDeletePlayerCount] = useState(0)
  const [showUpi, setShowUpi] = useState(false)
  const [showWaivers, setShowWaivers] = useState(false)
  const [showFinances, setShowFinances] = useState(false)
  const [showVenues, setShowVenues] = useState(false)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [showShopOrders, setShowShopOrders] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)
  const [showTournaments, setShowTournaments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  async function loadSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .order('date', { ascending: false })
    setSessions(data || [])

    if (data && data.length > 0) {
      const { data: players } = await supabase
        .from('players')
        .select('session_id, status, paid')
        .eq('status', 'confirmed')
      const counts = {}
      ;(players || []).forEach(p => {
        if (!counts[p.session_id]) counts[p.session_id] = { total: 0, paid: 0 }
        counts[p.session_id].total++
        if (p.paid) counts[p.session_id].paid++
      })
      setPlayerCounts(counts)
    }
    setLoading(false)
  }

  useEffect(() => { loadSessions() }, [])

  const sessionDates = useMemo(() => {
    const set = new Set()
    sessions.forEach(s => { if (s.date) set.add(s.date) })
    return set
  }, [sessions])

  const daySessions = useMemo(() => {
    return sessions.filter(s => s.date === selectedDate)
  }, [sessions, selectedDate])

  const activeDaySessions = daySessions.filter(s => s.active)
  const inactiveDaySessions = daySessions.filter(s => !s.active)

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
    const currentlyActive = session.active === true
    await supabase.from('sessions').update({ active: !currentlyActive }).eq('id', session.id)
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
    const newDate = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`
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

  if (showFinances) {
    return <Finances onBack={() => setShowFinances(false)} />
  }

  if (showWaivers) {
    return <Waivers onBack={() => setShowWaivers(false)} />
  }

  if (showVenues) {
    return <Venues onBack={() => setShowVenues(false)} />
  }

  if (showUpi) {
    return <UpiAccounts onBack={() => setShowUpi(false)} />
  }

  if (showShopOrders) {
    return <ShopOrders onBack={() => setShowShopOrders(false)} />
  }

  if (showSecurity) {
    return <Security onBack={() => setShowSecurity(false)} />
  }

  if (showTournaments) {
    return <Tournaments onBack={() => setShowTournaments(false)} />
  }

  if (viewPlayers) {
    return <PlayerList session={viewPlayers} onBack={() => setViewPlayers(null)} />
  }

  if (showForm) {
    return <SessionForm session={editing} onSave={handleSaved} onCancel={() => { setShowForm(false); setEditing(null) }} />
  }

  if (showAllSessions) {
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
    return (
      <div className="min-h-screen bg-pattern">
        <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setShowAllSessions(false)} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h1 className="text-primary font-bold text-lg">All Sessions</h1>
          </div>
          <div className="space-y-2">
            {sorted.map(s => {
              const counts = playerCounts[s.id] || { total: 0, paid: 0 }
              return (
                <SessionCard
                  key={s.id}
                  session={s}
                  playerCount={counts.total}
                  paidCount={counts.paid}
                  onViewPlayers={setViewPlayers}
                  onEdit={handleEdit}
                  onDuplicate={duplicateSession}
                  onToggleActive={toggleActive}
                  onDelete={deleteSession}
                  onExport={exportCSV}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2 mb-4 relative">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Manage"
            aria-expanded={menuOpen}
            className={`w-9 h-9 flex items-center justify-center rounded-full border transition ${menuOpen ? 'border-interactive text-interactive bg-interactive/5' : 'border-border text-primary active:bg-bg'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <ManageMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onLogout={handleLogout}
            items={[
              {
                label: 'Shop Orders', hint: 'View, ship, and manage orders', onClick: () => setShowShopOrders(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              },
              {
                label: 'Tournaments', hint: 'Courts, fixtures, scoring, standings', onClick: () => setShowTournaments(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>
              },
              {
                label: 'All Sessions', hint: 'Every session, past and upcoming', onClick: () => setShowAllSessions(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              },
              {
                label: 'Finances', hint: 'Revenue and expenses', onClick: () => setShowFinances(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              },
              {
                label: 'Payment Methods', hint: 'UPI accounts for checkout', onClick: () => setShowUpi(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              },
              {
                label: 'Waivers', hint: 'Signed liability waivers', onClick: () => setShowWaivers(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              },
              {
                label: 'Venues', hint: 'Court locations', onClick: () => setShowVenues(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              },
              {
                label: 'Security', hint: 'Auto-lock and biometric unlock', onClick: () => setShowSecurity(true),
                icon: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              }
            ]}
          />
        </div>

        {/* Date strip */}
        <DateStrip selectedDate={selectedDate} onSelect={setSelectedDate} sessionDates={sessionDates} />

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && (
          <>
            {/* Active sessions header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xs font-semibold text-muted uppercase tracking-wider">Active Sessions</span>
              {activeDaySessions.length > 0 && (
                <span className="text-2xs font-medium text-interactive">{activeDaySessions.length} Active Today</span>
              )}
            </div>

            {/* Session cards */}
            {daySessions.length === 0 && (
              <div className="card-compact px-5 py-10 text-center">
                <p className="text-muted text-sm mb-3">No sessions on this day</p>
                <button onClick={handleNew} className="text-sm font-semibold text-interactive active:opacity-70 transition">
                  + Create session
                </button>
              </div>
            )}

            <div className="space-y-3">
              {activeDaySessions.map(s => {
                const counts = playerCounts[s.id] || { total: 0, paid: 0 }
                return (
                  <SessionCard
                    key={s.id}
                    session={s}
                    playerCount={counts.total}
                    paidCount={counts.paid}
                    onViewPlayers={setViewPlayers}
                    onEdit={handleEdit}
                    onDuplicate={duplicateSession}
                    onToggleActive={toggleActive}
                    onDelete={deleteSession}
                    onExport={exportCSV}
                  />
                )
              })}
            </div>

            {inactiveDaySessions.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-6 mb-3">
                  <span className="text-2xs font-semibold text-muted uppercase tracking-wider">Inactive</span>
                  <span className="text-2xs text-muted">{inactiveDaySessions.length}</span>
                </div>
                <div className="space-y-3 opacity-60">
                  {inactiveDaySessions.map(s => {
                    const counts = playerCounts[s.id] || { total: 0, paid: 0 }
                    return (
                      <SessionCard
                        key={s.id}
                        session={s}
                        playerCount={counts.total}
                        paidCount={counts.paid}
                        onViewPlayers={setViewPlayers}
                        onEdit={handleEdit}
                        onDuplicate={duplicateSession}
                        onToggleActive={toggleActive}
                        onDelete={deleteSession}
                        onExport={exportCSV}
                      />
                    )
                  })}
                </div>
              </>
            )}

            {/* New session FAB */}
            {daySessions.length > 0 && (
              <div className="fixed bottom-6 right-6">
                <button
                  onClick={handleNew}
                  className="w-14 h-14 rounded-full bg-interactive text-inverse shadow-lg flex items-center justify-center active:scale-[.98] transition ease-spring"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            )}
          </>
        )}

        {/* Delete confirmation modal */}
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
                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-full bg-error text-inverse text-sm font-medium active:scale-[.98] transition ease-spring">Deactivate</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
