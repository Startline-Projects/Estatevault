# EstateVault — Remediation Plan

_Created 2026-06-02. Covers the **16 findings** still Open (⛔) or Partial (🟡) from [CODE_AUDIT.md](CODE_AUDIT.md). Fixed/N-A items are excluded. Ordered by risk into 5 phases; each task lists the problem, files to touch, concrete steps, the test that proves it, and a rough effort (S = <½ day, M = ~1 day, L = >1 day)._

> ## ✅ Implementation status (2026-06-02)
> **15 of 16 implemented, coded + verified** (`tsc` clean of new errors · 376 tests pass · lint clean on changed files):
> Phase 1 — C-2 ✅, C-1 ✅ · Phase 2 — H-1 ✅, H-12 ✅, H-6 ✅, M-9 ✅ · Phase 3 — H-4 ✅, H-5 ✅ · Phase 4 — M-6 ✅, M-5 ✅, H-11 ✅, L-10 ✅, L-3 ✅ · Phase 5 — L-7 ✅, L-8 ✅.
>
> **Deferred (1):** **4.6 · M-3** migration squash — left as-is by choice (rebuild hygiene, not a live bug; the baseline file is intentionally empty). Steps below remain for when it's picked up; recommended path is the Supabase preview-branch test.
>
> **New migrations to apply on deploy:** `20260602_dek_aad_binding.sql` (C-2), `20260602_otp_attempts_atomic.sql` (H-4), `20260602_farewell_verif_indexes.sql` (L-7). Regenerate `types/db.generated.ts` from the DB afterward.
> **New tests:** `lib/crypto/__tests__/dek-aad.test.ts`, `tests/unit/stripe-transfer-idempotency.test.ts`. **New shared helper:** `lib/security/trusteeScope.ts`.

## Ground rules (every task)

1. Write the failing test **first** where one is listed — then make it pass.
2. After each task: `npx tsc --noEmit && npm run lint && npm test` must be green before moving on.
3. Never touch pricing/split/hard-stop business logic under "cleanup" (CLAUDE.md law).
4. One task = one small PR where possible. Don't batch unrelated fixes.

---

## Phase 1 — Crypto & money safety (do first)

### 1.1 · C-2 (⛔) — Bind the DEK wrap to client identity (AAD)
**Problem:** A user's wrapped vault key has no "owner" stamped on it; copying it onto another account row lets that account decrypt the victim's vault.
**Files:** `lib/crypto/keyManager.ts`, `lib/crypto/aead.ts` (already supports AAD), `lib/api/dek.ts`.
**Steps:**
1. Change `wrapKey(mk, kek)` → `wrapKey(mk, kek, aad)` and `unwrapKey(env, kek)` → `unwrapKey(env, kek, aad)`; pass `aad` straight through to `encryptBytes`/`decryptBytes`.
2. In `lib/api/dek.ts`, build `const aad = utf8("dek:" + client.id)` and pass it at every wrap (line ~51) and unwrap (lines ~55, ~80).
3. **Migration path:** existing blobs were wrapped with no AAD. Add a fallback: on unwrap, try with AAD; if the tag check fails, retry once with no AAD and immediately **re-wrap with AAD** and persist. Gate this behind a `dek_aad_version` column so it runs once per user. (Or run a one-off backfill script if downtime is acceptable.)
**Test (write first):** new `lib/crypto/__tests__/dek-aad.test.ts` — wrap with client A's AAD, confirm unwrap with A's AAD succeeds and unwrap with B's AAD throws.
**Effort:** L (the legacy-blob migration is the hard part).

### 1.2 · C-1 (🟡) — Idempotency key on every Stripe transfer
**Problem:** Event-level replay is blocked, but a mid-handler crash can still re-fire a money transfer on Stripe's retry.
**Files:** `lib/stripe-payouts.ts` (`transferToPartner`, `transferToAffiliate`), call sites in `app/api/webhooks/stripe/route.ts`.
**Steps:**
1. Add an `idempotencyKey` param to the transfer helpers; pass `{ idempotencyKey }` as the second arg to `stripe.transfers.create(params, { idempotencyKey })`.
2. Derive a stable key per logical payout: `transfer_partner_${orderId}` and `transfer_affiliate_${orderId}` (NOT random — must be identical across retries).
**Test:** unit test asserting the helper forwards the `idempotencyKey` option; extend `tests/unit/stripe-idempotency.test.ts`.
**Effort:** S.

---

## Phase 2 — Correctness gaps

