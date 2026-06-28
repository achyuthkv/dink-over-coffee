import supabase from './supabase.js';

export async function getSlotCounts(sessionId) {
  const [playersResult, holdsResult] = await Promise.all([
    supabase
      .from('players')
      .select('skill, status')
      .eq('session_id', sessionId),
    supabase
      .from('holds')
      .select('id')
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
  ]);

  const players = playersResult.data || [];
  const activeHolds = (holdsResult.data || []).length;

  const confirmedBeginner = players.filter(p => p.status === 'confirmed' && p.skill === 'Beginner').length;
  const confirmedOther = players.filter(p => p.status === 'confirmed' && p.skill !== 'Beginner').length;
  const waitlistedBeginner = players.filter(p => p.status === 'waitlisted' && p.skill === 'Beginner').length;
  const waitlistedOther = players.filter(p => p.status === 'waitlisted' && p.skill !== 'Beginner').length;

  return {
    confirmed: confirmedBeginner + confirmedOther,
    confirmedBeginner,
    confirmedOther,
    activeHolds,
    takenSlots: confirmedBeginner + confirmedOther + activeHolds,
    waitlistCount: waitlistedBeginner + waitlistedOther,
    beginnerWaitlistCount: waitlistedBeginner,
    otherWaitlistCount: waitlistedOther
  };
}

export function checkAvailability(session, skill, counts) {
  const { max_slots, beginner_slots, waitlist_max, beginner_waitlist_max } = session;
  const isBeginner = skill === 'Beginner';

  if (beginner_slots === null || beginner_slots === undefined) {
    const taken = counts.confirmed + counts.activeHolds;
    if (taken < max_slots) return { available: true, type: 'confirmed' };
    if (waitlist_max > 0 && counts.waitlistCount < waitlist_max) return { available: true, type: 'waitlist' };
    return { available: false };
  }

  if (beginner_slots === 0 && isBeginner) {
    return { available: false, reason: 'No beginner slots for this session' };
  }

  if (isBeginner) {
    if (counts.confirmedBeginner < beginner_slots) return { available: true, type: 'confirmed' };
    if (beginner_waitlist_max > 0 && counts.beginnerWaitlistCount < beginner_waitlist_max) return { available: true, type: 'waitlist' };
    return { available: false };
  } else {
    const otherSlots = max_slots - beginner_slots;
    if (counts.confirmedOther < otherSlots) return { available: true, type: 'confirmed' };
    if (waitlist_max > 0 && counts.otherWaitlistCount < waitlist_max) return { available: true, type: 'waitlist' };
    return { available: false };
  }
}
