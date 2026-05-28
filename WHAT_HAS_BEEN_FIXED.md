# Phase 0 — Security Lockdown: What Has Been Fixed

> **Date:** 2026-05-27
> **Branch:** Yahia-Dev
> **Status:** All Phase 0 steps complete. Verify gate pending (npm install needed).

---

## Step 0.1 — Auth Guards on 6 Public Endpoints (S-01 → S-06)

### S-01: `/api/documents/process` — Zero auth, triggers Claude API
- **File:** `app/api/documents/process/route.ts`
- **Fix:** Added `CRON_SECRET` bearer check at top of GET handler. Fail-closed: missing secret = 401.

### S-02: `/api/documents/process-now` — Zero auth, processes any order by UUID
- **File:** `app/api/documents/process-now/route.ts`
- **Fix:** Added `requireAuth(["admin"])` — only platform admins can manually trigger document generation. Imported from `@/lib/api/auth`. Changed `Request` type to `NextRequest`.

### S-03: `/api/documents/cleanup-test-orders` — Zero auth, mass deletion
- **File:** `app/api/documents/cleanup-test-orders/route.ts`
- **Fix:** Added `CRON_SECRET` bearer check. Fail-closed pattern.

### S-04: `/api/documents/check-status` — Zero auth IDOR, leaks order metadata
- **File:** `app/api/documents/check-status/route.ts`
- **Fix:** Full rewrite using kernel pattern. Added `requireAuth()` + `assertOrderAccess()` (role-based ownership check). Wrapped with `withRoute`. Uses `ok()`/`fail()` response helpers. Removed local `createAdminClient`.

### S-05: `/api/partner/clients` — Any auth user creates accounts under any partner
- **File:** `app/api/partner/clients/route.ts`
- **Fix:** Full rewrite. Added `requireAuth(["partner"])` to both POST and PUT. Added `verifyPartnerOwnership()` — confirms caller's profile owns the specified partnerId via the `partners` table. Wrapped with `withRoute`. Removed local `createAdminClient`.

### S-06: `/api/sales/partner-notes` — Any auth user reads/writes all partner notes
- **File:** `app/api/sales/partner-notes/route.ts`
- **Fix:** Full rewrite. Added `requireAuth(["sales_rep", "admin"])` to both GET and POST. Wrapped with `withRoute`. Uses `auth.admin` instead of local admin client.

---

## Step 0.2 — Account Takeover Fix (S-07)

### S-07: `/api/auth/set-password` — No verified token, account takeover
- **File:** `app/api/auth/set-password/route.ts`
- **Fix:** Full rewrite.
  - **Token gate:** Now requires `verifiedToken` in request body. Calls `consumeVerifiedToken(email, verifiedToken)` — same one-time-use pattern as signup flow.
  - **No caller-supplied userId:** Removed `userId` from accepted body params. User resolved only via email lookup in `profiles` table.
  - **Upstash rate limiting:** Replaced in-memory `Map` rate limiter with `authRateLimit` from `@/lib/rate-limit`.
  - **Removed `listUsers` call:** Orphaned auth user case handled via `createUser` failure path.
  - **Error message no longer leaks:** `updateErr.message` replaced with generic "Failed to set password".

---

## Step 0.3 — Hostname Injection Fix (S-08)

### S-08: Hostname injection in middleware — raw hostname in PostgREST `.or()` filter
- **File:** `lib/supabase/middleware.ts`
- **Fix:**
  - **Sanitize hostname:** Added regex `/[^a-zA-Z0-9.\-]/g` strip. If sanitized value differs from raw → bail early with `NextResponse.next()`.
  - **Separate vault prefix sanitization:** `safeVaultPrefix` strips non-alphanumeric/hyphen.
  - **Removed quotes from `.or()` filter:** PostgREST `eq.value` syntax doesn't need wrapping quotes — the old `eq."${hostname}"` was itself an injection surface.
  - **Header uses sanitized value:** `x-partner-hostname` header now uses `safeHostname`.

---

## Step 0.4 — Stripe Webhook Idempotency (S-09) + Error Masking (M-14)

### S-09: Stripe webhook no idempotency — duplicate orders + payouts on replay
- **Migration:** `supabase/migrations/20260527_stripe_webhook_idempotency.sql`
  - Creates `stripe_webhook_events` table with `event_id TEXT PRIMARY KEY`.
  - Index on `processed_at` for cleanup queries.
- **File:** `app/api/webhooks/stripe/route.ts`
  - Added idempotency guard after signature verification: `INSERT INTO stripe_webhook_events` → if PK conflict (duplicate) → return `{ received: true, duplicate: true }` with 200 status.

### M-14: Stripe error messages leak internal state
- **File:** `app/api/webhooks/stripe/route.ts`
- **Fix:** Replaced `Webhook Error: ${message}` with generic "Webhook signature verification failed".

---

## Step 0.5 — DEK Race Condition Fix (S-10)

### S-10: DEK write race condition — concurrent bootstrap loses encryption key permanently
- **File:** `lib/api/dek.ts`
- **Fix:** Changed `getOrCreateUserDek()` to use conditional UPDATE:
  - `UPDATE clients SET wrapped_dek = X WHERE id = Y AND wrapped_dek IS NULL`
  - If 0 rows updated → another request won the race → re-read and unwrap the winner's DEK
  - No data loss possible: concurrent bootstraps safely converge on one DEK

> **Note:** S-11 (AAD binding) deferred to Phase 4 — requires re-wrapping all existing DEKs with a migration script.

---

## Step 0.6 — Replace listUsers Bomb (H-01)

### H-01: `listUsers()` fetches ALL users into memory — 7 call sites
- **Migration:** `supabase/migrations/20260527_find_auth_user_by_email.sql`
  - Creates `find_auth_user_by_email(lookup_email TEXT)` RPC function.
  - Queries `auth.users` by email with `LIMIT 1` — indexed single-row scan.
  - `SECURITY DEFINER` with empty `search_path`. Only `service_role` can execute.
- **Files changed (6 — 7th was already fixed in S-07):**
  - `app/api/webhooks/stripe/route.ts` — 2 occurrences replaced with `supabase.rpc("find_auth_user_by_email", ...)`
  - `app/api/checkout/will/route.ts` — replaced
  - `app/api/checkout/trust/route.ts` — replaced
  - `app/api/checkout/vault-subscription/route.ts` — replaced
  - `app/api/partners/create-review-attorney/route.ts` — replaced + added profiles lookup first (was missing)
- **Verification:** `grep listUsers app/api/` → 0 matches.

