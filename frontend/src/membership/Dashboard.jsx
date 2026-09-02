import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { api } from '../api.js'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return String(d)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}

export default function Dashboard({ member, session }) {
  const [balance, setBalance] = useState(0)
  const [directory, setDirectory] = useState([])
  const [loadingDirectory, setLoadingDirectory] = useState(true)
  const [sessions, setSessions] = useState([])
  const [myReservations, setMyReservations] = useState(new Set())
  const [redeeming, setRedeeming] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  async function loadCredits() {
    const { data } = await supabase.from('membership_credits').select('delta').eq('member_id', member.id)
    setBalance((data || []).reduce((s, r) => s + r.delta, 0))
  }

  async function loadReservations() {
    const { data } = await supabase.from('players').select('session_id, status').eq('member_id', member.id).eq('status', 'confirmed')
    setMyReservations(new Set((data || []).map(r => r.session_id)))
  }

  useEffect(() => {
    loadCredits()
    loadReservations()
    api.membershipDirectory(session.access_token)
      .then(res => setDirectory(res.members))
      .catch(e => setError(e.message))
      .finally(() => setLoadingDirectory(false))
    api.listSessions().then(res => setSessions(res.sessions || [])).catch(() => {})
  }, [member.id])

  async function redeemCredit(sessionId) {
    setRedeeming(sessionId); setError(null); setNotice(null)
    try {
      await api.membershipRedeemCredit(sessionId, session.access_token)
      setNotice('Reserved! See you there.')
      await Promise.all([loadCredits(), loadReservations()])
    } catch (e) {
      setError(e.message || 'Could not redeem credit')
    } finally {
      setRedeeming(null)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = sessions.filter(s => s.date >= today && !myReservations.has(s.id)).slice(0, 8)

  return (
    <div className="min-h-screen bg-pattern p-5">
      <div className="max-w-sm mx-auto space-y-5 pb-10">
        <div className="flex items-center justify-between pt-2">
          <h1 className="text-primary font-bold text-lg">Membership</h1>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-muted">Sign out</button>
        </div>

        <div className="bg-interactive rounded-3xl p-5 text-inverse shadow-sm">
          <p className="text-2xs uppercase tracking-wide opacity-80">Dink Over Coffee</p>
          <p className="text-xl font-bold mt-1">{member.name}</p>
          <p className="text-sm opacity-90 mt-1 capitalize">{member.plan} membership</p>
          <div className="flex items-center justify-between mt-4 text-xs opacity-90">
            <span>Valid until {fmtDate(member.end_date)}</span>
            <span>{balance} rollover credit{balance === 1 ? '' : 's'}</span>
          </div>
        </div>

        {balance > 0 && (
          <div className="bg-surface rounded-3xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-primary mb-1">Redeem a rollover credit</h2>
            <p className="text-2xs text-muted mb-3">Use a banked credit to grab an extra session.</p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted">No upcoming sessions open right now.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map(s => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-primary">{fmtDate(s.date)} · {s.time}</span>
                    <button
                      onClick={() => redeemCredit(s.id)}
                      disabled={redeeming === s.id}
                      className="text-xs font-semibold text-interactive disabled:opacity-50"
                    >
                      {redeeming === s.id ? 'Reserving…' : 'Use 1 credit'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="bg-surface rounded-3xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-primary mb-3">Members</h2>
          {loadingDirectory ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : directory.length === 0 ? (
            <p className="text-xs text-muted">No other active members yet.</p>
          ) : (
            <ul className="space-y-2">
              {directory.map((m, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-primary">{m.name}</span>
                  <span className="text-2xs text-muted capitalize">{m.plan}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {notice && <p className="text-xs text-success">{notice}</p>}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    </div>
  )
}
