import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import SessionForm from './SessionForm.jsx'
import PlayerList from './PlayerList.jsx'
import UpiAccounts from './UpiAccounts.jsx'

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
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showUpi, setShowUpi] = useState(false)

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

  function deleteSession(session) {
    setDeleteConfirm(session)
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    await supabase.from('players').delete().eq('session_id', deleteConfirm.id)
    await supabase.from('holds').delete().eq('session_id', deleteConfirm.id)
    await supabase.from('sessions').delete().eq('id', deleteConfirm.id)
    setDeleteConfirm(null)
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
    <div className="min-h-screen bg-[#F6F1E7] bg-[url('/bg-pattern.svg')] bg-[length:360px_360px] bg-repeat">
      <div className="max-w-xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-[#2B1F17] font-bold text-lg">Sessions</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowUpi(true)} title="Payment methods" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#2B1F17] active:bg-[#F6F1E7] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </button>
            <button onClick={handleNew} title="New session" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#4F6B4F] active:bg-[#F6F1E7] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button onClick={handleLogout} title="Logout" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#8C8A7D] active:bg-[#F6F1E7] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-4 overflow-x-auto">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full capitalize transition ${filter === f ? 'bg-[#2B1F17] text-white' : 'text-[#8C8A7D]'}`}
            >{f}</button>
          ))}
        </div>

        {loading && <p className="text-[#8C8A7D] text-sm text-center py-8">Loading…</p>}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm text-[#2B1F17] font-medium text-center">Delete <strong>{deleteConfirm.title || deleteConfirm.id}</strong>?<br/><span className="text-xs text-[#8C8A7D] font-normal">This cannot be undone.</span></p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-full border border-[#E6DCC6] text-sm font-medium text-[#8C8A7D] active:bg-[#F6F1E7] transition">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-full bg-[#C75A2B] text-white text-sm font-medium active:scale-[.98] transition">Delete</button>
              </div>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-[#8C8A7D] text-sm text-center py-8">No sessions.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-[#E6DCC6] divide-y divide-[#F6F1E7]">
            {filtered.map(s => (
              <div key={s.id} className="bg-white px-4 py-3">
                <div className={`flex items-center justify-between ${!s.active ? 'opacity-40' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#2B1F17] font-semibold text-sm truncate">{s.title || s.venue}</span>
                      {s.event_type === 'dupr' && <span className="text-[9px] font-bold uppercase tracking-wide text-[#C75A2B] bg-[#C75A2B]/10 px-1.5 py-0.5 rounded shrink-0">DUPR</span>}
                    </div>
                    <div className="text-[#8C8A7D] text-xs mt-0.5">{fmtDate(s.date)} · {s.time} · {s.venue} · ₹{s.price}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[11px] text-[#8C8A7D]">{s.max_slots}</span>
                    <span className={`w-2 h-2 rounded-full ${s.active ? 'bg-[#4F6B4F]' : 'bg-[#C8C2B8]'}`} />
                  </div>
                </div>
                <div className="flex justify-between mt-2.5">
                  <button onClick={() => setViewPlayers(s)} title="Players" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#2B1F17] active:bg-[#F6F1E7] transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </button>
                  <button onClick={() => handleEdit(s)} title="Edit" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#2B1F17] active:bg-[#F6F1E7] transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => duplicateSession(s)} title="Duplicate" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#2B1F17] active:bg-[#F6F1E7] transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <button onClick={() => exportCSV(s)} title="Export CSV" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#2B1F17] active:bg-[#F6F1E7] transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                  <button onClick={() => toggleActive(s)} title={s.active ? 'Deactivate' : 'Activate'} className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#8C8A7D] active:bg-[#F6F1E7] transition">
                    {s.active ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    )}
                  </button>
                  <button onClick={() => deleteSession(s)} title="Delete" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#C75A2B]/30 text-[#C75A2B] active:bg-red-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