---

## Step 0.7 — Replace In-Memory Rate Limiter (H-02)

### H-02: In-memory rate limiter useless on Vercel serverless
- **File:** `lib/api/auth.ts`
  - Deleted `rateBuckets` Map and `rateLimit()` function entirely.
- **Files changed (3 callers migrated to Upstash `apiRateLimit`):**
  - `app/api/documents/generate/route.ts` — `rateLimit(...)` → `await apiRateLimit.limit(...)`
  - `app/api/partner/email/verify/route.ts` — same
  - `app/api/partner/email/test/route.ts` — same
- **Verification:** `grep "rateLimit.*from.*auth"` → 0 matches.

---

## Step 0.8 — Cron Fail-Closed (H-03)

### H-03: Cron routes fail-open when `CRON_SECRET` unset
- **Files changed (4):**
  - `app/api/cron/annual-review-reminder/route.ts`
  - `app/api/cron/life-event-checkin/route.ts`
  - `app/api/cron/farewell-window-expired/route.ts`
  - `app/api/cron/farewell-veto-reminder/route.ts`
- **Fix:** Changed `if (secret && auth !== ...)` to `if (!secret || auth !== ...)`. Missing secret = deny, not allow.

---

## Step 0.9 — Password Generation + Exposure (H-04, H-05)

### H-04: `Math.random()` for temp password generation
- **File:** `app/api/sales/create-partner/route.ts`
- **Fix:** Replaced `Math.random()` loop with `crypto.randomBytes(12)` — cryptographically secure.

### H-05: `create-partner` + `create-rep` return tempPassword in JSON response
- **Files:**
  - `app/api/sales/create-partner/route.ts` — removed `tempPassword` from response JSON
  - `app/api/sales/create-rep/route.ts` — removed `tempPassword` from response JSON
- Password is still emailed to the user (existing behavior) — just no longer exposed over the API wire.

---

## Step 0.10 — Medium Security Fixes (M-01 → M-05)

### M-01: `/api/farewell/verify` — unauthenticated file upload, no rate limit
- **File:** `app/api/farewell/verify/route.ts`
- **Fix:** Added IP-based Upstash rate limiting via `apiRateLimit.limit(`farewell-verify:${ip}`)`.

### M-02: `/api/farewell/access` — no rate limit, email bombing
- **File:** `app/api/farewell/access/route.ts`
- **Fix:** Added IP-based Upstash rate limiting via `authRateLimit.limit(`farewell-access:${ip}`)` (stricter: 5 req/min).

### M-03: `/api/documents/download-by-session` — IDOR via order_id fallback
- **File:** `app/api/documents/download-by-session/route.ts`
- **Fix:** Restricted `order_id` fallback to test/promo orders only — `if (order.order_type === "test" || order.promo_code)`. Paid orders must use Stripe `session_id` for authorization.
- **Bonus:** Fixed error message leak — `(e as Error).message` → generic "Download failed".

### M-04: `dangerouslySetInnerHTML` in partner CSS — XSS if partner injects script tags
- **File:** `components/partner/PartnerThemedShell.tsx`
- **Fix:** Added hex color validation for `branding.accentColor` — must match `/^#[0-9a-fA-F]{6}$/` or falls back to brand gold `#C9A84C`. Both `buildPartnerTheme` and `buildHeroRecipe` now receive the sanitized value.

### M-05: `/api/email/partner-activated` — role check uses `"sales"` not `"sales_rep"`
- **File:** `app/api/email/partner-activated/route.ts`
- **Fix:** Changed `["admin", "sales"]` to `["admin", "sales_rep"]` to match actual user_type values in database.

---

## New Database Migrations Required

Run these against Supabase before deploying:

1. **`supabase/migrations/20260527_stripe_webhook_idempotency.sql`** — Creates `stripe_webhook_events` table for webhook deduplication.
2. **`supabase/migrations/20260527_find_auth_user_by_email.sql`** — Creates `find_auth_user_by_email()` RPC function for targeted user lookup.

---

## Files Modified (complete list)

| File | Changes |
|------|---------|
| `app/api/documents/process/route.ts` | CRON_SECRET auth guard |
| `app/api/documents/process-now/route.ts` | requireAuth(["admin"]) |
| `app/api/documents/cleanup-test-orders/route.ts` | CRON_SECRET auth guard |
| `app/api/documents/check-status/route.ts` | Full rewrite: auth + ownership + kernel |
| `app/api/partner/clients/route.ts` | Full rewrite: partner role + ownership + kernel |
| `app/api/sales/partner-notes/route.ts` | Full rewrite: sales_rep/admin role + kernel |
| `app/api/auth/set-password/route.ts` | Full rewrite: token gate + Upstash rate limit |
| `lib/supabase/middleware.ts` | Hostname sanitization |
| `app/api/webhooks/stripe/route.ts` | Idempotency guard + listUsers removal (×2) + error masking |
| `lib/api/dek.ts` | Conditional UPDATE for DEK race fix |
| `app/api/checkout/will/route.ts` | listUsers → RPC |
| `app/api/checkout/trust/route.ts` | listUsers → RPC |
| `app/api/checkout/vault-subscription/route.ts` | listUsers → RPC |
| `app/api/partners/create-review-attorney/route.ts` | listUsers → profiles + RPC |
| `lib/api/auth.ts` | Deleted in-memory rateLimit function |
| `app/api/documents/generate/route.ts` | In-memory → Upstash rate limit |
| `app/api/partner/email/verify/route.ts` | In-memory → Upstash rate limit |
| `app/api/partner/email/test/route.ts` | In-memory → Upstash rate limit |
| `app/api/cron/annual-review-reminder/route.ts` | Fail-closed auth |
| `app/api/cron/life-event-checkin/route.ts` | Fail-closed auth |
| `app/api/cron/farewell-window-expired/route.ts` | Fail-closed auth |
| `app/api/cron/farewell-veto-reminder/route.ts` | Fail-closed auth |
| `app/api/sales/create-partner/route.ts` | crypto.randomBytes + remove tempPassword from response |
| `app/api/sales/create-rep/route.ts` | Remove tempPassword from response |
| `app/api/farewell/verify/route.ts` | IP-based Upstash rate limit |
| `app/api/farewell/access/route.ts` | IP-based Upstash rate limit |
| `app/api/documents/download-by-session/route.ts` | IDOR fix + error masking |
| `components/partner/PartnerThemedShell.tsx` | Hex color validation |
| `app/api/email/partner-activated/route.ts` | Role check fix |

