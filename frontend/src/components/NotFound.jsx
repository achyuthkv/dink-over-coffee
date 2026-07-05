import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-alt flex flex-col items-center justify-center px-6 text-center">
      <Logo className="h-14 w-auto mb-6" />
      <h1 className="text-primary text-5xl font-extrabold">404</h1>
      <p className="text-muted text-sm mt-2 mb-6">This page doesn't exist. Maybe it was a fault — let's call a re-serve.</p>
      <div className="flex gap-3">
        <Link to="/" className="inline-flex items-center rounded-full bg-interactive text-inverse px-5 py-2.5 text-sm font-semibold active:scale-[.98] transition">
          Go Home
        </Link>
        <Link to="/events" className="inline-flex items-center rounded-full border-2 border-border text-primary px-5 py-2.5 text-sm font-medium active:scale-[.98] transition">
          Book a Session
        </Link>
      </div>
    </div>
  )
}
