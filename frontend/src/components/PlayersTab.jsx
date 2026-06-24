import { useEffect, useState } from 'react'
import { api } from '../api.js'

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return String(d)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}

function firstName(full) {
  return (full || '').trim().split(/\s+/)[0] || 'Player'
}

const SKILL_COLOR = {
  Beginner: 'bg-amber-100 text-amber-800',
  Intermediate: 'bg-court-500/15 text-court-600',
  Advanced: 'bg-coffee-800 text-coffee-50'
}

export default function PlayersTab() {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [players, setPlayers] = useState([])
  const [loadingS, setLoadingS] = useState(true)
  const [loadingP, setLoadingP] = useState(false)
  const [error, setError] = useState(null)

  async function loadSessions() {
    setLoadingS(true); setError(null)
    try {
      const { sessions } = await api.listSessions()
      setSessions(sessions)
      if (sessions.length && !sessions.find(s => s.id === activeId)) {
        setActiveId(sessions[0].id)
      }
    } catch (e) {
      setError(e.message || 'Could not load sessions')
    } finally {
      setLoadingS(false)
    }
  }

  async function loadPlayers(id) {
    if (!id) return
    setLoadingP(true); setError(null)
    try {
      const { players } = await api.listPlayers(id)
      setPlayers(players)
    } catch (e) {
      setError(e.message || 'Could not load players')
    } finally {
      setLoadingP(false)
    }
  }

  useEffect(() => { loadSessions() }, [])
  useEffect(() => { if (activeId) loadPlayers(activeId) }, [activeId])

  const active = sessions.find(s => s.id === activeId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-coffee-900 font-bold">Who's playing</h2>
        <button
          onClick={() => { loadSessions(); if (activeId) loadPlayers(activeId) }}
          className="btn-ghost"
          disabled={loadingS || loadingP}
        >
          <span className={loadingS || loadingP ? 'animate-spin' : ''}>↻</span>
          <span className="ml-1.5">Refresh</span>
        </button>
      </div>

      {loadingS && <div className="card text-center text-coffee-600 text-sm">Loading…</div>}

      {!loadingS && sessions.length > 0 && (
        <div className="-mx-5 px-5 overflow-x-auto">
          <div className="flex gap-2 w-max">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${activeId === s.id ? 'bg-coffee-800 text-coffee-50' : 'bg-white border border-coffee-200 text-coffee-800'}`}
              >
                {fmtDate(s.date)} · {s.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-coffee-600 text-xs font-semibold uppercase tracking-wide">{fmtDate(active.date)}</div>
              <div className="text-coffee-900 text-lg font-bold">{active.time}</div>
              <div className="text-coffee-800 text-sm">{active.venue}</div>
            </div>
            <span className="pill">{active.takenSlots || 0}/{active.maxSlots} booked</span>
          </div>

          <div className="mt-4 divide-y divide-coffee-100">
            {loadingP && <div className="text-sm text-coffee-600 py-3">Loading players…</div>}
            {!loadingP && players.length === 0 && (
              <div className="text-sm text-coffee-600 py-3">No one's signed up yet — be the first!</div>
            )}
            {!loadingP && players.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-coffee-100 grid place-items-center text-coffee-800 font-bold text-sm">
                    {firstName(p.name).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-coffee-900 font-medium">{p.name || 'Player'}</div>
                </div>
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${SKILL_COLOR[p.skill] || 'bg-coffee-100 text-coffee-800'}`}>
                  {p.skill || 'Player'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  )
}
