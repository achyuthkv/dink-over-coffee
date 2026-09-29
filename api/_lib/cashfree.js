const APP_ID = process.env.CASHFREE_APP_ID;
const SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const IS_PRODUCTION = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase() === 'PRODUCTION';

const BASE_URL = IS_PRODUCTION ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
const API_VERSION = '2025-01-01';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-client-id': APP_ID,
    'x-client-secret': SECRET_KEY,
    'x-api-version': API_VERSION
  };
}

// order_id is merchant-generated (Cashfree doesn't assign one like Razorpay
// does) -- alphanumeric with -_ , max ~50 chars. customer_id/customer_phone
// are required by Cashfree; Razorpay treated the equivalent as optional notes.
export async function createCashfreeOrder({ orderId, amount, customerId, customerPhone, customerEmail, customerName, returnUrl }) {
  const res = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: amount, // RUPEES (decimal) -- not paise, unlike Razorpay
      order_currency: 'INR',
      customer_details: {
        customer_id: customerId,
        customer_phone: customerPhone,
        ...(customerEmail && { customer_email: customerEmail }),
        ...(customerName && { customer_name: customerName })
      },
      order_meta: {
        ...(returnUrl && { return_url: returnUrl })
      }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cashfree order creation failed: ${err}`);
  }
  return res.json();
}

export async function fetchCashfreeOrder(orderId) {
  const res = await fetch(`${BASE_URL}/orders/${orderId}`, { headers: headers() });
  if (!res.ok) throw new Error(`Cashfree fetch order failed: ${res.status}`);
  return res.json();
}
