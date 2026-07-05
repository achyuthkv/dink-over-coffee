const store = new Map()

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 20

export function rateLimit(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const record = store.get(ip)

  if (!record || now - record.start > WINDOW_MS) {
    store.set(ip, { start: now, count: 1 })
    return { ok: true }
  }

  record.count++
  if (record.count > MAX_REQUESTS) {
    return { ok: false }
  }
  return { ok: true }
}
