export default function Logo({ className = '' }) {
  return (
    <>
      <img src="/logo-full.svg" alt="Dink Over Coffee" className={`dark:hidden ${className}`} />
      <img src="/logo-outline-full.svg" alt="Dink Over Coffee" className={`hidden dark:block ${className}`} />
    </>
  )
}
