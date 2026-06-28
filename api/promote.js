import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { sessionId, phone } = req.body;
  if (!sessionId || !phone) return res.status(400).json({ ok: false, error: 'sessionId and phone required' });

  const { data, error } = await supabase
    .from('players')
    .update({ status: 'confirmed' })
    .eq('session_id', sessionId)
    .eq('phone', phone.trim())
    .eq('status', 'waitlisted')
    .select('name')
    .single();

  if (error || !data) return res.status(404).json({ ok: false, error: 'Waitlisted player not found' });

  return res.status(200).json({ ok: true, promoted: true, name: data.name });
}
