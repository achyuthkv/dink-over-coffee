import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = dateFormatter.format(now);
    const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const [currentHour, currentMin] = timeFormatter.format(now).split(':').map(Number);

    const { data: allSessions, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('active', true)
      .gte('date', today)
      .order('date')
      .order('time');

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const sessions = (allSessions || []).filter(s => {
      if (s.date !== today) return true;
      const timeStr = s.time || '';
      // Match end time in "HH:MM - HH:MM" (24h) or "7am - 9am" (12h) formats
      let h, m;
      const match24 = timeStr.match(/(\d{1,2}):(\d{2})\s*$/);
      const match12 = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i);
      if (match24) {
        h = parseInt(match24[1], 10);
        m = parseInt(match24[2], 10);
      } else if (match12) {
        h = parseInt(match12[1], 10);
        m = parseInt(match12[2] || '0', 10);
        const period = match12[3].toLowerCase();
        if (period === 'pm' && h !== 12) h += 12;
        if (period === 'am' && h === 12) h = 0;
      } else {
        return true;
      }
      return currentHour < h || (currentHour === h && currentMin < m);
    });

    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length === 0) return res.status(200).json({ ok: true, sessions: [] });

    const [playersResult, holdsResult, upisResult] = await Promise.all([
      supabase.from('players').select('session_id, skill, status, partner_name').in('session_id', sessionIds),
      supabase.from('holds').select('session_id, id, slots').eq('status', 'active').gt('expires_at', new Date().toISOString()).in('session_id', sessionIds),
      supabase.from('session_upis').select('session_id, sort_order, upi_accounts(id, label, upi_id, qr_image_url)').in('session_id', sessionIds).order('sort_order')
    ]);

    const players = playersResult.data || [];
    const holds = holdsResult.data || [];
    const sessionUpis = upisResult.data || [];

    const result = sessions.map(s => {
      const sp = players.filter(p => p.session_id === s.id);
      const sh = holds.filter(h => h.session_id === s.id);
      const upiRows = sessionUpis.filter(u => u.session_id === s.id).sort((a, b) => a.sort_order - b.sort_order);

      const slotWeight = (p) => p.partner_name ? 2 : 1;
      const confirmedBeginner = sp.filter(p => p.status === 'confirmed' && p.skill === 'Beginner').reduce((sum, p) => sum + slotWeight(p), 0);
      const confirmedOther = sp.filter(p => p.status === 'confirmed' && p.skill !== 'Beginner').reduce((sum, p) => sum + slotWeight(p), 0);
      const waitlistedBeginner = sp.filter(p => p.status === 'waitlisted' && p.skill === 'Beginner').length;
      const waitlistedOther = sp.filter(p => p.status === 'waitlisted' && p.skill !== 'Beginner').length;

      const upiAccounts = upiRows.map(u => u.upi_accounts).filter(Boolean);

      return {
        id: s.id,
        date: s.date,
        time: s.time,
        venue: s.venue,
        price: Number(s.price),
        maxSlots: s.max_slots,
        waitlistMax: s.waitlist_max,
        beginnerSlots: s.beginner_slots,
        beginnerWaitlistMax: s.beginner_waitlist_max,
        upiAccounts,
        title: s.title,
        description: s.description,
        event_type: s.event_type || 'regular',
        takenSlots: confirmedBeginner + confirmedOther + sh.reduce((sum, h) => sum + (h.slots || 1), 0),
        waitlistCount: waitlistedBeginner + waitlistedOther,
        beginnerTaken: confirmedBeginner,
        otherTaken: confirmedOther,
        beginnerWaitlistCount: waitlistedBeginner,
        otherWaitlistCount: waitlistedOther
      };
    });

    return res.status(200).json({ ok: true, sessions: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
