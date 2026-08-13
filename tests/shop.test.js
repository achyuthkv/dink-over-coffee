import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));
vi.mock('../api/_lib/rateLimit.js', () => ({
  rateLimit: vi.fn(() => ({ ok: true })),
}));

const { default: handler } = await import('../api/shop.js');
const { rateLimit } = await import('../api/_lib/rateLimit.js');

describe('shop handler', () => {
  beforeEach(() => {
    mockSupabase.__reset();
    vi.clearAllMocks();
    rateLimit.mockReturnValue({ ok: true });
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET', body: { action: 'products' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 400 for an unknown action', async () => {
    const req = createMockReq({ body: { action: 'bogus' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Invalid action');
  });

  describe('action: products', () => {
    it('returns 500 when the products query fails', async () => {
      mockSupabase.__queueResponses('products', [{ data: null, error: { message: 'db error' } }]);
      const req = createMockReq({ body: { action: 'products' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(500);
    });

    it('lists active products with available stock net of active holds', async () => {
      mockSupabase.__queueResponses('products', [
        { data: [
          { id: 'p1', name: 'Tee', description: 'Cotton tee', price: 500, image_url: null, sizes: ['S', 'M', 'L'], stock: 10, category: 'apparel', active: true },
          { id: 'p2', name: 'Cap', description: null, price: 300, image_url: null, sizes: null, stock: null, category: 'apparel', active: true },
        ], error: null },
      ]);
      mockSupabase.__queueResponses('shop_holds', [
        { data: [{ items: [{ productId: 'p1', quantity: 3 }] }], error: null },
      ]);

      const req = createMockReq({ body: { action: 'products' } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.ok).toBe(true);
      expect(res._json.products).toHaveLength(2);
      expect(res._json.products[0].stock).toBe(7);
      expect(res._json.products[1].stock).toBeNull();
    });
  });

  describe('action: order (manual checkout, no Razorpay)', () => {
    const validCustomer = { name: 'Alice', phone: '9876543210', email: 'alice@example.com', address: '221B Baker Street', city: 'Bengaluru', pincode: '560041' };
    const validBody = { action: 'order', items: [{ productId: 'p1', size: 'M', quantity: 2 }], customer: validCustomer };

    it('returns 400 when the order is empty', async () => {
      const req = createMockReq({ body: { action: 'order', items: [], customer: validCustomer } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
      expect(res._json.error).toContain('empty');
    });

    it('returns 400 for invalid customer details', async () => {
      const req = createMockReq({ body: { action: 'order', items: validBody.items, customer: { ...validCustomer, phone: '123' } } });
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
});
