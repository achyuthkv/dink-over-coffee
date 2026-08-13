const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Dink Over Coffee <play@dinkovercoffee.com>';

function buildOrderHtml(customer, items, orderId, amount) {
  const rows = items.map(item => `
    <tr>
      <td style="padding:10px 0;font-size:13px;color:#003D30;">${item.name}${item.size ? ` (${item.size})` : ''} &times; ${item.quantity}</td>
      <td style="padding:10px 0;font-size:13px;color:#003D30;text-align:right;">₹${item.price * item.quantity}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7fffb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f7fffb;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;">

<tr><td align="center" style="padding-bottom:32px;">
<img src="https://dinkovercoffee.com/logo-full.svg" alt="Dink Over Coffee" width="160" style="display:block;" />
</td></tr>

<tr><td style="background-color:#ffffff;border-radius:16px;border:1px solid #e8f5f0;overflow:hidden;">

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="background-color:#003D30;padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Order confirmed!</h1>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:24px 32px 0;">
<p style="margin:0;font-size:15px;line-height:1.6;color:#003D30;">Hey ${customer.name},<br /><br />Thanks for your order! Here's what you got:</p>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:20px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #e8f5f0;">
${rows}
<tr><td style="padding-top:14px;font-size:14px;font-weight:700;color:#003D30;">Total</td><td style="padding-top:14px;font-size:14px;font-weight:700;color:#003D30;text-align:right;">₹${amount}</td></tr>
</table>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:0 32px 24px;">
<p style="margin:0;font-size:13px;line-height:1.6;color:#5d7a71;">Shipping to:<br />${customer.address}, ${customer.city} - ${customer.pincode}</p>
<p style="margin:12px 0 0;font-size:12px;color:#93a29b;">Order ID: ${orderId}</p>
</td></tr>
</table>

</td></tr>

<tr><td align="center" style="padding:32px 20px 0;">
<p style="margin:0;font-size:12px;color:#5d7a71;">Play. Connect. Belong.</p>
<p style="margin:8px 0 0;font-size:11px;color:#93a29b;">
<a href="https://dinkovercoffee.com" style="color:#00B08A;text-decoration:none;">dinkovercoffee.com</a>
&nbsp;&middot;&nbsp;
<a href="mailto:connect@dinkovercoffee.com" style="color:#00B08A;text-decoration:none;">connect@dinkovercoffee.com</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export async function sendShopConfirmationEmail(customer, items, orderId, amount) {
  if (!RESEND_API_KEY || !customer?.email) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [customer.email],
        subject: 'Order confirmed! | Dink Over Coffee Shop',
        html: buildOrderHtml(customer, items, orderId, amount)
      })
    });
  } catch (err) {
    console.error('Failed to send shop confirmation email:', err);
  }
}
