import supabase from './supabase.js';

/**
 * Sums quantities held by active, unexpired shop_holds per product, so stock
 * checks account for in-flight (not-yet-paid) checkouts the same way session
 * holds protect slot capacity.
 */
export async function getReservedQuantities(productIds) {
  if (!productIds || productIds.length === 0) return {};

  const { data } = await supabase
    .from('shop_holds')
    .select('items')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  const reserved = {};
  for (const hold of data || []) {
    for (const item of hold.items || []) {
      if (productIds.includes(item.productId)) {
        reserved[item.productId] = (reserved[item.productId] || 0) + Number(item.quantity || 0);
      }
    }
  }
  return reserved;
}
