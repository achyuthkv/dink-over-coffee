import { useState } from 'react'
import { api } from '../api.js'
import Logo from '../components/Logo.jsx'

export default function Interest({ prefillPhone }) {
  const [form, setForm] = useState({ name: '', phone: prefillPhone || '', email: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || form.name.trim().length < 2) { setError('Enter your name'); return }
    if (!/^[0-9]{10}$/.test(form.phone.trim())) { setError('Enter a valid 10-digit phone number'); return }
    setError(null); setSubmitting(true)
    try {
      await api.membershipWaitlistInterest({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() })
      setDone(true)
    } catch (e) {
      setError(e.message || 'Could not save your details')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm text-center space-y-3">
          <div className="flex justify-center"><Logo className="h-12 w-auto" /></div>
          <h1 className="text-primary font-bold text-lg">You're on the list!</h1>
          <p className="text-sm text-muted">We'll message you on WhatsApp the moment a membership slot opens up.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex justify-center"><Logo className="h-12 w-auto" /></div>
        <h1 className="text-primary font-bold text-lg text-center">Memberships are full right now</h1>
        <p className="text-xs text-muted text-center">We're not taking new members at the moment — leave your details and we'll notify you on WhatsApp when a spot opens up.</p>
        <div>
          <label className="text-xs font-semibold text-primary">Name</label>
          <input className="input mt-1" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">WhatsApp number</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted">+91</span>
            <input type="tel" inputMode="numeric" maxLength={10} className="input" value={form.phone}
              onChange={e => set('phone', e.target.value.replace(/\D/g, ''))} required disabled={!!prefillPhone} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">Email (optional)</label>
          <input type="email" className="input mt-1" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Saving…' : 'Notify me'}
        </button>
      </form>
    </div>
  )
}
