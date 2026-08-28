import * as THREE from 'three'
import { bgColorRGB, rgbStringToHex, makeBeatOpacity, easeOutBounce } from './heroSceneUtils.js'

// "Living Green" hero, adapted from a moss-root/pale-flower/fern/drifting-
// pollen/landing-creature brief to a pickleball court: the turf grows in
// from the center as roots spreading outward, fern/flower accents planted
// along the sidelines bloom in as the camera passes them, dust motes drift
// through the air, and a pickleball flies in to land on the kitchen line as
// the hero's "landing" beat. Same proportions as courtScene.js (1 unit = 1
// foot) so the two scenes read as the same court.
const COURT_WIDTH = 20
const COURT_LENGTH = 44
const KITCHEN_DEPTH = 7
const NET_HEIGHT = 3
const NET_Z = COURT_LENGTH / 2
const LANDING_Z = NET_Z - KITCHEN_DEPTH / 2

const KEYFRAMES = [
  { pos: [0, 12, -16], look: [0, 1, 10] },
  { pos: [-5, 5, 6], look: [0, 1, 20] },
  { pos: [4, 3, LANDING_Z - 6], look: [0, 0.5, LANDING_Z] },
  { pos: [0, 6, LANDING_Z + 8], look: [0, 1, LANDING_Z] },
  { pos: [0, 9, 50], look: [0, 1.5, 28] }
]

// Beat windows: reveal (turf growing in) leads, then headline/subcopy read
// the same as the flythrough hero, the ball lands mid-scroll, CTA settles
// at the end.
const TEXT_BEATS = [
  { id: 'eyebrow', start: -0.1, end: 0.16 },
  { id: 'headline', start: 0.12, end: 0.42 },
  { id: 'subcopy', start: 0.4, end: 0.62 },
  { id: 'cta', start: 0.7, end: 1.04 }
]
export { TEXT_BEATS }
export const beatOpacity = makeBeatOpacity(TEXT_BEATS)

// The ball's flight-and-landing window, as a fraction of total scroll.
const LANDING_START = 0.44
const LANDING_END = 0.6

function makeGroundTexture(tier) {
  const size = tier === 'low' ? 512 : 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size * (COURT_LENGTH / COURT_WIDTH)
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height

  ctx.fillStyle = '#0d7a5f'
  ctx.fillRect(0, 0, w, h)

  const lw = Math.max(2, w * 0.008)
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = lw
  ctx.strokeRect(lw / 2, lw / 2, w - lw, h - lw)

  const netY = h / 2
  ctx.beginPath(); ctx.moveTo(0, netY); ctx.lineTo(w, netY); ctx.stroke()
  const kitchenPx = (KITCHEN_DEPTH / COURT_LENGTH) * h
  ;[netY - kitchenPx, netY + kitchenPx].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  })
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
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 2
  for (let i = 0; i <= size; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(COURT_WIDTH / 2, 2)
  return texture
}

// A small stylized fern/flower silhouette, canvas-drawn so it's a real
// sprite rather than geometry -- one texture, reused across every planted
// accent, alpha-tested so it reads as a cutout rather than a card.
function makeFoliageTexture(kind) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.translate(size / 2, size)
  if (kind === 'fern') {
    ctx.strokeStyle = '#1f4d3a'
    ctx.lineWidth = 3
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 1; i <= 6; i++) {
        const t = i / 6
        ctx.beginPath()
        ctx.moveTo(0, -t * size * 0.85)
        ctx.quadraticCurveTo(side * 10 * t, -t * size * 0.85 - 8, side * 22 * t, -t * size * 0.85 + 6)
        ctx.stroke()
      }
    }
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -size * 0.9); ctx.stroke()
  } else {
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(1, -size * 0.55); ctx.lineTo(-1, -size * 0.55); ctx.closePath()
    ctx.fillStyle = '#2e6b4f'
    ctx.fill()
    const petals = 5
    ctx.fillStyle = '#eaf7ee'
    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(Math.cos(angle) * 12, -size * 0.55 + Math.sin(angle) * 12, 9, 14, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#f6e27a'
    ctx.beginPath(); ctx.arc(0, -size * 0.55, 6, 0, Math.PI * 2); ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

function makeBallTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f3f7a0'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  const holes = [[30, 30], [64, 22], [98, 34], [22, 64], [64, 64], [104, 66], [30, 98], [64, 104], [98, 96]]
  holes.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill() })
  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

