import { useState } from 'react'
import { supabase } from '../supabase.js'
import Logo from '../components/Logo.jsx'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [stage, setStage] = useState('phone') // phone | otp
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function sendOtp(e) {
    e.preventDefault()
    const trimmed = phone.trim()
    if (!/^[0-9]{10}$/.test(trimmed)) { setError('Enter a valid 10-digit phone number'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${trimmed}`, options: { channel: 'whatsapp' } })
    if (error) setError(error.message)
    else setStage('otp')
    setLoading(false)
  }

  async function verifyOtp(e) {
    e.preventDefault()
    if (!/^[0-9]{4,8}$/.test(otp.trim())) { setError('Enter the code from WhatsApp'); return }
    setLoading(true); setError(null)
    // Supabase always verifies phone OTPs with type 'sms' regardless of which
    // channel (sms/whatsapp) delivered the code.
    const { error } = await supabase.auth.verifyOtp({ phone: `+91${phone.trim()}`, token: otp.trim(), type: 'sms' })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
      <form onSubmit={stage === 'phone' ? sendOtp : verifyOtp} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex justify-center"><Logo className="h-12 w-auto" /></div>
        <h1 className="text-primary font-bold text-lg text-center">Membership</h1>
        <p className="text-xs text-muted text-center">Sign in with the WhatsApp number you'll use for the club.</p>
        {stage === 'phone' ? (
          <div>
            <label className="text-xs font-semibold text-primary">WhatsApp number</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted">+91</span>
              <input type="tel" inputMode="numeric" maxLength={10} className="input" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} required />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-primary">Code sent on WhatsApp</label>
            <input type="text" inputMode="numeric" className="input mt-1" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required autoFocus />
          </div>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Processing…' : stage === 'phone' ? 'Send code on WhatsApp' : 'Verify & continue'}
        </button>
        {stage === 'otp' && (
          <button type="button" onClick={() => { setStage('phone'); setOtp(''); setError(null) }} className="w-full text-center text-xs text-muted">
            Use a different number
          </button>
        )}
      </form>
    </div>
  )
}
