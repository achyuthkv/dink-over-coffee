import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required' });

    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessErr || !session) return res.status(404).json({ ok: false, error: 'Session not found' });

    const { data: players, error: playErr } = await supabase
      .from('players')
      .select('name, phone, skill, status, partner_name, needs_partner, created_at')
      .eq('session_id', sessionId)
      .eq('status', 'confirmed')
      .order('created_at');

    if (playErr) return res.status(500).json({ ok: false, error: playErr.message });

    const allPhones = (players || []).map(p => p.phone);
    let firstTimers = 0;

    if (allPhones.length > 0) {
      const { data: priorPlayers } = await supabase
        .from('players')
        .select('phone, session_id')
        .in('phone', allPhones)
        .eq('status', 'confirmed')
        .neq('session_id', sessionId);

      const phonesWithHistory = new Set((priorPlayers || []).map(p => p.phone));
      firstTimers = allPhones.filter(p => !phonesWithHistory.has(p)).length;
    }

    const skillBreakdown = { Beginner: 0, Intermediate: 0, Advanced: 0 };
    let totalPlayers = 0;
    (players || []).forEach(p => {
      totalPlayers += p.partner_name ? 2 : 1;
      skillBreakdown[p.skill] = (skillBreakdown[p.skill] || 0) + (p.partner_name ? 2 : 1);
    });

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
      nextSession = {
        id: ns.id,
        date: ns.date,
        time: ns.time,
        venue: ns.venue,
        title: ns.title,
        spotsLeft: Math.max(0, ns.max_slots - taken)
      };
    }

    const playerNames = (players || []).map(p => {
      const names = [p.name];
      if (p.partner_name) names.push(p.partner_name);
      return names;
    }).flat();

    return res.status(200).json({
      ok: true,
      recap: {
        session: {
          id: session.id,
          date: session.date,
          time: session.time,
          venue: session.venue,
          title: session.title,
          description: session.description
        },
        stats: {
          totalPlayers,
          firstTimers,
          skillBreakdown
        },
        players: playerNames,
        nextSession
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
