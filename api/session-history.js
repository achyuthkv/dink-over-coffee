import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('date')
      .order('date', { ascending: false })
      .limit(200);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const dates = {};
    (data || []).forEach(s => {
      dates[s.date] = (dates[s.date] || 0) + 1;
    });

    return res.status(200).json({ ok: true, dates });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
