import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { useAppLock } from '../lib/useAppLock.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import LockScreen from './LockScreen.jsx'

export default function AdminLayout() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // A referee login is a real Supabase session too, but /admin is
  // organizer-only -- everything a referee needs lives at /referee instead.
  // The role lives in the session's JWT (app_metadata, not user-editable),
  // so this is a plain read, no extra query needed.
  const isReferee = session?.user?.app_metadata?.role === 'referee'

  const { locked, unlock } = useAppLock({
    enabled: !!session && !isReferee,
    onForceSignOut: () => supabase.auth.signOut()
  })

  if (loading) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>
  if (!session) return <Login />
  if (isReferee) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm text-center space-y-3">
          <h1 className="text-primary font-bold text-lg">This login is for referees</h1>
          <p className="text-sm text-muted">Head to <a href="/referee" className="text-interactive font-semibold">/referee</a> to score your assigned matches.</p>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-secondary font-medium">Sign out</button>
        </div>
      </div>
    )
  }
  return (
    <>
      <Dashboard />
      {locked && <LockScreen onUnlock={unlock} />}
    </>
  )
}
