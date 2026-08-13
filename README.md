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
- **products** — `id, name, description, price, image_url, sizes (text[], nullable), stock (integer, nullable — null means unlimited), category, active, created_at`. Managed directly in Supabase for now; there's no admin UI for it yet.
- **shop_holds** — `id, razorpay_order_id, items (jsonb snapshot of the cart), customer (jsonb), amount, expires_at, status (active|consumed)`. Mirrors `holds` for the shop checkout — reserves stock while a Razorpay payment is in flight.
- **shop_orders** — `id, customer_name, phone, email, address, city, pincode, amount, currency, razorpay_order_id, razorpay_payment_id, status (pending|confirmed), items (jsonb), created_at`. `pending` means the buyer chose to pay manually via UPI (no Razorpay key configured); `confirmed` means Razorpay verified the payment.

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
3. On successful payment, frontend calls `shop` with `action: 'confirm-payment'`, which verifies the signature, inserts a **shop_orders** row (`status: confirmed`), decrements product stock, and emails a confirmation if Resend is configured.

**No Razorpay key:**
1. Frontend calls `shop` with `action: 'order'` directly — the order is inserted as `status: pending`, stock is decremented, and the response includes UPI accounts so the buyer can pay manually. The organizer reconciles payment and ships once received.

## Admin (`/admin`)

Organizers sign in with Supabase Auth to manage sessions, view/promote waitlisted players, manage venues and per-session UPI payment accounts, review signed waivers, and see basic finances. `promote` is the only admin API route so far — it requires an `Authorization: Bearer <supabase access token>` header and moves a waitlisted player to confirmed.

## Privacy

The public **Who's playing** view shows first name + skill level only. Phone, full name, DUPR ID, and payment details stay in Supabase (admin-only, via the service role key on the server).
