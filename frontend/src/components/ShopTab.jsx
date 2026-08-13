import { useEffect, useRef, useState } from 'react'
import { api, RAZORPAY_KEY_ID, PAYMENTS_ENABLED } from '../api.js'
import { loadRazorpay } from '../lib/loadRazorpay.js'

function ProductImageCarousel({ images, name }) {
  const [index, setIndex] = useState(0)
  const scrollRef = useRef(null)

  function handleScroll() {
    const el = scrollRef.current
    if (!el || el.clientWidth === 0) return
    setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square rounded-2xl bg-surface-alt overflow-hidden grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
      </div>
    )
  }

  if (images.length === 1) {
    return (
      <div className="aspect-square rounded-2xl bg-surface-alt overflow-hidden">
        <img src={images[0]} alt={name} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="aspect-square rounded-2xl bg-surface-alt overflow-x-auto flex snap-x snap-mandatory scrollbar-hide"
      >
        {images.map((src, i) => (
          <img key={i} src={src} alt={`${name} ${i + 1}`} className="w-full h-full object-cover shrink-0 snap-center" />
        ))}
      </div>
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/30 px-1.5 py-1">
        {images.map((_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full transition ${i === index ? 'bg-white' : 'bg-white/40'}`} />
        ))}
      </div>
    </div>
  )
}

export default function ShopTab() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selections, setSelections] = useState({})
  const [orderItems, setOrderItems] = useState([])
  const [customer, setCustomer] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('doc_shop_customer') || '{}')
      return { name: saved.name || '', phone: saved.phone || '', email: saved.email || '', address: saved.address || '', city: saved.city || '', pincode: saved.pincode || '' }
    } catch { return { name: '', phone: '', email: '', address: '', city: '', pincode: '' } }
  })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    api.listProducts()
      .then(({ products }) => setProducts(products))
      .catch(e => setLoadError(e.message || 'Could not load products'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (PAYMENTS_ENABLED) loadRazorpay() }, [])

  function selectionFor(product) {
    return selections[product.id] || { size: product.sizes?.[0] || null, quantity: 1 }
  }

  function updateSelection(productId, patch) {
    setSelections(s => ({ ...s, [productId]: { ...selectionFor({ id: productId }), ...s[productId], ...patch } }))
  }

  function addToOrder(product) {
    const sel = selectionFor(product)
    if (product.sizes?.length > 0 && !sel.size) { setError('Select a size first'); return }
    setError(null)
    setOrderItems(items => {
      const idx = items.findIndex(i => i.productId === product.id && i.size === sel.size)
      if (idx >= 0) {
        const next = [...items]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + sel.quantity }
        return next
      }
      return [...items, { productId: product.id, name: product.name, price: product.price, size: sel.size, quantity: sel.quantity }]
    })
    updateSelection(product.id, { quantity: 1 })
  }

  function removeItem(idx) {
    setOrderItems(items => items.filter((_, i) => i !== idx))
  }

  function updateItemQty(idx, delta) {
    setOrderItems(items => items.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
  }

  function updateCustomer(k, v) {
    setCustomer(c => ({ ...c, [k]: v }))
  }

  const total = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  function validate() {
    if (orderItems.length === 0) return 'Add at least one item to your order'
    if (!customer.name.trim() || customer.name.trim().length < 2) return 'Enter your name'
    if (!/^[0-9]{10}$/.test(customer.phone.trim())) return 'Enter a valid 10-digit phone number'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return 'Enter a valid email address'
    if (!customer.address.trim() || customer.address.trim().length < 5) return 'Enter your shipping address'
    if (!customer.city.trim()) return 'Enter your city'
    if (!/^[0-9]{6}$/.test(customer.pincode.trim())) return 'Enter a valid 6-digit pincode'
    return null
  }

  function persistCustomer(c) {
    localStorage.setItem('doc_shop_customer', JSON.stringify(c))
  }

  async function handleCheckout() {
    const v = validate()
    if (v) { setError(v); return }
    setError(null); setSubmitting(true)

    const items = orderItems.map(i => ({ productId: i.productId, size: i.size, quantity: i.quantity }))
    const trimmedCustomer = {
      name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email.trim(),
      address: customer.address.trim(), city: customer.city.trim(), pincode: customer.pincode.trim()
    }

    try {
      if (!PAYMENTS_ENABLED) {
        const res = await api.shopPlaceOrder(items, trimmedCustomer)
        persistCustomer(trimmedCustomer)
        setSuccess({ orderId: res.orderId, amount: res.amount, items: orderItems, customer: trimmedCustomer, upiAccounts: res.upiAccounts || [], pending: true })
        setOrderItems([])
        setSubmitting(false)
        return
      }

      const order = await api.shopCreateOrder(items, trimmedCustomer)
      await openCheckout(order, trimmedCustomer)
    } catch (e) {
      setError(e.message || 'Could not start checkout')
      setSubmitting(false)
    }
  }

  async function openCheckout(order, trimmedCustomer) {
    try { await loadRazorpay() } catch {
      setError('Razorpay failed to load. Check your network.')
      setSubmitting(false)
      return
    }
    return new Promise((resolve) => {
      const rzp = new window.Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.orderId,
        name: 'Dink Over Coffee Shop',
        description: 'Merchandise order',
        prefill: { name: trimmedCustomer.name, contact: trimmedCustomer.phone, email: trimmedCustomer.email },
        theme: { color: '#05AD86' },
        modal: {
          ondismiss: () => { setSubmitting(false); resolve() }
        },
        handler: async (resp) => {
          try {
            const res = await api.shopConfirmPayment({
              holdId: order.holdId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature
            })
            persistCustomer(trimmedCustomer)
            setSuccess({ orderId: res.orderId, amount: order.amount / 100, items: orderItems, customer: trimmedCustomer, pending: false })
            setOrderItems([])
          } catch (e) {
            setError(e.message || 'Payment confirmation failed')
          } finally {
            setSubmitting(false)
            resolve()
          }
        }
      })
      rzp.on('payment.failed', () => {
        setError('Payment failed. Please try again.')
        setSubmitting(false)
        resolve()
      })
      rzp.open()
    })
  }

  if (success) {
    return (
      <div className="card text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-secondary/10 grid place-items-center text-secondary-dark text-2xl">✓</div>
        <h2 className="mt-3 text-text text-xl font-extrabold">{success.pending ? 'Order received!' : 'Order confirmed!'}</h2>
        <p className="mt-1 text-primary text-sm">Order #{String(success.orderId).slice(0, 8)} · ₹{success.amount}</p>
        <div className="mt-4 text-left space-y-1.5">
          {success.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-secondary">{item.name}{item.size ? ` (${item.size})` : ''} × {item.quantity}</span>
              <span className="text-primary font-medium">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-secondary">Shipping to {success.customer.address}, {success.customer.city} - {success.customer.pincode}</p>

        {success.pending && success.upiAccounts?.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border text-left">
            <p className="text-xs font-semibold text-primary mb-3 text-center">Pay ₹{success.amount} to complete your order</p>
            {success.upiAccounts.map(acc => (
              <div key={acc.id} className="rounded-xl border border-border-muted px-4 py-3 mb-2">
                <p className="text-sm font-semibold text-primary">{acc.label}</p>
                <p className="text-xs text-secondary mt-0.5">{acc.upi_id}</p>
              </div>
            ))}
            <p className="text-[11px] text-secondary mt-2 text-center">We'll confirm and ship once payment is received.</p>
          </div>
        )}

        <button className="text-sm text-secondary underline mt-5" onClick={() => setSuccess(null)}>Continue shopping</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-text font-bold md:text-lg">Merchandise</h2>
        {loading && <div className="mt-3 card text-center text-secondary text-sm">Loading products…</div>}
        {loadError && <div className="mt-3 card text-center text-error text-sm">{loadError}</div>}
        {!loading && !loadError && products.length === 0 && (
          <div className="mt-3 card text-center text-secondary text-sm">No products available right now. Check back soon.</div>
        )}
        {!loading && products.length > 0 && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
            {products.map(product => {
              const sel = selectionFor(product)
              const outOfStock = product.stock !== null && product.stock <= 0
              return (
                <div key={product.id} className="card p-3 last:odd:col-span-full md:last:odd:col-span-1">
                  <ProductImageCarousel images={product.images} name={product.name} />
                  <p className="text-text text-sm font-semibold mt-2 truncate">{product.name}</p>
                  {product.description && <p className="text-muted text-xs mt-0.5 line-clamp-2">{product.description}</p>}
                  {product.mrp ? (
                    <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
                      <span className="text-primary text-sm font-bold">₹{product.price}</span>
                      <span className="text-muted text-xs line-through">₹{product.mrp}</span>
                      <span className="text-[10px] font-bold text-green-700 dark:text-secondary bg-green-100 dark:bg-secondary/10 px-1.5 py-0.5 rounded">
                        {product.discountPercent}% off
                      </span>
                    </div>
                  ) : (
                    <p className="text-primary text-sm font-bold mt-1">₹{product.price}</p>
                  )}

                  {product.sizes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {product.sizes.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => updateSelection(product.id, { size })}
                          className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${sel.size === size ? 'border-interactive bg-interactive/10 text-interactive' : 'border-border-muted text-secondary'}`}
                        >{size}</button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateSelection(product.id, { quantity: Math.max(1, sel.quantity - 1) })} className="w-6 h-6 rounded-full border border-border-muted text-secondary grid place-items-center text-xs">−</button>
                      <span className="text-xs font-semibold text-primary w-4 text-center">{sel.quantity}</span>
                      <button type="button" onClick={() => updateSelection(product.id, { quantity: sel.quantity + 1 })} className="w-6 h-6 rounded-full border border-border-muted text-secondary grid place-items-center text-xs">+</button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => addToOrder(product)}
                    disabled={outOfStock}
                    className="w-full mt-2.5 rounded-xl bg-interactive text-inverse text-xs font-semibold py-2 disabled:opacity-50 active:scale-[.98] transition"
                  >
                    {outOfStock ? 'Out of stock' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {orderItems.length > 0 && (
        <section className="card">
          <h2 className="text-text font-bold">Your order</h2>
          <div className="mt-3 space-y-2.5">
            {orderItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-primary font-medium truncate">{item.name}{item.size ? ` (${item.size})` : ''}</p>
                  <p className="text-xs text-secondary">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => updateItemQty(i, -1)} className="w-6 h-6 rounded-full border border-border-muted text-secondary grid place-items-center text-xs">−</button>
                  <span className="text-xs font-semibold text-primary w-4 text-center">{item.quantity}</span>
                  <button type="button" onClick={() => updateItemQty(i, 1)} className="w-6 h-6 rounded-full border border-border-muted text-secondary grid place-items-center text-xs">+</button>
                  <button type="button" onClick={() => removeItem(i)} className="text-error text-xs font-medium ml-1">Remove</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <span className="text-sm font-bold text-text">Total</span>
            <span className="text-sm font-bold text-text">₹{total}</span>
          </div>
        </section>
      )}

      {orderItems.length > 0 && (
        <section className="card">
          <h2 className="text-text font-bold">Shipping details</h2>
          <div className="mt-3 space-y-3">
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              <div>
                <label className="text-xs font-semibold text-primary">Name <span className="text-error">*</span></label>
                <input className="input mt-1" autoComplete="name" value={customer.name} onChange={e => updateCustomer('name', e.target.value)} placeholder="Akhil K" />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary">Phone <span className="text-error">*</span></label>
                <input className="input mt-1" autoComplete="tel" inputMode="numeric" value={customer.phone} onChange={e => updateCustomer('phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="98xxxxxxxx" maxLength={10} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-primary">Email <span className="text-error">*</span></label>
              <input className="input mt-1" autoComplete="email" type="email" value={customer.email} onChange={e => updateCustomer('email', e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold text-primary">Address <span className="text-error">*</span></label>
              <input className="input mt-1" autoComplete="street-address" value={customer.address} onChange={e => updateCustomer('address', e.target.value)} placeholder="House no., street, area" />
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
              <div>
                <label className="text-xs font-semibold text-primary">City <span className="text-error">*</span></label>
                <input className="input mt-1" autoComplete="address-level2" value={customer.city} onChange={e => updateCustomer('city', e.target.value)} placeholder="Bengaluru" />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary">Pincode <span className="text-error">*</span></label>
                <input className="input mt-1" inputMode="numeric" value={customer.pincode} onChange={e => updateCustomer('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="560041" maxLength={6} />
              </div>
            </div>
          </div>

          {error && <div className="mt-3 text-sm text-error">{error}</div>}

          <button className="w-full mt-4 btn-primary" onClick={handleCheckout} disabled={submitting}>
            {submitting ? 'Processing…' : (PAYMENTS_ENABLED ? `Pay ₹${total} & checkout` : `Place order · ₹${total}`)}
          </button>
          {!PAYMENTS_ENABLED && <p className="text-[11px] text-secondary mt-2 text-center">We'll share UPI payment details after you place the order.</p>}
        </section>
      )}

      {orderItems.length === 0 && error && <div className="text-sm text-error">{error}</div>}
    </div>
  )
}
