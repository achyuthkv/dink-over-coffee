import supabase from './_lib/supabase.js';
import { createRazorpayOrder } from './_lib/razorpay.js';
import { getReservedQuantities } from './_lib/shopStock.js';
import { validateCustomer, buildOrderItems, checkStock } from './_lib/shopOrder.js';
import { rateLimit } from './_lib/rateLimit.js';

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES) || 5;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

    const { items, customer } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'Your order is empty' });
    }

    const custErr = validateCustomer(customer);
    if (custErr) return res.status(400).json({ ok: false, error: custErr });

    const productIds = [...new Set(items.map(i => i.productId))];
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('active', true);

    if (prodErr) return res.status(500).json({ ok: false, error: prodErr.message });

    const productMap = new Map((products || []).map(p => [p.id, p]));
    const { error: itemsErr, orderItems, amount, qtyByProduct } = buildOrderItems(items, productMap);
    if (itemsErr) return res.status(400).json({ ok: false, error: itemsErr });

    const reserved = await getReservedQuantities(productIds);
    const { error: stockErr } = checkStock(qtyByProduct, productMap, reserved);
    if (stockErr) return res.status(409).json({ ok: false, error: stockErr });

    const amountPaise = Math.round(amount * 100);
    const receipt = `shop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const order = await createRazorpayOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { name: customer.name.trim(), phone: customer.phone.trim() }
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);

    const { data: hold, error: holdErr } = await supabase
      .from('shop_holds')
      .insert({
        razorpay_order_id: order.id,
        items: orderItems,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: customer.email.trim(),
          address: customer.address.trim(),
          city: customer.city.trim(),
          pincode: customer.pincode.trim()
        },
        amount,
        expires_at: expiresAt.toISOString(),
        status: 'active'
      })
      .select('id')
      .single();

    if (holdErr) return res.status(500).json({ ok: false, error: 'Failed to create hold' });

    return res.status(200).json({
      ok: true,
      holdId: hold.id,
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
