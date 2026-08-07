import supabase from './_lib/supabase.js';
import { createRazorpayOrder } from './_lib/razorpay.js';
import { getSlotCounts, checkAvailability } from './_lib/slots.js';
import { rateLimit } from './_lib/rateLimit.js';

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES) || 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

    const { sessionId, player } = req.body;
    if (!sessionId || !player?.name || !player?.phone) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('active', true)
      .single();

    if (sessErr || !session) return res.status(404).json({ ok: false, error: 'Session not found or inactive' });

    const counts = await getSlotCounts(sessionId, session);
    const availability = checkAvailability(session, player.skill, counts);

    if (!availability.available || availability.type !== 'confirmed') {
      return res.status(409).json({ ok: false, error: 'No slots available' });
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

    const isDuprEvent = session.event_type === 'dupr' || session.event_type === 'dupr_doubles' || session.event_type === 'dupr_teams'
    const isDoublesEvent = session.event_type === 'dupr_doubles' || session.event_type === 'dupr_teams'
    const isTeamsOnly = session.event_type === 'dupr_teams'

    if (isDuprEvent && (!player.duprId || player.duprId.trim().length < 3)) {
      return res.status(400).json({ ok: false, error: 'DUPR ID is required for this event' });
    }
    if (isTeamsOnly) {
      if (!player.partnerName || player.partnerName.trim().length < 2) {
        return res.status(400).json({ ok: false, error: 'Partner name is required for this event' });
      }
      if (!player.partnerPhone || !/^[0-9]{10}$/.test(player.partnerPhone.trim())) {
        return res.status(400).json({ ok: false, error: 'A valid 10-digit partner phone is required for this event' });
      }
      if (!player.partnerDuprId || player.partnerDuprId.trim().length < 3) {
        return res.status(400).json({ ok: false, error: 'Partner DUPR ID is required for this event' });
      }
    }
    if (isDoublesEvent && player.partnerName && (!player.partnerDuprId || player.partnerDuprId.trim().length < 3)) {
      return res.status(400).json({ ok: false, error: 'Partner DUPR ID is required for doubles events' });
    }

    const isTeam = isDoublesEvent && !!player.partnerName;
    const perTeamPricing = isTeamsOnly;
    const priceMultiplier = perTeamPricing ? 1 : (isTeam ? 2 : 1);
    const amountPaise = Math.round(Number(session.price) * priceMultiplier * 100);
    const receipt = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const order = await createRazorpayOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { sessionId, name: player.name.trim(), phone: player.phone.trim(), email: player.email ? player.email.trim() : '', ...(player.skill && { skill: player.skill }), ...(isDuprEvent && player.duprId && { duprId: player.duprId }), ...(isDoublesEvent && player.partnerName && { partnerName: player.partnerName.trim() }), ...(isDoublesEvent && player.partnerPhone && { partnerPhone: player.partnerPhone.trim() }), ...(isDoublesEvent && player.partnerDuprId && { partnerDuprId: player.partnerDuprId.trim() }), ...(isDoublesEvent && player.needsPartner && { needsPartner: 'true' }) }
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);

    const { data: hold, error: holdErr } = await supabase
      .from('holds')
      .insert({
        session_id: sessionId,
        razorpay_order_id: order.id,
        expires_at: expiresAt.toISOString(),
        status: 'active',
        slots: isTeamsOnly ? 1 : (isTeam ? 2 : 1)
      })
      .select('id')
      .single();

    if (holdErr) return res.status(500).json({ ok: false, error: 'Failed to create hold' });

    return res.status(200).json({
      ok: true,
      holdId: hold.id,
      sessionId,
      orderId: order.id,
      amount: amountPaise,
      currency: 'INR',
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
