# EstateVault — Structural & Bug Audit

_Generated 2026-05-25. Scope: full codebase (auth/crypto, payments, API route layer, data/migrations). Findings below were produced by domain audits and the highest-severity items were re-read and verified directly against source. No files were modified._

## How to read this

- **Severity**: Critical (data loss, cross-tenant breach, money mis-paid) → High → Medium → Low.
- Each finding: problem · `file:line` · blast radius · fix.
- "Verified ✓" = re-read at source during this audit.

---

## Executive summary

The code that was written carefully (the `vault/*` routes, `lib/crypto/*` with its test suite, `calculateSplit`) is genuinely good and matches the conventions. The risk is concentrated in **two places**:

1. **Structural drift** — the canonical patterns never propagated. **8 routes use `requireAuth`; 49 use raw `auth.getUser()`.** Each of the 49 re-implements a service-role admin client inline (~40 copies) and gates roles by hand — which is the direct cause of several missing-authorization bugs. Validation is worse: **1 route** imports the shared Zod schemas; the rest trust raw `request.json()`.

2. **Non-atomic critical operations** — DEK provisioning, Stripe webhook processing, OTP throttling, and affiliate payouts all do check-then-write without atomicity or idempotency. Under retries/concurrency these corrupt keys, double-pay real money, or weaken brute-force gates.

The migration directory is half-migrated (legacy monolith + 17 undated files coexisting with 28 dated ones), which is a latent rebuild hazard but not a live production bug.

**Fix order (highest risk first):** Stripe webhook idempotency (C-1) → DEK AAD + atomic provisioning (C-2, C-3) → unauthenticated mutation routes (C-4, C-5) → broken role gating on writes (C-6, C-7) → attorney-verify money/column bug (C-8).

---

## CRITICAL

### C-1 — Stripe webhook has no idempotency; retries double-pay partners & affiliates
`app/api/webhooks/stripe/route.ts` (whole handler) · `lib/stripe-payouts.ts:54,72,91`
The handler never records `event.id` or checks if an event was already processed. Stripe retries on any non-2xx/timeout, and `checkout.session.completed` runs many sequential awaits (user creation, transfers, doc inserts). A re-delivery re-runs `transferToPartner` / `transferToAffiliate` and re-inserts `payouts` / `orders` rows. No `idempotencyKey` is passed to any `stripe.transfers.create`.
**Blast radius:** double-paying partners and affiliates real money; duplicate payout/order rows; duplicate generation jobs.
**Fix:** add a `processed_stripe_events(event_id pk, processed_at)` table; insert `event.id` at the top of the handler and return 200 if it already exists. Pass `{ idempotencyKey: \`transfer_${orderId}\` }` to every `transfers.create`.

### C-2 — DEK is wrapped with no AAD binding → cross-tenant vault decryption via a DB column copy  ✓
`lib/api/dek.ts:51` (`wrapKey(dek, kek)` with no associated data)
Every user's `wrapped_dek` is encrypted under the **same** app-wide KEK with no per-user binding. Anyone with a DB write path (SQL injection, compromised service role) can copy victim A's `wrapped_dek` onto attacker B's `clients` row; B's authenticated session then unwraps A's DEK and decrypts A's entire vault — no KEK compromise required.
**Blast radius:** full cross-tenant vault decryption from a single column copy.
**Fix:** bind AAD to client identity — `wrapKey(dek, kek, utf8("dek:" + client.id))` and pass the same AAD on unwrap. A swapped blob then fails the Poly1305 tag check.

