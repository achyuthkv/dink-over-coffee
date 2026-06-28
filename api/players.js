import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ ok: false, error: 'sessionId required' });

  const { data, error } = await supabase
    .from('players')
    .select('name, skill, status')
    .eq('session_id', sessionId)
    .order('created_at');

  if (error) return res.status(500).json({ ok: false, error: error.message });

  return res.status(200).json({ ok: true, players: data || [] });
}
