import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { api } from '../api.js'
import { generateRoundRobinPairs, computeStandings } from '../lib/tournament.js'

const STATUS_FLOW = ['setup', 'active', 'completed']
const STATUS_LABEL = { setup: 'Setup', active: 'Active', completed: 'Completed' }

const DETAIL_TABS = [
  { id: 'setup', label: 'Details' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'standings', label: 'Standings' },
  { id: 'knockout', label: 'Knockout' },
  { id: 'export', label: 'Export' }
]

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

function ScoreField({ value, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button" onClick={() => onChange(Math.max(0, value - 1))}
        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-border text-lg font-bold text-secondary active:bg-bg transition"
      >
        −
      </button>
      <input
        type="number" inputMode="numeric" value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-14 text-center text-3xl font-extrabold text-primary bg-transparent border-b-2 border-border focus:border-interactive focus:outline-none py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button" onClick={() => onChange(value + 1)}
        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-border text-lg font-bold text-secondary active:bg-bg transition"
      >
        +
      </button>
    </div>
  )
}

// A big, scoreboard-style score card for the referee scoring flow -- keyed
// by match id at the call site so switching matches remounts it fresh
// (mirrors MatchRow's own local-state-from-props pattern).
function ScoreCard({ match, teamsById, onScore, onSaved }) {
  const teamA = teamsById.get(match.team_a_id)
  const teamB = teamsById.get(match.team_b_id)
  const [scoreA, setScoreA] = useState(match.team_a_score ?? 0)
  const [scoreB, setScoreB] = useState(match.team_b_score ?? 0)
  const [saving, setSaving] = useState(false)

  const completed = match.status === 'completed'
  const canSave = scoreA !== scoreB

  async function save() {
    if (!canSave) return
    setSaving(true)
    await onScore(match, scoreA, scoreB)
    setSaving(false)
    onSaved?.()
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-5">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center min-w-0">
          <p className={`text-sm font-semibold truncate mb-3 ${match.winner_team_id === teamA?.id ? 'text-primary' : 'text-secondary'}`}>{teamA?.name || 'TBD'}</p>
          <ScoreField value={scoreA} onChange={setScoreA} />
        </div>
        <div className="text-center min-w-0">
          <p className={`text-sm font-semibold truncate mb-3 ${match.winner_team_id === teamB?.id ? 'text-primary' : 'text-secondary'}`}>{teamB?.name || 'TBD'}</p>
          <ScoreField value={scoreB} onChange={setScoreB} />
        </div>
      </div>
      <button
        onClick={save}
        disabled={!canSave || saving}
        className="w-full mt-5 text-sm font-bold text-inverse bg-interactive px-4 py-3.5 rounded-full active:scale-95 transition disabled:opacity-40"
      >
        {saving ? 'Saving…' : completed ? 'Update Score' : 'Save & Next'}
      </button>
    </div>
  )
}