### C-3 — `getOrCreateUserDek` write race mints two DEKs → permanent vault data loss  ✓
`lib/api/dek.ts:45-57`
Check-then-update is not atomic and the UPDATE is unconditional (`.eq("id", client.id)` with no `wrapped_dek IS NULL` guard). Two concurrent first-use requests (e.g. `/api/vault/file-key` + `/api/vault/trustees`) both read `wrapped_dek = null`, generate **different** DEKs, and the second UPDATE overwrites the first. Anything encrypted under DEK#1 becomes permanently undecryptable. Fails silently.
**Blast radius:** every Option-A vault item/document; silent, unrecoverable data loss.
**Fix:** `UPDATE clients SET wrapped_dek=... WHERE id=$1 AND wrapped_dek IS NULL`, then re-SELECT; if another writer won, unwrap the persisted value instead of returning the locally generated one. Or `INSERT ... ON CONFLICT` / advisory lock.

### C-4 — `documents/process` GET is fully public and destructive  ✓
`app/api/documents/process/route.ts:101` (no auth, no CRON_SECRET)
Anyone hitting it triggers Claude generation, flips orders/documents to `delivered`/`review`, sends client emails, auto-populates vaults, and **purges plaintext quiz answers** (`quiz_sessions.answers = {}`).
**Blast radius:** unauthenticated data destruction, Anthropic spend, forged/premature document delivery.
**Fix:** gate with a fail-closed `CRON_SECRET` bearer check or `requireAuth(["admin"])`.

### C-5 — `documents/cleanup-test-orders` GET deletes orders/docs/files with no auth
`app/api/documents/cleanup-test-orders/route.ts:15`
Public `GET`, no CRON_SECRET (unlike the `cron/*` routes). Deletes storage files, document rows, quiz sessions, and orders for any expired test order.
**Blast radius:** unauthenticated deletion.
**Fix:** add the fail-closed `CRON_SECRET` bearer check.

### C-6 — `partner/clients` lets any logged-in user create accounts under any partner  ✓
`app/api/partner/clients/route.ts:9` (POST), `:68` (PUT)
Checks only `if (!user)` — no `user_type` check, and `partnerId` is taken straight from the request body. Any authenticated client can create Supabase auth users, attach clients to arbitrary partners, and write `client_notes`.
**Blast radius:** account creation + CRM pollution across tenant boundaries.
**Fix:** `requireAuth(["partner","admin"])`; verify `partnerId` resolves to the caller's own partner (`partners.profile_id === user.id`) unless admin.

### C-7 — `sales/partner-notes` exposes/writes sales CRM to any authenticated user
`app/api/sales/partner-notes/route.ts:9` (GET), `:23` (POST)
Only `if (!user)`. Any client can read all internal sales notes for any `partnerId` and inject notes.
**Blast radius:** internal CRM data disclosure + tampering.
**Fix:** `requireAuth(["sales_rep","admin"])`.

### C-8 — Attorney verify writes wrong column + dollars into cents fields  ✓
`app/api/checkout/attorney/verify/route.ts:116-129`
The `partners` upsert uses `user_id: userId` — **the column is `profile_id`** (verified: `database.sql:48`, no `user_id` column exists). The partner row is never linked to the auth user (orphaned / RLS-invisible, or upsert error). Additionally `custom_review_fee: reviewFee` writes `300` into an integer-cents column (default `30000`), and `one_time_fee_amount: amount` writes a dollar value (`session.amount_total / 100`) into a cents column.
**Blast radius:** attorney review fee shows $3.00 instead of $300; platform-fee bookkeeping off 100×; partner unreachable by profile. Same `user_id` mistake appears in `sales/create-partner/route.ts:117`.
**Fix:** `profile_id: userId`; keep money in cents (`custom_review_fee: reviewFee * 100`, `one_time_fee_amount: session.amount_total`).

---

## HIGH

### H-1 — Paid amendment generates a full Will document set
`app/api/checkout/amendment/route.ts:99-105` → `app/api/webhooks/stripe/route.ts:311,598-611`
Amendment checkout sets metadata `product_type: "amendment"`, but the webhook casts `productType` as `"will" | "trust"` and has no amendment branch, so it inserts `["will","poa","healthcare_directive"]` and queues a will job for the amendment order.
**Blast radius:** every paid (non-subscriber) amendment gets wrong documents and mis-tracked state.
**Fix:** add an `if (productType === "amendment")` branch that marks paid/generating and queues amendment generation only; don't fall through.

