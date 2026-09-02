import { useState } from 'react'
import { supabase } from '../supabase.js'
import { api, RAZORPAY_KEY_ID, PAYMENTS_ENABLED } from '../api.js'
import { loadRazorpay } from '../lib/loadRazorpay.js'

const PLANS = [
  { id: 'monthly', label: 'Monthly', price: 1500 },
  { id: 'quarterly', label: 'Quarterly', price: 4000 },
  { id: 'annual', label: 'Annual', price: 14000 }
]

const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export default function Signup({ existingMember, onActivated }) {
  const [form, setForm] = useState({
    name: existingMember?.name || '',
    email: existingMember?.email || '',
    duprId: existingMember?.dupr_id || '',
    tshirtSize: existingMember?.tshirt_size || 'M',
    plan: existingMember?.plan || 'monthly',
    whatsappOptIn: existingMember?.whatsapp_opt_in !== false
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) { setError('Enter your name'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Enter a valid email address'); return }
    setError(null); setSubmitting(true)
    try {
      const token = await getToken()

      if (!PAYMENTS_ENABLED) {
        await api.membershipSignupFree(form, token)
        onActivated()
        setSubmitting(false)
        return
      }

      const order = await api.membershipCreateOrder(form, token)
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
        name: 'Dink Over Coffee — Membership',
        description: `${form.plan} membership`,
        prefill: { name: form.name, email: form.email },
        theme: { color: '#05AD86' },
        modal: { ondismiss: () => setSubmitting(false) },
        handler: async (resp) => {
          try {
            await api.membershipConfirmPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature
            }, token)
            onActivated()
          } catch (e) {
            setError(e.message || 'Payment confirmation failed')
          } finally {
            setSubmitting(false)
          }
        }
      })
      rzp.on('payment.failed', () => { setError('Payment failed. Please try again.'); setSubmitting(false) })
      rzp.open()
    } catch (e) {
      setError(e.message || 'Could not start signup')
      setSubmitting(false)
    }
  }

  const selectedPlan = PLANS.find(p => p.id === form.plan)

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm space-y-4">
        <h1 className="text-primary font-bold text-lg text-center">Become a member</h1>

        <div>
          <label className="text-xs font-semibold text-primary">Name</label>
          <input className="input mt-1" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">Email</label>
          <input type="email" className="input mt-1" value={form.email} onChange={e => set('email', e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">DUPR ID (optional)</label>
          <input className="input mt-1" value={form.duprId} onChange={e => set('duprId', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">T-shirt size</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {TSHIRT_SIZES.map(size => (
              <button type="button" key={size} onClick={() => set('tshirtSize', size)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${form.tshirtSize === size ? 'bg-interactive text-inverse border-interactive' : 'border-border text-secondary'}`}>
                {size}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">Plan</label>
          <div className="space-y-2 mt-1">
            {PLANS.map(p => (
              <button type="button" key={p.id} onClick={() => set('plan', p.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border text-sm transition ${form.plan === p.id ? 'bg-interactive/10 border-interactive text-primary' : 'border-border text-secondary'}`}>
                <span>{p.label}</span>
                <span className="font-semibold">₹{p.price}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-secondary">
          <input type="checkbox" checked={form.whatsappOptIn} onChange={e => set('whatsappOptIn', e.target.checked)} />
          Send me session reminders and updates on WhatsApp
        </label>

        {error && <p className="text-xs text-error">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Processing…' : PAYMENTS_ENABLED ? `Pay ₹${selectedPlan.price} & join` : 'Join'}
        </button>
      </form>
    </div>
  )
}
