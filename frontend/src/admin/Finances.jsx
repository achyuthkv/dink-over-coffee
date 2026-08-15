import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../supabase.js'
import PlayerList from './PlayerList.jsx'

const EVENT_EXPENSE_CATEGORIES = ['Court Rental', 'Shuttle / Balls', 'Coffee & Refreshments', 'Medals & Awards', 'Transportation', 'Misc']
const COMMUNITY_EXPENSE_CATEGORIES = ['Equipment', 'Marketing', 'Printing', 'Merchandise', 'Misc']

function MonthStrip({ selectedMonth, onSelect, sessionMonths }) {
  const scrollRef = useRef(null)
  const selectedRef = useRef(null)

  const months = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return result
  }, [])

  useEffect(() => {
    requestAnimationFrame(() => {
      if (selectedRef.current && scrollRef.current) {
        const container = scrollRef.current
        const el = selectedRef.current
        container.scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
      }
    })
  }, [])

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const now = new Date()
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-primary font-bold text-lg">Finances</h1>
        <span className="text-primary text-sm font-semibold">{fullMonthNames[parseInt(selectedMonth.split('-')[1]) - 1]} {selectedMonth.split('-')[0]}</span>
      </div>
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide -mx-5 px-5">
        {months.map(m => {
          const key = `${m.year}-${String(m.month + 1).padStart(2, '0')}`
          const isSelected = key === selectedMonth
          const isCurrent = key === currentKey
          const hasSession = sessionMonths.has(key)
          return (
            <button
              key={key}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(key)}
              className={`flex flex-col items-center shrink-0 w-[56px] py-2.5 rounded-xl transition ease-spring
                ${isSelected ? 'bg-interactive text-inverse' : 'text-primary'}
                ${!isSelected && isCurrent ? 'border-2 border-interactive' : !isSelected ? 'border border-border' : ''}
                active:scale-[.98]
              `}
            >
              <span className={`text-3xs font-semibold tracking-wide ${isSelected ? 'text-inverse/70' : 'text-muted'}`}>
                {monthNames[m.month]}
              </span>
              <span className={`text-sm font-bold mt-0.5`}>
                {String(m.year).slice(2)}
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

function ExpenseForm({ onSave, onCancel, sessions, selectedMonth, knownPeople, type }) {
  const categories = type === 'event' ? EVENT_EXPENSE_CATEGORIES : COMMUNITY_EXPENSE_CATEGORIES
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [description, setDescription] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [date, setDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`
  })
  const [sessionId, setSessionId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || !date || !paidBy.trim()) return
    setSaving(true)
    await supabase.from('expenses').insert({
      date,
      amount: Number(amount),
      category,
      description: description.trim() || null,
      paid_by: paidBy.trim(),
      type,
      session_id: sessionId || null
    })
    setSaving(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="card-compact p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Add {type === 'event' ? 'Event' : 'Community'} Expense</span>
        <button type="button" onClick={onCancel} className="text-muted text-xs font-medium active:opacity-70">Cancel</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs text-muted font-medium block mb-1">Amount (₹)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none" />
        </div>
        <div>
          <label className="text-2xs text-muted font-medium block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="text-2xs text-muted font-medium block mb-1">Paid by</label>
        {knownPeople.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {knownPeople.map(p => (
              <button key={p} type="button" onClick={() => setPaidBy(p)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${paidBy === p ? 'bg-interactive text-inverse' : 'bg-bg border border-border text-primary'}`}>{p}</button>
            ))}
          </div>
        )}
        <input type="text" value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Name" required className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 focus:border-interactive focus:outline-none" />
      </div>

      <div>
        <label className="text-2xs text-muted font-medium block mb-1">Category</label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${category === c ? 'bg-interactive text-inverse' : 'bg-bg border border-border text-primary'}`}>{c}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-2xs text-muted font-medium block mb-1">Notes</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. 2 balls" className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 focus:border-interactive focus:outline-none" />
      </div>

      {type === 'event' && (
        <div>
          <label className="text-2xs text-muted font-medium block mb-1">Link to session</label>
          <select value={sessionId} onChange={e => setSessionId(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none">
            <option value="">Select session...</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title || s.venue} — {s.date}</option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" disabled={saving || !amount || !paidBy.trim()} className="w-full bg-interactive text-inverse text-sm font-semibold py-3 rounded-full active:scale-[.98] transition disabled:opacity-50">
        {saving ? 'Saving...' : 'Add Expense'}
      </button>
    </form>
  )
}

export default function Finances({ onBack }) {
  const [sessions, setSessions] = useState([])
  const [players, setPlayers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewPlayers, setViewPlayers] = useState(null)
  const [showExpenseForm, setShowExpenseForm] = useState(null)
  const [tab, setTab] = useState('overview')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  async function loadData() {
    const [sessRes, playRes, expRes] = await Promise.all([
      supabase.from('sessions').select('id, date, title, venue, price, max_slots, time').order('date', { ascending: false }),
      supabase.from('players').select('id, session_id, name, phone, status, paid, amount, created_at').in('status', ['confirmed', 'waitlisted']),
      supabase.from('expenses').select('*').order('date', { ascending: false })
    ])
    setSessions(sessRes.data || [])
    setPlayers(playRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const confirmed = useMemo(() => players.filter(p => p.status === 'confirmed'), [players])

  const sessionMonths = useMemo(() => {
    const set = new Set()
    sessions.forEach(s => { if (s.date) set.add(s.date.slice(0, 7)) })
    return set
  }, [sessions])

  const monthSessions = useMemo(() => sessions.filter(s => s.date && s.date.startsWith(selectedMonth)), [sessions, selectedMonth])
  const monthExpenses = useMemo(() => expenses.filter(e => e.date && e.date.startsWith(selectedMonth)), [expenses, selectedMonth])
  const eventExpenses = useMemo(() => monthExpenses.filter(e => e.type === 'event' || e.session_id), [monthExpenses])
  const communityExpenses = useMemo(() => monthExpenses.filter(e => e.type === 'community' && !e.session_id), [monthExpenses])

  const knownPeople = useMemo(() => {
    const names = new Set()
    expenses.forEach(e => { if (e.paid_by) names.add(e.paid_by) })
    return [...names].sort()
  }, [expenses])

  const stats = useMemo(() => {
    const sessionMap = {}
    sessions.forEach(s => { sessionMap[s.id] = s })

    let monthIncome = 0
    let monthPlayers = 0

    const sessionDetails = monthSessions.map(s => {
      const sp = confirmed.filter(p => p.session_id === s.id)
      const price = Number(s.price) || 0
      const income = sp.filter(p => p.paid).reduce((sum, p) => sum + (Number(p.amount) || price), 0)
      const expected = sp.reduce((sum, p) => sum + (Number(p.amount) || price), 0)
      monthIncome += income
      monthPlayers += sp.length

      const sessExpenses = eventExpenses.filter(e => e.session_id === s.id)
      const sessExpTotal = sessExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

      return { ...s, playerCount: sp.length, income, expected, paidCount: sp.filter(p => p.paid).length, unpaid: sp.filter(p => !p.paid), expenses: sessExpTotal, profit: income - sessExpTotal }
    })

    const totalEventExp = eventExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const totalCommunityExp = communityExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const eventPnL = monthIncome - totalEventExp
    const trueCommunityNet = monthIncome - totalEventExp - totalCommunityExp

    // All-time
    let allIncome = 0
    let allExpected = 0
    confirmed.forEach(p => {
      const session = sessionMap[p.session_id]
      if (!session) return
      const price = Number(p.amount) || Number(session.price) || 0
      allExpected += price
      if (p.paid) allIncome += price
    })
    const allExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    // Monthly breakdown
    const monthlyMap = {}
    sessions.forEach(s => {
      if (!s.date) return
      const m = s.date.slice(0, 7)
      if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0, sessions: 0 }
      monthlyMap[m].sessions++
    })
    confirmed.forEach(p => {
      const session = sessionMap[p.session_id]
      if (!session || !p.paid) return
      const m = session.date.slice(0, 7)
      if (monthlyMap[m]) monthlyMap[m].income += Number(p.amount) || Number(session.price) || 0
    })
    expenses.forEach(e => {
      if (!e.date) return
      const m = e.date.slice(0, 7)
      if (!monthlyMap[m]) monthlyMap[m] = { income: 0, expenses: 0, sessions: 0 }
      monthlyMap[m].expenses += Number(e.amount) || 0
    })
    const monthly = Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8).map(([m, v]) => ({ month: m, ...v, net: v.income - v.expenses, margin: v.income > 0 ? Math.round(((v.income - v.expenses) / v.income) * 100) : 0 }))

    return { monthIncome, monthPlayers, totalEventExp, totalCommunityExp, eventPnL, trueCommunityNet, sessionDetails, allIncome, allExpected, allExpenses, monthly }
  }, [monthSessions, eventExpenses, communityExpenses, confirmed, sessions, expenses])

  const balances = useMemo(() => {
    const map = {}
    expenses.forEach(e => {
      if (!e.paid_by) return
      if (!map[e.paid_by]) map[e.paid_by] = { total: 0, unsettled: 0 }
      map[e.paid_by].total += Number(e.amount) || 0
      if (!e.settled) map[e.paid_by].unsettled += Number(e.amount) || 0
    })
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.unsettled - a.unsettled)
  }, [expenses])

  async function toggleSettled(expense) {
    const newVal = !expense.settled
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, settled: newVal } : e))
    await supabase.from('expenses').update({ settled: newVal }).eq('id', expense.id)
  }

  async function deleteExpense(id) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  function fmtMoney(n) {
    if (n >= 100000) return `₹${(n / 1000).toFixed(0)}k`
    if (n >= 10000) return `₹${(n / 1000).toFixed(1)}k`
    return `₹${n.toLocaleString('en-IN')}`
  }

  function fmtDate(d) {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
  }

  function fmtMonth(m) {
    const [y, mo] = m.split('-')
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${names[parseInt(mo) - 1]} ${y}`
  }

  if (viewPlayers) {
    return <PlayerList session={viewPlayers} onBack={() => setViewPlayers(null)} />
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 py-6">

        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>

        <MonthStrip selectedMonth={selectedMonth} onSelect={setSelectedMonth} sessionMonths={sessionMonths} />

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && (
          <div className="space-y-5">

            {/* Financial Overview — matching sheet layout */}
            <div className="grid grid-cols-2 gap-2">
              <div className="card-compact px-4 py-3 text-center">
                <div className="text-3xs text-muted uppercase tracking-wide font-semibold">Total Income</div>
                <div className="text-xl font-bold text-success mt-1">{fmtMoney(stats.monthIncome)}</div>
                <div className="text-3xs text-muted mt-0.5">from {monthSessions.length} sessions</div>
              </div>
              <div className="card-compact px-4 py-3 text-center">
                <div className="text-3xs text-muted uppercase tracking-wide font-semibold">Total Expenditure</div>
                <div className="text-xl font-bold text-error mt-1">{fmtMoney(stats.totalEventExp + stats.totalCommunityExp)}</div>
                <div className="text-3xs text-muted mt-0.5">event + community</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="card-compact px-4 py-3 text-center">
                <div className="text-3xs text-muted uppercase tracking-wide font-semibold">Event Net P&L</div>
                <div className={`text-lg font-bold mt-1 ${stats.eventPnL >= 0 ? 'text-success' : 'text-error'}`}>{fmtMoney(stats.eventPnL)}</div>
                <div className="text-3xs text-muted mt-0.5">before community costs</div>
              </div>
              <div className="card-compact px-4 py-3 text-center">
                <div className="text-3xs text-muted uppercase tracking-wide font-semibold">True Community Net</div>
                <div className={`text-lg font-bold mt-1 ${stats.trueCommunityNet >= 0 ? 'text-success' : 'text-error'}`}>{fmtMoney(stats.trueCommunityNet)}</div>
                <div className="text-3xs text-muted mt-0.5">after all expenses</div>
              </div>
            </div>

            {/* Quick stats bar */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface rounded-lg border border-border px-3 py-2 text-center">
                <div className="text-sm font-bold text-primary">{monthSessions.length}</div>
                <div className="text-3xs text-muted uppercase">Sessions</div>
              </div>
              <div className="bg-surface rounded-lg border border-border px-3 py-2 text-center">
                <div className="text-sm font-bold text-primary">{stats.monthPlayers}</div>
                <div className="text-3xs text-muted uppercase">Players</div>
              </div>
              <div className="bg-surface rounded-lg border border-border px-3 py-2 text-center">
                <div className="text-sm font-bold text-primary">{stats.monthPlayers > 0 && monthSessions.length > 0 ? fmtMoney(Math.round(stats.monthIncome / monthSessions.length)) : '—'}</div>
                <div className="text-3xs text-muted uppercase">Avg/Session</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-bg rounded-xl p-1">
              {['overview', 'event costs', 'community costs', 'balances'].map(t => (
                <button key={t} onClick={() => setTab(t)} className={`flex-1 text-2xs font-semibold py-2 rounded-lg capitalize transition ease-spring ${tab === t ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>{t}</button>
              ))}
            </div>

            {/* Overview tab — monthly I&E table + sessions */}
            {tab === 'overview' && (
              <>
                {stats.monthly.length > 0 && (
                  <div className="card-compact overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border">
                      <span className="text-xs font-semibold text-primary">Monthly Income & Expenditure</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-2xs">
                        <thead>
                          <tr className="border-b border-border text-muted">
                            <th className="text-left px-3 py-2 font-semibold">Month</th>
                            <th className="text-right px-2 py-2 font-semibold">Sessions</th>
                            <th className="text-right px-2 py-2 font-semibold">Income</th>
                            <th className="text-right px-2 py-2 font-semibold">Exp</th>
                            <th className="text-right px-2 py-2 font-semibold">Net</th>
                            <th className="text-right px-3 py-2 font-semibold">Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.monthly.map(m => (
                            <tr key={m.month} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2 font-medium text-primary">{fmtMonth(m.month)}</td>
                              <td className="text-right px-2 py-2 text-muted">{m.sessions}</td>
                              <td className="text-right px-2 py-2 text-success font-medium">{fmtMoney(m.income)}</td>
                              <td className="text-right px-2 py-2 text-error font-medium">{fmtMoney(m.expenses)}</td>
                              <td className={`text-right px-2 py-2 font-semibold ${m.net >= 0 ? 'text-success' : 'text-error'}`}>{fmtMoney(m.net)}</td>
                              <td className={`text-right px-3 py-2 font-medium ${m.margin >= 0 ? 'text-success' : 'text-error'}`}>{m.income > 0 ? `${m.margin}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Per-session P&L cards */}
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-semibold text-muted uppercase tracking-wider">Sessions this month</span>
                  <span className="text-2xs text-muted">{monthSessions.length}</span>
                </div>

                {stats.sessionDetails.map(s => (
                  <div key={s.id} className="card-compact overflow-hidden">
                    <button type="button" onClick={() => setViewPlayers(s)} className="w-full text-left px-5 py-4">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="text-interactive font-bold text-sm">{s.time || fmtDate(s.date)}</div>
                          <div className="text-primary font-semibold text-sm mt-0.5 truncate">{s.title || s.venue}</div>
                          <div className="text-2xs text-muted mt-0.5">{fmtDate(s.date)} · {s.playerCount} players</div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className={`text-base font-extrabold ${s.profit >= 0 ? 'text-success' : 'text-error'}`}>{fmtMoney(s.profit)}</div>
                          <div className="text-3xs text-muted">P&L</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-2xs">
                        <span className="text-success font-medium">Income: {fmtMoney(s.income)}</span>
                        <span className="text-error font-medium">Exp: {fmtMoney(s.expenses)}</span>
                        <span className="text-muted">{s.paidCount}/{s.playerCount} paid</span>
                      </div>
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Event costs tab */}
            {tab === 'event costs' && (
              <>
                {showExpenseForm === 'event' ? (
                  <ExpenseForm type="event" sessions={monthSessions} selectedMonth={selectedMonth} knownPeople={knownPeople} onSave={() => { setShowExpenseForm(null); loadData() }} onCancel={() => setShowExpenseForm(null)} />
                ) : (
                  <button onClick={() => setShowExpenseForm('event')} className="w-full bg-surface rounded-2xl border border-dashed border-border px-5 py-4 text-center active:bg-bg transition">
                    <span className="text-sm font-semibold text-interactive">+ Add Event Expense</span>
                  </button>
                )}

                {eventExpenses.length === 0 && (
                  <div className="card-compact px-5 py-8 text-center">
                    <p className="text-muted text-sm">No event expenses this month</p>
                  </div>
                )}

                {eventExpenses.map(e => {
                  const linkedSession = e.session_id ? sessions.find(s => s.id === e.session_id) : null
                  return (
                    <div key={e.id} className={`card-compact px-4 py-3 ${e.settled ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-primary font-medium">{e.category}</span>
                            {e.description && <span className="text-2xs text-muted">— {e.description}</span>}
                          </div>
                          <div className="text-2xs text-muted mt-0.5">
                            {fmtDate(e.date)} · paid by <strong>{e.paid_by}</strong>
                            {linkedSession && <span> · {linkedSession.title || linkedSession.venue}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-sm font-bold text-error">{fmtMoney(Number(e.amount))}</span>
                          <button onClick={() => toggleSettled(e)} className={`relative shrink-0 w-9 h-[20px] rounded-full transition-colors ${e.settled ? 'bg-success' : 'bg-border'}`} title={e.settled ? 'Settled' : 'Mark settled'}>
                            <span className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${e.settled ? 'translate-x-[16px]' : ''}`} />
                          </button>
                          <button onClick={() => deleteExpense(e.id)} className="w-6 h-6 flex items-center justify-center rounded-full text-muted active:text-error transition" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {eventExpenses.length > 0 && (
                  <div className="card-compact px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Total Event Expenses</span>
                    <span className="text-sm font-bold text-error">{fmtMoney(stats.totalEventExp)}</span>
                  </div>
                )}
              </>
            )}

            {/* Community costs tab */}
            {tab === 'community costs' && (
              <>
                {showExpenseForm === 'community' ? (
                  <ExpenseForm type="community" sessions={[]} selectedMonth={selectedMonth} knownPeople={knownPeople} onSave={() => { setShowExpenseForm(null); loadData() }} onCancel={() => setShowExpenseForm(null)} />
                ) : (
                  <button onClick={() => setShowExpenseForm('community')} className="w-full bg-surface rounded-2xl border border-dashed border-border px-5 py-4 text-center active:bg-bg transition">
                    <span className="text-sm font-semibold text-interactive">+ Add Community Expense</span>
                  </button>
                )}

                {communityExpenses.length === 0 && (
                  <div className="card-compact px-5 py-8 text-center">
                    <p className="text-muted text-sm">No community expenses this month</p>
                  </div>
                )}

                {communityExpenses.map(e => (
                  <div key={e.id} className={`card-compact px-4 py-3 ${e.settled ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-primary font-medium">{e.description || e.category}</span>
                          <span className="text-3xs font-medium text-muted bg-bg px-2 py-0.5 rounded-full">{e.category}</span>
                        </div>
                        <div className="text-2xs text-muted mt-0.5">{fmtDate(e.date)} · paid by <strong>{e.paid_by}</strong></div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-sm font-bold text-error">{fmtMoney(Number(e.amount))}</span>
                        <button onClick={() => toggleSettled(e)} className={`relative shrink-0 w-9 h-[20px] rounded-full transition-colors ${e.settled ? 'bg-success' : 'bg-border'}`} title={e.settled ? 'Settled' : 'Mark settled'}>
                          <span className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${e.settled ? 'translate-x-[16px]' : ''}`} />
                        </button>
                        <button onClick={() => deleteExpense(e.id)} className="w-6 h-6 flex items-center justify-center rounded-full text-muted active:text-error transition" title="Delete">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {communityExpenses.length > 0 && (
                  <div className="card-compact px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-primary">Total Community Expenses</span>
                    <span className="text-sm font-bold text-error">{fmtMoney(stats.totalCommunityExp)}</span>
                  </div>
                )}
              </>
            )}

            {/* Balances tab */}
            {tab === 'balances' && (
              <>
                {balances.length === 0 && (
                  <div className="card-compact px-5 py-8 text-center">
                    <p className="text-muted text-sm">No expenses recorded yet</p>
                  </div>
                )}

                {balances.map(b => (
                  <div key={b.name} className="card-compact px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm text-primary font-semibold">{b.name}</span>
                      <div className="text-2xs text-muted mt-0.5">Total spent: {fmtMoney(b.total)}</div>
                    </div>
                    <div className="text-right">
                      {b.unsettled > 0 ? (
                        <>
                          <span className="text-sm font-bold text-warning-muted">{fmtMoney(b.unsettled)}</span>
                          <div className="text-3xs text-muted">to reimburse</div>
                        </>
                      ) : (
                        <span className="badge-success">All Settled</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
