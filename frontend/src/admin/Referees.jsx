import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { api } from '../api.js'

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12)
}

export default function Referees({ onBack }) {
  const [referees, setReferees] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('role', 'referee').order('created_at', { ascending: false })
    setReferees(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createReferee() {
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true); setError('')
    const password = randomPassword()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await api.createReferee({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || undefined, password }, session?.access_token)
      setCreated({ email: form.email.trim(), password })
      setForm({ name: '', email: '', phone: '' })
      setCreating(false)
      load()
    } catch (e) {
      setError(e.message || 'Could not create referee')
    } finally {
      setSaving(false)
    }
  }

  async function deleteReferee(id) {
    if (!window.confirm('Remove this referee? They will lose access immediately and any court/bracket assignments will be unassigned.')) return
    const { data: { session } } = await supabase.auth.getSession()
    await api.deleteReferee(id, session?.access_token)
    load()
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Referees</h1>
        </div>

        <p className="text-2xs text-muted mb-4">Referee accounts sign in at <span className="font-mono">/referee</span> to score whatever group or bracket they're assigned to on a tournament category — nothing else in /admin.</p>

        {created && (
          <div className="card-compact px-4 py-3 mb-4 bg-interactive/5 border-interactive/20 space-y-1">
            <p className="text-sm font-semibold text-primary">Referee created — share these sign-in details now</p>
            <p className="text-xs text-secondary">Email: <span className="font-mono">{created.email}</span></p>
            <p className="text-xs text-secondary">Password: <span className="font-mono">{created.password}</span></p>
            <p className="text-2xs text-muted">This password won't be shown again. To reset access later, remove the referee and create a new account.</p>
            <button onClick={() => setCreated(null)} className="text-2xs font-semibold text-interactive mt-1">Dismiss</button>
          </div>
        )}

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && (
          <div className="space-y-3">
            {referees.map(r => (
              <div key={r.id} className="card-compact px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-primary font-semibold truncate">{r.name}</div>
                  {r.phone && <div className="text-2xs text-muted mt-0.5">{r.phone}</div>}
                </div>
                <button onClick={() => deleteReferee(r.id)} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}

            {referees.length === 0 && !creating && (
              <p className="text-muted text-sm text-center py-4">No referees yet.</p>
            )}

            {creating ? (
              <div className="card-compact px-4 py-3 space-y-3">
                <input className="input" placeholder="Referee name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                <input className="input" type="email" placeholder="Email (used to sign in)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <input className="input" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                {error && <p className="text-xs text-error">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={createReferee} disabled={saving || !form.name.trim() || !form.email.trim()} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-50">
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                  <button onClick={() => { setCreating(false); setError('') }} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-4 text-center active:bg-bg transition">
                <span className="text-sm font-semibold text-interactive">+ New Referee</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
