import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

function generatePDF(waiver) {
  const content = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #003D30; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #5d7a71; font-size: 13px; margin-bottom: 24px; }
  .waiver-text { font-size: 13px; line-height: 1.7; border: 1px solid #e8f5f0; border-radius: 8px; padding: 16px; background: #f7fffb; margin-bottom: 24px; white-space: pre-line; }
  .sig-section { margin-top: 32px; }
  .sig-label { font-size: 12px; color: #5d7a71; margin-bottom: 8px; }
  .sig-img { border: 1px solid #e8f5f0; border-radius: 8px; padding: 12px; background: #fff; }
  .sig-img img { max-width: 300px; height: auto; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e8f5f0; font-size: 11px; color: #93a29b; }
</style>
</head>
<body>
  <h1>Consent & Waiver</h1>
  <div class="meta">
    <strong>${waiver.name}</strong> &middot; ${waiver.phone}<br/>
    Signed: ${new Date(waiver.signed_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
  </div>
  <div class="waiver-text">I acknowledge that participating in pickleball involves inherent risks including, but not limited to, physical injury, muscle strains, sprains, fractures, and other bodily harm. I voluntarily assume all risks associated with my participation.

I hereby release and hold harmless Dink Over Coffee, its organizers, venue owners, and all associated individuals from any and all liability for injuries, damages, or losses sustained during or as a result of my participation in any session.

I confirm that I am physically fit to participate and have no medical conditions that would prevent safe participation. I understand that I am responsible for my own safety and well-being during sessions.</div>
  <div class="sig-section">
    <div class="sig-label">Signature</div>
    <div class="sig-img"><img src="${waiver.signature}" /></div>
  </div>
  <div class="footer">
    Dink Over Coffee &middot; dinkovercoffee.com &middot; Document generated ${new Date().toLocaleDateString('en-IN')}
  </div>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  printWindow.document.write(content)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
  }
}

export default function Waivers({ onBack }) {
  const [waivers, setWaivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadWaivers()
  }, [])

  async function loadWaivers() {
    setLoading(true)
    const { data } = await supabase
      .from('waivers')
      .select('*')
      .order('signed_at', { ascending: false })
    setWaivers(data || [])
    setLoading(false)
  }

  const filtered = waivers.filter(w => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return w.name.toLowerCase().includes(q) || w.phone.includes(q)
  })

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Signed Waivers</h1>
          <span className="text-muted text-xs ml-auto">{waivers.length} total</span>
        </div>

        <input
          className="input w-full mb-4"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading && <p className="text-muted text-sm text-center py-8">Loading...</p>}

        {!loading && filtered.length === 0 && (
          <p className="text-muted text-sm text-center py-8">No waivers found.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-border bg-surface divide-y divide-bg">
            {filtered.map(w => (
              <div key={w.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary font-medium truncate">{w.name}</p>
                  <p className="text-xs text-muted">{w.phone} &middot; {new Date(w.signed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <button
                  onClick={() => generatePDF(w)}
                  className="shrink-0 text-xs text-interactive font-semibold px-3 py-1.5 rounded-full border border-interactive/20 active:bg-interactive/5 transition"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
