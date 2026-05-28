# EstateVault — Manual Testing Guide

> Covers all changes from Phases 0–7. Run these tests before deploying to production.
> **Branch:** Yahia-Dev

---

## Prerequisites

```bash
npm install
npx tsc --noEmit        # expect 0 errors
npm run lint             # expect 0 errors (warnings OK)
npm test                 # expect 193/193 passing
```

Set in `.env.local`:
- `CRON_SECRET` — any random string
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — real or test Upstash
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — Stripe test mode
- `ANTHROPIC_API_KEY` — valid key
- `RESEND_API_KEY` — valid key
- All other vars from `.env.example`

Start dev server:
```bash
npm run dev
```

---

## Phase 0 — Security Lockdown

### S-01: `/api/documents/process` — CRON_SECRET guard
| # | Test | Expected |
|---|------|----------|
| 1 | `curl -X GET http://localhost:3000/api/documents/process` | 401 Unauthorized |
| 2 | `curl -X GET http://localhost:3000/api/documents/process -H "Authorization: Bearer wrong-secret"` | 401 Unauthorized |
| 3 | `curl -X GET http://localhost:3000/api/documents/process -H "Authorization: Bearer YOUR_CRON_SECRET"` | 200 (or empty batch) |

### S-02: `/api/documents/process-now` — Admin only
| # | Test | Expected |
|---|------|----------|
| 1 | Call without auth | 401 |
| 2 | Call as regular client user | 403 |
| 3 | Call as admin user | 200 (or validation error if no orderId) |

### S-03: `/api/documents/cleanup-test-orders` — CRON_SECRET guard
| # | Test | Expected |
|---|------|----------|
| 1 | `curl -X POST http://localhost:3000/api/documents/cleanup-test-orders` | 401 |
| 2 | With correct Bearer token | 200 |

### S-04: `/api/documents/check-status` — Auth + ownership
| # | Test | Expected |
|---|------|----------|
| 1 | Call without auth | 401 |
| 2 | Call with auth but someone else's order_id | 403 |
| 3 | Call with auth and your own order_id | 200 with status |

### S-05: `/api/partner/clients` — Partner role + ownership
| # | Test | Expected |
|---|------|----------|
| 1 | POST without auth | 401 |
| 2 | POST as client user (not partner) | 403 |
| 3 | POST as partner with partnerId belonging to different partner | 403 |
| 4 | POST as partner with own partnerId + valid client data | 200 |

### S-06: `/api/sales/partner-notes` — Sales rep/admin only
| # | Test | Expected |
|---|------|----------|
| 1 | GET without auth | 401 |
| 2 | GET as regular client | 403 |
| 3 | GET as sales_rep | 200 |
| 4 | POST as admin | 200 |

### S-07: `/api/auth/set-password` — Token gate
| # | Test | Expected |
|---|------|----------|
| 1 | POST with no `verifiedToken` in body | 400 (invalid payload) |
| 2 | POST with fake verifiedToken | 400/401 (token invalid) |
| 3 | POST with valid verifiedToken (from real email flow) | 200 |
| 4 | Reuse same verifiedToken | Rejected (one-time use) |
| 5 | Rapid-fire 10+ requests from same IP | 429 (rate limited) |

### S-08: Hostname injection (middleware)
| # | Test | Expected |
|---|------|----------|
| 1 | Normal request to `localhost:3000` | Works normally |
| 2 | Request with `Host: evil";DROP TABLE--` header | Request proceeds without DB injection (sanitized) |

### S-09: Stripe webhook idempotency
| # | Test | Expected |
|---|------|----------|
| 1 | Send valid Stripe webhook event via `stripe trigger checkout.session.completed` | 200, order created |
| 2 | Replay exact same event (same event ID) | 200 with `{ duplicate: true }` — no second order |

### S-10: DEK race condition
| # | Test | Expected |
|---|------|----------|
| 1 | New client bootstraps encryption (first vault access) | DEK created, vault works |
| 2 | (Hard to manually test) Two concurrent bootstrap requests | Both succeed, same DEK used |

