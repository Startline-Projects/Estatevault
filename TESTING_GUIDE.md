# EstateVault — Complete Testing Guide

> Covers all changes from Phases 0–7 + Phase 5.1/5.2.
> **Branch:** Yahia-Dev
> **Last Updated:** 2026-05-29

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [How to Use Postman](#2-how-to-use-postman)
3. [How to Test in the Browser](#3-how-to-test-in-the-browser)
4. [Phase 0 — Security Lockdown Tests](#4-phase-0--security-lockdown-tests)
5. [Phase 1 — Foundation Hardening Tests](#5-phase-1--foundation-hardening-tests)
6. [Phase 2 — Structural Refactor Tests](#6-phase-2--structural-refactor-tests)
7. [Phase 3 — Validation at Every Boundary Tests](#7-phase-3--validation-at-every-boundary-tests)
8. [Phase 4 — Reliability & Scalability Tests](#8-phase-4--reliability--scalability-tests)
9. [Phase 5 — Pricing SSOT + Type Safety Tests](#9-phase-5--pricing-ssot--type-safety-tests)
10. [Phase 5.1/5.2 — DB Types + Migrations Tests](#10-phase-5152--db-types--migrations-tests)
11. [Phase 6 — Frontend Quality Tests](#11-phase-6--frontend-quality-tests)
12. [Phase 7 — Lock It In Tests](#12-phase-7--lock-it-in-tests)
13. [End-to-End User Flow Tests](#13-end-to-end-user-flow-tests)
14. [Quick Regression Checklist](#14-quick-regression-checklist)

---

## 1. Prerequisites & Setup

### Install & verify gate

```bash
npm install
npx tsc --noEmit        # expect 0 errors
npm run lint             # expect 0 errors (warnings OK)
npm test                 # expect 193/193 passing
```

### Environment variables

Create `.env.local` with all required vars. Key ones for testing:

| Variable | Value for testing |
|----------|-------------------|
| `CRON_SECRET` | Any random string, e.g. `my-cron-secret-123` |
| `UPSTASH_REDIS_REST_URL` | Real or test Upstash URL |
| `UPSTASH_REDIS_REST_TOKEN` | Real or test Upstash token |
| `STRIPE_SECRET_KEY` | Stripe **test mode** key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe test webhook secret (`whsec_...`) |
| `ANTHROPIC_API_KEY` | Valid Anthropic key |
| `RESEND_API_KEY` | Valid Resend key |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `MASTER_KEY` | 32-byte hex master encryption key |

### Start dev server

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Stripe CLI (for webhook testing)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Test Stripe card numbers

| Card | Scenario |
|------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | 3D Secure required |

Use any future expiry date, any 3-digit CVC, any ZIP.

---

## 2. How to Use Postman

### Setting up Postman

1. Create a new Postman Collection called "EstateVault"
2. Set a collection variable `BASE_URL` = `http://localhost:3000`
3. For authenticated requests, you need Supabase auth tokens

### Getting an auth token

**Option A — Browser DevTools:**
1. Log in at `http://localhost:3000/auth/login`
2. Open DevTools → Application → Local Storage → find `sb-*-auth-token`
3. Copy the `access_token` value

**Option B — Postman request:**
```
POST {{BASE_URL}}/auth/v1/token?grant_type=password
Headers:
  apikey: <your NEXT_PUBLIC_SUPABASE_ANON_KEY>
  Content-Type: application/json
Body:
{
  "email": "your-test-user@example.com",
  "password": "your-password"
}
```
Copy `access_token` from response.

### Using the auth token

For all authenticated requests, add these headers in Postman:

```
Cookie: sb-access-token=<your_access_token>; sb-refresh-token=<your_refresh_token>
```

Or use the Supabase anon key approach:
```
Authorization: Bearer <your_access_token>
apikey: <your NEXT_PUBLIC_SUPABASE_ANON_KEY>
```

### Request format

All API routes expect:
- `Content-Type: application/json`
- JSON body for POST/PUT/PATCH
- Success returns: `{ "ok": true, "data": ... }`
- Error returns: `{ "ok": false, "error": "..." }` with appropriate HTTP status

### Postman tip: save as collection

Create folders in your Postman collection matching the test sections below. Save each request so you can re-run them.

---

## 3. How to Test in the Browser

### Public pages (no login needed)

| URL | What to check |
|-----|---------------|
| `http://localhost:3000/` | Landing page loads, scroll animations work |
| `http://localhost:3000/quiz` | Quiz starts, all 7 modules work |
| `http://localhost:3000/will` | Will intake form loads |
| `http://localhost:3000/trust` | Trust intake form loads |
| `http://localhost:3000/contact` | Contact form with validation |
| `http://localhost:3000/professionals` | Professionals page with pricing |
| `http://localhost:3000/privacy` | Privacy policy |
| `http://localhost:3000/terms` | Terms of service |
| `http://localhost:3000/sitemap.xml` | 8 public URLs listed |
| `http://localhost:3000/robots.txt` | Portal paths disallowed |

### Authenticated pages (login first at `/auth/login`)

| URL | Role needed | What to check |
|-----|-------------|---------------|
| `http://localhost:3000/dashboard` | client | Dashboard with completion ring |
| `http://localhost:3000/dashboard/documents` | client | Document list + download |
| `http://localhost:3000/dashboard/vault` | client | Vault PIN + categories |
| `http://localhost:3000/dashboard/amendment` | client | Amendment form |
| `http://localhost:3000/dashboard/settings` | client | Account settings |
| `http://localhost:3000/dashboard/life-events` | client | Life events page |
| `http://localhost:3000/pro` | partner | Partner portal |
| `http://localhost:3000/pro/dashboard` | partner | Revenue + clients |
| `http://localhost:3000/pro/settings` | partner | Partner settings |
| `http://localhost:3000/sales/dashboard` | sales_rep/admin | Sales dashboard |
| `http://localhost:3000/attorney` | review_attorney | Attorney portal |

---

## 4. Phase 0 — Security Lockdown Tests

### 4.1 CRON_SECRET Guard (S-01, S-03)

These routes require Bearer token matching your `CRON_SECRET` env var.

**Postman — `/api/documents/process` (S-01):**

| # | Method | URL | Headers | Expected |
|---|--------|-----|---------|----------|
| 1 | GET | `{{BASE_URL}}/api/documents/process` | (none) | 401 `{"ok":false,"error":"..."}` |
| 2 | GET | `{{BASE_URL}}/api/documents/process` | `Authorization: Bearer wrong-secret` | 401 |
| 3 | GET | `{{BASE_URL}}/api/documents/process` | `Authorization: Bearer my-cron-secret-123` | 200 (or empty batch) |

**Postman — `/api/documents/cleanup-test-orders` (S-03):**

| # | Method | URL | Headers | Expected |
|---|--------|-----|---------|----------|
| 1 | POST | `{{BASE_URL}}/api/documents/cleanup-test-orders` | (none) | 401 |
| 2 | POST | `{{BASE_URL}}/api/documents/cleanup-test-orders` | `Authorization: Bearer my-cron-secret-123` | 200 |

### 4.2 Admin-Only Route (S-02)

**Postman — `/api/documents/process-now`:**

| # | Method | URL | Auth | Body | Expected |
|---|--------|-----|------|------|----------|
| 1 | POST | `{{BASE_URL}}/api/documents/process-now` | (none) | `{}` | 401 |
| 2 | POST | `{{BASE_URL}}/api/documents/process-now` | Client user token | `{}` | 403 |
| 3 | POST | `{{BASE_URL}}/api/documents/process-now` | Admin user token | `{"orderId":"some-uuid"}` | 200 or validation error |

### 4.3 Auth + Ownership (S-04)

**Postman — `/api/documents/check-status`:**

| # | Method | URL | Auth | Expected |
|---|--------|-----|------|----------|
| 1 | GET | `{{BASE_URL}}/api/documents/check-status?order_id=any-uuid` | (none) | 401 |
| 2 | GET | `{{BASE_URL}}/api/documents/check-status?order_id=SOMEONE_ELSES_ORDER` | Your token | 403 |
| 3 | GET | `{{BASE_URL}}/api/documents/check-status?order_id=YOUR_ORDER_ID` | Your token | 200 with status |

### 4.4 Partner Role + Ownership (S-05)

**Postman — `/api/partner/clients`:**

| # | Method | URL | Auth | Body | Expected |
|---|--------|-----|------|------|----------|
| 1 | POST | `{{BASE_URL}}/api/partner/clients` | (none) | `{}` | 401 |
| 2 | POST | `{{BASE_URL}}/api/partner/clients` | Client user token | `{"firstName":"Test","email":"t@t.com","partnerId":"xxx"}` | 403 |
| 3 | POST | `{{BASE_URL}}/api/partner/clients` | Partner token, **different** partner's ID | `{"firstName":"Test","email":"t@t.com","partnerId":"WRONG_PARTNER_ID"}` | 403 |
| 4 | POST | `{{BASE_URL}}/api/partner/clients` | Partner token, **own** partner ID | `{"firstName":"Test","email":"new@test.com","partnerId":"YOUR_PARTNER_ID"}` | 200 |

### 4.5 Sales Rep/Admin Only (S-06)

**Postman — `/api/sales/partner-notes`:**

| # | Method | URL | Auth | Expected |
|---|--------|-----|------|----------|
| 1 | GET | `{{BASE_URL}}/api/sales/partner-notes?partnerId=xxx` | (none) | 401 |
| 2 | GET | `{{BASE_URL}}/api/sales/partner-notes?partnerId=xxx` | Client token | 403 |
| 3 | GET | `{{BASE_URL}}/api/sales/partner-notes?partnerId=xxx` | Sales rep token | 200 |
| 4 | POST | `{{BASE_URL}}/api/sales/partner-notes` | Admin token | Body: `{"partnerId":"xxx","note":"Test note"}` → 200 |

### 4.6 Account Takeover Fix (S-07)

**Postman — `/api/auth/set-password`:**

| # | Method | URL | Body | Expected |
|---|--------|-----|------|----------|
| 1 | POST | `{{BASE_URL}}/api/auth/set-password` | `{}` | 400 "invalid payload" |
| 2 | POST | `{{BASE_URL}}/api/auth/set-password` | `{"email":"a@b.com","password":"12345678","fullName":"X","verifiedToken":"fake-token"}` | 400/401 token invalid |
| 3 | POST | `{{BASE_URL}}/api/auth/set-password` | Valid email + password + real verifiedToken from email flow | 200 |
| 4 | POST | `{{BASE_URL}}/api/auth/set-password` | Same verifiedToken again | Rejected (one-time use) |
| 5 | POST | `{{BASE_URL}}/api/auth/set-password` | Send 10+ rapid requests | 429 rate limited |

### 4.7 Hostname Injection (S-08)

**Postman:**

| # | URL | Headers | Expected |
|---|-----|---------|----------|
| 1 | `{{BASE_URL}}/` | (default Host) | Normal page loads |
| 2 | `{{BASE_URL}}/` | `Host: evil";DROP TABLE--` | Request proceeds, no DB injection (hostname sanitized in middleware) |

### 4.8 Stripe Webhook Idempotency (S-09)

**CLI:**
```bash
# Terminal 1: forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 2: trigger event
stripe trigger checkout.session.completed
```

| # | Test | Expected |
|---|------|----------|
| 1 | First trigger | 200, order created |
| 2 | Replay same event (same event ID) | 200 with `{ "duplicate": true }` — no second order created |

### 4.9 DEK Race Condition (S-10)

**Browser:**
1. Log in as new client → go to `/dashboard/vault`
2. First vault access triggers DEK bootstrap
3. Verify vault works (can create PIN, add items)

### 4.10 Rate Limits (M-01, M-02)

**Postman — `/api/farewell/verify` (M-01):**

Send 20+ rapid POST requests → eventually get 429.

**Postman — `/api/farewell/access` (M-02):**

```
POST {{BASE_URL}}/api/farewell/access
Body: {"clientId":"any-uuid","trusteeEmail":"test@test.com"}
```

Send 6+ requests within 1 minute → 429 after 5.

### 4.11 IDOR Fix (M-03)

**Postman — `/api/documents/download-by-session`:**

| # | Method | URL | Expected |
|---|--------|-----|----------|
| 1 | GET | `{{BASE_URL}}/api/documents/download-by-session?session_id=VALID_STRIPE_SESSION` | 200 (download) |
| 2 | GET | `{{BASE_URL}}/api/documents/download-by-session?order_id=SOMEONE_ELSES_PAID_ORDER` | Rejected (paid orders need session_id) |
| 3 | GET | `{{BASE_URL}}/api/documents/download-by-session?order_id=TEST_ORDER_ID` | Allowed (test orders use order_id fallback) |

### 4.12 Partner CSS XSS (M-04)

**Database test (Supabase Dashboard):**

Update a partner's `accent_color` in the `partners` table, then visit their white-label page:

| Value | Expected |
|-------|----------|
| `#C9A84C` | Color applied correctly |
| `<script>alert(1)</script>` | Falls back to `#C9A84C` |
| `red` (not hex) | Falls back to `#C9A84C` |

### 4.13 Stripe Error Masking (M-14)

**Postman — `/api/webhooks/stripe`:**

```
POST {{BASE_URL}}/api/webhooks/stripe
Headers:
  stripe-signature: invalid-signature
Body: (any)
```

Expected: Response says "Webhook signature verification failed" — NOT internal Stripe error details.

### 4.14 Cron Fail-Closed (H-03)

Remove `CRON_SECRET` from `.env.local`, restart server, then test each route:

| Route | Method | Expected |
|-------|--------|----------|
| `{{BASE_URL}}/api/cron/annual-review-reminder` | GET | 401 |
| `{{BASE_URL}}/api/cron/life-event-checkin` | GET | 401 |
| `{{BASE_URL}}/api/cron/farewell-window-expired` | GET | 401 |
| `{{BASE_URL}}/api/cron/farewell-veto-reminder` | GET | 401 |

**Restore `CRON_SECRET` after testing.**

### 4.15 No Temp Password in API Response (H-05)

**Postman — `/api/sales/create-partner`:**

```
POST {{BASE_URL}}/api/sales/create-partner
Auth: Sales rep or admin token
Body:
{
  "companyName": "Test Firm",
  "ownerName": "Test Owner",
  "email": "newpartner@test.com"
}
```

Expected: Response JSON has NO `tempPassword` field. Password delivered via email only.

**Postman — `/api/sales/create-rep`:**

```
POST {{BASE_URL}}/api/sales/create-rep
Auth: Admin token
Body:
{
  "fullName": "New Rep",
  "email": "newrep@test.com",
  "commissionRate": 10
}
```

Expected: Response JSON has NO `tempPassword` field.

### 4.16 Partner Activated Email Role Check (M-05)

**Postman — `/api/email/partner-activated`:**

| # | Auth | Expected |
|---|------|----------|
| 1 | Sales rep token | 200 |
| 2 | Admin token | 200 |
| 3 | Client token | 403 |

---

## 5. Phase 1 — Foundation Hardening Tests

### 5.1 Fail-Fast on Missing Secrets (H-06)

| # | Test | How | Expected |
|---|------|-----|----------|
| 1 | Remove `STRIPE_SECRET_KEY` from `.env.local` | Restart `npm run dev` | Console error about missing env var |
| 2 | Try to call any Stripe endpoint | Postman: `POST {{BASE_URL}}/api/checkout/will` | Error (not silent placeholder behavior) |
| 3 | Restore `.env.local` | Restart dev server | Normal operation |

### 5.2 Unified Stripe Client (H-07)

**Browser:** Process a Stripe checkout (will or trust) → payment works. Partner payout triggers → uses same API version.

### 5.3 Image Remote Patterns (M-12)

**Browser:**
1. Visit any page with images from `*.supabase.co` → load correctly via `next/image`
2. Inspect page source → no wildcard image loading from arbitrary hosts

### 5.4 Webhook maxDuration (M-13)

**File check:** Open `vercel.json` → confirm `app/api/webhooks/stripe/route.ts` has `maxDuration: 300`.

### 5.5 Test Suite (H-11)

```bash
npm test
# Expect 193/193 tests passing across 19 test files
```

---

## 6. Phase 2 — Structural Refactor Tests

### 6.1 Kernel Pattern — Consistent Response Format

Every API route now returns consistent JSON. Test any route:

**Postman:**

| # | Test | Expected response shape |
|---|------|------------------------|
| 1 | Success response from any route | `{ "ok": true, "data": ... }` |
| 2 | Error response from any route | `{ "ok": false, "error": "..." }` with correct HTTP status |
| 3 | Unhandled exception in any route | `{ "ok": false, "error": "internal error" }` 500 |

**Quick test — contact form:**

```
POST {{BASE_URL}}/api/contact
Body: {"name":"Test","email":"test@test.com","message":"This is a test message for contact."}
```
Expected: `{ "ok": true }` with 200.

### 6.2 Checkout Dedup (H-10)

**Browser:**

| # | Test | Expected |
|---|------|----------|
| 1 | Complete will checkout at `/will/checkout` | Stripe session created, redirected to `/will/success` |
| 2 | Complete trust checkout at `/trust/checkout` | Same behavior |
| 3 | Trust with complexity flag + attorney review | Override prompt appears, attorney review added |

**Postman — Promo codes:**

```
POST {{BASE_URL}}/api/checkout/will
Body:
{
  "intakeAnswers": {"email":"promo@test.com","firstName":"Promo","lastName":"Test"},
  "email": "promo@test.com",
  "promoCode": "TEST"
}
```
Expected: Free promo path, no Stripe redirect, `order_type: "test"`.

```
POST {{BASE_URL}}/api/checkout/will
Body:
{
  "intakeAnswers": {"email":"promo2@test.com","firstName":"Free","lastName":"User"},
  "email": "promo2@test.com",
  "promoCode": "FREE134"
}
```
Expected: Free path, no Stripe redirect.

---

## 7. Phase 3 — Validation at Every Boundary Tests

All POST/PUT/PATCH routes now validate input with Zod. Test with invalid payloads → expect 400.

### 7.1 Invalid Payload Tests (Postman)

**Contact form — missing fields:**
```
POST {{BASE_URL}}/api/contact
Body: {"name":""}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

**Contact form — bad email:**
```
POST {{BASE_URL}}/api/contact
Body: {"name":"Test","email":"not-an-email","message":"Hello there friend"}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

**Auth signup — missing token:**
```
POST {{BASE_URL}}/api/auth/signup
Body: {"email":"test@test.com","password":"12345678"}
```
Expected: `400 {"ok":false,"error":"invalid payload"}` (missing `verifiedToken`)

**Auth set-password — empty body:**
```
POST {{BASE_URL}}/api/auth/set-password
Body: {}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

**Partner clients — wrong type:**
```
POST {{BASE_URL}}/api/partner/clients
Auth: Partner token
Body: {"partnerId":123}
```
Expected: `400 {"ok":false,"error":"invalid payload"}` (partnerId must be string)

**Sales create partner — missing required:**
```
POST {{BASE_URL}}/api/sales/create-partner
Auth: Sales rep token
Body: {"email":"only@email.com"}
```
Expected: `400 {"ok":false,"error":"invalid payload"}` (missing `companyName`, `ownerName`)

**Attorney approve — missing reviewId:**
```
POST {{BASE_URL}}/api/attorney/approve
Auth: Attorney token
Body: {}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

**Documents generate — empty:**
```
POST {{BASE_URL}}/api/documents/generate
Auth: Client token
Body: {}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

**Auth check-email — bad email:**
```
POST {{BASE_URL}}/api/auth/check-email
Body: {"email":"not-valid"}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

**Vault PIN — bad PIN format:**
```
POST {{BASE_URL}}/api/vault/pin
Auth: Client token
Body: {"action":"create","pin":"abc"}
```
Expected: `400 {"ok":false,"error":"invalid payload"}` (PIN must be 6 digits)

**Amendment checkout — missing fields:**
```
POST {{BASE_URL}}/api/checkout/amendment
Auth: Client token
Body: {}
```
Expected: `400 {"ok":false,"error":"invalid payload"}`

### 7.2 Valid Payload Tests (Postman)

**Contact form:**
```
POST {{BASE_URL}}/api/contact
Body: {"name":"Valid User","email":"valid@email.com","message":"This is a valid message for testing."}
```
Expected: `200 {"ok":true}`

**Auth check-email:**
```
POST {{BASE_URL}}/api/auth/check-email
Body: {"email":"test@example.com"}
```
Expected: `200 {"ok":true,"data":...}`

**Auth send-verify-code:**
```
POST {{BASE_URL}}/api/auth/send-verify-code
Body: {"email":"test@example.com"}
```
Expected: `200 {"ok":true,...}`

### 7.3 Full Schema Reference (for Postman body construction)

| Route | Method | Schema Fields |
|-------|--------|---------------|
| `/api/contact` | POST | `name` (string, required), `email` (valid email), `message` (string, required) |
| `/api/auth/check-email` | POST | `email` (valid email) |
| `/api/auth/send-verify-code` | POST | `email` (valid email), `partnerSlug?`, `partnerId?` |
| `/api/auth/verify-code` | POST | `email` (valid email), `code` (string) |
| `/api/auth/signup` | POST | `email` (valid email), `password` (8+ chars), `verifiedToken` (string), `fullName?`, `partnerSlug?` |
| `/api/auth/set-password` | POST | `email` (valid email), `password` (8+ chars), `verifiedToken` (string), `fullName?` |
| `/api/auth/recovery` | POST | `email` (valid email) |
| `/api/checkout/will` | POST | `intakeAnswers` (object with `email?`, `firstName?`, `lastName?`), `email?`, `promoCode?`, `userId?`, `attorneyReview?` (bool), `partnerId?`, `customerEmail?` |
| `/api/checkout/trust` | POST | Same as will + `complexityFlag?` (bool), `complexityReasons?` (string[]), `declinedAttorneyReview?` (bool), `confirmOverride?` (bool) |
| `/api/checkout/amendment` | POST | `userId` (string), `changeType` (string), `description` (string) |
| `/api/documents/generate` | POST | `order_id` (string) |
| `/api/partner/clients` | POST | `firstName` (string), `email` (valid email), `partnerId` (string), `lastName?`, `action?` |
| `/api/sales/create-partner` | POST | `companyName` (string), `ownerName` (string), `email` (valid email), `tier?` ("basic"/"standard"/"enterprise"), `promoCode?`, `phone?`, `source?`, `notes?` |
| `/api/sales/create-rep` | POST | `fullName` (string), `email` (valid email), `commissionRate` (number 0-100) |
| `/api/sales/partner-notes` | POST | `partnerId` (string), `note` (string) |
| `/api/attorney/approve` | POST | `reviewId` (string) |
| `/api/admin/test-promo` | POST | `active` (boolean) |
| `/api/vault/pin` | POST | `action` ("check"/"create"/"verify"/"change"), `pin?` (6 digits), `newPin?` (6 digits) |
| `/api/farewell/access` | POST | `clientId` (string), `trusteeEmail` (valid email) |
| `/api/partner/vault-subdomain` | POST | `partnerId` (string), `subdomain` (lowercase alphanumeric + hyphens, 3-52 chars) |

---

## 8. Phase 4 — Reliability & Scalability Tests

### 8.1 KEK Cache TTL (M-11)

**Code verification:** Open `lib/api/dek.ts` and confirm:
- `KEK_TTL_MS = 300000` (5 minutes)
- `getKek()` checks `Date.now() - kekCachedAt < KEK_TTL_MS`

After 5 min of no crypto operations, next operation re-derives KEK from env.

### 8.2 Audit Log Durability (L-05)

**Browser:**
1. Perform any auditable action (download document, mark executed, etc.)
2. Check Supabase Dashboard → `audit_log` table → entry exists with correct action, user, timestamp

**Supabase SQL:**
```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5;
```

### 8.3 Cron Pagination (M-09)

**Code verification:**
- `lib/repos/server/orderRepo.ts` → `findDeliveredBefore()` has `.order("delivered_at", { ascending: true }).limit(50)`
- `lib/repos/server/farewellVerificationRepo.ts` → `findActiveVetoWindows()` has `.limit(50)`

### 8.4 Email Retry (M-07)

**Browser:**
1. Trigger any email-sending action (signup, document delivery, contact form)
2. Email sent successfully

**If Resend is down:** Check console logs — up to 3 attempts with exponential backoff (200ms, 600ms) before failure.

### 8.5 Redis Queue Hardening (M-10)

**Postman:**
```
POST {{BASE_URL}}/api/documents/generate
Auth: Client token
Body: {"order_id":"YOUR_ORDER_ID"}
```

| # | Test | Expected |
|---|------|----------|
| 1 | Generate document | Job created, document processing starts |
| 2 | Check Redis keys | `job:*` keys have 24h TTL |
| 3 | If Redis not configured | Throws error "Redis not configured" (not silent drop) |

### 8.6 Per-Document Status Tracking (M-08)

**Supabase SQL after document generation:**
```sql
SELECT id, order_id, document_type, status, error_message
FROM documents
WHERE order_id = 'YOUR_ORDER_ID';
```

| # | Scenario | Expected |
|---|----------|----------|
| 1 | All docs succeed | All statuses = "generated" or "delivered", order status = "delivered" |
| 2 | 1 doc fails | Failed doc has `status: "failed"`, order stays in current status |
| 3 | Re-run process | Only failed documents retried |

---

## 9. Phase 5 — Pricing SSOT + Type Safety Tests

### 9.1 Pricing Consistency (Browser)

Open each page and verify dollar amounts match:

| Price | Value | Pages to check |
|-------|-------|----------------|
| Will Package | **$400** | `/will/checkout`, `/quiz` (after getting Will result), landing page pricing cards |
| Trust Package | **$600** | `/trust/checkout`, `/quiz` (after getting Trust result), landing page pricing cards |
| Amendment | **$50** | `/dashboard/amendment`, `/dashboard/documents`, `/dashboard/life-events`, FAQ section |
| Attorney Review | **$300** | `/will/checkout` (toggle), `/trust/checkout` (toggle) |
| Vault Subscription | **$99/year** | `/dashboard/vault`, FAQ section |

### 9.2 Partner Earnings Display (Browser)

Log in as partner, check these pages:

| Tier | Will earnings | Trust earnings | Pages |
|------|---------------|----------------|-------|
| Standard | **$300** | **$400** | `/pro/onboarding/step-3`, `/pro/preview`, `/pro/settings` |
| Enterprise | **$350** | **$450** | Same pages |

### 9.3 Promo Code Tests (Postman)

**Will checkout with "TEST":**
```
POST {{BASE_URL}}/api/checkout/will
Body:
{
  "intakeAnswers": {"email":"test-promo@test.com","firstName":"Test","lastName":"Promo"},
  "email": "test-promo@test.com",
  "promoCode": "TEST"
}
```
Expected: Free path, `order_type: "test"`, no Stripe redirect.

**Will checkout with "FREE134":**
```
POST {{BASE_URL}}/api/checkout/will
Body:
{
  "intakeAnswers": {"email":"free134@test.com","firstName":"Free","lastName":"User"},
  "email": "free134@test.com",
  "promoCode": "FREE134"
}
```
Expected: Free path, no Stripe redirect.

**Will checkout with invalid code:**
```
POST {{BASE_URL}}/api/checkout/will
Body:
{
  "intakeAnswers": {"email":"paid@test.com","firstName":"Paid","lastName":"User"},
  "email": "paid@test.com",
  "promoCode": "INVALID_CODE"
}
```
Expected: Normal paid Stripe checkout flow (code ignored).

**Partner creation with "FREE676":**
```
POST {{BASE_URL}}/api/sales/create-partner
Auth: Sales rep token
Body:
{
  "companyName": "Free Partner Firm",
  "ownerName": "Free Partner",
  "email": "free676@test.com",
  "promoCode": "FREE676"
}
```
Expected: Partner created without Stripe payment.

---

## 10. Phase 5.1/5.2 — DB Types + Migrations Tests

### 10.1 Verify DB Types Are Wired

```bash
npx tsc --noEmit
# 0 errors — types file is actively used by all Supabase clients
```

### 10.2 Verify Migrations Applied

**Supabase SQL Editor:**

```sql
-- Test stripe_webhook_events table exists
SELECT * FROM stripe_webhook_events LIMIT 1;
-- Expected: table exists (may be empty)

-- Test find_auth_user_by_email RPC
SELECT find_auth_user_by_email('test@example.com');
-- Expected: returns user or empty array (no error)

-- Test reminder tracking columns
SELECT last_annual_review_sent_at, last_life_event_checkin_sent_at FROM clients LIMIT 1;
-- Expected: columns exist

-- Test attorney reviewed docs columns
SELECT review_docx_path, reviewed_path, reviewed_by FROM documents LIMIT 1;
-- Expected: columns exist

-- Test DEK columns
SELECT wrapped_dek, dek_setup_at FROM clients LIMIT 1;
-- Expected: columns exist
```

### 10.3 Structural Bugs Fixed by Types

These were real bugs caught when DB types were applied. Verify correct behavior:

**Browser — Sales partner detail page:**
1. Log in as sales rep → navigate to a partner's detail page
2. Check that audit log entries display correctly (uses `metadata` column, not old `details`)
3. Check that partner notes display correctly (uses `note` column, not old `content`)

**Postman — Partner revenue:**
```
GET {{BASE_URL}}/api/partner/revenue
Auth: Partner token
```
Expected: Revenue data loads correctly (uses `payouts` table, not non-existent `transfer_id` on orders).

---

## 11. Phase 6 — Frontend Quality Tests

### 11.1 Loading States (Browser)

Hard refresh (Ctrl+Shift+R) each page and watch for branded spinner:

| URL | Expected loading text |
|-----|----------------------|
| `/dashboard` | Navy spinner + "Loading dashboard..." |
| `/pro` | Navy spinner + "Loading partner portal..." |
| `/sales` | Navy spinner + "Loading sales portal..." |
| `/attorney` | Navy spinner + "Loading attorney portal..." |
| `/auth/login` | Navy spinner + "Loading..." |

### 11.2 Error Boundaries (Browser)

Simulate errors (e.g., break a fetch by temporarily disconnecting from Supabase):

| URL | Expected |
|-----|----------|
| `/dashboard` | Error page with "Try Again" + "Back to Dashboard" buttons |
| `/quiz` | Error page with "Try Again" + "Restart Quiz" buttons |

### 11.3 Accessibility (Browser)

**FAQ Accordion:**
1. Go to landing page or any page with FAQ
2. Tab to a question, press Enter → opens/closes
3. Inspect element → `aria-expanded` toggles between true/false
4. Screen reader should announce state changes

**Vault Modal:**
1. Go to `/dashboard/vault` → open any item
2. Modal has `role="dialog"` and `aria-modal="true"`
3. Tab key cycles focus within modal (focus trap)
4. Escape key closes modal

**Login Form:**
1. Go to `/auth/login` → submit with empty email
2. Field shows `aria-invalid="true"`
3. Error message has `role="alert"`

**Contact Form:**
1. Go to `/contact`
2. Click into Name field then blur (leave empty) → red border + "Name is required"
3. Type "abc" in Email then blur → red border + "Valid email required"
4. Type "short" in Message then blur → red border + "At least 10 characters"
5. Inspect fields → `aria-invalid="true"` and `aria-describedby` present

**Signup Form:**
1. Go to `/auth/signup`
2. Type password with < 8 chars → strength indicators show incomplete
3. Type different confirm password → "Passwords do not match"
4. Inspect → `aria-invalid` and `aria-describedby` present

**Amendment Form:**
1. Go to `/dashboard/amendment` (logged in as client)
2. Don't select change type, blur → red border + error
3. Leave description empty, blur → red border + error
4. Inspect → `aria-invalid` and `aria-describedby` present

**Reset Password:**
1. Go to `/auth/reset-password` (with valid token)
2. Type < 8 chars → requirements checklist shows incomplete
3. Type different confirm password → "Passwords do not match"
4. Inspect → `aria-invalid` and `aria-describedby` present

### 11.4 SEO (Browser/Postman)

**Postman or browser:**

```
GET {{BASE_URL}}/sitemap.xml
```
Expected: 8 public URLs listed (/, /quiz, /will, /trust, /professionals, /contact, /privacy, /terms).

```
GET {{BASE_URL}}/robots.txt
```
Expected: Disallow lines for `/dashboard/`, `/pro/`, `/sales/`, `/attorney/`, `/api/`, `/auth/`, `/trustee/`, `/farewell/`.

**Browser — View Page Source (Ctrl+U):**

| Page | Expected `<title>` |
|------|--------------------|
| `/quiz` | `Estate Planning Quiz \| EstateVault` |
| `/will` | `Create Your Will \| EstateVault` |
| `/trust` | `Create Your Trust \| EstateVault` |
| `/contact` | `Contact Us \| EstateVault` |
| `/professionals` | `For Professionals \| EstateVault` |

### 11.5 Performance (Browser)

**Landing page `/`:**
1. Load page → content visible immediately (no JS-based scroll animation)
2. CSS `scroll-reveal` class handles reveal via `animation-timeline: view()`
3. No-support browsers show content immediately

**Partner logos:**
1. Inspect any partner logo in DevTools
2. Should render via `<img>` from `next/image` (has `srcset`, `loading` attributes)
3. NOT raw `<img>` tags

### 11.6 Vault Decomposition (F-03)

**Browser:**
1. Go to `/dashboard/vault`
2. Create PIN → enter vault → everything works as before
3. Add items, upload documents, view category lists
4. Open item detail modal → focus trap works, Escape closes

Verify pixel-identical output — decomposition was structural only, no visual changes.

---

## 12. Phase 7 — Lock It In Tests

### 12.1 ESLint Enforcement

```bash
npm run lint
# Expect 0 errors
```

Verify these rules catch violations (optional — for confidence):

```bash
# Should find 0 raw fetch calls in app/components
npx grep -r "fetch(\"/api/" app/ components/ || echo "PASS: no raw fetch"

# Should find 0 local createAdminClient declarations in routes
npx grep -r "function createAdminClient\|const createAdminClient" app/api/ || echo "PASS: no local admin client"
```

### 12.2 CI Gate

Push branch to GitHub → CI runs automatically on PR to `master`.

CI steps: install → tsc → lint → test. All must pass.

### 12.3 Typed API Client

**Browser:**
1. Use any feature: checkout, settings, vault, partner portal
2. Open DevTools Console → no errors about fetch failures
3. All API calls go through typed client (no raw `fetch("/api/...")`)

**Verification:**
```bash
# PowerShell
Select-String -Path "app\**\*.tsx","app\**\*.ts","components\**\*.tsx","components\**\*.ts" -Pattern 'fetch\("/api/' -Recurse
# Expected: 0 matches (all migrated to typed client)
```

---

## 13. End-to-End User Flow Tests

### Flow 1: Client — Will Purchase (Browser)

```
Step 1: Go to http://localhost:3000/quiz
Step 2: Complete quiz — choose answers that lead to "Will" recommendation:
        - Michigan resident, single
        - No children
        - No real estate, no business
        - Net worth under $150K
        - Privacy not important
Step 3: Get "Will" recommendation → click "Get Started"
Step 4: Fill out will intake (7 cards):
        - Residency: Michigan, single
        - About You: name, DOB (must be 18+), city
        - Executor: primary + successor names
        - Beneficiaries: at least 1 with name + relationship + share
        - Guardian: skip (no minor children)
        - Gifts: organ donation choice
        - Review: check all fields, click checkout
Step 5: On /will/checkout page:
        - Verify price shows $400
        - Toggle attorney review → verify price shows $700
        - Uncheck attorney review → back to $400
        - Click Pay
Step 6: Stripe checkout:
        - Card: 4242 4242 4242 4242
        - Any future expiry, any CVC
        - Complete payment
Step 7: Redirected to /will/success → set password
Step 8: Log in at /auth/login → /dashboard
Step 9: Documents should show "generating" → poll until "delivered"
Step 10: Download document → verify PDF opens
```

### Flow 2: Client — Trust Purchase (Browser)

```
Step 1: Go to /quiz → complete with answers leading to "Trust":
        - Michigan resident, married
        - Children: yes, no special needs
        - Real estate: yes
        - Net worth over $150K
Step 2: Get "Trust" recommendation → click "Get Started"
Step 3: Fill out trust intake → checkout
Step 4: Verify price shows $600 on /trust/checkout
Step 5: If complexity flag triggered → see attorney review prompt
Step 6: Complete Stripe test payment
Step 7: Success → login → dashboard → documents → verify 4 docs generated:
        trust, pour_over_will, poa, healthcare_directive
```

### Flow 3: Partner — Full Onboarding (Browser + Postman)

```
Step 1 (Postman): Create partner via API
  POST {{BASE_URL}}/api/sales/create-partner
  Auth: Sales rep token
  Body:
  {
    "companyName": "Test Law Firm",
    "ownerName": "Jane Partner",
    "email": "partner-test@example.com",
    "tier": "standard"
  }

Step 2: Check partner's email → receive welcome email with temp password

Step 3 (Browser): Log in at http://localhost:3000/auth/login
  - Email: partner-test@example.com
  - Password: (from email)

Step 4: Redirected to /pro/onboarding/step-1
  - Complete steps 1-6 (branding, domain, team, etc.)
  - Verify pricing shows correctly at each step

Step 5: View /pro/preview → verify earnings display:
  - Standard: $300/will, $400/trust
  - Enterprise: $350/will, $450/trust

Step 6: Share client link → client completes will checkout

Step 7: Partner sees client in /pro/clients

Step 8: Partner views revenue in /pro/revenue
```

### Flow 4: Vault — Full Lifecycle (Browser)

```
Step 1: Log in as client with vault subscription
  (or purchase vault at /dashboard/vault → $99/year Stripe)

Step 2: First vault access → create 6-digit PIN
  - Type PIN, confirm PIN → vault opens

Step 3: Navigate vault categories:
  - Financial accounts, insurance, digital, physical, contacts, business, final wishes

Step 4: Add items to different categories:
  - Click category → "Add Item"
  - Fill fields → save
  - Verify item appears in list

Step 5: Upload document:
  - Click "Upload" → select PDF (max 20MB)
  - Verify upload completes

Step 6: Set up farewell messages:
  - Go to /dashboard/vault/farewell
  - Create message: title + recipient email
  - Record or upload video

Step 7: Add trustee:
  - Go to /dashboard/vault/trustees
  - Add trustee: name, email, relationship
  - Select scope (farewell, documents, categories)

Step 8: Verify PIN lock:
  - Close tab, reopen /dashboard/vault
  - Must re-enter PIN (or auto-locks after 10 min)
```

### Flow 5: Attorney Review (Browser + Postman)

```
Step 1 (Postman): Create review attorney
  POST {{BASE_URL}}/api/partners/create-review-attorney
  Auth: Partner token
  Body:
  {
    "email": "attorney@test.com",
    "fullName": "Dr. Attorney",
    "barNumber": "12345"
  }

Step 2: Client purchases will/trust with attorney review (+$300)

Step 3 (Browser): Attorney logs in at /auth/login → /attorney
  - Sees pending review
  - Can view original PDF
  - Can download editable DOCX

Step 4: Attorney uploads corrected DOCX → approves review

Step 5: Client receives notification, reviewed PDF available in /dashboard/documents
```

### Flow 6: Amendment (Browser)

```
Step 1: Log in as client with existing will/trust

Step 2: Go to /dashboard/amendment

Step 3: Test frontend validation:
  - Leave change type empty → blur → red border + error
  - Leave description empty → blur → red border + error
  - Verify aria-invalid and aria-describedby attributes

Step 4: Select change type (e.g. "Beneficiary changes")

Step 5: Type description (min 1 char, max 2000)

Step 6: Submit:
  - If vault subscriber: free, redirect to /dashboard/documents?amended=true
  - If not subscriber: Stripe checkout for $50
    - Card: 4242 4242 4242 4242
    - Complete payment
    - Verify amendment processed
```

### Flow 7: Farewell & Trustee Access (Browser)

```
Step 1: Client sets up farewell messages + trustee (see Flow 4)

Step 2: Simulate trustee access at /farewell/{clientId}
  - Upload "death certificate" (PDF/JPG/PNG, max 10MB)
  - Enter trustee email
  - Submit

Step 3: Admin approves in /sales/farewell-verification

Step 4: 72-hour owner-veto window starts
  - During window: limited access
  - Test owner veto at /farewell/owner-veto

Step 5: After window expires (or for testing, check DB):
  - Trustee receives 7-day access link via email
  - Trustee enters email at /farewell/{clientId}
  - Full access: farewell messages + documents + vault categories

Step 6: Verify trustee can:
  - Play farewell video messages
  - Download documents
  - View vault item counts by category
```

### Flow 8: Affiliate (Browser + Postman)

```
Step 1 (Browser): Go to /affiliate-signup
  - Enter name, email, password
  - Accept agreement → submit

Step 2: Complete Stripe Connect onboarding

Step 3: Get referral link: /a/{affiliate_code}

Step 4: Share link → client clicks → cookie set (90-day window)

Step 5: Client purchases will/trust through that link

Step 6: Verify attribution:
  - Affiliate dashboard shows click + conversion
  - Earnings: $100/will, $200/trust
```

### Flow 9: Signup → Email Verification → Login (Browser)

```
Step 1: Go to /auth/signup

Step 2: Enter email → "Verify Email" button

Step 3: 6-digit code sent to email (check inbox or Resend dashboard)

Step 4: Enter code → verified

Step 5: Enter full name + password (8+ chars)
  - Test password strength indicators
  - Test confirm password match

Step 6: Submit → auto sign-in → redirected to /dashboard

Step 7: Sign out → go to /auth/login
  - Enter email + password → /dashboard
```

### Flow 10: Forgot Password (Browser)

```
Step 1: Go to /auth/forgot-password

Step 2: Enter email → submit
  - Test client-side email validation (bad format blocked)

Step 3: Check email for reset link (check Resend dashboard)

Step 4: Click link → /auth/reset-password?token_hash=...

Step 5: Enter new password:
  - Test < 8 chars → requirements incomplete
  - Test mismatched confirm → "Passwords do not match"
  - Enter valid matching passwords → submit

Step 6: Redirected to appropriate portal based on role
```

---

## 14. Quick Regression Checklist

Run before every deploy:

### Automated gate

```bash
npx tsc --noEmit          # 0 errors
npm run lint               # 0 errors
npm test                   # 193/193 passing
```

### Critical path smoke tests (5 minutes)

- [ ] Landing page loads at `/`
- [ ] Quiz completes and gives recommendation
- [ ] Will checkout page shows $400
- [ ] Trust checkout page shows $600
- [ ] Contact form submits successfully
- [ ] Login works for client user
- [ ] Dashboard loads with documents
- [ ] `/sitemap.xml` returns 8 URLs
- [ ] `/robots.txt` blocks portal paths
- [ ] Stripe test payment processes (card `4242...`)

### Security smoke tests (5 minutes, Postman)

- [ ] `/api/documents/process` without CRON_SECRET → 401
- [ ] `/api/documents/process-now` as non-admin → 403
- [ ] `/api/partner/clients` as non-partner → 403
- [ ] `/api/sales/partner-notes` as client → 403
- [ ] `/api/auth/set-password` with no token → 400
- [ ] `/api/contact` with empty body → 400
- [ ] `/api/webhooks/stripe` with bad signature → generic error (no leak)

### If all pass → ready to deploy.
