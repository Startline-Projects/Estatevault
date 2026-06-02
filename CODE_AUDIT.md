# EstateVault — Structural & Bug Audit

_Original audit 2026-05-25. **Remediation pass re-verified 2026-06-02**, then **implemented 2026-06-02** (15 of 16 remaining items coded + verified; M-3 deferred by choice). Each finding below carries a **Status** line; implemented fixes note the change + any migration. Verification gate at implementation: `tsc` clean of new errors, 376 tests pass, lint clean on changed files._

## How to read this

- **Severity**: Critical (data loss, cross-tenant breach, money mis-paid) → High → Medium → Low.
- **Status**: ✅ Fixed · 🟡 Partial · ⛔ Open · ⚪ N/A — verified at source on 2026-06-02.
- Each finding: problem · `file:line` · blast radius · fix · current status.
- "Verified ✓" = re-read at source during the original audit.

---

## Remediation scorecard (implemented 2026-06-02)

| Severity | Fixed | Open | N/A | Total |
|----------|:-----:|:----:|:---:|:-----:|
| Critical | 8 | 0 | 0 | 8 |
| High     | 11 | 0 | 1 | 12 |
| Medium   | 9 | 1 | 0 | 10 |
| Low      | 9 | 0 | 1 | 10 |
| **Total**| **37** | **1** | **2** | **40** |

**Implemented this pass (15):** C-1, C-2, H-1, H-4, H-5, H-6, H-11, H-12, M-5, M-6, M-9, L-3, L-7, L-8, L-10 — all ✅, code + tests + 3 new migrations.

**Still open (1):** M-3 squash migrations (⛔) — **deferred by choice**; latent rebuild hygiene, not a live bug.

**Migrations to apply on deploy:** `20260602_dek_aad_binding.sql` (C-2), `20260602_otp_attempts_atomic.sql` (H-4), `20260602_farewell_verif_indexes.sql` (L-7).

---

## Executive summary

The refactor (Phases 0–7) closed most of the original risk. The canonical patterns **propagated**: a `withRoute` kernel now wraps ~100/120 routes, `requireAuth([...roles])` is adopted across 35 routes, shared Zod schemas validate at 59 boundaries, pricing is centralized in `lib/orders/pricing.ts`, encoding helpers are consolidated in `lib/crypto/encoding.ts`, and rate limits moved to Upstash Redis. Server logic moved into `lib/repos/server/*`.

**Implementation pass (2026-06-02)** then closed all but one of the remaining items:

1. **Crypto hardening complete** — DEK now provisioned atomically (C-3 ✅) **and** AAD-bound to client id (C-2 ✅, legacy blobs self-heal on read). Stripe transfers all carry an `idempotencyKey` (C-1 ✅).

2. **Racy gates made atomic** — trustee OTP counter is now a locked `increment_otp_attempt` RPC + resend rate-limit (H-4 ✅); affiliate payout uses a deterministic idempotency key (H-5 ✅).

3. **Correctness gaps closed** — paid amendments get their own webhook branch (H-1 ✅); `download-by-session` requires authenticated order ownership (H-12 ✅); partner tier moves to the post-payment webhook (H-6 ✅); trustee `download-url` enforces `access_scope` via a shared helper (M-9 ✅).

4. **Robustness** — email verification on Redis (M-6 ✅); bootstrap limiter 1→5/hr (M-5 ✅); residual DB-error leaks genericised (H-11 ✅); audit-write failures logged (L-3 ✅); indexes + return types (L-7/L-8 ✅); email-setup error generic (L-10 ✅).

**Only deferred item:** **M-3** migration squash (⛔) — left as-is by choice; the baseline file is intentionally empty, the legacy `database.sql` + `migration-*.sql` remain, the live DB is unaffected. Pick up later with a Supabase preview-branch test.

---

## CRITICAL

