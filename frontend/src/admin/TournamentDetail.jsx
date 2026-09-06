import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import CategoryDetail from './tournament/CategoryDetail.jsx'
import { StatusBadge } from '../components/tournament/shared.jsx'

const TOURNAMENT_STATUS_FLOW = ['setup', 'active', 'completed']
const TOURNAMENT_STATUS_LABEL = { setup: 'Setup', active: 'Active', completed: 'Completed' }

const FORMAT_LABEL = { round_robin: 'Round Robin', single_elim: 'Single Elimination', group_knockout: 'Group Stage + Knockout' }
const CATEGORY_STATUS_SHORT = { setup: 'Setup', registration_open: 'Reg. Open', registration_closed: 'Reg. Closed', active: 'Active', completed: 'Completed' }

const emptyCategoryForm = { name: '', format: 'round_robin', team_size: '2', max_teams: '', entry_fee: '0', early_bird_fee: '', early_bird_deadline: '', advance_per_group: '2' }

export default function TournamentDetail({ tournamentId, onBack }) {
  const [tournament, setTournament] = useState(null)
  const [categories, setCategories] = useState([])
  const [courts, setCourts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [editingSettings, setEditingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState(null)
  const [addingCategory, setAddingCategory] = useState(false)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [newCourtName, setNewCourtName] = useState('')

  async function load() {
    setLoading(true)
    const [t, c, co] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('tournament_categories').select('*').eq('tournament_id', tournamentId).order('sort_order'),
      supabase.from('tournament_courts').select('*').eq('tournament_id', tournamentId).order('sort_order')
    ])
    setTournament(t.data)
    setCategories(c.data || [])
    setCourts(co.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  useEffect(() => {
    const channel = supabase
      .channel(`admin-tournament-categories-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_categories', filter: `tournament_id=eq.${tournamentId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId])

  async function setStatus(status) {
    await supabase.from('tournaments').update({ status }).eq('id', tournamentId)
    load()
  }

  function startEditingSettings() {
    setSettingsForm({
      name: tournament.name || '', description: tournament.description || '', sport: tournament.sport || 'pickleball',
      venue: tournament.venue || '', start_date: tournament.start_date || '', end_date: tournament.end_date || '',
      contact_phone: tournament.contact_phone || ''
    })
    setEditingSettings(true)
  }

  async function saveSettings() {
    await supabase.from('tournaments').update({
      name: settingsForm.name.trim(), description: settingsForm.description.trim() || null, sport: settingsForm.sport.trim() || 'pickleball',
      venue: settingsForm.venue.trim() || null, start_date: settingsForm.start_date || null, end_date: settingsForm.end_date || null,
      contact_phone: settingsForm.contact_phone.trim() || null
    }).eq('id', tournamentId)
    setEditingSettings(false)
    load()
  }

  async function addCourt() {
    if (!newCourtName.trim()) return
    await supabase.from('tournament_courts').insert({ tournament_id: tournamentId, name: newCourtName.trim(), sort_order: courts.length })
    setNewCourtName('')
    load()
  }

  async function deleteCourt(id) {
    await supabase.from('tournament_courts').delete().eq('id', id)
    load()
  }

  async function createCategory() {
    if (!categoryForm.name.trim()) return
    await supabase.from('tournament_categories').insert({
      tournament_id: tournamentId,
      name: categoryForm.name.trim(),
      format: categoryForm.format,
      team_size: Number(categoryForm.team_size),
      max_teams: categoryForm.max_teams ? Number(categoryForm.max_teams) : null,
      entry_fee: Number(categoryForm.entry_fee) || 0,
      early_bird_fee: categoryForm.early_bird_fee ? Number(categoryForm.early_bird_fee) : null,
      early_bird_deadline: categoryForm.early_bird_deadline || null,
      advance_per_group: Number(categoryForm.advance_per_group) || 2,
      sort_order: categories.length
    })
    setCategoryForm(emptyCategoryForm)
    setAddingCategory(false)
    load()
  }

  async function deleteCategory(id) {
    if (!window.confirm('Delete this category and all its teams, matches and registrations? This cannot be undone.')) return
    await supabase.from('tournament_categories').delete().eq('id', id)
    load()
  }

  if (loading || !tournament) {
    return <div className="min-h-screen bg-pattern flex items-center justify-center text-muted">Loading…</div>
  }

  const selectedCategory = selectedCategoryId ? categories.find(c => c.id === selectedCategoryId) : null

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        {selectedCategory ? (
          <CategoryDetail
            tournamentName={tournament.name}
            category={selectedCategory}
            onBack={() => setSelectedCategoryId(null)}
            onChanged={load}
          />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <h1 className="text-primary font-bold text-lg truncate flex-1">{tournament.name}</h1>
              <StatusBadge status={tournament.status} onChange={setStatus} flow={TOURNAMENT_STATUS_FLOW} labels={TOURNAMENT_STATUS_LABEL} />
            </div>

            <section className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-primary">Details</h2>
                {!editingSettings && <button onClick={startEditingSettings} className="text-2xs font-semibold text-interactive">Edit</button>}
              </div>
              {editingSettings ? (
                <div className="card-compact px-3 py-3 space-y-2">
                  <input className="input" placeholder="Tournament name" value={settingsForm.name} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
                  <input className="input" placeholder="Description (optional)" value={settingsForm.description} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="input" placeholder="Sport (e.g. pickleball)" value={settingsForm.sport} onChange={e => setSettingsForm(f => ({ ...f, sport: e.target.value }))} />
                    <input className="input" placeholder="Venue" value={settingsForm.venue} onChange={e => setSettingsForm(f => ({ ...f, venue: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="input" value={settingsForm.start_date} onChange={e => setSettingsForm(f => ({ ...f, start_date: e.target.value }))} />
                    <input type="date" className="input" value={settingsForm.end_date} onChange={e => setSettingsForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                  <div>
                    <input className="input" placeholder="Contact phone for registration issues (optional)" value={settingsForm.contact_phone} onChange={e => setSettingsForm(f => ({ ...f, contact_phone: e.target.value }))} />
                    <p className="text-3xs text-muted mt-1">Shown to players on the registration form and confirmation screen, tap-to-call.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveSettings} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring">Save</button>
                    <button onClick={() => setEditingSettings(false)} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="card-compact px-3 py-3 text-sm text-secondary space-y-0.5">
                  {tournament.description && <p>{tournament.description}</p>}
                  <p className="text-2xs text-muted">
                    {tournament.sport}
                    {tournament.venue ? ` · ${tournament.venue}` : ''}
                    {tournament.start_date ? ` · ${tournament.start_date}${tournament.end_date && tournament.end_date !== tournament.start_date ? ` – ${tournament.end_date}` : ''}` : ''}
                  </p>
                  {tournament.contact_phone && <p className="text-2xs text-muted">Contact: {tournament.contact_phone}</p>}
                </div>
              )}
            </section>

            <section className="mb-6">
              <h2 className="text-sm font-bold text-primary mb-2">Courts</h2>
              <p className="text-2xs text-muted mb-2">Physical courts for scheduling reference — matches aren't auto-assigned to one.</p>
              <div className="space-y-2">
                {courts.map(c => (
                  <div key={c.id} className="flex items-center justify-between card-compact px-3 py-2">
                    <span className="text-sm text-primary font-medium">{c.name}</span>
                    <button onClick={() => deleteCourt(c.id)} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input className="input" placeholder="Court name (e.g. Court 1)" value={newCourtName} onChange={e => setNewCourtName(e.target.value)} />
                  <button onClick={addCourt} disabled={!newCourtName.trim()} className="shrink-0 text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40">Add</button>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-primary mb-2">Categories</h2>
              <div className="space-y-2">
                {categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between card-compact px-4 py-3 gap-3">
                    <button onClick={() => setSelectedCategoryId(c.id)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm text-primary font-semibold truncate">{c.name}</div>
                      <div className="text-2xs text-muted mt-0.5">{FORMAT_LABEL[c.format]} · {CATEGORY_STATUS_SHORT[c.status]}</div>
                    </button>
                    <button onClick={() => deleteCategory(c.id)} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}

                {categories.length === 0 && !addingCategory && (
                  <p className="text-muted text-sm text-center py-4">No categories yet — add one to start (e.g. "Men's Doubles").</p>
                )}

                {addingCategory ? (
                  <div className="card-compact px-3 py-3 space-y-2">
                    <input className="input" placeholder="Category name (e.g. Men's Doubles)" value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                    <select className="input" value={categoryForm.format} onChange={e => setCategoryForm(f => ({ ...f, format: e.target.value }))}>
                      <option value="round_robin">Round Robin</option>
                      <option value="single_elim">Single Elimination</option>
                      <option value="group_knockout">Group Stage + Knockout</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input" value={categoryForm.team_size} onChange={e => setCategoryForm(f => ({ ...f, team_size: e.target.value }))}>
                        <option value="2">Doubles (2 players)</option>
                        <option value="1">Singles (1 player)</option>
                      </select>
                      <input type="number" min="0" className="input" placeholder="Max teams (optional)" value={categoryForm.max_teams} onChange={e => setCategoryForm(f => ({ ...f, max_teams: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" className="input" placeholder="Entry fee (₹)" value={categoryForm.entry_fee} onChange={e => setCategoryForm(f => ({ ...f, entry_fee: e.target.value }))} />
                      <input type="number" min="0" className="input" placeholder="Early-bird fee (optional)" value={categoryForm.early_bird_fee} onChange={e => setCategoryForm(f => ({ ...f, early_bird_fee: e.target.value }))} />
                    </div>
                    {categoryForm.early_bird_fee && (
                      <input type="date" className="input" value={categoryForm.early_bird_deadline} onChange={e => setCategoryForm(f => ({ ...f, early_bird_deadline: e.target.value }))} />
                    )}
                    {categoryForm.format === 'group_knockout' && (
                      <input type="number" min="1" className="input" placeholder="Teams advancing per group" value={categoryForm.advance_per_group} onChange={e => setCategoryForm(f => ({ ...f, advance_per_group: e.target.value }))} />
                    )}
                    <div className="flex gap-2">
                      <button onClick={createCategory} disabled={!categoryForm.name.trim()} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40">Create Category</button>
                      <button onClick={() => { setAddingCategory(false); setCategoryForm(emptyCategoryForm) }} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingCategory(true)} className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-4 text-center active:bg-bg transition">
                    <span className="text-sm font-semibold text-interactive">+ New Category</span>
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
