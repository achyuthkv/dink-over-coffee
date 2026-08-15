import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import TournamentDetail from './TournamentDetail.jsx'

const STATUS_LABEL = { setup: 'Setup', active: 'Active', completed: 'Completed' }
const STATUS_STYLE = {
  setup: 'text-muted bg-bg',
  active: 'text-success bg-brand-100',
  completed: 'text-primary bg-interactive/10'
}

export default function Tournaments({ onBack }) {
  const [tournaments, setTournaments] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    setTournaments(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    supabase.from('sessions').select('id, date, title').order('date', { ascending: false }).limit(60)
      .then(({ data }) => setSessions(data || []))
  }, [])

  async function createTournament() {
    if (!name.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tournaments')
      .insert({ name: name.trim(), description: description.trim() || null, session_id: sessionId || null })
      .select('id')
      .single()
    setSaving(false)
    if (!error && data) {
      setName(''); setDescription(''); setSessionId(''); setCreating(false)
      setSelected(data.id)
    }
  }

  if (selected) {
    return <TournamentDetail tournamentId={selected} onBack={() => { setSelected(null); load() }} />
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Tournaments</h1>
        </div>

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && (
          <div className="space-y-3">
            {tournaments.map(t => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className="w-full text-left card-compact px-4 py-3 flex items-center justify-between gap-3 active:bg-bg transition"
              >
                <div className="min-w-0">
                  <div className="text-sm text-primary font-semibold truncate">{t.name}</div>
                  {t.description && <div className="text-2xs text-muted mt-0.5 truncate">{t.description}</div>}
                </div>
                <span className={`shrink-0 text-3xs font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </button>
            ))}

            {tournaments.length === 0 && !creating && (
              <p className="text-muted text-sm text-center py-4">No tournaments yet.</p>
            )}

            {creating ? (
              <div className="card-compact px-4 py-3 space-y-3">
                <input className="input" placeholder="Tournament name" value={name} onChange={e => setName(e.target.value)} autoFocus />
                <input className="input" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
                <div>
                  <select className="input" value={sessionId} onChange={e => setSessionId(e.target.value)}>
                    <option value="">No linked session (link one later)</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.date} — {s.title || s.id}</option>)}
                  </select>
                  <p className="text-2xs text-muted mt-1">Linking a session auto-populates teams from its confirmed doubles registrations.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={createTournament} disabled={saving || !name.trim()} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-50">
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={() => { setCreating(false); setName(''); setDescription(''); setSessionId('') }} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-4 text-center active:bg-bg transition">
                <span className="text-sm font-semibold text-interactive">+ New Tournament</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