---

## Phase 0 — Medium Fixes

### M-01: `/api/farewell/verify` — Rate limit
| # | Test | Expected |
|---|------|----------|
| 1 | Send 20+ rapid requests | Eventually 429 |

### M-02: `/api/farewell/access` — Rate limit
| # | Test | Expected |
|---|------|----------|
| 1 | Send 6+ rapid requests within 1 minute | 429 after 5 |

### M-03: `/api/documents/download-by-session` — IDOR fix
| # | Test | Expected |
|---|------|----------|
| 1 | Request with valid `session_id` from Stripe | 200 (download) |
| 2 | Request with someone else's `order_id` (paid order, no session_id) | Rejected |
| 3 | Request with test/promo `order_id` | Allowed (test orders use order_id fallback) |

### M-04: Partner CSS XSS
| # | Test | Expected |
|---|------|----------|
| 1 | Partner with `accentColor: "#C9A84C"` | Color applied |
| 2 | Partner with `accentColor: "<script>alert(1)</script>"` | Falls back to `#C9A84C` |
| 3 | Partner with `accentColor: "red"` (not hex) | Falls back to `#C9A84C` |

### M-05: Partner activated email role check
| # | Test | Expected |
|---|------|----------|
| 1 | Call as `sales_rep` | 200 |
| 2 | Call as `admin` | 200 |
| 3 | Call as `client` | 403 |

### M-14: Stripe error masking
| # | Test | Expected |
|---|------|----------|
| 1 | Send invalid webhook signature | Response says "Webhook signature verification failed" — NOT internal Stripe error details |

---

## Phase 0 — Cron Fail-Closed (H-03)

Test all 4 cron routes with `CRON_SECRET` unset:
| Route | Test | Expected |
|-------|------|----------|
| `/api/cron/annual-review-reminder` | Remove CRON_SECRET from env, call route | 401 (fail-closed) |
| `/api/cron/life-event-checkin` | Same | 401 |
| `/api/cron/farewell-window-expired` | Same | 401 |
| `/api/cron/farewell-veto-reminder` | Same | 401 |

---

## Phase 0 — Password/Temp Password (H-04, H-05)

### H-05: No temp password in API response
| # | Test | Expected |
|---|------|----------|
| 1 | Create partner via `/api/sales/create-partner` as sales_rep | Response JSON has NO `tempPassword` field |
| 2 | Create rep via `/api/sales/create-rep` as admin | Response JSON has NO `tempPassword` field |
| 3 | Check partner's email | Temp password received via email (not API) |

---

## Phase 1 — Foundation Hardening

### H-06: Fail-fast on missing secrets
| # | Test | Expected |
|---|------|----------|
| 1 | Remove `STRIPE_SECRET_KEY` from `.env.local`, restart dev server | Console error about missing env var |
| 2 | Try to call any Stripe endpoint | Error (not silent placeholder behavior) |
| 3 | Restore `.env.local` | Normal operation |

### H-07: Unified Stripe client
| # | Test | Expected |
|---|------|----------|
| 1 | Process a Stripe checkout (will or trust) | Payment works |
| 2 | Partner payout triggers | Payout uses same API version as checkout |

### M-12: Image remote patterns
| # | Test | Expected |
|---|------|----------|
| 1 | Images from `*.supabase.co` | Load correctly via `next/image` |
| 2 | No wildcard image loading from arbitrary hosts | Only Supabase hosts allowed |

### M-13: Webhook maxDuration
- **Verify:** Open `vercel.json` → confirm `app/api/webhooks/stripe/route.ts` has `maxDuration: 300`

### H-11: Test suite
```bash
npm test
# Expect 193/193 tests passing across 19 test files
```

---

## Phase 2 — Structural Refactor

