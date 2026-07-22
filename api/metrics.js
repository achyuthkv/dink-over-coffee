import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
    const sixtyDaysAgo = new Date(now - 60 * 86400000).toISOString().slice(0, 10);
    const twentyOneDaysAgo = new Date(now - 21 * 86400000).toISOString().slice(0, 10);

    const [playersResult, sessionsResult] = await Promise.all([
      supabase
        .from('players')
        .select('id, session_id, name, phone, skill, status, paid, created_at')
        .in('status', ['confirmed', 'waitlisted', 'withdrew']),
      supabase
        .from('sessions')
        .select('id, date, time, venue, title, max_slots, active, event_type')
        .order('date', { ascending: false })
    ]);

    const allPlayers = playersResult.data || [];
    const allSessions = sessionsResult.data || [];

    const sessionDateMap = {};
    allSessions.forEach(s => { sessionDateMap[s.id] = s.date; });

    // Enrich players with session date
    const players = allPlayers.map(p => ({
      ...p,
      sessionDate: sessionDateMap[p.session_id] || null
    }));

    const confirmed = players.filter(p => p.status === 'confirmed');

    // --- 1. GROWTH: unique players by first appearance ---
    const firstSeen = {};
    confirmed.forEach(p => {
      const key = p.phone;
      if (!key) return;
      if (!firstSeen[key] || p.sessionDate < firstSeen[key]) {
        firstSeen[key] = p.sessionDate;
      }
    });

    const newThisMonth = Object.values(firstSeen).filter(d => d >= thirtyDaysAgo).length;
    const newLastMonth = Object.values(firstSeen).filter(d => d >= sixtyDaysAgo && d < thirtyDaysAgo).length;
    const totalUnique = Object.keys(firstSeen).length;

    // Weekly new player counts (last 8 weeks)
    const weeklyNew = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now - (w + 1) * 7 * 86400000).toISOString().slice(0, 10);
      const weekEnd = new Date(now - w * 7 * 86400000).toISOString().slice(0, 10);
      const count = Object.values(firstSeen).filter(d => d >= weekStart && d < weekEnd).length;
      weeklyNew.push(count);
    }

    // --- 2. INACTIVE PLAYERS: were active, now gone ---
    const lastSeen = {};
    const sessionCount = {};
    confirmed.forEach(p => {
      const key = p.phone;
      if (!key) return;
      if (!lastSeen[key] || p.sessionDate > lastSeen[key]) {
        lastSeen[key] = p.sessionDate;
      }
      sessionCount[key] = (sessionCount[key] || 0) + 1;
    });

    const nameByPhone = {};
    confirmed.forEach(p => {
      if (p.phone) nameByPhone[p.phone] = p.name;
    });

    const inactive = Object.entries(lastSeen)
      .filter(([phone, date]) => date < twentyOneDaysAgo && sessionCount[phone] >= 2)
      .map(([phone, date]) => ({
        phone,
        name: nameByPhone[phone] || 'Unknown',
        lastSessionDate: date,
        daysSince: Math.floor((now - new Date(date)) / 86400000),
        totalSessions: sessionCount[phone]
      }))
      .sort((a, b) => b.totalSessions - a.totalSessions)
      .slice(0, 15);

    // --- 3. SESSION POPULARITY ---
    const sessionStats = allSessions
      .filter(s => s.date <= today)
      .map(s => {
        const sessionPlayers = confirmed.filter(p => p.session_id === s.id);
        const waitlisted = players.filter(p => p.session_id === s.id && p.status === 'waitlisted');
        const fillRate = s.max_slots ? sessionPlayers.length / s.max_slots : 0;
        return {
          id: s.id,
          title: s.title || s.venue,
          date: s.date,
          time: s.time,
          venue: s.venue,
          maxSlots: s.max_slots,
          confirmed: sessionPlayers.length,
          waitlisted: waitlisted.length,
          fillRate: Math.round(fillRate * 100),
          event_type: s.event_type
        };
      })
      .sort((a, b) => b.fillRate - a.fillRate)
      .slice(0, 10);

    // --- 4. VENUE PERFORMANCE ---
    const venueMap = {};
    allSessions.filter(s => s.date <= today).forEach(s => {
      if (!venueMap[s.venue]) venueMap[s.venue] = { sessions: 0, totalFill: 0, totalWaitlist: 0, totalPaid: 0, totalConfirmed: 0 };
      const v = venueMap[s.venue];
      v.sessions++;
      const sp = confirmed.filter(p => p.session_id === s.id);
      const wl = players.filter(p => p.session_id === s.id && p.status === 'waitlisted');
      const paidCount = sp.filter(p => p.paid).length;
      v.totalConfirmed += sp.length;
      v.totalFill += s.max_slots ? sp.length / s.max_slots : 0;
      v.totalWaitlist += wl.length;
      v.totalPaid += paidCount;
    });

    const venues = Object.entries(venueMap).map(([name, v]) => ({
      name,
      sessions: v.sessions,
      avgFillRate: Math.round((v.totalFill / v.sessions) * 100),
      avgWaitlist: Math.round((v.totalWaitlist / v.sessions) * 10) / 10,
      paidRate: v.totalConfirmed ? Math.round((v.totalPaid / v.totalConfirmed) * 100) : 0
    })).sort((a, b) => b.avgFillRate - a.avgFillRate);

    // --- 5. CONVERSION FUNNEL ---
    // First session → came back → became regular (4+ sessions)
    const phoneSessions = {};
    confirmed.forEach(p => {
      if (!p.phone) return;
      if (!phoneSessions[p.phone]) phoneSessions[p.phone] = new Set();
      phoneSessions[p.phone].add(p.session_id);
    });

    const totalFirstTimers = Object.keys(firstSeen).length;
    const cameBack = Object.values(phoneSessions).filter(s => s.size >= 2).length;
    const regulars = Object.values(phoneSessions).filter(s => s.size >= 4).length;

    const funnel = {
      firstSession: totalFirstTimers,
      returned: cameBack,
      returnedPct: totalFirstTimers ? Math.round((cameBack / totalFirstTimers) * 100) : 0,
      regular: regulars,
      regularPct: totalFirstTimers ? Math.round((regulars / totalFirstTimers) * 100) : 0
    };

    // --- 6. REACH OUT LIST ---
    // Lapsed regulars (3+ sessions, none in 21 days) + high-value players who stopped
    const reachOut = Object.entries(lastSeen)
      .filter(([phone, date]) => date < twentyOneDaysAgo && sessionCount[phone] >= 3)
      .map(([phone, date]) => ({
        phone,
        name: nameByPhone[phone] || 'Unknown',
        lastSessionDate: date,
        daysSince: Math.floor((now - new Date(date)) / 86400000),
        totalSessions: sessionCount[phone]
      }))
      .sort((a, b) => b.totalSessions - a.totalSessions)
      .slice(0, 10);

    // --- 7. HEALTH SCORE ---
    const growthScore = Math.min(100, newThisMonth > 0 ? Math.round((newThisMonth / Math.max(newLastMonth, 1)) * 50) : 0);
    const retentionScore = funnel.returnedPct;
    const recentSessions = allSessions.filter(s => s.date >= thirtyDaysAgo && s.date <= today);
    const avgFill = recentSessions.length > 0
      ? recentSessions.reduce((sum, s) => {
          const count = confirmed.filter(p => p.session_id === s.id).length;
          return sum + (s.max_slots ? count / s.max_slots : 0);
        }, 0) / recentSessions.length
      : 0;
    const fillScore = Math.round(avgFill * 100);
    const conversionScore = funnel.regularPct;

    const healthScore = Math.round(
      growthScore * 0.25 +
      retentionScore * 0.3 +
      fillScore * 0.3 +
      conversionScore * 0.15
    );

    return res.status(200).json({
      ok: true,
      metrics: {
        health: {
          score: Math.min(100, healthScore),
          growth: growthScore,
          retention: retentionScore,
          fill: fillScore,
          conversion: conversionScore
        },
        growth: {
          newThisMonth,
          newLastMonth,
          totalUnique,
          weeklyNew,
          changePct: newLastMonth ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100) : (newThisMonth > 0 ? 100 : 0)
        },
        inactive,
        sessionStats,
        venues,
        funnel,
        reachOut
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
