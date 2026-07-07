import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();
const mockAtomicRegister = vi.fn();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));
vi.mock('../api/_lib/rateLimit.js', () => ({
  rateLimit: vi.fn(() => ({ ok: true })),
}));
vi.mock('../api/_lib/atomicRegister.js', () => ({
  atomicRegister: mockAtomicRegister,
}));

const { default: handler } = await import('../api/waitlist.js');
const { rateLimit } = await import('../api/_lib/rateLimit.js');

describe('waitlist handler', () => {
  beforeEach(() => {
    mockSupabase.__reset();
    vi.clearAllMocks();
    rateLimit.mockReturnValue({ ok: true });
    mockAtomicRegister.mockResolvedValue({ ok: true, method: 'rpc' });
  });

  const validBody = {
    sessionId: 'sess-1',
    player: { name: 'Alice', phone: '9876543210', skill: 'Intermediate' },
  };

  const baseSession = {
    id: 'sess-1',
    max_slots: 10,
    beginner_slots: null,
    waitlist_max: 3,
    beginner_waitlist_max: 0,
    price: 300,
    active: true,
  };

  it('successfully joins the waitlist', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: baseSession, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player (maybeSingle)
      // getSlotCounts
      { data: [{ skill: 'Intermediate', status: 'confirmed' }], error: null },
      // count query after insert (select with count: 'exact', head: true)
      { data: null, error: null, count: 2 },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });
    mockAtomicRegister.mockResolvedValue({ ok: true, method: 'rpc' });

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.position).toBe(2);
  });

  it('returns alreadyWaitlisted when player already on waitlist', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: baseSession, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: { id: 'player-1', status: 'waitlisted' }, error: null },
    ]);

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.alreadyWaitlisted).toBe(true);
  });

  it('returns alreadyRegistered when player already confirmed', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: baseSession, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: { id: 'player-1', status: 'confirmed' }, error: null },
    ]);

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.alreadyRegistered).toBe(true);
  });

  it('returns 409 when waitlist is full', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: { ...baseSession, waitlist_max: 2 }, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player
      // getSlotCounts: 2 waitlisted fills the waitlist_max of 2
      { data: [
        { skill: 'Intermediate', status: 'waitlisted' },
        { skill: 'Intermediate', status: 'waitlisted' },
      ], error: null },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain('Waitlist is full');
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createMockReq({ body: { sessionId: 'sess-1' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toBe('Missing required fields');
  });

  it('returns 404 when session not found', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: null, error: { message: 'not found' } },
    ]);

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(404);
    expect(res._json.error).toContain('Session not found');
  });

  it('returns alreadyWaitlisted when atomicRegister detects duplicate', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: baseSession, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player
      // getSlotCounts
      { data: [], error: null },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });
    mockAtomicRegister.mockResolvedValue({ ok: true, alreadyExists: true });

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.alreadyWaitlisted).toBe(true);
  });
});
