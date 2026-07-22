import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import ThemeToggle from './ThemeToggle.jsx'
import Logo from './Logo.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}

function fmtDateLong(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`
}

export default function Recap() {
  const { sessionId } = useParams()
  const [recap, setRecap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    api.getRecap(sessionId)
      .then(res => setRecap(res.recap))
      .catch(e => setError(e.message || 'Could not load recap'))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted text-sm">Loading recap...</p>
      </div>
    )
  }

  if (error || !recap) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted text-sm">{error || 'Recap not found'}</p>
        <Link to="/events" className="text-interactive text-sm font-medium hover:underline">Browse sessions</Link>
      </div>
    )
  }

  const { session, stats, players, nextSession } = recap
  const shareText = `${stats.totalPlayers} players hit the courts at ${session.venue} this ${DAYS[new Date(session.date + 'T00:00:00').getDay()]}! ${stats.firstTimers > 0 ? `${stats.firstTimers} first-timer${stats.firstTimers > 1 ? 's' : ''} joined us.` : ''} Check it out:`
  const shareUrl = `${window.location.origin}/r/${sessionId}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-5 sm:px-6 md:px-8">
        <header className="pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between pt-5 pb-4">
            <Link to="/" className="flex items-center gap-2.5">
              <Logo className="h-12 w-auto" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-6">
          {/* Header */}
          <div>
            <p className="text-muted text-[10px] uppercase tracking-[0.3em] font-medium">Session Recap</p>
            <h1 className="text-primary text-2xl md:text-3xl font-extrabold mt-2">
              {session.title || session.venue}
            </h1>
            <p className="text-muted text-sm mt-1">{fmtDateLong(session.date)} · {session.time}</p>
            {session.title && <p className="text-muted text-sm">{session.venue}</p>}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center py-5">
              <p className="text-interactive text-3xl font-extrabold">{stats.totalPlayers}</p>
              <p className="text-muted text-xs mt-1">players</p>
            </div>
            <div className="card text-center py-5">
              <p className="text-warning-muted text-3xl font-extrabold">{stats.firstTimers}</p>
              <p className="text-muted text-xs mt-1">first-timers</p>
            </div>
            <div className="card text-center py-5">
              <p className="text-secondary text-3xl font-extrabold">
                {stats.skillBreakdown.Beginner + stats.skillBreakdown.Intermediate + stats.skillBreakdown.Advanced > 0
                  ? Math.max(stats.skillBreakdown.Beginner, stats.skillBreakdown.Intermediate, stats.skillBreakdown.Advanced) === stats.skillBreakdown.Beginner ? 'B'
                  : Math.max(stats.skillBreakdown.Beginner, stats.skillBreakdown.Intermediate, stats.skillBreakdown.Advanced) === stats.skillBreakdown.Intermediate ? 'I'
                  : 'A'
                : '-'}
              </p>
              <p className="text-muted text-xs mt-1">most popular</p>
            </div>
          </div>

          {/* Skill breakdown */}
          <div className="card">
            <h2 className="text-primary font-bold text-sm">Skill Mix</h2>
            <div className="mt-3 space-y-2.5">
              {[
                { label: 'Beginner', count: stats.skillBreakdown.Beginner, color: 'bg-skill-beginner' },
                { label: 'Intermediate', count: stats.skillBreakdown.Intermediate, color: 'bg-skill-intermediate' },
                { label: 'Advanced', count: stats.skillBreakdown.Advanced, color: 'bg-skill-advanced' },
              ].filter(s => s.count > 0).map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${s.color}`} />
                      <span className="text-primary font-medium">{s.label}</span>
                    </div>
                    <span className="text-muted">{s.count} player{s.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-border overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(s.count / stats.totalPlayers) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Players */}
          {players.length > 0 && (
            <div className="card">
              <h2 className="text-primary font-bold text-sm">Who played</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {players.map((name, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-interactive/10 px-2.5 py-1 text-xs font-medium text-secondary">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Community streak */}
          <div className="card">
            <ActivityHeatmap />
          </div>

          {/* Share */}
          <div className="card text-center">
            <p className="text-primary font-bold text-sm">Share this recap</p>
            <p className="text-muted text-xs mt-1">Spread the word — make someone jealous they missed it</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-5 py-2.5 text-sm font-semibold active:scale-[.98] transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Share on WhatsApp
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-primary active:scale-[.98] transition hover:bg-surface/80"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Copy Link
              </button>
            </div>
          </div>

          {/* Next session CTA */}
          {nextSession && (
            <div className="card text-center border-2 border-interactive/30">
              <p className="text-muted text-[10px] uppercase tracking-[0.3em] font-medium">Next up</p>
              <p className="text-primary font-bold text-lg mt-2">
                {nextSession.title || nextSession.venue}
              </p>
              <p className="text-muted text-sm mt-1">{fmtDate(nextSession.date)} · {nextSession.time}</p>
              {nextSession.spotsLeft > 0 && (
                <p className="text-interactive text-sm font-semibold mt-2">{nextSession.spotsLeft} spots left</p>
              )}
              <Link
                to={`/events?session=${nextSession.id}`}
                className="glow-interactive inline-flex items-center gap-2 rounded-full bg-interactive text-inverse px-8 py-3.5 text-sm font-semibold active:scale-[.98] transition mt-4"
              >
                Book Now
              </Link>
            </div>
          )}
        </main>

        <footer className="py-6 border-t border-border">
          <div className="flex items-center justify-between">
            <Logo className="h-9 w-auto" />
            <p className="text-muted text-xs">Play. Connect. Belong.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
