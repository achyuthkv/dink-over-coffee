import { describe, it, expect } from 'vitest';
import {
  nextPowerOfTwo,
  stageLabelForRound,
  generateSingleElimBracket,
  buildKnockoutEntrants,
  computeAdvancement,
  computeStandings
} from '../frontend/src/lib/tournament.js';

describe('nextPowerOfTwo', () => {
  it('rounds up to the next power of two, minimum 2', () => {
    expect(nextPowerOfTwo(1)).toBe(2);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(4)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(9)).toBe(16);
  });
});

describe('stageLabelForRound', () => {
  it('labels rounds counting back from the final', () => {
    expect(stageLabelForRound(3, 3)).toBe('final');
    expect(stageLabelForRound(2, 3)).toBe('semifinal');
    expect(stageLabelForRound(1, 3)).toBe('quarterfinal');
    expect(stageLabelForRound(1, 4)).toBe('round_of_16');
  });
});

function teams(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, seed: i + 1 }));
}

describe('generateSingleElimBracket', () => {
  it('returns nothing for fewer than 2 teams', () => {
    expect(generateSingleElimBracket([]).matches).toEqual([]);
    expect(generateSingleElimBracket(teams(1)).matches).toEqual([]);
  });

  it('builds a single round for exactly 2 teams, no byes', () => {
    const { matches, totalRounds, bracketSize } = generateSingleElimBracket(teams(2), { seeded: true });
    expect(bracketSize).toBe(2);
    expect(totalRounds).toBe(1);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ round: 1, bracketSlot: 0, team_a_id: 't1', team_b_id: 't2', status: 'scheduled' });
  });

  it('seeds 1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6 for a full field of 8', () => {
    const { matches, totalRounds, bracketSize } = generateSingleElimBracket(teams(8), { seeded: true });
    expect(bracketSize).toBe(8);
    expect(totalRounds).toBe(3);
    const round1 = matches.filter(m => m.round === 1).sort((a, b) => a.bracketSlot - b.bracketSlot);
    expect(round1.map(m => [m.team_a_id, m.team_b_id])).toEqual([
      ['t1', 't8'], ['t4', 't5'], ['t2', 't7'], ['t3', 't6']
    ]);
    // Every later-round match starts empty, waiting on round-1 results.
    expect(matches.filter(m => m.round === 2)).toHaveLength(2);
    expect(matches.filter(m => m.round === 3)).toHaveLength(1);
    expect(matches.filter(m => m.round === 2 || m.round === 3).every(m => !m.team_a_id && !m.team_b_id)).toBe(true);
  });

  it('gives byes to pad up to the next power of two and seeds the bye winner straight into round 2', () => {
    const { matches, bracketSize } = generateSingleElimBracket(teams(3), { seeded: true });
    expect(bracketSize).toBe(4);
    const round1 = matches.filter(m => m.round === 1).sort((a, b) => a.bracketSlot - b.bracketSlot);
    // Seed order for size 4 is [1,4,2,3] -> slot0/1 = seed1 vs seed4 (bye), slot2/3 = seed2 vs seed3 (real).
    const byeMatch = round1.find(m => m.status === 'completed');
    expect(byeMatch).toBeTruthy();
    expect(byeMatch.winner_team_id).toBe('t1');
    const final = matches.find(m => m.round === 2);
    expect(final.team_a_id === 't1' || final.team_b_id === 't1').toBe(true);
    expect(final.status).toBe('scheduled');
  });

  it('is deterministic for a given seeded team list', () => {
    const a = generateSingleElimBracket(teams(6), { seeded: true });
    const b = generateSingleElimBracket(teams(6), { seeded: true });
    expect(a.matches).toEqual(b.matches);
  });

  it('produces every entrant exactly once across round-1 slots', () => {
    const t = teams(5);
    const { matches } = generateSingleElimBracket(t, { seeded: true });
    const round1 = matches.filter(m => m.round === 1);
    const ids = round1.flatMap(m => [m.team_a_id, m.team_b_id]).filter(Boolean);
    expect(new Set(ids).size).toBe(5);
  });
});

