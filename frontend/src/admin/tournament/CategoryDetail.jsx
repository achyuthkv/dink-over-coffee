import { useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { api } from '../../api.js'
import { parseCsv } from '../../lib/csv.js'
import {
  generateRoundRobinPairs, computeStandings, generateSingleElimBracket,
  buildKnockoutEntrants, stageLabelForRound
} from '../../lib/tournament.js'
import { scoreMatchAndAdvance } from '../../lib/tournamentActions.js'
import {
  StandingsTable, MatchRow, ScoreMode, BracketView, StatusBadge,
  WaitlistBadge, humanStage
} from '../../components/tournament/shared.jsx'

const FORMAT_LABEL = { round_robin: 'Round Robin', single_elim: 'Single Elimination', group_knockout: 'Group Stage + Knockout' }

function tabsForFormat(format) {
  if (format === 'single_elim') return [{ id: 'registrations', label: 'Registrations' }, { id: 'bracket', label: 'Bracket' }, { id: 'export', label: 'Export' }]
  if (format === 'group_knockout') return [{ id: 'registrations', label: 'Registrations' }, { id: 'groups', label: 'Groups' }, { id: 'bracket', label: 'Knockout' }, { id: 'export', label: 'Export' }]
  return [{ id: 'registrations', label: 'Registrations' }, { id: 'fixtures', label: 'Fixtures' }, { id: 'standings', label: 'Standings' }, { id: 'export', label: 'Export' }]
}

export default function CategoryDetail({ tournamentName, category, onBack, onChanged }) {
  const [cat, setCat] = useState(category)
  const [groups, setGroups] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('registrations')

  const [newGroupName, setNewGroupName] = useState('')
  const [teamForm, setTeamForm] = useState({ name: '', player1_name: '', player2_name: '', group_id: '' })
  const [addingTeam, setAddingTeam] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')

  const [seededBracket, setSeededBracket] = useState(true)
  const [scoringGroupId, setScoringGroupId] = useState(null)
  const [scoringBracket, setScoringBracket] = useState(false)

  const [referees, setReferees] = useState([])
  const [assignments, setAssignments] = useState([])

  const [duprDate, setDuprDate] = useState('')
  const [duprScoreType, setDuprScoreType] = useState('RALLY')
  const [exportingDupr, setExportingDupr] = useState(false)
  const [duprMessage, setDuprMessage] = useState('')

  async function reloadCategory() {
    const { data } = await supabase.from('tournament_categories').select('*').eq('id', category.id).single()
    if (data) { setCat(data); onChanged?.() }
  }

  async function load() {
    setLoading(true)
    const [g, tm, m, asn] = await Promise.all([
      supabase.from('tournament_groups').select('*').eq('category_id', category.id).order('sort_order'),
      supabase.from('tournament_teams').select('*').eq('category_id', category.id).order('created_at'),
      supabase.from('tournament_matches').select('*').eq('category_id', category.id).order('match_number'),
      supabase.from('tournament_referee_assignments').select('*').eq('category_id', category.id)
    ])
    setGroups(g.data || [])
    const teamRows = tm.data || []
    setTeams(teamRows)
    setMatches(m.data || [])
    setAssignments(asn.data || [])

    const teamIds = teamRows.map(t => t.id)
    if (teamIds.length > 0) {
      const { data: regs } = await supabase.from('tournament_registrations').select('*').in('team_id', teamIds)
      setRegistrations(regs || [])
    } else {
      setRegistrations([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [category.id])

  useEffect(() => {
    const channel = supabase
      .channel(`admin-category-${category.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_teams', filter: `category_id=eq.${category.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `category_id=eq.${category.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_groups', filter: `category_id=eq.${category.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [category.id])

  useEffect(() => {
    supabase.from('referees').select('id, name, phone').order('name')
      .then(({ data }) => setReferees(data || []))
  }, [])

  useEffect(() => {
    if (duprDate) return
    setDuprDate(new Date().toISOString().slice(0, 10))
  }, [duprDate])

  useEffect(() => { window.scrollTo(0, 0) }, [activeTab])

  const teamsById = new Map(teams.map(t => [t.id, t]))
  const groupsById = new Map(groups.map(g => [g.id, g]))
  const registrationsByTeamId = new Map(registrations.map(r => [r.team_id, r]))
  const confirmedTeams = teams.filter(t => t.status === 'confirmed')
  const waitlistedTeams = teams.filter(t => t.status === 'waitlisted')
  const withdrawnTeams = teams.filter(t => t.status === 'withdrawn')

  const groupMatches = matches.filter(m => m.round === 0)
  const bracketMatches = matches.filter(m => m.round > 0)
  const totalRounds = bracketMatches.reduce((max, m) => Math.max(max, m.round), 0)
  const bracketExists = bracketMatches.length > 0
  const finalMatch = bracketMatches.find(m => m.round === totalRounds)
  const champion = finalMatch?.winner_team_id ? teamsById.get(finalMatch.winner_team_id) : null

  async function setStatus(status) {
    await supabase.from('tournament_categories').update({ status }).eq('id', cat.id)
    reloadCategory()
  }

  async function addGroup() {
    if (!newGroupName.trim()) return
    await supabase.from('tournament_groups').insert({ category_id: cat.id, name: newGroupName.trim(), sort_order: groups.length })
    setNewGroupName(''); load()
  }

  async function deleteGroup(id) {
    await supabase.from('tournament_groups').delete().eq('id', id)
    load()
  }

  // A group can have at most one referee assignment (scope 'group'); the
  // bracket has at most one 'bracket'-scope assignment for the whole
  // category. Picking a new referee replaces the existing assignment
  // rather than stacking a second one.
  async function assignReferee(scope, groupId, refereeId) {
    const existing = assignments.find(a => a.scope === scope && a.group_id === (groupId || null))
    if (!refereeId) {
      if (existing) await supabase.from('tournament_referee_assignments').delete().eq('id', existing.id)
    } else if (existing) {
      await supabase.from('tournament_referee_assignments').update({ referee_id: refereeId }).eq('id', existing.id)
    } else {
      await supabase.from('tournament_referee_assignments').insert({ category_id: cat.id, group_id: groupId || null, scope, referee_id: refereeId })
    }
    load()
  }

  async function addTeam() {
    if (!teamForm.player1_name.trim()) return
    const name = teamForm.name.trim() || (teamForm.player2_name.trim() ? `${teamForm.player1_name.trim()} & ${teamForm.player2_name.trim()}` : teamForm.player1_name.trim())
    await supabase.from('tournament_teams').insert({
      category_id: cat.id,
      group_id: teamForm.group_id || null,
      name,
      player1_name: teamForm.player1_name.trim(),
      player2_name: teamForm.player2_name.trim() || null,
      status: 'confirmed'
    })
    setTeamForm({ name: '', player1_name: '', player2_name: '', group_id: '' })
    setAddingTeam(false)
    load()
  }

  async function setTeamStatus(id, status) {
    await supabase.from('tournament_teams').update({ status }).eq('id', id)
    load()
  }

  async function deleteTeam(id) {
    await supabase.from('tournament_teams').delete().eq('id', id)
    load()
  }

  async function markPaid(teamId) {
    await supabase.from('tournament_registrations').update({ payment_status: 'paid' }).eq('team_id', teamId)
    load()
  }

  async function handleCsvFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true); setImportMessage('')
    try {
      const text = await file.text()
      const rows = parseCsv(text).map(r => ({
        teamName: r.teamName || r.TeamName || '',
        player1Name: r.player1Name || r.Player1 || r.player1 || '',
        player1Phone: r.player1Phone || r.Phone || r.phone || '',
        player1DuprId: r.player1DuprId || r.DuprId || r.duprId || '',
        player1TshirtSize: r.player1TshirtSize || '',
        player2Name: r.player2Name || r.Player2 || r.player2 || '',
        player2Phone: r.player2Phone || '',
        player2DuprId: r.player2DuprId || '',
        player2TshirtSize: r.player2TshirtSize || '',
        email: r.email || r.Email || ''
      }))
      if (rows.length === 0) { setImportMessage('No rows found in that file.'); return }
      const { data: { session } } = await supabase.auth.getSession()
      const result = await api.tournamentBulkImport(cat.id, rows, session?.access_token)
      const skipped = result.errors?.length || 0
      setImportMessage(`Imported ${result.created} team${result.created === 1 ? '' : 's'}.${skipped > 0 ? ` ${skipped} row${skipped === 1 ? '' : 's'} skipped (see below).` : ''}`)
      if (skipped > 0) setImportMessage(prev => prev + ' ' + result.errors.map(e => `Row ${e.row}: ${e.error}`).join('; '))
      load()
    } catch (err) {
      setImportMessage(err.message || 'Import failed — check the file and try again.')
    } finally {
      setImporting(false)
    }
  }

  async function generateGroupFixtures(groupId) {
    const groupTeamIds = teams.filter(t => t.group_id === groupId && t.status === 'confirmed').map(t => t.id)
    if (groupTeamIds.length < 2) return
    const existing = groupMatches.filter(m => m.group_id === groupId)
    const existingPairKeys = new Set(existing.map(m => [m.team_a_id, m.team_b_id].sort().join('|')))
    const pairs = generateRoundRobinPairs(groupTeamIds).filter(([a, b]) => !existingPairKeys.has([a, b].sort().join('|')))
    if (pairs.length === 0) return
    const rows = pairs.map(([a, b], i) => ({
      category_id: cat.id, group_id: groupId, stage: 'group', round: 0, bracket_slot: 0,
      match_number: existing.length + i, team_a_id: a, team_b_id: b
    }))
    await supabase.from('tournament_matches').insert(rows)
    load()
  }

  async function insertBracket(entrants) {
    const { matches: built, totalRounds: rounds } = generateSingleElimBracket(entrants, { seeded: seededBracket })
    if (built.length === 0) return
    const rows = built.map(m => ({
      category_id: cat.id, group_id: null, stage: stageLabelForRound(m.round, rounds),
      round: m.round, bracket_slot: m.bracketSlot, match_number: m.round * 1000 + m.bracketSlot,
      team_a_id: m.team_a_id, team_b_id: m.team_b_id, winner_team_id: m.winner_team_id, status: m.status
    }))
    await supabase.from('tournament_matches').insert(rows)
    load()
  }

  async function generateBracketFromEntries() {
    if (confirmedTeams.length < 2) return
    await insertBracket(confirmedTeams.map(t => ({ id: t.id, seed: t.seed })))
  }

  async function generateKnockoutFromGroups() {
    const standingsByGroupId = new Map(groups.map(g => [
      g.id,
      computeStandings(teams.filter(t => t.group_id === g.id && t.status !== 'withdrawn'), groupMatches.filter(m => m.group_id === g.id))
    ]))
    const entrants = buildKnockoutEntrants(groups, standingsByGroupId, cat.advance_per_group)
    if (entrants.length < 2) return
    await insertBracket(entrants)
  }

  async function resetBracket() {
    if (!window.confirm('Clear the entire knockout bracket? Scores already entered will be lost.')) return
    await supabase.from('tournament_matches').delete().eq('category_id', cat.id).gt('round', 0)
    load()
  }

  async function scoreMatch(match, scoreA, scoreB) {
    await scoreMatchAndAdvance(matches, match, scoreA, scoreB)
    load()
  }

  // DUPR's bulk match-upload CSV -- see the round-robin era's version of this
  // for the full column-format rationale. `event` now folds in the category
  // name (and group/stage) since a tournament can run several categories at
  // once. Player DUPR IDs come straight from tournament_registrations --
  // required at registration/import time now, so every team has one.
  async function exportForDupr() {
    const completed = matches.filter(m => m.status === 'completed')
    if (completed.length === 0) return
    setExportingDupr(true); setDuprMessage('')

    function teamDuprIds(team) {
      const reg = team ? registrationsByTeamId.get(team.id) : null
      return [reg?.dupr_id || '', reg?.partner_dupr_id || '']
    }

    let missingDupr = 0
    const rows = completed.map(m => {
      const teamA = teamsById.get(m.team_a_id)
      const teamB = teamsById.get(m.team_b_id)
      const matchType = (teamA?.player2_name || teamB?.player2_name) ? 'D' : 'S'
      const eventName = m.round === 0
        ? `${tournamentName} — ${cat.name} — ${groupsById.get(m.group_id)?.name || 'Group Stage'}`
        : `${tournamentName} — ${cat.name} — ${humanStage(m.stage)}`
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
    a.download = `${tournamentName.replace(/[^a-z0-9]+/gi, '_')}_${cat.name.replace(/[^a-z0-9]+/gi, '_')}_dupr_matches.csv`
    a.click()

    setExportingDupr(false)
    setDuprMessage(
      missingDupr > 0
        ? `Exported ${rows.length} match${rows.length === 1 ? '' : 'es'}. ${missingDupr} ${missingDupr === 1 ? 'is' : 'are'} missing a player DUPR ID — fill those in before uploading to DUPR.`
        : `Exported ${rows.length} match${rows.length === 1 ? '' : 'es'}.`
    )
  }

  if (loading) return <div className="text-center text-muted text-sm py-10">Loading…</div>

  const scoringGroup = scoringGroupId ? groups.find(g => g.id === scoringGroupId) : null
  if (scoringGroup) {
    const gMatches = groupMatches.filter(m => m.group_id === scoringGroup.id)
    const gTeams = teams.filter(t => t.group_id === scoringGroup.id)
    return (
      <ScoreMode
        title={scoringGroup.name}
        matches={gMatches}
        teamsById={teamsById}
        onScore={scoreMatch}
        onExit={() => setScoringGroupId(null)}
        standings={computeStandings(gTeams, gMatches)}
      />
    )
  }
  if (scoringBracket) {
    return (
      <ScoreMode
        title={`${cat.name} — Bracket`}
        matches={bracketMatches}
        teamsById={teamsById}
        onScore={scoreMatch}
        onExit={() => setScoringBracket(false)}
      />
    )
  }

  const tabs = tabsForFormat(cat.format)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-primary font-bold truncate">{cat.name}</h2>
          <p className="text-2xs text-muted">{FORMAT_LABEL[cat.format]}</p>
        </div>
        <StatusBadge status={cat.status} onChange={setStatus} />
      </div>

      {champion && (
        <div className="rounded-2xl bg-interactive/10 border border-interactive/20 px-4 py-3 mb-4 text-center">
          <p className="text-3xs font-bold uppercase tracking-wide text-interactive">Champion</p>
          <p className="text-primary font-bold text-lg mt-0.5">{champion.name}</p>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border transition ${activeTab === t.id ? 'bg-interactive text-inverse border-interactive' : 'text-secondary border-border'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'registrations' && (
        <>
          <section className="mb-6">
            <h3 className="text-sm font-bold text-primary mb-2">Bulk Import (CSV)</h3>
            <p className="text-2xs text-muted mb-2">Columns: teamName, player1Name, player1Phone, player1DuprId, player1TshirtSize, player2Name, player2Phone, player2DuprId, player2TshirtSize, email. Header names are case-sensitive; player2 columns can be left blank for singles. DUPR ID and T-shirt size (S/M/L/XL/XXL/XXXL) are required for every player.</p>
            <label className="inline-block text-xs font-semibold text-interactive bg-interactive/10 px-4 py-2 rounded-full cursor-pointer">
              {importing ? 'Importing…' : 'Choose CSV file'}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvFile} disabled={importing} />
            </label>
            {importMessage && <p className="text-2xs text-muted mt-2">{importMessage}</p>}
          </section>

          <section className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-primary">Confirmed ({confirmedTeams.length}{cat.max_teams ? ` / ${cat.max_teams}` : ''})</h3>
            </div>
            <div className="space-y-1.5">
              {confirmedTeams.map(t => (
                <TeamRow key={t.id} team={t} registration={registrationsByTeamId.get(t.id)} groupsById={groupsById}
                  onWithdraw={() => setTeamStatus(t.id, 'withdrawn')} onDelete={() => deleteTeam(t.id)} onMarkPaid={() => markPaid(t.id)} />
              ))}
              {confirmedTeams.length === 0 && <p className="text-xs text-muted">No confirmed teams yet.</p>}
            </div>
          </section>

          {waitlistedTeams.length > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-bold text-primary mb-2">Waitlisted ({waitlistedTeams.length})</h3>
              <div className="space-y-1.5">
                {waitlistedTeams.map(t => (
                  <TeamRow key={t.id} team={t} registration={registrationsByTeamId.get(t.id)} waitlisted
                    onPromote={() => setTeamStatus(t.id, 'confirmed')}
                    onWithdraw={() => setTeamStatus(t.id, 'withdrawn')} onDelete={() => deleteTeam(t.id)} onMarkPaid={() => markPaid(t.id)} />
                ))}
              </div>
            </section>
          )}

          {withdrawnTeams.length > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-bold text-primary mb-2">Withdrawn ({withdrawnTeams.length})</h3>
              <div className="space-y-1.5">
                {withdrawnTeams.map(t => (
                  <TeamRow key={t.id} team={t} registration={registrationsByTeamId.get(t.id)}
                    onPromote={() => setTeamStatus(t.id, 'confirmed')} onDelete={() => deleteTeam(t.id)} />
                ))}
              </div>
            </section>
          )}

          <section className="mb-6">
            {addingTeam ? (
              <div className="card-compact px-3 py-3 space-y-2">
                <input className="input" placeholder="Team name (optional)" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Player 1" value={teamForm.player1_name} onChange={e => setTeamForm(f => ({ ...f, player1_name: e.target.value }))} autoFocus />
                  {cat.team_size === 2 && <input className="input" placeholder="Player 2" value={teamForm.player2_name} onChange={e => setTeamForm(f => ({ ...f, player2_name: e.target.value }))} />}
                </div>
                {groups.length > 0 && (
                  <select className="input" value={teamForm.group_id} onChange={e => setTeamForm(f => ({ ...f, group_id: e.target.value }))}>
                    <option value="">No group yet</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                <div className="flex gap-2">
                  <button onClick={addTeam} disabled={!teamForm.player1_name.trim()} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40">Add Team</button>
                  <button onClick={() => setAddingTeam(false)} className="text-xs font-medium text-muted px-4 py-2 rounded-full border border-border active:bg-bg transition">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingTeam(true)} className="w-full bg-surface rounded-xl border border-dashed border-border px-4 py-3 text-center active:bg-bg transition">
                <span className="text-sm font-semibold text-interactive">+ Add Team Manually</span>
              </button>
            )}
          </section>
        </>
      )}

      {(activeTab === 'fixtures' || activeTab === 'groups') && (
        <>
          <section className="mb-6">
            <h3 className="text-sm font-bold text-primary mb-2">Groups</h3>
            <div className="space-y-2">
              {groups.map(g => (
                <div key={g.id} className="flex items-center justify-between card-compact px-3 py-2">
                  <span className="text-sm text-primary font-medium">{g.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-muted">{teams.filter(t => t.group_id === g.id).length} teams</span>
                    <button onClick={() => deleteGroup(g.id)} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-tertiary/30 text-tertiary active:bg-error-subtle transition">
                      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input className="input" placeholder="Group name (e.g. Group A)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                <button onClick={addGroup} disabled={!newGroupName.trim()} className="shrink-0 text-xs font-semibold text-inverse bg-interactive px-4 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40">Add</button>
              </div>
            </div>
          </section>

          {groups.map(g => {
            const gTeams = teams.filter(t => t.group_id === g.id && t.status !== 'withdrawn')
            const gMatches = groupMatches.filter(m => m.group_id === g.id)
            const standings = computeStandings(gTeams, gMatches)
            const totalPairs = gTeams.length * (gTeams.length - 1) / 2
            const missingPairs = totalPairs - gMatches.length
            return (
              <section key={g.id} className="mb-6">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h3 className="text-sm font-bold text-primary">{g.name}</h3>
                  <div className="flex items-center gap-3 shrink-0">
                    {gMatches.length > 0 && <button onClick={() => setScoringGroupId(g.id)} className="text-xs font-semibold text-interactive">Score →</button>}
                    {missingPairs > 0 && gTeams.length >= 2 && (
                      <button onClick={() => generateGroupFixtures(g.id)} className="text-xs font-semibold text-interactive">
                        {gMatches.length === 0 ? 'Generate fixtures' : `Add ${missingPairs} new fixture${missingPairs === 1 ? '' : 's'}`}
                      </button>
                    )}
                  </div>
                </div>
                <RefereePicker
                  referees={referees}
                  value={assignments.find(a => a.scope === 'group' && a.group_id === g.id)?.referee_id || ''}
                  onChange={refereeId => assignReferee('group', g.id, refereeId)}
                />
                {gMatches.length > 0 && <StandingsTable standings={standings} />}
                <div className="space-y-2">
                  {gMatches.map(m => <MatchRow key={m.id} match={m} teamsById={teamsById} onScore={scoreMatch} />)}
                  {gMatches.length === 0 && <p className="text-xs text-muted">{gTeams.length < 2 ? 'Add at least 2 confirmed teams to this group first.' : 'No fixtures yet — generate them above.'}</p>}
                </div>
              </section>
            )
          })}

          {cat.format === 'group_knockout' && activeTab === 'groups' && groups.length > 0 && (
            <section className="mb-6">
              <p className="text-2xs text-muted">Once group play wraps, head to the Knockout tab to seed the top {cat.advance_per_group} from each group into the bracket.</p>
            </section>
          )}
        </>
      )}

      {activeTab === 'standings' && (
        groups.length > 0 ? (
          groups.map(g => {
            const gTeams = teams.filter(t => t.group_id === g.id && t.status !== 'withdrawn')
            const standings = computeStandings(gTeams, groupMatches.filter(m => m.group_id === g.id))
            return (
              <section key={g.id} className="mb-6">
                <h3 className="text-sm font-bold text-primary mb-2">{g.name}</h3>
                {standings.length > 0 ? <StandingsTable standings={standings} /> : <p className="text-xs text-muted">No completed matches yet.</p>}
              </section>
            )
          })
        ) : (
          <p className="text-sm text-muted text-center py-10">Add a group in the Fixtures tab first.</p>
        )
      )}

      {activeTab === 'bracket' && (
        <section className="mb-6">
          {!bracketExists ? (
            <div className="card-compact px-3 py-3 space-y-3">
              {cat.format === 'group_knockout' ? (
                <>
                  <p className="text-xs text-muted">Seeds the top {cat.advance_per_group} team{cat.advance_per_group === 1 ? '' : 's'} from each group into a knockout bracket, based on current group standings.</p>
                  <button onClick={generateKnockoutFromGroups} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2.5 rounded-full active:scale-[.98] transition ease-spring">Generate knockout bracket</button>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs text-secondary">
                    <input type="checkbox" checked={seededBracket} onChange={e => setSeededBracket(e.target.checked)} />
                    Seed by team seed number (unseeded teams are shuffled)
                  </label>
                  <button onClick={generateBracketFromEntries} disabled={confirmedTeams.length < 2} className="text-xs font-semibold text-inverse bg-interactive px-4 py-2.5 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40">
                    Generate bracket ({confirmedTeams.length} team{confirmedTeams.length === 1 ? '' : 's'})
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setScoringBracket(true)} className="text-xs font-semibold text-interactive">Score →</button>
                <button onClick={resetBracket} className="text-2xs font-medium text-tertiary">Reset bracket</button>
              </div>
              <RefereePicker
                referees={referees}
                value={assignments.find(a => a.scope === 'bracket')?.referee_id || ''}
                onChange={refereeId => assignReferee('bracket', null, refereeId)}
              />
              <BracketView matches={bracketMatches} teamsById={teamsById} totalRounds={totalRounds} onScore={scoreMatch} />
            </>
          )}
        </section>
      )}

      {activeTab === 'export' && (
        <section className="mb-6">
          <div className="card-compact px-3 py-3 space-y-2">
            <p className="text-2xs text-muted">Every completed match in this category — group stage and knockout alike.</p>
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
              className="w-full text-xs font-semibold text-inverse bg-interactive px-4 py-2.5 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40"
            >
              {exportingDupr ? 'Exporting…' : 'Export all completed matches (.csv)'}
            </button>
            {duprMessage && <p className="text-2xs text-muted">{duprMessage}</p>}
          </div>
        </section>
      )}
    </div>
  )
}

function TeamRow({ team, registration, groupsById, waitlisted, onPromote, onWithdraw, onDelete, onMarkPaid }) {
  return (
    <div className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2 gap-2">
      <div className="min-w-0">
        <span className="text-sm text-primary">
          {team.name}
          {waitlisted && <WaitlistBadge />}
        </span>
        <p className="text-2xs text-muted mt-0.5 truncate">
          {[
            groupsById?.get(team.group_id)?.name,
            registration?.phone,
            registration?.dupr_id && `DUPR ${registration.dupr_id}`,
            registration?.tshirt_size && `Shirt ${registration.tshirt_size}${registration.partner_tshirt_size ? `/${registration.partner_tshirt_size}` : ''}`,
            registration && registration.payment_status !== 'free' ? registration.payment_status : null
          ].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {registration?.payment_status === 'pending' && (
          <button onClick={onMarkPaid} className="text-2xs font-semibold text-interactive bg-interactive/10 px-2 py-1 rounded-full">Mark paid</button>
        )}
        {onPromote && <button onClick={onPromote} className="text-2xs font-semibold text-interactive">Promote</button>}
        {onWithdraw && <button onClick={onWithdraw} className="text-2xs font-medium text-tertiary">Withdraw</button>}
        {onDelete && <button onClick={onDelete} className="text-tertiary text-xs">Remove</button>}
      </div>
    </div>
  )
}

// Assigns a referee (a Supabase Auth account with app_metadata.role='referee')
// to score this group's round robin or the category's knockout bracket --
// mirrors Clutch pairing an organizer's tournament app with a separate
// referee app scoped to one court/bracket at a time.
function RefereePicker({ referees, value, onChange }) {
  if (referees.length === 0) {
    return <p className="text-2xs text-muted mb-2">No referee accounts yet — add one from Manage → Referees.</p>
  }
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xs text-muted shrink-0">Referee:</span>
      <select className="input !py-1.5 !text-xs" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Unassigned</option>
        {referees.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}
      </select>
    </div>
  )
}