### H-2 — Role-string drift: `"review_attorney"` / `"affiliate"` not in `UserType`
`lib/api/auth.ts:5` defines `UserType = "client"|"partner"|"sales_rep"|"admin"|"attorney"`, but the DB stores `"review_attorney"` (`partners/create-review-attorney/route.ts:54,83`) and `"affiliate"` (`affiliate/signup/route.ts:67`).
**Blast radius:** a future `requireAuth(["attorney"])` would never match a real review attorney → silent 403 lockout. Routes hard-code the raw `"review_attorney"` string (`documents/download/route.ts:59`, `attorney/notify-client/route.ts:22`) to compensate — works today only because they bypass `requireAuth`.
**Fix:** make the enum the single source of truth (`"review_attorney"`, `"affiliate"`), update consumers, drop magic strings.

### H-3 — Cron routes are world-callable when `CRON_SECRET` is unset
`cron/farewell-window-expired:29`, `cron/annual-review-reminder:25`, `cron/life-event-checkin:25`, `cron/farewell-veto-reminder:24`
All use `if (secret && auth !== ...)` — if the env var is missing the check is skipped and the endpoint (sends emails, issues trustee access tokens, unlocks vaults) is open.
**Fix:** fail closed — `if (!secret || auth !== \`Bearer ${secret}\`) return 401`.

### H-4 — Trustee OTP attempt counter is non-atomic → brute-force throttle is racy
`app/api/trustee/unlock-verify/route.ts:71-84`
Attempts are read, compared to `MAX_OTP_ATTEMPTS`, then written back. Concurrent requests all read the same low count, all pass the `< 5` gate, then each writes `count+1` (lost update). The 5-attempt cap on a 6-digit OTP can be substantially exceeded in parallel — this gate releases Share C → vault MK.
**Fix:** `UPDATE ... SET otp_email_attempts = otp_email_attempts + 1 WHERE id=$1 AND otp_email_attempts < 5 RETURNING ...`; reject on 0 rows affected. Add an Upstash limit on `unlock-verify:{requestId}`.

### H-5 — Affiliate batch payout race + no idempotency → double payout
`app/api/sales/affiliates/[id]/payout/route.ts:62-109`
`unpaid = earned - covered` is read, the transfer fires, then the `affiliate_payouts` row is inserted. Two concurrent admin clicks both read `covered` before either inserts → two transfers for the same balance. No lock, unique constraint, or idempotency key.
**Fix:** pass an `idempotencyKey` keyed on `affiliateId + unpaid + max(order created_at)`, or insert a `pending` payout row reserving the balance inside a transaction before calling Stripe.

### H-6 — Partner tier elevated before payment confirmation → free enterprise splits
`app/api/checkout/partner/route.ts:36-38`
`partners.tier` is updated right after creating the (unpaid) checkout session. If the partner abandons checkout, tier is already elevated — and tier drives the revenue split (enterprise = larger partner cut).
**Fix:** set tier only in the webhook `partner_platform_fee` branch (which already sets `one_time_fee_paid`).

### H-7 — Attorney paid signup stores tier that violates the DB CHECK
`app/api/checkout/attorney/route.ts:87,140` vs `verify/route.ts:59,121`
Checkout maps `"professional" → "enterprise"`, but `verify` stores `tier = meta.tier` raw (`"professional"`), which violates `partners.tier CHECK in ('standard','enterprise')` (`database.sql:53`). The insert is rejected.
**Fix:** normalize tier to standard/enterprise in verify (as the promo path does); centralize platform-fee amounts.

