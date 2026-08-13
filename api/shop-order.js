import supabase from './_lib/supabase.js';
import { validateCustomer, buildOrderItems, checkStock } from './_lib/shopOrder.js';
import { rateLimit } from './_lib/rateLimit.js';

/**
 * Manual checkout path — used when Razorpay isn't configured. Places the
 * order immediately as "pending" and returns UPI accounts so the buyer can
 * pay directly, mirroring the free-registration fallback for sessions.
 */
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

    const { error: stockErr } = checkStock(qtyByProduct, productMap);
    if (stockErr) return res.status(409).json({ ok: false, error: stockErr });

    const { data: insertedOrder, error: insertErr } = await supabase
      .from('shop_orders')
      .insert({
        customer_name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email.trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
        pincode: customer.pincode.trim(),
        amount,
        currency: 'INR',
        status: 'pending',
        items: orderItems
      })
      .select('id')
      .single();

    if (insertErr) return res.status(500).json({ ok: false, error: insertErr.message });

    await Promise.all(Object.entries(qtyByProduct).map(async ([productId, qty]) => {
      const product = productMap.get(productId);
      if (product.stock !== null && product.stock !== undefined) {
        await supabase.from('products').update({ stock: Math.max(0, product.stock - qty) }).eq('id', productId);
      }
    }));

    const { data: upiAccounts } = await supabase.from('upi_accounts').select('id, label, upi_id, qr_image_url');

    return res.status(200).json({ ok: true, orderId: insertedOrder.id, amount, upiAccounts: upiAccounts || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
