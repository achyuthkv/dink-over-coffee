import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import RefereeLogin from './RefereeLogin.jsx'
import RefereeApp from './RefereeApp.jsx'

export default function RefereeLayout() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>
  if (!session) return <RefereeLogin />

  // Role lives in the session's JWT (app_metadata, not user-editable) --
  // the same claim every RLS policy checks -- so this is a plain read, no
  // extra query needed.
  if (session.user.app_metadata?.role !== 'referee') {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-5">
        <div className="w-full max-w-sm bg-surface rounded-3xl p-6 shadow-sm text-center space-y-3">
          <h1 className="text-primary font-bold text-lg">This login is for referees</h1>
          <p className="text-sm text-muted">Head to <a href="/admin" className="text-interactive font-semibold">/admin</a> to manage the tournament.</p>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-secondary font-medium">Sign out</button>
        </div>
      </div>
    )
  }

  return <RefereeApp userId={session.user.id} name={session.user.user_metadata?.name} />
}