### H-8 — GET vault routes swallow DB errors and return empty as success  ✓
`vault/items/route.ts:42-48`, `vault/trustees/route.ts:35-40`, `vault/farewell/route.ts:22-29`
`const { data: rows } = await admin...` discards `error`. On a DB failure `rows` is null → route returns `{ items: [] }` with HTTP 200. A transient failure renders as "your vault is empty" — dangerous for an estate-vault product.
**Fix:** destructure `error`, `console.error("[GET vault_items]", error)`, return 500.

### H-9 — Missing ownership filter on vault UPDATE (admin client bypasses RLS)
`app/api/vault/items/route.ts:184`, `app/api/vault/farewell/route.ts:213`
The UPDATE filters only by `.eq("id", id)`. Ownership is checked in a prior SELECT, but the write itself isn't scoped by `client_id`. Since the admin client bypasses RLS, any race or future refactor dropping the pre-check writes to arbitrary users' rows. (The trustees DELETE at `trustees/route.ts:207-211` does it correctly — use as template.)
**Fix:** add `.eq("client_id", client.id)` to every UPDATE/DELETE so the ownership guard is atomic.

### H-10 — `clients` UPDATE policy has no `WITH CHECK` → users can self-activate vault subscription
`database.sql` policy "Clients can update own record" (`for update using (profile_id = auth.uid())`, no `with check`, no column restriction)
A client can write to their own `clients` row via the anon key, including `vault_subscription_status` and `wrapped_dek`. The farewell POST gate reads exactly `vault_subscription_status` (`farewell/route.ts:73-77`), so a user could set it to `'active'` and bypass the paid check.
**Fix:** add `WITH CHECK (profile_id = auth.uid())` plus a column-level guard (trigger or GRANT) blocking client writes to billing/key columns; or move the table fully behind the service role.

### H-11 — DB error messages leaked to clients
`vault/items:121,185`, `vault/trustees:130,161,212`, `share:161,208`, `admin/orders-missing-docs:43`, `documents/download-by-session:58`, `admin/marketing/materials*`
Routes return `error.message` straight from Supabase, leaking column/constraint names and schema.
**Fix:** log server-side, return generic `{ error: string }`.

### H-12 — `documents/download-by-session` authorizes on row existence alone
`app/api/documents/download-by-session/route.ts:45-49`
The promo/test fallback sets `authorized = true` if `orderId === doc.order_id` and the order row merely exists. Order IDs are UUIDs that appear on success pages — anyone learning a `documentId`+`orderId` pair gets a signed download URL with no session/ownership proof.
**Fix:** require a paid/test state tied to the requester, or drop the orderId fallback for non-test orders.

---

## MEDIUM

### M-1 — Structural: `requireAuth` not adopted (8 routes) vs raw `getUser()` (49 routes)  ✓
The canonical auth helper is almost unused outside `crypto/*` and `vault/*`. Each of the 49 hand-rolls `getUser()` + manual profile/role lookup and re-defines `createAdminClient()` inline (~40 copies). This duplication is the root cause of C-6/C-7 (easy to forget the role check) and means a future auth/RLS fix won't propagate.
**Fix:** migrate routes to `requireAuth([...roles])` (already supports the Bearer/cookie split); import the single `createAdminClient` from `@/lib/api/auth`.

### M-2 — Structural: validation not at the boundary (1 route uses shared schemas)
Only `affiliate/signup` imports `lib/validation/schemas.ts`. The vault routes use inline `z.object(...)`; the rest do raw `request.json()` with `if (!x)` truthiness checks — no shape/type/length/format enforcement. Notably `vault/trustees` and `vault/farewell` accept an email with no format validation and forward it to Resend.
**Fix:** add `trusteeSchema`, `farewellSchema`, etc. to `lib/validation/schemas.ts` (the `new-zod-schema` skill exists for this) and `safeParse` at each boundary.