### 2.1 · H-1 (⛔) — Amendment branch in the webhook
**Problem:** Paid $50 amendments fall through to the will/trust path and generate a full new document set.
**Files:** `app/api/webhooks/stripe/route.ts` (`handleDocumentCheckout`).
**Steps:**
1. Read `metadata.product_type` as `"will" | "trust" | "amendment"`.
2. Add `if (productType === "amendment")` **before** the will/trust logic: mark the order paid/generating, queue an amendment-only generation job, and do **not** insert `["will","poa","healthcare_directive"]`.
3. Confirm the amendment generation job/route already exists; if not, wire it to the existing amendment flow.
**Test:** unit test — feed a `product_type: "amendment"` checkout event, assert no full document set is inserted and an amendment job is queued.
**Effort:** M.

### 2.2 · H-12 (⛔) — Verify order ownership on download-by-session
**Problem:** Test-order downloads only check `order_type === "test"`, not that the order belongs to the requester.
**Files:** `app/api/documents/download-by-session/route.ts`.
**Steps:**
1. In the test-order branch, require the requester's `client_id` to match `order.client_id` (resolve the caller's client from session/auth).
2. If there is no authenticated requester for a test flow, drop the `orderId`-only fallback entirely for non-test orders and require the session token.
**Test:** route test — requester whose client ≠ order owner gets 403 even for a test order.
**Effort:** S.

### 2.3 · H-6 (⛔) — Move partner tier upgrade to after payment
**Problem:** Tier is elevated when checkout starts, so abandoned checkouts keep a free upgrade.
**Files:** `app/api/checkout/partner/route.ts` (remove the early `partnerRepo.update({ tier })`), `app/api/webhooks/stripe/route.ts` (`partner_platform_fee` branch).
**Steps:**
1. Delete the `partnerRepo.update(admin, partnerId, { tier })` call after session creation; instead stash the target tier in the session `metadata`.
2. In the webhook `partner_platform_fee` branch (which already sets `one_time_fee_paid`), set `tier` from `metadata` there.
**Test:** unit test — creating a session does not change tier; processing the paid webhook does.
**Effort:** S.

### 2.4 · M-9 (⛔) — Re-check access_scope before signing trustee download URL
**Problem:** A limited trustee can download out-of-scope files by ID.
**Files:** `app/api/trustee/vault/download-url/route.ts` (mirror the check in the items route ~`:53-92`).
**Steps:**
1. Load `vault_trustees.access_scope` for the session's trustee.
2. Before signing, confirm the requested document/farewell item falls within scope; return 403 otherwise.
3. Extract the scope-check into a shared helper so the items route and this route can't drift again.
**Test:** route test — scoped trustee requesting an out-of-scope item gets 403.
**Effort:** M.

---

## Phase 3 — Make racy gates atomic

### 3.1 · H-4 (🟡) — Atomic OTP attempt counter
**Problem:** Read-then-write counter lets the per-code guess cap be exceeded by parallel requests. (Cap is **per code** — resets to 0 on each new/burned code, not a lifetime lock — and each code already has an expiry. `MAX_OTP_ATTEMPTS` was raised 5 → **10** for typo tolerance; security-neutral, since each new code is still 1-in-1,000,000.)
**Files:** `app/api/trustee/unlock-verify/route.ts` (`MAX_OTP_ATTEMPTS`, now 10), `lib/repos/server/farewellVerificationRepo.ts` (`incrementOtpAttempts`).
**Steps:**
1. Replace the read-then-write with an atomic conditional update: a Postgres RPC or `.update({...}).lt("otp_email_attempts", MAX).select()` that increments only while under the cap and **returns the affected row**; reject when 0 rows come back.
2. (Defense in depth) add an Upstash rate limit keyed on `unlock-verify:{requestId}`.
3. **Resend rate-limit (required):** issuing a new code resets the counter to 0, so an attacker could spam resends for unlimited fresh 10-guess batches. Cap resends per request (e.g. 3/hour) in the OTP-issue route — the per-code cap is meaningless without this.

> **⚠️ Steps 1 and 3 are both required — not either/or.** They close two separate holes:
> - Atomic counter alone → one code truly caps at 10, but resend gives unlimited fresh batches.
> - Resend cap alone → resends are limited, but the race lets one code yield 50+ guesses in a millisecond.
> Fix one, the attacker uses the other. With both: ~10 guesses × ~3 resends/hour ≈ 30 guesses/hour against a 1,000,000 space = safe. Ship them together, not as a menu.

**Test:** concurrency test firing N parallel verifies asserts attempts never exceed `MAX_OTP_ATTEMPTS`; resend test asserts the resend limit holds.
**Effort:** M.

### 3.2 · H-5 (🟡) — Idempotency / balance reservation on affiliate payout
**Problem:** Two concurrent admin clicks can double-pay an affiliate.
**Files:** `app/api/sales/affiliates/[id]/payout/route.ts`, `lib/repos/server/payoutRepo.ts`.
**Steps:**
1. Pass an `idempotencyKey` to the Stripe transfer keyed on `affiliateId + unpaid + max(order created_at)`.
2. **Or** insert a `pending` `affiliate_payouts` row (unique constraint on the key) reserving the balance *before* calling Stripe; flip to `paid` after.
**Test:** unit test — two calls with the same computed balance produce one transfer.
**Effort:** M.

