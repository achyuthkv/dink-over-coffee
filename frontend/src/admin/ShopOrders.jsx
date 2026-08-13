import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Toggle({ on, onClick, activeClass = 'bg-green-600 dark:bg-secondary' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${on ? activeClass : 'bg-border'}`}
    >
      <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[18px]' : ''}`} />
    </button>
  )
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_payment', label: 'Awaiting payment' },
  { key: 'awaiting_fulfillment', label: 'Awaiting fulfillment' },
  { key: 'fulfilled', label: 'Fulfilled' }
]

export default function ShopOrders({ onBack }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

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

  async function togglePaid(order) {
    const newStatus = order.status === 'confirmed' ? 'pending' : 'confirmed'
    setOrders(os => os.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    await supabase.from('shop_orders').update({ status: newStatus }).eq('id', order.id)
  }

  async function toggleFulfilled(order) {
    const newVal = !order.fulfilled
    const fulfilled_at = newVal ? new Date().toISOString() : null
    setOrders(os => os.map(o => o.id === order.id ? { ...o, fulfilled: newVal, fulfilled_at } : o))
    await supabase.from('shop_orders').update({ fulfilled: newVal, fulfilled_at }).eq('id', order.id)
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const awaitingPayment = orders.filter(o => o.status !== 'confirmed').length
  const awaitingFulfillment = orders.filter(o => o.status === 'confirmed' && !o.fulfilled).length

  const filtered = orders.filter(o => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matches = o.customer_name?.toLowerCase().includes(q) || o.phone?.includes(q) || o.id?.toLowerCase().includes(q)
      if (!matches) return false
    }
    if (filter === 'awaiting_payment') return o.status !== 'confirmed'
    if (filter === 'awaiting_fulfillment') return o.status === 'confirmed' && !o.fulfilled
    if (filter === 'fulfilled') return o.fulfilled
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
            <div className="text-lg font-bold text-amber-700 dark:text-warning">{awaitingPayment}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">Awaiting payment</div>
          </div>
          <div className="flex-1 bg-surface rounded-xl border border-border px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-tertiary">{awaitingFulfillment}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide mt-0.5">To ship</div>
          </div>
        </div>

        <input
          className="input w-full mb-3"
          placeholder="Search by name, phone, or order ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
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
              const isPaid = order.status === 'confirmed'
              return (
                <div key={order.id}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleExpand(order.id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-primary font-medium truncate">{order.customer_name}</p>
                        {order.fulfilled && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-green-800 bg-green-100 dark:text-secondary dark:bg-secondary/10 px-1.5 py-0.5 rounded">Fulfilled</span>}
                      </div>
                      <p className="text-xs text-muted mt-0.5">{order.phone} &middot; ₹{order.amount} &middot; {fmtDate(order.created_at)}</p>
                    </button>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Toggle on={isPaid} onClick={() => togglePaid(order)} />
                      <span className="text-[9px] text-muted uppercase tracking-wide">{isPaid ? 'Paid' : 'Unpaid'}</span>
                    </div>
                  </div>

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

                      <div className="flex items-center justify-between border-t border-border pt-2.5">
                        <span className="text-xs font-medium text-primary">Mark as fulfilled</span>
                        <Toggle on={order.fulfilled} onClick={() => toggleFulfilled(order)} activeClass="bg-interactive" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
