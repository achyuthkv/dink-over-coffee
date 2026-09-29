import { useEffect, useState } from 'react'

function secondsLeft(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

export default function HoldTimer({ expiresAt, className = '' }) {
  const [remaining, setRemaining] = useState(() => secondsLeft(expiresAt))

  useEffect(() => {
    setRemaining(secondsLeft(expiresAt))
    const id = setInterval(() => setRemaining(secondsLeft(expiresAt)), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (remaining <= 0) {
    return <p className={`text-2xs text-error mt-2 text-center ${className}`}>Hold expired — please try again.</p>
  }

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const low = remaining <= 60

  return (
    <p className={`text-2xs mt-2 text-center ${low ? 'text-error' : 'text-secondary'} ${className}`}>
      Slot held — complete payment within <span className="font-semibold">{mins}:{String(secs).padStart(2, '0')}</span>
    </p>
  )
}
