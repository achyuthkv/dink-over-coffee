import supabase from './_lib/supabase.js';

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

    const title = session ? `${session.title || session.venue} — Session Recap` : 'Session Recap';
    const origin = `https://${req.headers.host || 'dinkovercoffee.com'}`;
    const ogImageUrl = `${origin}/api/og-recap?id=${sessionId}`;
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
<body>
  <p>Redirecting to <a href="${pageUrl}">recap</a>...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).end(html);
  } catch (err) {
    console.error(err);
    return res.status(500).end('Error');
  }
}
