import supabase from './_lib/supabase.js';
import { getSlotCounts, checkAvailability } from './_lib/slots.js';

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
    .select('id')
    .eq('session_id', sessionId)
    .eq('phone', player.phone.trim())
    .maybeSingle();

  if (existing) return res.status(200).json({ ok: true, alreadyRegistered: true });

  const counts = await getSlotCounts(sessionId);
  const availability = checkAvailability(session, player.skill, counts);

  if (!availability.available) {
    return res.status(409).json({ ok: false, error: availability.reason || 'No slots available' });
  }

  if (availability.type === 'waitlist') {
    return res.status(409).json({ ok: false, error: 'Slots full — use waitlist endpoint' });
  }

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
      status: 'confirmed',
      ...(player.duprId && { dupr_id: player.duprId })
    });

  if (insertErr) {
    if (insertErr.code === '23505') return res.status(200).json({ ok: true, alreadyRegistered: true });
    return res.status(500).json({ ok: false, error: insertErr.message });
  }

  return res.status(200).json({ ok: true });
}