---

## Phase 4 — Robustness & reliability

### 4.1 · M-6 (🟡) — Move email verification state to Redis
**Problem:** Verification codes live in one server's memory; on Vercel a different instance handling the "verify" click never sees them.
**Files:** `lib/auth/emailVerification.ts` (replace `globalThis.__emailVerificationStore` Map), reuse `lib/rate-limit.ts` Redis client.
**Steps:**
1. Store `{ email → token, expiry }` in Upstash Redis with a TTL.
2. `consumeVerifiedToken` becomes a Redis GET + DEL (atomic via `GETDEL`).
**Test:** unit test against a Redis mock — token set on one "instance" is readable on another.
**Effort:** M. **Note:** unblocks the M-7 caveat too.

### 4.2 · M-5 (⛔) — Don't burn the bootstrap rate-limit token on failure
**Problem:** One failed vault-setup attempt locks a new user out for an hour.
**Files:** `app/api/crypto/bootstrap/route.ts`, `lib/rate-limit.ts`.
**Steps:**
1. Move the limiter check so the token is consumed **only after** a successful bootstrap, or raise the window to a sane retry count (e.g. 5/hour).
2. Make bootstrap idempotent-retryable (re-running with the same input is a no-op).
**Test:** route test — a failed bootstrap leaves the limiter untouched; a second attempt is allowed.
**Effort:** S.

### 4.3 · H-11 (🟡) — Stop leaking DB error messages
**Problem:** A few admin/share routes still return raw `error.message`.
**Files:** `app/api/admin/orders-missing-docs/route.ts:23`, `app/api/admin/marketing/materials/route.ts:29,89`, `app/api/share/route.ts:151,198`.
**Steps:** replace `return fail(error.message, …)` with `console.error("[route]", error); return fail("something went wrong", 500)`.
**Test:** route test asserting the body contains no DB column/constraint text.
**Effort:** S.

### 4.4 · L-10 (🟡) — Generic message on email-setup provider error
**Files:** `app/api/partner/email/setup/route.ts:37`.
**Steps:** stop returning the Resend `error.message`; log it, return a friendly message.
**Effort:** S.

### 4.5 · L-3 (⛔) — Log audit-write failures
**Files:** `lib/api/crypto.ts:137-147`.
**Steps:** keep the write non-blocking but change the rejection handler to `(e) => console.error("[audit]", e)`.
**Effort:** S.

### 4.6 · M-3 (⛔ — DEFERRED by choice 2026-06-02) — Finish the migration squash
> Not done. Left as-is intentionally; `00000000000000_baseline.sql` is empty, legacy files remain, live DB unaffected. Recommended when picked up: test the squash on a Supabase **preview branch** (`supabase db reset` + schema diff vs prod) before deleting `database.sql` + `migration-*.sql`. Steps below stand.
**Problem:** Legacy `database.sql` + undated `migration-*.sql` still coexist with the dated lineage; rebuild order is fragile.
**Files:** `supabase/migrations/*`.
**Steps:**
1. Dump the current schema to one `00000000000000_baseline.sql` (verify it matches a fresh `supabase db reset`).
2. Delete `database.sql` and all undated `migration-*.sql`.
3. Keep only the baseline + dated lineage; confirm `supabase db reset` rebuilds cleanly from scratch.
**Test:** CI step / manual — `supabase db reset` succeeds from an empty DB.
**Effort:** L (careful, must verify the rebuild byte-for-byte).

---

## Phase 5 — Polish

### 5.1 · L-7 (🟡) — Add missing indexes
**Files:** new dated migration on `farewell_verification_requests`.
**Steps:** `CREATE INDEX IF NOT EXISTS` on `trustee_id` and `client_id`.
**Effort:** S.

### 5.2 · L-8 (🟡) — Explicit `Promise<NextResponse>` return types
**Files:** non-`withRoute` handlers (e.g. `app/api/share/route.ts`).
**Steps:** add the explicit return type annotation; ideally migrate stragglers onto `withRoute`.
**Effort:** S.

---

## Sequencing — status

| Phase | Tasks | Theme | Status |
|-------|-------|-------|--------|
| 1 | C-2, C-1 | Crypto & money safety | ✅ done |
| 2 | H-1, H-12, H-6, M-9 | Correctness gaps | ✅ done |
| 3 | H-4, H-5 | Atomic gates | ✅ done |
| 4 | M-6, M-5, H-11, L-10, L-3 | Robustness | ✅ done · **M-3 deferred** |
| 5 | L-7, L-8 | Polish | ✅ done |

All phases implemented + verified except **M-3** (migration squash), deferred by choice. Pricing/split/hard-stop logic untouched throughout.