const REVEAL_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const REVEAL_FRAG = `
  uniform sampler2D uMap;
  uniform vec3 uBare;
  uniform float uReveal;
  varying vec2 vUv;

  // Cheap value noise so the growth edge reads as organic roots, not a
  // perfect circle.
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered * vec2(1.0, 2.2));
    float wobble = noise(floor(vUv * 24.0)) * 0.08;
    float edge = smoothstep(uReveal - 0.06, uReveal + 0.06, dist - wobble);
    vec3 grown = texture2D(uMap, vUv).rgb;
    vec3 color = mix(grown, uBare, edge);
    gl_FragColor = vec4(color, 1.0);
  }
`

export function createGardenCourtScene(canvas, { tier = 'high' } = {}) {
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
  scene.fog = new THREE.Fog(bgHex, 18, 65)

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)

  const backdropGeo = new THREE.PlaneGeometry(220, 220)
  const backdropMat = new THREE.MeshStandardMaterial({ color: bgHex, roughness: 1 })
  const backdrop = new THREE.Mesh(backdropGeo, backdropMat)
  backdrop.rotation.x = -Math.PI / 2
  backdrop.position.y = -0.03
  scene.add(backdrop)

  // Court surface with the shader-driven "growing in" reveal
  const groundTexture = makeGroundTexture(tier)
  const bareColor = new THREE.Color(bgHex)
  const revealUniforms = {
    uMap: { value: groundTexture },
    uBare: { value: bareColor },
    uReveal: { value: 0 }
  }
  const courtGeo = new THREE.PlaneGeometry(COURT_WIDTH, COURT_LENGTH, 1, 1)
  const courtMat = new THREE.ShaderMaterial({
    uniforms: revealUniforms,
    vertexShader: REVEAL_VERT,
    fragmentShader: REVEAL_FRAG
  })
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const sun = new THREE.DirectionalLight(0xffffff, 0.85)
  sun.position.set(-8, 18, -8)
  scene.add(sun)

  // Fern/flower accents planted along both sidelines, each blooming in
  // (scale 0 -> 1) once the camera's own progress along the court passes it.
  const foliage = []
  if (tier !== 'low') {
    const fernTex = makeFoliageTexture('fern')
    const flowerTex = makeFoliageTexture('flower')
    const spots = [
      { z: 4, side: -1, kind: 'fern' }, { z: 8, side: 1, kind: 'flower' },
      { z: 14, side: -1, kind: 'flower' }, { z: 18, side: 1, kind: 'fern' },
      { z: 30, side: -1, kind: 'fern' }, { z: 34, side: 1, kind: 'flower' },
      { z: 40, side: -1, kind: 'flower' }, { z: 42, side: 1, kind: 'fern' }
    ]
    spots.forEach(({ z, side, kind }) => {
      const mat = new THREE.SpriteMaterial({ map: kind === 'fern' ? fernTex : flowerTex, transparent: true })
      const sprite = new THREE.Sprite(mat)
      sprite.position.set(side * (COURT_WIDTH / 2 + 1.2), 0.9, z)
      sprite.scale.set(0, 0, 0)
      sprite.userData.triggerZ = z - 6
      sprite.userData.maxScale = kind === 'fern' ? 2.4 : 1.6
      scene.add(sprite)
      foliage.push(sprite)
    })
  }

  // Drifting dust/pollen motes
  let dust = null
  if (tier !== 'low') {
    const count = tier === 'high' ? 260 : 140
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (COURT_WIDTH + 10)
      positions[i * 3 + 1] = Math.random() * 10 + 0.5
      positions[i * 3 + 2] = Math.random() * COURT_LENGTH
    }
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const dustMat = new THREE.PointsMaterial({ color: 0xeaf7d8, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false })
    dust = new THREE.Points(dustGeo, dustMat)
    scene.add(dust)
  }

  // The pickleball that flies in and lands on the kitchen line
  const ballGeo = new THREE.SphereGeometry(0.4, tier === 'low' ? 10 : 16, tier === 'low' ? 10 : 16)
  const ballMat = new THREE.MeshStandardMaterial({ map: makeBallTexture(), roughness: 0.55 })
  const ball = new THREE.Mesh(ballGeo, ballMat)
  const ballStart = new THREE.Vector3(-6, 9, LANDING_Z - 5)
  const ballLand = new THREE.Vector3(0, 0.4, LANDING_Z)
  ball.position.copy(ballStart)
  scene.add(ball)

  const curve = new THREE.CatmullRomCurve3(KEYFRAMES.map(k => new THREE.Vector3(...k.pos)))
  const lookCurve = new THREE.CatmullRomCurve3(KEYFRAMES.map(k => new THREE.Vector3(...k.look)))

  let progress = 0
  let running = true
  let rafId = null
  const clock = new THREE.Clock()

  function updateBall(t) {
    if (t <= LANDING_START) {
      ball.position.copy(ballStart)
      ball.scale.setScalar(1)
      return
    }
    if (t >= LANDING_END) {
      ball.position.copy(ballLand)
      return
    }
    const local = (t - LANDING_START) / (LANDING_END - LANDING_START)
    ball.position.lerpVectors(ballStart, ballLand, Math.min(1, local * 1.15))
    if (local > 0.75) {
      const bounce = easeOutBounce(Math.min(1, (local - 0.75) / 0.25))
      ball.position.y = ballLand.y + (1 - bounce) * 0.6
    }
    ball.rotation.x += 0.05
    ball.rotation.z += 0.03
  }

  function updateFoliage(t) {
    const cameraZ = camera.position.z
    foliage.forEach(sprite => {
      const target = cameraZ > sprite.userData.triggerZ ? sprite.userData.maxScale : 0
      const current = sprite.scale.x
      const next = current + (target - current) * 0.08
      sprite.scale.set(next, next, next)
    })
  }

  function frame() {
    if (!running) return
    const t = Math.max(0, Math.min(1, progress))
    const pos = curve.getPoint(t)
    const look = lookCurve.getPoint(t)
    camera.position.copy(pos)
    camera.lookAt(look)

    // Turf grows in over the first quarter of the scroll, roots spreading
    // outward from center court.
    const revealTarget = Math.min(1, Math.max(0, (t + 0.12) / 0.3))
    revealUniforms.uReveal.value += (revealTarget * 1.3 - revealUniforms.uReveal.value) * 0.1

    updateFoliage(t)
    updateBall(t)

    if (dust) {
      const elapsed = clock.getElapsedTime()
      const posAttr = dust.geometry.attributes.position
      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i)
        posAttr.setY(i, y + Math.sin(elapsed * 0.4 + i) * 0.0015 + 0.0008)
        if (posAttr.getY(i) > 11) posAttr.setY(i, 0.5)
      }
      posAttr.needsUpdate = true
    }

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
      backdropGeo.dispose(); backdropMat.dispose()
      courtGeo.dispose(); courtMat.dispose(); groundTexture.dispose()
      netGeo.dispose(); netMat.dispose()
      postGeo.dispose(); postMat.dispose()
      ballGeo.dispose(); ballMat.dispose()
      foliage.forEach(s => { s.material.map?.dispose(); s.material.dispose() })
      if (dust) { dust.geometry.dispose(); dust.material.dispose() }
      renderer.dispose()
    }
  }
}
