import { describe, it, expect, vi } from 'vitest';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

// Must mock supabase before importing slots.js (it imports supabase at module level)
vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));

const { checkAvailability } = await import('../api/_lib/slots.js');

describe('checkAvailability', () => {
  describe('regular session (no beginner_slots split)', () => {
    const session = {
      max_slots: 10,
      beginner_slots: null,
      waitlist_max: 3,
      beginner_waitlist_max: 0,
    };

    it('returns confirmed when slots are available', () => {
      const counts = {
        confirmed: 5,
        confirmedBeginner: 2,
        confirmedOther: 3,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      const result = checkAvailability(session, 'Intermediate', counts);
      expect(result).toEqual({ available: true, type: 'confirmed' });
    });

    it('returns waitlist when session is full but waitlist has space', () => {
      const counts = {
        confirmed: 10,
        confirmedBeginner: 4,
        confirmedOther: 6,
        activeHolds: 0,
        waitlistCount: 1,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 1,
      };
      const result = checkAvailability(session, 'Beginner', counts);
      expect(result).toEqual({ available: true, type: 'waitlist' });
    });

    it('returns unavailable when session and waitlist are both full', () => {
      const counts = {
        confirmed: 10,
        confirmedBeginner: 4,
        confirmedOther: 6,
        activeHolds: 0,
        waitlistCount: 3,
        beginnerWaitlistCount: 1,
        otherWaitlistCount: 2,
      };
      const result = checkAvailability(session, 'Intermediate', counts);
      expect(result).toEqual({ available: false });
    });

    it('counts active holds toward taken slots', () => {
      const counts = {
        confirmed: 8,
        confirmedBeginner: 3,
        confirmedOther: 5,
        activeHolds: 2,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      // confirmed + activeHolds = 10 which equals max_slots, so falls through to waitlist check
      const result = checkAvailability(session, 'Beginner', counts);
      expect(result).toEqual({ available: true, type: 'waitlist' });
    });

    it('returns unavailable when no waitlist configured', () => {
      const noWaitlistSession = { ...session, waitlist_max: 0 };
      const counts = {
        confirmed: 10,
        confirmedBeginner: 4,
        confirmedOther: 6,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      const result = checkAvailability(noWaitlistSession, 'Intermediate', counts);
      expect(result).toEqual({ available: false });
    });
  });

  describe('split session (beginner_slots set)', () => {
    const session = {
      max_slots: 12,
      beginner_slots: 4,
      waitlist_max: 2,
      beginner_waitlist_max: 2,
    };

    it('returns confirmed for beginner when beginner slots available', () => {
      const counts = {
        confirmed: 5,
        confirmedBeginner: 2,
        confirmedOther: 3,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      const result = checkAvailability(session, 'Beginner', counts);
      expect(result).toEqual({ available: true, type: 'confirmed' });
    });

    it('returns waitlist for beginner when beginner slots full but waitlist has space', () => {
      const counts = {
        confirmed: 8,
        confirmedBeginner: 4,
        confirmedOther: 4,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 1,
        otherWaitlistCount: 0,
      };
      const result = checkAvailability(session, 'Beginner', counts);
      expect(result).toEqual({ available: true, type: 'waitlist' });
    });

    it('returns unavailable for beginner when both slots and waitlist full', () => {
      const counts = {
        confirmed: 10,
        confirmedBeginner: 4,
        confirmedOther: 6,
        activeHolds: 0,
        waitlistCount: 2,
        beginnerWaitlistCount: 2,
        otherWaitlistCount: 0,
      };
      const result = checkAvailability(session, 'Beginner', counts);
      expect(result).toEqual({ available: false });
    });

    it('returns confirmed for non-beginner when other slots available', () => {
      const counts = {
        confirmed: 6,
        confirmedBeginner: 2,
        confirmedOther: 4,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      // otherSlots = 12 - 4 = 8, confirmedOther = 4 < 8
      const result = checkAvailability(session, 'Intermediate', counts);
      expect(result).toEqual({ available: true, type: 'confirmed' });
    });

    it('returns unavailable for non-beginner when other slots and waitlist full', () => {
      const counts = {
        confirmed: 12,
        confirmedBeginner: 4,
        confirmedOther: 8,
        activeHolds: 0,
        waitlistCount: 2,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 2,
      };
      const result = checkAvailability(session, 'Intermediate', counts);
      expect(result).toEqual({ available: false });
    });
  });

  describe('zero beginner slots', () => {
    const session = {
      max_slots: 12,
      beginner_slots: 0,
      waitlist_max: 2,
      beginner_waitlist_max: 0,
    };

    it('blocks beginners when beginner_slots is 0', () => {
      const counts = {
        confirmed: 3,
        confirmedBeginner: 0,
        confirmedOther: 3,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      const result = checkAvailability(session, 'Beginner', counts);
      expect(result).toEqual({ available: false, reason: 'No beginner slots for this session' });
    });

    it('still allows non-beginners when beginner_slots is 0', () => {
      const counts = {
        confirmed: 3,
        confirmedBeginner: 0,
        confirmedOther: 3,
        activeHolds: 0,
        waitlistCount: 0,
        beginnerWaitlistCount: 0,
        otherWaitlistCount: 0,
      };
      // otherSlots = 12 - 0 = 12, confirmedOther = 3 < 12
      const result = checkAvailability(session, 'Intermediate', counts);
      expect(result).toEqual({ available: true, type: 'confirmed' });
    });
  });
});
