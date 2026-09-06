// Deterministic PRNG (seeded) so fixture generation is reproducible for a given team list.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Orders pairs greedily: at each step, plays the pairing whose two teams have
// rested the longest since they last played, so no team gets stacked with
// back-to-back matches.
function orderByRest(pairs, teamIds) {
  const remaining = [...pairs]
  const ordered = []
  const lastPlayedAt = new Map(teamIds.map(id => [id, -Infinity]))
  while (remaining.length > 0) {
    let bestIdx = 0, bestMin = -Infinity, bestSum = -Infinity
    for (let idx = 0; idx < remaining.length; idx++) {
      const [a, b] = remaining[idx]
      const restA = ordered.length - lastPlayedAt.get(a)
      const restB = ordered.length - lastPlayedAt.get(b)
      const min = Math.min(restA, restB)
      const sum = restA + restB
      if (min > bestMin || (min === bestMin && sum > bestSum)) { bestMin = min; bestSum = sum; bestIdx = idx }
    }
    const [a, b] = remaining.splice(bestIdx, 1)[0]
    ordered.push([a, b])
    lastPlayedAt.set(a, ordered.length - 1)
    lastPlayedAt.set(b, ordered.length - 1)
  }
  return ordered
}

function countBackToBack(order) {
  let n = 0
  for (let k = 1; k < order.length; k++) {
    const [a, b] = order[k], [c, d] = order[k - 1]
    if (a === c || a === d || b === c || b === d) n++
  }
  return n
}

/**
 * Generates every unique pairing among a list of team IDs — a single
 * round-robin (each team plays every other team once) — and orders the
 * matches so the same team doesn't play back-to-back. For N teams this is
 * N*(N-1)/2 matches. Ordering runs a "maximize rest since last played"
 * greedy pass, then retries with several shuffled starting orders (seeded,
 * so results are reproducible) and keeps whichever run has the fewest
 * consecutive repeats — zero for N>=5, the provable minimum of 2 for N=3/4.
 */
export function generateRoundRobinPairs(teamIds, attempts = 30) {
  const allPairs = []
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      allPairs.push([teamIds[i], teamIds[j]])
    }
  }
  if (allPairs.length <= 1) return allPairs

  let best = orderByRest(allPairs, teamIds)
  let bestScore = countBackToBack(best)

  for (let seed = 0; seed < attempts && bestScore > 0; seed++) {
    const rng = mulberry32(seed * 7919 + teamIds.length)
    const candidate = orderByRest(shuffled(allPairs, rng), teamIds)
    const score = countBackToBack(candidate)
    if (score < bestScore) { bestScore = score; best = candidate }
  }
  return best
}

/**
 * Computes standings for a set of teams from their completed matches.
 * Ranked by wins, then point differential, then points scored — the
 * standard round-robin tiebreak order.
 */
export function computeStandings(teams, matches) {
  const rows = new Map(teams.map(t => [t.id, {
    team: t,
    played: 0, wins: 0, losses: 0,
    pointsFor: 0, pointsAgainst: 0, pointDiff: 0
  }]))

  for (const m of matches) {
    if (m.status !== 'completed') continue
    const a = rows.get(m.team_a_id)
    const b = rows.get(m.team_b_id)
    if (!a || !b) continue

    a.played++; b.played++
    const aScore = Number(m.team_a_score) || 0
    const bScore = Number(m.team_b_score) || 0
    a.pointsFor += aScore; a.pointsAgainst += bScore
    b.pointsFor += bScore; b.pointsAgainst += aScore

    if (m.winner_team_id === m.team_a_id) { a.wins++; b.losses++ }
    else if (m.winner_team_id === m.team_b_id) { b.wins++; a.losses++ }
  }

  for (const row of rows.values()) {
    row.pointDiff = row.pointsFor - row.pointsAgainst
  }

  return [...rows.values()].sort((x, y) =>
    y.wins - x.wins || y.pointDiff - x.pointDiff || y.pointsFor - x.pointsFor
  )
}

/** Smallest power of 2 that is >= n (minimum 2, since a bracket needs at least one match). */
export function nextPowerOfTwo(n) {
  if (n <= 2) return 2
  return Math.pow(2, Math.ceil(Math.log2(n)))
}

// Standard single-elimination bracket seeding order: for a bracket of size
// `size`, returns the seed number that belongs in each slot (0-indexed) so
// that seed 1 and seed 2 can only meet in the final, seeds 1-4 can only
// meet from the semifinal on, etc. E.g. size 8 -> [1,8,4,5,2,7,3,6].
function seedOrder(size) {
  if (size === 1) return [1]
  const prev = seedOrder(size / 2)
  const result = []
  for (const s of prev) { result.push(s, size + 1 - s) }
  return result
}

/**
 * Maps a bracket round number to its stage label, counting backwards from
 * the final. `totalRounds` is log2(bracket size).
 */
export function stageLabelForRound(round, totalRounds) {
  const roundsFromEnd = totalRounds - round
  if (roundsFromEnd <= 0) return 'final'
  if (roundsFromEnd === 1) return 'semifinal'
  if (roundsFromEnd === 2) return 'quarterfinal'
  return `round_of_${Math.pow(2, roundsFromEnd + 1)}`
}

