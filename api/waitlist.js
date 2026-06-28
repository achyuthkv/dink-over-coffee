import supabase from './_lib/supabase.js';
import { getSlotCounts } from './_lib/slots.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { sessionId, player } = req.body;
  if (!sessionId || !player?.name || !player?.phone || !player?.skill) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const { data: session, error: sessErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('active', true)
    .single();

  if (sessErr || !session) return res.status(404).json({ ok: false, error: 'Session not found or inactive' });

  const { data: existing } = await supabase
    .from('players')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('phone', player.phone.trim())
    .maybeSingle();

  if (existing) {
    if (existing.status === 'confirmed') return res.status(200).json({ ok: true, alreadyRegistered: true });
    return res.status(200).json({ ok: true, alreadyWaitlisted: true });
  }

  const counts = await getSlotCounts(sessionId);
  const isBeginner = player.skill === 'Beginner';

  let hasSpace;
  if (session.beginner_slots === null || session.beginner_slots === undefined) {
    hasSpace = session.waitlist_max > 0 && counts.waitlistCount < session.waitlist_max;
  } else if (isBeginner) {
    hasSpace = session.beginner_waitlist_max > 0 && counts.beginnerWaitlistCount < session.beginner_waitlist_max;
  } else {
    hasSpace = session.waitlist_max > 0 && counts.otherWaitlistCount < session.waitlist_max;
  }

  if (!hasSpace) return res.status(409).json({ ok: false, error: 'Waitlist is full' });

  const { error: insertErr } = await supabase
    .from('players')
    .insert({
      session_id: sessionId,
      name: player.name.trim(),
      phone: player.phone.trim(),
      skill: player.skill,
      amount: session.price,
      razorpay_payment_id: 'FREE_MODE',
      razorpay_order_id: 'FREE_MODE',
      status: 'waitlisted',
      ...(player.duprId && { dupr_id: player.duprId })
    });

  if (insertErr) {
    if (insertErr.code === '23505') return res.status(200).json({ ok: true, alreadyWaitlisted: true });
    return res.status(500).json({ ok: false, error: insertErr.message });
  }

  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'waitlisted')
    .eq('skill', isBeginner ? 'Beginner' : player.skill);

  return res.status(200).json({ ok: true, position: count || 1 });
}
