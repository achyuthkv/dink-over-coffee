import supabase from './_lib/supabase.js';
import { createRazorpayOrder } from './_lib/razorpay.js';
import { getSlotCounts, checkAvailability } from './_lib/slots.js';

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES) || 5;

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

  const counts = await getSlotCounts(sessionId);
  const availability = checkAvailability(session, player.skill, counts);

  if (!availability.available || availability.type !== 'confirmed') {
    return res.status(409).json({ ok: false, error: 'No slots available' });
  }

  const amountPaise = Math.round(Number(session.price) * 100);
  const receipt = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const order = await createRazorpayOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes: { sessionId, name: player.name.trim(), phone: player.phone.trim(), skill: player.skill }
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);

  const { data: hold, error: holdErr } = await supabase
    .from('holds')
    .insert({
      session_id: sessionId,
      razorpay_order_id: order.id,
      expires_at: expiresAt.toISOString(),
      status: 'active'
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
}