### C-1 — Stripe webhook idempotency; retries double-pay partners & affiliates
`app/api/webhooks/stripe/route.ts:44-51` · `lib/stripe-payouts.ts`
**Status: ✅ Fixed (implemented 2026-06-02).** Event-level dedup via `stripe_webhook_events` was already in place; this pass added an `idempotencyKey` to every `stripe.transfers.create` — `transfer_partner_${orderId}`, `transfer_affiliate_${orderId}`, and a caller-supplied/derived key for the affiliate batch (`lib/stripe-payouts.ts`). Covered by `tests/unit/stripe-transfer-idempotency.test.ts`.
**In plain English:** Stripe sometimes sends us the same payment notification twice. We now remember each notification's ID and refuse to handle it a second time — that part is done. But if our code crashes *in the middle* (after we've already sent money to a partner but before we finish recording it), a retry could send that money a second time. The remaining fix is to stamp every money-transfer with a unique label so Stripe itself rejects a duplicate transfer, even mid-crash.
**Blast radius:** narrowed to the transfer-API layer; duplicate payout/order inserts are now prevented by event dedup.
**Fix:** pass `{ idempotencyKey: \`transfer_${orderId}\` }` to every `stripe.transfers.create`.

### C-2 — DEK is wrapped with no AAD binding → cross-tenant vault decryption via a DB column copy  ✓
`lib/crypto/keyManager.ts:25-31` (`wrapKey`/`unwrapKey` pass no AAD) · `lib/api/dek.ts:51,55,80`
**Status: ✅ Fixed (implemented 2026-06-02).** `wrapKey`/`unwrapKey` now take an `aad` param; `lib/api/dek.ts` binds `aad = utf8("dek:" + client.id)` on wrap and unwrap, so a swapped blob fails the Poly1305 tag check. Legacy no-AAD blobs self-heal on read (try-AAD → fallback no-AAD → re-wrap with AAD → persist, recorded via new `clients.dek_aad_version`). Migration `20260602_dek_aad_binding.sql`; tested in `lib/crypto/__tests__/dek-aad.test.ts`.
**In plain English:** Each user's vault is locked with a personal key, and that key is itself locked away with one shared master lock. The problem: the locked-up key has no "owner name" written on it. So if someone with database access copies *your* locked key and pastes it onto *their* account row, their normal login will happily unlock it and read your entire vault — they never needed to crack any master lock. The fix is to write the owner's ID into the lock itself, so a key copied to the wrong account simply won't open. This is the single highest-risk item left.
**Blast radius:** full cross-tenant vault decryption from a single column copy.
**Fix:** thread AAD through — `wrapKey(dek, kek, utf8("dek:" + client.id))` and the same AAD on unwrap, so a swapped blob fails the Poly1305 tag check.

### C-3 — `getOrCreateUserDek` write race mints two DEKs → permanent vault data loss  ✓
`lib/api/dek.ts:58-65`
**Status: ✅ Fixed.** The UPDATE is now guarded `.is("wrapped_dek", null)` (atomic compare-and-set), then re-SELECTs; a losing concurrent writer falls through and unwraps the persisted value instead of returning its locally generated DEK. Data-loss race closed.

### C-4 — `documents/process` GET fully public and destructive  ✓
`app/api/documents/process/route.ts:76-79`
**Status: ✅ Fixed.** GET now fails closed: `if (!secret || authorization !== \`Bearer ${secret}\`) return fail("unauthorized", 401)` before any generation/purge.

### C-5 — `documents/cleanup-test-orders` GET deletes with no auth
`app/api/documents/cleanup-test-orders/route.ts:10-13`
**Status: ✅ Fixed.** Same fail-closed `CRON_SECRET` bearer check now gates the destructive GET.

### C-6 — `partner/clients` lets any logged-in user create accounts under any partner  ✓
`app/api/partner/clients/route.ts:21-31` (POST), `:76-86` (PUT)
**Status: ✅ Fixed.** Both handlers now run `requireAuth(["partner"])` then `verifyPartnerOwnership(admin, profile.id, partnerId)`, returning 403 on mismatch. Cross-tenant account creation closed.

### C-7 — `sales/partner-notes` exposes/writes sales CRM to any authenticated user
`app/api/sales/partner-notes/route.ts:7-9` (GET), `:18-20` (POST)
**Status: ✅ Fixed.** Both verbs now require `requireAuth(["sales_rep","admin"])`.

