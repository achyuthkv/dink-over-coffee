import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { api } from '../api.js'

const WAIVER_TEXT = `DISCLAIMER & WAIVER
Dink Over Coffee

Use of the facilities, equipment, courts, premises, sessions, and services of Dink Over Coffee is entirely at the sole risk of the participant or visitor.

All persons participating in sessions are required to ensure that they are medically and physically fit to undertake exercise, training, and related physical activity. Dink Over Coffee does not provide medical advice and shall not be responsible for any injury, illness, health complication, aggravation of any pre-existing condition, physical strain, disability, or other adverse consequence arising from participation in any session, activity, or use of equipment.

All participants and visitors are required to strictly follow the instructions, guidance, demonstrations, warnings, and safety directions given by the organizers, coaches, and staff of Dink Over Coffee at all times. Dink Over Coffee shall not be held liable or responsible for any injury, loss, damage, accident, or claim arising directly or indirectly from any failure, refusal, neglect, or omission on the part of any participant or visitor to follow such instructions, or from the use of equipment or performance of activities contrary to the advice of the organizers or staff.

Use of pickleball equipment, paddles, nets, courts, and other facilities must be undertaken carefully and only for their intended purpose. Any misuse of equipment, unsafe conduct, reckless behaviour, overexertion, or participation beyond one's physical limits shall be entirely at the user's own risk.

In the event of any dispute, altercation, clash, misconduct, or inappropriate behaviour between participants or visitors within the premises during a Dink Over Coffee session, the organizers reserve the right, but shall not be under any obligation, to intervene, de-escalate the situation, remove the persons involved, or take such action as deemed necessary in the interest of safety, discipline, and order. Dink Over Coffee shall not be responsible or liable for any injury, loss, damage, or claim arising out of or in connection with any such incident between participants or visitors.

Any dispute, altercation, clash, or incident occurring outside the session premises, including between participants, visitors, or staff, shall be entirely outside the scope of responsibility of Dink Over Coffee, and the organizers shall bear no liability whatsoever in relation to the same.

Any participant or visitor who intentionally, wilfully, or negligently causes damage to any equipment, courts, fixtures, fittings, or any other property shall be solely liable to pay the full cost of repair or replacement of such damaged property, as determined by the venue or Dink Over Coffee.

Personal belongings, including cash, jewellery, bags, mobile phones, and other valuables, are brought into the premises entirely at the owner's risk, and Dink Over Coffee shall not be responsible for any loss, theft, or damage to such belongings.

To the fullest extent permitted under applicable law, Dink Over Coffee, its organizers, venue owners, coaches, employees, staff, and representatives disclaim any liability for any direct, indirect, incidental, or consequential loss, injury, damage, or expense suffered by any person in connection with the use of the session, its facilities, services, or premises.

Electronic Signature Consent

By drawing your signature on the device screen, you acknowledge that the signature constitutes a valid electronic signature under Section 3A of the Information Technology Act, 2000, and is equivalent to a handwritten signature for the purposes of this disclaimer. The signature, together with the metadata recorded at the time of signing (date, time, device information), forms a complete electronic record of your acceptance of these terms.

Data Processing Consent

By signing this disclaimer, you provide your free, specific, informed, and unambiguous consent under Section 6 of the Digital Personal Data Protection Act, 2023 for Dink Over Coffee to collect, store, and process your personal data — including your name, phone number, email (if provided), signature image, and device information — for the purposes of session administration, audit, fraud prevention, and legal record-keeping. You may withdraw this consent at any time by writing to us, subject to our continuing right to retain data necessary to defend any legal claim or to comply with applicable law.

Privacy Notice

Our full privacy notice — what we collect, why we collect it, how long we keep it, and your rights — is available at our Privacy Policy page. Please read it alongside this disclaimer.`

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
      <h3 className="text-text font-bold text-sm">Disclaimer & Waiver</h3>
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
