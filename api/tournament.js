import supabase from './_lib/supabase.js';
import { computeSyncRows } from './_lib/tournamentSync.js';
import { computeEntryFee, getTeamCounts, resolveEntryStatus, validateTeamPayload } from './_lib/tournamentCapacity.js';
import { createRazorpayOrder, verifySignature, fetchOrder } from './_lib/razorpay.js';
import { rateLimit } from './_lib/rateLimit.js';

const HOLD_TTL_MINUTES = Number(process.env.HOLD_TTL_MINUTES) || 5;

/**
 * Single Vercel function fronting tournament server-side actions
 * (action-dispatched, same pattern as api/shop.js) so tournament logic
 * doesn't spend a new Serverless Function slot per endpoint. Public
 * registration/payment actions need no auth; category management (bulk
 * import, session-registration sync) requires an organizer session.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { action } = req.body || {};
    switch (action) {
      case 'sync-teams': return await requireOrganizer(req, res, syncTeams);
      case 'bulk-import': return await requireOrganizer(req, res, bulkImport);
      case 'create-referee': return await requireOrganizer(req, res, createReferee);
      case 'delete-referee': return await requireOrganizer(req, res, deleteReferee);
      case 'register': return await registerTeam(req, res);
      case 'create-order': return await createOrder(req, res);
      case 'confirm-payment': return await confirmPayment(req, res);
      default: return res.status(400).json({ ok: false, error: 'Invalid action' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

// Every action here writes through the service-role client, which bypasses
// RLS entirely -- so unlike the browser-direct CRUD elsewhere in /admin,
// checking "is this a valid Supabase session" is not enough once referee
// accounts exist. A referee has a perfectly valid session too; they just
// shouldn't be able to reach any of these actions (sync/import/referee
// management are all organizer-only, mirroring the DB-level lockdown in
// migrations/0002_referee_role.sql).
async function requireOrganizer(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authErr || !user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role === 'referee') {
    return res.status(403).json({ ok: false, error: 'Organizer access required' });
  }
  return next(req, res);
}

// Referee accounts are real Supabase Auth users (so RLS can tell them apart
// from organizers via profiles.role), which only the service-role admin API
// can create/delete -- not something a browser client can do directly even
// with an authenticated session.
async function createReferee(req, res) {
  const { name, email, password, phone } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Name, email, and a password of at least 8 characters are required' });
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: email.trim(), password, email_confirm: true, user_metadata: { name: name.trim(), role: 'referee' }
  });
  if (error) return res.status(400).json({ ok: false, error: error.message });

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: data.user.id, role: 'referee', name: name.trim(), phone: phone?.trim() || null
  });
  if (profileErr) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return res.status(500).json({ ok: false, error: profileErr.message });
  }
  return res.status(200).json({ ok: true, refereeId: data.user.id });
}

async function deleteReferee(req, res) {
  const { refereeId } = req.body || {};
  if (!refereeId) return res.status(400).json({ ok: false, error: 'refereeId required' });
  const { error } = await supabase.auth.admin.deleteUser(refereeId);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.status(200).json({ ok: true });
}

// Backfills teams for every currently-qualifying confirmed registration on a
// category's linked session, for registrations that predate the session
// being linked (or predate the category having any groups to place them
// on). Idempotent -- safe to call repeatedly.
//
// New/updated registrations keep syncing automatically in real time via a
// Postgres trigger (sync_tournament_team_from_player) that fires on any
// `players` write, including ones made directly from the browser
// (promoting a waitlisted player, marking someone withdrawn) -- that piece
// stays a DB trigger rather than move here, since there's no HTTP request
// to hook for a browser-direct write.
async function syncTeams(req, res) {
  const { categoryId } = req.body || {};
  if (!categoryId) return res.status(400).json({ ok: false, error: 'categoryId required' });

  const { data: category, error: catErr } = await supabase
    .from('tournament_categories')
    .select('id, team_size, session_id, status')
    .eq('id', categoryId)
    .single();

  if (catErr || !category) return res.status(404).json({ ok: false, error: 'Category not found' });
  if (!category.session_id || !['setup', 'registration_open', 'registration_closed', 'active'].includes(category.status)) {
    return res.status(200).json({ ok: true, created: 0 });
  }

  const [{ data: players, error: pErr }, { data: groups, error: gErr }, { data: existingTeams, error: etErr }] = await Promise.all([
    supabase.from('players').select('id, name, partner_name, status, needs_partner').eq('session_id', category.session_id),
    supabase.from('tournament_groups').select('id, sort_order').eq('category_id', categoryId),
    supabase.from('tournament_teams').select('id, group_id, source_player_id').eq('category_id', categoryId)
  ]);

  if (pErr || gErr || etErr) return res.status(500).json({ ok: false, error: 'Failed to load category data' });

  const rows = computeSyncRows({ categoryId, teamSize: category.team_size, players, groups, existingTeams });
  if (rows.length === 0) return res.status(200).json({ ok: true, created: 0 });

  const { error: insertErr } = await supabase.from('tournament_teams').insert(rows);
  if (insertErr) return res.status(500).json({ ok: false, error: insertErr.message });

  return res.status(200).json({ ok: true, created: rows.length });
}

// Admin bulk CSV import: one row per team, validated the same way as a
// public registration but inserted straight to `confirmed`/`waitlisted`
// with no payment step (an organizer entering results from a spreadsheet
// or walk-in sign-up sheet is vouching for the entries already).
async function bulkImport(req, res) {
  const { categoryId, rows } = req.body || {};
  if (!categoryId || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ ok: false, error: 'categoryId and a non-empty rows array are required' });
  }

  const { data: category, error: catErr } = await supabase
    .from('tournament_categories')
    .select('*')
    .eq('id', categoryId)
    .single();
  if (catErr || !category) return res.status(404).json({ ok: false, error: 'Category not found' });

  const counts = await getTeamCounts(categoryId);
  let confirmedCount = counts.confirmed + counts.activeHolds;

  const toInsert = [];
  const errors = [];
  rows.forEach((row, i) => {
    const result = validateTeamPayload(category, {
      teamName: row.teamName, player1Name: row.player1Name, player1Phone: row.player1Phone,
      player2Name: row.player2Name, player2Phone: row.player2Phone, email: row.email
    });
    if (result.error) { errors.push({ row: i + 1, error: result.error }); return; }

    const status = category.max_teams != null && confirmedCount >= category.max_teams ? 'waitlisted' : 'confirmed';
    if (status === 'confirmed') confirmedCount++;
    toInsert.push({ team: result.team, status });
  });

  if (toInsert.length === 0) return res.status(200).json({ ok: true, created: 0, errors });

  const { data: insertedTeams, error: teamErr } = await supabase
    .from('tournament_teams')
    .insert(toInsert.map(({ team, status }) => ({
      category_id: categoryId, name: team.name, player1_name: team.player1_name, player2_name: team.player2_name, status
    })))
    .select('id');
  if (teamErr) return res.status(500).json({ ok: false, error: teamErr.message });

  const registrationRows = insertedTeams.map((t, i) => ({
    team_id: t.id, phone: toInsert[i].team.phone, player2_phone: toInsert[i].team.player2_phone,
    email: toInsert[i].team.email, amount: 0, payment_status: 'free'
  }));
  await supabase.from('tournament_registrations').insert(registrationRows);

  return res.status(200).json({ ok: true, created: insertedTeams.length, errors });
}

async function loadOpenCategory(req, res) {
  const { categoryId, team } = req.body || {};
  if (!categoryId || !team) {
    res.status(400).json({ ok: false, error: 'categoryId and team are required' });
    return null;
  }

  const { data: category, error } = await supabase
    .from('tournament_categories')
    .select('*')
    .eq('id', categoryId)
    .single();

  if (error || !category) {
    res.status(404).json({ ok: false, error: 'Category not found' });
    return null;
  }
  if (category.status !== 'registration_open') {
    res.status(409).json({ ok: false, error: 'Registration is not open for this category' });
    return null;
  }

  const validated = validateTeamPayload(category, team);
  if (validated.error) {
    res.status(400).json({ ok: false, error: validated.error });
    return null;
  }

  return { category, team: validated.team };
}

async function isDuplicatePhone(categoryId, phone) {
  const { data: teamIds } = await supabase.from('tournament_teams').select('id').eq('category_id', categoryId);
  const ids = (teamIds || []).map(t => t.id);
  if (ids.length === 0) return false;
  const { data } = await supabase.from('tournament_registrations').select('id').in('team_id', ids).eq('phone', phone).maybeSingle();
  return !!data;
}

// Free entry, or a paid entry the organizer collects manually (no Razorpay
// key configured on the server) -- mirrors api/shop.js's `order` action:
// the team is recorded straight away, `pending` payment gets UPI details
// back so the buyer can pay and the organizer reconciles it in /admin.
async function registerTeam(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const loaded = await loadOpenCategory(req, res);
  if (!loaded) return;
  const { category, team } = loaded;

  if (await isDuplicatePhone(category.id, team.phone)) {
    return res.status(200).json({ ok: true, alreadyRegistered: true });
  }

  const amount = computeEntryFee(category);
  const counts = await getTeamCounts(category.id);
  const status = resolveEntryStatus(category, counts);

  const { data: insertedTeam, error: teamErr } = await supabase
    .from('tournament_teams')
    .insert({ category_id: category.id, name: team.name, player1_name: team.player1_name, player2_name: team.player2_name, status })
    .select('id')
    .single();
  if (teamErr) return res.status(500).json({ ok: false, error: teamErr.message });

  // Re-check after insert to catch a race where two confirmations landed
  // at once; if we're now over capacity, downgrade to waitlisted rather
  // than reject the entry outright.
  if (status === 'confirmed') {
    const recount = await getTeamCounts(category.id);
    if (category.max_teams != null && recount.confirmed > category.max_teams) {
      await supabase.from('tournament_teams').update({ status: 'waitlisted' }).eq('id', insertedTeam.id);
    }
  }

  const paymentStatus = amount === 0 ? 'free' : 'pending';
  await supabase.from('tournament_registrations').insert({
    team_id: insertedTeam.id, phone: team.phone, player2_phone: team.player2_phone, email: team.email,
    amount, payment_status: paymentStatus
  });

  if (paymentStatus === 'pending') {
    const { data: upiAccounts } = await supabase.from('upi_accounts').select('id, label, upi_id, qr_image_url');
    return res.status(200).json({ ok: true, status, amount, paymentStatus, upiAccounts: upiAccounts || [] });
  }
  return res.status(200).json({ ok: true, status, amount, paymentStatus });
}

// Paid entry via Razorpay -- a hold reserves the slot while checkout is in
// flight, same TTL/consume pattern as `holds`/`shop_holds`.
async function createOrder(req, res) {
  if (!rateLimit(req).ok) return res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });

  const loaded = await loadOpenCategory(req, res);
  if (!loaded) return;
  const { category, team } = loaded;

  if (await isDuplicatePhone(category.id, team.phone)) {
    return res.status(200).json({ ok: true, alreadyRegistered: true });
  }

  const amount = computeEntryFee(category);
  if (amount <= 0) return res.status(400).json({ ok: false, error: 'This category has no entry fee — use free registration instead' });

  const counts = await getTeamCounts(category.id);
  if (resolveEntryStatus(category, counts) !== 'confirmed') {
    return res.status(409).json({ ok: false, error: 'This category is full' });
  }

  const amountPaise = Math.round(amount * 100);
  const receipt = `trn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const order = await createRazorpayOrder({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes: { categoryId: category.id, name: team.name, phone: team.phone }
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000);

  const { data: hold, error: holdErr } = await supabase
    .from('tournament_holds')
    .insert({ category_id: category.id, razorpay_order_id: order.id, team, amount, expires_at: expiresAt.toISOString(), status: 'active' })
    .select('id')
    .single();
  if (holdErr) return res.status(500).json({ ok: false, error: 'Failed to create hold' });

  return res.status(200).json({ ok: true, holdId: hold.id, orderId: order.id, amount: amountPaise, currency: 'INR', expiresAt: expiresAt.toISOString() });
}

async function confirmPayment(req, res) {
  const { holdId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!holdId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ ok: false, error: 'Invalid payment signature' });
  }

  const { data: hold, error: holdErr } = await supabase
    .from('tournament_holds')
    .select('*')
    .eq('id', holdId)
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .single();
  if (holdErr || !hold) return res.status(400).json({ ok: false, error: 'Hold not found, expired, or already consumed' });

  const order = await fetchOrder(razorpay_order_id);
  const team = hold.team;

  const { data: insertedTeam, error: teamErr } = await supabase
    .from('tournament_teams')
    .insert({ category_id: hold.category_id, name: team.name, player1_name: team.player1_name, player2_name: team.player2_name, status: 'confirmed' })
    .select('id')
    .single();
  if (teamErr) return res.status(500).json({ ok: false, error: teamErr.message });

  await supabase.from('tournament_registrations').insert({
    team_id: insertedTeam.id, phone: team.phone, player2_phone: team.player2_phone, email: team.email,
    amount: Number(order.amount) / 100, payment_status: 'paid', razorpay_order_id, razorpay_payment_id
  });

  await supabase.from('tournament_holds').update({ status: 'consumed' }).eq('id', holdId);

  return res.status(200).json({ ok: true, teamId: insertedTeam.id });
}
