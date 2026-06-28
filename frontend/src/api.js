const API_BASE = '/api'

async function call(endpoint, payload = {}) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`API ${endpoint} failed: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || `API ${endpoint} returned not ok`)
  return data
}

export const api = {
  listSessions: () => call('sessions'),
  listPlayers: (sessionId) => call('players', { sessionId }),
  registerFree: (sessionId, player) => call('register', { sessionId, player }),
  joinWaitlist: (sessionId, player) => call('waitlist', { sessionId, player }),
  createOrder: (sessionId, player) => call('create-order', { sessionId, player }),
  confirmPayment: (payload) => call('confirm-payment', payload)
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID
export const PAYMENTS_ENABLED = !!RAZORPAY_KEY_ID
