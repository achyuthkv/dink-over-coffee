import { describe, it, expect } from 'vitest';
import { computeSyncRows } from '../api/_lib/tournamentSync.js';

const courts = [
  { id: 'c1', sort_order: 0 },
  { id: 'c2', sort_order: 1 }
];

describe('computeSyncRows', () => {
  it('creates a team per qualifying player', () => {
    const players = [
      { id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false },
      { id: 2, name: 'Bob', partner_name: 'Ben', status: 'confirmed', needs_partner: false }
    ];
    const rows = computeSyncRows({ tournamentId: 't1', players, courts, existingTeams: [] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tournament_id: 't1', name: 'Alice & Amy', player1_name: 'Alice', player2_name: 'Amy', source_player_id: 1 });
  });

  it('skips players who are not confirmed', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'waitlisted', needs_partner: false }];
    expect(computeSyncRows({ tournamentId: 't1', players, courts, existingTeams: [] })).toHaveLength(0);
  });

  it('skips players who still need a partner', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: null, status: 'confirmed', needs_partner: true }];
    expect(computeSyncRows({ tournamentId: 't1', players, courts, existingTeams: [] })).toHaveLength(0);
  });

  it('skips players with no partner name set', () => {
    const players = [
      { id: 1, name: 'Alice', partner_name: null, status: 'confirmed', needs_partner: false },
      { id: 2, name: 'Bob', partner_name: '  ', status: 'confirmed', needs_partner: false }
    ];
    expect(computeSyncRows({ tournamentId: 't1', players, courts, existingTeams: [] })).toHaveLength(0);
  });

  it('skips players who already have a team (idempotent)', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    const existingTeams = [{ id: 'team-1', court_id: 'c1', source_player_id: 1 }];
    expect(computeSyncRows({ tournamentId: 't1', players, courts, existingTeams })).toHaveLength(0);
  });

  it('places new teams on whichever court currently has the fewest teams', () => {
    const players = [
      { id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false },
      { id: 2, name: 'Bob', partner_name: 'Ben', status: 'confirmed', needs_partner: false },
      { id: 3, name: 'Cara', partner_name: 'Coy', status: 'confirmed', needs_partner: false }
    ];
    // c1 already has 2 teams, c2 has 0 -- new teams should fill c2 first, then rebalance
    const existingTeams = [
      { id: 'x1', court_id: 'c1', source_player_id: 100 },
      { id: 'x2', court_id: 'c1', source_player_id: 101 }
    ];
    const rows = computeSyncRows({ tournamentId: 't1', players, courts, existingTeams });
    expect(rows.map(r => r.court_id)).toEqual(['c2', 'c2', 'c1']);
  });

  it('breaks ties by court sort_order (lowest first)', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    const rows = computeSyncRows({ tournamentId: 't1', players, courts, existingTeams: [] });
    expect(rows[0].court_id).toBe('c1');
  });

  it('returns nothing when there are no courts yet', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    expect(computeSyncRows({ tournamentId: 't1', players, courts: [], existingTeams: [] })).toHaveLength(0);
  });

  it('skips locked courts when choosing placement', () => {
    const lockedCourts = [
      { id: 'c1', sort_order: 0, fixtures_locked: true },
      { id: 'c2', sort_order: 1, fixtures_locked: false }
    ];
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    const rows = computeSyncRows({ tournamentId: 't1', players, courts: lockedCourts, existingTeams: [] });
    expect(rows[0].court_id).toBe('c2');
  });

  it('returns nothing when every court is locked', () => {
    const lockedCourts = [
      { id: 'c1', sort_order: 0, fixtures_locked: true },
      { id: 'c2', sort_order: 1, fixtures_locked: true }
    ];
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    expect(computeSyncRows({ tournamentId: 't1', players, courts: lockedCourts, existingTeams: [] })).toHaveLength(0);
  });
});
