import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));

const { default: handler } = await import('../api/tournament.js');

describe('tournament handler', () => {
  beforeEach(() => {
    mockSupabase.__reset();
    vi.clearAllMocks();
  });

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });

  it('returns 401 when no authorization header is provided', async () => {
    const req = createMockReq({ body: { action: 'sync-teams', tournamentId: 't1' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 400 for an unknown action', async () => {
    mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1' } }, error: null });
    const req = createMockReq({ body: { action: 'nonsense' }, headers: { authorization: 'Bearer valid-token' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  describe('sync-teams', () => {
    beforeEach(() => {
      mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1' } }, error: null });
    });

    it('returns 400 when tournamentId is missing', async () => {
      const req = createMockReq({ body: { action: 'sync-teams' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });

    it('returns 404 when the tournament does not exist', async () => {
      mockSupabase.__setResponse('tournaments', { data: null, error: { message: 'not found' } });
      const req = createMockReq({ body: { action: 'sync-teams', tournamentId: 'missing' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(404);
    });

    it('returns created: 0 without querying further when the tournament has no linked session', async () => {
      mockSupabase.__setResponse('tournaments', { data: { id: 't1', session_id: null, status: 'setup' }, error: null });
      const req = createMockReq({ body: { action: 'sync-teams', tournamentId: 't1' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(res._json).toEqual({ ok: true, created: 0 });
    });

    it('returns created: 0 when the tournament is already completed', async () => {
      mockSupabase.__setResponse('tournaments', { data: { id: 't1', session_id: 'sess-1', status: 'completed' }, error: null });
      const req = createMockReq({ body: { action: 'sync-teams', tournamentId: 't1' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(res._json).toEqual({ ok: true, created: 0 });
    });

    it('inserts a team per qualifying player and reports the count', async () => {
      mockSupabase.__setResponse('tournaments', { data: { id: 't1', session_id: 'sess-1', status: 'active' }, error: null });
      mockSupabase.__queueResponses('players', [
        { data: [{ id: 1, name: 'Alice', partner_name: 'Amy', status: 'confirmed', needs_partner: false }], error: null }
      ]);
      mockSupabase.__queueResponses('tournament_courts', [
        { data: [{ id: 'c1', sort_order: 0 }], error: null }
      ]);
      mockSupabase.__queueResponses('tournament_teams', [
        { data: [], error: null },       // existing teams select
        { data: null, error: null }      // insert
      ]);

      const req = createMockReq({ body: { action: 'sync-teams', tournamentId: 't1' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json).toEqual({ ok: true, created: 1 });
    });
  });
});
