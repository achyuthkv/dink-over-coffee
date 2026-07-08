import supabase from './_lib/supabase.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'Dink Over Coffee <play@dinkovercoffee.com>';

function formatSessionDate(dateStr, timeStr) {
  const dt = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`;
}

function generateICS(session) {
  const dateStr = session.date.replace(/-/g, '');
  const timeStr = session.time || '';
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);

  let dtStart, dtEnd;
  if (match) {
    dtStart = `${dateStr}T${match[1].padStart(2, '0')}${match[2]}00`;
    dtEnd = `${dateStr}T${match[3].padStart(2, '0')}${match[4]}00`;
  } else {
    dtStart = `${dateStr}T070000`;
    dtEnd = `${dateStr}T090000`;
  }

  const uid = `doc-${session.id}@dinkovercoffee.com`;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dink Over Coffee//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:${session.title || 'Dink Over Coffee'}`,
    `LOCATION:${session.venue || ''}`,
    `DESCRIPTION:Play. Connect. Belong.`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function buildHtml(session, body) {
  const dateFormatted = formatSessionDate(session.date, session.time);
  const title = session.title || 'Dink Over Coffee';

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
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${title} - ${dateFormatted}</h1>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:24px 32px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f2fcf8;border-radius:12px;border:1px solid #e8f5f0;">
<tr><td style="padding:16px 20px;">
<p style="margin:0;font-size:14px;color:#003D30;font-weight:600;">${title}</p>
<p style="margin:4px 0 0;font-size:13px;color:#5d7a71;">${dateFormatted} &middot; ${session.time || ''}</p>
<p style="margin:4px 0 0;font-size:13px;color:#5d7a71;">${session.venue || ''}</p>
</td></tr>
</table>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:24px 32px;">
<p style="margin:0;font-size:15px;line-height:1.6;color:#003D30;">
${body.replace(/\n/g, '<br />')}
</p>
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:0 32px;">
<hr style="border:none;border-top:1px solid #e8f5f0;margin:0;" />
</td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr><td style="padding:20px 32px;">
<p style="margin:0;font-size:12px;color:#5d7a71;text-align:center;">See you on court!</p>
</td></tr>
</table>

</td></tr>

<tr><td align="center" style="padding:32px 20px 0;">
<p style="margin:0;font-size:12px;color:#5d7a71;">Play. Connect. Belong.</p>
<p style="margin:8px 0 0;font-size:11px;color:#93a29b;">
<a href="https://dinkovercoffee.com" style="color:#00B08A;text-decoration:none;">dinkovercoffee.com</a>
&nbsp;&middot;&nbsp;
<a href="mailto:dinkovercoffee@gmail.com" style="color:#00B08A;text-decoration:none;">dinkovercoffee@gmail.com</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { sessionId, body } = req.body;
    if (!sessionId || !body) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: sessionId, body' });
    }

    if (!RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'Email service not configured' });
    }

    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) return res.status(404).json({ ok: false, error: 'Session not found' });

    const { data: players, error } = await supabase
      .from('players')
      .select('email, name')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed')
      .not('email', 'is', null);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const recipients = (players || []).filter(p => p.email);
    if (recipients.length === 0) {
      return res.status(400).json({ ok: false, error: 'No confirmed players with email addresses' });
    }

    const emails = recipients.map(p => p.email);
    const dateFormatted = formatSessionDate(session.date, session.time);
    const subject = `${session.title || 'Dink Over Coffee'} - ${dateFormatted} | ${session.time || ''}`;
    const html = buildHtml(session, body);
    const icsContent = generateICS(session);
    const icsBase64 = Buffer.from(icsContent).toString('base64');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: emails,
        subject,
        html,
        attachments: [{
          filename: 'invite.ics',
          content: icsBase64,
          content_type: 'text/calendar; method=PUBLISH'
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ ok: false, error: err.message || 'Failed to send email' });
    }

    return res.status(200).json({ ok: true, sent: emails.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