## New Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260527_stripe_webhook_idempotency.sql` | Webhook dedup table |
| `supabase/migrations/20260527_find_auth_user_by_email.sql` | Targeted auth user lookup RPC |

---

## What's NOT Done Yet (deferred)

- **S-11 (DEK AAD binding):** Deferred to Phase 4 — requires re-wrapping all existing DEKs.
- **Verify gate:** `npx tsc --noEmit && npm run lint && npm test` — needs `npm install` first.
- **Manual testing:** Hit each locked endpoint without auth → expect 401/403. Test webhook replay → dedup. Test set-password without token → rejection.

---

---

# Phase 1 — Foundation Hardening: What Has Been Fixed

> **Date:** 2026-05-28
> **Branch:** Yahia-Dev
> **Status:** All Phase 1 steps complete. Verify gate GREEN (193/193 tests, TSC clean, lint warnings-only).

---

## Pre-Phase 1 — Phase 0 Leftover Fixes

Before starting Phase 1, fixed gate blockers from Phase 0:

### RPC Type Safety
- **7 call sites** of `find_auth_user_by_email` RPC had untyped `{}` return.
- **Fix:** Added `.returns<{ id: string; email: string }[]>()` chain to all RPC calls.
- **Files:** `checkout/will`, `checkout/trust`, `checkout/vault-subscription`, `partners/create-review-attorney`, `webhooks/stripe` (×2).

### Variable Name Bug
- `checkout/trust/route.ts:272` and `checkout/will/route.ts:285` referenced `existingAuthUser` (renamed variable from Phase 0).
- **Fix:** Changed to `authMatch.id` (correct variable name).

### assertOrderAccess Return Type
- `check-status/route.ts` handler returned `NextResponse | undefined` — `withRoute` rejects undefined.
- **Fix:** Added explicit `OrderAccessOk | OrderAccessErr` discriminated union type to `assertOrderAccess()` in `lib/api/auth.ts`.

### Stripe Module-Level Init
- `lib/stripe-payouts.ts` created `new Stripe(...)` at module level → test import crash.
- **Fix:** Lazy-initialized Stripe client (temporary; superseded by Phase 1.2 unification).

---

## Step 1.1 — Fail-Fast on Missing Secrets (H-06)

### H-06: Hardcoded fallback secrets — silent fail in prod
- **Files:**
  - `lib/stripe.ts` — removed `|| "sk_test_placeholder"`. Lazy-init via Proxy: Stripe client created on first property access, not at import time.
  - `lib/claude.ts` — removed `|| "placeholder"`. Same lazy Proxy pattern.
  - `lib/email.ts` — removed `|| "re_placeholder"`. Lazy `getResend()` function.
- **New file:** `instrumentation.ts` — calls `validateEnv()` at Next.js startup. Production throws on missing env vars; dev console.errors.

---

## Step 1.2 — Unify Stripe Client (H-07)

### H-07: Two Stripe clients with different API versions
- **File:** `lib/stripe-payouts.ts`
  - Deleted standalone `new Stripe(...)` with `apiVersion: '2024-12-18.acacia' as any`.
  - Now imports `{ stripe }` from `./stripe` — shares the single lazy-init client.
  - API version unified to `2026-03-25.dahlia` (matches installed Stripe types).
  - Removed `as any` cast.
- **Single Stripe client:** `lib/stripe.ts` is the canonical source. All 15 route files + stripe-payouts import from it.

---

## Step 1.3 — Deployment Config Fixes (M-12, M-13)

### M-12: `images.remotePatterns: '**'` defeats image optimization allowlist
- **File:** `next.config.mjs`
- **Fix:** Removed catch-all `hostname: '**'` pattern. Only `*.supabase.co` storage paths allowed.

### M-13: Webhook handler missing `maxDuration` in vercel.json
- **File:** `vercel.json`
- **Fix:** Added `"app/api/webhooks/stripe/route.ts": { "maxDuration": 300 }`.

---

## Step 1.4 — Characterization Tests (H-11)

### H-11: 8 test files for 120 API routes — critical paths untested
- **Tests added:** 76 new tests across 6 new test files.
- **Total:** 117 → 193 tests (19 test files, all passing).

| Test File | Tests | Covers |
|-----------|-------|--------|
| `encoding.test.ts` | 16 | b64 roundtrip, byteaToBytes edge cases, bytesToBytea |
| `email-helpers.test.ts` | 13 | renderEmailHeader/Footer, buildAssetChecklist, brand variants |
| `env-validation.test.ts` | 5 | validateEnv prod/dev behavior, missing var reporting |
| `security-guards.test.ts` | 18 | Cron fail-closed, hostname sanitize, role constants, hex color, crypto.randomBytes |
| `stripe-idempotency.test.ts` | 4 | Webhook dedup pattern, error masking, API version |
| `auth-patterns.test.ts` | 20 | Token gate, requireAuth roles, assertOrderAccess ownership, DEK race |

---

## Step 1.5 — Shared Kernel Consolidation (L-06)

### L-06: b64/bytea helpers duplicated 7 times
- **New file:** `lib/crypto/encoding.ts` — canonical `b64encode`, `b64decode`, `byteaToBytes`, `bytesToBytea`.
- **7 files updated** (removed local duplicates, import from shared module):
  - `lib/api/crypto.ts` — re-exports from encoding.ts
  - `lib/crypto/keySession.ts` — `import { b64encode as bytesToB64, ... }`
  - `lib/repos/cryptoRepo.ts` — `import { b64encode as b64, ... }`
  - `lib/repos/shareRepo.ts` — replaced `b64`, `fromB64`, `decodeBytea` with shared imports
  - `lib/repos/backfillRepo.ts` — replaced `b64`
  - `lib/repos/videoRepo.ts` — replaced `fromB64`
  - `app/trustee/vault/page.tsx` — replaced `fromB64`

---

## Files Modified (Phase 1 complete list)

