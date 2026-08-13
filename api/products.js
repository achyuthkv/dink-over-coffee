import supabase from './_lib/supabase.js';
import { getReservedQuantities } from './_lib/shopStock.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('created_at');

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const ids = (products || []).map(p => p.id);
    const reserved = await getReservedQuantities(ids);

    const result = (products || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      imageUrl: p.image_url,
      sizes: p.sizes || null,
      category: p.category,
      stock: p.stock === null || p.stock === undefined ? null : Math.max(0, Number(p.stock) - (reserved[p.id] || 0))
    }));

    return res.status(200).json({ ok: true, products: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
