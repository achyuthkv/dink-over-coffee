import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_FLOW = ['placed', 'confirmed', 'packed', 'shipped', 'delivered']

const STATUS_LABEL = {
  placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled'
}

// What the primary action button does at each stage. 'shipped' opens the
// shipping-details modal instead of transitioning immediately.
const NEXT_ACTION = {
  placed: { next: 'confirmed', label: 'Confirm order' },
  confirmed: { next: 'packed', label: 'Mark as packed' },
  packed: { next: 'shipped', label: 'Ship order' },
  shipped: { next: 'delivered', label: 'Mark as delivered' }
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'payment_pending', label: 'Payment pending' },
  { key: 'placed', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' }
]

function PaymentBadge({ status }) {
  const styles = {
    paid: 'text-green-800 bg-green-100 dark:text-secondary dark:bg-secondary/10',
    pending: 'text-amber-800 bg-amber-100 dark:text-warning dark:bg-warning/10',
    refunded: 'text-muted bg-bg'
  }
  const label = { paid: 'Paid', pending: 'Payment pending', refunded: 'Refunded' }
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${styles[status] || styles.pending}`}>
      {label[status] || status}
    </span>
  )
}

function StatusStepper({ status }) {
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-error">
        <span className="w-1.5 h-1.5 rounded-full bg-error" /> Cancelled
      </span>
    )
  }
  const idx = STATUS_FLOW.indexOf(status)
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center">
        {STATUS_FLOW.map((s, i) => (
          <div key={s} className="flex items-center">
            <span className={`w-1.5 h-1.5 rounded-full ${i <= idx ? 'bg-interactive' : 'bg-border'}`} />
            {i < STATUS_FLOW.length - 1 && <span className={`w-3 h-px ${i < idx ? 'bg-interactive' : 'bg-border'}`} />}
          </div>
        ))}
      </div>
      <span className="text-xs font-semibold text-primary">{STATUS_LABEL[status]}</span>
    </div>
  )
}

export default function ShopOrders({ onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [shipModal, setShipModal] = useState(null)
  const [shipForm, setShipForm] = useState({ carrier: '', trackingNumber: '', trackingUrl: '' })
  const [cancelModal, setCancelModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('shop_orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  useEffect(() => { loadOrders() }, [])

  function patchOrder(id, patch) {
    setOrders(os => os.map(o => o.id === id ? { ...o, ...patch } : o))
  }

  async function markPaid(order) {
    const patch = { payment_status: 'paid' }
    patchOrder(order.id, patch)
    await supabase.from('shop_orders').update(patch).eq('id', order.id)
  }

  async function advanceStatus(order) {
    const action = NEXT_ACTION[order.order_status]
    if (!action) return
    if (action.next === 'shipped') {
      setShipForm({ carrier: '', trackingNumber: '', trackingUrl: '' })
      setShipModal(order)
      return
    }
    const patch = { order_status: action.next, [`${action.next}_at`]: new Date().toISOString() }
    patchOrder(order.id, patch)
    await supabase.from('shop_orders').update(patch).eq('id', order.id)
  }

  async function confirmShip() {
    if (!shipModal) return
    const patch = {
      order_status: 'shipped',
      shipped_at: new Date().toISOString(),
      shipping_carrier: shipForm.carrier.trim() || null,
      tracking_number: shipForm.trackingNumber.trim() || null,
      tracking_url: shipForm.trackingUrl.trim() || null
    }
    patchOrder(shipModal.id, patch)
    await supabase.from('shop_orders').update(patch).eq('id', shipModal.id)
    setShipModal(null)
  }

  async function confirmCancel() {
    if (!cancelModal) return
    const patch = { order_status: 'cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: cancelReason.trim() || null }
    patchOrder(cancelModal.id, patch)
    await supabase.from('shop_orders').update(patch).eq('id', cancelModal.id)
    setCancelModal(null)
    setCancelReason('')
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const paymentPending = orders.filter(o => o.payment_status === 'pending').length
  const toShip = orders.filter(o => o.payment_status === 'paid' && (o.order_status === 'confirmed' || o.order_status === 'packed')).length

  const filtered = orders.filter(o => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matches = o.customer_name?.toLowerCase().includes(q) || o.phone?.includes(q) || o.id?.toLowerCase().includes(q)
      if (!matches) return false
    }
    if (filter === 'payment_pending') return o.payment_status === 'pending'
    if (filter !== 'all') return o.order_status === filter
    return true
  })

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Shop Orders</h1>
          <span className="text-muted text-xs ml-auto">{orders.length} total</span>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-5">
          <div className="flex-1 bg-surface rounded-xl border border-border px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-primary">{orders.length}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Orders</div>
          </div>
          <div className="flex-1 bg-surface rounded-xl border border-border px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-amber-700 dark:text-warning">{paymentPending}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Payment pending</div>
          </div>
          <div className="flex-1 bg-surface rounded-xl border border-border px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-tertiary">{toShip}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">To ship</div>
          </div>
        </div>

        <input
          className="input w-full mb-3"
          placeholder="Search by name, phone, or order ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1 scrollbar-hide">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition ${filter === f.key ? 'bg-interactive text-inverse border-interactive' : 'text-secondary border-border'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-muted text-sm text-center py-8">Loading…</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-muted text-sm text-center py-8">No orders found.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-border bg-surface divide-y divide-bg">
            {filtered.map(order => {
              const isExpanded = expandedId === order.id
              const action = order.order_status !== 'cancelled' ? NEXT_ACTION[order.order_status] : null
              const canCancel = order.order_status !== 'cancelled' && order.order_status !== 'delivered'
              const cancelled = order.order_status === 'cancelled'
              return (
                <div key={order.id} className={cancelled ? 'opacity-60' : ''}>
                  <button
                    type="button"
                    onClick={() => toggleExpand(order.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-primary font-medium truncate">{order.customer_name}</p>
                        <PaymentBadge status={order.payment_status} />
                      </div>
                      <p className="text-xs text-muted mt-0.5">{order.phone} &middot; ₹{order.amount} &middot; {fmtDate(order.created_at)}</p>
                      <div className="mt-1.5">
                        <StatusStepper status={order.order_status} />
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className={`shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 bg-bg/40">
                      <div className="pt-3 space-y-1.5">
                        {(order.items || []).map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-secondary">{item.name}{item.size ? ` (${item.size})` : ''} &times; {item.quantity}</span>
                            <span className="text-primary font-medium">₹{item.price * item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="text-xs text-secondary border-t border-border pt-2.5">
                        <p><span className="text-muted">Ship to:</span> {order.address}, {order.city} - {order.pincode}</p>
                        {order.email && <p className="mt-1"><span className="text-muted">Email:</span> {order.email}</p>}
                        {order.razorpay_payment_id && <p className="mt-1"><span className="text-muted">Payment ID:</span> {order.razorpay_payment_id}</p>}
                        <p className="mt-1"><span className="text-muted">Order ID:</span> {order.id}</p>
                      </div>

                      {(order.shipping_carrier || order.tracking_number) && (
                        <div className="text-xs text-secondary border-t border-border pt-2.5">
                          <p><span className="text-muted">Carrier:</span> {order.shipping_carrier || '—'}</p>
                          {order.tracking_number && (
                            <p className="mt-1">
                              <span className="text-muted">Tracking:</span>{' '}
                              {order.tracking_url ? <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-interactive underline">{order.tracking_number}</a> : order.tracking_number}
                            </p>
                          )}
                        </div>
                      )}

                      {cancelled && (
                        <div className="text-xs text-error border-t border-border pt-2.5">
                          <p>Cancelled {order.cancelled_at ? fmtDateTime(order.cancelled_at) : ''}</p>
                          {order.cancellation_reason && <p className="mt-1 text-secondary">Reason: {order.cancellation_reason}</p>}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        {order.payment_status === 'pending' && (
                          <button onClick={() => markPaid(order)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-interactive text-inverse active:scale-[.98] transition">
                            Mark as paid
                          </button>
                        )}
                        {order.payment_status !== 'pending' && action && (
                          <button onClick={() => advanceStatus(order)} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-interactive text-inverse active:scale-[.98] transition">
                            {action.label}
                          </button>
                        )}
                        {order.payment_status === 'pending' && (
                          <span className="text-[11px] text-muted">Mark paid to start processing</span>
                        )}
                        {canCancel && (
                          <button onClick={() => { setCancelModal(order); setCancelReason('') }} className="text-xs font-medium text-tertiary px-3 py-1.5 rounded-full border border-tertiary/20 active:bg-error-subtle transition">
                            Cancel order
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ship modal */}
      {shipModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShipModal(null)}>
          <div className="bg-surface rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-primary">Ship order</p>
            <p className="text-xs text-muted">{shipModal.customer_name} &middot; {shipModal.address}, {shipModal.city}</p>
            <div>
              <label className="text-xs font-semibold text-primary">Carrier</label>
              <input className="input mt-1" value={shipForm.carrier} onChange={e => setShipForm(f => ({ ...f, carrier: e.target.value }))} placeholder="e.g. Delhivery, India Post" />
            </div>
            <div>
              <label className="text-xs font-semibold text-primary">Tracking number</label>
              <input className="input mt-1" value={shipForm.trackingNumber} onChange={e => setShipForm(f => ({ ...f, trackingNumber: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs font-semibold text-primary">Tracking link</label>
              <input className="input mt-1" value={shipForm.trackingUrl} onChange={e => setShipForm(f => ({ ...f, trackingUrl: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShipModal(null)} className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium text-muted active:bg-bg transition">Cancel</button>
              <button onClick={confirmShip} className="flex-1 py-2.5 rounded-full bg-interactive text-inverse text-sm font-medium active:scale-[.98] transition">Mark shipped</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setCancelModal(null)}>
          <div className="bg-surface rounded-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-primary">Cancel {cancelModal.customer_name}'s order?</p>
            <textarea
              className="w-full bg-bg border-0 rounded-xl p-3 text-sm text-primary resize-none focus:ring-1 focus:ring-primary/20 focus:outline-none"
              rows={3}
              placeholder="Reason (optional)"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
            <div className="flex gap-3 pt-1">
              <button onClick={() => setCancelModal(null)} className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium text-muted active:bg-bg transition">Back</button>
              <button onClick={confirmCancel} className="flex-1 py-2.5 rounded-full bg-tertiary text-white text-sm font-medium active:scale-[.98] transition">Cancel order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
