import { describe, it, expect } from 'vitest';
import { generateRoundRobinPairs, computeStandings } from '../frontend/src/lib/tournament.js';

describe('generateRoundRobinPairs', () => {
  it('generates every unique pairing exactly once', () => {
    const pairs = generateRoundRobinPairs(['a', 'b', 'c', 'd', 'e']);
    expect(pairs).toHaveLength(10); // 5*4/2
    const keys = pairs.map(([x, y]) => [x, y].sort().join('-'));
    expect(new Set(keys).size).toBe(10);
    expect(pairs.some(([x, y]) => (x === 'a' && y === 'b') || (x === 'b' && y === 'a'))).toBe(true);
  });

  it('handles 2 teams (a single match)', () => {
    expect(generateRoundRobinPairs(['a', 'b'])).toEqual([['a', 'b']]);
  });

  it('handles fewer than 2 teams', () => {
    expect(generateRoundRobinPairs(['a'])).toEqual([]);
    expect(generateRoundRobinPairs([])).toEqual([]);
  });

  function countBackToBack(pairs) {
    let n = 0;
    for (let k = 1; k < pairs.length; k++) {
      const [a, b] = pairs[k];
      const [c, d] = pairs[k - 1];
      if (a === c || a === d || b === c || b === d) n++;
    }
    return n;
  }

  it('avoids scheduling the same team in consecutive matches for realistic team counts', () => {
    for (let n = 5; n <= 16; n++) {
      const teamIds = Array.from({ length: n }, (_, i) => `t${i}`);
      const pairs = generateRoundRobinPairs(teamIds);
      expect(countBackToBack(pairs)).toBe(0);
    }
  });

  it('minimizes (but cannot always eliminate) back-to-back matches for tiny team counts', () => {
    // With only 3 or 4 teams, at least 2 consecutive repeats are mathematically unavoidable.
    expect(countBackToBack(generateRoundRobinPairs(['a', 'b', 'c']))).toBeLessThanOrEqual(2);
    expect(countBackToBack(generateRoundRobinPairs(['a', 'b', 'c', 'd']))).toBeLessThanOrEqual(2);
  });

  it('is deterministic for a given team list', () => {
    const teamIds = Array.from({ length: 9 }, (_, i) => `t${i}`);
    expect(generateRoundRobinPairs(teamIds)).toEqual(generateRoundRobinPairs(teamIds));
  });

  it('still produces every unique pairing exactly once for larger fields', () => {
    const teamIds = Array.from({ length: 9 }, (_, i) => `t${i}`);
    const pairs = generateRoundRobinPairs(teamIds);
    expect(pairs).toHaveLength(36); // 9*8/2
    const keys = pairs.map(([x, y]) => [x, y].sort().join('-'));
    expect(new Set(keys).size).toBe(36);
  });
});

describe('computeStandings', () => {
  const teams = [
    { id: 't1', name: 'Team 1' },
    { id: 't2', name: 'Team 2' },
    { id: 't3', name: 'Team 3' }
  ];

  it('ranks by wins first', () => {
    const matches = [
      { team_a_id: 't1', team_b_id: 't2', team_a_score: 11, team_b_score: 5, winner_team_id: 't1', status: 'completed' },
      { team_a_id: 't1', team_b_id: 't3', team_a_score: 11, team_b_score: 5, winner_team_id: 't1', status: 'completed' },
      { team_a_id: 't2', team_b_id: 't3', team_a_score: 11, team_b_score: 5, winner_team_id: 't2', status: 'completed' }
    ];
    const standings = computeStandings(teams, matches);
    expect(standings.map(s => s.team.id)).toEqual(['t1', 't2', 't3']);
    expect(standings[0]).toMatchObject({ played: 2, wins: 2, losses: 0, pointsFor: 22, pointsAgainst: 10, pointDiff: 12 });
    expect(standings[2]).toMatchObject({ played: 2, wins: 0, losses: 2, pointDiff: -12 });
  });

  it('breaks ties on point differential when wins are equal', () => {
    // t1 and t2 each go 1-1, but t1 wins by more and loses by less
    const matches = [
      { team_a_id: 't1', team_b_id: 't2', team_a_score: 11, team_b_score: 2, winner_team_id: 't1', status: 'completed' },
      { team_a_id: 't1', team_b_id: 't3', team_a_score: 5, team_b_score: 11, winner_team_id: 't3', status: 'completed' },
      { team_a_id: 't2', team_b_id: 't3', team_a_score: 11, team_b_score: 3, winner_team_id: 't2', status: 'completed' }
    ];
    const standings = computeStandings(teams, matches);
    // t1: +9-6=+3, t2: -9+8=-1, t3: -8+6=-2 -> all 1-1, ranked by point diff
    expect(standings.map(s => s.team.id)).toEqual(['t1', 't2', 't3']);
  });

  it('ignores matches that are not completed', () => {
    const matches = [
      { team_a_id: 't1', team_b_id: 't2', team_a_score: 11, team_b_score: 5, winner_team_id: 't1', status: 'scheduled' }
    ];
    const standings = computeStandings(teams, matches);
    expect(standings.every(s => s.played === 0)).toBe(true);
  });

  it('returns a zeroed row for teams with no completed matches', () => {
    const standings = computeStandings(teams, []);
    expect(standings).toHaveLength(3);
    expect(standings.every(s => s.played === 0 && s.wins === 0 && s.pointDiff === 0)).toBe(true);
  });
});
