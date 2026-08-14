import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { generateRoundRobinPairs, computeStandings } from '../lib/tournament.js'

const STATUS_FLOW = ['setup', 'active', 'completed']
const STATUS_LABEL = { setup: 'Setup', active: 'Active', completed: 'Completed' }

function MatchRow({ match, teamsById, onScore }) {
  const teamA = teamsById.get(match.team_a_id)
  const teamB = teamsById.get(match.team_b_id)
  const [scoreA, setScoreA] = useState(match.team_a_score ?? '')
  const [scoreB, setScoreB] = useState(match.team_b_score ?? '')
  const [saving, setSaving] = useState(false)

  const completed = match.status === 'completed'
  const canSave = scoreA !== '' && scoreB !== '' && Number(scoreA) !== Number(scoreB)

  async function save() {
    if (!canSave) return
    setSaving(true)
    await onScore(match, Number(scoreA), Number(scoreB))
    setSaving(false)
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${completed ? 'border-border bg-bg' : 'border-border-strong bg-surface'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate ${match.winner_team_id === teamA?.id ? 'font-bold text-primary' : 'text-secondary'}`}>{teamA?.name || 'TBD'}</p>
          <p className={`text-sm truncate ${match.winner_team_id === teamB?.id ? 'font-bold text-primary' : 'text-secondary'}`}>{teamB?.name || 'TBD'}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number" inputMode="numeric" value={scoreA} onChange={e => setScoreA(e.target.value)}
            className="w-12 text-center bg-bg border border-border rounded-lg px-1 py-1.5 text-sm text-primary focus:border-interactive focus:outline-none"
          />
          <input
            type="number" inputMode="numeric" value={scoreB} onChange={e => setScoreB(e.target.value)}
            className="w-12 text-center bg-bg border border-border rounded-lg px-1 py-1.5 text-sm text-primary focus:border-interactive focus:outline-none"
          />
        </div>
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="shrink-0 text-xs font-semibold text-inverse bg-interactive px-3 py-2 rounded-full active:scale-95 transition disabled:opacity-40"
        >
          {saving ? '…' : completed ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function StandingsTable({ standings }) {
  if (standings.length === 0) return null
  return (
    <div className="rounded-xl border border-border overflow-hidden mb-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-bg text-muted">
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

export default function TournamentDetail({ tournamentId, onBack }) {
  const [tournament, setTournament] = useState(null)
  const [courts, setCourts] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  const [newCourtName, setNewCourtName] = useState('')
  const [teamForm, setTeamForm] = useState({ name: '', player1_name: '', player2_name: '', court_id: '' })
  const [addingTeam, setAddingTeam] = useState(false)
  const [koForm, setKoForm] = useState({ stage: 'semifinal', teamA: '', teamB: '' })
  const [addingKo, setAddingKo] = useState(false)

  async function load() {
    setLoading(true)
    const [t, c, tm, m] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('tournament_courts').select('*').eq('tournament_id', tournamentId).order('sort_order'),
      supabase.from('tournament_teams').select('*').eq('tournament_id', tournamentId).order('created_at'),
      supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('match_number')
    ])
    setTournament(t.data)
    setCourts(c.data || [])
    setTeams(tm.data || [])
    setMatches(m.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  const teamsById = new Map(teams.map(t => [t.id, t]))

  async function setStatus(status) {
    await supabase.from('tournaments').update({ status }).eq('id', tournamentId)
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

  async function addTeam() {
    if (!teamForm.name.trim()) return
    await supabase.from('tournament_teams').insert({
      tournament_id: tournamentId,
      court_id: teamForm.court_id || null,
      name: teamForm.name.trim(),
      player1_name: teamForm.player1_name.trim() || null,
      player2_name: teamForm.player2_name.trim() || null
    })
    setTeamForm({ name: '', player1_name: '', player2_name: '', court_id: '' })
    setAddingTeam(false)
    load()
  }

  async function deleteTeam(id) {
    await supabase.from('tournament_teams').delete().eq('id', id)
    load()
  }

  async function generateFixtures(courtId) {
    const courtTeamIds = teams.filter(t => t.court_id === courtId).map(t => t.id)
    if (courtTeamIds.length < 2) return
    const pairs = generateRoundRobinPairs(courtTeamIds)
    const rows = pairs.map(([a, b], i) => ({
      tournament_id: tournamentId, court_id: courtId, stage: 'round_robin',
      match_number: i, team_a_id: a, team_b_id: b
    }))
    await supabase.from('tournament_matches').insert(rows)
    load()
  }

  async function scoreMatch(match, scoreA, scoreB) {
    const winner_team_id = scoreA > scoreB ? match.team_a_id : match.team_b_id
    await supabase.from('tournament_matches').update({
      team_a_score: scoreA, team_b_score: scoreB, winner_team_id, status: 'completed'
    }).eq('id', match.id)
    load()
  }

  async function addKnockoutMatch() {
    if (!koForm.teamA || !koForm.teamB || koForm.teamA === koForm.teamB) return
    const existingCount = matches.filter(m => m.stage === koForm.stage).length
    await supabase.from('tournament_matches').insert({
      tournament_id: tournamentId, stage: koForm.stage, match_number: existingCount,
      team_a_id: koForm.teamA, team_b_id: koForm.teamB
    })
    setKoForm({ stage: 'semifinal', teamA: '', teamB: '' })
    setAddingKo(false)
    load()
  }

  if (loading || !tournament) {
    return <div className="min-h-screen bg-pattern flex items-center justify-center text-muted">Loading…</div>
  }

  const roundRobinMatches = matches.filter(m => m.stage === 'round_robin')
  const semiMatches = matches.filter(m => m.stage === 'semifinal')
  const finalMatches = matches.filter(m => m.stage === 'final')
  const champion = finalMatches.find(m => m.winner_team_id) ? teamsById.get(finalMatches.find(m => m.winner_team_id).winner_team_id) : null

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 py-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg truncate flex-1">{tournament.name}</h1>
        </div>

        {champion && (
          <div className="rounded-2xl bg-interactive/10 border border-interactive/20 px-4 py-3 mb-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-interactive">Champion</p>
            <p className="text-primary font-bold text-lg mt-0.5">{champion.name}</p>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 mb-6">
          {STATUS_FLOW.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${tournament.status === s ? 'bg-interactive text-inverse border-interactive' : 'text-secondary border-border'}`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Courts */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-primary mb-2">Courts</h2>
          <div className="space-y-2">
            {courts.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-surface rounded-xl border border-border px-3 py-2">
                <span className="text-sm text-primary font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">{teams.filter(t => t.court_id === c.id).length} teams</span>
                  <button onClick={() => deleteCourt(c.id)} className="w-7 h-7 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input className="input" placeholder="Court name (e.g. Court 1)" value={newCourtName} onChange={e => setNewCourtName(e.target.value)} />
              <button onClick={addCourt} disabled={!newCourtName.trim()} className="shrink-0 text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-95 transition disabled:opacity-40">Add</button>
            </div>
          </div>
        </section>

        {/* Teams */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-primary mb-2">Teams ({teams.length})</h2>
          <div className="space-y-2">
            {courts.map(c => {
              const courtTeams = teams.filter(t => t.court_id === c.id)
              if (courtTeams.length === 0) return null
              return (
                <div key={c.id}>
                  <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">{c.name}</p>
                  <div className="space-y-1.5 mb-2">
                    {courtTeams.map(t => (
                      <div key={t.id} className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2">
                        <span className="text-sm text-primary">{t.name}</span>
                        <button onClick={() => deleteTeam(t.id)} className="text-tertiary text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {teams.filter(t => !t.court_id).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Unassigned</p>
                <div className="space-y-1.5 mb-2">
                  {teams.filter(t => !t.court_id).map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2">
                      <span className="text-sm text-primary">{t.name}</span>
                      <button onClick={() => deleteTeam(t.id)} className="text-tertiary text-xs">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {addingTeam ? (
              <div className="bg-surface rounded-xl border border-border px-3 py-3 space-y-2">
                <input className="input" placeholder="Team name" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Player 1" value={teamForm.player1_name} onChange={e => setTeamForm(f => ({ ...f, player1_name: e.target.value }))} />
                  <input className="input" placeholder="Player 2 (optional)" value={teamForm.player2_name} onChange={e => setTeamForm(f => ({ ...f, player2_name: e.target.value }))} />
                </div>
                <select className="input" value={teamForm.court_id} onChange={e => setTeamForm(f => ({ ...f, court_id: e.target.value }))}>
                  <option value="">No court yet</option>
                  {courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={addTeam} disabled={!teamForm.name.trim()} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-95 transition disabled:opacity-40">Add Team</button>
                  <button onClick={() => setAddingTeam(false)} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingTeam(true)} className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-3 text-center active:bg-bg transition">
                <span className="text-sm font-semibold text-interactive">+ Add Team</span>
              </button>
            )}
          </div>
        </section>

        {/* Round robin per court */}
        {courts.map(c => {
          const courtTeams = teams.filter(t => t.court_id === c.id)
          const courtMatches = roundRobinMatches.filter(m => m.court_id === c.id)
          const standings = computeStandings(courtTeams, courtMatches)
          return (
            <section key={c.id} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-primary">{c.name} — Round Robin</h2>
                {courtMatches.length === 0 && (
                  <button
                    onClick={() => generateFixtures(c.id)}
                    disabled={courtTeams.length < 2}
                    className="text-xs font-semibold text-interactive disabled:opacity-40"
                  >
                    Generate fixtures
                  </button>
                )}
              </div>
              {courtMatches.length > 0 && <StandingsTable standings={standings} />}
              <div className="space-y-2">
                {courtMatches.map(m => (
                  <MatchRow key={m.id} match={m} teamsById={teamsById} onScore={scoreMatch} />
                ))}
                {courtMatches.length === 0 && (
                  <p className="text-xs text-muted">{courtTeams.length < 2 ? 'Add at least 2 teams to this court first.' : 'No fixtures yet — generate them above.'}</p>
                )}
              </div>
            </section>
          )
        })}

        {/* Knockout stage */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-primary mb-2">Semifinals &amp; Final</h2>
          {semiMatches.length > 0 && (
            <div className="space-y-2 mb-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">Semifinals</p>
              {semiMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} onScore={scoreMatch} />)}
            </div>
          )}
          {finalMatches.length > 0 && (
            <div className="space-y-2 mb-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wide">Final</p>
              {finalMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} onScore={scoreMatch} />)}
            </div>
          )}

          {addingKo ? (
            <div className="bg-surface rounded-xl border border-border px-3 py-3 space-y-2">
              <select className="input" value={koForm.stage} onChange={e => setKoForm(f => ({ ...f, stage: e.target.value }))}>
                <option value="semifinal">Semifinal</option>
                <option value="final">Final</option>
              </select>
              <select className="input" value={koForm.teamA} onChange={e => setKoForm(f => ({ ...f, teamA: e.target.value }))}>
                <option value="">Team A</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="input" value={koForm.teamB} onChange={e => setKoForm(f => ({ ...f, teamB: e.target.value }))}>
                <option value="">Team B</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={addKnockoutMatch} disabled={!koForm.teamA || !koForm.teamB || koForm.teamA === koForm.teamB} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-95 transition disabled:opacity-40">Create Match</button>
                <button onClick={() => setAddingKo(false)} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingKo(true)} className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-3 text-center active:bg-bg transition">
              <span className="text-sm font-semibold text-interactive">+ Create Semifinal / Final Match</span>
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
