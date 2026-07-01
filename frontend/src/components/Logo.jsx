const SHOW_LOGO = false

export default function Logo({ className = '' }) {
  if (!SHOW_LOGO) {
    return <span className="text-primary font-bold text-sm">Dink Over Coffee</span>
  }

  return (
    <>
      <img src="/logo-full.svg" alt="Dink Over Coffee" className={`dark:hidden ${className}`} />
      <img src="/logo-outline-full.svg" alt="Dink Over Coffee" className={`hidden dark:block ${className}`} />
    </>
  )
}
