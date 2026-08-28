import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createGardenCourtScene, beatOpacity } from '../lib/gardenCourtScene.js'
import { detectTier } from '../lib/heroSceneUtils.js'
import Logo from './Logo.jsx'
import NavTabs from './NavTabs.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const SCROLL_TRACK_VH = 420

// "Living Green" hero, fresh build (not a modification of
// CourtFlythroughHero): a scroll-scrubbed camera glides through a pickleball
// court that grows in from bare ground, past blooming fern/flower accents
// and drifting dust, to a pickleball flying in and landing on the kitchen
// line -- the site's own take on the moss-root/pale-flower/landing-creature
// brief. See gardenCourtScene.js for the scene itself.
export default function GardenCourtHero() {
  const wrapperRef = useRef(null)
  const canvasRef = useRef(null)
  const beatRefs = useRef({})
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !wrapper) return

    let scene
    try {
      scene = createGardenCourtScene(canvas, { tier: detectTier() })
    } catch {
      setUnsupported(true)
      return
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      const rect = wrapper.getBoundingClientRect()
      scene.setSize(rect.width, window.innerHeight)
    }
    resize()

    function applyBeats(progress) {
      Object.entries(beatRefs.current).forEach(([id, el]) => {
        if (!el) return
        el.style.opacity = String(beatOpacity(id, progress))
      })
    }

    function update() {
      const rect = wrapper.getBoundingClientRect()
      const total = wrapper.offsetHeight - window.innerHeight
      const progress = total > 0 ? Math.max(0, Math.min(1, -rect.top / total)) : 0
      scene.setProgress(reduceMotion ? 0.5 : progress)
      applyBeats(reduceMotion ? 0.5 : progress)
    }
    update()

    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', resize)

    const observer = new IntersectionObserver(
      entries => { entries.forEach(e => (e.isIntersecting ? scene.resume() : scene.pause())) },
      { rootMargin: '100% 0px 100% 0px' }
    )
    observer.observe(wrapper)

    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', resize)
      observer.disconnect()
      scene.dispose()
    }
  }, [])

  if (unsupported) {
    return (
      <div className="aurora relative h-screen flex items-center justify-center">
        <div className="mesh-blob mesh-blob-1" />
        <div className="mesh-blob mesh-blob-2" />
        <NavBar />
        <HeroCopy />
      </div>
    )
  }

  return (
    <div ref={wrapperRef} style={{ height: `${SCROLL_TRACK_VH}vh` }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <NavBar />
        <div className="relative z-10 h-full flex items-center justify-center px-6 text-center pointer-events-none">
          <HeroCopy beatRefs={beatRefs} />
        </div>
      </div>
    </div>
  )
}

function NavBar() {
  return (
    <nav className="absolute top-0 left-0 right-0 z-20 px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-[calc(env(safe-area-inset-top)+1.5rem)] flex flex-wrap items-center justify-between gap-3">
      <Link to="/" className="order-1 flex items-center gap-2.5">
        <Logo className="h-12 w-auto" />
      </Link>
      <div className="order-2 sm:order-3 flex items-center gap-2.5">
        <a href="https://www.instagram.com/dinkovercoffee" target="_blank" rel="noopener noreferrer" className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full border border-border/40 text-muted hover:text-primary hover:border-border transition" title="Instagram">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        </a>
        <ThemeToggle />
      </div>
      <div className="order-3 sm:order-2 w-full sm:w-auto flex justify-center">
        <NavTabs />
      </div>
    </nav>
  )
}

function HeroCopy({ beatRefs }) {
  const ref = id => el => { if (beatRefs) beatRefs.current[id] = el }
  return (
    <div className="max-w-2xl">
      <p ref={ref('eyebrow')} className="text-interactive text-xs font-semibold uppercase tracking-[0.2em] mb-4 transition-opacity duration-300" style={{ opacity: beatRefs ? 0 : 1 }}>
        Find your court. Build your crew.
      </p>
      <div ref={ref('headline')} className="transition-opacity duration-300" style={{ opacity: beatRefs ? 0 : 1 }}>
        <h1 className="text-primary text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-tight">The game brings you here.</h1>
        <h1 className="text-secondary text-[clamp(2.2rem,6vw,4rem)] font-extrabold leading-[1.02] tracking-tight">The people make you stay.</h1>
      </div>
      <p ref={ref('subcopy')} className="mt-6 text-muted text-base md:text-lg leading-relaxed transition-opacity duration-300" style={{ opacity: beatRefs ? 0 : 1 }}>
        Bangalore's pickleball community. Sessions every week in Jayanagar. All levels. No partner needed. Just show up.
      </p>
      <div ref={ref('cta')} className="mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3 justify-center pointer-events-auto transition-opacity duration-300" style={{ opacity: beatRefs ? 0 : 1 }}>
        <Link to="/events" className="btn-liquid-metal inline-flex items-center justify-center gap-2 rounded-full text-inverse px-8 py-4 text-sm font-semibold active:scale-[.98] transition ease-spring w-full sm:w-auto">
          Book a Session
        </Link>
        <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="glass inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-medium text-primary active:scale-[.98] transition ease-spring hover:bg-surface/80 w-full sm:w-auto">
          Join Community
        </a>
        <Link to="/shop" className="glass inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-medium text-primary active:scale-[.98] transition ease-spring hover:bg-surface/80 w-full sm:w-auto">
          Shop Merch
        </Link>
      </div>
    </div>
  )
}
