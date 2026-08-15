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
