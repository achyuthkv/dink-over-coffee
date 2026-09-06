import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { computeStandings } from '../lib/tournament.js'
import { StandingsTable, MatchRow, BracketView } from './tournament/shared.jsx'
import TournamentRegisterForm from './TournamentRegisterForm.jsx'

const FORMAT_LABEL = { round_robin: 'Round Robin', single_elim: 'Single Elimination', group_knockout: 'Group Stage + Knockout' }

const STATUS_META = {
  registration_open: { label: 'Registration Open', className: 'badge-success' },
  active: { label: 'Live', className: 'badge-success' },
  registration_closed: { label: 'Registration Closed', className: 'inline-flex items-center rounded-full bg-bg px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-muted' },
  completed: { label: 'Completed', className: 'inline-flex items-center rounded-full bg-surface-alt px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-secondary' }
}

function StatusPill({ status }) {
  const meta = STATUS_META[status]
  if (!meta) return null
  return <span className={meta.className}>{meta.label}</span>
}

// "Free", "₹500", or "₹350 early bird" (while an early-bird deadline hasn't passed).
function feeLabel(category) {
  const entryFee = Number(category.entry_fee) || 0
  if (category.early_bird_fee !== null && category.early_bird_fee !== undefined && category.early_bird_deadline) {
    const deadline = new Date(`${category.early_bird_deadline}T23:59:59`)
    if (new Date() <= deadline) return `₹${category.early_bird_fee} early bird`
  }
  return entryFee > 0 ? `₹${entryFee}` : 'Free'
}

// The categories landing view: a card per category rather than a pill row --
// with more than a couple of categories, a horizontally-scrolling pill row
// hides most of them and gives no sense of what's inside each one (format,
// fee, whether it's still open). A card can show all of that at a glance,
// which matters here since choosing a category is the point of this screen.
function CategoryGrid({ categories, onSelect }) {
  return (
    <div className="space-y-2.5">
      {categories.map(c => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className="w-full text-left card-compact px-4 py-3.5 flex items-center justify-between gap-3 active:bg-bg transition"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-primary font-bold text-sm truncate">{c.name}</h3>
              <StatusPill status={c.status} />
            </div>
            <p className="text-2xs text-muted mt-1">
              {FORMAT_LABEL[c.format]} · {c.team_size === 2 ? 'Doubles' : 'Singles'} · {feeLabel(c)}
            </p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      ))}
    </div>
  )
}

function GroupFixtures({ group, matches, teamsById }) {
  const [open, setOpen] = useState(false)
  const playedCount = matches.filter(m => m.status === 'completed').length
  return (
    <section className="card">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-3">
        <span className="text-primary font-bold text-sm">{group.name} — Fixtures</span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-2xs text-muted">{playedCount}/{matches.length} played</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {matches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} readOnly />)}
        </div>
      )}
    </section>
  )
}

// One group's or the knockout bracket's content -- whichever "view" pill is
// currently selected.
function FixtureView({ view, groups, teams, groupMatches, bracketMatches, totalRounds, teamsById }) {
  if (view.type === 'bracket') {
    return (
      <section className="card">
        <h3 className="text-primary font-bold text-sm mb-2">Knockout Bracket</h3>
        <BracketView matches={bracketMatches} teamsById={teamsById} totalRounds={totalRounds} readOnly />
      </section>
    )
  }
  const group = groups.find(g => g.id === view.id)
  const gTeams = teams.filter(t => t.group_id === group.id && t.status !== 'withdrawn')
  const gMatches = groupMatches.filter(m => m.group_id === group.id)
  const standings = computeStandings(gTeams, gMatches)
  return (
    <div className="space-y-2">
      {gMatches.length > 0 ? (
        <>
          <section className="card">
            <h3 className="text-primary font-bold text-sm mb-2">{group.name} Standings</h3>
            <StandingsTable standings={standings} />
          </section>
          <GroupFixtures group={group} matches={gMatches} teamsById={teamsById} />
        </>
      ) : (
        <p className="text-secondary text-sm text-center py-6">Fixtures haven't been published for this group yet.</p>
      )}
    </div>
  )
}

