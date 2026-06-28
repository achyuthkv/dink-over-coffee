import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'

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

  if (loading) return <div className="min-h-screen bg-[#F6F1E7] bg-[url('/bg-pattern.svg')] bg-[length:360px_360px] bg-repeat flex items-center justify-center text-[#2B1F17]">Loading…</div>
  if (!session) return <Login />
  return <Dashboard />
}
