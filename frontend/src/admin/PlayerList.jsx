import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

export default function PlayerList({ session, onBack }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [shareModal, setShareModal] = useState(false)
  const [shareText, setShareText] = useState('')
  const [removePlayer, setRemovePlayer] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

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
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const dt = new Date(session.date + 'T00:00:00')
    const dateStr = `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
    const msg = `Hey ${player.name.split(/\s+/)[0]}! 🎉\n\nGreat news — a slot opened up and you've been promoted from the waitlist!\n\n*${session.title || 'Dink Over Coffee'}*\n${dateStr} | ${session.time}\n${session.venue}\n\nSee you on court! 🏓`
    const phone = player.phone?.replace(/\D/g, '')
    const fullPhone = phone?.length === 10 ? `91${phone}` : phone
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function remove(player) {
    setRemovePlayer(player)
  }

  async function confirmRemove() {
    if (!removePlayer) return
    await supabase.from('players').delete().eq('id', removePlayer.id)
    setRemovePlayer(null)
    setExpandedId(null)
    loadPlayers()
  }

  const confirmed = players.filter(p => p.status === 'confirmed')
  const waitlisted = players.filter(p => p.status === 'waitlisted')
  const paidCount = confirmed.filter(p => p.paid).length
  const totalSlots = Number(session.max_slots || 0)
  const remaining = Math.max(0, totalSlots - confirmed.length)

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
      text += '\n'
    }

    const hasSplit = session.beginner_slots != null && Number(session.beginner_slots) > 0
    if (hasSplit) {
      const bSlots = Number(session.beginner_slots)
      const oSlots = Number(session.max_slots) - bSlots
      const bTaken = confirmed.filter(p => p.skill === 'Beginner').length
      const oTaken = confirmed.filter(p => p.skill !== 'Beginner').length
      const bLeft = Math.max(0, bSlots - bTaken)
      const oLeft = Math.max(0, oSlots - oTaken)
      const parts = []
      if (bLeft > 0) parts.push(`${bLeft} Beginner`)
      if (oLeft > 0) parts.push(`${oLeft} Intermediate+`)
      if (parts.length > 0) text += `_${parts.join(' | ')} slot${(bLeft + oLeft) > 1 ? 's' : ''} left - grab them soon!_`
    } else {
      const totalLeft = Math.max(0, Number(session.max_slots) - confirmed.length)
      if (totalLeft > 0) text += `_${totalLeft} slot${totalLeft > 1 ? 's' : ''} left - grab them soon!_`
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

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const skillDot = (skill) => skill === 'Beginner' ? 'bg-[#4F6B4F]' : skill === 'Advanced' ? 'bg-[#2B1F17]' : 'bg-[#C75A2B]'

  return (
    <div className="min-h-screen bg-[#F6F1E7] bg-[url('/bg-pattern.svg')] bg-[length:360px_360px] bg-repeat">
      <div className="max-w-xl mx-auto px-5 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#8C8A7D] active:bg-white transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[#2B1F17] font-bold text-[15px] truncate">{session.title || session.venue}</div>
            <div className="text-[#8C8A7D] text-xs">{session.date} · {session.time}</div>
          </div>
          <button onClick={openShareModal} className="w-9 h-9 flex items-center justify-center rounded-full border border-[#E6DCC6] text-[#4F6B4F] active:bg-white transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-6">
          <div className="flex-1 bg-white rounded-xl border border-[#E6DCC6] px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-[#2B1F17]">{confirmed.length}<span className="text-[#8C8A7D] font-normal text-sm">/{totalSlots}</span></div>
            <div className="text-[10px] text-[#8C8A7D] uppercase tracking-wide mt-0.5">Registered</div>
          </div>
          <div className="flex-1 bg-white rounded-xl border border-[#E6DCC6] px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-[#4F6B4F]">{paidCount}<span className="text-[#8C8A7D] font-normal text-sm">/{confirmed.length}</span></div>
            <div className="text-[10px] text-[#8C8A7D] uppercase tracking-wide mt-0.5">Paid</div>
          </div>
          <div className="flex-1 bg-white rounded-xl border border-[#E6DCC6] px-3 py-2.5 text-center">
            <div className="text-lg font-bold text-[#C75A2B]">{remaining}</div>
            <div className="text-[10px] text-[#8C8A7D] uppercase tracking-wide mt-0.5">Remaining</div>
          </div>
        </div>

        {loading && <p className="text-[#8C8A7D] text-sm text-center py-8">Loading…</p>}

        {!loading && (
          <div className="space-y-5">
            {/* Confirmed players */}
            {confirmedGroups.map(g => {
              const dotColor = skillDot(g.skill)
              return (
                <div key={g.skill}>
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-[11px] font-semibold text-[#8C8A7D] uppercase tracking-wide">{g.skill}</span>
                    <span className="text-[11px] text-[#8C8A7D]">({g.players.length})</span>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-[#E6DCC6] bg-white divide-y divide-[#F6F1E7]">
                    {g.players.map(p => {
                      const isExpanded = expandedId === p.id
                      return (
                        <div key={p.id}>
                          <div className="px-4 py-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="flex-1 min-w-0 flex items-center gap-3 text-left"
                            >
                              <span className="text-sm text-[#2B1F17] font-medium truncate">{p.name}</span>
                              {p.phone && <span className="text-[11px] text-[#8C8A7D] shrink-0">{p.phone}</span>}
                            </button>
                            <button
                              type="button"
                              onClick={() => togglePaid(p)}
                              className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${p.paid ? 'bg-[#4F6B4F]' : 'bg-[#E6DCC6]'}`}
                            >
                              <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${p.paid ? 'translate-x-[18px]' : ''}`} />
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-3 flex items-center gap-2">
                              <button
                                onClick={() => remove(p)}
                                className="text-xs text-[#C75A2B] font-medium px-3 py-1.5 rounded-full border border-[#C75A2B]/20 active:bg-red-50 transition"
                              >
                                Remove player
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Waitlist */}
            {waitlistedGroups.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[11px] font-semibold text-[#8C8A7D] uppercase tracking-wide">Waitlist</span>
                  <span className="text-[11px] text-[#8C8A7D]">({waitlisted.length})</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-[#E6DCC6] bg-white divide-y divide-[#F6F1E7]">
                  {waitlistedGroups.map(g =>
                    g.players.map(p => {
                      const isExpanded = expandedId === p.id
                      return (
                        <div key={p.id}>
                          <div className="px-4 py-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleExpand(p.id)}
                              className="flex-1 min-w-0 flex items-center gap-2 text-left"
                            >
                              <span className="text-sm text-[#2B1F17] font-medium truncate">{p.name}</span>
                              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${skillDot(p.skill)}`} />
                              <span className="text-[11px] text-[#8C8A7D]">{p.skill}</span>
                            </button>
                            <button
                              onClick={() => promote(p)}
                              className="shrink-0 text-xs text-[#4F6B4F] font-semibold px-3 py-1.5 rounded-full border border-[#4F6B4F]/20 active:bg-[#4F6B4F]/5 transition"
                            >
                              Promote
                            </button>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-3 flex items-center gap-2">
                              {p.phone && <span className="text-[11px] text-[#8C8A7D]">{p.phone}</span>}
                              <button
                                onClick={() => remove(p)}
                                className="text-xs text-[#C75A2B] font-medium px-3 py-1.5 rounded-full border border-[#C75A2B]/20 active:bg-red-50 transition"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {players.length === 0 && (
              <div className="rounded-xl border border-[#E6DCC6] bg-white px-4 py-8 text-center">
                <div className="text-[#8C8A7D] text-sm">No players yet</div>
              </div>
            )}
          </div>
        )}

        {/* Remove confirmation */}
        {removePlayer && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setRemovePlayer(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <p className="text-sm text-[#2B1F17] font-medium text-center">
                Remove <strong>{removePlayer.name}</strong>?
                <br /><span className="text-xs text-[#8C8A7D] font-normal">This cannot be undone.</span>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setRemovePlayer(null)} className="flex-1 py-2.5 rounded-full border border-[#E6DCC6] text-sm font-medium text-[#8C8A7D] active:bg-[#F6F1E7] transition">Cancel</button>
                <button onClick={confirmRemove} className="flex-1 py-2.5 rounded-full bg-[#C75A2B] text-white text-sm font-medium active:scale-[.98] transition">Remove</button>
              </div>
            </div>
          </div>
        )}

        {/* Share modal */}
        {shareModal && (
          <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShareModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#2B1F17]">Share player list</span>
                <button onClick={() => setShareModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#8C8A7D] active:bg-[#F6F1E7] transition">✕</button>
              </div>
              <textarea
                className="w-full bg-[#F6F1E7] border-0 rounded-xl p-3 text-sm text-[#2B1F17] resize-none focus:ring-1 focus:ring-[#2B1F17]/20 focus:outline-none"
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
