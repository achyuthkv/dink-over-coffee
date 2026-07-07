import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReq, createMockRes } from './helpers/mockReq.js';
import { createMockSupabase } from './helpers/mockSupabase.js';

const mockSupabase = createMockSupabase();

vi.mock('../api/_lib/supabase.js', () => ({ default: mockSupabase }));

const { default: handler } = await import('../api/sessions.js');

describe('sessions handler', () => {
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

  it('returns active future sessions with player counts', async () => {
    const futureSession = {
      id: 'sess-1',
      date: '2099-12-31',
      time: '9:00 - 11:00',
      venue: 'Court A',
      price: 300,
      max_slots: 10,
      waitlist_max: 3,
      beginner_slots: 4,
      beginner_waitlist_max: 2,
      title: 'Morning Session',
      description: 'Fun game',
      event_type: 'regular',
      active: true,
    };

    mockSupabase.__queueResponses('sessions', [
      { data: [futureSession], error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: [
        { session_id: 'sess-1', skill: 'Beginner', status: 'confirmed' },
        { session_id: 'sess-1', skill: 'Intermediate', status: 'confirmed' },
        { session_id: 'sess-1', skill: 'Beginner', status: 'waitlisted' },
      ], error: null },
    ]);
    mockSupabase.__queueResponses('holds', [
      { data: [{ session_id: 'sess-1', id: 'hold-1' }], error: null },
    ]);
    mockSupabase.__queueResponses('session_upis', [
      { data: [], error: null },
    ]);

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.sessions).toHaveLength(1);

    const s = res._json.sessions[0];
    expect(s.id).toBe('sess-1');
    expect(s.maxSlots).toBe(10);
    expect(s.beginnerTaken).toBe(1);
    expect(s.otherTaken).toBe(1);
    expect(s.takenSlots).toBe(3); // 2 confirmed + 1 hold
    expect(s.waitlistCount).toBe(1);
    expect(s.beginnerWaitlistCount).toBe(1);
  });

  it('handles empty session list', async () => {
    mockSupabase.__queueResponses('sessions', [
      { data: [], error: null },
    ]);

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.sessions).toEqual([]);
  });

  it('returns empty sessions when database returns null data', async () => {
    // When data is null, (allSessions || []) becomes [], sessionIds is empty => returns early
    mockSupabase.__queueResponses('sessions', [
      { data: null, error: null },
    ]);

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.ok).toBe(true);
    expect(res._json.sessions).toEqual([]);
  });

  it('includes UPI accounts in response', async () => {
    const futureSession = {
      id: 'sess-2',
      date: '2099-12-31',
      time: '9:00 - 11:00',
      venue: 'Court B',
      price: 500,
      max_slots: 8,
      waitlist_max: 2,
      beginner_slots: null,
      beginner_waitlist_max: 0,
      title: 'Evening Session',
      description: null,
      event_type: 'doubles',
      active: true,
    };

    mockSupabase.__queueResponses('sessions', [
      { data: [futureSession], error: null },
    ]);
    mockSupabase.__queueResponses('players', [
      { data: [], error: null },
    ]);
    mockSupabase.__queueResponses('holds', [
      { data: [], error: null },
    ]);
    mockSupabase.__queueResponses('session_upis', [
      { data: [
        { session_id: 'sess-2', sort_order: 1, upi_accounts: { id: 'upi-1', label: 'Main', upi_id: 'test@upi', qr_image_url: null } },
      ], error: null },
    ]);

    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    const s = res._json.sessions[0];
    expect(s.upiAccounts).toHaveLength(1);
    expect(s.upiAccounts[0].upi_id).toBe('test@upi');
    expect(s.event_type).toBe('doubles');
  });
});