### Kernel pattern verification
Every API route should now return consistent JSON:
| # | Test | Expected |
|---|------|----------|
| 1 | Success response from any route | `{ ok: true, data: ... }` |
| 2 | Error response from any route | `{ ok: false, error: "..." }` with correct HTTP status |
| 3 | Unhandled exception in any route | Caught by `withRoute`, returns `{ ok: false, error: "internal error" }` 500 |

### Checkout dedup (H-10)
| # | Test | Expected |
|---|------|----------|
| 1 | Complete will checkout flow | Stripe session created, order created, redirected to success |
| 2 | Complete trust checkout flow | Same behavior |
| 3 | Trust with complexity flag + attorney review | Override prompt appears, attorney review added |
| 4 | Use promo code "TEST" | Free promo path, no Stripe redirect |
| 5 | Use promo code "FREE676" | Free promo path for partner-linked checkout |

---

## Phase 3 — Validation at Every Boundary

### Test invalid payloads on key routes
For every route below, send a request with missing/malformed fields:

| Route | Invalid payload example | Expected |
|-------|------------------------|----------|
| `POST /api/auth/signup` | `{ email: "not-an-email" }` | 400 "invalid payload" |
| `POST /api/auth/set-password` | `{}` | 400 "invalid payload" |
| `POST /api/contact` | `{ name: "" }` | 400 "invalid payload" |
| `POST /api/partner/clients` | `{ partnerId: 123 }` (number not string) | 400 "invalid payload" |
| `POST /api/sales/create-partner` | Missing required fields | 400 "invalid payload" |
| `POST /api/attorney/approve` | Missing `reviewId` | 400 "invalid payload" |
| `POST /api/documents/generate` | `{}` | 400 "invalid payload" |

### Test valid payloads still work
| Route | Test | Expected |
|-------|------|----------|
| `POST /api/contact` | Valid name + email + message | 200 |
| `POST /api/auth/check-email` | Valid email | 200 |
| `POST /api/quiz/personalize` | Valid quiz answers | 200 |

---

## Phase 4 — Reliability & Scalability

### M-11: KEK cache TTL
- **Hard to test manually** — verify by reading `lib/api/dek.ts`: `KEK_TTL_MS = 300000` (5 min)
- After 5 minutes of no crypto operations, next operation re-derives KEK from env

### L-05: Audit log durability
| # | Test | Expected |
|---|------|----------|
| 1 | Perform any auditable action (e.g., download document) | Audit log entry created |
| 2 | Check Supabase `audit_log` table | Entry exists with correct action, user, timestamp |

### M-09: Cron pagination
- **Verify in code:** `orderRepo.findDeliveredBefore()` has `.limit(50)`, `farewellVerificationRepo.findActiveVetoWindows()` has `.limit(50)`
- Cron processes max 50 records per run, FIFO order

### M-07: Email retry
| # | Test | Expected |
|---|------|----------|
| 1 | Trigger any email-sending action (signup verification, document delivery) | Email sent successfully |
| 2 | (If Resend is down) Check logs | Up to 3 attempts with exponential backoff before failure |

### M-10: Redis queue hardening
| # | Test | Expected |
|---|------|----------|
| 1 | Generate a document (triggers queue job) | Job created, document processed |
| 2 | Check Redis keys | `job:*` keys have 24h TTL |
| 3 | If Redis not configured | Throws error (not silent drop) |

### M-08: Per-document status tracking
| # | Test | Expected |
|---|------|----------|
| 1 | Order with 2 documents, both succeed | Order status → "delivered" |
| 2 | Order with 2 documents, 1 fails | Order stays in current status, failed doc has `status: "failed"` + `error_message` |
| 3 | Re-run process for same order | Only failed documents retried |

---

## Phase 5 — Pricing SSOT + Type Safety

### Pricing consistency
Open each page below and verify dollar amounts match the source of truth:

| Price | Value | Pages to check |
|-------|-------|----------------|
| Will Package | $400 | `/will/checkout`, `/quiz` result, PackageCards component, partner preview |
| Trust Package | $600 | `/trust/checkout`, `/quiz` result, PackageCards component, partner preview |
| Amendment | $50 | `/dashboard/amendment`, `/dashboard/documents`, `/dashboard/life-events`, FAQ |
| Attorney Review | $300 | `/will/checkout`, `/trust/checkout` |
| Vault Subscription | $99/year | `/dashboard/vault`, `/pro/vault-clients`, SubscriptionBanner |

### Partner earnings display
| Tier | Will earnings | Trust earnings | Pages to check |
|------|---------------|----------------|----------------|
| Standard | $300 | $400 | `/pro/onboarding/step-3`, `/pro/preview`, `/pro/settings` |
| Enterprise | $350 | $450 | Same pages |

### Promo code handling
| # | Test | Expected |
|---|------|----------|
| 1 | Use code "TEST" at checkout | Free path, no Stripe |
| 2 | Use code "FREE676" at partner signup | Free partner registration |
| 3 | Use invalid promo code | Normal paid flow |

---

## Phase 6 — Frontend Quality

### Loading states
| Route | Test | Expected |
|-------|------|----------|
| `/dashboard` | Hard refresh | Navy spinner + "Loading dashboard..." before content |
| `/pro` | Hard refresh | Navy spinner + "Loading partner portal..." |
| `/sales` | Hard refresh | Navy spinner + "Loading sales portal..." |
| `/attorney` | Hard refresh | Navy spinner + "Loading attorney portal..." |
| `/auth/login` | Hard refresh | Navy spinner + "Loading..." |

### Error boundaries
| Route | Test | Expected |
|-------|------|----------|
| `/dashboard` | (Simulate error — e.g., break a fetch) | Error page with "Try Again" + "Back to Dashboard" buttons |
| `/quiz` | Same | Error page with "Try Again" + "Restart Quiz" buttons |

### Accessibility
| Component | Test | Expected |
|-----------|------|----------|
| FAQ accordion | Tab to question, press Enter | Opens/closes. `aria-expanded` toggles. Screen reader announces state |
| Vault item modal | Open modal | Focus trapped inside. Escape closes. `role="dialog"` present |
| Login form | Submit with empty email | `aria-invalid="true"` on field, error announced by screen reader |
| Contact form | Blur empty name field | Red border + inline error. `aria-invalid` + `aria-describedby` present |
| Signup form | Type weak password | Real-time strength indicators update |
| Signup form | Mismatched confirm password | Mismatch indicator with `aria-invalid` |

### SEO
| # | Test | Expected |
|---|------|----------|
| 1 | `curl http://localhost:3000/sitemap.xml` | 8 public URLs listed |
| 2 | `curl http://localhost:3000/robots.txt` | Disallow: /dashboard/, /pro/, /sales/, /attorney/, /api/, /auth/, /trustee/, /farewell/ |
| 3 | View page source of `/quiz` | `<title>Estate Planning Quiz \| EstateVault</title>` |
| 4 | View page source of `/will` | `<title>Create Your Will \| EstateVault</title>` |

### Performance
| # | Test | Expected |
|---|------|----------|
| 1 | Load landing page `/` | No JS-based scroll animation. CSS `scroll-reveal` class handles reveal. Content visible immediately on no-support browsers |
| 2 | Inspect any partner logo in DevTools | Rendered via `<img>` from `next/image` (has `srcset`, `loading` attributes) |

### Input validation (frontend)
| Form | Field | Test | Expected |
|------|-------|------|----------|
| Contact | Name | Leave empty, blur | Red border + "Name is required" |
| Contact | Email | Type "abc", blur | Red border + "Valid email required" |
| Contact | Message | Type 5 chars, blur | Red border + "At least 10 characters" |
| Amendment | Change type | Don't select, blur | Red border + error |
| Amendment | Description | Leave empty, blur | Red border + error |
| Reset password | Password | Type < 8 chars | Requirements checklist shows incomplete |
| Reset password | Confirm | Type different password | "Passwords do not match" |

