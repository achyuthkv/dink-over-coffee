const BOT_UA = /facebookexternalhit|Facebot|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Discordbot|googlebot|bingbot/i;

export const config = {
  matcher: '/recap/:path*',
};

export default function middleware(req) {
  const ua = req.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) return;

  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const sessionId = parts[2];
  if (!sessionId) return;

  const origin = url.origin;
  const ogImageUrl = `${origin}/api/og-recap?id=${sessionId}`;
  const pageUrl = `${origin}/recap/${sessionId}`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Session Recap — Dink Over Coffee</title>
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Dink Over Coffee" />
  <meta property="og:title" content="Session Recap — Dink Over Coffee" />
  <meta property="og:description" content="See who played, the skill mix, and our community streak. Book the next session!" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Session Recap — Dink Over Coffee" />
  <meta name="twitter:description" content="See who played, the skill mix, and our community streak." />
  <meta name="twitter:image" content="${ogImageUrl}" />
</head>
<body></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
