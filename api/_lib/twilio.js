import crypto from 'crypto';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'

export const WHATSAPP_CONFIGURED = !!(ACCOUNT_SID && AUTH_TOKEN && WHATSAPP_FROM);

async function postMessage(params) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ From: WHATSAPP_FROM, ...params })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio send failed: ${err}`);
  }
  return res.json();
}

// contentSid is a pre-approved WhatsApp template (built + submitted for Meta
// approval in Twilio's Content Template Builder) -- required for any message
// sent outside a 24h window the recipient didn't start.
export async function sendWhatsAppTemplate({ to, contentSid, variables }) {
  if (!WHATSAPP_CONFIGURED) return { skipped: true };
  return postMessage({
    To: `whatsapp:${to}`,
    ContentSid: contentSid,
    ...(variables && { ContentVariables: JSON.stringify(variables) })
  });
}

// Free-form text is only deliverable inside the 24h customer-service window
// (i.e. as a reply to an inbound message) -- used here for the confirmation
// sent right after a member's decline reply.
export async function sendWhatsAppText({ to, body }) {
  if (!WHATSAPP_CONFIGURED) return { skipped: true };
  return postMessage({ To: `whatsapp:${to}`, Body: body });
}

// Twilio webhook signature validation: HMAC-SHA1 of the full request URL with
// every POST param key+value appended (sorted by key), base64-encoded, keyed
// on the auth token. https://www.twilio.com/docs/usage/webhooks/webhooks-security
export function validateTwilioSignature(url, params, signature) {
  if (!AUTH_TOKEN || !signature) return false;
  let data = url;
  for (const key of Object.keys(params).sort()) data += key + params[key];
  const expected = crypto.createHmac('sha1', AUTH_TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}