function CategoryDetail({ category, onBack, contactPhone, autoRegister }) {
  const [groups, setGroups] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [activeViewId, setActiveViewId] = useState(null)
  const [registering, setRegistering] = useState(autoRegister)

  async function load() {
    const [g, tm, m] = await Promise.all([
      supabase.from('tournament_groups').select('*').eq('category_id', category.id).order('sort_order'),
      supabase.from('tournament_teams').select('*').eq('category_id', category.id),
      supabase.from('tournament_matches').select('*').eq('category_id', category.id).order('match_number')
    ])
    setGroups(g.data || [])
    setTeams(tm.data || [])
    setMatches(m.data || [])
  }

  useEffect(() => { load() }, [category.id])

  useEffect(() => {
    const channel = supabase
      .channel(`public-category-${category.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_teams', filter: `category_id=eq.${category.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `category_id=eq.${category.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_groups', filter: `category_id=eq.${category.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [category.id])

  const teamsById = new Map(teams.map(t => [t.id, t]))
  const groupMatches = matches.filter(m => m.round === 0)
  const bracketMatches = matches.filter(m => m.round > 0)
  const totalRounds = bracketMatches.reduce((max, m) => Math.max(max, m.round), 0)
  const finalMatch = bracketMatches.find(m => m.round === totalRounds)
  const champion = finalMatch?.winner_team_id ? teamsById.get(finalMatch.winner_team_id) : null

  // The set of fixture "views" for this category: one per group, plus a
  // knockout view once a bracket exists. A handful of tightly related,
  // same-category views like this is exactly what a pill row is good for --
  // unlike the category picker, there's nothing to browse or compare here,
  // just a quick toggle.
  const views = [
    ...groups.map(g => ({ id: g.id, type: 'group', label: g.name })),
    ...(bracketMatches.length > 0 ? [{ id: 'bracket', type: 'bracket', label: 'Knockout' }] : [])
  ]
  const activeView = views.find(v => v.id === activeViewId) || views[0] || null

  useEffect(() => {
    if (!views.some(v => v.id === activeViewId)) setActiveViewId(views[0]?.id || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, groups.length, bracketMatches.length > 0])

  if (registering) {
    return <TournamentRegisterForm category={category} contactPhone={contactPhone} onCancel={() => setRegistering(false)} onDone={() => setRegistering(false)} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-primary font-bold truncate">{category.name}</h2>
            <StatusPill status={category.status} />
          </div>
          <p className="text-2xs text-muted mt-0.5">{FORMAT_LABEL[category.format]} · {category.team_size === 2 ? 'Doubles' : 'Singles'} · {feeLabel(category)}</p>
        </div>
      </div>

      {category.status === 'registration_open' && (
        <button onClick={() => setRegistering(true)} className="w-full text-sm font-semibold text-inverse bg-interactive px-4 py-3 rounded-full active:scale-[.98] transition ease-spring">
          Register for {category.name}
        </button>
      )}

      {champion && (
        <div className="card text-center bg-interactive/5 border-interactive/20">
          <p className="text-3xs font-bold uppercase tracking-wide text-interactive">🏆 Champion</p>
          <p className="text-primary font-extrabold text-xl mt-0.5">{champion.name}</p>
        </div>
      )}

      {views.length === 0 && (
        <p className="text-secondary text-sm text-center py-6">Fixtures haven't been published for this category yet.</p>
      )}

      {views.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveViewId(v.id)}
              className={`shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border transition ${activeView?.id === v.id ? 'bg-interactive text-inverse border-interactive' : 'text-secondary border-border'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {activeView && (
        <FixtureView
          view={activeView}
          groups={groups}
          teams={teams}
          groupMatches={groupMatches}
          bracketMatches={bracketMatches}
          totalRounds={totalRounds}
          teamsById={teamsById}
        />
      )}
    </div>
  )
}

export default function TournamentTab() {
  const [tournament, setTournament] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoryIdsWithFixtures, setCategoryIdsWithFixtures] = useState(new Set())
  const [viewingCategoryId, setViewingCategoryId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  async function loadCategories(tournamentId) {
    const { data } = await supabase.from('tournament_categories').select('*').eq('tournament_id', tournamentId).order('sort_order')
    const visible = (data || []).filter(c => c.status !== 'setup')
    setCategories(visible)

    // Whether a category's fixtures have been generated yet -- decides
    // whether picking it from the grid should jump straight into
    // registration (nothing to see yet) or the normal detail view.
    if (visible.length > 0) {
      const { data: matchRows } = await supabase.from('tournament_matches').select('category_id').in('category_id', visible.map(c => c.id))
      setCategoryIdsWithFixtures(new Set((matchRows || []).map(m => m.category_id)))
    } else {
      setCategoryIdsWithFixtures(new Set())
    }
  }

  async function load() {
    setLoading(true)
    // Only ever shows a live tournament -- once an organizer marks it
    // completed, it disappears from this tab entirely rather than lingering
    // as a read-only result page.
    const { data: current } = await supabase.from('tournaments').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
    setTournament(current)
    if (current) await loadCategories(current.id)
    else setNotFound(true)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!tournament) return
    const channel = supabase
      .channel(`tournament-categories-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_categories', filter: `tournament_id=eq.${tournament.id}` }, () => loadCategories(tournament.id))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tournament.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournament?.id])

  if (loading) return <div className="card text-center text-secondary text-sm">Loading tournament…</div>
  if (notFound) return <div className="card text-center text-secondary text-sm">No tournament right now. Check back soon.</div>

  const viewingCategory = categories.find(c => c.id === viewingCategoryId)

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-primary font-bold md:text-lg">{tournament.name}</h2>
          <span className="badge-success">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Live
          </span>
        </div>
        {tournament.description && <p className="text-secondary text-sm mt-1">{tournament.description}</p>}
        {tournament.venue && <p className="text-muted text-2xs mt-0.5">{tournament.venue}</p>}
      </section>

      {categories.length === 0 ? (
        <p className="text-secondary text-sm text-center py-6">Categories haven't been published yet.</p>
      ) : viewingCategory ? (
        <CategoryDetail
          key={viewingCategory.id}
          category={viewingCategory}
          onBack={() => setViewingCategoryId(null)}
          contactPhone={tournament.contact_phone}
          autoRegister={viewingCategory.status === 'registration_open' && !categoryIdsWithFixtures.has(viewingCategory.id)}
        />
      ) : (
        <CategoryGrid categories={categories} onSelect={setViewingCategoryId} />
      )}
    </div>
  )
}
