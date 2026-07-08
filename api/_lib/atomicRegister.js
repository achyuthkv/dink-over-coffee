import supabase from './supabase.js';
import { getSlotCounts, checkAvailability } from './slots.js';

/**
 * Atomically register a player for a session, protecting against race conditions.
 *
 * Strategy: Insert the player first, then re-count slots. If over capacity,
 * delete the just-inserted row and return a conflict. This avoids the TOCTOU
 * race where two concurrent requests both pass the availability check.
 *
 * Prefers supabase.rpc('atomic_register', ...) when the DB function exists,
 * falling back to the insert-then-verify approach otherwise.
 */
export async function atomicRegister(sessionId, session, playerData, status) {
  // Attempt RPC-based atomic insert first (requires DB function to exist)
  try {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('atomic_register', {
      p_session_id: sessionId,
      p_name: playerData.name,
      p_phone: playerData.phone,
      p_email: playerData.email || null,
      p_skill: playerData.skill,
      p_amount: session.price,
      p_status: status,
      p_dupr_id: playerData.duprId || null,
      p_partner_name: playerData.partnerName || null,
      p_partner_phone: playerData.partnerPhone || null,
      p_partner_dupr_id: playerData.partnerDuprId || null,
      p_needs_partner: playerData.needsPartner || false
    });

    if (!rpcErr && rpcResult) {
      return { ok: true, method: 'rpc', data: rpcResult };
    }
    // If the RPC doesn't exist (function not found), fall through to manual approach
    if (rpcErr && !rpcErr.message?.includes('function') && !rpcErr.message?.includes('does not exist')) {
      return { ok: false, error: rpcErr.message, code: 500 };
    }
  } catch (e) {
    // RPC not available, fall through to manual approach
  }

  // Fallback: insert-then-verify approach
  const insertPayload = {
    session_id: sessionId,
    name: playerData.name,
    phone: playerData.phone,
    email: playerData.email || null,
    skill: playerData.skill,
    amount: session.price,
    razorpay_payment_id: 'FREE_MODE',
    razorpay_order_id: 'FREE_MODE',
    status,
    ...(playerData.duprId && { dupr_id: playerData.duprId }),
    ...(playerData.partnerName && { partner_name: playerData.partnerName }),
    ...(playerData.partnerPhone && { partner_phone: playerData.partnerPhone }),
    ...(playerData.partnerDuprId && { partner_dupr_id: playerData.partnerDuprId }),
    ...(playerData.needsPartner && { needs_partner: true })
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('players')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { ok: true, alreadyExists: true };
    }
    return { ok: false, error: insertErr.message, code: 500 };
  }

  // Re-count after insert to detect over-subscription
  const counts = await getSlotCounts(sessionId);
  const availability = checkAvailability(session, playerData.skill, counts);

  if (status === 'confirmed') {
    // Check if confirmed slots are now over capacity
    const isBeginner = playerData.skill === 'Beginner';
    let overCapacity = false;

    if (session.beginner_slots === null || session.beginner_slots === undefined) {
      overCapacity = counts.confirmed + counts.activeHolds > session.max_slots;
    } else if (isBeginner) {
      overCapacity = counts.confirmedBeginner > session.beginner_slots;
    } else {
      const otherSlots = session.max_slots - session.beginner_slots;
      overCapacity = counts.confirmedOther > otherSlots;
    }

    if (overCapacity) {
      // Roll back: delete the row we just inserted
      await supabase.from('players').delete().eq('id', inserted.id);
      return { ok: false, error: 'No slots available', code: 409 };
    }
  } else if (status === 'waitlisted') {
    // Check if waitlist is now over capacity
    const isBeginner = playerData.skill === 'Beginner';
    let overCapacity = false;

    if (session.beginner_slots === null || session.beginner_slots === undefined) {
      overCapacity = session.waitlist_max > 0 && counts.waitlistCount > session.waitlist_max;
    } else if (isBeginner) {
      overCapacity = session.beginner_waitlist_max > 0 && counts.beginnerWaitlistCount > session.beginner_waitlist_max;
    } else {
      overCapacity = session.waitlist_max > 0 && counts.otherWaitlistCount > session.waitlist_max;
    }

    if (overCapacity) {
      // Roll back: delete the row we just inserted
      await supabase.from('players').delete().eq('id', inserted.id);
      return { ok: false, error: 'Waitlist is full', code: 409 };
    }
  }

  return { ok: true, method: 'insert-verify', insertedId: inserted.id };
}
