import { useEffect, useState } from 'react'
import { isBiometricAvailable, isBiometricEnabled, registerBiometric, disableBiometric } from '../lib/webauthnLock.js'
import { supabase } from '../supabase.js'

export default function Security({ onBack }) {
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(isBiometricEnabled())
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    isBiometricAvailable().then(setAvailable)
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email || ''))
  }, [])

  async function handleEnable() {
    setError(null); setLoading(true)
    try {
      await registerBiometric(email)
      setEnabled(true)
    } catch (e) {
      setError(e.message || 'Could not set up biometric unlock on this device')
    } finally {
      setLoading(false)
    }
  }

  function handleDisable() {
    disableBiometric()
    setEnabled(false)
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Security</h1>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-primary">Auto-lock</p>
          <p className="text-xs text-muted mt-1.5 leading-relaxed">
            This admin area locks itself after 10 minutes of inactivity, or immediately if you return after being away from the app for 2+ minutes. You'll need to unlock it to continue — your session stays signed in, this just re-verifies it's you.
          </p>
        </div>

        <div className="card p-5 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">Biometric unlock</p>
            <span className={`text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${enabled ? 'text-success bg-brand-100' : 'text-muted bg-bg'}`}>
              {enabled ? 'On' : 'Off'}
            </span>
          </div>

          {!available && (
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Face ID / Touch ID / device biometrics aren't available on this browser or device. You can still unlock with your password.
            </p>
          )}

          {available && !enabled && (
            <>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Use Face ID, Touch ID, or your device's biometric unlock instead of typing your password every time this locks. This is set up per device — you'll need to enable it again if you sign in elsewhere.
              </p>
              {error && <p className="text-xs text-error mt-2">{error}</p>}
              <button onClick={handleEnable} disabled={loading} className="btn-primary w-full mt-3">
                {loading ? 'Setting up…' : 'Enable biometric unlock'}
              </button>
            </>
          )}

          {available && enabled && (
            <>
              <p className="text-xs text-muted mt-2 leading-relaxed">Enabled for this device. Password unlock is always available as a fallback.</p>
              <button onClick={handleDisable} className="w-full mt-3 text-sm font-medium text-tertiary px-3 py-2.5 rounded-full border border-tertiary/20 active:bg-error-subtle transition">
                Turn off biometric unlock
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
