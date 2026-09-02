# Dink Over Coffee

Mobile-first session registration for the Dink Over Coffee pickleball community.

- **Frontend:** Vite + React + Tailwind, deployed on Vercel as a static SPA (with an `/admin` area for organizers).
- **Backend:** Vercel serverless functions (`api/*.js`) backed by a Supabase (Postgres) database.
- **Auth:** Supabase Auth — organizers sign in to reach `/admin`; admin-only API routes check the bearer token.
- **Payments:** Razorpay — server-side orders, signature verified before a slot is confirmed. Optional per-deployment: if `VITE_RAZORPAY_KEY_ID` isn't set, the frontend falls back to free registration (`register`/`waitlist`) instead of the paid checkout flow.
- **Email:** Resend, for booking confirmations (with an .ics calendar attachment) and organizer broadcast emails.
- **Concurrency:** Hold-then-confirm for paid sessions. A slot is held for `HOLD_TTL_MINUTES` (default 5) when checkout starts; expired holds free up automatically. Free registrations use an insert-then-verify pattern (`atomicRegister`) to avoid overbooking under concurrent requests.

> `apps-script/Code.gs` is an early, unused prototype of a Google Apps Script + Sheets backend. It predates the current Supabase/Vercel backend and isn't wired into the app — ignore it unless you're specifically reviving that approach.

## Repo layout

```
frontend/          Vite + React + Tailwind app (public booking flow + /admin)
  src/
    components/     Public-facing pages (Landing, RegisterTab, PlayersTab, ...)
    admin/          Organizer dashboard (sessions, players, venues, UPI accounts, waivers, finances)
    api.js          Thin fetch wrapper around the /api/* endpoints
    supabase.js     Browser Supabase client (anon key)
api/                Vercel serverless functions — one file per route (Vercel's Hobby plan caps the function count at 12, and this repo is at that cap, so routes are consolidated with an `action` field where it makes sense, e.g. `waiver.js`, `shop.js`, `membership.js`. Adding another net-new route needs either another consolidation or a plan upgrade)
  _lib/             Shared server helpers (supabase client, slot counting, atomic register, Razorpay, rate limiting, email) — underscore prefix excludes these from Vercel's function count
  _dev-server.js    Minimal local HTTP server that mounts api/*.js for `npm run dev:api` — underscore-prefixed so it isn't deployed as its own function
apps-script/        Legacy/unused Apps Script prototype — not part of the current stack
tests/              Vitest tests for the api/ handlers
vercel.json         Vercel build + routing config
```

## Setup

### 1. Supabase project

Create a Supabase project and set up (at minimum) these tables — inferred from the API code, since there's no migrations folder in this repo yet:

- **sessions** — `id, date, time, venue, price, max_slots, waitlist_max, beginner_slots, beginner_waitlist_max, active, title, description, event_type, venue_id`
  - `event_type` is one of `regular`, `dupr`, `dupr_doubles`, `dupr_teams` — controls whether DUPR IDs / partner fields are required.
  - `beginner_slots` / `beginner_waitlist_max` are nullable — leave null for sessions that don't split capacity by skill.
