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

// Import after mocks are set up
const { default: handler } = await import('../api/register.js');
const { rateLimit } = await import('../api/_lib/rateLimit.js');

describe('register handler', () => {
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

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET', body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._json.error).toBe('Method not allowed');
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createMockReq({ body: { sessionId: 'sess-1', player: { name: 'Alice' } } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._json.error).toBe('Missing required fields');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    rateLimit.mockReturnValue({ ok: false });
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(429);
    expect(res._json.error).toContain('Too many requests');
  });

  it('returns 404 when session is not found', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: null, error: { message: 'not found' } },
    ]);
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(404);
    expect(res._json.error).toContain('Session not found');
  });

  it('returns alreadyRegistered when phone already exists', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: { id: 'sess-1', max_slots: 10, beginner_slots: null, waitlist_max: 3, beginner_waitlist_max: 0, price: 300, active: true }, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: { id: 'player-1' }, error: null }, // existing player found via maybeSingle
    ]);
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.alreadyRegistered).toBe(true);
  });

  it('returns 409 when slots are full', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: { id: 'sess-1', max_slots: 10, beginner_slots: null, waitlist_max: 0, beginner_waitlist_max: 0, price: 300, active: true }, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player
      // getSlotCounts queries players
      { data: Array(10).fill({ skill: 'Intermediate', status: 'confirmed' }), error: null },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });
    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain('No slots available');
  });

  it('successfully registers a player', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: { id: 'sess-1', max_slots: 10, beginner_slots: null, waitlist_max: 3, beginner_waitlist_max: 0, price: 300, active: true }, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player (maybeSingle)
      // getSlotCounts query for players
      { data: [{ skill: 'Intermediate', status: 'confirmed' }], error: null },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });
    mockAtomicRegister.mockResolvedValue({ ok: true, method: 'rpc' });

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.alreadyRegistered).toBeUndefined();
  });

  it('stores partner data for doubles events', async () => {
    const bodyWithPartner = {
      sessionId: 'sess-1',
      player: {
        name: 'Alice',
        phone: '9876543210',
        skill: 'Intermediate',
        partnerName: 'Bob',
        partnerPhone: '9876543211',
        partnerDuprId: '12345',
      },
    };
    mockSupabase.__queueResponses('sessions', [
      { data: { id: 'sess-1', max_slots: 10, beginner_slots: null, waitlist_max: 3, beginner_waitlist_max: 0, price: 300, active: true }, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player
      { data: null, error: null }, // partner not registered as player
      { data: null, error: null }, // partner not on another team
      // getSlotCounts
      { data: [], error: null },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });
    mockAtomicRegister.mockResolvedValue({ ok: true, method: 'rpc' });

    const req = createMockReq({ body: bodyWithPartner });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);

    // Verify atomicRegister was called with partner data
    expect(mockAtomicRegister).toHaveBeenCalledWith(
      'sess-1',
      expect.any(Object),
      expect.objectContaining({
        partnerName: 'Bob',
        partnerPhone: '9876543211',
        partnerDuprId: '12345',
      }),
      'confirmed'
    );
  });

  it('returns 409 when only waitlist is available (redirects to waitlist endpoint)', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: { id: 'sess-1', max_slots: 10, beginner_slots: null, waitlist_max: 3, beginner_waitlist_max: 0, price: 300, active: true }, error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: null, error: null }, // no existing player
      // getSlotCounts: 10 confirmed fills the main slots
      { data: Array(10).fill({ skill: 'Intermediate', status: 'confirmed' }), error: null },
    ]);
    mockSupabase.__setResponse('holds', { data: [], error: null });

    const req = createMockReq({ body: validBody });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(409);
    expect(res._json.error).toContain('waitlist');
  });
});
