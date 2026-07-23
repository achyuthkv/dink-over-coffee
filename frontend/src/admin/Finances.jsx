import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../supabase.js'
import PlayerList from './PlayerList.jsx'

const EXPENSE_CATEGORIES = ['Venue', 'Equipment', 'Food', 'Marketing', 'Misc']

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
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = selectedRef.current
      container.scrollLeft = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
    }
  }, [selectedMonth])

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
              className={`flex flex-col items-center shrink-0 w-[56px] py-2.5 rounded-xl transition
                ${isSelected ? 'bg-interactive text-inverse' : 'text-primary'}
                ${!isSelected && isCurrent ? 'border-2 border-interactive' : !isSelected ? 'border border-border' : ''}
                active:scale-95
              `}
            >
              <span className={`text-[10px] font-semibold tracking-wide ${isSelected ? 'text-inverse/70' : 'text-muted'}`}>
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

function ExpenseForm({ onSave, onCancel, sessions, selectedMonth, knownPeople }) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Venue')
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
    const { error } = await supabase.from('expenses').insert({
      date,
      amount: Number(amount),
      category,
      description: description.trim() || null,
      paid_by: paidBy.trim(),
      session_id: sessionId || null
    })
    setSaving(false)
    if (!error) onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">Add Expense</span>
        <button type="button" onClick={onCancel} className="text-muted text-xs font-medium active:opacity-70">Cancel</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted font-medium block mb-1">Amount (₹)</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            required
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted font-medium block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
            className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted font-medium block mb-1">Paid by</label>
        {knownPeople.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {knownPeople.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPaidBy(p)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${paidBy === p ? 'bg-interactive text-inverse' : 'bg-bg border border-border text-primary'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={paidBy}
          onChange={e => setPaidBy(e.target.value)}
          placeholder="Name of person who paid"
          required
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 focus:border-interactive focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[11px] text-muted font-medium block mb-1">Category</label>
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${category === c ? 'bg-interactive text-inverse' : 'bg-bg border border-border text-primary'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted font-medium block mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. Court booking for Saturday session"
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 focus:border-interactive focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[11px] text-muted font-medium block mb-1">Link to session (optional)</label>
        <select
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
        >
          <option value="">None</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.title || s.venue} — {s.date}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={saving || !amount || !paidBy.trim()}
        className="w-full bg-interactive text-inverse text-sm font-semibold py-3 rounded-full active:scale-[.98] transition disabled:opacity-50"
      >
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
  const [showExpenseForm, setShowExpenseForm] = useState(false)
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

  const monthSessions = useMemo(() => {
    return sessions.filter(s => s.date && s.date.startsWith(selectedMonth))
  }, [sessions, selectedMonth])

  const monthExpenses = useMemo(() => {
    return expenses.filter(e => e.date && e.date.startsWith(selectedMonth))
  }, [expenses, selectedMonth])

  const monthStats = useMemo(() => {
    const sessionMap = {}
    sessions.forEach(s => { sessionMap[s.id] = s })

    let monthExpected = 0
    let monthReceived = 0
    let monthPlayers = 0

    const sessionDetails = monthSessions.map(s => {
      const sp = confirmed.filter(p => p.session_id === s.id)
      const price = Number(s.price) || 0
      const expected = sp.reduce((sum, p) => sum + (Number(p.amount) || price), 0)
      const received = sp.filter(p => p.paid).reduce((sum, p) => sum + (Number(p.amount) || price), 0)
      monthExpected += expected
      monthReceived += received
      monthPlayers += sp.length
      return {
        ...s,
        playerCount: sp.length,
        expected,
        received,
        outstanding: expected - received,
        paidCount: sp.filter(p => p.paid).length,
        unpaid: sp.filter(p => !p.paid)
      }
    })

    const monthOutstanding = monthExpected - monthReceived
    const collectionRate = monthExpected > 0 ? Math.round((monthReceived / monthExpected) * 100) : 0

    const totalExpenses = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    const profit = monthReceived - totalExpenses

    const expensesByCategory = {}
    monthExpenses.forEach(e => {
      const cat = e.category || 'Misc'
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(e.amount) || 0)
    })

    let totalExpected = 0
    let totalReceived = 0
    confirmed.forEach(p => {
      const session = sessionMap[p.session_id]
      if (!session) return
      const price = Number(p.amount) || Number(session.price) || 0
      totalExpected += price
      if (p.paid) totalReceived += price
    })
    const allTimeExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

    return {
      monthExpected,
      monthReceived,
      monthOutstanding,
      collectionRate,
      monthPlayers,
      sessionDetails,
      totalExpenses,
      profit,
      expensesByCategory,
      totalReceived,
      totalExpected,
      allTimeExpenses,
      totalOutstanding: totalExpected - totalReceived,
      totalRate: totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0
    }
  }, [monthSessions, monthExpenses, confirmed, sessions, expenses])

  const knownPeople = useMemo(() => {
    const names = new Set()
    expenses.forEach(e => { if (e.paid_by) names.add(e.paid_by) })
    return [...names].sort()
  }, [expenses])

  const balances = useMemo(() => {
    const map = {}
    expenses.forEach(e => {
      if (!e.paid_by) return
      if (!map[e.paid_by]) map[e.paid_by] = { total: 0, unsettled: 0 }
      map[e.paid_by].total += Number(e.amount) || 0
      if (!e.settled) map[e.paid_by].unsettled += Number(e.amount) || 0
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.unsettled - a.unsettled)
  }, [expenses])

  async function toggleSettled(expense) {
    const newVal = !expense.settled
    setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, settled: newVal } : e))
    await supabase.from('expenses').update({ settled: newVal }).eq('id', expense.id)
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

  async function deleteExpense(id) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  if (viewPlayers) {
    return <PlayerList session={viewPlayers} onBack={() => setViewPlayers(null)} />
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 py-6">

        {/* Back button */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        </div>

        {/* Month strip */}
        <MonthStrip selectedMonth={selectedMonth} onSelect={setSelectedMonth} sessionMonths={sessionMonths} />

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && (
          <div className="space-y-5">

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface rounded-xl border border-border px-3 py-3 text-center">
                <div className="text-lg font-bold text-secondary">{fmtMoney(monthStats.monthReceived)}</div>
                <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Collected</div>
              </div>
              <div className="bg-surface rounded-xl border border-border px-3 py-3 text-center">
                <div className="text-lg font-bold text-tertiary">{fmtMoney(monthStats.totalExpenses)}</div>
                <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Expenses</div>
              </div>
              <div className="bg-surface rounded-xl border border-border px-3 py-3 text-center">
                <div className={`text-lg font-bold ${monthStats.profit >= 0 ? 'text-secondary' : 'text-tertiary'}`}>{fmtMoney(monthStats.profit)}</div>
                <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Profit</div>
              </div>
            </div>

            {/* Outstanding + Rate */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface rounded-xl border border-border px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] text-muted uppercase tracking-wide font-semibold">Outstanding</span>
                <span className="text-sm font-bold text-warning">{fmtMoney(monthStats.monthOutstanding)}</span>
              </div>
              <div className="bg-surface rounded-xl border border-border px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] text-muted uppercase tracking-wide font-semibold">Collection</span>
                <span className={`text-sm font-bold ${monthStats.collectionRate >= 80 ? 'text-secondary' : monthStats.collectionRate >= 50 ? 'text-warning' : 'text-tertiary'}`}>{monthStats.collectionRate}%</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-bg rounded-xl p-1">
              {['overview', 'expenses'].map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-lg capitalize transition ${tab === t ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && (
              <>
                {/* All-time row */}
                <div className="bg-surface rounded-xl border border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted uppercase tracking-wide font-semibold">All Time</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${monthStats.totalRate >= 80 ? 'text-secondary bg-secondary/10' : monthStats.totalRate >= 50 ? 'text-warning bg-warning/10' : 'text-tertiary bg-tertiary/10'}`}>
                      {monthStats.totalRate}%
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <div>
                      <span className="text-xs text-muted">Revenue</span>
                      <span className="text-sm font-bold text-primary ml-1">{fmtMoney(monthStats.totalReceived)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Expenses</span>
                      <span className="text-sm font-bold text-tertiary ml-1">{fmtMoney(monthStats.allTimeExpenses)}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted">Net</span>
                      <span className={`text-sm font-bold ml-1 ${monthStats.totalReceived - monthStats.allTimeExpenses >= 0 ? 'text-secondary' : 'text-tertiary'}`}>
                        {fmtMoney(monthStats.totalReceived - monthStats.allTimeExpenses)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Session header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Sessions</span>
                  <span className="text-[11px] font-medium text-interactive">
                    {monthSessions.length} session{monthSessions.length !== 1 ? 's' : ''} · {monthStats.monthPlayers} players
                  </span>
                </div>

                {/* Session cards */}
                {monthStats.sessionDetails.length === 0 && (
                  <div className="bg-surface rounded-2xl border border-border px-5 py-10 text-center">
                    <p className="text-muted text-sm">No sessions this month</p>
                  </div>
                )}

                {monthStats.sessionDetails.map(s => {
                  const rate = s.expected > 0 ? Math.round((s.received / s.expected) * 100) : 0
                  return (
                    <div key={s.id} className="bg-surface rounded-2xl border border-border overflow-hidden">
                      <button type="button" onClick={() => setViewPlayers(s)} className="w-full text-left px-5 py-4">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="text-interactive font-bold text-base">{s.time || fmtDate(s.date)}</div>
                            <div className="text-primary font-semibold text-sm mt-0.5 truncate">{s.title || s.venue}</div>
                            <div className="text-[11px] text-muted mt-0.5">{fmtDate(s.date)} · {s.venue}</div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className="text-primary font-bold text-base">{fmtMoney(s.received)}</div>
                            <div className="text-[10px] text-muted">of {fmtMoney(s.expected)}</div>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-border overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-secondary' : rate >= 50 ? 'bg-warning' : 'bg-tertiary'}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${rate >= 80 ? 'text-secondary bg-secondary/10' : rate >= 50 ? 'text-warning bg-warning/10' : 'text-tertiary bg-tertiary/10'}`}>
                            {s.paidCount}/{s.playerCount} paid
                          </span>
                          {s.outstanding > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                              {fmtMoney(s.outstanding)} pending
                            </span>
                          )}
                        </div>
                      </button>
                      {s.unpaid.length > 0 && (
                        <div className="border-t border-border px-5 py-3">
                          <div className="text-[10px] text-muted uppercase tracking-wide font-semibold mb-2">Unpaid</div>
                          <div className="space-y-1.5">
                            {s.unpaid.map(p => (
                              <div key={p.id} className="flex items-center justify-between">
                                <span className="text-xs text-primary font-medium">{p.name}</span>
                                <span className="text-[11px] text-muted">{p.phone}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* Expenses tab */}
            {tab === 'expenses' && (
              <>
                {/* Balances - who is owed what */}
                {balances.length > 0 && (
                  <div className="bg-surface rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <span className="text-xs font-semibold text-primary">Balances</span>
                      <span className="text-[10px] text-muted ml-2">unsettled amounts owed to each person</span>
                    </div>
                    <div className="divide-y divide-bg">
                      {balances.map(b => (
                        <div key={b.name} className="px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-primary font-medium">{b.name}</span>
                            <span className="text-[10px] text-muted">total: {fmtMoney(b.total)}</span>
                          </div>
                          <span className={`text-sm font-bold ${b.unsettled > 0 ? 'text-warning' : 'text-secondary'}`}>
                            {b.unsettled > 0 ? fmtMoney(b.unsettled) : 'Settled'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Category breakdown */}
                {Object.keys(monthStats.expensesByCategory).length > 0 && (
                  <div className="bg-surface rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <span className="text-xs font-semibold text-primary">By Category</span>
                    </div>
                    <div className="divide-y divide-bg">
                      {EXPENSE_CATEGORIES.filter(c => monthStats.expensesByCategory[c]).map(c => {
                        const amt = monthStats.expensesByCategory[c]
                        const pct = monthStats.totalExpenses > 0 ? Math.round((amt / monthStats.totalExpenses) * 100) : 0
                        return (
                          <div key={c} className="px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-primary font-medium">{c}</span>
                              <span className="text-[10px] text-muted">{pct}%</span>
                            </div>
                            <span className="text-sm font-semibold text-primary">{fmtMoney(amt)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Add expense button or form */}
                {showExpenseForm ? (
                  <ExpenseForm
                    sessions={monthSessions}
                    selectedMonth={selectedMonth}
                    knownPeople={knownPeople}
                    onSave={() => { setShowExpenseForm(false); loadData() }}
                    onCancel={() => setShowExpenseForm(false)}
                  />
                ) : (
                  <button
                    onClick={() => setShowExpenseForm(true)}
                    className="w-full bg-surface rounded-2xl border border-dashed border-border px-5 py-4 text-center active:bg-bg transition"
                  >
                    <span className="text-sm font-semibold text-interactive">+ Add Expense</span>
                  </button>
                )}

                {/* Expense list */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Transactions</span>
                  <span className="text-[11px] text-muted">{monthExpenses.length} entries</span>
                </div>

                {monthExpenses.length === 0 && (
                  <div className="bg-surface rounded-2xl border border-border px-5 py-10 text-center">
                    <p className="text-muted text-sm">No expenses this month</p>
                  </div>
                )}

                {monthExpenses.map(e => {
                  const linkedSession = e.session_id ? sessions.find(s => s.id === e.session_id) : null
                  return (
                    <div key={e.id} className={`bg-surface rounded-xl border border-border px-4 py-3 ${e.settled ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-primary font-medium">{e.description || e.category}</span>
                            <span className="text-[10px] font-medium text-muted bg-bg px-2 py-0.5 rounded-full">{e.category}</span>
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">
                            {fmtDate(e.date)}
                            {e.paid_by && <span> · paid by <strong>{e.paid_by}</strong></span>}
                            {linkedSession && <span> · {linkedSession.title || linkedSession.venue}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-sm font-bold text-tertiary">{fmtMoney(Number(e.amount))}</span>
                          <button
                            onClick={() => toggleSettled(e)}
                            className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${e.settled ? 'bg-secondary' : 'bg-border'}`}
                            title={e.settled ? 'Mark unsettled' : 'Mark settled'}
                          >
                            <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${e.settled ? 'translate-x-[18px]' : ''}`} />
                          </button>
                          <button
                            onClick={() => deleteExpense(e.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-muted active:text-tertiary active:bg-error-subtle transition"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
