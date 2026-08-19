import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

export default function Venues({ onBack }) {
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', address: '', google_maps_url: '' })
  const [saving, setSaving] = useState(false)

  async function loadVenues() {
    const { data } = await supabase.from('venues').select('*').order('name')
    setVenues(data || [])
    setLoading(false)
  }

  useEffect(() => { loadVenues() }, [])

  function startEdit(venue) {
    setEditing(venue.id)
    setForm({ name: venue.name, address: venue.address || '', google_maps_url: venue.google_maps_url || '' })
  }

  function startNew() {
    setEditing('new')
    setForm({ name: '', address: '', google_maps_url: '' })
  }

  function cancel() {
    setEditing(null)
    setForm({ name: '', address: '', google_maps_url: '' })
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      google_maps_url: form.google_maps_url.trim() || null
    }
    if (editing === 'new') {
      await supabase.from('venues').insert(payload)
    } else {
      await supabase.from('venues').update(payload).eq('id', editing)
    }
    setSaving(false)
    setEditing(null)
    setForm({ name: '', address: '', google_maps_url: '' })
    loadVenues()
  }

  async function deleteVenue(id) {
    await supabase.from('venues').delete().eq('id', id)
    loadVenues()
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Venues</h1>
        </div>

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && (
          <div className="space-y-3">
            {venues.map(v => (
              <div key={v.id} className="card-compact px-4 py-3">
                {editing === v.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Venue name"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
                    />
                    <input
                      type="text"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Address"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
                    />
                    <input
                      type="url"
                      value={form.google_maps_url}
                      onChange={e => setForm(f => ({ ...f, google_maps_url: e.target.value }))}
                      placeholder="Google Maps link"
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 focus:border-interactive focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={save} disabled={saving} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={cancel} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="text-sm text-primary font-semibold">{v.name}</div>
                      {v.address && <div className="text-2xs text-muted mt-0.5">{v.address}</div>}
                      {v.google_maps_url && (
                        <a href={v.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-2xs text-interactive font-medium mt-0.5 inline-block">
                          View on Maps
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <button onClick={() => startEdit(v)} className="w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted active:bg-bg transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button onClick={() => deleteVenue(v.id)} className="w-8 h-8 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {editing === 'new' ? (
              <div className="card-compact px-4 py-3 space-y-3">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Venue name"
                  autoFocus
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
                />
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Address"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary focus:border-interactive focus:outline-none"
                />
                <input
                  type="url"
                  value={form.google_maps_url}
                  onChange={e => setForm(f => ({ ...f, google_maps_url: e.target.value }))}
                  placeholder="Google Maps link"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-sm text-primary placeholder:text-muted/50 focus:border-interactive focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-50">
                    {saving ? 'Saving...' : 'Add Venue'}
                  </button>
                  <button onClick={cancel} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={startNew}
                className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-4 text-center active:bg-bg transition"
              >
                <span className="text-sm font-semibold text-interactive">+ Add Venue</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
