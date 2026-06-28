import supabase from './_lib/supabase.js';
import { verifySignature, fetchOrder } from './_lib/razorpay.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { holdId, sessionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!holdId || !sessionId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ ok: false, error: 'Invalid payment signature' });
  }

  const { data: hold, error: holdErr } = await supabase
    .from('holds')
    .select('*')
    .eq('id', holdId)
    .eq('session_id', sessionId)
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (holdErr || !hold) {
    return res.status(400).json({ ok: false, error: 'Hold not found, expired, or already consumed' });
  }

  const order = await fetchOrder(razorpay_order_id);
  const notes = order.notes || {};

  const { error: insertErr } = await supabase
    .from('players')
    .insert({
      session_id: sessionId,
      name: (notes.name || '').trim(),
      phone: (notes.phone || '').trim(),
      skill: notes.skill || 'Beginner',
      amount: Number(order.amount) / 100,
      razorpay_payment_id,
      razorpay_order_id,
      status: 'confirmed'
    });

  if (insertErr && insertErr.code !== '23505') {
    return res.status(500).json({ ok: false, error: insertErr.message });
  }

  await supabase
    .from('holds')
    .update({ status: 'consumed' })
    .eq('id', holdId);

  return res.status(200).json({ ok: true });
}