### M-3 — Migration directory is half-migrated (rebuild hazard)
`supabase/migrations/` holds a 21KB `database.sql` monolith + 17 undated `migration-*.sql` files **and** 28 dated `YYYYMMDD_*.sql` files. The legacy files define core tables; the dated ones `ALTER` them — so apply order is load-bearing but unencoded (a lexical sort puts `2026…` before `database.sql`). Duplicate/conflicting definitions exist: `custom_review_fee` and `desired_review_fee` are each added twice (`migration-attorneys.sql` + `migration-fix-partners.sql`); farewell storage policies are created in `migration-farewell-storage.sql` then dropped in `20260509_e2ee_phase1.sql`. Saved today only by `IF EXISTS`/`OR REPLACE` idempotency.
**Fix:** squash legacy SQL into one timestamped baseline (`00000000000000_baseline.sql`), delete `database.sql` + `migration-*.sql`, keep only the dated lineage.

### M-4 — Duplicated/inline price & promo tables (no single source of truth)
Prices hardcoded inline: will `40000`/`evCut 10000` (`checkout/will:213,218`), trust `60000`/`20000` (`checkout/trust:193,198`), amendment `5000` (`checkout/amendment:79,86,101`), vault `9900` in 4 files. Promo codes (`FREE134`, `TPFP`) redefined per-route.
**Fix:** create `lib/orders/pricing.ts` exporting `PRICES` (cents) + promo definitions; reuse everywhere. The `calculateSplit` table itself is correct and matches the CLAUDE.md law — only the call sites drift.

### M-5 — `cryptoBootstrapRateLimit` = 1/hour can hard-lock a new user out of vault setup
`lib/rate-limit.ts` (`slidingWindow(1, '1 h')`) + `app/api/crypto/bootstrap/route.ts:24`
If bootstrap fails after passing the limiter but before persisting (bad payload, transient DB error, client crash), the user can't retry for an hour — and bootstrap gates all vault use.
**Fix:** consume the token only on success, or raise the limit; make bootstrap idempotent-retryable.

### M-6 — In-memory Maps for verification + rate limits break under serverless
`lib/auth/emailVerification.ts:22`, `lib/api/auth.ts:91`, `set-password/route.ts:15`, `send-verify-link/route.ts:10`
On Vercel each lambda instance has its own memory. The email-verification handshake can land on different instances (appears to fail), and rate limits silently don't apply (attacker hits a fresh instance each time). `set-password` is public and protected only by this ineffective limiter.
**Fix:** move verification state and these limiters to Upstash/Redis (`lib/rate-limit.ts` already exists).

### M-7 — `set-password` (public) creates/overwrites a password keyed only on email
`app/api/auth/set-password/route.ts:86-130`
Public route. Step 3 creates a new auth user with the caller-supplied password and links it to the most-recent order's unclaimed client, with the only ownership proof being possession of the email string (no verified-token check, unlike `signup`).
**Fix:** require a verified-email token (as signup does) and bind client-linking to that token, not "most recent order".

### M-8 — `sales/create-partner` has no try/catch (raw 500 + stack to client)
`app/api/sales/create-partner/route.ts:10`
`await request.json()` and every `admin.*` call can throw, producing an unhandled rejection with a Next.js stack. Only privileged route fully missing the convention; also no `Promise<NextResponse>` return type.
**Fix:** wrap in try/catch with `console.error("[sales/create-partner]", e)`.

### M-9 — Trustee `download-url` doesn't re-check `access_scope`
`app/api/trustee/vault/download-url/route.ts:48-67`
Issues a 60s signed Storage URL purely on the 30-min session cookie, without checking `vault_trustees.access_scope` (unlike the items route at `:53-92`). A scoped trustee can fetch out-of-scope documents/farewell by ID.
**Fix:** add the same scope check before signing.

### M-10 — Mixed Stripe API versions
`lib/stripe.ts:4` pins `2026-03-25.dahlia`; `lib/stripe-payouts.ts:3` pins `2024-12-18.acacia`. Two API versions in one codebase invites field-shape drift (the webhook already casts via `as unknown as Record<...>`).
**Fix:** align both on one pinned version.

