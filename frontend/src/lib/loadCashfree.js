let cashfreePromise = null
let cashfreeInstance = null
let instanceMode = null

export function loadCashfree() {
  if (window.Cashfree) return Promise.resolve()
  if (cashfreePromise) return cashfreePromise
  cashfreePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('Failed to load Cashfree'))
    document.head.appendChild(script)
  })
  return cashfreePromise
}

// Cashfree's own guidance: initialize `Cashfree({ mode })` once and reuse it
// across checkouts, not per click -- memoized here so every caller (session,
// shop, tournament checkout) shares one instance instead of re-instantiating.
export async function getCashfree(mode) {
  await loadCashfree()
  if (!cashfreeInstance || instanceMode !== mode) {
    cashfreeInstance = window.Cashfree({ mode })
    instanceMode = mode
  }
  return cashfreeInstance
}
