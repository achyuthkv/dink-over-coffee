import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { api } from '../api.js'
import Login from './Login.jsx'
import Signup from './Signup.jsx'
import Dashboard from './Dashboard.jsx'
import Interest from './Interest.jsx'

export default function MembershipLayout() {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadMember(sess) {
    if (!sess) { setMember(null); return }
    try {
      const res = await api.membershipWhoami(sess.access_token)
      setMember(res.member || null)
    } catch {
      setMember(null)
    }
  }

  async function loadAvailability() {
    try {
      setAvailability(await api.membershipAvailability())
    } catch {
      // The server-side signup actions re-check capacity regardless, so
      // failing open here only affects which screen is shown first, not
      // whether an over-capacity signup can actually go through.
      setAvailability({ open: true })
    }
  }

  useEffect(() => {
    let mounted = true
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(session)
      await Promise.all([loadMember(session), loadAvailability()])
      if (mounted) setLoading(false)
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      await loadMember(session)
    })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  if (loading) return <div className="min-h-screen bg-pattern flex items-center justify-center text-primary">Loading…</div>

  // Already an active member -- always let them in regardless of capacity.
  if (member?.status === 'active') return <Dashboard member={member} session={session} />

  // Has a member row (pending_payment/expired/cancelled) -- resume the flow
  // they already started, or let them renew, regardless of capacity.
  if (member) return <Signup existingMember={member} onActivated={() => loadMember(session)} />

  // Brand new, no member row yet -- gate on capacity before anything else.
  if (availability && !availability.open) {
    const prefillPhone = session?.user?.phone?.replace(/\D/g, '').slice(-10) || ''
    return <Interest prefillPhone={prefillPhone} />
  }

  if (!session) return <Login />
  return <Signup existingMember={null} onActivated={() => loadMember(session)} />
}
