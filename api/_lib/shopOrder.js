/**
 * Shared validation/pricing logic for the paid (shop-create-order) and
 * manual (shop-order) checkout paths, so both re-derive price and stock
 * from the server-side product records rather than trusting the client.
 */
export function validateCustomer(customer) {
  if (!customer?.name || customer.name.trim().length < 2) return 'Enter your name';
  if (!/^[0-9]{10}$/.test((customer.phone || '').trim())) return 'Enter a valid 10-digit phone number';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((customer.email || '').trim())) return 'Enter a valid email address';
  if (!customer.address || customer.address.trim().length < 5) return 'Enter your shipping address';
  if (!customer.city || customer.city.trim().length < 2) return 'Enter your city';
  if (!/^[0-9]{6}$/.test((customer.pincode || '').trim())) return 'Enter a valid 6-digit pincode';
  return null;
}

export function buildOrderItems(items, productMap) {
  let amount = 0;
  const orderItems = [];
  const qtyByProduct = {};

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) return { error: 'One or more items are no longer available' };

    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
    if (Array.isArray(product.sizes) && product.sizes.length > 0 && !product.sizes.includes(item.size)) {
      return { error: `Select a valid size for ${product.name}` };
    }

    qtyByProduct[item.productId] = (qtyByProduct[item.productId] || 0) + quantity;
    amount += Number(product.price) * quantity;
    orderItems.push({
      productId: product.id,
      name: product.name,
      size: item.size || null,
      quantity,
      price: Number(product.price)
    });
  }

  return { orderItems, amount, qtyByProduct };
}

export function checkStock(qtyByProduct, productMap, reserved = {}) {
  for (const [productId, qty] of Object.entries(qtyByProduct)) {
    const product = productMap.get(productId);
    if (product.stock === null || product.stock === undefined) continue;
    const available = Math.max(0, Number(product.stock) - (reserved[productId] || 0));
    if (qty > available) return { error: `Only ${available} of "${product.name}" left in stock` };
  }
  return {};
}
