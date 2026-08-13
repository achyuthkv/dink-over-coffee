import { useEffect, useRef, useState } from 'react'

const IDLE_LOCK_MINUTES = 10
const BACKGROUND_LOCK_MINUTES = 2
const FORCE_SIGNOUT_HOURS = 24

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll']

/**
 * Locks the UI (not the underlying Supabase session) after idle time or
 * after the app has been backgrounded — the two situations that matter most
 * on mobile, where "idle" alone rarely happens (people switch apps instead
 * of leaving a tab open and untouched).
 */
export function useAppLock({ enabled, onForceSignOut }) {
  const [locked, setLocked] = useState(false)
  const lastActiveRef = useRef(Date.now())
  const hiddenAtRef = useRef(null)
  const idleTimerRef = useRef(null)

  function lock() {
    setLocked(true)
  }

  function unlock() {
    lastActiveRef.current = Date.now()
    setLocked(false)
  }

  function armIdleTimer() {
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(lock, IDLE_LOCK_MINUTES * 60 * 1000)
  }

  useEffect(() => {
    if (!enabled) return

    function handleActivity() {
      lastActiveRef.current = Date.now()
      if (!locked) armIdleTimer()
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
        clearTimeout(idleTimerRef.current)
        return
      }
      const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
      hiddenAtRef.current = null
      if (hiddenFor > FORCE_SIGNOUT_HOURS * 60 * 60 * 1000) {
        onForceSignOut?.()
        return
      }
      if (hiddenFor > BACKGROUND_LOCK_MINUTES * 60 * 1000) {
        lock()
      } else {
        handleActivity()
      }
    }

    ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, handleActivity, { passive: true }))
    document.addEventListener('visibilitychange', handleVisibilityChange)
    armIdleTimer()

    return () => {
      ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, handleActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearTimeout(idleTimerRef.current)
    }
  }, [enabled, locked])

  return { locked, unlock }
}
