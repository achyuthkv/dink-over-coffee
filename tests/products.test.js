import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));

const { default: handler } = await import('../api/products.js');

describe('products handler', () => {
  beforeEach(() => {
    mockSupabase.__reset();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 500 when the products query fails', async () => {
    mockSupabase.__queueResponses('products', [{ data: null, error: { message: 'db error' } }]);
    const req = createMockReq({ body: {} });
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

    const req = createMockReq({ body: {} });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.products).toHaveLength(2);
    expect(res._json.products[0].stock).toBe(7);
    expect(res._json.products[1].stock).toBeNull();
  });
});