- **players** — `id, session_id, name, phone, email, skill, dupr_id, partner_name, partner_phone, partner_dupr_id, needs_partner, amount, razorpay_payment_id, razorpay_order_id, status (confirmed|waitlisted), created_at`
- **holds** — `id, session_id, razorpay_order_id, expires_at, status (active|consumed), slots`
- **venues** — `id, name, address, google_maps_url`
- **upi_accounts** — `id, label, upi_id, qr_image_url`. RLS-locked to `authenticated` only (organizer, via `/admin` → Manage → Payment Methods) — no anon policy at all, since public pages never query it directly; they get UPI details through server-side API routes using the service role key instead.
- **session_upis** — `session_id, upi_account_id, sort_order` (join table for per-session UPI display). Same RLS lockdown as `upi_accounts`, for the same reason.
- **waivers** — `id, phone, name, signature, signed_at`
- **products** — `id, name, description, price, mrp (numeric, nullable), images (text[], nullable), sizes (text[], nullable), stock (integer, nullable — null means unlimited), category, active, created_at`. Managed directly in Supabase for now; there's no admin UI for it yet. `mrp` is optional — when set above `price`, the shop shows it struck through next to the discounted price with a computed `% off` badge; leave it null (or equal to `price`) for no discount. `images` holds one or more URLs (e.g. `{https://.../front.jpg,https://.../back.jpg}`); with more than one, the shop shows a swipeable carousel with dot indicators — with zero or one, it's a plain image (or the placeholder icon).
- **shop_holds** — `id, razorpay_order_id, items (jsonb snapshot of the cart), customer (jsonb), amount, expires_at, status (active|consumed)`. Mirrors `holds` for the shop checkout — reserves stock while a Razorpay payment is in flight.
- **shop_orders** — `id, customer_name, phone, email, address, city, pincode, amount, currency, razorpay_order_id, razorpay_payment_id, items (jsonb), created_at`, plus two independent state machines:
  - `payment_status` (`pending|paid|refunded`) — `pending` means the buyer chose to pay manually via UPI (no Razorpay key configured) or hasn't paid yet; `paid` means Razorpay verified the payment, or an organizer marked a manual order as paid in `/admin`.
  - `order_status` (`placed|confirmed|packed|shipped|delivered|cancelled`) — the fulfillment pipeline, advanced by an organizer in `/admin`, with a timestamp column per stage (`confirmed_at`, `packed_at`, `shipped_at`, `delivered_at`, `cancelled_at`) plus `cancellation_reason`, `shipping_carrier`, `tracking_number`, `tracking_url`.
- **tournaments** — `id, name, description, status (setup|active|completed), session_id (nullable, references sessions), created_at`. Generic — not tied to any one event's team/court count. `setup` is hidden from the public `/tournament` page (organizers can stage teams and fixtures before anything's visible); `active` and `completed` are public. `/tournament` shows whichever `active` tournament is newest, falling back to the newest `completed` one so results linger after an event ends. `session_id` links a tournament back to the `sessions` row its registrations came from (e.g. a DUPR-teams event people signed up for via `/events`) and drives the auto-sync described below.
- **tournament_courts** — `id, tournament_id, name, sort_order, created_at`. A "court" is both the physical court and the round-robin pool of teams playing on it.
- **tournament_teams** — `id, tournament_id, court_id (nullable), name, player1_name, player2_name, source_player_id (nullable, references players), created_at`. `source_player_id` marks a team as auto-synced from a session registration (see below); teams added by hand in `/admin` leave it null.
- **tournament_matches** — `id, tournament_id, court_id (nullable — null for semifinal/final), stage (round_robin|semifinal|final), match_number, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id, status (scheduled|completed), created_at`.
- **members** — `id, user_id (references auth.users, set once a member signs in via WhatsApp OTP), phone (unique), name, email, dupr_id, tshirt_size, plan, status (pending_payment|active|expired|cancelled), start_date, end_date, rollover_cap, whatsapp_opt_in, razorpay_order_id, razorpay_payment_id, created_at`.
- **membership_credits** — a ledger, not a bare counter: `id, member_id, session_id (nullable), delta, reason (declined_monday|declined_wednesday|redeemed|admin_adjustment), created_at`. A member's rollover balance is `sum(delta)`, capped at `rollover_cap` when a credit is earned.
- **sessions** gains `member_reserved_slots` (nullable int, same shape as `beginner_slots` — capacity carved out of `max_slots` for members) and `is_member_slot` (boolean, flags the standing Monday/Wednesday session admins want auto-reserved for members).
- **players** gains `member_id` (nullable, references `members`) and `attended` (nullable boolean, set by an organizer in `/admin` — independent of the credit ledger, purely an attendance record).
- **membership_settings** — a single-row table (`id` is always `true`) holding `capacity`: the number of *active* memberships the club is currently accepting, admin-editable from `/admin` → Manage → Memberships. Defaults to `0` (closed) until an organizer opens it.
- **membership_waitlist** — `id, name, phone, email, converted (bool), created_at`. Lead capture for "membership is full right now, notify me" — no login required to submit; only written server-side (`api/membership.js`), so there's no public insert RLS policy on it.

