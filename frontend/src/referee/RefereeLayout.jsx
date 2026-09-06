import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import RefereeLogin from './RefereeLogin.jsx'
import RefereeApp from './RefereeApp.jsx'

export default function RefereeLayout() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // undefined = not fetched yet; null = fetched, no profiles row (a
  // pre-role organizer account, since a referee always gets a row at
  // creation time); an object = fetched, has a row.
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(undefined); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data ?? null))
  }, [session])

  if (loading) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>
  if (!session) return <RefereeLogin />
  if (profile === undefined) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>

  if (!profile || profile.role !== 'referee') {
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

  return <RefereeApp userId={session.user.id} name={profile.name} />
}
