import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(error.message)
    else setDone(true)
    setLoading(false)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm text-center space-y-3">
          <h1 className="text-primary font-bold text-lg">Password updated</h1>
          <p className="text-sm text-muted">You can now sign in with your new password.</p>
          <a href="/admin" className="btn-primary inline-block w-full text-center">Go to login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm space-y-4">
        <h1 className="text-primary font-bold text-lg text-center">Set new password</h1>
        <div>
          <label className="text-xs font-semibold text-primary">New password</label>
          <input
            type="password" className="input mt-1" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-primary">Confirm password</label>
          <input
            type="password" className="input mt-1" value={confirm}
            onChange={e => setConfirm(e.target.value)} required minLength={6}
          />
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
