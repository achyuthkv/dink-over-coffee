import { supabase } from '../supabase.js'
import { computeAdvancement } from './tournament.js'

/**
 * Records a match score and, for a knockout match (round > 0), advances the
 * winner into its next-round slot -- shared between the organizer's
 * CategoryDetail screen and the referee scoring app so the two never drift
 * apart on how advancement is applied.
 */
export async function scoreMatchAndAdvance(matches, match, scoreA, scoreB) {
  const winner_team_id = scoreA > scoreB ? match.team_a_id : match.team_b_id
  await supabase.from('tournament_matches').update({
    team_a_score: scoreA, team_b_score: scoreB, winner_team_id, status: 'completed'
  }).eq('id', match.id)

  if (match.round > 0) {
    const snapshot = matches.map(m => m.id === match.id
      ? { ...m, status: 'completed', winner_team_id, team_a_score: scoreA, team_b_score: scoreB }
      : m)
    const updates = computeAdvancement(snapshot, match.id, winner_team_id)
    for (const { id, ...fields } of updates) {
      await supabase.from('tournament_matches').update(fields).eq('id', id)
    }
  }
}
