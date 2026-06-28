import crypto from 'crypto';

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export function verifySignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(orderId + '|' + paymentId)
    .digest('hex');
  return expected === signature;
}

export async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64')
    },
    body: JSON.stringify({ amount, currency, receipt, notes })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Razorpay order creation failed: ${err}`);
  }
  return res.json();
}

export async function fetchOrder(orderId) {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(KEY_ID + ':' + KEY_SECRET).toString('base64')
    }
  });
  if (!res.ok) throw new Error(`Razorpay fetch order failed: ${res.status}`);
  return res.json();
}