| File | Changes |
|------|---------|
| `lib/stripe.ts` | Lazy-init Proxy, removed placeholder |
| `lib/claude.ts` | Lazy-init Proxy, removed placeholder |
| `lib/email.ts` | Lazy getResend(), removed placeholder |
| `lib/stripe-payouts.ts` | Import shared Stripe, removed standalone client + `as any` |
| `lib/api/auth.ts` | Explicit OrderAccessOk/OrderAccessErr types |
| `lib/crypto/encoding.ts` | **NEW** — consolidated encoding helpers |
| `lib/api/crypto.ts` | Re-export from encoding.ts |
| `lib/crypto/keySession.ts` | Import from encoding.ts |
| `lib/repos/cryptoRepo.ts` | Import from encoding.ts |
| `lib/repos/shareRepo.ts` | Import from encoding.ts |
| `lib/repos/backfillRepo.ts` | Import from encoding.ts |
| `lib/repos/videoRepo.ts` | Import from encoding.ts |
| `app/trustee/vault/page.tsx` | Import from encoding.ts |
| `app/api/documents/check-status/route.ts` | Explicit return type |
| `app/api/checkout/trust/route.ts` | RPC typed + variable name fix |
| `app/api/checkout/will/route.ts` | RPC typed + variable name fix |
| `app/api/checkout/vault-subscription/route.ts` | RPC typed |
| `app/api/partners/create-review-attorney/route.ts` | RPC typed |
| `app/api/webhooks/stripe/route.ts` | RPC typed (×2) |
| `next.config.mjs` | Removed `hostname: '**'` wildcard |
| `vercel.json` | Added webhook maxDuration |
| `instrumentation.ts` | **NEW** — env validation at startup |

## New Test Files

| File | Purpose |
|------|---------|
| `tests/unit/encoding.test.ts` | Binary encoding roundtrips + edge cases |
| `tests/unit/email-helpers.test.ts` | Email template rendering |
| `tests/unit/env-validation.test.ts` | Startup env validation |
| `tests/unit/security-guards.test.ts` | Cron auth, hostname sanitize, role checks |
| `tests/unit/stripe-idempotency.test.ts` | Webhook dedup + error masking |
| `tests/unit/auth-patterns.test.ts` | Auth guards, ownership, DEK race |

---

---

---

# Phase 2 — Structural Refactor: What Has Been Fixed

> **Date:** 2026-05-28
> **Branch:** Yahia-Dev
> **Status:** Groups 1–3 complete. Gate GREEN (193/193 tests, TSC clean, lint warnings-only). Group 4 (partner/sales) next.

---

## Group 1 — Cron Routes (4 routes) ✅

All 4 cron routes fully rewritten to kernel pattern.

| Route | Changes |
|-------|---------|
| `api/cron/annual-review-reminder` | withRoute + createAdminClient (shared) + ok/fail + orderRepo.findDeliveredBefore + clientRepo.getReminderStateById/stampAnnualReview + profileRepo.getEmailAndNameById + auditLogRepo |
| `api/cron/life-event-checkin` | Same pattern: withRoute + repos + clientRepo.stampLifeEventCheckin |
| `api/cron/farewell-window-expired` | withRoute + repos + sendTrusteeUnlockEmail + farewellVerificationRepo.insertTrusteeAudit (writes to `trustee_access_audit`, NOT `audit_log`) |
| `api/cron/farewell-veto-reminder` | withRoute + repos + sendVetoReminderEmail + farewellVerificationRepo |

### New repos created:
- `lib/repos/server/farewellVerificationRepo.ts` — findExpiredUnnotified, stampTrusteeNotified, findActiveVetoWindows, updateVetoTokenHash, insertTrusteeAudit
- `lib/repos/server/auditLogRepo.ts` — insertEntry (shared audit_log writes)

### New email functions added to `lib/email.ts`:
- `sendDunningEmail` — vault subscription payment failure
- `sendTrusteeUnlockEmail` — 7-day vault access link
- `sendVetoReminderEmail` — owner veto reminder

### Repo extensions:
- `orderRepo.ts` — added findDeliveredBefore
- `clientRepo.ts` — added getReminderStateById, stampAnnualReview, stampLifeEventCheckin, findBySubscriptionId, updateVaultSubscription, activateVaultByStripeId, cancelVaultByStripeId, findByProfileId
- `profileRepo.ts` — added getEmailAndNameById

---

## Group 2 — Webhook Routes (1 major route) ✅

### `api/webhooks/stripe` (770→~600 lines)
Major rewrite of the Stripe webhook monolith:
- Replaced local createAdminClient → shared import
- Wrapped with withRoute + ok/fail
- All inline `audit_log.insert` → auditLogRepo.insertEntry
- All inline `new Resend` → sendDunningEmail from shared email module
- Split into helper functions: handleVaultSubscriptionCheckout, handleDocumentCheckout, handleAttorneyReview, resolveOrCreateGuestClient
- Idempotency via stripeWebhookRepo.checkIdempotency

### New repos created:
- `lib/repos/server/stripeWebhookRepo.ts` — checkIdempotency
- `lib/repos/server/payoutRepo.ts` — insertPartnerPayout, insertAffiliatePayout
- `lib/repos/server/attorneyReviewRepo.ts` — insert

### Repo extensions:
- `affiliateRepo.ts` — added getStripeAccountById, incrementStats
- `partnerRepo.ts` — added getStripeAndTier, getStripeAndRevenuePct, getReviewRoutingInfo
- `quizSessionRepo.ts` — added getLatestAnswersByClient

---

## Group 3 — Document Routes (10 routes) ✅

All 10 document routes refactored (check-status already done in Phase 0).

### Simple kernel swaps (7 routes):
| Route | Changes |
|-------|---------|
| `documents/status` | withRoute + ok/fail + requireAuth |
| `documents/generate` | withRoute + ok/fail + quizSessionRepo + orderRepo + auditLogRepo |
| `documents/download-by-session` | withRoute + ok/fail + createAdminClient (shared) |
| `documents/cleanup-test-orders` | withRoute + ok/fail + createAdminClient (shared) + auditLogRepo |
| `documents/download` | withRoute + ok/fail + requireAuth + auditLogRepo |
| `documents/send-email` | withRoute + ok/fail + requireAuth + auditLogRepo |
| `documents/download-zip` | withRoute + fail + createAdminClient (returns binary NextResponse) |

### Complex kernel swaps (3 routes):
| Route | Lines | Changes |
|-------|-------|---------|
| `documents/process` | 419→410 | Removed local createAdminClient + getTemplate, withRoute, ok/fail, auditLogRepo (3 inline inserts replaced incl. notifyClientByEmail helper) |
| `documents/process-now` | 275→258 | Same kernel swap, removed local createAdminClient + getTemplate, auditLogRepo (2 inline inserts), kept requireAuth(["admin"]) from Phase 0 |
| `documents/regenerate-missing` | 196→172 | Same kernel swap + replaced 10-line manual admin auth with requireAuth(["admin"]), removed createClient import |

### Shared module extracted:
- `lib/documents/templates/resolve.ts` — getTemplate() extracted from 3 files that duplicated it identically

