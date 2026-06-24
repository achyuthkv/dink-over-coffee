const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL

if (!API_URL) {
  console.warn('VITE_APPS_SCRIPT_URL is not set — API calls will fail.')
}

async function call(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload })
  })
  if (!res.ok) throw new Error(`API ${action} failed: ${res.status}`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || `API ${action} returned not ok`)
  return data
}

export const api = {
  listSessions: () => call('listSessions'),
  listPlayers: (sessionId) => call('listPlayers', { sessionId }),
  registerFree: (sessionId, player) => call('registerFree', { sessionId, player }),
  createOrder: (sessionId, player) => call('createOrder', { sessionId, player }),
  confirmPayment: (payload) => call('confirmPayment', payload)
}

export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID
export const PAYMENTS_ENABLED = !!RAZORPAY_KEY_ID
