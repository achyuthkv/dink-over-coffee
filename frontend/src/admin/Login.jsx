import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your email'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin/reset`
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setLoading(false)
  }

  if (resetSent) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm text-center space-y-3">
          <h1 className="text-primary font-bold text-lg">Check your email</h1>
          <p className="text-sm text-muted">We sent a reset link to <strong>{email}</strong></p>
          <button onClick={() => { setResetSent(false); setResetMode(false) }} className="text-sm text-secondary font-medium">Back to login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
      <form onSubmit={resetMode ? handleReset : handleLogin} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm space-y-4">
        <h1 className="text-primary font-bold text-lg text-center">{resetMode ? 'Reset password' : 'DOC Admin'}</h1>
        <div>
          <label className="text-xs font-semibold text-primary">Email</label>
          <input
            type="email" className="input mt-1" value={email}
            onChange={e => setEmail(e.target.value)} required
          />
        </div>
        {!resetMode && (
          <div>
            <label className="text-xs font-semibold text-primary">Password</label>
            <input
              type="password" className="input mt-1" value={password}
              onChange={e => setPassword(e.target.value)} required
            />
          </div>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Processing…' : resetMode ? 'Send reset link' : 'Sign in'}
        </button>
        <button type="button" onClick={() => { setResetMode(!resetMode); setError(null) }} className="w-full text-center text-xs text-muted">
          {resetMode ? 'Back to login' : 'Forgot password?'}
        </button>
      </form>
    </div>
  )
}
