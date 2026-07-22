const API_BASE = '/api'

async function call(endpoint, payload = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  getRecap: (sessionId) => call('recap', { sessionId })
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID
export const PAYMENTS_ENABLED = !!RAZORPAY_KEY_ID
