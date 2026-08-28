// Shared helpers for scroll-scrubbed WebGL hero scenes (courtScene.js,
// gardenCourtScene.js) -- theme/device detection and the scroll-progress ->
// opacity math used to stage overlay text as fading beats.

export function bgColorRGB() {
  const isDark = document.documentElement.classList.contains('dark')
  return isDark ? '10 20 16' : '234 254 246'
}

export function rgbStringToHex(rgbStr) {
  const [r, g, b] = rgbStr.split(' ').map(Number)
  return (r << 16) | (g << 8) | b
}

export function bandOpacity(t, start, end, fade = 0.06) {
  if (t <= start || t >= end) return 0
  const fadeIn = Math.min(1, (t - start) / fade)
  const fadeOut = Math.min(1, (end - t) / fade)
  return Math.max(0, Math.min(fadeIn, fadeOut))
}

export function makeBeatOpacity(beats) {
  return function beatOpacity(id, t) {
    const beat = beats.find(b => b.id === id)
    if (!beat) return 0
    return bandOpacity(t, beat.start, beat.end)
  }
}

export function detectTier() {
  if (typeof window === 'undefined') return 'high'
  const width = window.innerWidth
  const cores = navigator.hardwareConcurrency || 4
  if (width < 640 || cores <= 4) return 'low'
  if (width < 1024 || cores <= 6) return 'mid'
  return 'high'
}

// Ease-out-bounce, for the pickleball's landing beat -- a couple of
// diminishing bounces rather than a hard linear stop.
export function easeOutBounce(t) {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}
