/**
 * Computes which new tournament_teams rows to insert for a bulk sync: one
 * per qualifying player (confirmed, partnered, not already synced), placed
 * on whichever court currently has the fewest teams, ties broken by court
 * sort_order -- mirrors the DB trigger's own tie-break exactly, so an
 * admin-invoked backfill and the automatic per-registration sync always
 * agree on placement. Pure function so it's directly unit-testable without
 * touching Supabase.
 */
export function computeSyncRows({ tournamentId, players, courts, existingTeams }) {
  // Locked courts are excluded from placement -- their fixtures are final,
  // so a newly-qualifying player shouldn't silently invalidate them.
  const openCourts = (courts || []).filter(c => !c.fixtures_locked);
  if (openCourts.length === 0) return [];

  const sortedCourts = [...openCourts].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const existingSourceIds = new Set((existingTeams || []).map(t => t.source_player_id).filter(Boolean));
  const courtCounts = new Map(sortedCourts.map(c => [c.id, 0]));
  for (const t of existingTeams || []) {
    if (t.court_id && courtCounts.has(t.court_id)) courtCounts.set(t.court_id, courtCounts.get(t.court_id) + 1);
  }

  const qualifying = (players || []).filter(p =>
    p.status === 'confirmed' && !p.needs_partner && p.partner_name && p.partner_name.trim() && !existingSourceIds.has(p.id)
  );

  const rows = [];
  for (const p of qualifying) {
    let chosen = sortedCourts[0];
    for (const c of sortedCourts) {
      if (courtCounts.get(c.id) < courtCounts.get(chosen.id)) chosen = c;
    }
    rows.push({
      tournament_id: tournamentId,
      court_id: chosen.id,
      name: `${p.name} & ${p.partner_name}`,
      player1_name: p.name,
      player2_name: p.partner_name,
      source_player_id: p.id
    });
    courtCounts.set(chosen.id, courtCounts.get(chosen.id) + 1);
  }
  return rows;
}
