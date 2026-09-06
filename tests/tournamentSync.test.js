import { describe, it, expect } from 'vitest';
import { computeSyncRows } from '../api/_lib/tournamentSync.js';

const groups = [
  { id: 'g1', sort_order: 0 },
  { id: 'g2', sort_order: 1 }
];

describe('computeSyncRows (doubles category)', () => {
  it('creates a team per qualifying player', () => {
    const players = [
      { id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false },
      { id: 2, name: 'Bob', partner_name: 'Ben', status: 'confirmed', needs_partner: false }
    ];
    const rows = computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams: [] });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ category_id: 'cat1', name: 'Alice & Amy', player1_name: 'Alice', player2_name: 'Amy', source_player_id: 1 });
  });

  it('skips players who are not confirmed', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'waitlisted', needs_partner: false }];
    expect(computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams: [] })).toHaveLength(0);
  });

  it('skips players who still need a partner', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: null, status: 'confirmed', needs_partner: true }];
    expect(computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams: [] })).toHaveLength(0);
  });

  it('skips players with no partner name set', () => {
    const players = [
      { id: 1, name: 'Alice', partner_name: null, status: 'confirmed', needs_partner: false },
      { id: 2, name: 'Bob', partner_name: '  ', status: 'confirmed', needs_partner: false }
    ];
    expect(computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams: [] })).toHaveLength(0);
  });

  it('skips players who already have a team (idempotent)', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    const existingTeams = [{ id: 'team-1', group_id: 'g1', source_player_id: 1 }];
    expect(computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams })).toHaveLength(0);
  });

  it('places new teams on whichever group currently has the fewest teams', () => {
    const players = [
      { id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false },
      { id: 2, name: 'Bob', partner_name: 'Ben', status: 'confirmed', needs_partner: false },
      { id: 3, name: 'Cara', partner_name: 'Coy', status: 'confirmed', needs_partner: false }
    ];
    // g1 already has 2 teams, g2 has 0 -- new teams should fill g2 first, then rebalance
    const existingTeams = [
      { id: 'x1', group_id: 'g1', source_player_id: 100 },
      { id: 'x2', group_id: 'g1', source_player_id: 101 }
    ];
    const rows = computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams });
    expect(rows.map(r => r.group_id)).toEqual(['g2', 'g2', 'g1']);
  });

  it('breaks ties by group sort_order (lowest first)', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    const rows = computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups, existingTeams: [] });
    expect(rows[0].group_id).toBe('g1');
  });

  it('leaves group_id null when the category has no groups yet (e.g. single_elim)', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }];
    const rows = computeSyncRows({ categoryId: 'cat1', teamSize: 2, players, groups: [], existingTeams: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].group_id).toBeNull();
  });
});

describe('computeSyncRows (singles category)', () => {
  it('syncs a player alone, with no partner requirement', () => {
    const players = [{ id: 1, name: 'Alice', partner_name: null, status: 'confirmed', needs_partner: false }];
    const rows = computeSyncRows({ categoryId: 'cat1', teamSize: 1, players, groups, existingTeams: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Alice', player1_name: 'Alice', player2_name: null });
  });
});
