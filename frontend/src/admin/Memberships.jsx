import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const STATUS_FILTERS = ['all', 'active', 'pending_payment', 'expired', 'cancelled']
const STATUS_LABEL = { all: 'All', active: 'Active', pending_payment: 'Pending', expired: 'Expired', cancelled: 'Cancelled' }
const STATUS_COLOR = {
  active: 'bg-success/10 text-success',
  pending_payment: 'bg-warning/10 text-warning-muted',
  expired: 'bg-bg text-muted',
  cancelled: 'bg-error/10 text-error'
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Memberships({ onBack }) {
  const [members, setMembers] = useState([])
  const [credits, setCredits] = useState({})
  const [capacity, setCapacity] = useState(0)
  const [capacityInput, setCapacityInput] = useState('0')
  const [waitlist, setWaitlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastStatus, setBroadcastStatus] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: memberRows }, { data: creditRows }, { data: settings }, { data: waitlistRows }] = await Promise.all([
      supabase.from('members').select('*').order('created_at', { ascending: false }),
      supabase.from('membership_credits').select('member_id, delta'),
      supabase.from('membership_settings').select('capacity').eq('id', true).single(),
      supabase.from('membership_waitlist').select('*').eq('converted', false).order('created_at')
    ])
    setMembers(memberRows || [])
    const balances = {}
    for (const c of creditRows || []) balances[c.member_id] = (balances[c.member_id] || 0) + c.delta
    setCredits(balances)
    setCapacity(settings?.capacity ?? 0)
    setCapacityInput(String(settings?.capacity ?? 0))
    setWaitlist(waitlistRows || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const activeCount = members.filter(m => m.status === 'active').length

  async function saveCapacity() {
    const value = Number(capacityInput)
    if (!Number.isFinite(value) || value < 0) return
    setSavingId('capacity')
    await supabase.from('membership_settings').update({ capacity: value }).eq('id', true)
    await load()
    setSavingId(null)
  }

  async function convertToMember(entry) {
    setSavingId(entry.id)
    const { error } = await supabase.from('members').insert({
      phone: entry.phone,
      name: entry.name,
      email: entry.email,
      plan: 'monthly',
      status: 'pending_payment'
    })
    if (!error) {
      await supabase.from('membership_waitlist').update({ converted: true }).eq('id', entry.id)
    }
    await load()
    setSavingId(null)
  }

  const filtered = members.filter(m => {
    if (filter !== 'all' && m.status !== filter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.phone.includes(q)
  })

  async function updateMember(id, patch) {
    setSavingId(id)
    await supabase.from('members').update(patch).eq('id', id)
    await load()
    setSavingId(null)
  }

  async function adjustCredit(memberId, delta) {
    setSavingId(memberId)
    await supabase.from('membership_credits').insert({ member_id: memberId, delta, reason: 'admin_adjustment' })
    await load()
    setSavingId(null)
  }

  async function sendBroadcast() {
    if (!broadcastMsg.trim()) return
    setBroadcastStatus('sending')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'broadcast', message: broadcastMsg.trim() })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Broadcast failed')
      setBroadcastStatus(`Sent to ${data.sent} member${data.sent === 1 ? '' : 's'}`)
      setBroadcastMsg('')
    } catch (e) {
      setBroadcastStatus(e.message)
    }
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-2xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Memberships</h1>
          <span className="text-muted text-xs ml-auto">{members.length} total</span>
        </div>

        <div className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <h2 className="text-xs font-semibold text-primary mb-2">Capacity</h2>
          <p className="text-2xs text-muted mb-3">
            {activeCount} active of <strong className="text-primary">{capacity}</strong> slots.
            {activeCount >= capacity ? ' Signup is showing the "notify me" form to new visitors.' : ' Signup is open to new members.'}
          </p>
          <div className="flex items-center gap-2">
            <input type="number" min="0" className="input text-sm py-1.5 w-24" value={capacityInput} onChange={e => setCapacityInput(e.target.value)} />
            <button onClick={saveCapacity} disabled={savingId === 'capacity' || Number(capacityInput) === capacity} className="text-xs font-semibold text-interactive disabled:opacity-40">
              {savingId === 'capacity' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {waitlist.length > 0 && (
          <div className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <h2 className="text-xs font-semibold text-primary mb-2">Waitlist &middot; {waitlist.length}</h2>
            <ul className="space-y-2">
              {waitlist.map(w => (
                <li key={w.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="text-primary truncate">{w.name}</p>
                    <p className="text-2xs text-muted">{w.phone}{w.email ? ` · ${w.email}` : ''}</p>
                  </div>
                  <button onClick={() => convertToMember(w)} disabled={savingId === w.id} className="shrink-0 text-xs font-semibold text-interactive disabled:opacity-40">
                    {savingId === w.id ? 'Converting…' : 'Convert to member'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-surface rounded-2xl p-4 mb-4 border border-border">
          <h2 className="text-xs font-semibold text-primary mb-2">Broadcast to active members</h2>
          <textarea
            className="input w-full text-sm"
            rows={2}
            placeholder="Message to send to every opted-in active member on WhatsApp..."
            value={broadcastMsg}
            onChange={e => setBroadcastMsg(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <button onClick={sendBroadcast} disabled={broadcastStatus === 'sending'} className="text-xs font-semibold text-interactive disabled:opacity-50">
              {broadcastStatus === 'sending' ? 'Sending…' : 'Send'}
            </button>
            {broadcastStatus && broadcastStatus !== 'sending' && <span className="text-2xs text-muted">{broadcastStatus}</span>}
          </div>
        </div>

        <input className="input w-full mb-3" placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />

        <div className="flex gap-1.5 mb-4 overflow-x-auto">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === f ? 'bg-interactive text-inverse border-interactive' : 'border-border text-secondary'}`}>
              {STATUS_LABEL[f]}
            </button>
          ))}
        </div>

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}
        {!loading && filtered.length === 0 && <p className="text-muted text-sm text-center py-8">No members found.</p>}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-border bg-surface divide-y divide-bg">
            {filtered.map(m => {
              const isOpen = expanded === m.id
              const balance = credits[m.id] || 0
              return (
                <div key={m.id}>
                  <button onClick={() => setExpanded(isOpen ? null : m.id)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted">{m.phone} &middot; {m.plan} &middot; until {fmtDate(m.end_date)}</p>
                    </div>
                    <span className={`shrink-0 text-2xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[m.status] || 'bg-bg text-muted'}`}>
                      {STATUS_LABEL[m.status] || m.status}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 bg-bg/40">
                      <div className="flex items-center gap-2 text-xs text-secondary">
                        <span>{m.email || 'No email'}</span>
                        <span>&middot;</span>
                        <span>DUPR {m.dupr_id || '—'}</span>
                        <span>&middot;</span>
                        <span>Tee {m.tshirt_size || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted">Status</label>
                        <select
                          className="input text-xs py-1"
                          value={m.status}
                          disabled={savingId === m.id}
                          onChange={e => updateMember(m.id, { status: e.target.value })}
                        >
                          {['pending_payment', 'active', 'expired', 'cancelled'].map(s => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <label className="text-xs text-muted ml-2">Until</label>
                        <input
                          type="date"
                          className="input text-xs py-1"
                          value={m.end_date || ''}
                          disabled={savingId === m.id}
                          onChange={e => updateMember(m.id, { end_date: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted">Rollover credits: <strong className="text-primary">{balance}</strong> / {m.rollover_cap}</span>
                        <button onClick={() => adjustCredit(m.id, 1)} disabled={savingId === m.id} className="text-xs font-semibold text-interactive">+1</button>
                        <button onClick={() => adjustCredit(m.id, -1)} disabled={savingId === m.id || balance <= 0} className="text-xs font-semibold text-error disabled:opacity-40">-1</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