### Bonus fix:
- `lib/api/auth.ts` — added `"review_attorney"` to UserType union (was missing, caused TSC error in download/route.ts)

---

## Verify Gate Results

```
npx tsc --noEmit  → clean (0 errors)
npm run lint      → warnings only (pre-existing <img> warnings)
npm test          → 19 files, 193 tests, all passing
```

---

## Group 4 — Partner/Sales Routes (19 routes) ✅

All 19 partner/sales routes fully rewritten to kernel pattern.

### Subgroup A — Partner Email Routes (4 routes):
| Route | Changes |
|-------|---------|
| `api/partner/email/reset` | withRoute + ok/fail + partnerRepo.getEmailSettingsByProfileId + partnerRepo.update |
| `api/partner/email/setup` | withRoute + ok/fail + partnerRepo.getEmailSettingsByProfileId + partnerRepo.update |
| `api/partner/email/verify` | withRoute + ok/fail + partnerRepo.getEmailSettingsByProfileId + partnerRepo.update + apiRateLimit |
| `api/partner/email/test` | withRoute + ok/fail + partnerRepo.getEmailSettingsByProfileId + apiRateLimit |

### Subgroup B — Sales Utility Routes (5 routes):
| Route | Changes |
|-------|---------|
| `api/sales/partner-last-login` | withRoute + requireAuth(["sales_rep","admin"]) + ok/fail + partnerRepo.getProfileId |
| `api/sales/reps` | withRoute + requireAuth(["admin"]) + ok/fail + profileRepo.findAllSalesReps + partnerRepo.countActiveByCreator + auditLogRepo |
| `api/sales/send-welcome-email` | withRoute + requireAuth(["sales_rep","admin"]) + ok/fail |
| `api/sales/create-partner` | withRoute + requireAuth(["sales_rep","admin"]) + ok/fail + partnerRepo.findBySlug + profileRepo.findByEmail + auditLogRepo |
| `api/sales/create-rep` | withRoute + requireAuth(["admin"]) + ok/fail + profileRepo.upsert + auditLogRepo |

### Subgroup C — Affiliate Routes (2 routes):
| Route | Changes |
|-------|---------|
| `api/sales/affiliates/[id]/payout` | withRoute + requireAuth(["admin"]) + ok/fail + affiliateRepo.getPayoutInfoById/getAttributedOrders/getPriorPayouts/insertPayout + auditLogRepo |
| `api/sales/affiliates/[id]/status` | withRoute + requireAuth(["admin"]) + ok/fail + affiliateRepo.getWithStatus/updateStatus + auditLogRepo |

### Subgroup D — Partner Domain Routes (3 routes):
| Route | Changes |
|-------|---------|
| `api/partner/add-domain` | withRoute + requireAuth(["partner"]) + ok/fail + partnerRepo.getDomainInfoByProfileId + partnerRepo.update + auditLogRepo |
| `api/partner/vault-subdomain` | withRoute + requireAuth(["partner"]) + ok/fail + partnerRepo.getDomainInfoByProfileId + partnerRepo.isSubdomainTaken + auditLogRepo |
| `api/partner/verify-domain` | withRoute + requireAuth(["partner"]) + ok/fail + partnerRepo.getDomainInfoByProfileId + partnerRepo.update |

### Subgroup E — Partner Business Routes (3 routes):
| Route | Changes |
|-------|---------|
| `api/partner/revenue` | withRoute + requireAuth(["partner"]) + ok/fail + partnerRepo.getCompletedOrders/getPendingOrders/getRecentPayouts |
| `api/partner/stripe-connect` | withRoute + requireAuth(["partner"]) + ok/fail + partnerRepo.getStripeByProfileId + partnerRepo.update |
| `api/partner/vault-client-checkout` | withRoute + requireAuth(["partner"]) + ok/fail + partnerRepo.getVaultCheckoutInfoByProfileId + profileRepo.findByEmail + profileRepo.upsert |

### Subgroup F — Partners Routes (2 routes):
| Route | Changes |
|-------|---------|
| `api/partners/branding` | withRoute + ok/fail + createAdminClient (shared, public endpoint) |
| `api/partners/create-review-attorney` | withRoute + requireAuth(["partner"]) + ok/fail + profileRepo.findByEmail + profileRepo.upsert + ownership check |

### New repo functions added:
- `partnerRepo.ts` — getEmailSettingsByProfileId, getDomainInfoByProfileId, getStripeByProfileId, getVaultCheckoutInfoByProfileId, isSubdomainTaken, findBySlug, getProfileId, getCompletedOrders, getPendingOrders, getRecentPayouts, countActiveByCreator
- `affiliateRepo.ts` — getPayoutInfoById, getAttributedOrders, getPriorPayouts, insertPayout, updateStatus, getWithStatus
- `profileRepo.ts` — findAllSalesReps, updateCommissionRate, findByEmail

---

## Group 5 — Attorney Routes (6 routes) ✅

All 6 attorney routes fully rewritten to kernel pattern.

| Route | Changes |
|-------|---------|
| `api/attorney/approve` | withRoute + requireAuth(["review_attorney","admin"]) + ok/fail + attorneyReviewRepo.getById/updateDecision + auditLogRepo |
| `api/attorney/check-sla` | withRoute + ok/fail + createAdminClient (shared) + attorneyReviewRepo.findOverdue + auditLogRepo |
| `api/attorney/notify-client` | withRoute + requireAuth(["review_attorney","admin"]) + ok/fail + attorneyReviewRepo.getReviewWithOrder |
| `api/attorney/review` | withRoute + requireAuth(["review_attorney","admin"]) + ok/fail + attorneyReviewRepo.getById |
| `api/attorney/review-docx` | withRoute + requireAuth(["review_attorney","admin"]) + ok/fail + attorneyReviewRepo.isAssignedAttorney + auditLogRepo |
| `api/attorney/upload-reviewed` | withRoute + requireAuth(["review_attorney","admin"]) + ok/fail + attorneyReviewRepo.isAssignedAttorney + auditLogRepo |

### New repo functions added:
- `attorneyReviewRepo.ts` — getById, updateDecision, findOverdue, isAssignedAttorney, getReviewWithOrder

---

## Group 6 — Crypto Routes (7 routes) ✅

All 7 crypto routes wrapped with `withRoute` + switched to `ok()`/`fail()`.

