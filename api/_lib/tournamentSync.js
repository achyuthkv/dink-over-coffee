/**
 * Computes which new tournament_teams rows to insert for a bulk sync: one
 * per qualifying player (confirmed, and — for a doubles category — partnered
 * and not already synced), placed on whichever group currently has the
 * fewest teams, ties broken by group sort_order -- mirrors the DB trigger's
 * own tie-break exactly, so an admin-invoked backfill and the automatic
 * per-registration sync always agree on placement. Pure function so it's
 * directly unit-testable without touching Supabase.
 */
export function computeSyncRows({ categoryId, teamSize, players, groups, existingTeams }) {
  const sortedGroups = [...(groups || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const existingSourceIds = new Set((existingTeams || []).map(t => t.source_player_id).filter(Boolean));
  const groupCounts = new Map(sortedGroups.map(g => [g.id, 0]));
  for (const t of existingTeams || []) {
    if (t.group_id && groupCounts.has(t.group_id)) groupCounts.set(t.group_id, groupCounts.get(t.group_id) + 1);
  }

  const qualifying = (players || []).filter(p => {
    if (p.status !== 'confirmed' || existingSourceIds.has(p.id)) return false;
    if (teamSize === 2) return !p.needs_partner && p.partner_name && p.partner_name.trim();
    return true;
  });

  const rows = [];
  for (const p of qualifying) {
    let groupId = null;
    if (sortedGroups.length > 0) {
      let chosen = sortedGroups[0];
      for (const g of sortedGroups) {
        if (groupCounts.get(g.id) < groupCounts.get(chosen.id)) chosen = g;
      }
      groupId = chosen.id;
      groupCounts.set(groupId, groupCounts.get(groupId) + 1);
    }
    rows.push({
      category_id: categoryId,
      group_id: groupId,
      name: teamSize === 2 ? `${p.name} & ${p.partner_name}` : p.name,
      player1_name: p.name,
      player2_name: teamSize === 2 ? p.partner_name : null,
      source_player_id: p.id
    });
  }
  return rows;
}