Optional: a Postgres function `atomic_register(p_session_id, p_name, p_phone, p_email, p_skill, p_amount, p_status, p_dupr_id, p_partner_name, p_partner_phone, p_partner_dupr_id, p_needs_partner)` for a fully atomic insert-and-capacity-check. If it doesn't exist, `api/_lib/atomicRegister.js` falls back to an insert-then-verify approach automatically.

Enable Supabase Auth (email/password) and create organizer accounts — `/admin` and admin-only endpoints (e.g. `api/tournament.js`) require a valid Supabase session token. **Every organizer account must have `app_metadata.role = "admin"`** (set via the Supabase Admin API or SQL — `user_metadata` won't do, it's client-editable) — every `admin_all_<table>` RLS policy checks that claim rather than just "is signed in," specifically because members also sign in via Supabase Auth (phone OTP) and would otherwise share the same blanket `authenticated` access as organizers.

For member login, additionally enable Supabase Auth's **Phone** provider with the **Twilio** SMS provider configured (Account SID + Auth Token + a WhatsApp-enabled sender), and set the frontend's `signInWithOtp` calls to `channel: 'whatsapp'` (already wired up in `frontend/src/membership/Login.jsx`) — WhatsApp delivery is only supported through Twilio/Twilio Verify, not Supabase's other SMS providers.

### 2. Razorpay (optional — omit to run free-registration only)

- In the Razorpay dashboard, generate API keys (Settings → API Keys). Use **test mode** until ready.
- The frontend only sees `VITE_RAZORPAY_KEY_ID`; the secret stays server-side.
- `api/confirm-payment.js` verifies the `razorpay_signature` HMAC-SHA256 of `order_id|payment_id` before booking the slot.

### 3. Resend (optional — omit to skip confirmation/broadcast emails)

- Create a Resend API key and verify the sending domain used in `api/_lib/sendConfirmationEmail.js` / `api/send-email.js` (`play@dinkovercoffee.com` by default — update if you fork this for another domain).

### 4. Twilio (optional — omit to run memberships without WhatsApp login/reminders)

- Create a Twilio account, buy/enable a WhatsApp-capable sender (a WhatsApp Business sender approved by Meta — the sandbox works for testing), and configure it as this project's SMS provider in Supabase Auth (Authentication → Providers → Phone).
- Build two WhatsApp templates in Twilio's Content Template Builder and get them approved by Meta: one **utility**-category reminder template with a Quick Reply button (used for the Monday/Wednesday reservation reminder, `TWILIO_REMINDER_CONTENT_SID`) and one generic single-variable **utility**-category announcement template (used for admin broadcasts, `TWILIO_BROADCAST_CONTENT_SID`). Free-form text (no template) only works as a reply within 24h of a member messaging in — that's used just for the automated "you're marked out" confirmation after a decline.
- In the Twilio console, set the WhatsApp sender's inbound webhook URL to `https://<your-domain>/api/membership?action=whatsapp-webhook`.
- Generate a random `CRON_SECRET` value — Vercel automatically sends it as `Authorization: Bearer $CRON_SECRET` on the cron-triggered reminder job (see `vercel.json`), which `api/membership.js` checks before running.

### 5. Environment variables

Create two files (both gitignored) and fill in real values — set the same keys as Vercel environment variables in prod.

`.env.local` at the repo root (read by `api/_dev-server.js` locally, and by the deployed `api/*.js` functions):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
HOLD_TTL_MINUTES=5
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+1415XXXXXXX
TWILIO_REMINDER_CONTENT_SID=
TWILIO_BROADCAST_CONTENT_SID=
CRON_SECRET=
```

`frontend/.env.local`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=
```

### 6. Install and run locally