---

## LOW

- **L-1 — `calculateSplit(productType: string)`** (`lib/stripe-payouts.ts:6`) returns all-zeros for a typo (e.g. `"wil"`) → silent underpay. Tighten to a `ProductType` union.
- **L-2 — `byteaToBytes` silent base64 fallback** (`lib/api/crypto.ts:23-28`): unknown formats don't throw, producing wrong-length keys that surface as opaque AEAD failures, masked further by the decrypt-catch that writes `"[decryption failed]"`. Throw on unrecognized formats; distinguish "no key" from "decrypt failed".
- **L-3 — Crypto audit log swallows all errors** (`lib/api/crypto.ts:157-161`): security events can silently fail to record. At least `console.error`.
- **L-4 — `shamir-setup` GET always reports "not initialized"** (`shamir-setup/route.ts:101-104`): casts to read columns not in the `requireClientUser` select list (`lib/api/crypto.ts:67`), so they're always undefined. Add the columns to `selectCols`.
- **L-5 — `shareRepo` non-null assertion** (`lib/repos/shareRepo.ts:151`): `decodeBytea(s.wrappedDek)!` can be null at runtime where `Uint8Array` is typed. Filter out null-decoding shares.
- **L-6 — Duplicated encoding helpers** (`bytesToAB`/bytea/b64) copy-pasted in `documentRepo`, `documentSealedRepo:61`, `videoRepo:41`, `backfillRepo:13`, `cryptoRepo:8`, `shareRepo:11`. Consolidate into `lib/crypto/encoding.ts`.
- **L-7 — Missing indexes** on `farewell_verification_requests.trustee_id` / `client_id` (`migration-vault-subscription.sql:37-49`); both are used in unindexed `.eq(...)` scans.
- **L-8 — Missing explicit `Promise<NextResponse>` return types** on essentially all in-scope handlers (convention).
- **L-9 — `professionals/request-access`** uses `@supabase/supabase-js` `createClient` instead of the project's `@supabase/ssr` admin helper — structural outlier.
- **L-10 — Provider (Resend) error messages returned to client** in `partner/email/*` (`test:36`, `setup:38`, `verify:26`).

---

## Untested critical seams (fragile by definition)

`lib/crypto/__tests__/*` covers envelope roundtrip/vectors/stream/shamir/worker, and `tests/unit/*` covers `calculateSplit`. **No tests** exist for:
- DEK wrap/unwrap + AAD binding and atomic provisioning (`lib/api/dek.ts`) — where C-2/C-3 live.
- Stripe webhook idempotency, amendment routing, attorney-verify cents bug — where C-1/H-1/C-8 live.
- Trustee token MAC verify (incl. legacy `.`-format path), session forgery, OTP attempt cap.

Add characterization tests around these **before** refactoring them.

---

## Suggested execution plan

1. **Stop the money/data bleeds (Critical):** C-1 webhook idempotency, C-2/C-3 DEK fixes (add a test first), C-4/C-5 lock down the public document routes, C-6/C-7 add role gating, C-8 fix attorney-verify column+cents.
2. **Close auth holes (High):** H-3 fail-closed cron, H-2 role enum, H-8/H-9/H-10 vault error/ownership/RLS, H-12 download authz, H-1 amendment branch, H-6/H-7 partner tier, H-4/H-5 atomic OTP & payout.
3. **Reduce drift (Medium, ongoing):** sweep routes onto `requireAuth` + shared admin client + Zod (M-1/M-2), centralize pricing (M-4), squash migrations (M-3), move rate-limit/verification state to Redis (M-5/M-6).
4. **Polish (Low):** types, encoding-helper consolidation, indexes, return types.

Do these in small verified steps (`npx tsc --noEmit && npm run lint && npm test` after each), not one big rewrite — and never touch pricing/split/hard-stop business logic under "cleanup".
