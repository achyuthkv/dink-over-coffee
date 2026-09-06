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
frontend/          Vite + React + Tailwind app (public booking flow + /admin + /referee)
  src/
    components/     Public-facing pages (Landing, RegisterTab, PlayersTab, ...)
      tournament/    Presentational tournament UI shared by the public page, /admin, and /referee (standings table, match row, bracket view, score mode)
    admin/          Organizer dashboard (sessions, players, venues, UPI accounts, waivers, finances, referees)
      tournament/    Per-category admin screen (registrations, fixtures, scoring, bracket, export)
    referee/        The referee-only app at /referee (login, role check, assignment list + scoring)
    lib/tournament.js  Pure fixture-generation/standings/bracket logic — round robin, single-elim seeding, group-knockout entrants, bracket advancement
    lib/tournamentActions.js  Shared (organizer + referee) match-scoring + bracket-advancement side effect, so the two scoring UIs can't drift apart
    api.js          Thin fetch wrapper around the /api/* endpoints
    supabase.js     Browser Supabase client (anon key)
api/                Vercel serverless functions — one file per route (Vercel's Hobby plan caps the function count, so routes are consolidated with an `action` field where it makes sense, e.g. `waiver.js`, `shop.js`, `tournament.js`)
  _lib/             Shared server helpers (supabase client, slot counting, atomic register, Razorpay, rate limiting, email, tournament capacity/validation) — underscore prefix excludes these from Vercel's function count
  _dev-server.js    Minimal local HTTP server that mounts api/*.js for `npm run dev:api` — underscore-prefixed so it isn't deployed as its own function
supabase/migrations/  SQL schema/RLS for tables not fully expressible as "run this once by hand" — the tournament module and the organizer/referee role split (see Tournaments and Roles below)
apps-script/        Legacy/unused Apps Script prototype — not part of the current stack
tests/              Vitest tests for the api/ handlers and frontend/src/lib pure functions
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
- **tournaments** — `id, name, description, sport, venue, start_date, end_date, contact_phone (nullable), status (setup|active|completed), created_at`. Just the event shell — everything format/registration/fixture-related lives one level down, on its categories. `setup` is hidden from the public `/tournament` page (organizers can stage categories before anything's visible); `active` and `completed` are public. `/tournament` shows whichever `active` tournament is newest, falling back to the newest `completed` one so results linger after an event ends. `contact_phone` is a per-tournament "call/WhatsApp us" number for registration issues, editable from `/admin`'s tournament Details panel — falls back to the site-wide `VITE_SUPPORT_PHONE` when unset.
- **tournament_categories** — `id, tournament_id, name, format (round_robin|single_elim|group_knockout), team_size (1|2), max_teams (nullable), entry_fee, early_bird_fee (nullable), early_bird_deadline (nullable date), advance_per_group, status (setup|registration_open|registration_closed|active|completed), sort_order, created_at`. A tournament runs one or more of these in parallel (Men's Doubles, Mixed, a skill bracket, …), each with its own bracket type, entry fee and roster. Registration is entirely category-based — there's no link to a `sessions` row; see **Tournaments** below for the registration flow.
- **tournament_groups** — `id, category_id, name, sort_order, created_at`. A round-robin pool within a category — for `round_robin` these are the whole story; for `group_knockout` they're the group stage that feeds a bracket.
- **tournament_courts** — `id, tournament_id, name, sort_order, created_at`. Tournament-level scheduling metadata only (which physical courts exist) — matches aren't auto-assigned to one; distinct from a `tournament_groups` pool.
- **tournament_teams** — `id, category_id, group_id (nullable), name, player1_name, player2_name, seed (nullable), status (confirmed|waitlisted|withdrawn), created_at`. Public-readable columns only, by design — see `tournament_registrations` for why contact details live in a separate table.
- **tournament_registrations** — `id, team_id (unique, references tournament_teams), phone, player2_phone (nullable), dupr_id, partner_dupr_id (nullable), tshirt_size, partner_tshirt_size (nullable), email (nullable), amount, payment_status (free|pending|paid|refunded), razorpay_order_id, razorpay_payment_id, created_at`. Contact + payment details for a registration, split out of `tournament_teams` and RLS-locked to `authenticated` only (no anon policy at all, same reasoning as `upi_accounts`) — the public live-bracket/standings page selects every column of `tournament_teams` freely, so nothing sensitive can live there.
- **tournament_holds** — `id, category_id, razorpay_order_id, team (jsonb snapshot of the registration form), amount, expires_at, status (active|consumed), created_at`. Hold-then-confirm for a paid category entry, mirroring `holds`/`shop_holds`.
- **tournament_matches** — `id, category_id, group_id (nullable — null for a knockout match), court_id (nullable), stage (group|round_of_32|round_of_16|quarterfinal|semifinal|final), round, bracket_slot, match_number, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id, status (scheduled|completed|walkover), scheduled_time, created_at`. `round`/`bracket_slot` encode a knockout bracket's tree (round *r* slot *s*'s winner feeds round *r+1* slot ⌊s/2⌋) so advancement is a pure computation (`computeAdvancement` in `frontend/src/lib/tournament.js`) rather than a stored next-match pointer; group-stage matches leave both at 0.

The full schema (tables, indexes, and RLS policies) is spread across `supabase/migrations/000{1,2,3,4}_*.sql` — run them in order against a Supabase project's SQL editor. `0001` is a breaking change to the old flat tournament schema (drops and recreates `tournament_courts`/`tournament_teams`/`tournament_matches`, adds the new tables above) — export anything worth keeping from an existing tournament first.

Optional: a Postgres function `atomic_register(p_session_id, p_name, p_phone, p_email, p_skill, p_amount, p_status, p_dupr_id, p_partner_name, p_partner_phone, p_partner_dupr_id, p_needs_partner)` for a fully atomic insert-and-capacity-check. If it doesn't exist, `api/_lib/atomicRegister.js` falls back to an insert-then-verify approach automatically.

Enable Supabase Auth (email/password) and create organizer accounts — `/admin` and admin-only endpoints (e.g. `api/tournament.js`) require a valid Supabase session token.

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
VITE_SUPPORT_PHONE=
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

A category-based tournament engine: one tournament (name, sport, venue, dates) runs one or more **categories** in parallel — Men's Doubles, Mixed Doubles, a skill bracket, whatever the event needs — each with its own bracket format, entry fee, capacity and roster. Categories, not the tournament itself, are where almost everything happens: registration, fixtures, scoring, standings. Registration is entirely category-based — a category has no link to a `sessions` row at all; players register straight into the category they want (or an organizer bulk-imports/hand-adds them), full stop. Like sessions/shop, there's no login for players: category rosters, fixtures, and standings are public and real-time (Supabase Realtime on `tournament_categories`/`tournament_groups`/`tournament_teams`/`tournament_matches`). Category/group/team/match CRUD in `/admin` goes straight to Supabase with the organizer's authenticated session, the same `admin_all_<table>` RLS pattern as the rest of `/admin`; public registration, payment, and bulk CSV import are real server-side actions with capacity/race-safety logic, so those go through `api/tournament.js` (action-dispatched behind one Serverless Function slot, same pattern as `api/shop.js`).

**Formats.** Each category picks one at creation:
- **Round Robin** — one or more groups (pools), each playing a full round robin. A category with no need to split into pools just uses one group.
- **Single Elimination** — every confirmed team seeded straight into a knockout bracket. No group stage.
- **Group Stage + Knockout** — round-robin groups first, then the top `advance_per_group` teams from each group (group winners first, then all runners-up, etc. — a snake seeding that keeps group-mates apart for as long as possible) feed a knockout bracket the organizer generates once group play wraps.

(Double elimination isn't implemented — the three formats above cover the vast majority of real events, and a proper double-elim bracket with a losers' bracket and reset is enough additional complexity to warrant its own follow-up rather than folding it in here.)

**Creating a tournament and its categories** (`/admin` → Manage → Tournaments):
1. **New Tournament** — name, sport, venue, dates (all but name optional; add/edit later from the tournament's Details section).
2. Add **Courts** (physical courts, e.g. "Court 1/2/3") if useful for scheduling reference — this is metadata only, matches aren't auto-assigned to one.
3. **+ New Category** — name, format, singles/doubles, optional max teams, entry fee (+ optional early-bird fee and deadline), and — for Group Stage + Knockout — how many advance per group. Tap into a category to manage everything below.

**Registration** (each category tab): a category's status controls what's visible/open — `setup` (organizer staging it, invisible on `/tournament`), `registration_open` (players can sign up), `registration_closed`, `active`, `completed`. Registration is entirely category-based — there's no session to link, so a category's roster only ever comes from two places, freely mixed:
- **Public self-registration** on `/tournament` (once a category is `registration_open`): a compact team form (player 1 + partner if doubles, phone, DUPR ID, and T-shirt size for every player — all required, each field with a persistent label rather than a placeholder that disappears on typing — plus optional email; a "Size chart" link opens the T-shirt size chart). Picking a category from the grid jumps straight into this form when it's still open for registration and no fixtures have been generated yet — nothing else to see, so no reason to make the player tap through a detail screen first; once fixtures exist, picking the category shows the normal detail view (standings/bracket) with a Register button instead. Free categories register immediately; paid ones go through the same Razorpay hold-then-confirm flow as session/shop registration (`create-order` → checkout → `confirm-payment`), or fall back to "pay by UPI, organizer marks it paid" if no Razorpay key is configured — the confirmation screen always spells out what's owed and how to pay, even if no UPI account is configured yet. A category with `max_teams` set waitlists new entries once full (confirmed teams only count against the cap; the organizer promotes off the waitlist from the Registrations tab). The form and confirmation screen show a "having trouble? call/WhatsApp" line using the tournament's `contact_phone` (set from `/admin`), falling back to the site-wide `VITE_SUPPORT_PHONE` if unset. A paid category's form also shows a "Cancellation & Refund Policy" link (entry fees are non-refundable except on organizer cancellation, which is a full refund).
- **Bulk CSV import** in the Registrations tab (admin-only) — upload a spreadsheet (`teamName, player1Name, player1Phone, player2Name, player2Phone, email` columns) and every valid row is inserted as a free, non-payment entry (confirmed or waitlisted against the same capacity rule); invalid rows are reported back per-row without failing the whole import.

An organizer can also add a team by hand (walk-in entries, no self-registration needed) from the Registrations tab.

Contact/payment details (`tournament_registrations`) are kept out of the publicly-readable `tournament_teams` row entirely (see the schema note above) — the Registrations tab is where an organizer sees phone numbers and payment status, and marks a manual UPI payment as paid.

**Fixtures.**
- *Round Robin / the group stage of Group Stage + Knockout*: add one or more **Groups**, then **Generate fixtures** per group builds every pairing once (`generateRoundRobinPairs` — N teams → N×(N-1)/2 matches). Match order isn't arbitrary — a greedy "maximize rest since last played" pass (with seeded randomized restarts) schedules pairings so the same team isn't stuck playing back-to-back; zero consecutive repeats for 5+ teams, the provable minimum of 2 for groups of only 3 or 4. If a new team lands on a group that already has fixtures, the button reappears as **Add N new fixtures** — only the missing pairings, existing results untouched.
- *Single Elimination*, and the knockout stage of *Group Stage + Knockout*: **Generate bracket** (`generateSingleElimBracket`) builds a standard seeded bracket — byes pad the field up to the next power of two and go to the top seeds, resolved immediately so a lone qualifier doesn't have to "play" an empty bracket cell. Group Stage + Knockout seeds the bracket from current group standings (`buildKnockoutEntrants`) instead of raw entry order. **Reset bracket** clears it (with a confirmation) to regenerate from scratch.

**Scoring**, same focused flow whether it's the organizer or an assigned referee doing it: tapping **Score** on a group or the bracket opens a mode where the next unplayed match is the only thing on screen with big +/- steppers and a "Save & Next" that auto-advances; a horizontal strip of every match on that group/bracket lets you jump back to correct one. For a knockout match, saving a score also advances the winner into its next-round slot (`computeAdvancement` — pure round/bracket-slot arithmetic, no stored next-match pointer); correcting an earlier result after the bracket has moved on cascades a reset through everything downstream that depended on the old winner, rather than leaving a stale result in place. The scoring logic itself (`scoreMatchAndAdvance`, `frontend/src/lib/tournamentActions.js`) is shared verbatim between the organizer's screen and the referee app so the two can't drift apart.

Each group and each category's knockout bracket can have one referee assigned (a dropdown next to the group/bracket, in the Fixtures/Groups and Bracket tabs) — see **Referees** below for what that account can and can't do.

**Standings.** Round-robin/group standings (`computeStandings`) are a pure function of completed matches — wins, then point differential, then points scored — shown per group (group-knockout's groups aren't pooled into one fake combined ranking, since strength of schedule differs group to group). The knockout stage gets a bracket view instead of a table, both in `/admin` (editable, inline scoring) and on the public page (read-only). Once the final is scored, its winner is shown as champion above the tabs, in both places.

**Export for DUPR:** each category's Export tab downloads every one of *its* completed matches (group stage and knockout alike) as a CSV in DUPR's exact bulk-match-upload column format (`matchType, scoreType, event, date, playerA1, playerA1DuprId, ..., teamAGame1..teamBGame5`) — ready to upload as-is. `matchType` is `D`/`S` depending on whether a team has a second player; `event` folds in the tournament name, category name, and group/stage name, standing in for DUPR's "bracket"; only game 1 is ever filled in, since this engine scores a single game per match. DUPR ID is required at registration (public form and admin CSV import) and stored on `tournament_registrations`, so these columns are filled in automatically — the export only warns when a match is missing one (e.g. a hand-added team with no DUPR ID on file).

A directly-registered or hand-added team can be withdrawn (soft — keeps match history intact, shows a "Withdrawn" badge everywhere it appears) or removed outright from the Registrations tab at any time.

**Public visibility:** a category in `setup` is invisible on `/tournament`; the tournament itself follows the same `setup`/`active`/`completed` visibility rule the original engine used (only the newest `active` tournament shows, disappearing from the Live tab the moment it's marked `completed`). With more than one visible category, `/tournament` shows a pill selector across the top; each category's section shows its **Register** button (only while `registration_open`), group standings, fixtures (collapsed by default), and bracket.

## Roles

Three kinds of user, mirroring how Clutch splits Organizer / Referee / Player into separate apps:

- **Organizer** — full Supabase Auth account, signs in at `/admin`. Everything below.
- **Referee** — a second, much narrower Supabase Auth account type, signs in at `/referee`. Can only score the specific tournament group or knockout bracket an organizer has assigned them to — no access to registrations, categories, payments, or any other admin screen. See **Referees** below.
- **Player** — no account at all. Browses and registers for sessions/shop/tournaments as a public visitor.

Organizer vs. referee is a Supabase Auth JWT claim, not a lookup table: `app_metadata.role` is `'admin'` for an organizer or `'referee'` for a referee (`app_metadata` — unlike `user_metadata` — can't be edited by the account holder, which matters since this is the security-relevant claim). This matches how every `admin_all_<table>` policy in this project already gated organizer access before the tournament module existed — `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` — rather than "any authenticated user," so a referee (or a customer "member" account, from an earlier membership feature) is automatically excluded from those tables with no changes needed. `is_organizer()`/`is_referee()` (`supabase/migrations/0001_tournament_categories.sql` / `0002_referee_role.sql`) just wrap that same claim check for the tournament tables. A small `referees` table (name/phone) exists purely so `/admin` has something to list — the JWT claim, not a row in that table, is what RLS actually trusts.

## Admin (`/admin`)

Organizers sign in with Supabase Auth to manage sessions, view/promote waitlisted players, manage venues and per-session UPI payment accounts, review signed waivers, see basic finances, manage shop orders, run tournaments, and manage referee accounts — reached via the **Manage** menu (hamburger icon next to the theme toggle) rather than a row of icon buttons, so each destination has a visible label instead of relying on hover tooltips. A referee account that lands on `/admin` (same Supabase session, same site) sees a "this login is for referees" screen instead of the dashboard, rather than a broken/erroring one. Simple CRUD (sessions, shop orders, tournament categories/groups/teams/scores, promoting a waitlisted player) queries Supabase directly from the browser with the organizer's authenticated session — an `is_organizer()`-gated RLS policy grants that access per table, so these screens don't need their own API routes. Actions with real server-side logic instead go through an organizer-authenticated API route (`Authorization: Bearer <supabase access token>`, verified — and, in `api/tournament.js`, re-checked against the caller's `app_metadata.role` rather than just "is this a valid session" — the same way each time) — currently the tournament module's bulk CSV import and referee account creation/deletion.

**Shop Orders** (`/admin` → Manage → Shop Orders) lists every `shop_orders` row, newest first, with a stats row (total / payment pending / to ship) and filter chips across both `payment_status` and `order_status`. Each order shows a status stepper (Placed → Confirmed → Packed → Shipped → Delivered, or a red Cancelled state) and a payment badge. Expanding an order reveals its line items, shipping address, and IDs, plus contextual actions:
- **Mark as paid** when `payment_status` is `pending`.
- A single primary button that advances `order_status` to the next stage (its label changes with the stage — *Confirm order* / *Mark as packed* / *Ship order* / *Mark as delivered*); advancing past `paid` is required before the pipeline can progress. *Ship order* opens a small form to capture carrier, tracking number, and tracking link before transitioning.
- **Cancel order** (available until shipped) opens a reason prompt and sets `order_status: cancelled`.

**Auto-lock & biometric unlock** (`/admin` → Manage → Security): a Supabase session, once signed in, otherwise keeps refreshing itself indefinitely in the browser — this adds a UI-level lock on top of that so an unattended device isn't enough. `useAppLock` (`frontend/src/lib/useAppLock.js`) locks the screen after 10 minutes of inactivity, or immediately if the app was backgrounded (tab hidden / phone locked / app switched away from) for 2+ minutes — the more common "away" case on mobile than idle-with-tab-open. If it's been backgrounded for 24+ hours it signs out fully instead of just locking. Locking doesn't touch the underlying Supabase session or component state — it renders a full-screen `LockScreen` on top of the still-mounted `Dashboard` until unlocked.

Unlocking supports Face ID / Touch ID / Android biometrics via the browser's WebAuthn API (`frontend/src/lib/webauthnLock.js`), opted into per device from the Security screen, with password sign-in always available as a fallback (and as the only option until biometric unlock is enabled, or on devices/browsers without a platform authenticator). This is a **local device gate, not a Supabase-verified passkey login** — there's no server verifying the WebAuthn signature, so it's a convenience/security layer confirming "the device owner is physically present" rather than a new authentication method. True passkey-based Supabase sign-in would be a separate, larger feature.

## Referees (`/referee`)

A referee account (`/admin` → Manage → Referees → **New Referee**: name, email, optional phone) is a real Supabase Auth user, created via the service-role admin API (`api/tournament.js`, action `create-referee`) since the browser can't create auth users directly — a random password is generated and shown once for the organizer to hand off; there's no self-service password reset flow beyond Supabase's standard "forgot password" email, so resetting access today means deleting and recreating the account. Deleting a referee (`action: delete-referee`) removes the Supabase Auth user outright; their `referees` row and any `tournament_referee_assignments` cascade-delete with it.

Assigning a referee (a dropdown next to each group in the Fixtures/Groups tab, and next to a category's bracket once one exists) writes a row to `tournament_referee_assignments` — `scope: 'group'` for one group's round robin, `scope: 'bracket'` for a whole category's knockout stage. Picking a different referee replaces the assignment rather than stacking a second one; there's one assignment per group and one per category's bracket, by design — no scenario here needs more than one referee scoring the same pool of matches at a time.

Signing in at `/referee` shows only that referee's assignments as a flat list (tournament name, category name, group name or "Knockout Bracket") — tapping one opens the exact same focused scoring mode (`ScoreMode`) the organizer uses, scoped to just that group's or bracket's matches. Nothing else is reachable: no registrations, no other categories, no settings. This is enforced twice over — the UI simply doesn't render any other screen for a referee session, and RLS backs it up independently (`tournament_matches` RLS grants a referee `update` only on rows matching one of their assignments; every other tournament table is select-only for a non-organizer; `tournament_registrations`/`tournament_holds`, holding contact and payment details, aren't readable by a referee at all) — so a referee poking at the API directly, not just the UI, still can't reach anything beyond their assigned matches.

## Privacy

The public **Who's playing** view shows first name + skill level only. Phone, full name, DUPR ID, and payment details stay in Supabase (admin-only, via the service role key on the server).
