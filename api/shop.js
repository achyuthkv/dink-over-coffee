import supabase from './_lib/supabase.js';
import { createRazorpayOrder, verifySignature } from './_lib/razorpay.js';
import { getReservedQuantities } from './_lib/shopStock.js';
import { validateCustomer, buildOrderItems, checkStock } from './_lib/shopOrder.js';
import { sendShopConfirmationEmail } from './_lib/sendShopConfirmationEmail.js';
import { rateLimit } from './_lib/rateLimit.js';

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES) || 5;

/**
 * Single Vercel function fronting the whole shop flow (action-dispatched,
 * same pattern as api/waiver.js) so the shop only costs one Serverless
 * Function slot instead of one per endpoint.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { action } = req.body || {};

    switch (action) {
      case 'products': return await listProducts(req, res);
      case 'create-order': return await createOrder(req, res);
      case 'confirm-payment': return await confirmPayment(req, res);
      case 'order': return await placeManualOrder(req, res);
      default: return res.status(400).json({ ok: false, error: 'Invalid action' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

async function listProducts(req, res) {
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at');

  if (error) return res.status(500).json({ ok: false, error: error.message });

  const ids = (products || []).map(p => p.id);
  const reserved = await getReservedQuantities(ids);

  const result = (products || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    imageUrl: p.image_url,
    sizes: p.sizes || null,
    category: p.category,
    stock: p.stock === null || p.stock === undefined ? null : Math.max(0, Number(p.stock) - (reserved[p.id] || 0))
  }));

  return res.status(200).json({ ok: true, products: result });
}

async function loadPricedItems(req, res) {
  const { items, customer } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ ok: false, error: 'Your order is empty' });
    return null;
  }

  const custErr = validateCustomer(customer);
  if (custErr) {
    res.status(400).json({ ok: false, error: custErr });
    return null;
  }

  const productIds = [...new Set(items.map(i => i.productId))];
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)
    .eq('active', true);

  if (prodErr) {
    res.status(500).json({ ok: false, error: prodErr.message });
    return null;
  }

  const productMap = new Map((products || []).map(p => [p.id, p]));
  const { error: itemsErr, orderItems, amount, qtyByProduct } = buildOrderItems(items, productMap);
  if (itemsErr) {
    res.status(400).json({ ok: false, error: itemsErr });
    return null;
  }

  return { customer, productIds, productMap, orderItems, amount, qtyByProduct };
}

async function createOrder(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const priced = await loadPricedItems(req, res);
  if (!priced) return;
  const { customer, productIds, productMap, orderItems, amount, qtyByProduct } = priced;

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
}

async function confirmPayment(req, res) {
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
}

async function placeManualOrder(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const priced = await loadPricedItems(req, res);
  if (!priced) return;
  const { customer, productMap, orderItems, amount, qtyByProduct } = priced;

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
}
