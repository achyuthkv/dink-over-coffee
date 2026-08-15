import supabase from './_lib/supabase.js';
import { computeSyncRows } from './_lib/tournamentSync.js';

/**
 * Single Vercel function fronting tournament server-side actions
 * (action-dispatched, same pattern as api/shop.js) so future tournament
 * logic can live here too without spending a new Serverless Function slot.
 * Admin-only -- every action requires a valid organizer session.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const { action } = req.body || {};
    switch (action) {
      case 'sync-teams': return await syncTeams(req, res);
      default: return res.status(400).json({ ok: false, error: 'Invalid action' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

// Backfills teams for every currently-qualifying confirmed doubles
// registration on the tournament's linked session, for registrations that
// predate the session being linked (or predate the tournament having any
// courts to place them on). Idempotent -- safe to call repeatedly.
//
// New/updated registrations keep syncing automatically in real time via a
// Postgres trigger (sync_tournament_team_from_player) that fires on any
// `players` write, including ones made directly from the browser
// (promoting a waitlisted player, marking someone withdrawn) -- that piece
// stays a DB trigger rather than move here, since there's no HTTP request
// to hook for a browser-direct write.
async function syncTeams(req, res) {
  const { tournamentId } = req.body || {};
  if (!tournamentId) return res.status(400).json({ ok: false, error: 'tournamentId required' });

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, session_id, status')
    .eq('id', tournamentId)
    .single();

  if (tErr || !tournament) return res.status(404).json({ ok: false, error: 'Tournament not found' });
  if (!tournament.session_id || !['setup', 'active'].includes(tournament.status)) {
    return res.status(200).json({ ok: true, created: 0 });
  }

  const [{ data: players, error: pErr }, { data: courts, error: cErr }, { data: existingTeams, error: etErr }] = await Promise.all([
    supabase.from('players').select('id, name, partner_name, status, needs_partner').eq('session_id', tournament.session_id),
    supabase.from('tournament_courts').select('id, sort_order').eq('tournament_id', tournamentId),
    supabase.from('tournament_teams').select('id, court_id, source_player_id').eq('tournament_id', tournamentId)
  ]);

  if (pErr || cErr || etErr) return res.status(500).json({ ok: false, error: 'Failed to load tournament data' });

  const rows = computeSyncRows({ tournamentId, players, courts, existingTeams });
  if (rows.length === 0) return res.status(200).json({ ok: true, created: 0 });

  const { error: insertErr } = await supabase.from('tournament_teams').insert(rows);
  if (insertErr) return res.status(500).json({ ok: false, error: insertErr.message });

  return res.status(200).json({ ok: true, created: rows.length });
}
