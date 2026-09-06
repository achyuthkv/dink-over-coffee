import { describe, it, expect, vi } from 'vitest';

// computeEntryFee/resolveEntryStatus/validateTeamPayload are pure, but this
// module also exports getTeamCounts (which talks to Supabase) from the same
// file, so importing it still runs api/_lib/supabase.js's createClient()
// call -- stub it out rather than requiring real SUPABASE_URL/KEY env vars
// just to test pure functions.
vi.mock('../api/_lib/supabase.js', () => ({ default: {} }));

const { computeEntryFee, resolveEntryStatus, validateTeamPayload } = await import('../api/_lib/tournamentCapacity.js');

describe('computeEntryFee', () => {
  it('returns the standard fee when there is no early-bird pricing', () => {
    expect(computeEntryFee({ entry_fee: 500, early_bird_fee: null, early_bird_deadline: null })).toBe(500);
  });

  it('returns the early-bird fee before the deadline', () => {
    const category = { entry_fee: 500, early_bird_fee: 350, early_bird_deadline: '2999-01-01' };
    expect(computeEntryFee(category, new Date('2020-01-01'))).toBe(350);
  });

  it('falls back to the standard fee after the early-bird deadline', () => {
    const category = { entry_fee: 500, early_bird_fee: 350, early_bird_deadline: '2020-01-01' };
    expect(computeEntryFee(category, new Date('2020-06-01'))).toBe(500);
  });
});

describe('resolveEntryStatus', () => {
  it('is always confirmed when a category has no max_teams', () => {
    expect(resolveEntryStatus({ max_teams: null }, { confirmed: 100, activeHolds: 5 })).toBe('confirmed');
  });

  it('confirms while under capacity, counting active holds against the cap', () => {
    expect(resolveEntryStatus({ max_teams: 8 }, { confirmed: 6, activeHolds: 1 })).toBe('confirmed');
    expect(resolveEntryStatus({ max_teams: 8 }, { confirmed: 7, activeHolds: 1 })).toBe('waitlisted');
    expect(resolveEntryStatus({ max_teams: 8 }, { confirmed: 8, activeHolds: 0 })).toBe('waitlisted');
  });
});

describe('validateTeamPayload', () => {
  const singlesCategory = { team_size: 1 };
  const doublesCategory = { team_size: 2 };
  const p1 = { player1Name: 'Alice', player1Phone: '9999999999', player1DuprId: '1234567', player1TshirtSize: 'M' };
  const p2 = { player2Name: 'Amy', player2Phone: '9888888888', player2DuprId: '7654321', player2TshirtSize: 'L' };

  it('requires player 1 name and a valid 10-digit phone', () => {
    expect(validateTeamPayload(singlesCategory, { ...p1, player1Name: 'A' }).error).toMatch(/name/i);
    expect(validateTeamPayload(singlesCategory, { ...p1, player1Phone: '123' }).error).toMatch(/phone/i);
  });

  it('requires a DUPR ID for player 1', () => {
    const result = validateTeamPayload(singlesCategory, { ...p1, player1DuprId: '' });
    expect(result.error).toMatch(/dupr/i);
  });

  it('requires a T-shirt size for player 1', () => {
    const result = validateTeamPayload(singlesCategory, { ...p1, player1TshirtSize: '' });
    expect(result.error).toMatch(/t-shirt/i);
  });

  it('accepts a valid singles entry with no partner required', () => {
    const { team, error } = validateTeamPayload(singlesCategory, p1);
    expect(error).toBeUndefined();
    expect(team).toMatchObject({
      name: 'Alice', player1_name: 'Alice', player2_name: null, phone: '9999999999',
      dupr_id: '1234567', partner_dupr_id: null, tshirt_size: 'M', partner_tshirt_size: null
    });
  });

  it('requires a partner name for a doubles category', () => {
    const result = validateTeamPayload(doublesCategory, { ...p1, ...p2, player2Name: '' });
    expect(result.error).toMatch(/partner/i);
  });

  it('requires a valid 10-digit phone for the partner in a doubles category', () => {
    const result = validateTeamPayload(doublesCategory, { ...p1, ...p2, player2Phone: '123' });
    expect(result.error).toMatch(/phone/i);
  });

  it('requires a DUPR ID for the partner in a doubles category', () => {
    const result = validateTeamPayload(doublesCategory, { ...p1, ...p2, player2DuprId: '' });
    expect(result.error).toMatch(/dupr/i);
  });

  it('requires a T-shirt size for the partner in a doubles category', () => {
    const result = validateTeamPayload(doublesCategory, { ...p1, ...p2, player2TshirtSize: '' });
    expect(result.error).toMatch(/t-shirt/i);
  });

  it('builds a default team name from both players when none is given', () => {
    const { team } = validateTeamPayload(doublesCategory, { ...p1, ...p2 });
    expect(team.name).toBe('Alice & Amy');
    expect(team).toMatchObject({ dupr_id: '1234567', partner_dupr_id: '7654321', tshirt_size: 'M', partner_tshirt_size: 'L' });
  });

  it('respects an explicit team name', () => {
    const { team } = validateTeamPayload(doublesCategory, { teamName: 'The Smashers', ...p1, ...p2 });
    expect(team.name).toBe('The Smashers');
  });

  it('rejects an invalid email but allows an empty one', () => {
    expect(validateTeamPayload(singlesCategory, { ...p1, email: 'nope' }).error).toMatch(/email/i);
    expect(validateTeamPayload(singlesCategory, p1).error).toBeUndefined();
  });
});
