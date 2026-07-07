import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));

const { default: handler } = await import('../api/promote.js');

describe('promote handler', () => {
  beforeEach(() => {
    mockSupabase.__reset();
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._json.error).toBe('Method not allowed');
  });

  it('returns 401 when no authorization header is provided', async () => {
    const req = createMockReq({ body: { sessionId: 'sess-1', phone: '9876543210' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Unauthorized');
  });

  it('returns 401 when authorization header is malformed', async () => {
    const req = createMockReq({
      body: { sessionId: 'sess-1', phone: '9876543210' },
      headers: { authorization: 'Basic abc123' },
    });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Unauthorized');
  });

  it('returns 401 when auth token is invalid', async () => {
    mockSupabase.__setAuthResponse({ data: { user: null }, error: { message: 'Invalid token' } });
    const req = createMockReq({
      body: { sessionId: 'sess-1', phone: '9876543210' },
      headers: { authorization: 'Bearer invalid-token' },
    });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._json.error).toBe('Unauthorized');
  });

  it('returns 400 when sessionId or phone missing', async () => {
    mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1' } }, error: null });
    const req = createMockReq({
      body: { sessionId: 'sess-1' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('required');
  });

  it('successfully promotes a waitlisted player', async () => {
    mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1' } }, error: null });
    mockSupabase.__queueResponses('players', [
      { data: { name: 'Alice' }, error: null },
    ]);

    const req = createMockReq({
      body: { sessionId: 'sess-1', phone: '9876543210' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.promoted).toBe(true);
    expect(res._json.name).toBe('Alice');
  });

  it('returns 404 when waitlisted player not found', async () => {
    mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1' } }, error: null });
    mockSupabase.__queueResponses('players', [
      { data: null, error: { message: 'No rows found' } },
    ]);

    const req = createMockReq({
      body: { sessionId: 'sess-1', phone: '0000000000' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._json.error).toContain('not found');
  });
});
