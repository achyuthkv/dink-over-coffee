import supabase from './_lib/supabase.js';

const START_DATE = new Date('2025-03-22T00:00:00');

function computeStreak() {
  const today = new Date();
  const diff = today - START_DATE;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`;
}

function escXml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getSessionData(sessionId) {
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (!session) return null;

  const { data: players } = await supabase
    .from('players')
    .select('name, phone, skill, status, partner_name, needs_partner, created_at')
    .eq('session_id', sessionId)
    .eq('status', 'confirmed')
    .order('created_at');

  let totalPlayers = 0;
  const skillBreakdown = { Beginner: 0, Intermediate: 0, Advanced: 0 };
  (players || []).forEach(p => {
    const w = p.partner_name ? 2 : 1;
    totalPlayers += w;
    skillBreakdown[p.skill] = (skillBreakdown[p.skill] || 0) + w;
  });

  const allPhones = (players || []).map(p => p.phone);
  let firstTimers = 0;
  if (allPhones.length > 0) {
    const { data: priorPlayers } = await supabase
      .from('players')
      .select('phone')
      .in('phone', allPhones)
      .eq('status', 'confirmed')
      .neq('session_id', sessionId);
    const phonesWithHistory = new Set((priorPlayers || []).map(p => p.phone));
    firstTimers = allPhones.filter(p => !phonesWithHistory.has(p)).length;
  }

  return { session, players: players || [], totalPlayers, firstTimers, skillBreakdown };
}

async function handleJson(req, res) {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required' });

  const data = await getSessionData(sessionId);
  if (!data) return res.status(404).json({ ok: false, error: 'Session not found' });

  const { session, players, totalPlayers, firstTimers, skillBreakdown } = data;

  const { data: nextSessions } = await supabase
    .from('sessions')
    .select('id, date, time, venue, max_slots, title')
    .eq('active', true)
    .gt('date', session.date)
    .order('date')
    .order('time')
    .limit(1);

  let nextSession = null;
  if (nextSessions && nextSessions.length > 0) {
    const ns = nextSessions[0];
    const { data: nsPlayers } = await supabase
      .from('players')
      .select('id, partner_name')
      .eq('session_id', ns.id)
      .eq('status', 'confirmed');
    const taken = (nsPlayers || []).reduce((sum, p) => sum + (p.partner_name ? 2 : 1), 0);
    nextSession = { id: ns.id, date: ns.date, time: ns.time, venue: ns.venue, title: ns.title, spotsLeft: Math.max(0, ns.max_slots - taken) };
  }

  const playerNames = players.map(p => {
    const names = [p.name];
    if (p.partner_name) names.push(p.partner_name);
    return names;
  }).flat();

  return res.status(200).json({
    ok: true,
    recap: {
      session: { id: session.id, date: session.date, time: session.time, venue: session.venue, title: session.title, description: session.description },
      stats: { totalPlayers, firstTimers, skillBreakdown },
      players: playerNames,
      nextSession
    }
  });
}

async function handleOgImage(req, res, sessionId) {
  const data = await getSessionData(sessionId);
  if (!data) return res.status(404).end('Session not found');

  const { session, totalPlayers, firstTimers } = data;
  const streak = computeStreak();
  const title = escXml(session.title || session.venue);
  const dateStr = fmtDate(session.date);

  const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f1419"/>
      <stop offset="50%" style="stop-color:#1a2332"/>
      <stop offset="100%" style="stop-color:#0f1419"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="60" y="80" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="#05AD86">DINK OVER COFFEE</text>
  <text x="340" y="80" font-family="system-ui,sans-serif" font-size="14" fill="#6b7280">· Session Recap</text>
  <text x="60" y="220" font-family="system-ui,sans-serif" font-size="42" font-weight="800" fill="#f3f4f6">${title}</text>
  <text x="60" y="260" font-family="system-ui,sans-serif" font-size="20" fill="#9ca3af">${dateStr} · ${session.time}</text>
  <text x="60" y="380" font-family="system-ui,sans-serif" font-size="48" font-weight="800" fill="#05AD86">${totalPlayers}</text>
  <text x="60" y="410" font-family="system-ui,sans-serif" font-size="16" fill="#9ca3af">players</text>
  <text x="220" y="380" font-family="system-ui,sans-serif" font-size="48" font-weight="800" fill="#f59e0b">${firstTimers}</text>
  <text x="220" y="410" font-family="system-ui,sans-serif" font-size="16" fill="#9ca3af">first-timers</text>
  <text x="420" y="380" font-family="system-ui,sans-serif" font-size="48" font-weight="800" fill="#f97316">${streak}</text>
  <text x="420" y="410" font-family="system-ui,sans-serif" font-size="16" fill="#9ca3af">weeks straight</text>
  <text x="60" y="590" font-family="system-ui,sans-serif" font-size="16" fill="#6b7280">dinkovercoffee.com</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).end(svg);
}

async function handleMeta(req, res, sessionId) {
  const { data: session } = await supabase
    .from('sessions')
    .select('date, time, venue, title')
    .eq('id', sessionId)
    .single();

  const title = session ? escXml(`${session.title || session.venue} — Session Recap`) : 'Session Recap';
  const origin = `https://${req.headers.host || 'dinkovercoffee.com'}`;
  const ogImageUrl = `${origin}/api/recap?mode=og&id=${sessionId}`;
  const pageUrl = `${origin}/recap/${sessionId}`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — Dink Over Coffee</title>
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Dink Over Coffee" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="See who played, the skill mix, and our community streak. Book the next session!" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="See who played, the skill mix, and our community streak." />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <meta http-equiv="refresh" content="0;url=${pageUrl}" />
</head>
<body><p>Redirecting to <a href="${pageUrl}">recap</a>...</p></body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).end(html);
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const mode = url.searchParams.get('mode');
      const sessionId = url.searchParams.get('id');
      if (!sessionId) return res.status(400).end('Missing id');

      if (mode === 'og') return handleOgImage(req, res, sessionId);
      return handleMeta(req, res, sessionId);
    }

    if (req.method === 'POST') return handleJson(req, res);

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
