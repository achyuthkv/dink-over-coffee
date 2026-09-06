import { useEffect, useState } from 'react'
import { api, RAZORPAY_KEY_ID, PAYMENTS_ENABLED, SUPPORT_PHONE } from '../api.js'
import { loadRazorpay } from '../lib/loadRazorpay.js'

const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const TSHIRT_CHART = [
  { size: 'S', chest: 38, length: 26 },
  { size: 'M', chest: 40, length: 27 },
  { size: 'L', chest: 42, length: 28 },
  { size: 'XL', chest: 44, length: 29 },
  { size: 'XXL', chest: 46, length: 30 },
  { size: 'XXXL', chest: 48, length: 31 }
]

function TshirtSizeChart({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-primary font-bold text-sm">T-shirt size chart</h4>
          <button onClick={onClose} className="text-muted text-sm">Close</button>
        </div>
        <p className="text-2xs text-muted mb-2">All measurements in inches.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center border-collapse">
            <thead>
              <tr className="text-secondary">
                <th className="py-1.5 text-left font-semibold">Size</th>
                {TSHIRT_CHART.map(row => <th key={row.size} className="py-1.5 font-semibold">{row.size}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="py-1.5 text-left text-secondary">Chest</td>
                {TSHIRT_CHART.map(row => <td key={row.size} className="py-1.5 text-primary">{row.chest}</td>)}
              </tr>
              <tr className="border-t border-border">
                <td className="py-1.5 text-left text-secondary">Length</td>
                {TSHIRT_CHART.map(row => <td key={row.size} className="py-1.5 text-primary">{row.length}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TshirtSizeSelect({ label, value, onChange, onShowChart }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xs text-muted">{label}</span>
        <button type="button" onClick={onShowChart} className="text-2xs font-semibold text-interactive">Size chart</button>
      </div>
      <select className="input" value={value} onChange={e => onChange(e.target.value)} required>
        <option value="" disabled>Select size</option>
        {TSHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}

function effectiveFee(category) {
  if (category.early_bird_fee !== null && category.early_bird_fee !== undefined && category.early_bird_deadline) {
    const deadline = new Date(`${category.early_bird_deadline}T23:59:59`)
    if (new Date() <= deadline) return Number(category.early_bird_fee)
  }
  return Number(category.entry_fee) || 0
}

export default function TournamentRegisterForm({ category, onDone, onCancel }) {
  const [form, setForm] = useState({
    player1Name: '', player1Phone: '', player1DuprId: '', player1TshirtSize: '',
    player2Name: '', player2Phone: '', player2DuprId: '', player2TshirtSize: '', email: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [showSizeChart, setShowSizeChart] = useState(false)

  const fee = effectiveFee(category)
  const isEarlyBird = fee !== Number(category.entry_fee)

  useEffect(() => { if (PAYMENTS_ENABLED && fee > 0) loadRazorpay() }, [fee])

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!form.player1Name.trim() || !/^[0-9]{10}$/.test(form.player1Phone.trim())) {
      setError('Enter a name and a valid 10-digit phone number'); return
    }
    if (!form.player1DuprId.trim() || form.player1DuprId.trim().length < 3) {
      setError('Enter a valid DUPR ID'); return
    }
    if (!form.player1TshirtSize) { setError('Select a T-shirt size'); return }
    if (category.team_size === 2) {
      if (!form.player2Name.trim()) { setError("Enter your partner's name"); return }
      if (!/^[0-9]{10}$/.test(form.player2Phone.trim())) { setError("Enter your partner's 10-digit phone number"); return }
      if (!form.player2DuprId.trim() || form.player2DuprId.trim().length < 3) {
        setError("Enter your partner's DUPR ID"); return
      }
      if (!form.player2TshirtSize) { setError("Select your partner's T-shirt size"); return }
    }
    setSubmitting(true)
    const team = {
      player1Name: form.player1Name.trim(),
      player1Phone: form.player1Phone.trim(),
      player1DuprId: form.player1DuprId.trim(),
      player1TshirtSize: form.player1TshirtSize,
      player2Name: category.team_size === 2 ? form.player2Name.trim() : undefined,
      player2Phone: category.team_size === 2 ? form.player2Phone.trim() : undefined,
      player2DuprId: category.team_size === 2 ? form.player2DuprId.trim() : undefined,
      player2TshirtSize: category.team_size === 2 ? form.player2TshirtSize : undefined,
      email: form.email.trim() || undefined
    }

    try {
      if (!PAYMENTS_ENABLED || fee === 0) {
        const res = await api.tournamentRegister(category.id, team)
        if (res.alreadyRegistered) { setError('This phone number is already registered for this category.'); setSubmitting(false); return }
        setResult(res)
        onDone?.()
        return
      }
      const order = await api.tournamentCreateOrder(category.id, team)
      if (order.alreadyRegistered) { setError('This phone number is already registered for this category.'); setSubmitting(false); return }
      await openCheckout(order, team)
    } catch (e) {
      setError(e.message || 'Registration failed')
      setSubmitting(false)
    }
  }

  async function openCheckout(order, team) {
    try { await loadRazorpay() } catch {
      setError('Razorpay failed to load. Check your network.')
      setSubmitting(false)
      return
    }
    const rzp = new window.Razorpay({
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency || 'INR',
      order_id: order.orderId,
      name: 'Dink Over Coffee',
      description: `${category.name} entry`,
      prefill: { name: team.player1Name, contact: team.player1Phone },
      theme: { color: '#05AD86' },
      modal: { ondismiss: () => setSubmitting(false) },
      handler: async (resp) => {
        try {
          await api.tournamentConfirmPayment({
            holdId: order.holdId,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature
          })
          setResult({ status: 'confirmed', paymentStatus: 'paid' })
          onDone?.()
        } catch (e) {
          setError(e.message || 'Payment confirmation failed')
        } finally {
          setSubmitting(false)
        }
      }
    })
    rzp.on('payment.failed', () => { setError('Payment failed — please try again.'); setSubmitting(false) })
    rzp.open()
  }

  if (result) {
    const pendingPayment = result.paymentStatus === 'pending'
    return (
      <div className="card text-center space-y-2">
        <p className="text-2xl">{pendingPayment ? '💳' : '🎉'}</p>
        <p className="text-primary font-bold">
          {result.status === 'waitlisted' ? "You're on the waitlist" : pendingPayment ? 'Registration received' : 'Registered!'}
        </p>
        {result.status === 'waitlisted' && <p className="text-secondary text-sm">This category is full — we'll confirm you if a spot opens up.</p>}
        {pendingPayment && (
          <div className="text-left text-sm text-secondary mt-2 space-y-1">
            <p className="font-semibold text-primary">Pay ₹{result.amount} to confirm your spot.</p>
            {result.upiAccounts?.length > 0 ? (
              <>
                <p>Pay via UPI to:</p>
                {result.upiAccounts.map(u => <p key={u.id}>{u.label}: {u.upi_id}</p>)}
              </>
            ) : (
              <p>{SUPPORT_PHONE ? `We'll reach out to confirm payment — or call/WhatsApp ${SUPPORT_PHONE}.` : "We'll reach out shortly to confirm payment."}</p>
            )}
          </div>
        )}
        {SUPPORT_PHONE && (
          <p className="text-2xs text-muted mt-2">Questions? Call or WhatsApp <a href={`tel:${SUPPORT_PHONE}`} className="text-interactive font-medium">{SUPPORT_PHONE}</a>.</p>
        )}
        <button onClick={onCancel} className="btn-ghost mt-3">Done</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-primary font-bold">{category.name}</h3>
        <button type="button" onClick={onCancel} className="text-muted text-sm">Cancel</button>
      </div>
      {fee > 0 && (
        <p className="text-sm text-secondary">
          Entry fee: <span className="font-semibold text-primary">₹{fee}</span>
          {isEarlyBird && <span className="text-2xs text-success ml-1">(early bird)</span>}
        </p>
      )}
      <input className="input" placeholder={category.team_size === 2 ? 'Your name' : 'Name'} value={form.player1Name} onChange={e => set('player1Name', e.target.value)} required />
      <input className="input" placeholder="Phone (10 digits)" inputMode="numeric" value={form.player1Phone} onChange={e => set('player1Phone', e.target.value)} required />
      <input className="input" placeholder="Your DUPR ID" value={form.player1DuprId} onChange={e => set('player1DuprId', e.target.value)} required />
      <TshirtSizeSelect label={category.team_size === 2 ? 'Your T-shirt size' : 'T-shirt size'} value={form.player1TshirtSize} onChange={v => set('player1TshirtSize', v)} onShowChart={() => setShowSizeChart(true)} />
      {category.team_size === 2 && (
        <>
          <input className="input" placeholder="Partner's name" value={form.player2Name} onChange={e => set('player2Name', e.target.value)} required />
          <input className="input" placeholder="Partner's phone (10 digits)" inputMode="numeric" value={form.player2Phone} onChange={e => set('player2Phone', e.target.value)} required />
          <input className="input" placeholder="Partner's DUPR ID" value={form.player2DuprId} onChange={e => set('player2DuprId', e.target.value)} required />
          <TshirtSizeSelect label="Partner's T-shirt size" value={form.player2TshirtSize} onChange={v => set('player2TshirtSize', v)} onShowChart={() => setShowSizeChart(true)} />
        </>
      )}
      <input className="input" type="email" placeholder="Email (optional)" value={form.email} onChange={e => set('email', e.target.value)} />
      {error && <p className="text-error text-sm">{error}</p>}
      {SUPPORT_PHONE && (
        <p className="text-2xs text-muted">
          Facing issues registering? Call or WhatsApp <a href={`tel:${SUPPORT_PHONE}`} className="text-interactive font-medium">{SUPPORT_PHONE}</a>.
        </p>
      )}
      {showSizeChart && <TshirtSizeChart onClose={() => setShowSizeChart(false)} />}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Processing…' : (PAYMENTS_ENABLED && fee > 0) ? `Pay ₹${fee} & register` : 'Register'}
      </button>
    </form>
  )
}
