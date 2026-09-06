import supabase from './supabase.js';

/** Effective entry fee right now — the early-bird fee if one is set and its deadline hasn't passed, else the standard fee. */
export function computeEntryFee(category, now = new Date()) {
  if (category.early_bird_fee !== null && category.early_bird_fee !== undefined && category.early_bird_deadline) {
    const deadline = new Date(`${category.early_bird_deadline}T23:59:59`);
    if (now <= deadline) return Number(category.early_bird_fee);
  }
  return Number(category.entry_fee) || 0;
}

/** Confirmed + waitlisted team counts, plus slots reserved by active (unexpired) payment holds, for capacity checks. */
export async function getTeamCounts(categoryId) {
  const [teamsResult, holdsResult] = await Promise.all([
    supabase.from('tournament_teams').select('status').eq('category_id', categoryId),
    supabase.from('tournament_holds').select('id').eq('category_id', categoryId).eq('status', 'active').gt('expires_at', new Date().toISOString())
  ]);
  const teams = teamsResult.data || [];
  return {
    confirmed: teams.filter(t => t.status === 'confirmed').length,
    waitlisted: teams.filter(t => t.status === 'waitlisted').length,
    activeHolds: (holdsResult.data || []).length
  };
}

/** Whether a new confirmed entry fits, or should be waitlisted instead — categories with no max_teams are always open. */
export function resolveEntryStatus(category, counts) {
  if (category.max_teams === null || category.max_teams === undefined) return 'confirmed';
  return counts.confirmed + counts.activeHolds < category.max_teams ? 'confirmed' : 'waitlisted';
}

export const TSHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

/** Validates and normalizes a public team-registration payload against a category's rules. Returns { error } or { team }. */
export function validateTeamPayload(category, team) {
  const name1 = team?.player1Name?.trim();
  if (!name1 || name1.length < 2) return { error: 'Player 1 name is required' };
  const phone1 = team?.player1Phone?.trim();
  if (!phone1 || !/^[0-9]{10}$/.test(phone1)) return { error: 'A valid 10-digit phone number is required' };
  const duprId1 = team?.player1DuprId?.trim();
  if (!duprId1 || duprId1.length < 3) return { error: 'A DUPR ID is required for player 1' };
  const tshirtSize1 = team?.player1TshirtSize?.trim();
  if (!TSHIRT_SIZES.includes(tshirtSize1)) return { error: 'A T-shirt size is required for player 1' };

  let name2 = null, phone2 = null, duprId2 = null, tshirtSize2 = null;
  if (category.team_size === 2) {
    name2 = team?.player2Name?.trim();
    if (!name2 || name2.length < 2) return { error: 'Partner name is required for this category' };
    phone2 = team?.player2Phone?.trim();
    if (!phone2 || !/^[0-9]{10}$/.test(phone2)) return { error: 'A valid 10-digit phone number is required for the partner' };
    duprId2 = team?.player2DuprId?.trim();
    if (!duprId2 || duprId2.length < 3) return { error: 'A DUPR ID is required for the partner' };
    tshirtSize2 = team?.player2TshirtSize?.trim();
    if (!TSHIRT_SIZES.includes(tshirtSize2)) return { error: 'A T-shirt size is required for the partner' };
  }

  const email = team?.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address' };

  const teamName = team?.teamName?.trim() || (name2 ? `${name1} & ${name2}` : name1);

  return {
    team: {
      name: teamName,
      player1_name: name1,
      player2_name: name2,
      phone: phone1,
      player2_phone: phone2,
      dupr_id: duprId1,
      partner_dupr_id: duprId2,
      tshirt_size: tshirtSize1,
      partner_tshirt_size: tshirtSize2,
      email
    }
  };
}