---

## Phase 7 — Lock It In

### ESLint enforcement
```bash
npm run lint
# Expect 0 errors
# Any raw fetch("/api/...") in components → error
# Any supabase.from('vault_*') outside repos → error
# Any console.log of key material → error
# Any local createAdminClient in routes → error
# Any Math.random() in routes → error
```

### CI gate
- Push branch to GitHub → CI runs automatically on PR to `master`
- CI steps: install → tsc → lint → test
- All must pass for PR to be mergeable

### Typed API client
| # | Test | Expected |
|---|------|----------|
| 1 | Use any feature in browser (checkout, settings, vault) | No console errors about fetch failures |
| 2 | `grep -r 'fetch("/api/' app/ components/` | 0 matches (all migrated to typed client) |

---

## Database Migrations

Before deploying, run these against Supabase:

```sql
-- Migration 1: Webhook idempotency table
-- File: supabase/migrations/20260527_stripe_webhook_idempotency.sql

-- Migration 2: Auth user lookup RPC
-- File: supabase/migrations/20260527_find_auth_user_by_email.sql
```

### Verify migrations
| # | Test | Expected |
|---|------|----------|
| 1 | `SELECT * FROM stripe_webhook_events LIMIT 1;` | Table exists (may be empty) |
| 2 | `SELECT find_auth_user_by_email('test@example.com');` | Returns user or empty array (no error) |

---

## End-to-End Smoke Tests

Run these full user flows after all unit/manual tests pass:

### Flow 1: Client — Will Purchase
1. Go to `/quiz` → complete quiz → get "Will" recommendation
2. Click "Get Started" → `/will/checkout`
3. Verify price shows $400 (or $700 with attorney review)
4. Complete Stripe test payment (card: `4242 4242 4242 4242`)
5. Redirected to `/will/success` → password setup
6. Log in → `/dashboard` → documents visible
7. Download document → verify PDF generated

### Flow 2: Client — Trust Purchase
1. Complete quiz → get "Trust" recommendation
2. `/trust/checkout` → verify $600 displayed
3. Complete test payment
4. Check if complexity flag triggered → attorney review prompt
5. Success → login → dashboard → documents

### Flow 3: Partner — Onboarding
1. Sales rep creates partner via `/sales/new-partner` (or API)
2. Partner receives welcome email with temp password
3. Partner logs in → completes onboarding steps 1–6
4. Partner views `/pro/preview` → verify earnings display
5. Partner shares client link → client completes will checkout
6. Partner sees client in `/pro/clients`
7. Partner views revenue in `/pro/revenue`

### Flow 4: Vault
1. Client subscribes to vault ($99/year)
2. First access → create PIN
3. Add items to vault categories
4. Upload documents to vault
5. Set up farewell messages
6. Add trustee
7. Verify vault PIN lock works on re-entry

### Flow 5: Attorney Review
1. Partner creates review attorney
2. Order with attorney review completes
3. Attorney logs in → sees pending review
4. Attorney approves/rejects
5. Client notified of decision

### Flow 6: Amendment
1. Client with existing will → `/dashboard/amendment`
2. Fills change type + description (test frontend validation)
3. Completes $50 payment
4. Amendment processed

---

## Known Deferred Items (not testable yet)

| Item | Reason | When |
|------|--------|------|
| S-11: DEK AAD binding | Requires re-wrapping all existing DEKs | Phase 4+ |
| 5.1: Supabase DB types | Requires `supabase gen types typescript` CLI | When Supabase CLI linked |
| 5.2: Migration baseline | Requires Supabase CLI | When Supabase CLI linked |

---

## Quick Regression Checklist

After all testing, run final gate:

```bash
npx tsc --noEmit          # 0 errors
npm run lint               # 0 errors
npm test                   # 193/193 passing
```

If all pass + smoke tests green → ready to deploy.
