import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

export default function SessionForm({ session, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: session?.title || '',
    date: session?.date || '',
    time: session?.time || '',
    venue: session?.venue || '',
    price: session?.price || 350,
    max_slots: session?.max_slots || 10,
    waitlist_max: session?.waitlist_max || 0,
    beginner_slots: session?.beginner_slots ?? '',
    beginner_waitlist_max: session?.beginner_waitlist_max || 0,
    description: session?.description || '',
    active: session?.active ?? true,
    event_type: session?.event_type || 'regular'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [upiAccounts, setUpiAccounts] = useState([])
  const [selectedUpis, setSelectedUpis] = useState([])

  useEffect(() => {
    loadUpiAccounts()
  }, [])

  async function loadUpiAccounts() {
    const { data } = await supabase.from('upi_accounts').select('*').eq('active', true).order('created_at')
    setUpiAccounts(data || [])

    if (session?.id) {
      const { data: linked } = await supabase.from('session_upis').select('upi_account_id, sort_order').eq('session_id', session.id).order('sort_order')
      setSelectedUpis((linked || []).map(l => l.upi_account_id))
    }
  }

  function toggleUpi(id) {
    setSelectedUpis(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true); setError(null)

    const payload = {
      ...form,
      price: Number(form.price),
      max_slots: Number(form.max_slots),
      waitlist_max: Number(form.waitlist_max),
      beginner_slots: form.beginner_slots === '' ? null : Number(form.beginner_slots),
      beginner_waitlist_max: Number(form.beginner_waitlist_max)
    }

    let err, sessionId = session?.id
    if (session?.id) {
      ({ error: err } = await supabase.from('sessions').update(payload).eq('id', session.id))
    } else {
      const { data, error: insertErr } = await supabase.from('sessions').insert(payload).select('id').single()
      err = insertErr
      if (data) sessionId = data.id
    }

    if (err) { setError(err.message); setSaving(false); return }

    await supabase.from('session_upis').delete().eq('session_id', sessionId)
    if (selectedUpis.length > 0) {
      const rows = selectedUpis.map((upi_account_id, i) => ({ session_id: sessionId, upi_account_id, sort_order: i }))
      await supabase.from('session_upis').insert(rows)
    }

    onSave()
  }

  return (
    <div className="min-h-screen bg-[#F6F1E7] bg-[url('/bg-pattern.svg')] bg-[length:360px_360px] bg-repeat">
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-coffee-900 font-bold text-lg">{session?.id ? 'Edit' : 'New session'}</h1>
          <button onClick={onCancel} title="Cancel" className="w-10 h-10 flex items-center justify-center rounded-full border border-coffee-200 text-coffee-600 active:bg-coffee-100 transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="text-xs font-semibold text-coffee-700">Title</label>
            <input className="input mt-1" value={form.title} onChange={e => update('title', e.target.value)} placeholder="Session title" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-coffee-700">Date</label>
              <input type="date" className="input mt-1" value={form.date} onChange={e => update('date', e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-coffee-700">Time</label>
              <input className="input mt-1" value={form.time} onChange={e => update('time', e.target.value)} placeholder="9 AM - 11 AM" required />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-coffee-700">Venue</label>
            <input className="input mt-1" value={form.venue} onChange={e => update('venue', e.target.value)} placeholder="Venue" required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-coffee-700">Price</label>
              <input type="number" className="input mt-1" value={form.price} onChange={e => update('price', e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-semibold text-coffee-700">Slots</label>
              <input type="number" className="input mt-1" value={form.max_slots} onChange={e => update('max_slots', e.target.value)} min="1" required />
            </div>
            <div>
              <label className="text-xs font-semibold text-coffee-700">Waitlist</label>
              <input type="number" className="input mt-1" value={form.waitlist_max} onChange={e => update('waitlist_max', e.target.value)} min="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-coffee-700">Beginner slots</label>
              <input type="number" className="input mt-1" value={form.beginner_slots} onChange={e => update('beginner_slots', e.target.value)} min="0" placeholder="blank = all" />
            </div>
            <div>
              <label className="text-xs font-semibold text-coffee-700">Beginner waitlist</label>
              <input type="number" className="input mt-1" value={form.beginner_waitlist_max} onChange={e => update('beginner_waitlist_max', e.target.value)} min="0" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-coffee-700">Event type</label>
            <div className="flex gap-2 mt-1.5">
              {['regular', 'dupr'].map(t => {
                const active = form.event_type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update('event_type', t)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${active ? 'border-coffee-800 bg-coffee-800 text-white' : 'border-coffee-200 text-coffee-800'}`}
                  >{t === 'dupr' ? 'DUPR' : 'Regular'}</button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-coffee-700">Payment methods</label>
            {upiAccounts.length === 0 ? (
              <p className="text-xs text-[#8C8A7D] mt-1">No UPI accounts. Add them from Payment Methods.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {upiAccounts.map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => toggleUpi(acc.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left ${selectedUpis.includes(acc.id) ? 'border-[#4F6B4F] bg-[#4F6B4F]/5' : 'border-coffee-200'}`}
                  >
                    <span className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${selectedUpis.includes(acc.id) ? 'bg-[#4F6B4F] border-[#4F6B4F]' : 'border-[#C8C2B8]'}`}>
                      {selectedUpis.includes(acc.id) && (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[#2B1F17] block truncate">{acc.label}</span>
                      <span className="text-xs text-[#8C8A7D] block truncate">{acc.upi_id}</span>
                    </div>
                    {acc.qr_image_url && <img src={acc.qr_image_url} alt="" className="w-8 h-8 rounded object-contain shrink-0 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-coffee-700">Description</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Optional" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => update('active', !form.active)}
              className={`relative w-10 h-6 rounded-full transition-colors ${form.active ? 'bg-court-600' : 'bg-coffee-200'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-sm font-medium text-coffee-800">{form.active ? 'Active' : 'Inactive'}</span>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : session?.id ? 'Save' : 'Create'}
          </button>
        </form>
      </div>
    </div>
  )
}
