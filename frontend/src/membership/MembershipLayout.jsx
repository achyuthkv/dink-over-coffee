import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import Login from './Login.jsx'
import Signup from './Signup.jsx'
import Dashboard from './Dashboard.jsx'

export default function MembershipLayout() {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadMember(sess) {
    if (!sess) { setMember(null); return }
    const { data } = await supabase.from('members').select('*').eq('user_id', sess.user.id).maybeSingle()
    setMember(data || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      await loadMember(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      await loadMember(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>
  if (!session) return <Login />
  if (!member || member.status !== 'active') return <Signup existingMember={member} onActivated={() => loadMember(session)} />
  return <Dashboard member={member} session={session} />
}