```bash
# from repo root
npm install
cd frontend && npm install && cd ..

# terminal 1 — API on http://localhost:3001
npm run dev:api

# terminal 2 — frontend on http://localhost:5173 (proxies /api to the dev server per vite.config.js)
cd frontend && npm run dev
```

### 7. Deploy on Vercel

1. Push this repo to GitHub.
2. Import into Vercel. `vercel.json` sets the install command (`npm install && cd frontend && npm install`), build command (`cd frontend && npm run build`), and output directory (`frontend/dist`), and rewrites `/api/*` to the serverless functions.
3. Add the env vars from both `.env.local` files above in **Settings → Environment Variables**.
4. Redeploy.

## Tests

```bash
npm test        # vitest run, once
npm run test:watch
```

Tests live in `tests/` and cover the `api/` handlers (`register`, `waitlist`, `sessions`, `tournament`, slot-capacity logic) against mocked Supabase calls.

## Booking flow

**Paid sessions** (Razorpay configured):
1. Player picks a session, fills name/phone/skill (+ DUPR ID / partner info for `dupr*` event types), taps **Pay**.
2. Frontend calls `create-order` — the API re-checks slot availability, creates a Razorpay order server-side, and writes a row to **holds** with `expiresAt = now + HOLD_TTL_MINUTES`.
3. Razorpay checkout opens with the `order_id`.
4. On success, frontend calls `confirm-payment` with `(holdId, sessionId, razorpay_order_id, razorpay_payment_id, razorpay_signature)`. The API verifies the signature, marks the hold consumed, inserts a **players** row, and sends a confirmation email if Resend is configured.

**Free sessions / no Razorpay key**:
1. Frontend calls `register` (or `waitlist` once slots are full) directly — no hold/payment step. Availability and duplicate-registration checks happen server-side, and `atomicRegister` guards against races before the row is committed.

Both paths re-verify capacity after insert and roll back on over-subscription, so concurrent submissions can't oversell a session.

## Shop (`/shop`)

A single screen for browsing merchandise and checking out — no login or persistent cart. Products are fetched fresh on load; picking a size and quantity per product adds it to an in-memory order list (cleared on refresh, nothing written to the DB until checkout). All shop routes live behind one Vercel function, `api/shop.js`, dispatched by an `action` field in the request body (`products` / `create-order` / `confirm-payment` / `order`) to stay within the Hobby plan's function-count limit.

**Razorpay configured:**
1. Buyer picks items, fills shipping details, taps **Pay & checkout**.
2. Frontend calls `shop` with `action: 'create-order'` — the API re-prices every item server-side, checks stock (accounting for other in-flight holds), creates a Razorpay order, and writes a **shop_holds** row with a 5-minute TTL.
3. On successful payment, frontend calls `shop` with `action: 'confirm-payment'`, which verifies the signature, inserts a **shop_orders** row (`payment_status: paid`, `order_status: confirmed`), decrements product stock, and emails a confirmation if Resend is configured.

**No Razorpay key:**
1. Frontend calls `shop` with `action: 'order'` directly — the order is inserted as `payment_status: pending`, `order_status: placed`, stock is decremented, and the response includes UPI accounts so the buyer can pay manually. The organizer reconciles payment and ships once received.

## Tournaments (`/tournament`)

A generic round-robin-into-knockout tournament engine, not hardcoded to any one event's shape — a tournament can have any number of courts and teams per court. Like sessions/shop, there's no login: fixtures and standings are public, real-time (Supabase Realtime on `tournament_matches`/`tournament_teams`/`tournaments`). Most writes go through `/admin` with the organizer's authenticated session, same `admin_all_<table>` RLS pattern as the rest of `/admin` (courts, teams, fixtures, scores). The one exception is the session-registration backfill (see "Auto-sync from the linked session" below), which is a real server-side action, not simple CRUD — that one goes through `api/tournament.js`, action-dispatched behind a single Serverless Function slot the same way `api/shop.js` fronts the whole shop flow.

