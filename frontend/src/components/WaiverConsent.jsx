import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { api } from '../api.js'

const WAIVER_TEXT = `I acknowledge that participating in pickleball involves inherent risks including, but not limited to, physical injury, muscle strains, sprains, fractures, and other bodily harm. I voluntarily assume all risks associated with my participation.

I hereby release and hold harmless Dink Over Coffee, its organizers, venue owners, and all associated individuals from any and all liability for injuries, damages, or losses sustained during or as a result of my participation in any session.

I confirm that I am physically fit to participate and have no medical conditions that would prevent safe participation. I understand that I am responsible for my own safety and well-being during sessions.`

export default forwardRef(function WaiverConsent({ phone, name, onReady }, ref) {
  const [checking, setChecking] = useState(true)
  const [alreadySigned, setAlreadySigned] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const canvasReady = useRef(false)

  useImperativeHandle(ref, () => ({
    getSignature: () => {
      if (alreadySigned) return null
      if (!canvasRef.current) return null
      return canvasRef.current.toDataURL('image/png')
    }
  }))

  useEffect(() => {
    if (phone.length === 10) {
      setChecking(true)
      api.checkWaiver(phone).then(res => {
        if (res.signed) {
          setAlreadySigned(true)
          onReady(true)
        } else {
          setAlreadySigned(false)
          onReady(false)
        }
      }).catch(() => {
        setAlreadySigned(false)
        onReady(false)
      }).finally(() => setChecking(false))
    } else {
      setAlreadySigned(false)
      setChecking(false)
      onReady(false)
    }
  }, [phone])

  useEffect(() => {
    onReady(alreadySigned || (agreed && hasSignature))
  }, [agreed, hasSignature, alreadySigned])

  useEffect(() => {
    if (alreadySigned || checking || !agreed) return
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas || canvasReady.current) return
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      const ctx = canvas.getContext('2d')
      ctx.scale(2, 2)
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#003D30'
      canvasReady.current = true
    }, 50)
    return () => clearTimeout(timer)
  }, [alreadySigned, checking, agreed])

  function getPos(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
  }

  function startDraw(e) {
    e.preventDefault()
    setIsDrawing(true)
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e) {
    if (!isDrawing) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    if (!hasSignature) setHasSignature(true)
  }

  function stopDraw() {
    setIsDrawing(false)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    canvasReady.current = false
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#003D30'
    canvasReady.current = true
  }

  if (checking) return <p className="text-xs text-muted py-2">Checking waiver...</p>
  if (alreadySigned) return null

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <h3 className="text-text font-bold text-sm">Consent & Waiver</h3>
      <div className="mt-2 bg-surface-alt rounded-lg px-3 py-3 max-h-36 overflow-y-auto border border-border">
        <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">{WAIVER_TEXT}</p>
      </div>

      <label className="flex items-start gap-2 mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => setAgreed(e.target.checked)}
          className="accent-interactive mt-0.5 shrink-0"
        />
        <span className="text-xs text-primary">I have read and agree to the above waiver and consent to participate at my own risk.</span>
      </label>

      {agreed && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-primary">Signature</label>
            {hasSignature && (
              <button type="button" onClick={clearSignature} className="text-[11px] text-secondary underline">Clear</button>
            )}
          </div>
          <canvas
            ref={canvasRef}
            className="w-full h-24 rounded-lg border border-border bg-white cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <p className="text-[10px] text-muted mt-1">Draw your signature above</p>
        </div>
      )}
    </div>
  )
})
