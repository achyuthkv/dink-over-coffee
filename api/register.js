import supabase from './_lib/supabase.js';
import { getSlotCounts, checkAvailability } from './_lib/slots.js';
import { atomicRegister } from './_lib/atomicRegister.js';
import { rateLimit } from './_lib/rateLimit.js';
import { sendConfirmationEmail } from './_lib/sendConfirmationEmail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

    const { sessionId, player } = req.body;
    if (!sessionId || !player?.name || !player?.phone) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (player.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(player.email.trim())) {
      return res.status(400).json({ ok: false, error: 'Invalid email address' });
    }

    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('*, venues(name, address, google_maps_url)')
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
      if (existing.status === 'confirmed' || existing.status === 'waitlisted') {
        return res.status(200).json({ ok: true, alreadyRegistered: true });
      }
      await supabase.from('players').delete().eq('id', existing.id);
    }

    if (player.partnerPhone) {
      const partnerPhone = player.partnerPhone.trim();
      const { data: partnerAsPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('phone', partnerPhone)
        .in('status', ['confirmed', 'waitlisted'])
        .maybeSingle();
      if (partnerAsPlayer) return res.status(409).json({ ok: false, error: 'Your partner is already registered for this session' });

      const { data: partnerOnTeam } = await supabase
        .from('players')
        .select('id')
        .eq('session_id', sessionId)
        .eq('partner_phone', partnerPhone)
        .in('status', ['confirmed', 'waitlisted'])
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

    const isDuprEvent = session.event_type === 'dupr' || session.event_type === 'dupr_doubles'
    const isDoublesEvent = session.event_type === 'dupr_doubles'

    if (isDuprEvent && (!player.duprId || player.duprId.trim().length < 3)) {
      return res.status(400).json({ ok: false, error: 'DUPR ID is required for this event' });
    }
    if (isDoublesEvent && player.partnerName && (!player.partnerDuprId || player.partnerDuprId.trim().length < 3)) {
      return res.status(400).json({ ok: false, error: 'Partner DUPR ID is required for doubles events' });
    }

    // Use atomic register to prevent race conditions
    const result = await atomicRegister(sessionId, session, {
      name: player.name.trim(),
      phone: player.phone.trim(),
      email: player.email ? player.email.trim() : null,
      skill: player.skill || 'N/A',
      duprId: isDuprEvent && player.duprId ? player.duprId : null,
      partnerName: isDoublesEvent && player.partnerName ? player.partnerName.trim() : null,
      partnerPhone: isDoublesEvent && player.partnerPhone ? player.partnerPhone.trim() : null,
      partnerDuprId: isDoublesEvent && player.partnerDuprId ? player.partnerDuprId.trim() : null,
      needsPartner: isDoublesEvent ? (player.needsPartner || false) : false
    }, 'confirmed');

    if (!result.ok) {
      if (result.code === 409) return res.status(409).json({ ok: false, error: result.error });
      return res.status(result.code || 500).json({ ok: false, error: result.error });
    }

    if (result.alreadyExists) {
      return res.status(200).json({ ok: true, alreadyRegistered: true });
    }

    sendConfirmationEmail(session, {
      name: player.name.trim(),
      email: player.email ? player.email.trim() : null
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
