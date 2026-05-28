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

## Next: Phase 2 — Structural Refactor (Server Repos + Thin Routes)

Per PRODUCTION_PLAN.md, Phase 2 migrates ~96 remaining routes onto kernel pattern. Groups in order:
1. cron (4 routes)
2. webhooks (~6 routes)
3. documents (~12 routes)
4. partner / sales (~20 routes)
5. attorney (~8 routes)
6. crypto (~6 routes)
7. admin (~10 routes)
8. trustee (~10 routes)
9. auth (~10 routes)
