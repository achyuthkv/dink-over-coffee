import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { computeStandings } from '../lib/tournament.js'
import { StandingsTable, MatchRow, BracketView } from './tournament/shared.jsx'
import TournamentRegisterForm from './TournamentRegisterForm.jsx'

const FORMAT_LABEL = { round_robin: 'Round Robin', single_elim: 'Single Elimination', group_knockout: 'Group Stage + Knockout' }

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

function CategorySection({ category, onRegister }) {
  const [groups, setGroups] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])

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
  const confirmedCount = teams.filter(t => t.status === 'confirmed').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-2xs font-semibold text-muted uppercase tracking-wide">{FORMAT_LABEL[category.format]}</p>
          <p className="text-2xs text-secondary mt-0.5">{confirmedCount} team{confirmedCount === 1 ? '' : 's'} registered{category.max_teams ? ` / ${category.max_teams}` : ''}</p>
        </div>
        {category.status === 'registration_open' && (
          <button onClick={() => onRegister(category)} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring">
            Register
          </button>
        )}
      </div>

      {champion && (
        <div className="card text-center bg-interactive/5 border-interactive/20">
          <p className="text-3xs font-bold uppercase tracking-wide text-interactive">🏆 Champion</p>
          <p className="text-primary font-extrabold text-xl mt-0.5">{champion.name}</p>
        </div>
      )}

      {groups.map(g => {
        const gTeams = teams.filter(t => t.group_id === g.id && t.status !== 'withdrawn')
        const gMatches = groupMatches.filter(m => m.group_id === g.id)
        const standings = computeStandings(gTeams, gMatches)
        return (
          <div key={g.id} className="space-y-2">
            {standings.length > 0 && (
              <section className="card">
                <h3 className="text-primary font-bold text-sm mb-2">{g.name} Standings</h3>
                <StandingsTable standings={standings} />
              </section>
            )}
            {gMatches.length > 0 && <GroupFixtures group={g} matches={gMatches} teamsById={teamsById} />}
          </div>
        )
      })}

      {bracketMatches.length > 0 && (
        <section className="card">
          <h3 className="text-primary font-bold text-sm mb-2">Bracket</h3>
          <BracketView matches={bracketMatches} teamsById={teamsById} totalRounds={totalRounds} readOnly />
        </section>
      )}

      {groups.length === 0 && bracketMatches.length === 0 && (
        <p className="text-secondary text-sm text-center py-6">Fixtures haven't been published for this category yet.</p>
      )}
    </div>
  )
}

export default function TournamentTab() {
  const [tournament, setTournament] = useState(null)
  const [categories, setCategories] = useState([])
  const [activeCategoryId, setActiveCategoryId] = useState(null)
  const [registeringCategory, setRegisteringCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  async function loadCategories(tournamentId) {
    const { data } = await supabase.from('tournament_categories').select('*').eq('tournament_id', tournamentId).order('sort_order')
    const visible = (data || []).filter(c => c.status !== 'setup')
    setCategories(visible)
    setActiveCategoryId(prev => (prev && visible.some(c => c.id === prev)) ? prev : visible[0]?.id || null)
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

  const activeCategory = categories.find(c => c.id === activeCategoryId)

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
      ) : (
        <>
          {categories.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border transition ${activeCategoryId === c.id ? 'bg-interactive text-inverse border-interactive' : 'text-secondary border-border'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {registeringCategory ? (
            <TournamentRegisterForm category={registeringCategory} onCancel={() => setRegisteringCategory(null)} onDone={() => {}} />
          ) : (
            activeCategory && <CategorySection key={activeCategory.id} category={activeCategory} onRegister={setRegisteringCategory} />
          )}
        </>
      )}
    </div>
  )
}
