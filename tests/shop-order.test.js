import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));
vi.mock('../api/_lib/rateLimit.js', () => ({
  rateLimit: vi.fn(() => ({ ok: true })),
}));

const { default: handler } = await import('../api/shop-order.js');
const { rateLimit } = await import('../api/_lib/rateLimit.js');

describe('shop-order handler', () => {
  beforeEach(() => {
    mockSupabase.__reset();
    vi.clearAllMocks();
    rateLimit.mockReturnValue({ ok: true });
  });

  const validCustomer = { name: 'Alice', phone: '9876543210', email: 'alice@example.com', address: '221B Baker Street', city: 'Bengaluru', pincode: '560041' };
  const validBody = { items: [{ productId: 'p1', size: 'M', quantity: 2 }], customer: validCustomer };

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET', body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 400 when the order is empty', async () => {
    const req = createMockReq({ body: { items: [], customer: validCustomer } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('empty');
  });

  it('returns 400 for invalid customer details', async () => {
    const req = createMockReq({ body: { items: validBody.items, customer: { ...validCustomer, phone: '123' } } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('phone');
  });

  it('returns 429 when rate limited', async () => {
    rateLimit.mockReturnValue({ ok: false });
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(429);
  });

  it('returns 400 when an item references an unknown product', async () => {
    mockSupabase.__queueResponses('products', [{ data: [], error: null }]);
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('no longer available');
  });

  it('returns 400 when the size is invalid for the product', async () => {
    mockSupabase.__queueResponses('products', [
      { data: [{ id: 'p1', name: 'Tee', price: 500, sizes: ['S', 'L'], stock: 10, active: true }], error: null },
    ]);
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Select a valid size');
  });

  it('returns 409 when stock is insufficient', async () => {
    mockSupabase.__queueResponses('products', [
      { data: [{ id: 'p1', name: 'Tee', price: 500, sizes: ['S', 'M', 'L'], stock: 1, active: true }], error: null },
    ]);
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain('left in stock');
  });

  it('places the order, decrements stock, and returns UPI accounts', async () => {
    mockSupabase.__queueResponses('products', [
      { data: [{ id: 'p1', name: 'Tee', price: 500, sizes: ['S', 'M', 'L'], stock: 10, active: true }], error: null },
    ]);
    mockSupabase.__queueResponses('shop_orders', [
      { data: { id: 'order-1' }, error: null },
    ]);
    mockSupabase.__queueResponses('upi_accounts', [
      { data: [{ id: 'u1', label: 'Club UPI', upi_id: 'club@upi', qr_image_url: null }], error: null },
    ]);

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.orderId).toBe('order-1');
    expect(res._json.amount).toBe(1000);
    expect(res._json.upiAccounts).toHaveLength(1);
  });
});
