import supabase from './_lib/supabase.js';
import { createRazorpayOrder, verifySignature } from './_lib/razorpay.js';
import { getSlotCounts, checkAvailability } from './_lib/slots.js';
import { rateLimit } from './_lib/rateLimit.js';
import { sendWhatsAppTemplate, sendWhatsAppText, validateTwilioSignature, WHATSAPP_CONFIGURED } from './_lib/twilio.js';
import { todayIST, addDays, addMonths, weekdayReason } from './_lib/membershipDates.js';

const RAZORPAY_CONFIGURED = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const CRON_SECRET = process.env.CRON_SECRET;
const REMINDER_CONTENT_SID = process.env.TWILIO_REMINDER_CONTENT_SID;
const BROADCAST_CONTENT_SID = process.env.TWILIO_BROADCAST_CONTENT_SID;

// Placeholder pricing -- adjust to the club's real plan prices before going live.
const PLANS = {
  monthly: { label: 'Monthly', amountPaise: 150000, months: 1 },
  quarterly: { label: 'Quarterly', amountPaise: 400000, months: 3 },
  annual: { label: 'Annual', amountPaise: 1400000, months: 12 }
};

async function getAuthedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !user) return null;
  return user;
}

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin';
}

async function getActiveMemberForUser(user) {
  if (!user) return null;
  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  return data || null;
}

async function creditBalance(memberId) {
  const { data } = await supabase.from('membership_credits').select('delta').eq('member_id', memberId);
  return (data || []).reduce((sum, row) => sum + row.delta, 0);
}

