import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

export default function PlayerList({ session, onBack }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [shareModal, setShareModal] = useState(false)
  const [shareText, setShareText] = useState('')
  const [removePlayer, setRemovePlayer] = useState(null)

  async function loadPlayers() {
    setLoading(true)
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at')
    setPlayers(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPlayers() }, [session.id])

  async function togglePaid(player) {
    const newVal = !player.paid
    setPlayers(ps => ps.map(p => p.id === player.id ? { ...p, paid: newVal } : p))
    await supabase.from('players').update({ paid: newVal }).eq('id', player.id)
  }

  async function promote(player) {
    await supabase.from('players').update({ status: 'confirmed' }).eq('id', player.id)
    loadPlayers()
  }

  function remove(player) {
    setRemovePlayer(player)
  }

  async function confirmRemove() {
    if (!removePlayer) return
    await supabase.from('players').delete().eq('id', removePlayer.id)
    setRemovePlayer(null)
    loadPlayers()
  }

  const confirmed = players.filter(p => p.status === 'confirmed')
  const waitlisted = players.filter(p => p.status === 'waitlisted')
  const paidCount = confirmed.filter(p => p.paid).length

  const skillOrder = ['Beginner', 'Intermediate', 'Advanced']
  const groupBySkill = (list) => {
    const groups = {}
    list.forEach(p => {
      const skill = p.skill || 'Other'
      if (!groups[skill]) groups[skill] = []
      groups[skill].push(p)
    })
    return skillOrder.filter(s => groups[s]).map(s => ({ skill: s, players: groups[s] }))
      .concat(Object.keys(groups).filter(s => !skillOrder.includes(s)).map(s => ({ skill: s, players: groups[s] })))
  }

  const confirmedGroups = groupBySkill(confirmed)
  const waitlistedGroups = groupBySkill(waitlisted)

  function buildShareText() {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const dt = new Date(session.date + 'T00:00:00')
    const dateStr = `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`

    let text = `*${session.title || 'Dink Over Coffee'}*\n${dateStr} | ${session.time}\n${session.venue}\n\n`
    let num = 1
    confirmedGroups.forEach(g => {
      text += `*${g.skill} (${g.players.length}):*\n`
      g.players.forEach(p => {
        text += `${num}. ${p.name}\n`
        num++
      })
      text += '\n'
    })
    if (waitlisted.length > 0) {
      text += `*Waitlist (${waitlisted.length}):*\n`
      waitlisted.forEach((p, i) => {
        text += `${i + 1}. ${p.name} (${p.skill})\n`
      })
    }
    return text
  }

  function openShareModal() {
    setShareText(buildShareText())
    setShareModal(true)
  }

  function sendShare() {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank')
    setShareModal(false)
  }

  return (
    <div className="min-h-screen bg-[#F6F1E7] bg-[url('/bg-pattern.svg')] bg-[length:360px_360px] bg-repeat">
      <div className="max-w-xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} title="Back" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#8C8A7D] active:bg-[#F6F1E7] transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex items-center gap-4">
            <button onClick={openShareModal} title="Share list" className="w-10 h-10 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#4F6B4F] active:bg-[#F6F1E7] transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <div className="text-right">
              <span className="text-sm text-[#2B1F17] font-semibold">{confirmed.length}/{session.max_slots}</span>
              <span className="text-xs text-[#8C8A7D] ml-2">{paidCount} paid</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[#2B1F17] font-bold">{session.title || session.venue}</div>
          <div className="text-[#8C8A7D] text-xs mt-0.5">{session.date} · {session.time}</div>
        </div>

        {loading && <p className="text-[#8C8A7D] text-sm text-center py-8">Loading…</p>}

        {!loading && (
          <div className="space-y-4">
            {confirmedGroups.map(g => (
              <div key={g.skill}>
                <div className="px-1 mb-1.5">
                  <span className="text-[10px] font-semibold text-[#8C8A7D] uppercase tracking-wide">{g.skill} ({g.players.length})</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-[#E6DCC6]">
                  {g.players.map((p, i) => (
                    <div key={p.id} className={`bg-white px-4 py-2.5 flex items-center justify-between ${i > 0 ? 'border-t border-[#F6F1E7]' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => togglePaid(p)}
                          className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${p.paid ? 'bg-[#4F6B4F]' : 'bg-[#E6DCC6]'}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${p.paid ? 'translate-x-[14px]' : ''}`} />
                        </button>
                        <span className="text-sm text-[#2B1F17] font-medium">{p.name}</span>
                      </div>
                      <button onClick={() => remove(p)} title="Remove" className="w-9 h-9 flex items-center justify-center rounded-full text-[#C75A2B] active:bg-red-50 transition shrink-0 ml-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {waitlistedGroups.length > 0 && (
              <div>
                <div className="px-1 mb-1.5">
                  <span className="text-[10px] font-semibold text-[#8C8A7D] uppercase tracking-wide">Waitlist ({waitlisted.length})</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-[#E6DCC6]">
                  {waitlistedGroups.map(g => (
                    g.players.map((p, i) => (
                      <div key={p.id} className={`bg-white px-4 py-2.5 flex items-center justify-between ${i > 0 || g !== waitlistedGroups[0] ? 'border-t border-[#F6F1E7]' : ''}`}>
                        <div className="min-w-0">
                          <span className="text-sm text-[#2B1F17] font-medium">{p.name}</span>
                          <span className="text-xs text-[#8C8A7D] ml-2">{p.skill}</span>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <button onClick={() => promote(p)} title="Promote" className="w-9 h-9 flex items-center justify-center rounded-full text-[#4F6B4F] active:bg-[#F6F1E7] transition">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/></svg>
                          </button>
                          <button onClick={() => remove(p)} title="Remove" className="w-9 h-9 flex items-center justify-center rounded-full text-[#C75A2B] active:bg-red-50 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      </div>
                    ))
                  ))}
                </div>
              </div>
            )}

            {players.length === 0 && (
              <div className="rounded-xl border border-[#E6DCC6] bg-white px-4 py-6 text-center text-[#8C8A7D] text-sm">No players yet.</div>
            )}
          </div>
        )}

        {removePlayer && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setRemovePlayer(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm text-[#2B1F17] font-medium text-center">Remove <strong>{removePlayer.name}</strong>?</p>
              <div className="flex gap-3">
                <button onClick={() => setRemovePlayer(null)} className="flex-1 py-2.5 rounded-full border border-[#E6DCC6] text-sm font-medium text-[#8C8A7D] active:bg-[#F6F1E7] transition">Cancel</button>
                <button onClick={confirmRemove} className="flex-1 py-2.5 rounded-full bg-[#C75A2B] text-white text-sm font-medium active:scale-[.98] transition">Remove</button>
              </div>
            </div>
          </div>
        )}

        {shareModal && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShareModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#2B1F17]">Share player list</span>
                <button onClick={() => setShareModal(false)} className="text-[#8C8A7D] text-sm">✕</button>
              </div>
              <textarea
                className="w-full bg-transparent border border-[#E6DCC6] rounded-lg p-3 text-sm text-[#2B1F17] resize-none focus:border-[#2B1F17] focus:outline-none"
                rows={12}
                value={shareText}
                onChange={e => setShareText(e.target.value)}
              />
              <button onClick={sendShare} className="w-full bg-[#2B1F17] text-white text-sm font-semibold py-3 rounded-full active:scale-[.98] transition">Send via WhatsApp</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
