import * as THREE from 'three'

// A pickleball court, built entirely from primitives + canvas-drawn textures
// (no model assets to ship or load) at roughly real-world proportions: 20ft
// wide x 44ft long, kitchen (non-volley zone) 7ft off the net each side, net
// at center court. 1 unit = 1 foot.
const COURT_WIDTH = 20
const COURT_LENGTH = 44
const KITCHEN_DEPTH = 7
const NET_HEIGHT = 3
const NET_Z = COURT_LENGTH / 2

// Camera flythrough keyframes, parameterized 0..1: an establishing drone
// shot behind the baseline, descending down the length of the court,
// skimming low over the net, then rising to a settled finishing shot at
// the far end -- classic sports-cinematic beats, not an arbitrary path.
const KEYFRAMES = [
  { pos: [0, 15, -20], look: [0, 0, 12] },
  { pos: [4, 7, 4], look: [0, 1, 24] },
  { pos: [-3, 2.4, NET_Z], look: [0, 1.6, NET_Z + 10] },
  { pos: [3, 4.5, 34], look: [0, 2, 46] },
  { pos: [0, 9, 54], look: [0, 1.5, 30] }
]

function courtColorLight() { return getComputedStyle(document.documentElement).getPropertyValue('--color-brand-500').trim() || '5 173 134' }
function bgColorRGB() {
  const isDark = document.documentElement.classList.contains('dark')
  return isDark ? '10 20 16' : '234 254 246'
}

function rgbStringToHex(rgbStr) {
  const [r, g, b] = rgbStr.split(' ').map(Number)
  return (r << 16) | (g << 8) | b
}

function makeCourtTexture(tier) {
  const size = tier === 'low' ? 512 : 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size * (COURT_LENGTH / COURT_WIDTH)
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  ctx.fillStyle = '#0a6b52'
  ctx.fillRect(0, 0, w, h)

  const lineColor = 'rgba(255,255,255,0.92)'
  const lw = Math.max(2, w * 0.008)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = lw

  // Outer boundary
  ctx.strokeRect(lw / 2, lw / 2, w - lw, h - lw)

  // Net line at center
  const netY = h / 2
  ctx.beginPath(); ctx.moveTo(0, netY); ctx.lineTo(w, netY); ctx.stroke()

  // Kitchen lines, 7ft off the net each side
  const kitchenPx = (KITCHEN_DEPTH / COURT_LENGTH) * h
  ;[netY - kitchenPx, netY + kitchenPx].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  })

  // Center service line, from each kitchen line to each baseline
  const midX = w / 2
  ctx.beginPath()
  ctx.moveTo(midX, 0); ctx.lineTo(midX, netY - kitchenPx)
  ctx.moveTo(midX, h); ctx.lineTo(midX, netY + kitchenPx)
  ctx.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function makeNetTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  const step = 16
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(COURT_WIDTH / 2, 2)
  return texture
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function bandOpacity(t, start, end, fade = 0.06) {
  if (t <= start || t >= end) return 0
  const fadeIn = Math.min(1, (t - start) / fade)
  const fadeOut = Math.min(1, (end - t) / fade)
  return Math.max(0, Math.min(fadeIn, fadeOut))
}

// Beat windows for the overlay text, expressed as scroll-progress ranges.
export const TEXT_BEATS = [
  { id: 'eyebrow', start: -0.1, end: 0.16 },
  { id: 'headline', start: 0.12, end: 0.42 },
  { id: 'subcopy', start: 0.4, end: 0.68 },
  { id: 'cta', start: 0.66, end: 1.04 }
]

export function beatOpacity(id, t) {
  const beat = TEXT_BEATS.find(b => b.id === id)
  if (!beat) return 0
  return bandOpacity(t, beat.start, beat.end)
}

