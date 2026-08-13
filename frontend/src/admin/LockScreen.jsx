import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { isBiometricEnabled, isBiometricAvailable, verifyBiometric } from '../lib/webauthnLock.js'
import Logo from '../components/Logo.jsx'

export default function LockScreen({ onUnlock }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [biometricReady, setBiometricReady] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ''))
    ;(async () => {
      const available = isBiometricEnabled() && await isBiometricAvailable()
      setBiometricReady(available)
      if (!available) setShowPasswordForm(true)
    })()
  }, [])

  async function handleBiometric() {
    setError(null); setLoading(true)
    try {
      await verifyBiometric()
      onUnlock()
    } catch {
      setError('Biometric unlock failed or was cancelled')
    } finally {
      setLoading(false)
    }
  }

  async function handlePassword(e) {
    e.preventDefault()
    setError(null); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onUnlock()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-lg space-y-4 text-center">
        <Logo className="h-12 w-auto mx-auto" />
        <div>
          <h1 className="text-primary font-bold text-lg">Session locked</h1>
          <p className="text-sm text-muted mt-1">{email ? `Signed in as ${email}` : 'Verify it’s you to continue'}</p>
        </div>

        {biometricReady && !showPasswordForm && (
          <div className="space-y-3">
            <button onClick={handleBiometric} disabled={loading} className="btn-primary w-full">
              {loading ? 'Verifying…' : 'Unlock with Face ID / Touch ID'}
            </button>
            {error && <p className="text-xs text-error">{error}</p>}
            <button type="button" onClick={() => { setShowPasswordForm(true); setError(null) }} className="w-full text-center text-xs text-muted">
              Use password instead
            </button>
          </div>
        )}

        {showPasswordForm && (
          <form onSubmit={handlePassword} className="space-y-3 text-left">
            <div>
              <label className="text-xs font-semibold text-primary">Email</label>
              <input type="email" className="input mt-1" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-primary">Password</label>
              <input type="password" className="input mt-1" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Unlocking…' : 'Unlock'}
            </button>
            {biometricReady && (
              <button type="button" onClick={() => { setShowPasswordForm(false); setError(null) }} className="w-full text-center text-xs text-muted">
                Use Face ID / Touch ID instead
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
