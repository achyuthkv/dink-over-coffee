/**
 * Dink Over Coffee — Apps Script backend.
 *
 * Sheets (in the bound spreadsheet):
 *   Sessions: id | date | time | venue | price | maxSlots | active
 *   Players:  sessionId | name | phone | skill | amount | razorpay_payment_id | razorpay_order_id | createdAt
 *   Holds:    holdId | sessionId | razorpay_order_id | createdAt | expiresAt | status (active|consumed|released)
 *
 * Script properties (Project Settings → Script properties):
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   HOLD_TTL_MINUTES (default 5)
 *
 * Deploy as: Web app → Execute as me → Anyone (with the link).
 */

const HOLD_TTL_MIN_DEFAULT = 5;

function doGet(e) {
  // Health check.
  return _json({ ok: true, service: 'dink-over-coffee', time: new Date().toISOString() });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  const action = body.action;
  try {
    switch (action) {
      case 'listSessions':   return _json(listSessions());
      case 'listPlayers':    return _json(listPlayers(body.sessionId));
      case 'debug':          return _json(_debug());
      case 'registerFree':   return _json(registerFree(body.sessionId, body.player));
      case 'createOrder':    return _json(createOrder(body.sessionId, body.player));
      case 'confirmPayment': return _json(confirmPayment(body));
      default: return _json({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}

/* --------------------------- Public actions --------------------------- */

const CACHE_KEY_SESSIONS = 'sessions_v1';
const CACHE_TTL_SEC = 300; // 5 minutes

function listSessions() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CACHE_KEY_SESSIONS);
  if (cached) {
    var result = JSON.parse(cached);
    _expireStaleHolds();
    var cachedCounts = _countTakenBySession();
    result.sessions.forEach(function(s) { s.takenSlots = cachedCounts[s.id] || 0; });
    return { ok: true, sessions: result.sessions };
  }

  var sessions = _readSessions().filter(function(s) { return s.active; });
  _expireStaleHolds();
  var counts = _countTakenBySession();
  var today = _todayYmd();
  var enriched = sessions
    .filter(function(s) { return !s.date || s.date >= today; })
    .map(function(s) {
      return {
        id: s.id,
        date: s.date,
        time: s.time,
        venue: s.venue,
        price: s.price,
        maxSlots: s.maxSlots,
        takenSlots: counts[s.id] || 0
      };
    })
    .sort(function(a, b) { return String(a.date).localeCompare(String(b.date)); });

  cache.put(CACHE_KEY_SESSIONS, JSON.stringify({ sessions: enriched }), CACHE_TTL_SEC);
  return { ok: true, sessions: enriched };
}

function listPlayers(sessionId) {
  if (!sessionId) throw new Error('sessionId required');
  const sh = _sheet('Players');
  if (!sh.getLastRow() || sh.getLastRow() < 2) return { ok: true, players: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
  const players = rows
    .filter(r => String(r[0]) === String(sessionId))
    .map(r => ({ name: r[1], skill: r[3] || '' }));
  return { ok: true, players };
}

function registerFree(sessionId, player) {
  if (!sessionId) throw new Error('sessionId required');
  if (!player || !player.name || !player.phone) throw new Error('name and phone required');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    _expireStaleHolds();
    const session = _getSession(sessionId);
    if (!session || !session.active) throw new Error('Session not available');
    const taken = (_countTakenBySession())[sessionId] || 0;
    if (taken >= session.maxSlots) throw new Error('Session is full');

    _appendRow('Players', [
      sessionId,
      player.name,
      player.phone,
      player.skill || '',
      session.price,
      'FREE_MODE',
      'FREE_MODE',
      new Date().toISOString()
    ]);
    return { ok: true };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function createOrder(sessionId, player) {
  if (!sessionId) throw new Error('sessionId required');
  if (!player || !player.name || !player.phone) throw new Error('name and phone required');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    _expireStaleHolds();
    const session = _getSession(sessionId);
    if (!session || !session.active) throw new Error('Session not available');
    const taken = (_countTakenBySession())[sessionId] || 0;
    if (taken >= session.maxSlots) throw new Error('Session is full');

    const ttlMin = Number(_prop('HOLD_TTL_MINUTES')) || HOLD_TTL_MIN_DEFAULT;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMin * 60 * 1000);

    // Create Razorpay order (server-side, with secret).
    const amountPaise = Math.round(Number(session.price) * 100);
    const order = _razorpayCreateOrder(amountPaise, sessionId, player);

    const holdId = Utilities.getUuid();
    _appendRow('Holds', [
      holdId, sessionId, order.id, now.toISOString(), expiresAt.toISOString(), 'active'
    ]);

    return {
      ok: true,
      holdId,
      sessionId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      expiresAt: expiresAt.toISOString()
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function confirmPayment(payload) {
  const { holdId, sessionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload || {};
  if (!holdId || !sessionId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new Error('Missing payment fields');
  }

  // Verify signature.
  const secret = _prop('RAZORPAY_KEY_SECRET');
  if (!secret) throw new Error('Razorpay secret not configured');
  const expected = _hmacSha256Hex(razorpay_order_id + '|' + razorpay_payment_id, secret);
  if (expected !== razorpay_signature) throw new Error('Signature verification failed');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hold = _findHold(holdId);
    if (!hold) throw new Error('Hold not found');
    if (hold.status !== 'active') throw new Error('Hold is no longer active');
    if (String(hold.sessionId) !== String(sessionId)) throw new Error('Hold/session mismatch');
    if (String(hold.razorpay_order_id) !== String(razorpay_order_id)) throw new Error('Order/hold mismatch');

    // Recover the rest from the original create call.
    const player = _readPlayerFromOrderNotes(razorpay_order_id) || {};
    const session = _getSession(sessionId);

    _appendRow('Players', [
      sessionId,
      player.name || '',
      player.phone || '',
      player.skill || '',
      session ? session.price : '',
      razorpay_payment_id,
      razorpay_order_id,
      new Date().toISOString()
    ]);

    _markHold(hold.rowIdx, 'consumed');
    return { ok: true };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* --------------------------- Razorpay --------------------------- */

function _razorpayCreateOrder(amountPaise, sessionId, player) {
  const keyId = _prop('RAZORPAY_KEY_ID');
  const keySecret = _prop('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) throw new Error('Razorpay keys not configured');

  const auth = 'Basic ' + Utilities.base64Encode(keyId + ':' + keySecret);
  const receipt = ('doc_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6)).slice(0, 40);
  const payload = {
    amount: amountPaise,
    currency: 'INR',
    receipt: receipt,
    notes: {
      sessionId: String(sessionId),
      name: player.name || '',
      phone: player.phone || '',
      skill: player.skill || ''
    }
  };
  const res = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: auth },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code >= 300) throw new Error('Razorpay error: ' + (body.error && body.error.description || code));
  return body;
}

function _readPlayerFromOrderNotes(orderId) {
  const keyId = _prop('RAZORPAY_KEY_ID');
  const keySecret = _prop('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) return null;
  const auth = 'Basic ' + Utilities.base64Encode(keyId + ':' + keySecret);
  const res = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(orderId), {
    method: 'get',
    headers: { Authorization: auth },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) return null;
  const body = JSON.parse(res.getContentText() || '{}');
  return body.notes || null;
}

/* --------------------------- Sheet helpers --------------------------- */

function _ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function _sheet(name) {
  const ss = _ss();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = _initSheet(name);
  return sh;
}

function _initSheet(name) {
  const ss = _ss();
  const sh = ss.insertSheet(name);
  if (name === 'Sessions') sh.appendRow(['id', 'date', 'time', 'venue', 'price', 'maxSlots', 'active']);
  if (name === 'Players')  sh.appendRow(['sessionId', 'name', 'phone', 'skill', 'amount', 'razorpay_payment_id', 'razorpay_order_id', 'createdAt']);
  if (name === 'Holds')    sh.appendRow(['holdId', 'sessionId', 'razorpay_order_id', 'createdAt', 'expiresAt', 'status']);
  return sh;
}

function _debug() {
  const sh = _sheet('Sessions');
  if (sh.getLastRow() < 2) return { ok: true, raw: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  const raw = rows.map(r => ({
    col0: String(r[0]),
    col1_type: Object.prototype.toString.call(r[1]),
    col1_val: String(r[1]),
    col2_type: Object.prototype.toString.call(r[2]),
    col2_val: String(r[2]),
    col3: String(r[3]),
    col4: String(r[4]),
    col5: String(r[5]),
    col6: String(r[6])
  }));
  return { ok: true, raw };
}

function _readSessions() {
  const sh = _sheet('Sessions');
  if (sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  return rows.filter(r => r[0]).map(r => ({
    id: String(r[0]),
    date: _ymd(r[1]),
    time: _fmtTime(r[2]),
    venue: String(r[3] || ''),
    price: Number(r[4] || 0),
    maxSlots: Number(r[5] || 0),
    active: r[6] === '' || r[6] === true || String(r[6]).toLowerCase() === 'true' || r[6] === 1
  }));
}

function _getSession(id) {
  return _readSessions().find(s => String(s.id) === String(id));
}

function _countTakenBySession() {
  const counts = {};
  // Confirmed bookings.
  const ps = _sheet('Players');
  if (ps.getLastRow() >= 2) {
    const rows = ps.getRange(2, 1, ps.getLastRow() - 1, 1).getValues();
    rows.forEach(r => {
      const id = String(r[0] || '');
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
  }
  // Active (un-expired, un-consumed) holds.
  const hs = _sheet('Holds');
  if (hs.getLastRow() >= 2) {
    const rows = hs.getRange(2, 1, hs.getLastRow() - 1, 6).getValues();
    const now = new Date();
    rows.forEach(r => {
      const status = String(r[5] || '');
      const expiresAt = r[4] ? new Date(r[4]) : null;
      if (status === 'active' && expiresAt && expiresAt > now) {
        const id = String(r[1] || '');
        if (id) counts[id] = (counts[id] || 0) + 1;
      }
    });
  }
  return counts;
}

function _findHold(holdId) {
  const sh = _sheet('Holds');
  if (sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[0]) === String(holdId)) {
      return {
        rowIdx: i + 2,
        holdId: r[0],
        sessionId: r[1],
        razorpay_order_id: r[2],
        createdAt: r[3],
        expiresAt: r[4],
        status: r[5]
      };
    }
  }
  return null;
}

function _markHold(rowIdx, status) {
  _sheet('Holds').getRange(rowIdx, 6).setValue(status);
}

function _expireStaleHolds() {
  const sh = _sheet('Holds');
  if (sh.getLastRow() < 2) return;
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, 6);
  const rows = range.getValues();
  const now = new Date();
  let changed = false;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][5]) === 'active') {
      const exp = rows[i][4] ? new Date(rows[i][4]) : null;
      if (exp && exp <= now) {
        rows[i][5] = 'released';
        changed = true;
      }
    }
  }
  if (changed) range.setValues(rows);
}

function _appendRow(sheetName, values) {
  _sheet(sheetName).appendRow(values);
}

/* --------------------------- Utilities --------------------------- */

function _prop(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _ymd(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) === '[object Date]') {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(d);
}

function _fmtTime(t) {
  if (!t) return '';
  if (Object.prototype.toString.call(t) === '[object Date]') {
    return Utilities.formatDate(t, Session.getScriptTimeZone(), 'h:mm a');
  }
  return String(t);
}

function _todayYmd() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function _hmacSha256Hex(message, key) {
  const sig = Utilities.computeHmacSha256Signature(message, key);
  return sig.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/* --------------------------- One-time setup --------------------------- */

/** Run once from the Apps Script editor to bootstrap the sheets. */
function setup() {
  _sheet('Sessions');
  _sheet('Players');
  _sheet('Holds');
  _applySessionValidations();
  return 'Sheets initialized.';
}

function onEdit(e) {
  var sh = e.source.getActiveSheet();
  if (sh.getName() !== 'Sessions') return;
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row < 2 || col === 1) return;

  // Bust sessions cache on any edit
  CacheService.getScriptCache().remove(CACHE_KEY_SESSIONS);

  var idCell = sh.getRange(row, 1);
  if (idCell.getValue()) return;

  var id = 's' + Date.now().toString(36);
  idCell.setValue(id);
}

function _applySessionValidations() {
  const sh = _sheet('Sessions');
  const maxRow = 200;

  // Column A (id) — protected, auto-generated
  sh.getRange(2, 1, maxRow, 1).setBackground('#f3f3f3').setFontColor('#888888');
  var protection = sh.getRange(2, 1, maxRow, 1).protect()
    .setDescription('Auto-generated session ID — do not edit');
  protection.setWarningOnly(true);

  // Column B (date) — date picker
  sh.getRange(2, 2, maxRow, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(false)
      .setHelpText('Pick a date')
      .build());
  sh.getRange(2, 2, maxRow, 1).setNumberFormat('yyyy-mm-dd');

  // Column C (time) — dropdown of time slots
  var timeSlots = [
    '5:00 AM','5:30 AM','6:00 AM','6:30 AM','7:00 AM','7:30 AM',
    '8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM',
    '11:00 AM','11:30 AM','12:00 PM','12:30 PM',
    '1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM',
    '4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM',
    '7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM'
  ];
  sh.getRange(2, 3, maxRow, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(timeSlots, true)
      .setAllowInvalid(false)
      .setHelpText('Pick a time slot')
      .build());

  // Column F (maxSlots) — dropdown range 1-30
  var slotOptions = [];
  for (var i = 1; i <= 30; i++) slotOptions.push(String(i));
  sh.getRange(2, 6, maxRow, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(slotOptions, true)
      .setAllowInvalid(false)
      .setHelpText('Max players (1-30)')
      .build());

  // Column G (active) — TRUE/FALSE dropdown
  sh.getRange(2, 7, maxRow, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE', 'FALSE'], true)
      .setAllowInvalid(false)
      .setHelpText('Is this session active?')
      .build());
}