**Guided flow on the `/admin` tournament screen.** This used to be one long stacked page — every section always on screen, so saving anything (adding a court, generating fixtures) meant scrolling back down past everything above it to get back to where you were. It's now split into tabs (**Details** / **Fixtures** / **Standings** / **Knockout** / **Export**), each a short, focused view; switching tabs jumps to its top, and an action inside a tab (generate fixtures, add a team) keeps you on that tab afterward instead of resetting the page. A status badge (`Setup`/`Active`/`Completed`, with a dropdown to change it) sits next to the tournament name in the header, always visible, since going live is a one-tap action players are waiting on, not something to hunt for — deliberately not styled as a row of buttons like the tabs below it, since that read as a second row of tabs during testing.

1. Organizer creates a tournament (`/admin` → Manage → Tournaments → New Tournament), optionally picking a session right there (or linking one later) — the same picker as step 2 below.
2. **Details tab → Session**: link a session (e.g. a DUPR-teams event people signed up for via `/events`) to auto-populate teams from its confirmed doubles registrations. See "Auto-sync from the linked session" below for exactly how and when that happens, and the **Sync teams from session** button for backfilling registrations that predate the link.
3. **Details tab → Courts**: add one or more (e.g. "Court 1/2/3") — a court is both the physical court and its round-robin pool.
4. **Details tab → Teams**: auto-synced ones show up here as soon as they exist; teams can also be added by hand (e.g. walk-in entries with no session registration).
5. **Fixtures tab → Generate fixtures** per court builds every pairing once (`generateRoundRobinPairs` in `frontend/src/lib/tournament.js` — N teams → N×(N-1)/2 matches) as `stage: round_robin` rows. Match order isn't arbitrary — a greedy "maximize rest since last played" pass (with seeded randomized restarts to escape local optima) schedules pairings so the same team isn't stuck playing back-to-back; this eliminates consecutive repeats entirely for 5+ teams and gets to the mathematical minimum of 2 for courts of only 3 or 4.
6. **Go live**: once fixtures are ready, flip the always-visible status badge from `Setup` to `Active` so the tournament appears on the public `/tournament` (Live) tab.
7. **Scoring**: entered per match (single game score; higher score wins) as they're played, in any order — nothing about the fixture list gates when a match can be scored. A referee working one court doesn't use the Fixtures tab's inline list for this: tapping **Score** (on that court in Details → Courts, on its Fixtures tab section, or on the Knockout tab for the semifinal/final) opens a focused scoring mode — the next unplayed match is the only thing on screen, with large +/- steppers per team and a "Save & Next" button that auto-advances to whatever's unplayed next. A horizontal strip of every match on that court (not a long vertical list) sits below it for jumping to any match to correct a score, and a "View standings" toggle surfaces that court's table without leaving.
8. **Standings tab** (`computeStandings`, same lib) is derived live from completed matches — wins, then point differential, then points scored, the standard round-robin tiebreak order. There's no separate standings table to keep in sync; it's always a pure function of the match results. Both the public page and `/admin` show one combined ranking across every court (with a Court column so it's clear which pool each team was in) rather than a separate table per court — courts are round-robin pools, not divisions the site treats as separately ranked, and with uneven team counts per court (e.g. 5/5/4), "top of each court" isn't the same question as "top N overall." The Fixtures tab additionally keeps a standings table under each court while fixtures for that court are showing, for context while scoring; the Standings tab's combined table has its top-4 rows highlighted as a reference (not an enforced cutoff) for who advances.
9. Once round robin wraps, the organizer checks the Standings tab and manually creates semifinal (and later, final) matches on the **Knockout tab** by picking any two teams — deliberately not an auto-advancement formula (e.g. "winner of each court + best runner-up"), so the same engine works whether the next tournament has 3 courts advancing 4 teams, or 4 courts, or a different shape entirely.
10. Once the final is scored, its winner is shown as tournament champion (always visible, above the tabs), both in `/admin` and on the public page.
11. Flip status to `Completed` once it's over — see "Public visibility" below for what that does. The **Export tab** covers exporting results to DUPR regardless of status (see "Export for DUPR" below).

**Public visibility:** a tournament in `setup` status is invisible on `/tournament` (organizers can stage teams/fixtures before publishing). `/tournament` only ever shows the newest `active` tournament — the moment an organizer marks it `completed`, it disappears from the Live tab entirely rather than lingering as a read-only result page. Standings sit at the top; fixtures are grouped per court in a collapsible section (collapsed by default, with a "N/M played" summary) so the page doesn't turn into one long scroll of every match on every court.

**Export for DUPR:** `/admin`'s tournament screen has an **Export for DUPR** action that downloads every completed match (round robin and knockout) as a CSV in DUPR's exact bulk-match-upload column format (`matchType, scoreType, event, date, playerA1, playerA1DuprId, playerA2, playerA2DuprId, playerB1, playerB1DuprId, playerB2, playerB2DuprId, teamAGame1..teamBGame5`) — ready to upload as-is, no header/instruction rows to strip first. `matchType` is `D`/`S` depending on whether a team has a second player; `event` is the tournament name plus the court name (round robin) or "Semifinal"/"Final" (knockout), standing in for DUPR's "bracket"; only game 1 is ever filled in, since this engine scores a single game per match. The match date and scoring type (rally/side-out) are picked once per export (date defaults to the linked session's date). Player DUPR IDs are pulled from `players.dupr_id`/`partner_dupr_id` for auto-synced teams (via `source_player_id`) and left blank for teams added by hand — the export flags how many matches have a missing ID so the organizer knows to fill those in before uploading.

