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

function StandingsTable({ standings }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-surface-alt text-muted">
            <th className="text-left font-semibold px-3 py-2">#</th>
            <th className="text-left font-semibold px-3 py-2">Team</th>
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
    let { data: current } = await supabase.from('tournaments').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!current) {
      const { data: completed } = await supabase.from('tournaments').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(1).maybeSingle()
      current = completed
    }
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
  const roundRobinMatches = matches.filter(m => m.stage === 'round_robin')
  const semiMatches = matches.filter(m => m.stage === 'semifinal')
  const finalMatches = matches.filter(m => m.stage === 'final')
  const finalWinnerId = finalMatches.find(m => m.winner_team_id)?.winner_team_id
  const champion = finalWinnerId ? teamsById.get(finalWinnerId) : null

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-text font-bold md:text-lg">{tournament.name}</h2>
          {tournament.status === 'active' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-green-800 bg-green-100 dark:text-secondary dark:bg-secondary/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> Live
            </span>
          )}
          {tournament.status === 'completed' && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted bg-bg px-2 py-0.5 rounded-full">Completed</span>
          )}
        </div>
        {tournament.description && <p className="text-secondary text-sm mt-1">{tournament.description}</p>}
      </section>

      {champion && (
        <div className="card text-center bg-interactive/5 border-interactive/20">
          <p className="text-[10px] font-bold uppercase tracking-wide text-interactive">🏆 Champion</p>
          <p className="text-primary font-extrabold text-xl mt-0.5">{champion.name}</p>
        </div>
      )}

      {courts.map(c => {
        const courtTeams = teams.filter(t => t.court_id === c.id)
        const courtMatches = roundRobinMatches.filter(m => m.court_id === c.id)
        if (courtTeams.length === 0) return null
        const standings = computeStandings(courtTeams, courtMatches)
        return (
          <section key={c.id} className="card">
            <h3 className="text-text font-bold text-sm mb-2">{c.name}</h3>
            <StandingsTable standings={standings} />
            {courtMatches.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Fixtures</p>
                {courtMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} />)}
              </div>
            )}
          </section>
        )
      })}

      {(semiMatches.length > 0 || finalMatches.length > 0) && (
        <section className="card">
          <h3 className="text-text font-bold text-sm mb-2">Semifinals &amp; Final</h3>
          {semiMatches.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Semifinals</p>
              {semiMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} />)}
            </div>
          )}
          {finalMatches.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Final</p>
              {finalMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
