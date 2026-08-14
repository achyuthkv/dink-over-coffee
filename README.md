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
api/                Vercel serverless functions — one file per route (Vercel's Hobby plan caps the function count, so routes are consolidated with an `action` field where it makes sense, e.g. `waiver.js`, `shop.js`)
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
- **upi_accounts** — `id, label, upi_id, qr_image_url`
- **session_upis** — `session_id, upi_account_id, sort_order` (join table for per-session UPI display)
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

Optional: a Postgres function `atomic_register(p_session_id, p_name, p_phone, p_email, p_skill, p_amount, p_status, p_dupr_id, p_partner_name, p_partner_phone, p_partner_dupr_id, p_needs_partner)` for a fully atomic insert-and-capacity-check. If it doesn't exist, `api/_lib/atomicRegister.js` falls back to an insert-then-verify approach automatically.

Enable Supabase Auth (email/password) and create organizer accounts — `/admin` and admin-only endpoints (`promote`) require a valid Supabase session token.

### 2. Razorpay (optional — omit to run free-registration only)

- In the Razorpay dashboard, generate API keys (Settings → API Keys). Use **test mode** until ready.
- The frontend only sees `VITE_RAZORPAY_KEY_ID`; the secret stays server-side.
- `api/confirm-payment.js` verifies the `razorpay_signature` HMAC-SHA256 of `order_id|payment_id` before booking the slot.

### 3. Resend (optional — omit to skip confirmation/broadcast emails)

- Create a Resend API key and verify the sending domain used in `api/_lib/sendConfirmationEmail.js` / `api/send-email.js` (`play@dinkovercoffee.com` by default — update if you fork this for another domain).

### 4. Environment variables

Create two files (both gitignored) and fill in real values — set the same keys as Vercel environment variables in prod.

`.env.local` at the repo root (read by `api/_dev-server.js` locally, and by the deployed `api/*.js` functions):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RESEND_API_KEY=
HOLD_TTL_MINUTES=5
```

`frontend/.env.local`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_RAZORPAY_KEY_ID=
```

### 5. Install and run locally

```bash
# from repo root
npm install
cd frontend && npm install && cd ..

# terminal 1 — API on http://localhost:3001
npm run dev:api

# terminal 2 — frontend on http://localhost:5173 (proxies /api to the dev server per vite.config.js)
cd frontend && npm run dev
```

### 6. Deploy on Vercel

1. Push this repo to GitHub.
2. Import into Vercel. `vercel.json` sets the install command (`npm install && cd frontend && npm install`), build command (`cd frontend && npm run build`), and output directory (`frontend/dist`), and rewrites `/api/*` to the serverless functions.
3. Add the env vars from both `.env.local` files above in **Settings → Environment Variables**.
4. Redeploy.

## Tests

```bash
npm test        # vitest run, once
npm run test:watch
```

Tests live in `tests/` and cover the `api/` handlers (`register`, `waitlist`, `promote`, `sessions`, slot-capacity logic) against mocked Supabase calls.

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

A generic round-robin-into-knockout tournament engine, not hardcoded to any one event's shape — a tournament can have any number of courts and teams per court. Like sessions/shop, there's no login: fixtures and standings are public, real-time (Supabase Realtime on `tournament_matches`/`tournament_teams`/`tournaments`), all writes go through `/admin` with the organizer's authenticated session (no new API routes needed, same `admin_all_<table>` RLS pattern as the rest of `/admin`).

**Flow:**
1. Organizer creates a tournament (`/admin` → Manage → Tournaments), adds courts (e.g. "Court 1/2/3"), and adds teams to each court.
2. **Generate fixtures** per court builds every pairing once (`generateRoundRobinPairs` in `frontend/src/lib/tournament.js` — N teams → N×(N-1)/2 matches) as `stage: round_robin` rows. Match order isn't arbitrary — a greedy "maximize rest since last played" pass (with seeded randomized restarts to escape local optima) schedules pairings so the same team isn't stuck playing back-to-back; this eliminates consecutive repeats entirely for 5+ teams and gets to the mathematical minimum of 2 for courts of only 3 or 4.
3. Scores are entered per match (single game score; higher score wins) as they're played, in any order — nothing about the fixture list gates when a match can be scored.
4. **Standings** (`computeStandings`, same lib) are derived live from completed matches — wins, then point differential, then points scored, the standard round-robin tiebreak order. There's no separate standings table to keep in sync; it's always a pure function of the match results. Both the public page and `/admin` show one combined ranking across every court (with a Court column so it's clear which pool each team was in) rather than a separate table per court — courts are round-robin pools, not divisions the site treats as separately ranked, and with uneven team counts per court (e.g. 5/5/4), "top of each court" isn't the same question as "top N overall." Fixtures stay grouped per court, since that's how matches are actually scheduled and played. `/admin` additionally keeps a standings table under each court while fixtures for that court are showing, for context while scoring; the combined table (with its top-4 rows highlighted as a reference, not an enforced cutoff) sits just above the semifinal/final section where advancement decisions actually get made.
5. Once round robin wraps, the organizer looks at the combined standings and manually creates semifinal (and later, final) matches by picking any two teams — deliberately not an auto-advancement formula (e.g. "winner of each court + best runner-up"), so the same engine works whether the next tournament has 3 courts advancing 4 teams, or 4 courts, or a different shape entirely.
6. Once the final is scored, its winner is shown as tournament champion, both in `/admin` and on the public page.

A tournament in `setup` status is invisible on `/tournament` (organizers can stage teams/fixtures before publishing); flip it to `active` when it should go live, and to `completed` when it's over. `/tournament` shows the newest `active` tournament, or falls back to the newest `completed` one so results stay visible after the event.

**Auto-sync from the linked session:** when a tournament has `session_id` set, its teams stay in sync with that session's registrations automatically — no admin action needed. A Postgres trigger (`sync_tournament_team_from_player`, fires on `players` insert/update) creates a team the moment a doubles registration on that session is `confirmed` with a partner name set, placing it on whichever of the tournament's courts currently has the fewest teams. This runs server-side regardless of whether `/admin` is open, so it also catches registrations that come in after the fact. The trigger only ever *adds* teams — it never edits or deletes an existing one, so a later change to a synced registration doesn't retroactively alter its team. If a player withdraws their registration after their team already exists, the team isn't touched or removed (pulling a team after fixtures exist would corrupt the bracket); instead `/admin` shows a "Withdrawn" badge next to that team everywhere it appears (team list, per-court and overall standings) so the organizer can decide what to do. If a new team lands on a court that already has fixtures generated, the **Generate fixtures** button reappears there as **Add N new fixtures** — it only inserts the missing pairings for the new team, re-running the same back-to-back-avoiding order over the court's full team list but skipping any pairing that's already been scheduled or scored, so existing matches and results are untouched. `/admin`'s Tournament screen subscribes to realtime changes on `tournament_teams`/`tournament_matches`/`players` (scoped to the linked session) so all of this shows up live without a manual refresh.

## Admin (`/admin`)

Organizers sign in with Supabase Auth to manage sessions, view/promote waitlisted players, manage venues and per-session UPI payment accounts, review signed waivers, see basic finances, manage shop orders, and run tournaments — reached via the **Manage** menu (hamburger icon next to the theme toggle) rather than a row of icon buttons, so each destination has a visible label instead of relying on hover tooltips. `promote` is the only admin API route so far — it requires an `Authorization: Bearer <supabase access token>` header and moves a waitlisted player to confirmed. Everything else in `/admin`, including shop orders, queries Supabase directly from the browser with the organizer's authenticated session — an `admin_all_<table>` RLS policy (`for all to authenticated using (true)`) grants that access per table, so these screens don't need their own API routes (keeping the Vercel function count down).

**Shop Orders** (`/admin` → Manage → Shop Orders) lists every `shop_orders` row, newest first, with a stats row (total / payment pending / to ship) and filter chips across both `payment_status` and `order_status`. Each order shows a status stepper (Placed → Confirmed → Packed → Shipped → Delivered, or a red Cancelled state) and a payment badge. Expanding an order reveals its line items, shipping address, and IDs, plus contextual actions:
- **Mark as paid** when `payment_status` is `pending`.
- A single primary button that advances `order_status` to the next stage (its label changes with the stage — *Confirm order* / *Mark as packed* / *Ship order* / *Mark as delivered*); advancing past `paid` is required before the pipeline can progress. *Ship order* opens a small form to capture carrier, tracking number, and tracking link before transitioning.
- **Cancel order** (available until shipped) opens a reason prompt and sets `order_status: cancelled`.

**Auto-lock & biometric unlock** (`/admin` → Manage → Security): a Supabase session, once signed in, otherwise keeps refreshing itself indefinitely in the browser — this adds a UI-level lock on top of that so an unattended device isn't enough. `useAppLock` (`frontend/src/lib/useAppLock.js`) locks the screen after 10 minutes of inactivity, or immediately if the app was backgrounded (tab hidden / phone locked / app switched away from) for 2+ minutes — the more common "away" case on mobile than idle-with-tab-open. If it's been backgrounded for 24+ hours it signs out fully instead of just locking. Locking doesn't touch the underlying Supabase session or component state — it renders a full-screen `LockScreen` on top of the still-mounted `Dashboard` until unlocked.

Unlocking supports Face ID / Touch ID / Android biometrics via the browser's WebAuthn API (`frontend/src/lib/webauthnLock.js`), opted into per device from the Security screen, with password sign-in always available as a fallback (and as the only option until biometric unlock is enabled, or on devices/browsers without a platform authenticator). This is a **local device gate, not a Supabase-verified passkey login** — there's no server verifying the WebAuthn signature, so it's a convenience/security layer confirming "the device owner is physically present" rather than a new authentication method. True passkey-based Supabase sign-in would be a separate, larger feature.

## Privacy

The public **Who's playing** view shows first name + skill level only. Phone, full name, DUPR ID, and payment details stay in Supabase (admin-only, via the service role key on the server).
