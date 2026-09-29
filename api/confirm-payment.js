import supabase from './_lib/supabase.js';
import { fetchCashfreeOrder } from './_lib/cashfree.js';
import { sendConfirmationEmail } from './_lib/sendConfirmationEmail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { holdId, sessionId, orderId } = req.body;

    if (!holdId || !sessionId || !orderId) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const { data: hold, error: holdErr } = await supabase
      .from('holds')
      .select('*')
      .eq('id', holdId)
      .eq('session_id', sessionId)
      .eq('razorpay_order_id', orderId)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (holdErr || !hold) {
      return res.status(400).json({ ok: false, error: 'Hold not found, expired, or already consumed' });
    }

    // Cashfree does not send a signed success payload to the client the way
    // Razorpay did -- the only trustworthy signal is re-fetching the order
    // from our own backend and checking its status directly.
    const order = await fetchCashfreeOrder(orderId);
    if (order.order_status !== 'PAID') {
      return res.status(400).json({ ok: false, error: `Payment not completed (status: ${order.order_status})` });
    }

    const player = hold.player || {};

    const { error: insertErr } = await supabase
      .from('players')
      .insert({
        session_id: sessionId,
        name: (player.name || '').trim(),
        phone: (player.phone || '').trim(),
        email: (player.email || '').trim() || null,
        skill: player.skill || 'N/A',
        amount: Number(order.order_amount),
        razorpay_payment_id: orderId,
        razorpay_order_id: orderId,
        status: 'confirmed',
        ...(player.duprId && { dupr_id: player.duprId }),
        ...(player.partnerName && { partner_name: player.partnerName }),
        ...(player.partnerPhone && { partner_phone: player.partnerPhone }),
        ...(player.partnerDuprId && { partner_dupr_id: player.partnerDuprId }),
        ...(player.needsPartner && { needs_partner: true })
      });

    if (insertErr && insertErr.code !== '23505') {
      return res.status(500).json({ ok: false, error: insertErr.message });
    }

    await supabase
      .from('holds')
      .update({ status: 'consumed' })
      .eq('id', holdId);

    const { data: session } = await supabase
      .from('sessions')
      .select('*, venues(name, address, google_maps_url)')
      .eq('id', sessionId)
      .single();

    if (session) {
      sendConfirmationEmail(session, {
        name: (player.name || '').trim(),
        email: (player.email || '').trim() || null
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
