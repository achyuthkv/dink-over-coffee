import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.jsx'
import Logo from './Logo.jsx'

export default function Terms() {
  return (
    <div className="min-h-screen bg-bg-alt flex flex-col">

      {/* Nav */}
      <nav className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full pt-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-12 w-auto" />
        </Link>
        <ThemeToggle />
      </nav>

      {/* Content */}
      <main className="px-6 md:px-12 lg:px-20 max-w-3xl mx-auto w-full pt-10 pb-16">

        <div className="text-center mb-10">
          <h1 className="text-primary text-2xl md:text-3xl font-extrabold tracking-tight">
            Dink Over Coffee
          </h1>
          <p className="text-secondary text-lg md:text-xl font-bold mt-1">
            Community Guidelines & Meetup Policy
          </p>
        </div>

        {/* Welcome */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-3">Welcome to Dink Over Coffee</h2>
          <p className="text-muted text-sm leading-relaxed mb-3">
            Dink Over Coffee (DoC) is a pickleball + coffee community based in Jayanagar & Basavangudi, South Bengaluru. We are building a space around:
          </p>
          <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Enjoyable and inclusive games</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Meaningful conversations over coffee</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Consistent meetups through the week</li>
            <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />A welcoming and positive sporting culture</li>
          </ul>
          <p className="text-muted text-sm leading-relaxed mt-3">
            Whether you are a beginner trying pickleball for the first time or a regular player looking for good games and good company — you are welcome here.
          </p>
        </section>

        {/* 1. Community Behaviour Guidelines */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-4">1. Community Behaviour Guidelines</h2>
          <p className="text-muted text-sm leading-relaxed mb-4">
            To keep the community enjoyable for everyone, all members are expected to follow these guidelines:
          </p>

          <div className="space-y-5">
            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-2">Respect & Inclusion</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Treat everyone with respect, regardless of skill level or experience.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Encourage beginners and help create a welcoming atmosphere for new players.</li>
              </ul>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-2">Sportsmanship</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Maintain good on-court behaviour and healthy competition.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Avoid arguments, aggressive conduct, or negative interactions during games.</li>
              </ul>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-2">Communication</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Keep conversations relevant to pickleball and community activities.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Avoid spam, excessive forwarding, or unrelated promotions without admin approval.</li>
              </ul>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-2">Media & Privacy</h3>
              <p className="text-muted text-sm leading-relaxed">
                Media captured during meetups may be used for community building, including on our social media — not for any commercial purpose.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-2">Responsibility</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />RSVP honestly and attend sessions you sign up for.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Inform organizers as early as possible if you are unable to attend.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Arrive on time to help sessions run smoothly.</li>
              </ul>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-2">Community Culture</h3>
              <p className="text-muted text-sm leading-relaxed mb-2">We aim to keep this community:</p>
              <div className="flex flex-wrap gap-2">
                {['Low-noise', 'High-value', 'Friendly', 'Consistent', 'Fun'].map(tag => (
                  <span key={tag} className="inline-block bg-interactive/10 text-interactive text-xs font-medium px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Meetup Registration Process */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-4">2. Meetup Registration Process</h2>

          <div className="space-y-5">
            <div>
              <h3 className="text-primary text-sm font-semibold mb-2">How Meetups Are Shared</h3>
              <p className="text-muted text-sm leading-relaxed mb-2">
                Details of upcoming meetups are posted in the WhatsApp group and may include:
              </p>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Venue details</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Timing</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Number of slots available</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Meetup format (Casual / DUPR)</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Game format</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Sign-up and payment details</li>
              </ul>
            </div>

            <div>
              <h3 className="text-primary text-sm font-semibold mb-2">How to Sign Up</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Register using the process shared for that specific meetup.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Slots are confirmed only upon receipt of payment (where applicable).</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Registrations are accepted on a first-come, first-served basis due to limited availability.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-primary text-sm font-semibold mb-2">Waitlist</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed pl-4">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />If slots are full, players may be added to a waitlist.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Waitlisted players will be notified promptly if a slot becomes available.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Meetup Schedule */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-4">3. Meetup Schedule</h2>
          <p className="text-muted text-sm leading-relaxed mb-3">
            We generally meet on the following days:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {['Tuesday evenings', 'Thursday evenings', 'Sunday mornings'].map(day => (
              <div key={day} className="bg-surface rounded-xl p-4 border border-border text-center">
                <p className="text-primary text-sm font-semibold">{day}</p>
              </div>
            ))}
          </div>
          <p className="text-muted text-sm leading-relaxed">
            Session timings and slot availability will be shared in the WhatsApp group ahead of each meetup. The schedule may vary — always check the group for the latest updates.
          </p>
        </section>

        {/* 4. Cancellation & Refund Policy */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-4">4. Cancellation & Refund Policy</h2>

          <div className="space-y-5">
            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-3">Participant Cancellation</h3>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />If a registered player cancels, a refund is subject to another community member taking up the vacated slot.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Once a replacement is confirmed, the refund will be processed accordingly.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />If no replacement is found, the amount may not be refundable, as venue bookings and planning are made in advance.</li>
              </ul>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-3">Organizer Cancellation</h3>
              <p className="text-muted text-sm leading-relaxed mb-2">
                If a session is cancelled by the organizers due to any of the following, the full sign-up amount will be refunded within 24 hours:
              </p>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Rain or adverse weather conditions</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Venue-related issues</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Operational or safety concerns</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. Casual Games vs DUPR Games */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-4">5. Casual Games vs DUPR Games</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-3">Casual Games</h3>
              <p className="text-muted text-sm leading-relaxed mb-2">
                Casual sessions are designed for relaxed, social gameplay. These are ideal for:
              </p>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Meeting and playing with different members of the community</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Learning and improving your game</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Enjoying the sport without rating pressure</li>
              </ul>
              <p className="text-muted text-sm leading-relaxed mt-3">
                Players across skill levels may be grouped together to ensure balanced and enjoyable games.
              </p>
            </div>

            <div className="bg-surface rounded-2xl p-5 border border-border">
              <h3 className="text-primary text-sm font-semibold mb-3">DUPR Games</h3>
              <p className="text-muted text-sm leading-relaxed mb-2">
                DUPR sessions are more structured and rating-oriented. In these sessions:
              </p>
              <ul className="space-y-1.5 text-muted text-sm leading-relaxed">
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Players may be grouped based on their DUPR rating.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Match results may be recorded on the DUPR platform.</li>
                <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-interactive shrink-0 mt-1.5" />Players can track their progress and competitive level over time.</li>
              </ul>
              <p className="text-muted text-sm leading-relaxed mt-3">
                Both casual and DUPR formats are an integral part of our community calendar.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Community Links */}
        <section className="mb-10">
          <h2 className="text-primary text-lg font-bold mb-4">6. Community Links</h2>
          <p className="text-muted text-sm leading-relaxed mb-4">
            Stay connected and track your game through the following platforms:
          </p>

          <div className="space-y-3">
            <a href="https://www.instagram.com/dinkovercoffee" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-surface rounded-2xl p-4 border border-border active:scale-[.99] transition">
              <div className="w-10 h-10 rounded-xl bg-interactive/10 grid place-items-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary text-sm font-semibold">Instagram</p>
                <p className="text-muted text-xs">Follow us for updates, highlights, and community moments</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </a>

            <a href="https://dashboard.dupr.com/dashboard/club/4539630984/info" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-surface rounded-2xl p-4 border border-border active:scale-[.99] transition">
              <div className="w-10 h-10 rounded-xl bg-interactive/10 grid place-items-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary text-sm font-semibold">DUPR Club</p>
                <p className="text-muted text-xs">Log match results and track your rating</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </a>

            <a href="https://chat.whatsapp.com/CxCddkzBtqc2uARp4tcPDy?s=cl&p=i&mlu=3" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-surface rounded-2xl p-4 border border-border active:scale-[.99] transition">
              <div className="w-10 h-10 rounded-xl bg-interactive/10 grid place-items-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="rgb(var(--color-interactive))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-primary text-sm font-semibold">WhatsApp Community</p>
                <p className="text-muted text-xs">Receive meetup announcements and updates</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </div>
        </section>

        {/* Closing note */}
        <section className="text-center py-8 border-t border-border">
          <p className="text-muted text-[10px] uppercase tracking-[0.3em] mb-3">A note from the community curators</p>
          <p className="text-primary text-base md:text-lg font-bold leading-snug">
            Dink Over Coffee is more than just a sports group — it is a community built around good games, good people, and good coffee.
          </p>
          <p className="text-muted text-sm mt-3 leading-relaxed max-w-md mx-auto">
            We appreciate every member who contributes positively and helps make this space enjoyable for everyone.
          </p>
          <p className="text-secondary text-lg font-bold mt-5">See you on the court!</p>
        </section>

      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 lg:px-20 max-w-7xl mx-auto w-full py-6 mt-auto border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-auto" />
        </div>
        <p className="text-muted text-xs">Play. Connect. Belong.</p>
      </footer>

    </div>
  )
}
