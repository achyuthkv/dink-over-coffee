import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { computeStandings } from '../lib/tournament.js'

function MatchRow({ match, teamsById }) {
  const teamA = teamsById.get(match.team_a_id)
  const teamB = teamsById.get(match.team_b_id)
  const completed = match.status === 'completed'
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <span className={`flex-1 min-w-0 text-sm truncate text-right ${match.winner_team_id === teamA?.id ? 'font-bold text-primary' : 'text-secondary'}`}>{teamA?.name || 'TBD'}</span>
      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${completed ? 'bg-interactive/10 text-interactive' : 'text-muted'}`}>
        {completed ? `${match.team_a_score} – ${match.team_b_score}` : 'vs'}
      </span>
      <span className={`flex-1 min-w-0 text-sm truncate ${match.winner_team_id === teamB?.id ? 'font-bold text-primary' : 'text-secondary'}`}>{teamB?.name || 'TBD'}</span>
    </div>
  )
}

function CourtFixtures({ court, matches, teamsById }) {
  const [open, setOpen] = useState(false)
  const playedCount = matches.filter(m => m.status === 'completed').length
  return (
    <section className="card">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-3">
        <span className="text-primary font-bold text-sm">{court.name} — Fixtures</span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-2xs text-muted">{playedCount}/{matches.length} played</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      {open && (
        <div className="mt-2">
          {matches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} />)}
        </div>
      )}
    </section>
  )
}

function StandingsTable({ standings, courtsById }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-alt text-muted">
            <th className="text-left font-semibold px-3 py-2">#</th>
            <th className="text-left font-semibold px-3 py-2">Team</th>
            {courtsById && <th className="text-left font-semibold px-2 py-2">Court</th>}
            <th className="text-center font-semibold px-2 py-2">P</th>
            <th className="text-center font-semibold px-2 py-2">W</th>
            <th className="text-center font-semibold px-2 py-2">L</th>
            <th className="text-center font-semibold px-2 py-2">+/-</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row, i) => (
            <tr key={row.team.id} className="border-t border-border">
              <td className="px-3 py-2 text-muted">{i + 1}</td>
              <td className="px-3 py-2 text-primary font-medium">{row.team.name}</td>
              {courtsById && <td className="px-2 py-2 text-secondary">{courtsById.get(row.team.court_id)?.name || '—'}</td>}
              <td className="px-2 py-2 text-center text-secondary">{row.played}</td>
              <td className="px-2 py-2 text-center text-secondary">{row.wins}</td>
              <td className="px-2 py-2 text-center text-secondary">{row.losses}</td>
              <td className="px-2 py-2 text-center text-secondary">{row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TournamentTab() {
  const [tournament, setTournament] = useState(null)
  const [courts, setCourts] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  async function loadTournamentData(tournamentId) {
    const [c, tm, m] = await Promise.all([
      supabase.from('tournament_courts').select('*').eq('tournament_id', tournamentId).order('sort_order'),
      supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId),
      supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('match_number')
    ])
    setCourts(c.data || [])
    setTeams(tm.data || [])
    setMatches(m.data || [])
  }

  async function load() {
    setLoading(true)
    // Only ever shows a live tournament -- once an organizer marks it
    // completed, it disappears from this tab entirely rather than lingering
    // as a read-only result page.
    const { data: current } = await supabase.from('tournaments').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
    setTournament(current)
    if (current) await loadTournamentData(current.id)
    else setNotFound(true)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!tournament) return
    const channel = supabase
      .channel(`tournament-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${tournament.id}` }, () => loadTournamentData(tournament.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_teams', filter: `tournament_id=eq.${tournament.id}` }, () => loadTournamentData(tournament.id))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments', filter: `id=eq.${tournament.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournament?.id])

  if (loading) return <div className="card text-center text-secondary text-sm">Loading tournament…</div>
  if (notFound) return <div className="card text-center text-secondary text-sm">No tournament right now. Check back soon.</div>

  const teamsById = new Map(teams.map(t => [t.id, t]))
  const courtsById = new Map(courts.map(c => [c.id, c]))
  const roundRobinMatches = matches.filter(m => m.stage === 'round_robin')
  const semiMatches = matches.filter(m => m.stage === 'semifinal')
  const finalMatches = matches.filter(m => m.stage === 'final')
  const finalWinnerId = finalMatches.find(m => m.winner_team_id)?.winner_team_id
  const champion = finalWinnerId ? teamsById.get(finalWinnerId) : null
  // Standings are shown as one combined ranking across every court, not
  // per-court — courts are just round-robin pools, not separate divisions.
  const overallStandings = computeStandings(teams, roundRobinMatches)

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
      </section>

      {champion && (
        <div className="card text-center bg-interactive/5 border-interactive/20">
          <p className="text-3xs font-bold uppercase tracking-wide text-interactive">🏆 Champion</p>
          <p className="text-primary font-extrabold text-xl mt-0.5">{champion.name}</p>
        </div>
      )}

      {overallStandings.length > 0 && (
        <section className="card">
          <h3 className="text-primary font-bold text-sm mb-2">Standings</h3>
          <StandingsTable standings={overallStandings} courtsById={courtsById} />
        </section>
      )}

      {courts.map(c => {
        const courtMatches = roundRobinMatches.filter(m => m.court_id === c.id)
        if (courtMatches.length === 0) return null
        return <CourtFixtures key={c.id} court={c} matches={courtMatches} teamsById={teamsById} />
      })}

      {(semiMatches.length > 0 || finalMatches.length > 0) && (
        <section className="card">
          <h3 className="text-primary font-bold text-sm mb-2">Semifinals &amp; Final</h3>
          {semiMatches.length > 0 && (
            <div className="mb-2">
              <p className="text-3xs font-semibold text-muted uppercase tracking-wide mb-1">Semifinals</p>
              {semiMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} />)}
            </div>
          )}
          {finalMatches.length > 0 && (
            <div>
              <p className="text-3xs font-semibold text-muted uppercase tracking-wide mb-1">Final</p>
              {finalMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
