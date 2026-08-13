import supabase from './_lib/supabase.js';
import { verifySignature } from './_lib/razorpay.js';
import { sendShopConfirmationEmail } from './_lib/sendShopConfirmationEmail.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { holdId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!holdId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ ok: false, error: 'Invalid payment signature' });
    }

    const { data: hold, error: holdErr } = await supabase
      .from('shop_holds')
      .select('*')
      .eq('id', holdId)
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (holdErr || !hold) {
      return res.status(400).json({ ok: false, error: 'Hold not found, expired, or already consumed' });
    }

    const { data: insertedOrder, error: insertErr } = await supabase
      .from('shop_orders')
      .insert({
        customer_name: hold.customer.name,
        phone: hold.customer.phone,
        email: hold.customer.email,
        address: hold.customer.address,
        city: hold.customer.city,
        pincode: hold.customer.pincode,
        amount: hold.amount,
        currency: 'INR',
        razorpay_order_id,
        razorpay_payment_id,
        status: 'confirmed',
        items: hold.items
      })
      .select('id')
      .single();

    if (insertErr) return res.status(500).json({ ok: false, error: insertErr.message });

    await supabase.from('shop_holds').update({ status: 'consumed' }).eq('id', holdId);

    await Promise.all((hold.items || []).map(async item => {
      const { data: product } = await supabase.from('products').select('stock').eq('id', item.productId).single();
      if (product && product.stock !== null && product.stock !== undefined) {
        const newStock = Math.max(0, Number(product.stock) - item.quantity);
        await supabase.from('products').update({ stock: newStock }).eq('id', item.productId);
      }
    }));

    sendShopConfirmationEmail(hold.customer, hold.items, insertedOrder.id, hold.amount);

    return res.status(200).json({ ok: true, orderId: insertedOrder.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
