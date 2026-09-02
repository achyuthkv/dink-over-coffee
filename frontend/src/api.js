const API_BASE = '/api'

async function call(endpoint, payload = {}, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data && data.error) || `API ${endpoint} failed: ${res.status}`)
  if (!data || !data.ok) throw new Error((data && data.error) || `API ${endpoint} returned not ok`)
  return data
}

export const api = {
  listSessions: () => call('sessions'),
  listPlayers: (sessionId) => call('players', { sessionId }),
  registerFree: (sessionId, player) => call('register', { sessionId, player }),
  joinWaitlist: (sessionId, player) => call('waitlist', { sessionId, player }),
  createOrder: (sessionId, player) => call('create-order', { sessionId, player }),
  confirmPayment: (payload) => call('confirm-payment', payload),
  sessionHistory: () => call('session-history'),
  checkWaiver: (phone) => call('waiver', { action: 'check', phone }),
  signWaiver: (phone, name, signature) => call('waiver', { action: 'sign', phone, name, signature }),
  listProducts: () => call('shop', { action: 'products' }),
  shopCreateOrder: (items, customer) => call('shop', { action: 'create-order', items, customer }),
  shopConfirmPayment: (payload) => call('shop', { action: 'confirm-payment', ...payload }),
  shopPlaceOrder: (items, customer) => call('shop', { action: 'order', items, customer }),
  tournamentSyncTeams: (tournamentId, token) => call('tournament', { action: 'sync-teams', tournamentId }, token),
  membershipCreateOrder: (member, token) => call('membership', { action: 'signup-create-order', ...member }, token),
  membershipConfirmPayment: (payload, token) => call('membership', { action: 'signup-confirm-payment', ...payload }, token),
  membershipSignupFree: (member, token) => call('membership', { action: 'signup-free', ...member }, token),
  membershipRedeemCredit: (sessionId, token) => call('membership', { action: 'redeem-credit', sessionId }, token),
  membershipDirectory: (token) => call('membership', { action: 'directory' }, token),
  membershipBroadcast: (message, token) => call('membership', { action: 'broadcast', message }, token)
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID
export const PAYMENTS_ENABLED = !!RAZORPAY_KEY_ID