**Auto-sync from the linked session:** when a tournament has `session_id` set, its teams stay in sync with that session's registrations automatically — no admin action needed for registrations that happen *after* the link. A Postgres trigger (`sync_tournament_team_from_player`, fires on `players` insert/update) creates a team the moment a doubles registration on that session is `confirmed` with a partner name set, placing it on whichever of the tournament's courts currently has the fewest teams. This runs server-side regardless of whether `/admin` is open, and regardless of *how* the `players` row changed — a new registration via `/events`, an admin promoting someone off the waitlist, or marking someone withdrawn all go through direct writes to `players` (the last two straight from the browser), so this has to stay a DB trigger rather than move into application code; there's no HTTP request to hook for a browser-direct write. The trigger's per-player placement logic lives in a small SQL helper, `sync_team_for_player_in_tournament(tournament_id, player_id)`.

Registrations that already existed *before* a session gets linked aren't picked up by the trigger (nothing about them changed after the link, so no `players` row insert/update fires it). That's what the **Sync teams from session** button in the Details tab's Session section is for — unlike the trigger, this is a single, explicit, admin-invoked action, so it lives server-side as an ordinary API route: `POST /api/tournament` (`action: sync-teams`, requiring an `Authorization: Bearer <supabase access token>` header like the rest of `/admin`'s API routes), backed by a pure, unit-tested function (`api/_lib/tournamentSync.js`) that runs the same qualification/placement rule as the trigger against every registration on the linked session and reports how many new teams it created. Safe to click repeatedly (e.g. after adding more courts, or if more registrations came in) — it only ever adds a team for a registration that doesn't have one yet in that tournament. This one used to be a Postgres RPC too, but moved to `api/` once it became clear the RPC-as-admin-action pattern doesn't scale well: it can't be exercised by the JS test suite (verifying it meant hand-running SQL against the real project every time), and Postgres function grants turned out to be an easy footgun — revoking `EXECUTE` from `anon`/`authenticated` silently breaks a *trigger's* firing too, which cost real debugging time here. The always-fires-on-any-write trigger stays in the database because only a trigger can do that; the button-triggered bulk action moved out because there was no reason for it to still be there.

