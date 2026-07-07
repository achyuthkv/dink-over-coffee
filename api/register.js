import supabase from './_lib/supabase.js';
import { getSlotCounts, checkAvailability } from './_lib/slots.js';
import { atomicRegister } from './_lib/atomicRegister.js';
import { rateLimit } from './_lib/rateLimit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

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

    if (player.partnerPhone) {
      const partnerPhone = player.partnerPhone.trim();
      const { data: partnerAsPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('phone', partnerPhone)
        .maybeSingle();
      if (partnerAsPlayer) return res.status(409).json({ ok: false, error: 'Your partner is already registered for this session' });

      const { data: partnerOnTeam } = await supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('partner_phone', partnerPhone)
        .maybeSingle();
      if (partnerOnTeam) return res.status(409).json({ ok: false, error: 'Your partner is already on another team for this session' });
    }

    const counts = await getSlotCounts(sessionId);
    const availability = checkAvailability(session, player.skill, counts);

    if (!availability.available) {
      return res.status(409).json({ ok: false, error: availability.reason || 'No slots available' });
    }

    if (availability.type === 'waitlist') {
      return res.status(409).json({ ok: false, error: 'Slots full — use waitlist endpoint' });
    }

    // Use atomic register to prevent race conditions
    const result = await atomicRegister(sessionId, session, {
      name: player.name.trim(),
      phone: player.phone.trim(),
      skill: player.skill,
      duprId: player.duprId || null,
      partnerName: player.partnerName ? player.partnerName.trim() : null,
      partnerPhone: player.partnerPhone ? player.partnerPhone.trim() : null,
      partnerDuprId: player.partnerDuprId ? player.partnerDuprId.trim() : null,
      needsPartner: player.needsPartner || false
    }, 'confirmed');

    if (!result.ok) {
      if (result.code === 409) return res.status(409).json({ ok: false, error: result.error });
      return res.status(result.code || 500).json({ ok: false, error: result.error });
    }

    if (result.alreadyExists) {
      return res.status(200).json({ ok: true, alreadyRegistered: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
