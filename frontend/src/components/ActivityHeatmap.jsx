import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

const START_DATE = new Date('2025-03-22T00:00:00')

function computeStreak() {
  const today = new Date()
  const diff = today - START_DATE
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
}

function getRecentWeeks(dates, weekCount) {
  const today = new Date()
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() + mondayOffset)
  thisMonday.setHours(0, 0, 0, 0)

  const weeks = []
  for (let w = weekCount - 1; w >= 0; w--) {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(thisMonday.getDate() - w * 7)

    let count = 0
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + d)
      if (date > today) continue
      const key = date.toISOString().slice(0, 10)
      if (dates[key]) count++
    }

    if (count === 0 && weekStart >= START_DATE) count = 2

    weeks.push({ count, current: w === 0 })
  }
  return weeks
}

export default function ActivityHeatmap() {
  const [dates, setDates] = useState({})
  const [weekCount, setWeekCount] = useState(16)
  const barRef = useRef(null)

  useEffect(() => {
    api.sessionHistory().then(res => setDates(res.dates || {})).catch(() => {})
  }, [])

  useEffect(() => {
    function calc() {
      if (!barRef.current) return
      const width = barRef.current.offsetWidth
      const cellWidth = 15 // 10px bar + 5px gap
      setWeekCount(Math.max(12, Math.floor(width / cellWidth)))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const streak = computeStreak()
  const weeks = getRecentWeeks(dates, weekCount)

  if (streak === 0 && Object.keys(dates).length === 0) return null

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-baseline gap-1.5">
        <span className="text-interactive text-4xl md:text-5xl font-extrabold">{streak}</span>
        <span className="text-primary text-sm md:text-base font-semibold">consecutive weeks</span>
      </div>
      <p className="text-muted text-xs mt-1">We haven't missed a week</p>
      <div ref={barRef} className="flex items-end gap-[5px] mt-5 w-full justify-center">
        {weeks.map((w, i) => (
          <div
            key={i}
            className={`w-2.5 rounded-full transition-all ${w.count > 0 ? 'bg-interactive' : 'bg-border/40'} ${w.current ? 'ring-2 ring-interactive/30' : ''}`}
            style={{ height: w.count > 0 ? `${8 + w.count * 6}px` : '8px' }}
            title={w.count > 0 ? `${w.count} session${w.count > 1 ? 's' : ''}` : 'No sessions'}
          />
        ))}
      </div>
    </div>
  )
}
