/**
 * Generates every unique pairing among a list of team IDs — a single
 * round-robin (each team plays every other team once). For N teams this is
 * N*(N-1)/2 matches; order is just a stable default display order, not a
 * scheduling constraint (courts play their own matches in whatever order
 * works on the day).
 */
export function generateRoundRobinPairs(teamIds) {
  const pairs = []
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairs.push([teamIds[i], teamIds[j]])
    }
  }
  return pairs
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