export default async function handler(req, res) {
  const action = req.query?.action || req.body?.action;

  // Vercel Cron always issues a GET; every other action here is POST-only.
  const methodOk = action === 'send-reminders' ? req.method === 'GET' : req.method === 'POST';
  if (!methodOk) return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    switch (action) {
      case 'signup-create-order': return await signupCreateOrder(req, res);
      case 'signup-confirm-payment': return await signupConfirmPayment(req, res);
      case 'signup-free': return await signupFree(req, res);
      case 'redeem-credit': return await redeemCredit(req, res);
      case 'directory': return await directory(req, res);
      case 'whatsapp-webhook': return await whatsappWebhook(req, res);
      case 'send-reminders': return await sendReminders(req, res);
      case 'broadcast': return await broadcast(req, res);
      default: return res.status(400).json({ ok: false, error: 'Invalid action' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

async function signupCreateOrder(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const user = await getAuthedUser(req);
  if (!user || !user.phone) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  if (!RAZORPAY_CONFIGURED) return res.status(400).json({ ok: false, error: 'Paid signup is not configured' });

  const { name, email, duprId, tshirtSize, plan, whatsappOptIn } = req.body;
  if (!name || name.trim().length < 2) return res.status(400).json({ ok: false, error: 'Enter your name' });
  if (!PLANS[plan]) return res.status(400).json({ ok: false, error: 'Invalid plan' });

  const { data: existing } = await supabase.from('members').select('id, status').eq('phone', user.phone).maybeSingle();
  if (existing?.status === 'active') return res.status(409).json({ ok: false, error: 'You already have an active membership' });

  const { amountPaise } = PLANS[plan];
  const receipt = `doc_mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const order = await createRazorpayOrder({ amount: amountPaise, currency: 'INR', receipt, notes: { phone: user.phone, plan } });

  const { data: member, error } = await supabase
    .from('members')
    .upsert({
      user_id: user.id,
      phone: user.phone,
      name: name.trim(),
      email: email ? email.trim() : null,
      dupr_id: duprId ? duprId.trim() : null,
      tshirt_size: tshirtSize || null,
      plan,
      status: 'pending_payment',
      whatsapp_opt_in: whatsappOptIn !== false,
      razorpay_order_id: order.id
    }, { onConflict: 'phone' })
    .select('id')
    .single();

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.status(200).json({ ok: true, memberId: member.id, orderId: order.id, amount: amountPaise, currency: 'INR' });
}

async function signupConfirmPayment(req, res) {
  const user = await getAuthedUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ ok: false, error: 'Invalid payment signature' });
  }

  const { data: member, error: findErr } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('status', 'pending_payment')
    .single();

  if (findErr || !member) return res.status(400).json({ ok: false, error: 'Pending membership order not found' });

  const start = todayIST();
  const end = addMonths(start, PLANS[member.plan]?.months || 1);

  const { error } = await supabase
    .from('members')
    .update({ status: 'active', start_date: start, end_date: end, razorpay_payment_id })
    .eq('id', member.id);

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}

async function signupFree(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const user = await getAuthedUser(req);
  if (!user || !user.phone) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  if (RAZORPAY_CONFIGURED) return res.status(400).json({ ok: false, error: 'Use paid signup' });

  const { name, email, duprId, tshirtSize, plan, whatsappOptIn } = req.body;
  if (!name || name.trim().length < 2) return res.status(400).json({ ok: false, error: 'Enter your name' });
  if (!PLANS[plan]) return res.status(400).json({ ok: false, error: 'Invalid plan' });

  const { data: existing } = await supabase.from('members').select('id, status').eq('phone', user.phone).maybeSingle();
  if (existing?.status === 'active') return res.status(409).json({ ok: false, error: 'You already have an active membership' });

  const start = todayIST();
  const end = addMonths(start, PLANS[plan].months);

  const { error } = await supabase
    .from('members')
    .upsert({
      user_id: user.id,
      phone: user.phone,
      name: name.trim(),
      email: email ? email.trim() : null,
      dupr_id: duprId ? duprId.trim() : null,
      tshirt_size: tshirtSize || null,
      plan,
      status: 'active',
      start_date: start,
      end_date: end,
      whatsapp_opt_in: whatsappOptIn !== false
    }, { onConflict: 'phone' });

  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}

async function redeemCredit(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const user = await getAuthedUser(req);
  const member = await getActiveMemberForUser(user);
  if (!member) return res.status(401).json({ ok: false, error: 'No active membership found' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required' });

  const balance = await creditBalance(member.id);
  if (balance <= 0) return res.status(409).json({ ok: false, error: 'No rollover credits available' });

  const { data: session, error: sessErr } = await supabase.from('sessions').select('*').eq('id', sessionId).eq('active', true).single();
  if (sessErr || !session) return res.status(404).json({ ok: false, error: 'Session not found or inactive' });

  const counts = await getSlotCounts(sessionId, session);
  const availability = checkAvailability(session, 'Intermediate', counts);
  if (!availability.available || availability.type !== 'confirmed') {
    return res.status(409).json({ ok: false, error: 'No slots available for this session' });
  }

  const { error: insertErr } = await supabase.from('players').insert({
    session_id: sessionId,
    name: member.name,
    phone: member.phone,
    email: member.email,
    skill: 'N/A',
    amount: 0,
    status: 'confirmed',
    member_id: member.id
  });

  if (insertErr) {
    if (insertErr.code === '23505') return res.status(409).json({ ok: false, error: 'Already reserved for this session' });
    return res.status(500).json({ ok: false, error: insertErr.message });
  }

  await supabase.from('membership_credits').insert({ member_id: member.id, session_id: sessionId, delta: -1, reason: 'redeemed' });

  return res.status(200).json({ ok: true });
}

async function directory(req, res) {
  const user = await getAuthedUser(req);
  const member = await getActiveMemberForUser(user);
  if (!member) return res.status(401).json({ ok: false, error: 'No active membership found' });

  const { data } = await supabase.from('members').select('id, name, plan').eq('status', 'active').neq('id', member.id).order('name');
  return res.status(200).json({ ok: true, members: (data || []).map(m => ({ name: (m.name || '').trim().split(/\s+/)[0] || 'Member', plan: m.plan })) });
}

// Twilio POSTs here at https://<domain>/api/membership?action=whatsapp-webhook
// (configured as the WhatsApp sender's inbound webhook URL in the Twilio console).
async function whatsappWebhook(req, res) {
  const signature = req.headers['x-twilio-signature'];
  const url = `https://${req.headers.host}${req.url}`;
  const params = req.body || {};

  if (!validateTwilioSignature(url, params, signature)) {
    return res.status(403).send('Invalid signature');
  }

  const from = (params.From || '').replace('whatsapp:', '').trim();
  const payload = params.ButtonPayload || '';

  const respondEmpty = () => {
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send('<Response></Response>');
  };

  const { data: member } = await supabase.from('members').select('*').eq('phone', from).eq('status', 'active').maybeSingle();
  if (!member) return respondEmpty();

  let sessionId = payload.startsWith('decline:') ? payload.slice('decline:'.length) : null;

  if (!sessionId) {
    // No button payload (e.g. a plain-text reply) -- fall back to the member's
    // soonest upcoming reserved member-slot session.
    const { data: candidateSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('is_member_slot', true)
      .gte('date', todayIST())
      .order('date', { ascending: true })
      .limit(10);

    const candidateIds = (candidateSessions || []).map(s => s.id);
    if (candidateIds.length) {
      const { data: reservations } = await supabase
        .from('players')
        .select('session_id')
        .eq('member_id', member.id)
        .eq('status', 'confirmed')
        .in('session_id', candidateIds);
      const reservedIds = new Set((reservations || []).map(r => r.session_id));
      sessionId = candidateIds.find(id => reservedIds.has(id)) || null;
    }
  }

  if (!sessionId) return respondEmpty();

  const { data: reservation } = await supabase
    .from('players')
    .select('id, session_id, sessions(date)')
    .eq('session_id', sessionId)
    .eq('member_id', member.id)
    .eq('status', 'confirmed')
    .maybeSingle();

  if (!reservation) return respondEmpty();

  await supabase.from('players').update({ status: 'withdrew' }).eq('id', reservation.id);

  const balance = await creditBalance(member.id);
  let creditMsg = '';
  if (balance < member.rollover_cap) {
    await supabase.from('membership_credits').insert({
      member_id: member.id,
      session_id: sessionId,
      delta: 1,
      reason: weekdayReason(reservation.sessions?.date || todayIST())
    });
    creditMsg = ` You've banked a rollover credit (${balance + 1}/${member.rollover_cap}).`;
  }

  await sendWhatsAppText({ to: from, body: `Got it, ${member.name.split(/\s+/)[0]} — you're marked out for this week.${creditMsg}` }).catch(err => console.error(err));

  return respondEmpty();
}

// Cron-triggered (see vercel.json). Vercel Cron sends `Authorization: Bearer
// $CRON_SECRET` automatically when CRON_SECRET is set as a project env var.
async function sendReminders(req, res) {
  const authHeader = req.headers.authorization;
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const targetDate = addDays(todayIST(), 2);

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('is_member_slot', true)
    .eq('active', true)
    .eq('date', targetDate);

  let reservationsCreated = 0;
  let messagesSent = 0;

  for (const session of sessions || []) {
    const { data: activeMembers } = await supabase
      .from('members')
      .select('*')
      .eq('status', 'active')
      .gte('end_date', targetDate);

    const { data: existingReservations } = await supabase
      .from('players')
      .select('member_id')
      .eq('session_id', session.id)
      .not('member_id', 'is', null);

    const alreadyReserved = new Set((existingReservations || []).map(r => r.member_id));
    const capacity = session.member_reserved_slots;
    let reservedCount = alreadyReserved.size;

    for (const member of activeMembers || []) {
      if (alreadyReserved.has(member.id)) continue;
      if (capacity != null && reservedCount >= capacity) continue;

      const { error: insertErr } = await supabase.from('players').insert({
        session_id: session.id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        skill: 'N/A',
        amount: 0,
        status: 'confirmed',
        member_id: member.id
      });
      if (insertErr) continue;
      reservedCount++;
      reservationsCreated++;

      if (member.whatsapp_opt_in && WHATSAPP_CONFIGURED && REMINDER_CONTENT_SID) {
        try {
          await sendWhatsAppTemplate({
            to: member.phone,
            contentSid: REMINDER_CONTENT_SID,
            variables: { 1: member.name.split(/\s+/)[0], 2: session.date, 3: session.time || '' }
          });
          messagesSent++;
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  return res.status(200).json({ ok: true, sessionsProcessed: (sessions || []).length, reservationsCreated, messagesSent });
}

async function broadcast(req, res) {
  const user = await getAuthedUser(req);
  if (!isAdmin(user)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ ok: false, error: 'Message required' });
  if (!WHATSAPP_CONFIGURED) return res.status(400).json({ ok: false, error: 'WhatsApp is not configured' });
  // A broadcast is proactive, not a reply within a member's 24h service window,
  // so it has to go out as an approved template -- free-form text (sendWhatsAppText)
  // only works as a reply. BROADCAST_CONTENT_SID should point to a generic
  // one-variable "message from the club" template approved in Twilio's Content
  // Template Builder.
  if (!BROADCAST_CONTENT_SID) return res.status(400).json({ ok: false, error: 'TWILIO_BROADCAST_CONTENT_SID is not set' });

  const { data: members, error } = await supabase.from('members').select('phone').eq('status', 'active').eq('whatsapp_opt_in', true);
  if (error) return res.status(500).json({ ok: false, error: error.message });

  let sent = 0;
  for (const m of members || []) {
    try {
      await sendWhatsAppTemplate({ to: m.phone, contentSid: BROADCAST_CONTENT_SID, variables: { 1: message.trim() } });
      sent++;
    } catch (err) {
      console.error(err);
    }
  }

  return res.status(200).json({ ok: true, sent });
}
