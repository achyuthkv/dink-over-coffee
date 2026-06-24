import { useEffect, useState } from 'react'
import { api, RAZORPAY_KEY_ID, PAYMENTS_ENABLED } from '../api.js'
import SessionCard from './SessionCard.jsx'

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
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
  const [form, setForm] = useState({ name: '', phone: '', skill: 'Beginner' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [waitlistSuccess, setWaitlistSuccess] = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const { sessions } = await api.listSessions()
      setSessions(sessions)
    } catch (e) {
      setError(e.message || 'Could not load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function validate() {
    if (!selected) return 'Pick a session first'
    if (!form.name.trim() || form.name.trim().length < 2) return 'Enter your name'
    if (!/^[0-9+\-\s]{10,15}$/.test(form.phone.trim())) return 'Enter a valid phone number'
    return null
  }

  const isSessionFull = selected && Number(selected.takenSlots || 0) >= Number(selected.maxSlots || 0)
  const waitlistAvailable = isSessionFull && Number(selected?.waitlistMax || 0) > 0 && Number(selected?.waitlistCount || 0) < Number(selected?.waitlistMax || 0)

  async function handleWaitlist() {
    const v = validate()
    if (v) { setError(v); return }
    setError(null); setSubmitting(true)
    try {
      const player = { name: form.name.trim(), phone: form.phone.trim(), skill: form.skill }
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
      setForm({ name: '', phone: '', skill: 'Beginner' })
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
        skill: form.skill
      }

      if (!PAYMENTS_ENABLED) {
        const res = await api.registerFree(selected.id, player)
        if (res.alreadyRegistered) {
          setError('You are already registered for this session.')
          setSubmitting(false)
          return
        }
        setSuccess({ session: selected, player })
        setForm({ name: '', phone: '', skill: 'Beginner' })
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
        theme: { color: '#4a2e16' },
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
            setForm({ name: '', phone: '', skill: 'Beginner' })
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
        <div className="mx-auto h-14 w-14 rounded-full bg-amber-100 grid place-items-center text-amber-700 text-2xl">⏳</div>
        <h2 className="mt-3 text-coffee-900 text-xl font-extrabold">You're on the waitlist!</h2>
        <p className="mt-1 text-coffee-700 text-sm">
          Position #{waitlistSuccess.position} · {waitlistSuccess.session.venue} · {fmtShort(waitlistSuccess.session.date, waitlistSuccess.session.time)}
        </p>
        <p className="mt-2 text-coffee-600 text-xs">We'll promote you if a slot opens up.</p>
        <button className="btn-primary w-full mt-5" onClick={() => setWaitlistSuccess(null)}>Back</button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="card text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-court-500/10 grid place-items-center text-court-600 text-2xl">✓</div>
        <h2 className="mt-3 text-coffee-900 text-xl font-extrabold">You're in!</h2>
        <p className="mt-1 text-coffee-700 text-sm">
          {success.session.venue} · {fmtShort(success.session.date, success.session.time)}
        </p>
        <button className="btn-primary w-full mt-5" onClick={() => setSuccess(null)}>Book another</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-coffee-900 font-bold">Upcoming sessions</h2>
          <button onClick={load} className="text-xs text-coffee-600 underline">Refresh</button>
        </div>
        <div className="mt-3 space-y-3">
          {loading && <div className="card text-center text-coffee-600 text-sm">Loading sessions…</div>}
          {!loading && sessions.length === 0 && (
            <div className="card text-center text-coffee-600 text-sm">No sessions scheduled yet. Check back soon.</div>
          )}
          {!loading && sessions.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              selected={selected?.id === s.id}
              onSelect={setSelected}
            />
          ))}
        </div>
      </section>

      {selected && (
        <section className="card">
          <h2 className="text-coffee-900 font-bold">Your details</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-semibold text-coffee-700">Name <span className="text-red-500">*</span></label>
              <input className="input mt-1" autoComplete="name" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Akhil K" required />
              {form.name.length > 0 && form.name.trim().length < 2 && (
                <p className="text-[11px] text-red-500 mt-1">Name must be at least 2 characters</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-coffee-700">Phone <span className="text-red-500">*</span></label>
              <input className="input mt-1" autoComplete="tel" inputMode="tel" value={form.phone} onChange={e => update('phone', e.target.value.replace(/[^0-9+\-\s]/g, ''))} placeholder="98xxxxxxxx" maxLength={15} required />
              {form.phone.length > 0 && !/^[0-9+\-\s]{10,15}$/.test(form.phone.trim()) && (
                <p className="text-[11px] text-red-500 mt-1">Enter a valid 10-digit phone number</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-coffee-700">Skill level</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {SKILL_LEVELS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('skill', s)}
                    className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${form.skill === s ? 'border-coffee-800 bg-coffee-800 text-coffee-50' : 'border-coffee-200 text-coffee-800 active:bg-coffee-100'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

          <button
            className={`w-full mt-4 ${waitlistAvailable ? 'btn-primary !bg-amber-600' : 'btn-primary'}`}
            onClick={waitlistAvailable ? handleWaitlist : handlePay}
            disabled={submitting || !form.name.trim() || form.name.trim().length < 2 || !/^[0-9+\-\s]{10,15}$/.test(form.phone.trim())}
          >
            {submitting ? 'Processing…' : waitlistAvailable ? 'Join Waitlist' : PAYMENTS_ENABLED ? `Pay ₹${selected.price} & confirm` : 'Register'}
          </button>
          {waitlistAvailable && <p className="text-[11px] text-amber-700 mt-2 text-center">Session is full. Join the waitlist — we'll add you if a spot opens.</p>}
          {!waitlistAvailable && PAYMENTS_ENABLED && <p className="text-[11px] text-coffee-600 mt-2 text-center">Slot held for 5 min while you pay.</p>}
        </section>
      )}

      {!selected && error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}
