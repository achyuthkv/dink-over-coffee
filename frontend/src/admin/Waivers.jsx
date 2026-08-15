import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

function generatePDF(waiver) {
  const fileName = `${waiver.name.replace(/\s+/g, '-')}-consent`
  const signedDate = new Date(waiver.signed_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const content = `
<!DOCTYPE html>
<html>
<head>
<title>${fileName}</title>
<style>
  @page { margin: 48px 40px; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 0; color: #003D30; font-size: 12px; line-height: 1.7; }
  h1 { font-size: 18px; margin-bottom: 2px; font-weight: 800; }
  h2 { font-size: 13px; font-weight: 700; margin-top: 20px; margin-bottom: 6px; }
  .org { font-size: 14px; font-weight: 600; color: #003D30; margin-bottom: 2px; }
  .meta { color: #5d7a71; font-size: 12px; margin-bottom: 20px; }
  .waiver-text { font-size: 11.5px; line-height: 1.8; margin-bottom: 20px; }
  .waiver-text p { margin: 0 0 12px 0; text-align: justify; }
  .sig-section { margin-top: 28px; }
  .sig-label { font-size: 11px; color: #5d7a71; margin-bottom: 6px; }
  .sig-img { border: 1px solid #e8f5f0; border-radius: 8px; padding: 12px; background: #fff; display: inline-block; }
  .sig-img img { max-width: 250px; height: auto; }
  .sig-meta { margin-top: 8px; font-size: 11px; color: #5d7a71; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e8f5f0; font-size: 10px; color: #93a29b; }
</style>
</head>
<body>
  <h1>DISCLAIMER & WAIVER</h1>
  <div class="org">Dink Over Coffee</div>
  <div class="meta">Date: ${signedDate}</div>

  <div class="waiver-text">
    <p>Use of the facilities, equipment, courts, premises, sessions, and services of Dink Over Coffee is entirely at the sole risk of the participant or visitor.</p>

    <p>All persons participating in sessions are required to ensure that they are medically and physically fit to undertake exercise, training, and related physical activity. Dink Over Coffee does not provide medical advice and shall not be responsible for any injury, illness, health complication, aggravation of any pre-existing condition, physical strain, disability, or other adverse consequence arising from participation in any session, activity, or use of equipment.</p>

    <p>All participants and visitors are required to strictly follow the instructions, guidance, demonstrations, warnings, and safety directions given by the organizers, coaches, and staff of Dink Over Coffee at all times. Dink Over Coffee shall not be held liable or responsible for any injury, loss, damage, accident, or claim arising directly or indirectly from any failure, refusal, neglect, or omission on the part of any participant or visitor to follow such instructions, or from the use of equipment or performance of activities contrary to the advice of the organizers or staff.</p>

    <p>Use of pickleball equipment, paddles, nets, courts, and other facilities must be undertaken carefully and only for their intended purpose. Any misuse of equipment, unsafe conduct, reckless behaviour, overexertion, or participation beyond one's physical limits shall be entirely at the user's own risk.</p>

    <p>In the event of any dispute, altercation, clash, misconduct, or inappropriate behaviour between participants or visitors within the premises during a Dink Over Coffee session, the organizers reserve the right, but shall not be under any obligation, to intervene, de-escalate the situation, remove the persons involved, or take such action as deemed necessary in the interest of safety, discipline, and order. Dink Over Coffee shall not be responsible or liable for any injury, loss, damage, or claim arising out of or in connection with any such incident between participants or visitors.</p>

    <p>Any dispute, altercation, clash, or incident occurring outside the session premises, including between participants, visitors, or staff, shall be entirely outside the scope of responsibility of Dink Over Coffee, and the organizers shall bear no liability whatsoever in relation to the same.</p>

    <p>Any participant or visitor who intentionally, wilfully, or negligently causes damage to any equipment, courts, fixtures, fittings, or any other property shall be solely liable to pay the full cost of repair or replacement of such damaged property, as determined by the venue or Dink Over Coffee.</p>

    <p>Personal belongings, including cash, jewellery, bags, mobile phones, and other valuables, are brought into the premises entirely at the owner's risk, and Dink Over Coffee shall not be responsible for any loss, theft, or damage to such belongings.</p>

    <p>To the fullest extent permitted under applicable law, Dink Over Coffee, its organizers, venue owners, coaches, employees, staff, and representatives disclaim any liability for any direct, indirect, incidental, or consequential loss, injury, damage, or expense suffered by any person in connection with the use of the session, its facilities, services, or premises.</p>

    <h2>Electronic Signature Consent</h2>
    <p>By drawing your signature on the device screen, you acknowledge that the signature constitutes a valid electronic signature under Section 3A of the Information Technology Act, 2000, and is equivalent to a handwritten signature for the purposes of this disclaimer. The signature, together with the metadata recorded at the time of signing (date, time, device information), forms a complete electronic record of your acceptance of these terms.</p>

    <h2>Data Processing Consent</h2>
    <p>By signing this disclaimer, you provide your free, specific, informed, and unambiguous consent under Section 6 of the Digital Personal Data Protection Act, 2023 for Dink Over Coffee to collect, store, and process your personal data — including your name, phone number, email (if provided), signature image, and device information — for the purposes of session administration, audit, fraud prevention, and legal record-keeping. You may withdraw this consent at any time by writing to us, subject to our continuing right to retain data necessary to defend any legal claim or to comply with applicable law.</p>

    <h2>Privacy Notice</h2>
    <p>Our full privacy notice — what we collect, why we collect it, how long we keep it, and your rights — is available at our Privacy Policy page. Please read it alongside this disclaimer.</p>
  </div>

  <div class="sig-section">
    <div class="sig-label">Signature</div>
    <div class="sig-img"><img src="${waiver.signature}" /></div>
    <div class="sig-meta"><strong>${waiver.name}</strong> &middot; ${waiver.phone} &middot; Signed: ${new Date(waiver.signed_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</div>
  </div>
  <div class="footer">
    Dink Over Coffee &middot; dinkovercoffee.com
  </div>
</body>
</html>`

  let iframe = document.getElementById('waiver-print-frame')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'waiver-print-frame'
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:800px;height:600px;'
    document.body.appendChild(iframe)
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document
  doc.open()
  doc.write(content)
  doc.close()
  iframe.onload = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
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
      <div className="max-w-2xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
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
