import { useEffect, useRef, useState } from 'react'
import { api, RAZORPAY_KEY_ID, PAYMENTS_ENABLED } from '../api.js'
import SessionCard from './SessionCard.jsx'

const ALL_SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtShort(date, time) {
  if (!date) return time || ''
  const dt = new Date(date + 'T00:00:00')
  if (isNaN(dt)) return `${date} ${time || ''}`
  return `${DAYS[dt.getDay()]} ${dt.getDate()} ${time || ''}`.trim()
}

export default function RegisterTab() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('doc_player') || '{}')
      return { name: saved.name || '', phone: saved.phone || '', skill: saved.skill || 'Beginner', duprId: saved.duprId || '' }
    } catch { return { name: '', phone: '', skill: 'Beginner', duprId: '' } }
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [waitlistSuccess, setWaitlistSuccess] = useState(null)
  const [players, setPlayers] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const formRef = useRef(null)
  const [qrIndex, setQrIndex] = useState(0)

  async function load(silent) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { sessions } = await api.listSessions()
      setSessions(sessions)
      setSelected(prev => {
        if (prev) return sessions.find(s => s.id === prev.id) || prev
        if (sessions.length === 1) return sessions[0]
        return prev
      })
    } catch (e) {
      if (!silent) setError(e.message || 'Could not load sessions')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selected) loadPlayers(selected.id)
  }, [selected?.id])

  useEffect(() => {
    const interval = setInterval(() => {
      load(true)
      if (selected) loadPlayers(selected.id, true)
    }, 15000)
    return () => clearInterval(interval)
  }, [selected])

  const beginnerAllowed = !selected || selected.beginnerSlots === null || selected.beginnerSlots === undefined || selected.beginnerSlots > 0
  const skillLevels = beginnerAllowed ? ALL_SKILL_LEVELS : ALL_SKILL_LEVELS.filter(s => s !== 'Beginner')

  function handleSelect(session) {
    setSelected(session)
    const noBeginner = session.beginnerSlots !== null && session.beginnerSlots !== undefined && session.beginnerSlots === 0
    if (noBeginner && form.skill === 'Beginner') {
      setForm(f => ({ ...f, skill: 'Intermediate' }))
    }
    loadPlayers(session.id)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  async function loadPlayers(sessionId, silent) {
    if (!silent) setLoadingPlayers(true)
    try {
      const { players } = await api.listPlayers(sessionId)
      setPlayers(players)
    } catch { setPlayers([]) }
    finally { if (!silent) setLoadingPlayers(false) }
  }

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function validate() {
    if (!selected) return 'Pick a session first'
    if (!form.name.trim() || form.name.trim().length < 2) return 'Enter your name'
    if (!/^[0-9]{10}$/.test(form.phone.trim())) return 'Enter a valid 10-digit phone number'
    return null
  }

  const hasSplit = selected && selected.beginnerSlots != null && Number(selected.beginnerSlots) > 0
  const noBeginner = selected && selected.beginnerSlots != null && Number(selected.beginnerSlots) === 0
  const isBeginner = form.skill === 'Beginner'

  let slotsFull = false
  let waitlistAvailable = false

  if (selected) {
    if (hasSplit) {
      if (isBeginner) {
        const beginnerRemaining = Math.max(0, Number(selected.beginnerSlots) - Number(selected.beginnerTaken || 0))
        slotsFull = beginnerRemaining <= 0
        const bWlMax = Number(selected.beginnerWaitlistMax || 0)
        const bWlCount = Number(selected.beginnerWaitlistCount || 0)
        waitlistAvailable = slotsFull && bWlMax > 0 && bWlCount < bWlMax
      } else {
        const otherSlots = Number(selected.maxSlots) - Number(selected.beginnerSlots)
        const otherRemaining = Math.max(0, otherSlots - Number(selected.otherTaken || 0))
        slotsFull = otherRemaining <= 0
        const wlMax = Number(selected.waitlistMax || 0)
        const wlCount = Number(selected.otherWaitlistCount || 0)
        waitlistAvailable = slotsFull && wlMax > 0 && wlCount < wlMax
      }
    } else {
      slotsFull = Number(selected.takenSlots || 0) >= Number(selected.maxSlots || 0)
      const wlMax = Number(selected.waitlistMax || 0)
      const wlCount = Number(selected.waitlistCount || 0)
      waitlistAvailable = slotsFull && wlMax > 0 && wlCount < wlMax
    }
  }

  async function handleWaitlist() {
    const v = validate()
    if (v) { setError(v); return }
    setError(null); setSubmitting(true)
    try {
      const player = { name: form.name.trim(), phone: form.phone.trim(), skill: form.skill, ...(form.duprId.trim() && { duprId: form.duprId.trim() }) }
      const res = await api.joinWaitlist(selected.id, player)
      if (res.alreadyRegistered) {
        setError('You are already registered for this session.')
        setSubmitting(false)
        return
      }
      if (res.alreadyWaitlisted) {
        setError('You are already on the waitlist for this session.')
        setSubmitting(false)
        return
      }
      setWaitlistSuccess({ session: selected, player, position: res.position })
      localStorage.setItem('doc_player', JSON.stringify({ name: player.name, phone: player.phone, skill: player.skill, duprId: player.duprId || '' }))
      setForm({ name: '', phone: '', skill: 'Beginner', duprId: '' })
      setSelected(null)
      await load()
    } catch (e) {
      setError(e.message || 'Could not join waitlist')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePay() {
    const v = validate()
    if (v) { setError(v); return }
    setError(null); setSubmitting(true)
    try {
      const player = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        skill: form.skill,
        ...(form.duprId.trim() && { duprId: form.duprId.trim() })
      }

      if (!PAYMENTS_ENABLED) {
        const res = await api.registerFree(selected.id, player)
        if (res.alreadyRegistered) {
          setError('You are already registered for this session.')
          setSubmitting(false)
          return
        }
        setSuccess({ session: selected, player })
        localStorage.setItem('doc_player', JSON.stringify({ name: player.name, phone: player.phone, skill: player.skill, duprId: player.duprId || '' }))
        setForm({ name: '', phone: '', skill: 'Beginner', duprId: '' })
        setSelected(null)
        await load()
        setSubmitting(false)
        return
      }

      const order = await api.createOrder(selected.id, player)
      await openCheckout(order, player)
    } catch (e) {
      setError(e.message || 'Could not start payment')
      setSubmitting(false)
    }
  }

  function openCheckout(order, player) {
    return new Promise((resolve) => {
      if (!window.Razorpay) {
        setError('Razorpay failed to load. Check your network.')
        setSubmitting(false)
        return resolve()
      }
      const rzp = new window.Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.orderId,
        name: 'Dink Over Coffee',
        description: `${selected.venue} · ${selected.time}`,
        prefill: { name: player.name, contact: player.phone },
        theme: { color: '#05AD86' },
        modal: {
          ondismiss: () => { setSubmitting(false); resolve() }
        },
        handler: async (resp) => {
          try {
            await api.confirmPayment({
              holdId: order.holdId,
              sessionId: order.sessionId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature
            })
            setSuccess({ session: selected, player })
            localStorage.setItem('doc_player', JSON.stringify({ name: player.name, phone: player.phone, skill: player.skill, duprId: player.duprId || '' }))
            setForm({ name: '', phone: '', skill: 'Beginner', duprId: '' })
            setSelected(null)
            await load()
          } catch (e) {
            setError(e.message || 'Payment confirmation failed')
          } finally {
            setSubmitting(false)
            resolve()
          }
        }
      })
      rzp.on('payment.failed', () => {
        setError('Payment failed. Your slot was released.')
        setSubmitting(false)
        resolve()
      })
      rzp.open()
    })
  }

  if (waitlistSuccess) {
    return (
      <div className="card text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-warning-subtle grid place-items-center text-warning-muted text-2xl">⏳</div>
        <h2 className="mt-3 text-text text-xl font-extrabold">You're on the waitlist!</h2>
        <p className="mt-1 text-primary text-sm">
          Position #{waitlistSuccess.position} · {waitlistSuccess.session.venue} · {fmtShort(waitlistSuccess.session.date, waitlistSuccess.session.time)}
        </p>
        <p className="mt-2 text-secondary text-xs">We'll promote you if a slot opens up.</p>
        <button className="btn-primary w-full mt-5" onClick={() => setWaitlistSuccess(null)}>Back</button>
      </div>
    )
  }

  if (success) {
    const accounts = success.session.upiAccounts || []
    const tn = encodeURIComponent(success.session.venue + ' ' + fmtShort(success.session.date, success.session.time))
    const amt = success.session.price
    const upiParams = (pa) => `pa=${encodeURIComponent(pa)}&pn=Dink%20Over%20Coffee&am=${amt}&cu=INR&tn=${tn}`

    const upiApps = [
      { name: 'Google Pay', scheme: (pa) => `tez://upi/pay?${upiParams(pa)}` },
      { name: 'PhonePe', scheme: (pa) => `phonepe://pay?${upiParams(pa)}` },
      { name: 'Paytm', scheme: (pa) => `paytm://upi/pay?${upiParams(pa)}` },
      { name: 'Other UPI', scheme: (pa) => `upi://pay?${upiParams(pa)}` },
    ]

    const currentAccount = accounts[qrIndex] || accounts[0]

    return (
      <div className="card text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-secondary/10 grid place-items-center text-secondary-dark text-2xl">✓</div>
        <h2 className="mt-3 text-text text-xl font-extrabold">You're in!</h2>
        <p className="mt-1 text-primary text-sm">
          {success.session.venue} · {fmtShort(success.session.date, success.session.time)}
        </p>
        {accounts.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-primary mb-3">Pay ₹{amt}</p>

            {accounts.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {accounts.map((acc, i) => (
                  <button
                    key={acc.id}
                    onClick={() => setQrIndex(i)}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${i === qrIndex ? 'border-primary bg-bg' : 'border-border-muted'}`}
                  >
                    <p className="text-xs font-semibold text-primary">{acc.label}</p>
                    <p className="text-[11px] text-muted mt-0.5">{acc.upi_id}</p>
                  </button>
                ))}
              </div>
            )}

            {currentAccount?.qr_image_url && (
              <div className="mb-4">
                <img src={currentAccount.qr_image_url} alt="UPI QR Code" className="mx-auto w-48 h-48 rounded-xl object-contain" />
              </div>
            )}

            <div className="rounded-xl border border-border-muted px-4 py-3 mb-3">
              <p className="text-xs text-muted">Pay to</p>
              <p className="text-sm font-semibold text-primary mt-0.5">{currentAccount?.label}</p>
              <p className="text-xs text-secondary mt-0.5">{currentAccount?.upi_id}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {upiApps.map(app => (
                <a
                  key={app.name}
                  href={app.scheme(currentAccount?.upi_id || '')}
                  className="rounded-2xl border border-border-muted px-3 py-2.5 text-xs font-medium text-primary active:bg-bg transition no-underline block text-center"
                >
                  {app.name}
                </a>
              ))}
            </div>
            <p className="text-[11px] text-secondary mt-3">Opens your UPI app with amount pre-filled</p>
          </div>
        )}
        <button className="text-sm text-secondary underline mt-4" onClick={() => { setSuccess(null); setQrIndex(0) }}>Book another</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Sessions */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-text font-bold md:text-lg">Upcoming sessions</h2>
          <button onClick={load} title="Refresh" className="w-8 h-8 flex items-center justify-center rounded-full text-secondary active:bg-bg transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {loading && <div className="card text-center text-secondary text-sm">Loading sessions…</div>}
          {!loading && sessions.length === 0 && (
            <div className="card text-center text-secondary text-sm">No sessions scheduled yet. Check back soon.</div>
          )}
          {!loading && sessions.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              selected={selected?.id === s.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </section>

      {/* Who's playing */}
      {selected && players.length > 0 && (
        <section className="card">
          <h2 className="text-text font-bold text-sm">Who's playing</h2>
          {loadingPlayers ? (
            <p className="text-xs text-secondary mt-2">Loading…</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {['Beginner', 'Intermediate', 'Advanced'].map(skill => {
                const group = players.filter(p => p.status !== 'waitlisted' && p.skill === skill)
                if (group.length === 0) return null
                const dotColor = skill === 'Beginner' ? 'bg-skill-beginner' : skill === 'Advanced' ? 'bg-skill-advanced' : 'bg-skill-intermediate'
                return (
                  <div key={skill}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      <span className="text-[10px] font-semibold text-secondary uppercase tracking-wide">{skill} ({group.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.map((p, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-interactive/10 px-2.5 py-1 text-xs font-medium text-secondary">
                          {p.name || 'Player'}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {players.filter(p => p.status === 'waitlisted').length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-border">
              <span className="text-[11px] font-semibold text-warning-muted uppercase">Waitlist</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {players.filter(p => p.status === 'waitlisted').map((p, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-muted">
                    {p.name || 'Player'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Registration form */}
      {selected && (
        <section ref={formRef} className="card">
          <h2 className="text-text font-bold">Your details</h2>
          <div className="mt-3 space-y-3">
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              <div>
                <label className="text-xs font-semibold text-primary">Name <span className="text-error">*</span></label>
                <input className="input mt-1" autoComplete="name" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Akhil K" required />
                {form.name.length > 0 && form.name.trim().length < 2 && (
                  <p className="text-[11px] text-error mt-1">Name must be at least 2 characters</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-primary">Phone <span className="text-error">*</span></label>
                <input className="input mt-1" autoComplete="tel" inputMode="numeric" value={form.phone} onChange={e => update('phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="98xxxxxxxx" maxLength={10} required />
                {form.phone.length > 0 && form.phone.length < 10 && (
                  <p className="text-[11px] text-error mt-1">Enter a valid 10-digit phone number</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-primary">Skill level</label>
              <div className={`grid gap-2 mt-1 ${skillLevels.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {skillLevels.map(s => {
                  const active = form.skill === s
                  const colors = s === 'Beginner'
                    ? active ? 'border-skill-beginner bg-skill-beginner text-inverse' : 'border-border-muted text-skill-beginner'
                    : s === 'Intermediate'
                    ? active ? 'border-skill-intermediate bg-skill-intermediate text-inverse' : 'border-border-muted text-skill-intermediate'
                    : active ? 'border-skill-advanced bg-skill-advanced text-inverse' : 'border-border-muted text-skill-advanced'
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update('skill', s)}
                      className={`rounded-2xl border px-2 py-2 text-xs sm:text-sm font-medium transition truncate ${colors}`}
                    >{s}</button>
                  )
                })}
              </div>
            </div>
          </div>

          {selected?.event_type === 'dupr' && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-primary">DUPR ID <span className="text-error">*</span></label>
              <input className="input mt-1" value={form.duprId} onChange={e => update('duprId', e.target.value)} placeholder="e.g. 123456789" required />
              {(form.duprId || '').length > 0 && form.duprId.trim().length < 3 && (
                <p className="text-[11px] text-error mt-1">Enter a valid DUPR ID</p>
              )}
            </div>
          )}

          {error && <div className="mt-3 text-sm text-error">{error}</div>}

          <button
            className="w-full mt-4 btn-primary"
            onClick={waitlistAvailable ? handleWaitlist : handlePay}
            disabled={submitting || (slotsFull && !waitlistAvailable) || !form.name.trim() || form.name.trim().length < 2 || form.phone.length !== 10 || (selected?.event_type === 'dupr' && form.duprId.trim().length < 3)}
          >
            {submitting ? 'Processing…' : slotsFull && !waitlistAvailable ? 'Full' : waitlistAvailable ? 'Join Waitlist' : PAYMENTS_ENABLED ? `Pay ₹${selected.price} & confirm` : 'Register'}
          </button>
          {waitlistAvailable && <p className="text-[11px] text-warning-muted mt-2 text-center">{isBeginner ? 'Beginner' : 'Non-beginner'} slots full. Join the waitlist — we'll add you if a spot opens.</p>}
          {slotsFull && !waitlistAvailable && <p className="text-[11px] text-error mt-2 text-center">No slots or waitlist available for your skill level.</p>}
          {!slotsFull && !waitlistAvailable && PAYMENTS_ENABLED && <p className="text-[11px] text-secondary mt-2 text-center">Slot held for 5 min while you pay.</p>}
        </section>
      )}

      {!selected && error && <div className="text-sm text-error">{error}</div>}
    </div>
  )
}