### C-8 — Attorney verify writes wrong column + dollars into cents fields  ✓
`app/api/checkout/attorney/verify/route.ts:115-126`
**Status: ✅ Fixed.** Upsert now uses `profile_id: userId`, `custom_review_fee: reviewFee * 100` (cents), and `one_time_fee_amount: session.amount_total ?? 0` (already cents from Stripe). The sibling `sales/create-partner` was corrected in the same sweep.

---

## HIGH

### H-1 — Paid amendment generates a full Will document set
`app/api/checkout/amendment/route.ts` → `app/api/webhooks/stripe/route.ts:267`
**Status: ✅ Fixed (implemented 2026-06-02).** `handleDocumentCheckout` now early-returns to a new `handleAmendmentCheckout` when `product_type === "amendment"`: marks the order paid/generating, pays any partner cut, and never inserts a will/trust document set or queues a will job (`app/api/webhooks/stripe/route.ts`).
**In plain English:** When a customer pays the small $50 fee to *amend* an existing document, the payment handler only knows two words: "will" and "trust." It has no idea what "amendment" means, so it falls back to treating the purchase like a brand-new Will — and generates a full Will + power of attorney + healthcare directive set. The fix is to teach the handler a third case: if the purchase is an amendment, just queue the amendment, not a whole new document package.
**Fix:** add an `if (productType === "amendment")` branch that marks paid/generating and queues amendment generation only.

### H-2 — Role-string drift: `"review_attorney"` not in `UserType`
`lib/api/auth.ts:6`
**Status: ✅ Fixed.** `UserType` now includes `"review_attorney"` (and the DB CHECK matches). Note: `"affiliate"` is intentionally **not** a `user_type` — affiliates live in a separate `affiliates` table, not `profiles.user_type`, so no enum entry is needed there.

### H-3 — Cron routes world-callable when `CRON_SECRET` is unset
`cron/farewell-window-expired:14-17` · `annual-review-reminder:17-20` · `life-event-checkin:16-20` · `farewell-veto-reminder:14-18`
**Status: ✅ Fixed.** All four now fail closed: `if (!secret || auth !== \`Bearer ${secret}\`) return fail("unauthorized", 401)`.

### H-4 — Trustee OTP attempt counter is non-atomic → brute-force throttle is racy
`app/api/trustee/unlock-verify/route.ts:38` → `lib/repos/server/farewellVerificationRepo.ts:204-207`
**Status: ✅ Fixed (implemented 2026-06-02).** `incrementOtpAttempts` now calls an atomic `increment_otp_attempt(p_request_id, p_max)` RPC (`UPDATE ... +1 WHERE attempts < max RETURNING`); the verify route rejects with 429 when it returns null. A resend rate-limit (`trusteeOtpResendRateLimit`, 3/hr per request) caps fresh codes so the per-code cap can't be bypassed by spamming resends. `MAX_OTP_ATTEMPTS` is 10. Migration `20260602_otp_attempts_atomic.sql`.
**In plain English:** A trustee gets 10 guesses per emailed code. The code counts guesses by reading the current number, adding one, and writing it back. If an attacker fires many guesses at the *exact same instant*, they can all read "1 so far," all think they're under the limit, and all go through — so the cap can be blown past. The fix is to let the database do the "+1 and check the limit" in a single locked step that two requests can't both win. Note: since a resend resets the counter, a **resend rate-limit** is also required, or an attacker just spams resends for unlimited fresh batches.
**Fix:** `UPDATE ... SET otp_email_attempts = otp_email_attempts + 1 WHERE id=$1 AND otp_email_attempts < 10 RETURNING ...`; reject on 0 rows. Add an Upstash limit on `unlock-verify:{requestId}` and cap resends per request.

