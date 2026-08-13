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

  const { locked, unlock } = useAppLock({
    enabled: !!session,
    onForceSignOut: () => supabase.auth.signOut()
  })

  if (loading) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>
  if (!session) return <Login />
  return (
    <>
      <Dashboard />
      {locked && <LockScreen onUnlock={unlock} />}
    </>
  )
}
