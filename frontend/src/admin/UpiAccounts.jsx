import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'

export default function UpiAccounts({ onBack }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ label: '', upi_id: '', qr_image_url: '' })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('upi_accounts').select('*').order('created_at')
    setAccounts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!form.label.trim() || !form.upi_id.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('upi_accounts').update({ label: form.label.trim(), upi_id: form.upi_id.trim(), qr_image_url: form.qr_image_url.trim() }).eq('id', editing.id)
    } else {
      await supabase.from('upi_accounts').insert({ label: form.label.trim(), upi_id: form.upi_id.trim(), qr_image_url: form.qr_image_url.trim() })
    }
    setForm({ label: '', upi_id: '', qr_image_url: '' })
    setEditing(null)
    setSaving(false)
    load()
  }

  function startEdit(acc) {
    setEditing(acc)
    setForm({ label: acc.label, upi_id: acc.upi_id, qr_image_url: acc.qr_image_url || '' })
  }

  function cancelEdit() {
    setEditing(null)
    setForm({ label: '', upi_id: '', qr_image_url: '' })
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error: uploadErr, data: uploadData } = await supabase.storage.from('Payment QR codes').upload(path, file, { contentType: file.type, upsert: true })
    if (uploadErr) { alert('Upload failed: ' + uploadErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('Payment QR codes').getPublicUrl(uploadData.path)
    setForm(f => ({ ...f, qr_image_url: publicUrl }))
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function toggleActive(acc) {
    await supabase.from('upi_accounts').update({ active: !acc.active }).eq('id', acc.id)
    load()
  }

  async function confirmDelete() {
    if (!deleteConfirm) return
    await supabase.from('session_upis').delete().eq('upi_account_id', deleteConfirm.id)
    await supabase.from('upi_accounts').delete().eq('id', deleteConfirm.id)
    setDeleteConfirm(null)
    load()
  }

  return (
    <div className="min-h-screen bg-[#F6F1E7] bg-[url('/bg-pattern.svg')] bg-[length:360px_360px] bg-repeat">
      <div className="max-w-xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} title="Back" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#8C8A7D] active:bg-[#F6F1E7] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[#2B1F17] font-bold text-lg">Payment Methods</h1>
          <div className="w-10" />
        </div>

        <form onSubmit={handleSave} className="card space-y-3 mb-5">
          <h2 className="text-coffee-900 font-bold text-sm">{editing ? 'Edit UPI' : 'Add UPI account'}</h2>
          <div>
            <label className="text-xs font-semibold text-coffee-700">Label</label>
            <input className="input mt-1" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Primary, Harshitha" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-coffee-700">UPI ID</label>
            <input className="input mt-1" value={form.upi_id} onChange={e => setForm(f => ({ ...f, upi_id: e.target.value }))} placeholder="name@upi" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-coffee-700">QR code image</label>
            {form.qr_image_url ? (
              <div className="mt-2 flex items-start gap-3">
                <img src={form.qr_image_url} alt="QR preview" className="w-20 h-20 rounded-lg object-contain border border-coffee-100 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-[#4F6B4F] font-medium truncate">Uploaded</p>
                  <p className="text-[10px] text-[#8C8A7D] truncate mt-0.5">{form.qr_image_url.split('/').pop()}</p>
                  <button type="button" onClick={() => setForm(f => ({ ...f, qr_image_url: '' }))} className="mt-2 text-[11px] text-[#C75A2B] font-medium">Remove</button>
                </div>
              </div>
            ) : (
              <div className="mt-1">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full rounded-xl border-2 border-dashed border-coffee-200 px-3 py-4 text-xs font-medium text-coffee-600 active:bg-coffee-100 transition text-center">
                  {uploading ? 'Uploading…' : 'Tap to upload QR image'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm">{editing ? 'Update' : 'Add'}</button>
            {editing && <button type="button" onClick={cancelEdit} className="flex-1 py-2.5 rounded-full border border-[#E6DCC6] text-sm font-medium text-[#8C8A7D]">Cancel</button>}
          </div>
        </form>

        {loading && <p className="text-[#8C8A7D] text-sm text-center py-4">Loading…</p>}

        {!loading && accounts.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-[#E6DCC6]">
            {accounts.map((acc, i) => (
              <div key={acc.id} className={`bg-white px-4 py-3 flex items-center justify-between ${i > 0 ? 'border-t border-[#F6F1E7]' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleActive(acc)}
                    className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${acc.active ? 'bg-[#4F6B4F]' : 'bg-[#E6DCC6]'}`}
                  >
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${acc.active ? 'translate-x-[14px]' : ''}`} />
                  </button>
                  <div className="min-w-0">
                    <span className="text-sm text-[#2B1F17] font-medium block truncate">{acc.label}</span>
                    <span className="text-xs text-[#8C8A7D] block truncate">{acc.upi_id}</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => startEdit(acc)} title="Edit" className="w-9 h-9 flex items-center justify-center rounded-full text-[#2B1F17] active:bg-[#F6F1E7] transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={() => setDeleteConfirm(acc)} title="Delete" className="w-9 h-9 flex items-center justify-center rounded-full text-[#C75A2B] active:bg-red-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <p className="text-[#8C8A7D] text-sm text-center py-4">No UPI accounts added yet.</p>
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm text-[#2B1F17] font-medium text-center">Delete <strong>{deleteConfirm.label}</strong>?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-full border border-[#E6DCC6] text-sm font-medium text-[#8C8A7D] active:bg-[#F6F1E7] transition">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-full bg-[#C75A2B] text-white text-sm font-medium active:scale-[.98] transition">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