Neither path ever edits or deletes an existing team, so a later change to an already-synced registration doesn't retroactively alter its team. If a player withdraws their registration after their team already exists, the team isn't touched or removed (pulling a team after fixtures exist would corrupt the bracket); instead `/admin` shows a "Withdrawn" badge next to that team everywhere it appears (team list, per-court and overall standings) so the organizer can decide what to do. If a new team lands on a court that already has fixtures generated, the **Generate fixtures** button reappears there as **Add N new fixtures** — it only inserts the missing pairings for the new team, re-running the same back-to-back-avoiding order over the court's full team list but skipping any pairing that's already been scheduled or scored, so existing matches and results are untouched. `/admin`'s Tournament screen subscribes to realtime changes on `tournament_teams`/`tournament_matches`/`players` (scoped to the linked session) so all of this shows up live without a manual refresh.

## Membership (`/membership`)

A **"Become a Member"** button on the Landing page (and in `NavTabs`) leads to `/membership`. What a visitor sees there is gated on `membership_settings.capacity` vs. the current count of `active` members (`api/membership.js`'s public, no-auth `availability` action) — this is the actual enforcement point, re-checked server-side inside the signup actions too, not just a frontend gate:

- **Capacity available, not yet a member:** WhatsApp OTP login (Supabase Auth phone, `channel: 'whatsapp'`, via Twilio — no password, no admin-style email account) → signup form (name, email, DUPR ID, t-shirt size, plan, WhatsApp opt-in). Payment reuses the same Razorpay hold-then-confirm pattern as session/shop checkout (`signup-create-order`/`signup-confirm-payment`), with a `signup-free` fallback when Razorpay isn't configured.
- **Capacity full, not yet a member:** skips login/signup entirely and shows "memberships are full right now" with a lightweight name/phone/email form (`waitlist-interest` action → `membership_waitlist`) — "we'll notify you on WhatsApp when a spot opens up." No account, no OTP, just a lead captured for later.
- **Already has a `members` row** (active, or admin-created/converted from the waitlist and not yet paid): always proceeds straight to their dashboard or signup/payment resume, regardless of current capacity — capacity only gates *new* signups.

Sessions, shop, and tournaments stay completely login-free either way — nothing about this feature touches those flows.

**Converting a waitlisted lead into a member** is an admin action (`/admin` → Manage → Memberships → Waitlist section → **Convert to member**): it inserts a `members` row (`status: pending_payment`) from the captured name/phone/email and marks the waitlist entry converted. The gap this closes: that new `members` row has no `user_id` yet (the person hasn't logged in), so when they *do* log in via WhatsApp OTP for the first time, `api/membership.js`'s `whoami` action links their verified auth identity to that existing row by phone match rather than sending them through signup again or creating a duplicate. Once an organizer flips their status to `active` (same status dropdown as any other member) and marks payment done, WhatsApp login takes them straight to their dashboard.

Once signed in, a member sees a **membership card** (plan, status, end date, rollover-credit balance — read directly via RLS, no API call needed) and a **directory of other active members** (first name + plan only, matching the existing "first name only" privacy stance the public Who's Playing view already uses — served through `api/membership.js`'s `directory` action rather than a raw table read, so a member can never pull another member's phone/email/DUPR ID).

**The Monday/Wednesday reserved slot.** An organizer flags a session `is_member_slot` (in `SessionForm`) and sets `member_reserved_slots` — capacity carved out of `max_slots` for members, the same shape as the existing `beginner_slots` split. Two days before such a session, a Vercel Cron job (`vercel.json`, hits `api/membership.js?action=send-reminders` once daily) auto-creates a `players` row for every active member — reserved by default, since it's a slot they already committed to — and sends a WhatsApp reminder (Twilio Content API, one approved template with a **"Can't make it this week"** Quick Reply button). No reply means the reservation stands and counts toward the organizer's headcount; a member who doesn't show and never declined simply loses that week's slot, nothing to track. Tapping the decline button hits an inbound webhook (`action: whatsapp-webhook`, Twilio-signature-verified) that marks the reservation `withdrew` (freeing the slot) and banks **+1 rollover credit** (capped at the member's `rollover_cap`) — only an explicit advance decline ever earns a credit, so silent absence forfeits it by construction. A banked credit can be spent from the dashboard (`redeem-credit`) to reserve any other upcoming session.

**Attendance check-in**, decoupled entirely from the credit ledger: in `/admin`'s session roster (`PlayerList.jsx`), a member-tagged registration shows a "Member" badge and a tap-to-mark-present toggle (`players.attended`) plus a "Members in" stat — a plain attendance record for the club's own history, independent of who reserved, declined, or no-showed.

**Broadcast:** `/admin` → Manage → Memberships has a message box that sends a WhatsApp template to every opted-in active member (`action: broadcast`) — the same Twilio account and webhook as reminders, no separate messaging platform.

## Admin (`/admin`)

Organizers sign in with Supabase Auth to manage sessions, view/promote waitlisted players, manage venues and per-session UPI payment accounts, review signed waivers, see basic finances, manage shop orders, run tournaments, and manage memberships — reached via the **Manage** menu (hamburger icon next to the theme toggle) rather than a row of icon buttons, so each destination has a visible label instead of relying on hover tooltips. Simple CRUD (sessions, shop orders, tournament courts/teams/scores, memberships, promoting a waitlisted player) queries Supabase directly from the browser with the organizer's authenticated session — an `admin_all_<table>` RLS policy grants that access per table, gated on `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` rather than merely "is signed in," so these screens don't need their own API routes. **This role check matters specifically because of `/membership`**: members also hold ordinary Supabase Auth (`authenticated`) sessions once logged in via WhatsApp OTP, and would otherwise share the same blanket admin access — every organizer account needs `app_metadata.role = "admin"` set (see the Supabase setup section above). Actions with real server-side logic instead go through an admin-authenticated API route (`Authorization: Bearer <supabase access token>`, verified the same way each time) — `api/tournament.js`'s session-registration backfill, and `api/membership.js`'s broadcast action.

**Shop Orders** (`/admin` → Manage → Shop Orders) lists every `shop_orders` row, newest first, with a stats row (total / payment pending / to ship) and filter chips across both `payment_status` and `order_status`. Each order shows a status stepper (Placed → Confirmed → Packed → Shipped → Delivered, or a red Cancelled state) and a payment badge. Expanding an order reveals its line items, shipping address, and IDs, plus contextual actions:
- **Mark as paid** when `payment_status` is `pending`.
- A single primary button that advances `order_status` to the next stage (its label changes with the stage — *Confirm order* / *Mark as packed* / *Ship order* / *Mark as delivered*); advancing past `paid` is required before the pipeline can progress. *Ship order* opens a small form to capture carrier, tracking number, and tracking link before transitioning.
- **Cancel order** (available until shipped) opens a reason prompt and sets `order_status: cancelled`.

**Auto-lock & biometric unlock** (`/admin` → Manage → Security): a Supabase session, once signed in, otherwise keeps refreshing itself indefinitely in the browser — this adds a UI-level lock on top of that so an unattended device isn't enough. `useAppLock` (`frontend/src/lib/useAppLock.js`) locks the screen after 10 minutes of inactivity, or immediately if the app was backgrounded (tab hidden / phone locked / app switched away from) for 2+ minutes — the more common "away" case on mobile than idle-with-tab-open. If it's been backgrounded for 24+ hours it signs out fully instead of just locking. Locking doesn't touch the underlying Supabase session or component state — it renders a full-screen `LockScreen` on top of the still-mounted `Dashboard` until unlocked.

Unlocking supports Face ID / Touch ID / Android biometrics via the browser's WebAuthn API (`frontend/src/lib/webauthnLock.js`), opted into per device from the Security screen, with password sign-in always available as a fallback (and as the only option until biometric unlock is enabled, or on devices/browsers without a platform authenticator). This is a **local device gate, not a Supabase-verified passkey login** — there's no server verifying the WebAuthn signature, so it's a convenience/security layer confirming "the device owner is physically present" rather than a new authentication method. True passkey-based Supabase sign-in would be a separate, larger feature.

## Privacy

The public **Who's playing** view shows first name + skill level only. Phone, full name, DUPR ID, and payment details stay in Supabase (admin-only, via the service role key on the server).
