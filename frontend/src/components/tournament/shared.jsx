import { useState } from 'react'
import { stageLabelForRound } from '../../lib/tournament.js'

export const CATEGORY_STATUS_FLOW = ['setup', 'registration_open', 'registration_closed', 'active', 'completed']
export const CATEGORY_STATUS_LABEL = {
  setup: 'Setup', registration_open: 'Registration Open', registration_closed: 'Registration Closed',
  active: 'Active', completed: 'Completed'
}
const CATEGORY_STATUS_DOT = {
  setup: 'bg-muted', registration_open: 'bg-interactive', registration_closed: 'bg-warning-muted',
  active: 'bg-interactive', completed: 'bg-secondary'
}

// A compact status indicator + change-menu -- deliberately unlike a row of
// tab buttons (single small pill with a caret) so it reads as "current
// state, tap to change" rather than a second row of navigation.
export function StatusBadge({ status, onChange, flow = CATEGORY_STATUS_FLOW, labels = CATEGORY_STATUS_LABEL }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-secondary bg-surface border border-border rounded-full pl-2.5 pr-2 py-1.5 active:bg-bg transition"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STATUS_DOT[status]} ${status === 'active' ? 'animate-pulse' : ''}`} />
        {labels[status] || status}
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="dropdown-in absolute right-0 top-10 z-50 w-48 card-compact shadow-lg overflow-hidden py-1">
            {flow.map(s => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition ${status === s ? 'text-interactive font-semibold bg-interactive/5' : 'text-secondary active:bg-bg'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_STATUS_DOT[s]}`} />
                {labels[s] || s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export const STAGE_LABEL = {
  final: 'Final', semifinal: 'Semifinal', quarterfinal: 'Quarterfinal',
  round_of_16: 'Round of 16', round_of_32: 'Round of 32', group: 'Group Stage'
}

export function humanStage(stage) {
  return STAGE_LABEL[stage] || stage
}

export function WithdrawnBadge() {
  return (
    <span className="inline-flex items-center text-3xs font-bold uppercase tracking-wide text-tertiary bg-error-subtle px-1.5 py-0.5 rounded-full ml-1.5 align-middle">
      Withdrawn
    </span>
  )
}

export function WaitlistBadge() {
  return (
    <span className="inline-flex items-center text-3xs font-bold uppercase tracking-wide text-warning-muted bg-warning-subtle px-1.5 py-0.5 rounded-full ml-1.5 align-middle">
      Waitlist
    </span>
  )
}

export function StandingsTable({ standings, highlightTop }) {
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
            <tr key={row.team.id} className={`border-t border-border ${highlightTop && i < highlightTop ? 'bg-interactive/5' : ''}`}>
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

export function MatchRow({ match, teamsById, onScore, readOnly }) {
  const teamA = teamsById.get(match.team_a_id)
  const teamB = teamsById.get(match.team_b_id)
  const [scoreA, setScoreA] = useState(match.team_a_score ?? '')
  const [scoreB, setScoreB] = useState(match.team_b_score ?? '')
  const [saving, setSaving] = useState(false)

  const completed = match.status === 'completed'
  const canPlay = match.team_a_id && match.team_b_id
  const canSave = canPlay && scoreA !== '' && scoreB !== '' && Number(scoreA) !== Number(scoreB)

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
        {!readOnly && canPlay && (
          <>
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
              className="shrink-0 text-xs font-semibold text-inverse bg-interactive px-3 py-2 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40"
            >
              {saving ? '…' : completed ? 'Update' : 'Save'}
            </button>
          </>
        )}
        {readOnly && completed && (
          <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-interactive/10 text-interactive">{match.team_a_score} – {match.team_b_score}</span>
        )}
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
    <div className="card-compact p-5">
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
        className="w-full mt-5 text-sm font-bold text-inverse bg-interactive px-4 py-3.5 rounded-full active:scale-[.98] transition ease-spring disabled:opacity-40"
      >
        {saving ? 'Saving…' : completed ? 'Update Score' : 'Save & Next'}
      </button>
    </div>
  )
}

// Focused referee flow for one group/court/bracket: the next unplayed
// match is always front and center with big tap targets, and a
// horizontally-scrolling strip -- not a long vertical list -- lets you jump
// to any other match to correct a score, so there's no scrolling to find
// "what's next" or to reach the score inputs.
export function ScoreMode({ title, matches, teamsById, onScore, onExit, standings }) {
  const [reviewId, setReviewId] = useState(null)
  const [showStandings, setShowStandings] = useState(false)

  const playable = matches.filter(m => m.team_a_id && m.team_b_id)
  const firstUnscored = playable.find(m => m.status !== 'completed')
  const current = reviewId ? playable.find(m => m.id === reviewId) : firstUnscored
  const scoredCount = playable.filter(m => m.status === 'completed').length
  const currentIndex = current ? playable.findIndex(m => m.id === current.id) : -1

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onExit} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-primary font-bold text-lg truncate">{title}</h1>
            <p className="text-xs text-muted">{scoredCount} of {playable.length} matches scored</p>
          </div>
        </div>

        {current ? (
          <>
            {reviewId && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xs font-semibold text-muted uppercase tracking-wide">Match {currentIndex + 1} of {playable.length}</span>
                <button onClick={() => setReviewId(null)} className="text-2xs font-semibold text-interactive">Back to next match</button>
              </div>
            )}
            <ScoreCard key={current.id} match={current} teamsById={teamsById} onScore={onScore} onSaved={() => setReviewId(null)} />
          </>
        ) : (
          <div className="card-compact p-8 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-primary font-bold">All matches scored</p>
            <p className="text-muted text-sm mt-1">Tap a match below to review or correct a score.</p>
          </div>
        )}

        {playable.length > 0 && (
          <div className="mt-6">
            <p className="text-2xs font-semibold text-muted uppercase tracking-wide mb-2">All matches</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
              {playable.map(m => {
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
                    <p className="text-2xs text-secondary truncate">{a?.name || 'TBD'} <span className="text-muted">vs</span> {b?.name || 'TBD'}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${done ? 'text-primary' : 'text-muted'}`}>
                      {done ? `${m.team_a_score} – ${m.team_b_score}` : 'Not played'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

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

// Renders a knockout bracket as one column per round, connected left to
// right. `matches` need only `round`/`bracket_slot` (bracket-tree position)
// plus the usual team/score fields; `totalRounds` picks each column's label
// (final, semifinal, quarterfinal, round of N).
export function BracketView({ matches, teamsById, totalRounds, onScore, readOnly, champion }) {
  if (matches.length === 0) return null
  const rounds = []
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push(matches.filter(m => m.round === r).sort((a, b) => a.bracket_slot - b.bracket_slot))
  }

  return (
    <div>
      {champion && (
        <div className="rounded-2xl bg-interactive/10 border border-interactive/20 px-4 py-3 mb-4 text-center">
          <p className="text-3xs font-bold uppercase tracking-wide text-interactive">🏆 Champion</p>
          <p className="text-primary font-bold text-lg mt-0.5">{champion.name}</p>
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-5 px-5">
        {rounds.map((roundMatches, i) => (
          <div key={i} className="shrink-0 w-56 flex flex-col justify-around gap-3">
            <p className="text-2xs font-bold text-muted uppercase tracking-wide text-center">{humanStage(stageLabelForRound(i + 1, totalRounds))}</p>
            {roundMatches.map(m => (
              <MatchRow key={m.id} match={m} teamsById={teamsById} onScore={onScore} readOnly={readOnly} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