describe('buildKnockoutEntrants', () => {
  it('orders group winners first, then runners-up', () => {
    const groups = [{ id: 'gA' }, { id: 'gB' }];
    const standingsByGroupId = new Map([
      ['gA', [{ team: { id: 'a1' } }, { team: { id: 'a2' } }]],
      ['gB', [{ team: { id: 'b1' } }, { team: { id: 'b2' } }]]
    ]);
    const entrants = buildKnockoutEntrants(groups, standingsByGroupId, 2);
    expect(entrants.map(e => e.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
    expect(entrants.map(e => e.seed)).toEqual([1, 2, 3, 4]);
  });

  it('skips a group with fewer teams than advancePerGroup', () => {
    const groups = [{ id: 'gA' }, { id: 'gB' }];
    const standingsByGroupId = new Map([
      ['gA', [{ team: { id: 'a1' } }]],
      ['gB', [{ team: { id: 'b1' } }, { team: { id: 'b2' } }]]
    ]);
    const entrants = buildKnockoutEntrants(groups, standingsByGroupId, 2);
    expect(entrants.map(e => e.id)).toEqual(['a1', 'b1', 'b2']);
  });
});

describe('computeAdvancement', () => {
  const baseMatches = [
    { id: 'm1', category_id: 'c1', round: 1, bracket_slot: 0, status: 'scheduled', team_a_id: 't1', team_b_id: 't2' },
    { id: 'm2', category_id: 'c1', round: 1, bracket_slot: 1, status: 'scheduled', team_a_id: 't3', team_b_id: 't4' },
    { id: 'final', category_id: 'c1', round: 2, bracket_slot: 0, status: 'scheduled', team_a_id: null, team_b_id: null }
  ];

  it('advances the winner into the correct slot of the next round', () => {
    const updates = computeAdvancement(baseMatches, 'm1', 't1');
    expect(updates).toEqual([{ id: 'final', team_a_id: 't1' }]);
  });

  it('places an odd-slot winner into team_b of the next match', () => {
    const updates = computeAdvancement(baseMatches, 'm2', 't3');
    expect(updates).toEqual([{ id: 'final', team_b_id: 't3' }]);
  });

  it('returns nothing for the final (no next round)', () => {
    expect(computeAdvancement(baseMatches, 'final', 't1')).toEqual([]);
  });

  it('returns nothing when the slot already holds that winner', () => {
    const matches = [...baseMatches];
    matches[2] = { ...matches[2], team_a_id: 't1' };
    expect(computeAdvancement(matches, 'm1', 't1')).toEqual([]);
  });

  it('cascades a reset when correcting a score after the next round was already played', () => {
    const matches = [
      { id: 'm1', category_id: 'c1', round: 1, bracket_slot: 0, status: 'scheduled', team_a_id: 't1', team_b_id: 't2' },
      { id: 'm2', category_id: 'c1', round: 1, bracket_slot: 1, status: 'completed', team_a_id: 't3', team_b_id: 't4', winner_team_id: 't3' },
      { id: 'semi', category_id: 'c1', round: 2, bracket_slot: 0, status: 'completed', team_a_id: 't1', team_b_id: 't3', team_a_score: 11, team_b_score: 5, winner_team_id: 't1' },
      { id: 'final', category_id: 'c1', round: 3, bracket_slot: 0, status: 'completed', team_a_id: 't1', team_b_id: null, team_a_score: 11, team_b_score: 0, winner_team_id: 't1' }
    ];
    // Correcting m1's winner from t1 to t2 should clear the semi (t1 no
    // longer belongs there) and cascade the reset into the already-played final.
    const updates = computeAdvancement(matches, 'm1', 't2');
    const semiUpdate = updates.find(u => u.id === 'semi');
    const finalUpdate = updates.find(u => u.id === 'final');
    expect(semiUpdate).toMatchObject({ team_a_id: 't2', status: 'scheduled', team_a_score: null, team_b_score: null, winner_team_id: null });
    expect(finalUpdate).toMatchObject({ team_a_id: null, status: 'scheduled', team_a_score: null, team_b_score: null, winner_team_id: null });
  });
});

describe('computeStandings scoped to a group', () => {
  it('only counts matches within the given set (group-scoped usage)', () => {
    const teamsList = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
    const groupAMatches = [
      { team_a_id: 't1', team_b_id: 't2', team_a_score: 11, team_b_score: 3, winner_team_id: 't1', status: 'completed', group_id: 'gA' }
    ];
    const standings = computeStandings(teamsList.slice(0, 2), groupAMatches.filter(m => m.group_id === 'gA'));
    expect(standings.map(s => s.team.id)).toEqual(['t1', 't2']);
  });
});
