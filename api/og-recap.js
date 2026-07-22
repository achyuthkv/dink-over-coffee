import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return new Response('Missing id', { status: 400 });
    }

    const sessions = await query('sessions', {
      select: 'date,time,venue,title',
      id: `eq.${sessionId}`,
      limit: '1',
    });

    const session = sessions[0];
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const players = await query('players', {
      select: 'phone,skill,partner_name',
      session_id: `eq.${sessionId}`,
      status: 'eq.confirmed',
    });

    let totalPlayers = 0;
    (players || []).forEach(p => {
      totalPlayers += p.partner_name ? 2 : 1;
    });

    const allPhones = (players || []).map(p => p.phone);
    let firstTimers = 0;
    if (allPhones.length > 0) {
      const priorPlayers = await query('players', {
        select: 'phone',
        phone: `in.(${allPhones.map(p => `"${p}"`).join(',')})`,
        status: 'eq.confirmed',
        session_id: `neq.${sessionId}`,
      });
      const phonesWithHistory = new Set((priorPlayers || []).map(p => p.phone));
      firstTimers = allPhones.filter(p => !phonesWithHistory.has(p)).length;
    }

    const streak = computeStreak();

    return new ImageResponse(
      {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #0f1419 0%, #1a2332 50%, #0f1419 100%)',
            padding: '60px',
            fontFamily: 'system-ui, sans-serif',
          },
          children: [
            {
              type: 'div',
              props: {
                style: { display: 'flex', alignItems: 'center', gap: '12px' },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { fontSize: '24px', fontWeight: 700, color: '#05AD86', letterSpacing: '-0.5px' },
                      children: 'DINK OVER COFFEE',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { fontSize: '14px', color: '#6b7280', marginLeft: '8px' },
                      children: '· Session Recap',
                    },
                  },
                ],
              },
            },
            {
              type: 'div',
              props: {
                style: { display: 'flex', flexDirection: 'column', marginTop: '40px', flex: 1, justifyContent: 'center' },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { fontSize: '42px', fontWeight: 800, color: '#f3f4f6', lineHeight: 1.1 },
                      children: session.title || session.venue,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { fontSize: '20px', color: '#9ca3af', marginTop: '12px' },
                      children: `${fmtDate(session.date)} · ${session.time}`,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', gap: '40px', marginTop: '48px' },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: { display: 'flex', flexDirection: 'column' },
                            children: [
                              { type: 'div', props: { style: { fontSize: '48px', fontWeight: 800, color: '#05AD86' }, children: String(totalPlayers) } },
                              { type: 'div', props: { style: { fontSize: '16px', color: '#9ca3af', marginTop: '4px' }, children: 'players' } },
                            ],
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: { display: 'flex', flexDirection: 'column' },
                            children: [
                              { type: 'div', props: { style: { fontSize: '48px', fontWeight: 800, color: '#f59e0b' }, children: String(firstTimers) } },
                              { type: 'div', props: { style: { fontSize: '16px', color: '#9ca3af', marginTop: '4px' }, children: 'first-timers' } },
                            ],
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: { display: 'flex', flexDirection: 'column' },
                            children: [
                              { type: 'div', props: { style: { fontSize: '48px', fontWeight: 800, color: '#f97316' }, children: `${streak}` } },
                              { type: 'div', props: { style: { fontSize: '16px', color: '#9ca3af', marginTop: '4px' }, children: 'weeks straight' } },
                            ],
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            {
              type: 'div',
              props: {
                style: { fontSize: '16px', color: '#6b7280' },
                children: 'dinkovercoffee.com',
              },
            },
          ],
        },
      },
      { width: 1200, height: 630 }
    );
  } catch (err) {
    console.error(err);
    return new Response('Failed to generate image', { status: 500 });
  }
}
