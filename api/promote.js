import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    // Admin auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

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
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
