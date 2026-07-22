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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end('Method not allowed');

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const sessionId = url.searchParams.get('id');
    if (!sessionId) return res.status(400).end('Missing id');

    const { data: session } = await supabase
      .from('sessions')
      .select('date, time, venue, title')
      .eq('id', sessionId)
      .single();

    if (!session) return res.status(404).end('Session not found');

    const { data: players } = await supabase
      .from('players')
      .select('phone, skill, partner_name')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed');

    let totalPlayers = 0;
    (players || []).forEach(p => {
      totalPlayers += p.partner_name ? 2 : 1;
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
  } catch (err) {
    console.error(err);
    return res.status(500).end('Failed to generate image');
  }
}
