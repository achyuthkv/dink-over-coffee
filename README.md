# Dink Over Coffee

Mobile-first session registration for the Dink Over Coffee pickleball community.

- **Frontend:** Vite + React + Tailwind, deployed free on Vercel as a static SPA.
- **Backend:** Google Apps Script web app, backed by a Google Sheet (no server).
- **Payments:** Razorpay — server-side orders, signature verified before a slot is confirmed.
- **Concurrency:** Hold-then-confirm. A slot is held for 5 min when checkout starts; expired holds free up automatically.

## Repo layout

```
frontend/      Vite + React + Tailwind app
apps-script/   Google Apps Script backend (Code.gs + appsscript.json)
vercel.json    Vercel build config
```

## Setup

### 1. Google Sheet + Apps Script

1. Create a new Google Sheet. Name three tabs:
   - **Sessions** — header row: `id | date | time | venue | price | maxSlots | active`
   - **Players** — header row: `sessionId | name | phone | skill | amount | razorpay_payment_id | razorpay_order_id | createdAt`
   - **Holds** — header row: `holdId | sessionId | razorpay_order_id | createdAt | expiresAt | status`

   (Or skip — the script's `setup()` function will create them on first run.)

2. Open Extensions → Apps Script. Paste `apps-script/Code.gs` and replace `appsscript.json` (Project Settings → "Show appsscript.json").

3. Project Settings → Script properties — add:
   - `RAZORPAY_KEY_ID` = `rzp_test_...` or `rzp_live_...`
   - `RAZORPAY_KEY_SECRET` = the matching secret
   - `HOLD_TTL_MINUTES` = `5` (optional)

4. Run `setup()` once to bootstrap the sheets.

5. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy the `/exec` URL — that's `VITE_APPS_SCRIPT_URL`.

### 2. Razorpay

- In the Razorpay dashboard, generate API keys (Settings → API Keys). Use **test mode** until ready.
- The frontend only sees `VITE_RAZORPAY_KEY_ID`; the secret stays in Apps Script.
- The Apps Script verifies the `razorpay_signature` HMAC-SHA256 of `order_id|payment_id` before booking the slot.

### 3. Frontend (local dev)

```bash
cd frontend
cp .env.example .env.local
# fill in VITE_APPS_SCRIPT_URL and VITE_RAZORPAY_KEY_ID
npm install
npm run dev
```

### 4. Deploy on Vercel

1. Push this repo to GitHub.
2. Import into Vercel. Vercel will read `vercel.json` and run `cd frontend && npm install && npm run build`.
3. Add the env vars in **Settings → Environment Variables**:
   - `VITE_APPS_SCRIPT_URL`
   - `VITE_RAZORPAY_KEY_ID`
4. Redeploy.

That's it — no backend server, no DB, no monthly cost.

## Adding a session

Open the Sheet, add a row to **Sessions**:

| id | date | time | venue | price | maxSlots | active |
|----|------|------|-------|-------|----------|--------|
| s001 | 2026-06-25 | 6:30 AM | Greenwood Courts | 300 | 12 | TRUE |

The app picks it up on the next refresh. Past-dated sessions auto-hide.

## Booking flow

1. Player picks a session, fills name/phone/skill, taps **Pay**.
2. Frontend calls Apps Script `createOrder` — Apps Script:
   - Re-checks slot availability under a `LockService` lock.
   - Creates a Razorpay order (server-side, with secret).
   - Writes a row to **Holds** with `expiresAt = now + 5 min`.
3. Razorpay checkout opens with the `order_id`.
4. On success, frontend calls `confirmPayment` with `(order_id, payment_id, signature)`. Apps Script:
   - Verifies the signature with `RAZORPAY_KEY_SECRET`.
   - Marks the hold consumed and writes a **Players** row.
5. Both **Sessions** counts and the **Who's playing** tab pull live from the Sheet.

Holds older than 5 min are auto-released on every read, so failed/abandoned checkouts free up the slot.

## Privacy

The **Who's playing** tab shows first name + skill level only. Phone and full name stay in the Sheet (admin-only).