// Focused referee flow for one court (or the knockout stage): the next
// unplayed match is always front and center with big tap targets, and a
// horizontally-scrolling strip -- not a long vertical list -- lets you jump
// to any other match to correct a score, so there's no scrolling to find
// "what's next" or to reach the score inputs.
function ScoreMode({ title, matches, teamsById, onScore, onExit, standings }) {
  const [reviewId, setReviewId] = useState(null)
  const [showStandings, setShowStandings] = useState(false)

  const firstUnscored = matches.find(m => m.status !== 'completed')
  const current = reviewId ? matches.find(m => m.id === reviewId) : firstUnscored
  const scoredCount = matches.filter(m => m.status === 'completed').length
  const currentIndex = current ? matches.findIndex(m => m.id === current.id) : -1

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 py-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onExit} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-primary font-bold text-lg truncate">{title}</h1>
            <p className="text-xs text-muted">{scoredCount} of {matches.length} matches scored</p>
          </div>
        </div>

        {current ? (
          <>
            {reviewId && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Match {currentIndex + 1} of {matches.length}</span>
                <button onClick={() => setReviewId(null)} className="text-[11px] font-semibold text-interactive">Back to next match</button>
              </div>
            )}
            <ScoreCard key={current.id} match={current} teamsById={teamsById} onScore={onScore} onSaved={() => setReviewId(null)} />
          </>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-primary font-bold">All matches scored</p>
            <p className="text-muted text-sm mt-1">Tap a match below to review or correct a score.</p>
          </div>
        )}

        <div className="mt-6">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">All matches</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
            {matches.map(m => {
              const a = teamsById.get(m.team_a_id)
              const b = teamsById.get(m.team_b_id)
              const done = m.status === 'completed'
              const isCurrent = current?.id === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => setReviewId(m.id)}
                  className={`shrink-0 text-left rounded-xl border px-3 py-2 min-w-[140px] transition ${isCurrent ? 'border-interactive bg-interactive/5' : 'border-border bg-surface'}`}
                >
                  <p className="text-[11px] text-secondary truncate">{a?.name || 'TBD'} <span className="text-muted">vs</span> {b?.name || 'TBD'}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${done ? 'text-primary' : 'text-muted'}`}>
                    {done ? `${m.team_a_score} – ${m.team_b_score}` : 'Not played'}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {standings && standings.length > 0 && (
          <div className="mt-6">
            <button onClick={() => setShowStandings(v => !v)} className="text-xs font-semibold text-interactive">
              {showStandings ? 'Hide standings' : 'View standings'}
            </button>
            {showStandings && <div className="mt-2"><StandingsTable standings={standings} /></div>}
          </div>
        )}
      </div>
    </div>
  )
}

function WithdrawnBadge() {
  return (
    <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wide text-tertiary bg-error-subtle px-1.5 py-0.5 rounded-full ml-1.5 align-middle">
      Withdrawn
    </span>
  )
}

function StandingsTable({ standings, courtsById, highlightTop, withdrawnPlayerIds }) {
  if (standings.length === 0) return null
  return (
    <div className="rounded-xl border border-border overflow-hidden mb-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-bg text-muted">
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
            <tr key={row.team.id} className={`border-t border-border ${highlightTop && i < highlightTop ? 'bg-interactive/5' : ''}`}>
              <td className="px-3 py-2 text-muted">{i + 1}</td>
              <td className="px-3 py-2 text-primary font-medium">
                {row.team.name}
                {withdrawnPlayerIds?.has(row.team.source_player_id) && <WithdrawnBadge />}
              </td>
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

export default function TournamentDetail({ tournamentId, onBack }) {
  const [tournament, setTournament] = useState(null)
  const [courts, setCourts] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [withdrawnPlayerIds, setWithdrawnPlayerIds] = useState(new Set())
  const [loading, setLoading] = useState(true)

  const [newCourtName, setNewCourtName] = useState('')
  const [teamForm, setTeamForm] = useState({ name: '', player1_name: '', player2_name: '', court_id: '' })
  const [addingTeam, setAddingTeam] = useState(false)
  const [koForm, setKoForm] = useState({ stage: 'semifinal', teamA: '', teamB: '' })
  const [addingKo, setAddingKo] = useState(false)
  const [scoringCourtId, setScoringCourtId] = useState(null)
  const [scoringKnockout, setScoringKnockout] = useState(false)
  const [sessions, setSessions] = useState([])
  const [linkedSession, setLinkedSession] = useState(null)
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [duprDate, setDuprDate] = useState('')
  const [duprScoreType, setDuprScoreType] = useState('RALLY')
  const [exportingDupr, setExportingDupr] = useState(false)
  const [duprMessage, setDuprMessage] = useState('')
  const [activeTab, setActiveTab] = useState('setup')

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
    const teamRows = tm.data || []
    setTeams(teamRows)
    setMatches(m.data || [])

    const sourceIds = teamRows.map(row => row.source_player_id).filter(Boolean)
    if (sourceIds.length > 0) {
      const { data: withdrawn } = await supabase.from('players').select('id').eq('status', 'withdrew').in('id', sourceIds)
      setWithdrawnPlayerIds(new Set((withdrawn || []).map(p => p.id)))
    } else {
      setWithdrawnPlayerIds(new Set())
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  // Teams are auto-synced from the linked session's confirmed doubles
  // registrations (new registration -> new team, via a DB trigger); these
  // subscriptions keep this screen live as that happens or as a
  // registration is withdrawn, without needing a manual refresh.
  useEffect(() => {
    if (!tournamentId) return
    const channel = supabase
      .channel(`admin-tournament-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_teams', filter: `tournament_id=eq.${tournamentId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${tournamentId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournamentId])

  useEffect(() => {
    if (!tournament?.session_id) return
    const channel = supabase
      .channel(`admin-tournament-players-${tournament.session_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${tournament.session_id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tournament?.session_id])

  useEffect(() => {
    supabase.from('sessions').select('id, date, title, venue').order('date', { ascending: false }).limit(60)
      .then(({ data }) => setSessions(data || []))
  }, [])

  useEffect(() => {
    if (!tournament?.session_id) { setLinkedSession(null); return }
    supabase.from('sessions').select('id, date, title, venue').eq('id', tournament.session_id).maybeSingle()
      .then(({ data }) => setLinkedSession(data))
  }, [tournament?.session_id])

  // Seed the DUPR export date once, from the linked session if there is
  // one -- doesn't fight further edits since it only fires while empty.
  useEffect(() => {
    if (duprDate || !tournament) return
    setDuprDate(linkedSession?.date || new Date().toISOString().slice(0, 10))
  }, [tournament, linkedSession, duprDate])

  // Switching tabs starts each section at the top rather than wherever the
  // previous tab happened to leave the scroll position.
  useEffect(() => { window.scrollTo(0, 0) }, [activeTab])

  const teamsById = new Map(teams.map(t => [t.id, t]))
  const courtsById = new Map(courts.map(c => [c.id, c]))

  async function setStatus(status) {
    await supabase.from('tournaments').update({ status }).eq('id', tournamentId)
    load()
  }

  async function linkSession() {
    if (!selectedSessionId) return
    await supabase.from('tournaments').update({ session_id: selectedSessionId }).eq('id', tournamentId)
    setSelectedSessionId('')
    setSyncMessage('')
    load()
  }

  async function unlinkSession() {
    await supabase.from('tournaments').update({ session_id: null }).eq('id', tournamentId)
    setSyncMessage('')
    load()
  }

  async function syncTeams() {
    setSyncing(true)
    setSyncMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { created } = await api.tournamentSyncTeams(tournamentId, session?.access_token)
      setSyncMessage(created > 0 ? `Synced ${created} new team${created === 1 ? '' : 's'}.` : 'Already up to date — no new teams to add.')
      load()
    } catch {
      setSyncMessage('Sync failed — try again.')
    } finally {
      setSyncing(false)
    }
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
    const courtMatches = matches.filter(m => m.court_id === courtId && m.stage === 'round_robin')
    const existingPairKeys = new Set(courtMatches.map(m => [m.team_a_id, m.team_b_id].sort().join('|')))
    // Regenerating the full order every time (rather than just appending a
    // new team at the end) keeps the no-back-to-back guarantee intact when
    // a team is auto-synced onto a court that already has fixtures --
    // already-played pairs are filtered back out, so their scores are untouched.
    const pairs = generateRoundRobinPairs(courtTeamIds).filter(([a, b]) => !existingPairKeys.has([a, b].sort().join('|')))
    if (pairs.length === 0) return
    const rows = pairs.map(([a, b], i) => ({
      tournament_id: tournamentId, court_id: courtId, stage: 'round_robin',
      match_number: courtMatches.length + i, team_a_id: a, team_b_id: b
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

  // DUPR's bulk match-upload CSV: header + one row per completed match, no
  // DUPR-side "division" concept -- event doubles as tournament + bracket
  // name. Player DUPR IDs come from `players` (dupr_id/partner_dupr_id) via
  // a synced team's source_player_id; teams added by hand in /admin have
  // no such link, so those cells are left blank for the organizer to fill
  // in before uploading.
  async function exportForDupr() {
    const completedMatches = matches.filter(m => m.status === 'completed')
    if (completedMatches.length === 0) return
    setExportingDupr(true)
    setDuprMessage('')

    const sourceIds = teams.map(t => t.source_player_id).filter(Boolean)
    let duprById = new Map()
    if (sourceIds.length > 0) {
      const { data } = await supabase.from('players').select('id, dupr_id, partner_dupr_id').in('id', sourceIds)
      duprById = new Map((data || []).map(p => [p.id, p]))
    }

    function teamDuprIds(team) {
      const p = team?.source_player_id ? duprById.get(team.source_player_id) : null
      return [p?.dupr_id || '', p?.partner_dupr_id || '']
    }

    let missingDupr = 0
    const rows = completedMatches.map(m => {
      const teamA = teamsById.get(m.team_a_id)
      const teamB = teamsById.get(m.team_b_id)
      const matchType = (teamA?.player2_name || teamB?.player2_name) ? 'D' : 'S'
      const court = courtsById.get(m.court_id)
      const eventName = m.stage === 'round_robin'
        ? `${tournament.name} — ${court?.name || 'Round Robin'}`
        : `${tournament.name} — ${m.stage === 'semifinal' ? 'Semifinal' : 'Final'}`
      const [aDupr1, aDupr2] = teamDuprIds(teamA)
      const [bDupr1, bDupr2] = teamDuprIds(teamB)
      if (!aDupr1 || !bDupr1) missingDupr++
      return [
        matchType, duprScoreType, eventName, duprDate,
        teamA?.player1_name || teamA?.name || '', aDupr1,
        teamA?.player2_name || '', aDupr2,
        teamB?.player1_name || teamB?.name || '', bDupr1,
        teamB?.player2_name || '', bDupr2,
        m.team_a_score, m.team_b_score, '', '', '', '', '', '', '', ''
      ]
    })

    const header = ['matchType', 'scoreType', 'event', 'date', 'playerA1', 'playerA1DuprId', 'playerA2', 'playerA2DuprId', 'playerB1', 'playerB1DuprId', 'playerB2', 'playerB2DuprId', 'teamAGame1', 'teamBGame1', 'teamAGame2', 'teamBGame2', 'teamAGame3', 'teamBGame3', 'teamAGame4', 'teamBGame4', 'teamAGame5', 'teamBGame5']
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [header, ...rows].map(r => r.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${tournament.name.replace(/[^a-z0-9]+/gi, '_')}_dupr_matches.csv`
    a.click()

    const knockoutCount = completedMatches.filter(m => m.stage !== 'round_robin').length
    const roundRobinCount = completedMatches.length - knockoutCount
    const breakdown = `${roundRobinCount} round robin${knockoutCount > 0 ? `, ${knockoutCount} knockout` : ''}`

    setExportingDupr(false)
    setDuprMessage(
      missingDupr > 0
        ? `Exported ${rows.length} match${rows.length === 1 ? '' : 'es'} (${breakdown}). ${missingDupr} ${missingDupr === 1 ? 'is' : 'are'} missing a player DUPR ID — fill those in before uploading to DUPR.`
        : `Exported ${rows.length} match${rows.length === 1 ? '' : 'es'} (${breakdown}).`
    )
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
  // Combined across every court -- with uneven team counts per court (e.g.
  // 5/5/4), per-court standings alone can't tell you who the overall top 4
  // are without a manual judgment call. This is a reference for picking
  // semifinalists, not an enforced cutoff -- the team pickers below still
  // allow any team.
  const overallStandings = computeStandings(teams, roundRobinMatches)

  const scoringCourt = scoringCourtId ? courts.find(c => c.id === scoringCourtId) : null
  if (scoringCourt) {
    const courtMatches = roundRobinMatches.filter(m => m.court_id === scoringCourt.id)
    const courtTeams = teams.filter(t => t.court_id === scoringCourt.id)
    return (
      <ScoreMode
        title={scoringCourt.name}
        matches={courtMatches}
        teamsById={teamsById}
        onScore={scoreMatch}
        onExit={() => setScoringCourtId(null)}
        standings={computeStandings(courtTeams, courtMatches)}
      />
    )
  }
  if (scoringKnockout) {
    const koMatches = [...semiMatches, ...finalMatches]
    return (
      <ScoreMode
        title="Semifinals & Final"
        matches={koMatches}
        teamsById={teamsById}
        onScore={scoreMatch}
        onExit={() => setScoringKnockout(false)}
      />
    )
  }

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

        {/* Status -- always visible regardless of tab, since going live is a
            one-tap action players are waiting on, not something to hunt for */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[11px] text-muted shrink-0">{tournament.status === 'setup' ? 'Not live yet:' : 'Status:'}</span>
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

        {/* Tabs -- each section used to be stacked on one long page, so
            saving anything meant scrolling back down past everything above
            it to get back to what you were doing. Now each is its own short
            view and switching tabs jumps to the top of it. */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-5 px-5 mb-5">
          {DETAIL_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border transition ${activeTab === t.id ? 'bg-interactive text-inverse border-interactive' : 'text-secondary border-border'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'setup' && (
          <>
            {/* Session -- linking one auto-syncs its confirmed doubles registrations as teams */}
            <section className="mb-6">
              <h2 className="text-sm font-bold text-primary mb-2">Session</h2>
              {linkedSession ? (
                <div className="bg-surface rounded-xl border border-border px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-primary font-medium truncate">{linkedSession.title || linkedSession.id}</p>
                      <p className="text-[11px] text-muted mt-0.5">{linkedSession.date}{linkedSession.venue ? ` · ${linkedSession.venue}` : ''}</p>
                    </div>
                    <button onClick={unlinkSession} className="shrink-0 text-[11px] font-medium text-tertiary">Unlink</button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <button
                      onClick={syncTeams}
                      disabled={syncing}
                      className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-95 transition disabled:opacity-40"
                    >
                      {syncing ? 'Syncing…' : 'Sync teams from session'}
                    </button>
                    {syncMessage && <span className="text-[11px] text-muted">{syncMessage}</span>}
                  </div>
                </div>
              ) : (
                <div className="bg-surface rounded-xl border border-dashed border-border px-3 py-3 space-y-2">
                  <p className="text-xs text-muted">Link a session to auto-populate teams from its confirmed doubles registrations, placed on whichever court has room.</p>
                  <div className="flex gap-2">
                    <select className="input" value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}>
                      <option value="">Select a session…</option>
                      {sessions.map(s => <option key={s.id} value={s.id}>{s.date} — {s.title || s.id}</option>)}
                    </select>
                    <button onClick={linkSession} disabled={!selectedSessionId} className="shrink-0 text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-95 transition disabled:opacity-40">Link</button>
                  </div>
                </div>
              )}
            </section>

            {/* Courts */}
            <section className="mb-6">
              <h2 className="text-sm font-bold text-primary mb-2">Courts</h2>
              <div className="space-y-2">
                {courts.map(c => {
                  const courtMatchCount = roundRobinMatches.filter(m => m.court_id === c.id).length
                  return (
                    <div key={c.id} className="flex items-center justify-between bg-surface rounded-xl border border-border px-3 py-2">
                      <span className="text-sm text-primary font-medium">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted">{teams.filter(t => t.court_id === c.id).length} teams</span>
                        {courtMatchCount > 0 && (
                          <button onClick={() => setScoringCourtId(c.id)} className="text-[11px] font-semibold text-interactive bg-interactive/10 px-2.5 py-1 rounded-full active:scale-95 transition">
                            Score
                          </button>
                        )}
                        <button onClick={() => deleteCourt(c.id)} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
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
                            <span className="text-sm text-primary">
                              {t.name}
                              {withdrawnPlayerIds.has(t.source_player_id) && <WithdrawnBadge />}
                            </span>
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
                          <span className="text-sm text-primary">
                            {t.name}
                            {withdrawnPlayerIds.has(t.source_player_id) && <WithdrawnBadge />}
                          </span>
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
          </>
        )}

        {activeTab === 'fixtures' && (
          courts.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">Add courts in the Setup tab first.</p>
          ) : (
            courts.map(c => {
              const courtTeams = teams.filter(t => t.court_id === c.id)
              const courtMatches = roundRobinMatches.filter(m => m.court_id === c.id)
              const standings = computeStandings(courtTeams, courtMatches)
              const totalPairs = courtTeams.length * (courtTeams.length - 1) / 2
              const missingPairs = totalPairs - courtMatches.length
              return (
                <section key={c.id} className="mb-6">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h2 className="text-sm font-bold text-primary">{c.name} — Round Robin</h2>
                    <div className="flex items-center gap-3 shrink-0">
                      {courtMatches.length > 0 && (
                        <button onClick={() => setScoringCourtId(c.id)} className="text-xs font-semibold text-interactive">Score →</button>
                      )}
                      {missingPairs > 0 && courtTeams.length >= 2 && (
                        <button
                          onClick={() => generateFixtures(c.id)}
                          className="text-xs font-semibold text-interactive"
                        >
                          {courtMatches.length === 0 ? 'Generate fixtures' : `Add ${missingPairs} new fixture${missingPairs === 1 ? '' : 's'}`}
                        </button>
                      )}
                    </div>
                  </div>
                  {courtMatches.length > 0 && <StandingsTable standings={standings} withdrawnPlayerIds={withdrawnPlayerIds} />}
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
            })
          )
        )}

        {activeTab === 'standings' && (
          overallStandings.length > 0 ? (
            <section className="mb-6">
              <p className="text-[11px] text-muted mb-2">Combined across all courts, ranked by wins then point differential. Top 4 highlighted as a reference for semifinal picks in the Knockout tab.</p>
              <StandingsTable standings={overallStandings} courtsById={courtsById} highlightTop={4} withdrawnPlayerIds={withdrawnPlayerIds} />
            </section>
          ) : (
            <p className="text-sm text-muted text-center py-10">No completed matches yet.</p>
          )
        )}

        {activeTab === 'knockout' && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="text-sm font-bold text-primary">Semifinals &amp; Final</h2>
              {(semiMatches.length > 0 || finalMatches.length > 0) && (
                <button onClick={() => setScoringKnockout(true)} className="text-xs font-semibold text-interactive shrink-0">Score →</button>
              )}
            </div>
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
        )}

        {activeTab === 'export' && (
          <section className="mb-6">
            <div className="bg-surface rounded-xl border border-border px-3 py-3 space-y-2">
              <p className="text-[11px] text-muted">Covers the whole tournament — every completed round robin, semifinal, and final match, not round robin alone.</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="input" value={duprDate} onChange={e => setDuprDate(e.target.value)} />
                <select className="input" value={duprScoreType} onChange={e => setDuprScoreType(e.target.value)}>
                  <option value="RALLY">Rally scoring</option>
                  <option value="SIDEOUT">Side-out scoring</option>
                </select>
              </div>
              <button
                onClick={exportForDupr}
                disabled={exportingDupr || matches.filter(m => m.status === 'completed').length === 0}
                className="w-full text-xs font-semibold text-inverse bg-interactive px-4 py-2.5 rounded-full active:scale-95 transition disabled:opacity-40"
              >
                {exportingDupr ? 'Exporting…' : 'Export all completed matches (.csv)'}
              </button>
              {duprMessage && <p className="text-[11px] text-muted">{duprMessage}</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
