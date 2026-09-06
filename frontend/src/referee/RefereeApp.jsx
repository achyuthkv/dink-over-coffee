import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { computeStandings } from '../lib/tournament.js'
import { scoreMatchAndAdvance } from '../lib/tournamentActions.js'
import { ScoreMode } from '../components/tournament/shared.jsx'

export default function RefereeApp({ userId, name }) {
  const [assignments, setAssignments] = useState([])
  const [categoriesById, setCategoriesById] = useState(new Map())
  const [tournamentsById, setTournamentsById] = useState(new Map())
  const [groupsById, setGroupsById] = useState(new Map())
  const [loading, setLoading] = useState(true)

  const [active, setActive] = useState(null)
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])

  async function load() {
    setLoading(true)
    const { data: asn } = await supabase.from('tournament_referee_assignments').select('*').eq('referee_id', userId)
    const rows = asn || []
    setAssignments(rows)

    const categoryIds = [...new Set(rows.map(a => a.category_id))]
    const groupIds = [...new Set(rows.map(a => a.group_id).filter(Boolean))]

    if (categoryIds.length > 0) {
      const { data: cats } = await supabase.from('tournament_categories').select('id, name, tournament_id').in('id', categoryIds)
      setCategoriesById(new Map((cats || []).map(c => [c.id, c])))
      const tournamentIds = [...new Set((cats || []).map(c => c.tournament_id))]
      if (tournamentIds.length > 0) {
        const { data: ts } = await supabase.from('tournaments').select('id, name').in('id', tournamentIds)
        setTournamentsById(new Map((ts || []).map(t => [t.id, t])))
      }
    } else {
      setCategoriesById(new Map())
    }
    if (groupIds.length > 0) {
      const { data: gs } = await supabase.from('tournament_groups').select('id, name').in('id', groupIds)
      setGroupsById(new Map((gs || []).map(g => [g.id, g])))
    } else {
      setGroupsById(new Map())
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  useEffect(() => {
    const channel = supabase
      .channel(`referee-assignments-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_referee_assignments', filter: `referee_id=eq.${userId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function openAssignment(a) {
    let matchQuery = supabase.from('tournament_matches').select('*').eq('category_id', a.category_id)
    matchQuery = a.scope === 'group' ? matchQuery.eq('group_id', a.group_id) : matchQuery.gt('round', 0)
    const [{ data: m }, { data: tm }] = await Promise.all([
      matchQuery.order('match_number'),
      supabase.from('tournament_teams').select('*').eq('category_id', a.category_id)
    ])
    setMatches(m || [])
    setTeams(tm || [])
    setActive(a)
  }

  async function scoreMatch(match, scoreA, scoreB) {
    await scoreMatchAndAdvance(matches, match, scoreA, scoreB)
    openAssignment(active)
  }

  if (active) {
    const teamsById = new Map(teams.map(t => [t.id, t]))
    const groupName = active.group_id ? groupsById.get(active.group_id)?.name : null
    const title = `${categoriesById.get(active.category_id)?.name || 'Category'} — ${groupName || 'Bracket'}`
    const standings = active.scope === 'group'
      ? computeStandings(teams.filter(t => t.group_id === active.group_id), matches)
      : undefined
    return (
      <ScoreMode
        title={title}
        matches={matches}
        teamsById={teamsById}
        onScore={scoreMatch}
        onExit={() => setActive(null)}
        standings={standings}
      />
    )
  }

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-xl mx-auto px-5 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-primary font-bold text-lg">{name ? `Hi, ${name}` : 'Referee'}</h1>
            <p className="text-xs text-muted">Your assigned matches</p>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="text-xs font-medium text-muted px-3 py-1.5 rounded-full border border-border active:bg-bg transition">Sign out</button>
        </div>

        {loading && <p className="text-muted text-sm text-center py-8">Loading…</p>}

        {!loading && assignments.length === 0 && (
          <p className="text-muted text-sm text-center py-8">No assignments yet — check back once an organizer assigns you to a court or bracket.</p>
        )}

        <div className="space-y-3">
          {assignments.map(a => {
            const category = categoriesById.get(a.category_id)
            const tournament = category ? tournamentsById.get(category.tournament_id) : null
            const groupName = a.group_id ? groupsById.get(a.group_id)?.name : 'Knockout Bracket'
            return (
              <button
                key={a.id}
                onClick={() => openAssignment(a)}
                className="w-full text-left card-compact px-4 py-3 flex items-center justify-between gap-3 active:bg-bg transition"
              >
                <div className="min-w-0">
                  <div className="text-sm text-primary font-semibold truncate">{groupName}</div>
                  <div className="text-2xs text-muted mt-0.5 truncate">{tournament?.name}{category ? ` — ${category.name}` : ''}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