/**
 * Builds a single-elimination bracket for a list of teams ({id, seed?}).
 * Byes are given to the pad slots needed to reach the next power of two,
 * distributed by seed (or, when unseeded, by a deterministic shuffle) so
 * top seeds are the ones who get a bye round — the standard convention.
 * A bye is resolved immediately (the present team is the "winner" of that
 * round-1 slot, status 'completed') and carried straight into its round-2
 * slot, so a lone qualifier never has to "play" an empty bracket cell.
 *
 * Returns `{ matches, totalRounds, bracketSize }` where each match is
 * `{ round, bracketSlot, team_a_id, team_b_id, winner_team_id, status }`
 * (1-indexed rounds, 0-indexed slots within a round) — plain data, not yet
 * inserted rows, so the caller attaches category_id/group_id/stage and
 * writes them to `tournament_matches`.
 */
export function generateSingleElimBracket(teams, { seeded = false } = {}) {
  const n = teams.length
  if (n < 2) return { matches: [], totalRounds: 0, bracketSize: n }

  const bracketSize = nextPowerOfTwo(n)
  const totalRounds = Math.log2(bracketSize)
  const order = seedOrder(bracketSize)
  const ordered = seeded
    ? [...teams].sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity))
    : shuffled(teams, mulberry32(n * 104729 + 7))

  const slots = new Array(bracketSize).fill(null)
  order.forEach((seedPos, i) => { slots[i] = ordered[seedPos - 1] || null })

  const matches = []
  for (let s = 0; s < bracketSize / 2; s++) {
    const a = slots[2 * s]
    const b = slots[2 * s + 1]
    const bye = !a || !b
    matches.push({
      round: 1,
      bracketSlot: s,
      team_a_id: a?.id ?? null,
      team_b_id: b?.id ?? null,
      winner_team_id: bye ? (a?.id ?? b?.id ?? null) : null,
      status: bye ? 'completed' : 'scheduled'
    })
  }

  for (let r = 2; r <= totalRounds; r++) {
    const count = bracketSize / Math.pow(2, r)
    for (let s = 0; s < count; s++) {
      matches.push({ round: r, bracketSlot: s, team_a_id: null, team_b_id: null, winner_team_id: null, status: 'scheduled' })
    }
  }

  if (totalRounds >= 2) {
    const round1 = matches.filter(m => m.round === 1)
    const round2 = matches.filter(m => m.round === 2)
    round1.forEach((m, idx) => {
      if (m.status !== 'completed') return
      const target = round2[Math.floor(idx / 2)]
      if (idx % 2 === 0) target.team_a_id = m.winner_team_id
      else target.team_b_id = m.winner_team_id
    })
  }

  return { matches, totalRounds, bracketSize }
}

/**
 * Picks the knockout-stage entrants for a group_knockout category: the top
 * `advancePerGroup` teams from every group, ordered so all group winners
 * come first (in group order), then all runners-up, then all third-place
 * teams, etc. — a snake seeding that keeps teams from the same group apart
 * for as long as possible once fed into generateSingleElimBracket(seeded).
 * `standingsByGroupId` maps group id -> the array returned by
 * computeStandings() for that group's teams/matches.
 */
export function buildKnockoutEntrants(groups, standingsByGroupId, advancePerGroup) {
  const entrants = []
  for (let rank = 0; rank < advancePerGroup; rank++) {
    for (const g of groups) {
      const row = (standingsByGroupId.get(g.id) || [])[rank]
      if (row) entrants.push(row.team)
    }
  }
  return entrants.map((team, i) => ({ ...team, seed: i + 1 }))
}

function findMatch(matches, categoryId, round, bracketSlot) {
  return matches.find(m => m.category_id === categoryId && m.round === round && m.bracket_slot === bracketSlot)
}

/**
 * Given the full set of a category's bracket matches and a match that just
 * had its winner decided, returns the row updates needed to advance that
 * winner into its round+1 slot (round/bracket_slot arithmetic — no stored
 * next-match pointer). If the downstream match had already been completed
 * with a different team occupying that slot (an earlier score being
 * corrected after the bracket moved on), it — and everything further
 * downstream that depended on it — is reset to 'scheduled' with the slot
 * cleared, rather than silently leaving a stale result in place.
 *
 * Returns an array of `{ id, ...fields to update }`, empty if there's no
 * next round (the match just scored was the final) or nothing changed.
 */
export function computeAdvancement(matches, matchId, winnerTeamId) {
  const match = matches.find(m => m.id === matchId)
  if (!match) return []
  const next = findMatch(matches, match.category_id, match.round + 1, Math.floor(match.bracket_slot / 2))
  if (!next) return []

  const field = match.bracket_slot % 2 === 0 ? 'team_a_id' : 'team_b_id'
  if (next[field] === winnerTeamId) return []

  const update = { id: next.id, [field]: winnerTeamId }
  const updates = [update]
  if (next.status === 'completed') {
    update.status = 'scheduled'
    update.team_a_score = null
    update.team_b_score = null
    update.winner_team_id = null
    updates.push(...clearDescendants(matches, next.id))
  }
  return updates
}

function clearDescendants(matches, matchId) {
  const match = matches.find(m => m.id === matchId)
  if (!match) return []
  const next = findMatch(matches, match.category_id, match.round + 1, Math.floor(match.bracket_slot / 2))
  if (!next) return []

  const field = match.bracket_slot % 2 === 0 ? 'team_a_id' : 'team_b_id'
  const update = { id: next.id, [field]: null }
  const updates = [update]
  if (next.status === 'completed') {
    update.status = 'scheduled'
    update.team_a_score = null
    update.team_b_score = null
    update.winner_team_id = null
    updates.push(...clearDescendants(matches, next.id))
  }
  return updates
}