| Route | Changes |
|-------|---------|
| `api/crypto/bootstrap` | withRoute + ok/fail (already used requireClientUser + Zod + rate limiting + audit) |
| `api/crypto/bundle` | withRoute + ok/fail |
| `api/crypto/pubkey` | withRoute + ok/fail (already used requireAuth) |
| `api/crypto/recovery-bundle` | withRoute + ok/fail |
| `api/crypto/rotate-passphrase` | withRoute + ok/fail |
| `api/crypto/rotate-recovery` | withRoute + ok/fail |
| `api/crypto/shamir-setup` | withRoute + ok/fail (POST + GET) |

Note: Crypto routes already had Zod validation, Upstash rate limiting, and audit logging. Only needed withRoute error wrapper + consistent response helpers.

---

## Verify Gate Results (Groups 4-6)

```
npx tsc --noEmit  → clean (0 errors)
npm run lint      → warnings only (pre-existing <img> warnings)
npm test          → 19 files, 193 tests, all passing
```

---

## Group 7 — Admin Routes (6 routes) ✅

All 6 admin routes fully rewritten to kernel pattern.

| Route | Changes |
|-------|---------|
| `api/admin/farewell-verification` (GET+POST) | withRoute + requireAuth(["admin"]) + ok/fail + fvRepo (findPending, getByIdWithStatus, approveRequest, rejectRequest, unlockFarewellMessages, resetFarewellMessages, getUnlockedMessages, getClientOwnerProfile, getClientNameByClientId, getTrusteeName, getCertificateUrl) + auditLogRepo + shared emails (sendOwnerVetoEmail, sendFarewellUnlockEmail, sendVerificationRejectedEmail, sendTrusteeUnlockEmail) |
| `api/admin/marketing/materials` (GET+POST) | withRoute + ok/fail (keeps requireAdmin from marketing/admin-auth) |
| `api/admin/marketing/materials/[id]` (PATCH+DELETE) | withRoute + ok/fail (keeps requireAdmin) |
| `api/admin/marketing/partners` (GET) | withRoute + ok/fail (keeps requireAdmin) |
| `api/admin/orders-missing-docs` (GET) | withRoute + requireAuth(["admin"]) + ok/fail. Removed local createAdminClient + manual auth. Kept inline queries (admin report, not reusable) |
| `api/admin/test-promo` (GET+POST) | withRoute + ok/fail. GET: createAdminClient + appSettingsRepo.getByKey (unauthenticated, used by checkout). POST: requireAuth(["admin"]) + appSettingsRepo.upsertByKey + auditLogRepo |

### New repo functions added:
- `farewellVerificationRepo.ts` — findPending, getByIdWithStatus, approveRequest, rejectRequest, unlockFarewellMessages, resetFarewellMessages, getUnlockedMessages, getClientOwnerProfile, getClientNameByClientId, getTrusteeName, getCertificateUrl, verifyAccessStillValid, getByIdForOtp, storeOtp, burnOtp, incrementOtpAttempts
- `appSettingsRepo.ts` — upsertByKey

### New email functions added to `lib/email.ts`:
- `sendOwnerVetoEmail` — owner dead-man-switch veto notification
- `sendFarewellUnlockEmail` — farewell message recipient notification
- `sendVerificationRejectedEmail` — trustee rejection notification
- `sendTrusteeOtpEmail` — trustee OTP verification code
- `sendVetoAccessCancelledEmail` — trustee veto cancellation notification

### Verify Gate Results (Group 7)

```
npx tsc --noEmit  → clean (0 errors)
```

---

## Group 8 — Trustee Routes (6 routes) ✅

> **Date:** 2026-05-28

All 6 trustee routes refactored to kernel pattern.

| Route | Changes |
|-------|---------|
| `trustee/logout` | Replaced `createServerClient` → shared `createAdminClient`. `withRoute` + `ok`. `fvRepo.insertTrusteeAudit` for audit. |
| `trustee/unlock-otp` | Replaced local `admin()` + `new Resend()` → shared `createAdminClient` + `sendTrusteeOtpEmail`. `fvRepo.getByIdForOtp` + `fvRepo.storeOtp`. `withRoute` + `ok/fail`. |
| `trustee/unlock-verify` | `fvRepo.getByIdForOtp` + `fvRepo.incrementOtpAttempts` + `fvRepo.burnOtp`. Session cookie on success. `withRoute` + `ok/fail`. |
| `trustee/vault/download-url` | `fvRepo.verifyAccessStillValid`. Kept inline document/vault_item/farewell branching. `fvRepo.insertTrusteeAudit`. |
| `trustee/vault/file-key` | `fvRepo.verifyAccessStillValid`. Kept inline crypto (DEK unwrap, sub-key derive). `fvRepo.insertTrusteeAudit`. |
| `trustee/vault/items` | Largest route (~230 lines). Kept inline: scope lookup, client DEK, vault_items/documents/farewell_messages queries, all crypto ops, session refresh. `fvRepo.verifyAccessStillValid` + `fvRepo.insertTrusteeAudit`. |

**Key decisions:**
- Trustee routes use `requireTrusteeSession()` — NOT `requireAuth()`. Trustees are not Supabase users.
- Trustee audit goes to `trustee_access_audit` table via `fvRepo.insertTrusteeAudit()`, not `audit_log`.
- Complex vault routes (download-url, file-key, items) keep inline queries — trustee-specific branching makes extraction add complexity without benefit.

### Verify Gate (Group 8)
```
npx tsc --noEmit  → clean (0 errors)
```

---

## Group 9 — Auth + Farewell Routes (15 routes) ✅

> **Date:** 2026-05-28

All 15 routes refactored. 1 route intentionally skipped (verify-link returns HTML).

### Auth Routes (12 files)

| Route | Changes |
|-------|---------|
| `auth/check-email` | Replaced local `createAdminClient` → shared import. `withRoute` + `ok/fail`. |
| `auth/check-verification` | `withRoute` + `ok`. Uses `pollLink` from emailVerification. |
| `auth/handoff` | `withRoute` + `ok/fail`. No DB, uses `encryptHandoff`. |
| `auth/handoff/consume` | `withRoute` + `ok/fail`. Uses `decryptHandoff`. |
| `auth/verify-code` | `withRoute` + `ok/fail`. Uses `verifyCode` from emailVerification. |
| `auth/send-verify-code` | Replaced in-memory `rateLimitMap` → `authRateLimit`. `new Resend()` → `getResend()`. `withRoute` + `ok/fail`. |
| `auth/send-verify-link` | Same pattern: `authRateLimit`, `getResend()`, `withRoute` + `ok/fail`. |
| `auth/resend-verification` | Replaced local `createAdminClient` + `rateLimitMap` + `new Resend()`. Returns `ok({ success: true })` even on rate limit (no account existence leak). |
| `auth/recovery` | Replaced local `createAdminClient` + `new Resend()`. Returns `ok({ success: true })` always (no account existence leak). |
| `auth/signup` | Replaced local `createAdminClient`. `withRoute` + `ok/fail`. |
| `auth/welcome` | Replaced local `createAdminClient` + `new Resend()` → shared imports + `getResend()`. Keeps `createClient` for session cookie auth. |
| `auth/set-password` | Already had shared `createAdminClient` + `authRateLimit` from Phase 0. Added `withRoute` + `ok/fail`. Inline audit_log → `auditLogRepo.insertEntry`. |

