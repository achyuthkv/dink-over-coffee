import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const today = new Date().toISOString().slice(0, 10);

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('active', true)
    .gte('date', today)
    .order('date')
    .order('time');

  if (error) return res.status(500).json({ ok: false, error: error.message });

  const sessionIds = sessions.map(s => s.id);

  const [playersResult, holdsResult, upisResult] = await Promise.all([
    supabase.from('players').select('session_id, skill, status').in('session_id', sessionIds),
    supabase.from('holds').select('session_id, id').eq('status', 'active').gt('expires_at', new Date().toISOString()).in('session_id', sessionIds),
    supabase.from('session_upis').select('session_id, sort_order, upi_accounts(id, label, upi_id, qr_image_url)').in('session_id', sessionIds).order('sort_order')
  ]);

  const players = playersResult.data || [];
  const holds = holdsResult.data || [];
  const sessionUpis = upisResult.data || [];

  const result = sessions.map(s => {
    const sp = players.filter(p => p.session_id === s.id);
    const sh = holds.filter(h => h.session_id === s.id);
    const upiRows = sessionUpis.filter(u => u.session_id === s.id).sort((a, b) => a.sort_order - b.sort_order);

    const confirmedBeginner = sp.filter(p => p.status === 'confirmed' && p.skill === 'Beginner').length;
    const confirmedOther = sp.filter(p => p.status === 'confirmed' && p.skill !== 'Beginner').length;
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
      takenSlots: confirmedBeginner + confirmedOther + sh.length,
      waitlistCount: waitlistedBeginner + waitlistedOther,
      beginnerTaken: confirmedBeginner,
      otherTaken: confirmedOther,
      beginnerWaitlistCount: waitlistedBeginner,
      otherWaitlistCount: waitlistedOther
    };
  });

  return res.status(200).json({ ok: true, sessions: result });
}
