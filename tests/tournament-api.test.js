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

  it('returns 400 for an unknown action', async () => {
    const req = createMockReq({ body: { action: 'nonsense' } });
    const res = createMockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  describe('admin-only actions', () => {
    it('returns 401 for bulk-import with no authorization header', async () => {
      const req = createMockReq({ body: { action: 'bulk-import', categoryId: 'c1', rows: [] } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(401);
    });

    it('returns 403 for a referee account (valid session, wrong role)', async () => {
      mockSupabase.__setAuthResponse({ data: { user: { id: 'ref-1', app_metadata: { role: 'referee' } } }, error: null });
      const req = createMockReq({ body: { action: 'bulk-import', categoryId: 'c1', rows: [] }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(403);
    });

    it('returns 403 for a session with no admin role claim at all (e.g. a customer "member" account)', async () => {
      mockSupabase.__setAuthResponse({ data: { user: { id: 'member-1' } }, error: null });
      const req = createMockReq({ body: { action: 'bulk-import', categoryId: 'c1', rows: [] }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(403);
    });

    it('lets an organizer session through to the action itself (app_metadata.role === admin)', async () => {
      mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } }, error: null });
      // Empty rows still 400s -- from inside bulkImport, not the auth gate -- which is exactly what proves the gate let it through.
      const req = createMockReq({ body: { action: 'bulk-import', categoryId: 'c1', rows: [] }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });
  });

  describe('referee management', () => {
    beforeEach(() => {
      mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } }, error: null });
    });

    it('returns 401 for create-referee with no authorization header', async () => {
      mockSupabase.__reset();
      const req = createMockReq({ body: { action: 'create-referee', name: 'Ref', email: 'ref@example.com', password: 'longpassword' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(401);
    });

    it('returns 400 for a short password', async () => {
      const req = createMockReq({ body: { action: 'create-referee', name: 'Ref', email: 'ref@example.com', password: 'short' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });

    it('creates a referee auth user and referee row', async () => {
      mockSupabase.__setAdminCreateUserResponse({ data: { user: { id: 'new-ref-1' } }, error: null });
      const req = createMockReq({
        body: { action: 'create-referee', name: 'Riya Referee', email: 'riya@example.com', password: 'longenoughpassword' },
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(res._json).toEqual({ ok: true, refereeId: 'new-ref-1' });
    });

    it('rolls back the auth user if the referee row insert fails', async () => {
      mockSupabase.__setAdminCreateUserResponse({ data: { user: { id: 'new-ref-1' } }, error: null });
      mockSupabase.__setResponse('referees', { data: null, error: { message: 'insert failed' } });
      const req = createMockReq({
        body: { action: 'create-referee', name: 'Riya', email: 'riya@example.com', password: 'longenoughpassword' },
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(500);
      expect(mockSupabase.__getCallLog().some(c => c.method === 'auth.admin.deleteUser' && c.id === 'new-ref-1')).toBe(true);
    });

    it('deletes a referee by id', async () => {
      const req = createMockReq({ body: { action: 'delete-referee', refereeId: 'ref-1' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(200);
      expect(res._json).toEqual({ ok: true });
    });

    it('returns 400 when refereeId is missing on delete', async () => {
      const req = createMockReq({ body: { action: 'delete-referee' }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });
  });

  describe('register', () => {
    it('returns 400 when categoryId or team is missing', async () => {
      const req = createMockReq({ body: { action: 'register' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });

    it('returns 404 when the category does not exist', async () => {
      mockSupabase.__setResponse('tournament_categories', { data: null, error: { message: 'not found' } });
      const req = createMockReq({ body: { action: 'register', categoryId: 'missing', team: { player1Name: 'Alice', player1Phone: '9999999999' } } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(404);
    });

    it('returns 409 when registration is not open', async () => {
      mockSupabase.__setResponse('tournament_categories', { data: { id: 'c1', status: 'setup', team_size: 1 }, error: null });
      const req = createMockReq({ body: { action: 'register', categoryId: 'c1', team: { player1Name: 'Alice', player1Phone: '9999999999' } } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(409);
    });

    it('returns 400 for an invalid team payload', async () => {
      mockSupabase.__setResponse('tournament_categories', { data: { id: 'c1', status: 'registration_open', team_size: 2 }, error: null });
      const req = createMockReq({ body: { action: 'register', categoryId: 'c1', team: { player1Name: 'Alice', player1Phone: '9999999999' } } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });

    it('registers a free singles entry as confirmed when there is room', async () => {
      mockSupabase.__setResponse('tournament_categories', {
        data: { id: 'c1', status: 'registration_open', team_size: 1, max_teams: null, entry_fee: 0, early_bird_fee: null, early_bird_deadline: null },
        error: null
      });
      mockSupabase.__queueResponses('tournament_teams', [
        { data: [], error: null },                 // isDuplicatePhone: team id list (empty -> no dup check)
        { data: [], error: null },                  // getTeamCounts: status list
        { data: { id: 'team-1' }, error: null }      // insert
      ]);
      mockSupabase.__queueResponses('tournament_holds', [
        { data: [], error: null }                    // getTeamCounts: active holds
      ]);
      mockSupabase.__queueResponses('tournament_registrations', [
        { data: null, error: null }                  // insert registration
      ]);

      const req = createMockReq({ body: { action: 'register', categoryId: 'c1', team: { player1Name: 'Alice', player1Phone: '9999999999' } } });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json).toMatchObject({ ok: true, status: 'confirmed', amount: 0, paymentStatus: 'free' });
    });
  });

  describe('create-order', () => {
    it('rejects a free category', async () => {
      mockSupabase.__setResponse('tournament_categories', { data: { id: 'c1', status: 'registration_open', team_size: 1, entry_fee: 0, early_bird_fee: null, early_bird_deadline: null }, error: null });
      mockSupabase.__queueResponses('tournament_teams', [{ data: [], error: null }]);
      const req = createMockReq({ body: { action: 'create-order', categoryId: 'c1', team: { player1Name: 'Alice', player1Phone: '9999999999' } } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });
  });

  describe('confirm-payment', () => {
    it('returns 400 when required fields are missing', async () => {
      const req = createMockReq({ body: { action: 'confirm-payment' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });
  });

  describe('bulk-import', () => {
    beforeEach(() => {
      mockSupabase.__setAuthResponse({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } }, error: null });
    });

    it('returns 400 when rows is empty', async () => {
      const req = createMockReq({ body: { action: 'bulk-import', categoryId: 'c1', rows: [] }, headers: { authorization: 'Bearer valid-token' } });
      const res = createMockRes();
      await handler(req, res);
      expect(res._status).toBe(400);
    });

    it('reports a validation error for an invalid row without failing the whole import', async () => {
      mockSupabase.__setResponse('tournament_categories', { data: { id: 'c1', team_size: 1, max_teams: null }, error: null });
      mockSupabase.__queueResponses('tournament_teams', [
        { data: [], error: null },                              // getTeamCounts
        { data: [{ id: 'team-1' }], error: null }                // insert
      ]);
      mockSupabase.__queueResponses('tournament_holds', [{ data: [], error: null }]);
      mockSupabase.__queueResponses('tournament_registrations', [{ data: null, error: null }]);

      const req = createMockReq({
        body: { action: 'bulk-import', categoryId: 'c1', rows: [{ player1Name: 'Alice', player1Phone: '9999999999' }, { player1Name: 'X', player1Phone: 'bad' }] },
        headers: { authorization: 'Bearer valid-token' }
      });
      const res = createMockRes();
      await handler(req, res);

      expect(res._status).toBe(200);
      expect(res._json.created).toBe(1);
      expect(res._json.errors).toHaveLength(1);
      expect(res._json.errors[0].row).toBe(2);
    });
  });
});