**Skipped:** `auth/verify-link` — returns HTML pages, not JSON. `withRoute`'s error response would produce JSON for an HTML endpoint.

### Farewell Routes (3 files)

| Route | Changes |
|-------|---------|
| `farewell/owner-veto` | Replaced local `admin()` + `new Resend()`. Uses shared `createAdminClient`, `sendVetoAccessCancelledEmail`, `auditLogRepo.insertEntry`. Kept local `hashToken`. Both GET + POST wrapped. |
| `farewell/verify` | `new Resend()` → `getResend()`. Inline `audit_log` insert → `auditLogRepo.insertEntry`. Complex route: crypto blind index, scope-aware content check, certificate upload. |
| `farewell/access` | `new Resend()` → `getResend()`. Inline `trustee_access_audit` → `fvRepo.insertTrusteeAudit`. Complex route: blind index matching, trustee state machine. |

### Infrastructure change
- `lib/email.ts` — `getResend()` changed from private to `export` (needed by auth/farewell routes that build custom HTML emails inline).

### Verify Gate (Group 9)
```
npx tsc --noEmit  → clean (0 errors)
npm run lint      → warnings only (pre-existing <img>, useEffect dep)
npm test          → 193/193 passed
```

---

## H-10 — Checkout Dedup (Will/Trust) ✅

> **Date:** 2026-05-28

Extracted shared checkout logic into `lib/checkout/createCheckoutSession.ts`. Will/trust routes → thin wrappers.

### What was created
- **`lib/checkout/createCheckoutSession.ts`** — Shared function handling: plan conflict check, test promo path, client creation, split calculation, order creation, quiz session, free promo path (account creation + temp password), Stripe session, affiliate attribution, audit logging.
- **`ProductConfig` type** — Parameterizes: productType, baseAmount, defaultEvCut, docTypes, recommendation, stripeName, stripeDescription, attorneyDescription, successPath, cancelPath.
- **`CheckoutInput` type** — Union of will + trust fields. Trust-only fields (complexityFlag, complexityReasons, declinedAttorneyReview, confirmOverride) are optional.
- Prices imported from `lib/orders/pricing.ts` (PRICES, EV_DEFAULT_CUT) — no hardcoded amounts.

### What changed
- `app/api/checkout/will/route.ts` — 424 lines → 32 lines. Validates with `willCheckoutSchema`, passes `WILL_CONFIG` to shared function.
- `app/api/checkout/trust/route.ts` — 394 lines → 32 lines. Validates with `trustCheckoutSchema`, passes `TRUST_CONFIG` to shared function.

### Behavioral parity
- Trust override handling (`confirmOverride`) preserved in shared function.
- Trust complexity fields (`complexity_flag`, `complexity_flag_reason`) conditionally added to order.
- Trust quiz answers include `declinedAttorneyReview` when present.
- Will route had no override handling — shared function's override check is a no-op when `confirmOverride` is undefined.

### Verify Gate (H-10)
```
npx tsc --noEmit  → clean (0 errors)
npm run lint      → warnings only (pre-existing)
npm test          → 193/193 passed
```

---

## Phase 2 Complete ✅

> **Date:** 2026-05-28

All 9 route groups + checkout dedup done. Every route on kernel pattern (withRoute + ok/fail + shared createAdminClient + repo layer + Upstash rate limiting + lazy getResend).

### Summary
- **Groups 1-7:** Completed 2026-05-27 (webhooks, documents, partner, sales, attorney, crypto, admin, cron)
- **Group 8:** Trustee routes (6 files) — 2026-05-28
- **Group 9:** Auth + farewell routes (15 files) — 2026-05-28
- **H-10:** Checkout dedup — 2026-05-28
- **Skipped:** `auth/verify-link` (returns HTML, not JSON)

---

---

# Phase 3 — Validation at Every Boundary: What Has Been Fixed

> **Date:** 2026-05-28
> **Branch:** Yahia-Dev
> **Status:** Complete. Gate GREEN (193/193 tests, TSC clean, lint warnings-only).

---

## Step 3.1 — Full Route Audit

Audited all 79 API routes with POST/PUT/PATCH handlers:
- 16 routes already validated via `@/lib/validation/schemas`
- 4 routes validated via `@/lib/api/crypto` schemas
- 4 routes had inline `z.object()` (flagged for consolidation)
- **55 routes had no Zod validation**
- 12 of those 55 take no body (empty POST) — no schema needed
- 4 use FormData (not JSON) — validation added to JSON fields where applicable

## Step 3.2 — Schema Creation (40+ new schemas)

Added 40+ new Zod schemas to `lib/validation/schemas.ts`, organized by domain:

| Domain | Schemas Added |
|--------|--------------|
| **Auth** (11) | authCheckEmailSchema, authCheckVerificationSchema, authHandoffSchema, authHandoffConsumeSchema, authRecoverySchema, authResendVerificationSchema, authSendVerifyCodeSchema, authSendVerifyLinkSchema, authSetPasswordSchema, authSignupSchema, authVerifyCodeSchema |
| **Farewell/Trustee** (4) | farewellAccessSchema, farewellOwnerVetoSchema, trusteeUnlockOtpSchema, trusteeUnlockVerifySchema |
| **Attorney** (2) | attorneyApproveSchema, attorneyNotifyClientSchema |
| **Admin** (2) | adminFarewellVerificationSchema, adminTestPromoSchema |
| **Partner** (7) | partnerAddDomainSchema, partnerClientsCreateSchema, partnerClientsUpdateSchema, partnerEmailSetupSchema, partnerVaultClientCheckoutSchema, partnerVaultSubdomainSchema, createReviewAttorneySchema |
| **Sales** (6) | salesAffiliateStatusSchema, salesCreatePartnerSchema, salesCreateRepSchema, salesPartnerNotesSchema, salesRepsUpdateSchema, salesSendWelcomeEmailSchema |
| **Documents** (1) | documentGenerateSchema |
| **Other** (7) | contactSchema, emailPartnerActivatedSchema, professionalRequestAccessSchema, quizPersonalizeSchema, farewellUploadCompleteSchema, vaultPinSchema, stripeConnectOnboardSchema |
| **Consolidated inline** (5) | pubkeyQuerySchema, shareCreateSchema, backfillRowSchema, backfillEncryptSchema, backfillFetchQuerySchema |

