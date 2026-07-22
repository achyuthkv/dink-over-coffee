import { useEffect, useState } from 'react'

function HealthRing({ score, size = 120 }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? 'text-secondary' : score >= 40 ? 'text-warning' : 'text-tertiary'

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-border/30" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={color} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <span className="text-[10px] text-muted">/ 100</span>
      </div>
    </div>
  )
}

function Sparkline({ data, className = '' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const height = 32
  const width = data.length * 14
  const points = data.map((v, i) => `${i * 14 + 7},${height - (v / max) * (height - 4) - 2}`).join(' ')

  return (
    <svg width={width} height={height} className={className}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-interactive" />
      {data.map((v, i) => (
        <circle key={i} cx={i * 14 + 7} cy={height - (v / max) * (height - 4) - 2} r="2.5" className="fill-interactive" />
      ))}
    </svg>
  )
}

function Card({ title, badge, children }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {badge && <span className="text-[10px] font-medium bg-interactive/10 text-interactive px-2 py-0.5 rounded-full">{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function ChangeBadge({ value }) {
  if (value === 0) return <span className="text-muted text-xs">no change</span>
  const positive = value > 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-secondary' : 'text-tertiary'}`}>
      {positive ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  )
}

export default function Metrics({ onBack }) {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        const data = await res.json()
        if (data.ok) setMetrics(data.metrics)
        else setError(data.error)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function whatsappLink(phone, name) {
    const cleanPhone = phone?.replace(/\D/g, '')
    const fullPhone = cleanPhone?.length === 10 ? `91${cleanPhone}` : cleanPhone
    const msg = `Hey ${name.split(/\s+/)[0]}! We've missed you at Dink Over Coffee 🏓 We have sessions coming up — would love to see you back on court!`
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`
  }

  if (loading) return (
    <div className="min-h-screen bg-pattern flex items-center justify-center">
      <p className="text-muted text-sm">Loading metrics…</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-pattern flex flex-col items-center justify-center gap-3">
      <p className="text-tertiary text-sm">{error}</p>
      <button onClick={onBack} className="text-interactive text-sm font-medium">← Back</button>
    </div>
  )

  const { health, growth, inactive, sessionStats, venues, funnel, reachOut } = metrics

  return (
    <div className="min-h-screen bg-pattern">
      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-full border border-border text-muted active:bg-surface transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-primary font-bold text-lg">Community Intelligence</h1>
        </div>

        {/* Health Score */}
        <Card title="Community Health">
          <div className="flex items-center gap-5">
            <HealthRing score={health.score} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Growth</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(health.growth, 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-primary font-medium w-7 text-right">{health.growth}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Retention</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div className="h-full bg-interactive rounded-full" style={{ width: `${Math.min(health.retention, 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-primary font-medium w-7 text-right">{health.retention}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Fill Rate</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div className="h-full bg-warning rounded-full" style={{ width: `${Math.min(health.fill, 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-primary font-medium w-7 text-right">{health.fill}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Conversion</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-border/30 overflow-hidden">
                    <div className="h-full bg-tertiary rounded-full" style={{ width: `${Math.min(health.conversion, 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-primary font-medium w-7 text-right">{health.conversion}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Growth */}
        <Card title="Growth" badge={<ChangeBadge value={growth.changePct} />}>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">+{growth.newThisMonth}</div>
              <div className="text-xs text-muted">new players this month</div>
              <div className="text-[11px] text-muted mt-1">vs +{growth.newLastMonth} last month · {growth.totalUnique} total unique</div>
            </div>
            <Sparkline data={growth.weeklyNew} />
          </div>
        </Card>

        {/* Conversion Funnel */}
        <Card title="Conversion Funnel">
          <div className="space-y-2">
            <FunnelRow label="First session" count={funnel.firstSession} pct={100} />
            <FunnelRow label="Came back (2+)" count={funnel.returned} pct={funnel.returnedPct} />
            <FunnelRow label="Regular (4+)" count={funnel.regular} pct={funnel.regularPct} />
          </div>
        </Card>

        {/* Reach Out */}
        {reachOut.length > 0 && (
          <Card title="Reach Out" badge={`${reachOut.length} players`}>
            <p className="text-[11px] text-muted -mt-1">Regulars who haven't played in 21+ days</p>
            <div className="divide-y divide-bg">
              {reachOut.map(p => (
                <div key={p.phone} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-primary font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted">{p.totalSessions} sessions · last seen {p.daysSince}d ago</div>
                  </div>
                  <a
                    href={whatsappLink(p.phone, p.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 ml-3 text-xs text-secondary font-semibold px-3 py-1.5 rounded-full border border-secondary/20 active:bg-secondary/5 transition"
                  >
                    Message
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Inactive players */}
        {inactive.length > 0 && inactive.length !== reachOut.length && (
          <Card title="Going Inactive" badge={`${inactive.length} players`}>
            <p className="text-[11px] text-muted -mt-1">Players with 2+ sessions who haven't played in 21+ days</p>
            <div className="divide-y divide-bg">
              {inactive.slice(0, 8).map(p => (
                <div key={p.phone} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-primary font-medium truncate">{p.name}</div>
                    <div className="text-[11px] text-muted">{p.totalSessions} sessions · {p.daysSince}d inactive</div>
                  </div>
                  <a
                    href={whatsappLink(p.phone, p.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 ml-3 w-8 h-8 flex items-center justify-center rounded-full border border-border text-muted active:bg-bg transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Session Leaderboard */}
        <Card title="Top Sessions" badge="by fill rate">
          <div className="divide-y divide-bg">
            {sessionStats.slice(0, 6).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="text-xs text-muted font-medium w-5 shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary font-medium truncate">{s.title}</div>
                  <div className="text-[11px] text-muted">{s.date} · {s.time}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-primary">{s.fillRate}%</div>
                  <div className="text-[10px] text-muted">{s.confirmed}/{s.maxSlots}{s.waitlisted > 0 ? ` +${s.waitlisted} wl` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Venue Scorecard */}
        {venues.length > 1 && (
          <Card title="Venue Scorecard">
            <div className="divide-y divide-bg">
              {venues.map(v => (
                <div key={v.name} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-primary font-medium truncate">{v.name}</div>
                    <div className="text-[11px] text-muted">{v.sessions} sessions · {v.paidRate}% paid</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-primary">{v.avgFillRate}%</div>
                    <div className="text-[10px] text-muted">avg fill</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Single venue — still show stats */}
        {venues.length === 1 && (
          <Card title="Venue Stats">
            <div className="flex gap-3">
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-primary">{venues[0].avgFillRate}%</div>
                <div className="text-[10px] text-muted">Avg Fill</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-primary">{venues[0].sessions}</div>
                <div className="text-[10px] text-muted">Sessions</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-lg font-bold text-primary">{venues[0].paidRate}%</div>
                <div className="text-[10px] text-muted">Paid Rate</div>
              </div>
            </div>
          </Card>
        )}

        <div className="h-8" />
      </div>
    </div>
  )
}

function FunnelRow({ label, count, pct }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-primary font-medium">{label}</span>
          <span className="text-[11px] text-muted">{count} ({pct}%)</span>
        </div>
        <div className="h-2 rounded-full bg-border/30 overflow-hidden">
          <div className="h-full bg-interactive rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