### H-5 — Affiliate batch payout race + no idempotency
`app/api/sales/affiliates/[id]/payout/route.ts:40-55`
**Status: ✅ Fixed (implemented 2026-06-02).** The payout route now derives a deterministic `idempotencyKey` (sha256 of `affiliateId:unpaid:sorted(orderIds)`) and passes it to `transferToAffiliateBatch`, so two concurrent admin clicks collapse to one Stripe transfer; a later genuine payout includes new orders → different key → not blocked.
**In plain English:** When an admin clicks "pay this affiliate," the code works out what's owed, sends it, then records it. If an admin double-clicks (or two admins click together), both can work out the same amount owed before either records it — and the affiliate gets paid twice. Only admins can do this, so the real-world risk is small, but there's no safety latch. The fix is a unique label on the payout (so a repeat is rejected) or reserving the balance before sending.
**Fix:** pass an `idempotencyKey` keyed on `affiliateId + unpaid + max(order created_at)`, or insert a `pending` payout reserving the balance before calling Stripe.

### H-6 — Partner tier elevated before payment confirmation → free enterprise splits
`app/api/checkout/partner/route.ts:40-42`
**Status: ✅ Fixed (implemented 2026-06-02).** The early `partnerRepo.update({ tier })` was removed from `checkout/partner/route.ts`; the target tier now rides in session metadata and is applied only in the webhook `partner_platform_fee` branch, which already sets `one_time_fee_paid`. An abandoned checkout no longer grants a free upgrade.
**In plain English:** A partner is bumped up to the higher "enterprise" tier the moment they *start* the upgrade checkout — before any money is taken. If they close the tab and never pay, they keep the enterprise tier anyway, which gives them a bigger cut of every sale for free. The fix is to apply the upgrade only after the payment actually clears (in the webhook that already marks the fee as paid).
**Fix:** set tier only in the webhook `partner_platform_fee` branch (which already sets `one_time_fee_paid`).

### H-7 — Attorney paid signup stores tier that violates the DB CHECK
`app/api/checkout/attorney/verify/route.ts:114`
**Status: ✅ Fixed.** `verify` now normalizes `const normalizedTier = tier === "professional" ? "enterprise" : "standard"` before insert, satisfying the `('standard','enterprise')` CHECK. The promo path normalizes too.

### H-8 — GET vault routes swallow DB errors and return empty as success  ✓
`vault/items/route.ts:40-42` · `vault/trustees/route.ts:45-47` · `vault/farewell/route.ts:33-35`
**Status: ✅ Fixed.** All three now destructure the error, `console.error("[vault/... GET]", err)`, and return `fail("could not load ...", 500)` instead of an empty-but-200 payload.

### H-9 — Missing ownership filter on vault UPDATE (admin client bypasses RLS)
`lib/repos/server/vaultItemRepo.ts:42-43` · `lib/repos/server/farewellRepo.ts:80-85`
**Status: ✅ Fixed.** Writes moved into `updateForOwner(admin, id, clientId, update)` repo functions scoped `.eq("id", id).eq("client_id", clientId)`; the route call sites (`vault/items:175`, `vault/farewell:214`) use them, making the ownership guard atomic with the write.

### H-10 — `clients` UPDATE policy has no `WITH CHECK`
`supabase/migrations/*`
**Status: ⚪ N/A (by design).** There is **no RLS policy on `clients`** in the current schema — the table is reached only through the service-role admin client, which bypasses RLS, and ownership is enforced in the repo layer (`vaultItemRepo`/`farewellRepo` `updateForOwner`). The original anon-key self-activation path no longer exists. **Caveat:** if RLS is ever added to `clients`, it must include `WITH CHECK (profile_id = auth.uid())` plus a column guard on billing/key columns.

### H-11 — DB error messages leaked to clients
`admin/orders-missing-docs/route.ts:23` · `admin/marketing/materials/route.ts:29,89` · `share/route.ts:151,198`
**Status: ✅ Fixed (implemented 2026-06-02).** The remaining leaks were genericised — `admin/orders-missing-docs`, `admin/marketing/materials` (3 sites), and `share` (POST + DELETE) now `console.error` the real error and return a generic message.
**In plain English:** When something goes wrong in the database, a few admin and "share" pages still show the user the raw database error — which can reveal internal table and column names that help an attacker map our system. The vault pages were cleaned up; these few remaining ones should log the real error privately and show the user a plain "something went wrong."
**Fix:** log server-side, return generic `{ error: string }`.

