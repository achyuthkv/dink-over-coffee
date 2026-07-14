import supabase from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { action, phone, name, signature } = req.body;

    if (!phone) return res.status(400).json({ ok: false, error: 'Phone is required' });

    if (action === 'check') {
      const { data } = await supabase
        .from('waivers')
        .select('id, name, signed_at')
        .eq('phone', phone.trim())
        .maybeSingle();

      return res.status(200).json({ ok: true, signed: !!data, waiver: data || null });
    }

    if (action === 'sign') {
      if (!name || !signature) {
        return res.status(400).json({ ok: false, error: 'Name and signature are required' });
      }

      const { data: existing } = await supabase
        .from('waivers')
        .select('id')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ ok: true, alreadySigned: true });
      }

      const { error } = await supabase
        .from('waivers')
        .insert({
          phone: phone.trim(),
          name: name.trim(),
          signature,
          signed_at: new Date().toISOString()
        });

      if (error) return res.status(500).json({ ok: false, error: error.message });

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'Invalid action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