Total schemas in `lib/validation/schemas.ts`: **63**

## Step 3.3 — Wired safeParse into 43 Routes

Every route with a JSON body now has `safeParse` at handler top with `fail("invalid payload", 400)` on failure. Pattern:

```ts
const body = await request.json();
const parsed = schemaName.safeParse(body);
if (!parsed.success) return fail("invalid payload", 400);
const { field1, field2 } = parsed.data;
```

### Auth routes (11 files):
| Route | Schema |
|-------|--------|
| `auth/check-email` | `authCheckEmailSchema` |
| `auth/check-verification` | `authCheckVerificationSchema` |
| `auth/handoff` | `authHandoffSchema` |
| `auth/handoff/consume` | `authHandoffConsumeSchema` |
| `auth/recovery` | `authRecoverySchema` |
| `auth/resend-verification` | `authResendVerificationSchema` |
| `auth/send-verify-code` | `authSendVerifyCodeSchema` |
| `auth/send-verify-link` | `authSendVerifyLinkSchema` |
| `auth/set-password` | `authSetPasswordSchema` |
| `auth/signup` | `authSignupSchema` |
| `auth/verify-code` | `authVerifyCodeSchema` |

### Farewell/Trustee/Attorney routes (6 files):
| Route | Schema |
|-------|--------|
| `farewell/access` | `farewellAccessSchema` |
| `farewell/owner-veto` (POST) | `farewellOwnerVetoSchema` |
| `trustee/unlock-otp` | `trusteeUnlockOtpSchema` |
| `trustee/unlock-verify` | `trusteeUnlockVerifySchema` |
| `attorney/approve` | `attorneyApproveSchema` |
| `attorney/notify-client` | `attorneyNotifyClientSchema` |

### Admin/Partner routes (8 files):
| Route | Schema |
|-------|--------|
| `admin/farewell-verification` (POST) | `adminFarewellVerificationSchema` |
| `admin/test-promo` (POST) | `adminTestPromoSchema` |
| `partner/add-domain` | `partnerAddDomainSchema` |
| `partner/clients` (POST) | `partnerClientsCreateSchema` |
| `partner/clients` (PUT) | `partnerClientsUpdateSchema` |
| `partner/email/setup` | `partnerEmailSetupSchema` |
| `partner/vault-client-checkout` | `partnerVaultClientCheckoutSchema` |
| `partner/vault-subdomain` (POST) | `partnerVaultSubdomainSchema` |
| `partners/create-review-attorney` | `createReviewAttorneySchema` |

### Sales/Docs/Other routes (14 files):
| Route | Schema |
|-------|--------|
| `sales/affiliates/[id]/status` | `salesAffiliateStatusSchema` |
| `sales/create-partner` | `salesCreatePartnerSchema` |
| `sales/create-rep` | `salesCreateRepSchema` |
| `sales/partner-notes` (POST) | `salesPartnerNotesSchema` |
| `sales/reps` (PATCH) | `salesRepsUpdateSchema` |
| `sales/send-welcome-email` | `salesSendWelcomeEmailSchema` |
| `documents/generate` | `documentGenerateSchema` |
| `contact` | `contactSchema` |
| `email/partner-activated` | `emailPartnerActivatedSchema` |
| `professionals/request-access` | `professionalRequestAccessSchema` |
| `quiz/personalize` | `quizPersonalizeSchema` |
| `vault/farewell/upload-complete` | `farewellUploadCompleteSchema` |
| `vault/pin` | `vaultPinSchema` |
| `stripe/connect/onboard` | `stripeConnectOnboardSchema` |

## Step 3.4 — Inline Schema Consolidation (4 files)

Moved inline `z.object()` schemas from route files into `lib/validation/schemas.ts`:

| Route | Inline removed | Centralized as |
|-------|---------------|----------------|
| `crypto/pubkey` | `QuerySchema` | `pubkeyQuerySchema` |
| `share` | `CreateSchema` | `shareCreateSchema` |
| `vault/backfill/encrypt` | `RowSchema` + `Schema` | `backfillEncryptSchema` (embeds `backfillRowSchema`) |
| `vault/backfill/fetch` | `Schema` | `backfillFetchQuerySchema` |

Removed `import { z }` from each file since Zod is no longer used directly.

## Step 3.5 — Duplicate Type Reconciliation

Removed 3 dead schemas + 3 dead type exports from `lib/validation/schemas.ts`:
- `willIntakeSchema` — snake_case fields, never matched actual form data (camelCase in `lib/will-types.ts`)
- `trustIntakeSchema` — same issue vs `lib/trust-types.ts`
- `quizAnswersSchema` — same issue vs `lib/quiz-types.ts`
- `type WillIntake`, `type TrustIntake`, `type QuizAnswers` — never imported anywhere

Source of truth for intake types remains the domain files (`will-types.ts`, `trust-types.ts`, `quiz-types.ts`).

## Routes Intentionally Not Validated

| Route | Reason |
|-------|--------|
| `auth/welcome` | No body — reads identity from session |
| `documents/send-email` | No body — reads identity from session |
| `client/mark-executed` | No body — reads identity from session |
| `subscription/cancel` | No body |
| `subscription/sync` | No body |
| `affiliate/onboarding` | No body |
| `partner/email/reset` | No body |
| `partner/email/test` | No body |
| `partner/email/verify` | No body |
| `partner/stripe-connect` | No body |
| `sales/affiliates/[id]/payout` | No body — uses route param |
| `trustee/logout` | No body |
| `auth/verify-link` | Returns HTML, not JSON |
| `webhooks/stripe` | Validated by Stripe signature, not Zod |
| `csp-report` | External format (CSP reports) |
| `farewell/verify` | FormData with file upload |
| `attorney/upload-reviewed` | FormData with file upload |
| `admin/marketing/materials` POST | FormData with file upload |

---

## Verify Gate Results

```
npx tsc --noEmit  → clean (0 errors)
npm run lint      → warnings only (pre-existing <img>, useEffect deps)
npm test          → 19 files, 193 tests, all passing
```

---

### Next: Phase 4 — Reliability & Scalability
