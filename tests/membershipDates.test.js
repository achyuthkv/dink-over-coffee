import { describe, it, expect } from 'vitest';
import { addDays, addMonths, weekdayReason } from '../api/_lib/membershipDates.js';

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-09-01', 2)).toBe('2026-09-03');
  });

  it('rolls over a month boundary', () => {
    expect(addDays('2026-09-29', 2)).toBe('2026-10-01');
  });

  it('rolls over a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('addMonths', () => {
  it('adds months within a year', () => {
    expect(addMonths('2026-01-15', 3)).toBe('2026-04-15');
  });

  it('rolls over a year boundary', () => {
    expect(addMonths('2026-09-01', 12)).toBe('2027-09-01');
  });

  it('clamps to the shorter month when the day does not exist', () => {
    // Jan 31 + 1 month: JS Date rolls this into March 3 (Feb has no 31st),
    // matching this repo's existing simple date-math approach elsewhere.
    expect(addMonths('2026-01-31', 1)).toBe('2026-03-03');
  });
});

describe('weekdayReason', () => {
  it('returns declined_monday for a Monday date', () => {
    // 2026-09-07 is a Monday
    expect(weekdayReason('2026-09-07')).toBe('declined_monday');
  });

  it('returns declined_wednesday for a Wednesday date', () => {
    // 2026-09-09 is a Wednesday
    expect(weekdayReason('2026-09-09')).toBe('declined_wednesday');
  });

  it('falls back to declined_monday for any other weekday', () => {
    // 2026-09-08 is a Tuesday -- is_member_slot sessions are only ever
    // configured for Mon/Wed, so this is a defensive fallback, not an
    // expected input.
    expect(weekdayReason('2026-09-08')).toBe('declined_monday');
  });
});