### H-12 — `documents/download-by-session` authorizes on row existence alone
`app/api/documents/download-by-session/route.ts:26-42`
**Status: ✅ Fixed (implemented 2026-06-02).** The test-order branch now resolves the authenticated caller (`createClient().auth.getUser()` → `clientRepo.getIdByProfile`) and authorizes only when their `client_id` matches `order.client_id`. A known `documentId`+`orderId` pair alone no longer yields a signed URL.
**In plain English:** To download a document, the code accepts it if the order is a "test" order — but it never checks that the test order actually belongs to the person asking. Both the document ID and order ID show up on the success page (they're just UUIDs), so anyone who has seen those two values could download the file. The fix is to confirm the requester actually owns that order, not just that it's flagged "test."
**Fix:** require the requester's client to own the order (match `client_id`), not just `order_type === "test"`.

---

## MEDIUM

### M-1 — Structural: `requireAuth` adoption  ✓
**Status: ✅ Fixed.** `withRoute` now wraps ~100/120 routes; `requireAuth([...roles])` is used in ~35 routes (was 8); the inline `createAdminClient` duplication is consolidated. The auth pattern propagates — the root cause behind C-6/C-7 is structurally addressed.

### M-2 — Structural: validation at the boundary
**Status: ✅ Fixed.** ~59 routes now import `@/lib/validation/schemas` and `safeParse` at the boundary (was 1). `vault/trustees` and `vault/farewell` validate email/shape with `trusteeCreateSchema`/`farewellCreateSchema` before forwarding to Resend.

### M-3 — Migration directory is half-migrated (rebuild hazard)
`supabase/migrations/`
**Status: ⛔ Open — deferred by choice (2026-06-02).** The only remaining item. A `00000000000000_baseline.sql` placeholder exists but is **intentionally empty**; the legacy `database.sql` + `migration-*.sql` remain alongside the dated lineage. The live DB is unaffected — this is a rebuild-hygiene hazard, not a bug. Recommended path when picked up: generate the baseline, then test the squash on a throwaway Supabase preview branch (`supabase db reset` + schema diff vs prod) before deleting the legacy files.
**In plain English:** The folder that builds our database from scratch is a mix of an old giant file, old files with no dates, and new dated files. The order they run in matters, but nothing enforces it — so rebuilding the database (e.g. for a new environment or disaster recovery) is risky and could break. Someone started a clean "baseline" file but didn't delete the old ones, so the mess is still there. The fix is to finish: collapse everything into one dated baseline and delete the legacy files.
**Fix:** finish the squash — delete `database.sql` + `migration-*.sql`, keep only the dated/baseline lineage.

### M-4 — Duplicated/inline price & promo tables
`lib/orders/pricing.ts`
**Status: ✅ Fixed.** `lib/orders/pricing.ts` now exports `PRICES` (cents) — will `40000`, trust `60000`, amendment `5000`, vault `9900`, attorney review `30000` — and the checkout routes consume it. No hardcoded `9900` remains in route files.

### M-5 — `cryptoBootstrapRateLimit` = 1/hour can hard-lock a new user out of vault setup
`lib/rate-limit.ts:30` · `app/api/crypto/bootstrap/route.ts:26`
**Status: ✅ Fixed (implemented 2026-06-02).** `cryptoBootstrapRateLimit` raised `slidingWindow(1, '1 h')` → `slidingWindow(5, '1 h')`. A single failed attempt no longer hard-locks a new user; brute-force protection stays intact (bootstrap is auth-gated and the route 409s once `crypto_setup_at` is set, making retries idempotent).
**In plain English:** A new user gets just one vault-setup attempt per hour. The "attempt" is counted the moment they try — even if it fails because of a bad network or a glitch. So if their one shot fails, they're locked out for a full hour and can't use the vault at all (vault setup gates everything). The fix is to only count the attempt when it actually succeeds, or simply allow more retries.
**Fix:** consume the token only on success, or raise the limit; make bootstrap idempotent-retryable.

### M-6 — In-memory Maps for verification + rate limits break under serverless
`lib/rate-limit.ts` (Redis) · `lib/auth/emailVerification.ts:19-23` (still in-memory)
**Status: ✅ Fixed (implemented 2026-06-02).** `emailVerification.ts` now stores the handshake in Upstash Redis (keyed `emailverify:<email>`, TTL'd), with the in-process Map kept only as a local-dev fallback when Redis isn't configured. All six callers (`send-verify-code`, `verify-code`, `send-verify-link`, `verify-link`, `check-verification`, `signup`, `set-password`) await the now-async functions. (Also closes the M-7 in-memory caveat.)
**In plain English:** Our app runs on many small servers at once (Vercel spins them up as needed). Rate-limiting was fixed by storing counts in one shared place (Redis). But email verification still remembers the code in *one server's* memory. If the user's "verify" click lands on a *different* server that never saw the code, verification randomly fails. The fix is to store the verification code in the same shared Redis so any server can find it.
**Fix:** move verification state to Redis too.

### M-7 — `set-password` (public) creates/overwrites a password keyed only on email
`app/api/auth/set-password/route.ts:25`
**Status: ✅ Fixed.** Now requires a verified-email token: `if (!verifiedToken || !consumeVerifiedToken(normalizedEmail, verifiedToken)) return fail("Please verify your email first.", 403)` before any account creation. (Token store inherits the M-6 in-memory caveat.)

### M-8 — `sales/create-partner` has no try/catch
`app/api/sales/create-partner/route.ts`
**Status: ✅ Fixed.** Now wrapped in `withRoute` (so throws become structured 500s, not raw stacks) with an explicit inner try/catch around the Resend send; returns `Promise<NextResponse>`.

### M-9 — Trustee `download-url` doesn't re-check `access_scope`
`app/api/trustee/vault/download-url/route.ts:25-48`
**Status: ✅ Fixed (implemented 2026-06-02).** A shared `lib/security/trusteeScope.ts` (`resolveTrusteeScope` + `categoryAllowed`) now backs both routes; `download-url` loads `access_scope` and returns 404 for out-of-scope documents / farewell / vault-item categories before signing. The items route was refactored onto the same helper so the two can't drift again.
**In plain English:** A trustee can be given *limited* access — say, only the legal documents but not the personal farewell messages. When they request a download link, the code checks they're a valid trustee but forgets to re-check *what they're allowed to see*. So a limited trustee who knows a file's ID can still download files outside their permission. The fix is to add the same permission-level check the regular listing page already does, before handing out the download link.
**Fix:** add the same scope check before signing the URL.

### M-10 — Mixed Stripe API versions
`lib/stripe.ts:7` · `lib/stripe-payouts.ts`
**Status: ✅ Fixed.** `stripe-payouts.ts` now imports the shared `stripe` instance; both align on the single pinned `2026-03-25.dahlia`.

---

## LOW

- **L-1 — `calculateSplit` typo → all-zeros silent underpay** (`lib/orders/pricing.ts`, `lib/stripe-payouts.ts:4-18`): **✅ Fixed (safe-degrade).** Param is still typed `string`, but unknown types return explicit zero-splits and `tests/unit/stripe-webhooks.test.ts` covers the unknown-type case. A `ProductType` union would add compile-time safety.
- **L-2 — `byteaToBytes` silent base64 fallback** (`lib/crypto/encoding.ts:18-36`): **✅ Fixed.** Now throws `Error("unrecognized bytea value")` on junk (non-string/Buffer/array) types; the legacy base64 fallback for plain strings is intentional. Covered by `tests/unit/encoding.test.ts`.
- **L-3 — Crypto audit log swallows all errors** (`lib/api/crypto.ts`): **✅ Fixed (implemented 2026-06-02).** `logAudit` now destructures the insert `error` and `console.error("[crypto audit] failed to record", action, error)` — still non-blocking, but failures are no longer silent.
  - _Plain English:_ We keep a security log of sensitive actions. If writing to that log fails, the code says nothing at all — so a missing security record goes unnoticed. It's deliberately non-blocking (a log failure shouldn't break the user), but it should at least print the error so we know it happened.
- **L-4 — `shamir-setup` GET always reports "not initialized"** (`app/api/crypto/shamir-setup/route.ts:89-101`, `lib/api/crypto.ts:52`): **✅ Fixed.** `selectCols` now includes `vault_shamir_initialized_at`/`vault_shamir_version`; GET reports real state.
- **L-5 — `shareRepo` non-null assertion** (`lib/repos/shareRepo.ts:119-139`): **✅ Fixed.** Rows with null `item` are `continue`d before the `decodeBytea(...)!`, so the assertion is now safe.
- **L-6 — Duplicated encoding helpers** : **✅ Fixed.** Consolidated into `lib/crypto/encoding.ts`; `lib/api/crypto.ts:13` re-exports, and `shareRepo`/others import from it.
- **L-7 — Missing indexes** on `farewell_verification_requests`: **✅ Fixed (implemented 2026-06-02).** Migration `20260602_farewell_verif_indexes.sql` adds `idx_farewell_verif_trustee_id` and `idx_farewell_verif_client_id`.
  - _Plain English:_ An "index" is like a book's index — it lets the database jump straight to rows instead of scanning every page. Two columns we search by have no index, so those lookups read the whole table. It's fine while the table is small, but it'll slow down as data grows. Add the indexes.
- **L-8 — Missing explicit `Promise<NextResponse>` return types**: **✅ Fixed (implemented 2026-06-02).** The non-`withRoute` `share/route.ts` GET/POST/DELETE handlers now declare `: Promise<NextResponse>`; remaining handlers get the contract from `withRoute`.
  - _Plain English:_ Most route functions don't spell out what type they return. The shared `withRoute` wrapper enforces it for the routes that use it, so things work — but a few routes that skip the wrapper rely on the compiler guessing. Adding the explicit type is a small safety/readability win, not a bug.
- **L-9 — `professionals/request-access` Supabase client** (`app/api/professionals/request-access/route.ts`): **⚪ N/A.** Re-review concludes the direct `@supabase/supabase-js` admin client is acceptable for a server-only route; no change needed.
- **L-10 — Provider (Resend) error messages returned to client** (`partner/email/*`): **✅ Fixed (implemented 2026-06-02).** `partner/email/setup/route.ts` now logs the Resend error server-side and returns a generic `"domain create failed"`.
  - _Plain English:_ When the email service (Resend) returns an error, one of our email-setup pages still passes that raw error straight to the user. Two of the three pages were cleaned up; this last one should show a friendly message instead. Low risk, since these are domain-setup errors, not sensitive data.

---

## Tests added / remaining seams

**Added since the original audit:** `tests/unit/stripe-idempotency.test.ts`, `tests/unit/stripe-webhooks.test.ts` (split / unknown-type), `tests/unit/attorney-verify-c8.test.ts` (cents fix), `tests/unit/encoding.test.ts`, alongside the existing `lib/crypto/__tests__/*`.

**Added in the implementation pass (2026-06-02):** `lib/crypto/__tests__/dek-aad.test.ts` (C-2 — AAD binds to client, swapped blob rejected, legacy back-compat), `tests/unit/stripe-transfer-idempotency.test.ts` (C-1 — per-role/per-order keys).

**Still without isolated unit tests (need a live/seeded DB):**
- The H-4 atomic `increment_otp_attempt` RPC and the resend rate-limit — logic is DB-side; verify with a concurrency test against a seeded DB.
- Trustee token MAC verify (incl. legacy `.`-format path) and session forgery.

---

## Suggested execution plan — status

1. **Crypto hardening:** C-2 DEK AAD ✅, C-1 transfer keys ✅.
2. **Correctness gaps:** H-1 ✅, H-12 ✅, H-6 ✅, M-9 ✅.
3. **Racy gates atomic:** H-4 ✅, H-5 ✅.
4. **Robustness:** M-5 ✅, M-6 ✅, H-11 ✅, L-10 ✅, L-3 ✅; **M-3 squash migrations — deferred (only remaining item).**

All implemented in small verified steps (`tsc --noEmit && next lint && vitest run` — clean of new errors, 376 tests pass). Pricing/split/hard-stop business logic was not touched. **Deploy note:** apply the 3 new migrations (`20260602_dek_aad_binding`, `_otp_attempts_atomic`, `_farewell_verif_indexes`) and regenerate `types/db.generated.ts` from the DB.