export function createCourtScene(canvas, { tier = 'high' } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: tier === 'high',
    alpha: false,
    powerPreference: tier === 'low' ? 'low-power' : 'high-performance'
  })
  const dpr = tier === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, tier === 'mid' ? 1.5 : 2)
  renderer.setPixelRatio(dpr)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const bgHex = rgbStringToHex(bgColorRGB())
  scene.background = new THREE.Color(bgHex)
  scene.fog = new THREE.Fog(bgHex, 20, 70)

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)

  // Ground plane extending past the court
  const groundGeo = new THREE.PlaneGeometry(200, 200)
  const groundMat = new THREE.MeshStandardMaterial({ color: bgHex, roughness: 1 })
  const ground = new THREE.Mesh(groundGeo, groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  scene.add(ground)

  // Court surface
  const courtTexture = makeCourtTexture(tier)
  const courtGeo = new THREE.PlaneGeometry(COURT_WIDTH, COURT_LENGTH)
  const courtMat = new THREE.MeshStandardMaterial({ map: courtTexture, roughness: 0.85 })
  const court = new THREE.Mesh(courtGeo, courtMat)
  court.rotation.x = -Math.PI / 2
  court.position.set(0, 0, COURT_LENGTH / 2)
  scene.add(court)

  // Net + posts
  const netGeo = new THREE.PlaneGeometry(COURT_WIDTH + 2, NET_HEIGHT)
  const netMat = new THREE.MeshBasicMaterial({ map: makeNetTexture(), transparent: true, side: THREE.DoubleSide })
  const net = new THREE.Mesh(netGeo, netMat)
  net.position.set(0, NET_HEIGHT / 2, NET_Z)
  scene.add(net)

  const postGeo = new THREE.CylinderGeometry(0.15, 0.15, NET_HEIGHT + 0.3, tier === 'low' ? 6 : 10)
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1a2e26, roughness: 0.6 })
  ;[-COURT_WIDTH / 2 - 1, COURT_WIDTH / 2 + 1].forEach(x => {
    const post = new THREE.Mesh(postGeo, postMat)
    post.position.set(x, (NET_HEIGHT + 0.3) / 2, NET_Z)
    scene.add(post)
  })

  // Lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.65))
  const sun = new THREE.DirectionalLight(0xffffff, 0.9)
  sun.position.set(-10, 20, -10)
  scene.add(sun)

  // A few floating pickleball props for depth/parallax as the camera passes
  const balls = []
  if (tier !== 'low') {
    const ballGeo = new THREE.SphereGeometry(0.35, 12, 12)
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xf3f7a0, roughness: 0.5 })
    const ballPositions = [[-7, 3, 8], [8, 4.5, 18], [-6, 2.5, 30], [6, 5, 40]]
    ballPositions.forEach(([x, y, z]) => {
      const ball = new THREE.Mesh(ballGeo, ballMat)
      ball.position.set(x, y, z)
      scene.add(ball)
      balls.push(ball)
    })
  }

  const curve = new THREE.CatmullRomCurve3(KEYFRAMES.map(k => new THREE.Vector3(...k.pos)))
  const lookCurve = new THREE.CatmullRomCurve3(KEYFRAMES.map(k => new THREE.Vector3(...k.look)))

  let progress = 0
  let running = true
  let rafId = null
  const clock = new THREE.Clock()

  function frame() {
    if (!running) return
    const t = Math.max(0, Math.min(1, progress))
    const pos = curve.getPoint(t)
    const look = lookCurve.getPoint(t)
    camera.position.copy(pos)
    camera.lookAt(look)

    const elapsed = clock.getElapsedTime()
    balls.forEach((ball, i) => {
      ball.position.y += Math.sin(elapsed * 1.5 + i) * 0.002
      ball.rotation.x += 0.01
      ball.rotation.y += 0.015
    })

    renderer.render(scene, camera)
    rafId = requestAnimationFrame(frame)
  }
  frame()

  return {
    setProgress(t) { progress = t },
    setSize(width, height) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    },
    pause() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      rafId = null
    },
    resume() {
      if (running) return
      running = true
      frame()
    },
    dispose() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      groundGeo.dispose(); groundMat.dispose()
      courtGeo.dispose(); courtMat.dispose(); courtTexture.dispose()
      netGeo.dispose(); netMat.dispose()
      postGeo.dispose(); postMat.dispose()
      balls.forEach(b => { b.geometry.dispose(); b.material.dispose() })
      renderer.dispose()
    }
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
