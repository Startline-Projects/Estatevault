# Known Bugs & Risks — Will / Trust Purchase Flow

Tracking doc for checkout + fulfillment failure modes. Severity: Critical > High > Medium > Low.

## BUG-1 — Webhook miss = paid but not fulfilled
- **Status:** ✅ FIXED (2026-06-09)
- **Severity:** Critical
- **Area:** Stripe webhook handler (needs audit)
- **What:** Card is charged but `checkout.session.completed` webhook is missed/delayed/errors. Order never advances; documents never generate.
- **Impact:** Customer paid, gets nothing. Highest-trust failure.
- **Repro:** Disable webhook endpoint, complete a test payment → order stuck `pending`/`paid`.
- **Fix:** Ensure handler is idempotent + retried. Add reconciliation job polling Stripe for completed sessions whose orders are still pending. Alert on paid-but-unfulfilled orders past threshold.
- **Resolution:** Webhook is now idempotent — `stripeWebhookRepo.claimEvent(event.id)` dedups true duplicates while re-running crashed/partial attempts, then `markCompleted`/`markFailed`. Reconciliation cron `app/api/cron/reconcile-orders/route.ts` checks the end result (are the PDFs there?) independent of generation path: re-dispatches the replay-safe handler for paid orders that never ran, triggers generation for orders stuck in `generating`, and alerts admin on anything unfinished past 60 min. Admin `retry-fulfillment` route for manual recovery. (Commit 1b7274f.)

---

## BUG-2 — Acknowledgment signature is faked server-side (Core Rule 3)
- **Severity:** Critical
- **Area:** `lib/checkout/createCheckoutSession.ts:188-189` (also `:351-352`, `:416-420`); `app/will/checkout/page.tsx` (paid path)
- **What:** Rule 3 requires the client to sign the "this is not legal advice" acknowledgment before any document is generated. The normal paid path never shows an acknowledgment step (only the free/promo path does), yet the server unconditionally writes `acknowledgment_signed: true` + `acknowledgment_signed_at: now()` on every order. The Zod checkout schema has no acknowledgment field, so nothing from the client is even checked.
- **Impact:** Documents generate for customers who never acknowledged; the order record falsely asserts they did. Compliance + legal-exposure (records are fabricated proof).
- **Repro:** Set `sessionStorage.willIntake` directly (or skip the intake ack card), reach `/will/checkout`, pay → order created with `acknowledgment_signed: true` though no acknowledgment was shown.
- **Check on website:** Start a will and go through to checkout with a real card — notice you are never shown a "check this box to agree" step on the pay path. Then look at the order (Supabase `orders` table, or the order in the dashboard): `acknowledgment_signed` is `true` anyway.
- **Fix:** Require an explicit `acknowledged: boolean` in the checkout schema; reject (400) when false; set the column from that value, never a hardcoded `true`. Show the acknowledgment on the paid path too.

---

## BUG-3 — Hard stops (special-needs / irrevocable) not enforced on the purchase paths (Core Rule 4)
- **Status:** ✅ FIXED (2026-06-09)
- **Severity:** Critical
- **Area:** `app/quiz/page.tsx:118-128` (only place a hard stop exists); `app/will/page.tsx`, `app/trust/page.tsx` (no hard-stop questions); `lib/checkout/createCheckoutSession.ts` and `lib/webhooks/stripe/handleDocumentCheckout.ts:274-322` (no server enforcement)
- **What:** Rule 4 says special-needs dependent / irrevocable trust must halt generation → attorney referral, "hardcoded, no override." The only hard-stop logic is React state in the marketing quiz. `/will` and `/trust` are separate, directly-linked entry points (Hero, Footer, PackageCards) that never ask the risky questions, and neither checkout nor the webhook re-checks anything before generating. The trust flow's `checkComplexity` is a different, overridable "complex" flag — not a hard stop.
- **Impact:** A family that legally must see an attorney can start from the homepage, never be asked, pay $400–$600, and receive auto-generated documents. The advertised "cannot be overridden" safeguard does not exist on the paid paths. The webhook is the last possible checkpoint and performs no stop check.
- **Repro:** Go straight to `/trust` (skip quiz) → complete intake (no special-needs question shown) → pay → documents generate, no referral.
- **Check on website:** From the homepage click **Trust** (not the quiz) → go through every intake screen → confirm it never asks about a special-needs dependent or irrevocable trust → reach checkout → it lets you pay. The "see an attorney" screen never appears.
- **Fix:** Ask the hard-stop questions inside both `/will` and `/trust`, AND re-derive them from `intakeAnswers` server-side in `createCheckoutSession` and again in the webhook before queueing — block with an attorney-referral response. Never rely on a client flag.
- **Resolution:** Hardcoded hard-stop logic centralized in `lib/compliance/hardStop.ts` (`evaluateHardStop`). Enforced server-side at two checkpoints, never trusting a client flag: `createCheckoutSession.ts` halts before payment (returns hardStop + reasons → attorney referral) and `handleDocumentCheckout.ts` re-derives from `intakeAnswers` before queueing generation. Hard-stop questions now rendered in both `/will` and `/trust` (`hardStopped` state). Test: `tests/unit/hard-stop.test.ts`.

---

## BUG-4 — Platform pays out more attorney-review fee than it collected ($300 fixed in, up to $1,000+ out)
- **Status:** ✅ FIXED (2026-06-09)
- **Severity:** Critical (direct money loss)
- **Area:** `lib/attorney-review/routing.ts:88`; `lib/webhooks/stripe/handleAttorneyReview.ts:57-69`; `lib/checkout/createCheckoutSession.ts:148`; `lib/validation/schemas.ts:163,548`; SSOT `lib/orders/pricing.ts:27`
- **What:** The client is ALWAYS charged `PRICES.attorneyReview` = 30000 ($300) at checkout (hardcoded, partner-independent). But for an attorney partner with an in-house reviewer (routing Case 4), `resolveReviewRouting` returns `feeAmount: partner.custom_review_fee || DEFAULT` and `handleAttorneyReview` transfers exactly that to the partner's Connect account. `custom_review_fee` has no upper bound tied to what was collected — attorney signup `review_fee` is `nonnegative().optional()` (no max), the partner self-update PATCH caps at $1,000, `/pro/settings` lets the partner set it freely. The canonical guard `ATTORNEY_REVIEW_FEE_RANGE { min:15000, max:150000 }` is **defined but referenced nowhere** (grep confirms zero usages).
- **Impact:** Partner sets review fee to $1,000+. Each attorney-reviewed order: client pays $300, EstateVault transfers $1,000+ → **net loss of $700+ per review out of platform funds.** Breaks the "3.6 invariant" the routing comment claims to protect.
- **Repro:** Attorney partner with in-house reviewer sets `custom_review_fee` to 100000; a client buys will/trust + attorney review ($300); webhook transfers $1,000 to the partner.
- **Check on website:** As an attorney partner go to **Pro → Settings**, set review fee to $1,000, save. Have a test client buy a Will with Attorney Review (pays $300). In **Stripe → Connect → that partner → Transfers**, the attorney_review_fee transfer is $1,000 vs the $300 collected.
- **Fix:** Clamp `custom_review_fee` to `ATTORNEY_REVIEW_FEE_RANGE` at every write boundary; never transfer more than the attorney cut actually collected. If a partner's fee exceeds $300, charge that amount at client checkout instead of the fixed price.
- **Resolution:** Fee is now admin-controlled; partners cannot set it. (1) `custom_review_fee` removed from `partnerSelfUpdateSchema` and `review_fee` removed from attorney signup — partner write paths gone. (2) Admin sets per-partner fee via `PATCH /api/sales/partners/[partnerId]` (admin-only, clamped) and the platform default via `POST /api/admin/attorney-review-fee` (stored in `app_settings`). (3) `resolveReviewRouting` takes a `platformDefaultFee` and clamps `custom_review_fee` through `clampAttorneyReviewFee()`. (4) Checkout charges the **resolved** fee (`createCheckoutSession.ts`) instead of the fixed $300, so collected == transferred. (5) Webhook hard guard: `transfer = min(routing.feeAmount, order.attorney_cut)` in `handleAttorneyReview.ts`. Tests: `pricing.test.ts` (clamp), `security-rule-guards.test.ts` (routing clamp + platform default).

---

## BUG-5 — Cancelling a vault subscription revokes paid access immediately (mid-period)
- **Status:** ✅ FIXED (2026-06-09)
- **Severity:** Critical (paid value revoked)
- **Area:** `app/api/subscription/cancel/route.ts:22-29`; gates at `subscription/status/route.ts:20`, `vault/upload-url/route.ts:42`, `vault/farewell/route.ts:82`, `vault/download-document/route.ts:23`
- **What:** Cancel correctly tells Stripe `cancel_at_period_end: true` (sub stays live until term end) but then immediately sets `vault_subscription_status = "cancelled"` in the DB. Every vault gate checks `status === "active"` and never consults `vault_subscription_expiry`. The route's own comment says "Cancel at period end, don't revoke access mid-period" — the DB flip does exactly that.
- **Impact:** A customer who paid for a year and cancels in month 2 instantly loses vault uploads, farewell messages, downloads, and free amendments for the 10 months already paid. Refund/chargeback risk.
- **Repro:** Active subscriber → POST `/api/subscription/cancel` → GET `/api/subscription/status` returns `canUseFarewell:false`; vault upload/farewell/download 403.
- **Check on website:** Subscribe to the vault, click Cancel Subscription, then immediately try to upload a document or record a farewell — you're blocked despite having paid through term end.
- **Fix:** On cancel keep `status: "active"` (or a `cancel_pending` state the gates still treat as active) until `vault_subscription_expiry`; let `customer.subscription.deleted` flip it at period end. Better: gate on `status active OR expiry > now`.
- **Resolution:** Took the "gate on expiry too" path. New `clientRepo.hasVaultAccess(status, expiry)` returns true when `status === "active"` OR `status === "cancelled" && expiry > now`. All four gates now call it — `subscription/status/route.ts:26`, `vault/upload-url/route.ts:42`, `vault/farewell/route.ts:82`, `vault/download-document/route.ts:23`. Cancel still flips status to `cancelled` (drives the cancel-pending UI) but access holds until `vault_subscription_expiry`. Tests: `vault-access.test.ts`.

---

## BUG-6 — set-password links a stranger's order/documents to a brand-new account ✅ FIXED
- **Status:** Fixed — removed the global 10-order orphan scan in `set-password`. Client↔profile linkage is owned by the Stripe webhook (keys on verified `customer_email` + `metadata.client_id`); set-password now only sets the account password.
- **Severity:** Critical (cross-customer data disclosure)
- **Area:** `app/api/auth/set-password/route.ts:67-87`
- **What:** When set-password creates a NEW account, it queries the **10 most recent orders across ALL customers** (`orders` ordered by `created_at desc, limit 10` — no filter by email/client/session), finds the first whose `clients` row has `profile_id IS NULL`, and assigns that client to the just-created user. Nothing ties the orphaned client to the email being set up. Guest checkout deliberately creates `clients` rows with null `profile_id`, so orphaned clients are the normal state right after any guest purchase.
- **Impact:** A user completing set-password shortly after ANY guest checkout (their own or a stranger's) can be linked to a different customer's client — inheriting their orders and generated documents (will/trust, beneficiaries, PII). A timing race: whoever finishes set-password first claims the most-recent orphaned client. The real purchaser loses their order linkage.
- **Repro:** (1) Victim does guest will checkout → client row with null profile_id, order now. (2) Attacker verifies their own email and POSTs `/api/auth/set-password` with no pre-existing profile. (3) New attacker account is linked to the victim's client; attacker's dashboard shows victim's documents.
- **Check on website:** Two browsers. A: guest will purchase (don't set password). B: sign up fresh via email-verify and set a password. Log into B's dashboard → it shows A's order/documents.
- **Fix:** Link only a client whose record matches the verified email (store email on guest client/order at checkout and match), or link strictly by the `client_id` from the verified checkout session. Remove the global 10-order scan.

---

## BUG-7 — Public `download-zip` leaks any customer's will/trust PDFs (unauthenticated IDOR) — ✅ FIXED
- **Status:** Fixed — route removed entirely. The ZIP endpoint was reachable only from the test-mode "Download Documents" button on the success pages; we deleted that button instead of hardening it. Removed: `app/api/documents/download-zip/route.ts`, the `publicPaths` allowlist entry in `lib/supabase/middleware.ts:162`, `downloadZip`/`getRaw` in `lib/api-client/documents.ts`, and the test-ZIP blocks + imports in `app/will/success/page.tsx` and `app/trust/success/page.tsx`. Real downloads remain via the per-document `download-by-session` route (Stripe `session_id`/owner-checked). The endpoint now 404s — no order_id URL can pull documents.
- **Severity:** Critical (cross-customer PII disclosure)
- **Area:** `app/api/documents/download-zip/route.ts:33-71`; in the public allowlist `lib/supabase/middleware.ts:162`
- **What:** The route is in `publicPaths` (no session). It takes `order_id` from the query, uses the **service-role admin client**, selects that order's documents (`status in generated/delivered`, storage_path not null), downloads each PDF, and streams a ZIP — with no Stripe-session check, no ownership check, and no `order_type='test'` restriction. The "Test" filename wording is cosmetic; the query matches every real paid order. The sibling `download-by-session` was hardened (H-12) to require a matching session_id or authenticated owner; this route never got that.
- **Impact:** Anyone who knows/guesses an `order_id` UUID can anonymously download another customer's actual Will/Trust/POA/Healthcare Directive — full legal PII (names, addresses, beneficiaries, executors, assets). (Limit: E2EE-sealed docs aren't server-decryptable, so the leak is every non-sealed order.)
- **Repro:** Logged out, `GET /api/documents/download-zip?order_id=<any order UUID>&first_name=x&last_name=y` → 200, ZIP of that order's PDFs. Expected 401/403.
- **Check on website:** Complete a normal (unsealed) will checkout in browser A; note the `order_id` in the success URL / Network tab. In incognito (logged out), open `/api/documents/download-zip?order_id=<that id>` → the documents download with no login.
- **Fix:** Apply the `download-by-session` model — require a matching Stripe `session_id` or `requireAuth()` + ownership; drop it from the public allowlist. Never serve real-order documents from an unauthenticated admin-client route.

---

## BUG-8 — Webhook marks an event "processed" BEFORE doing the work → any mid-handler failure permanently poisons the retry — ✅ FIXED
- **Severity:** Critical
- **Area:** `app/api/webhooks/stripe/route.ts:42-49`; `lib/repos/server/stripeWebhookRepo.ts:8-14`; `lib/api/route.ts:16-23`
- **What:** The idempotency guard inserts+commits the `event_id` row BEFORE the handlers run. The handlers are long non-transactional sequences (account create → order update → payout → affiliate stats → document insert → attorney review → queue). If any step throws, `withRoute` returns a 500 to Stripe — but the `event_id` is already committed, so Stripe's redelivery hits `checkIdempotency` → null → the route short-circuits to `{received:true, duplicate:true}` and never re-runs the handler.
- **Impact:** Customer charged, partial fulfillment frozen forever, and the very mechanism that should heal it (Stripe retry) is silently consumed. Strictly worse than BUG-1 (delivery miss): here it arrived, half-ran, failed, and disabled its own retry. No reconciliation cron exists.
- **Repro:** Force any write in `handleDocumentCheckout` to throw on first delivery → webhook 500s. Replay the same event with the Stripe CLI → `{received:true,duplicate:true}`, order stuck `generating`, documents never created.
- **Check on website:** In staging, break a write in the doc-checkout handler, pay a checkout → charged but no documents; resending the Stripe event does nothing.
- **Fix:** Mark the event processed only AFTER the handler succeeds (insert at end, or a `received`→`processed` two-phase state, or wrap handler+marker in one transaction); on error don't leave a committed marker — return non-2xx so Stripe redelivers into a clean re-run. Add a reconciliation cron.
- **Resolution:** Two-phase guard in `app/api/webhooks/stripe/route.ts` + `lib/repos/server/stripeWebhookRepo.ts`: `claimEvent` claims the event as `processing` (only a prior `completed` row is a true duplicate; `processing`/`failed` rows re-run); `markCompleted` runs only after the handler returns, `markFailed` + HTTP 500 on throw so Stripe redelivers. `stripe_webhook_events` carries `status`/`completed_at`/`last_error` with `event_id` PK backing the claim. Reconcile cron at `app/api/cron/reconcile-orders/route.ts` (every 15 min) re-runs paid-but-unfulfilled orders. Verified live: 265 completed / 2 failed (retryable) / 0 poisoned. Re-runs are safe per BUG-23 idempotency.

---

## BUG-9 — Stripe session creation can orphan a `pending` order — ✅ FIXED
- **Severity:** High
- **Area:** `lib/checkout/createCheckoutSession.ts` (~line 226)
- **What:** Order row is inserted before the Stripe Checkout session is created. If `stripe.checkout.sessions.create()` throws (bad/expired key, Stripe outage, network), the request 500s but the `pending` order row already exists with no `stripe_session_id`.
- **Impact:** Orphan `pending` orders accumulate; never paid, never cleaned up; pollute reporting. Retries create duplicates.
- **Repro:** Set invalid `STRIPE_SECRET_KEY`, run a will/trust checkout → `pending` order in DB with no session.
- **Fix:** Create Stripe session first then insert order, OR try/catch and delete/mark-failed the order on Stripe error. Add cron to expire stale `pending` orders.
- **Resolution:** `stripe.checkout.sessions.create()` in `lib/checkout/createCheckoutSession.ts` is now wrapped in try/catch — on failure it deletes the just-created order (`orderRepo.deleteById`) and returns HTTP 502 with a friendly retry message, so no orphan is left. Safe because the order has nothing attached yet (payment/docs/payouts/affiliate-click all happen later). Cleanup sweep added to `app/api/cron/reconcile-orders/route.ts`: deletes `status='pending'` + `stripe_session_id IS NULL` + older than 30 min (logs ids first, never a silent mass delete), covering pre-existing orphans and the rare case where session create succeeds but the session-id update fails. Verified live: sweep matches a real orphan but NOT an abandoned-with-session order nor a fresh in-flight one.

---

## BUG-10 — Document generation failure = paid, no documents
- **Status:** ✅ FIXED (2026-06-10)
- **Severity:** High
- **Area:** Doc-gen pipeline (Claude API) + `documents` table
- **What:** Order paid + marked `generating`, but AI generation fails (API error, timeout, rate limit). Documents stay `pending`/`generating` indefinitely.
- **Impact:** Paid, no usable output. No auto-retry surfaces it.
- **Repro:** Force Claude API call to fail during generation → stuck `documents` rows.
- **Fix:** Retry with backoff. Admin alert/dashboard for orders stuck in `generating`. Manual re-trigger.
- **Resolution:** Failure is now honest and recoverable. (1) On a Claude/gen error the worker marks that document `failed` and does **not** advance the order to `delivered` — it stays `generating` so a safety net can catch it (`app/api/documents/process/route.ts:202-212` and the queue path `:331-353`). (2) Auto-retry: `app/api/cron/reconcile-orders/route.ts` runs every 15 min (`vercel.json` cron `*/15 * * * *`), finds orders stuck in `generating`/`failed`/`pending` with missing PDFs and re-fires `process-now`, which re-runs all doc types for the order so previously `failed` docs regenerate. (3) Admin alert: `sendFulfillmentFailureAlert` for anything unfinished past 60 min. (4) Admin dashboard: `app/api/admin/orders-missing-docs/route.ts` lists every stuck order with a `failureKind` tag. (5) Manual re-trigger: `app/api/admin/retry-fulfillment/route.ts` (one-click) + `regenerate-missing`. Same fulfillment safety net as BUG-1/BUG-13.

---

## BUG-11 — Account linking failure on success page locks out paying customer
- **Status:** ✅ FIXED (2026-06-10)
- **Severity:** High
- **Area:** `components/success/PasswordSetup.tsx` + set-password API
- **What:** After payment, success page creates/links the auth account + sets password. If profile/auth-user creation fails here, customer paid but can't log in.
- **Impact:** Paid customer with no access to their documents.
- **Repro:** Force set-password / profile-upsert to fail on success page after guest checkout.
- **Fix:** Make linking idempotent + retryable. Clear "finish account setup" recovery path. Ensure order recoverable by verified email.
- **Resolution:** (1) `set-password` is idempotent — it looks up the profile by email and, if found, only updates the password (`updateUserById`) rather than re-creating; re-runs are safe. (2) Retryable — 4× profile lookup (2s apart) waits for the Stripe webhook to create the profile before falling back to `createUser` + profile upsert. (3) Order↔client linkage is owned by the webhook keyed on verified `customer_email` + `metadata.client_id` (set-password no longer scans/claims orders — see BUG-6), so the paid order is always recoverable by the verified email. (4) `PasswordSetup.tsx` validates the live session via `getUser()` (auth-server check, not just the cookie); a wiped/deleted user purges the stale session and falls back to the set-password API, fixing the "cookie exists but account gone" lockout. (5) BUG-11 token-burn closed: `set-password` now `peekVerifiedToken()`s at the gate and only `consumeVerifiedToken()`s at a successful return, so a transient `createUser` failure leaves the verified token usable for an immediate retry instead of forcing email re-verification.

---

## BUG-12 — Cross-customer farewell video leak
- **Severity:** High (confidentiality)
- **Area:** `app/api/vault/farewell/[id]/signed-url/route.ts:30-44`
- **What:** The route authenticates any logged-in client, then if the caller is not the owner it only checks `message.vault_farewell_status === "unlocked"` — it never verifies the caller is a trustee of (or has any relationship to) the message's owner. It then mints a 7-day signed download URL and logs the access as `farewell.trustee_viewed`. Real trustees use a separate, properly authenticated surface (`/api/trustee/vault/*`), so this non-owner branch grants no legitimate capability.
- **Impact:** Any client account can download another client's private farewell video (the most personal vault item) for 7 days, with no permission and no PIN.
- **Repro:** Account B's farewell video reaches `unlocked` (a trustee verifies). Log in as unrelated Account A. `GET /api/vault/farewell/<B's message id>/signed-url` → 200 with a working link to B's video. Expected 403.
- **Check on website:** Use two test accounts as above; in the browser hit the signed-url endpoint for the other account's message id and confirm you get a downloadable link.
- **Fix:** Remove the non-owner branch — require `message.client_id === client.id`, else 404/403. Trustees use their own route.

---

## BUG-13 — Document-generation queue failure is swallowed (paid, no documents, no alert)
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:294-322`
- **What:** Queueing the generation job is wrapped in a try/catch that only `console.error`s. If `addJob` throws (Redis/Upstash down or unconfigured), the webhook still returns `200 ok`. By then document records exist as `pending` and the partner/affiliate have already been paid out (earlier in the same handler). No retry, no admin alert, no reconciliation.
- **Impact:** Customer charged, partner paid, documents never generated, order frozen in `generating` — and nothing surfaces it. Highest-trust failure (same family as BUG-1/BUG-10).
- **Repro:** Unset `UPSTASH_REDIS_*`, complete a paid checkout → webhook 200s, order stuck, queue empty.
- **Check on website:** In staging, break the queue (unset Redis env vars), pay a checkout → success page appears, but no documents ever show in the dashboard and no error is displayed.
- **Fix:** On queue failure, mark order/documents `failed` (not `pending`), emit an alert, don't return success. Add a reconciliation job that finds paid-but-unfulfilled orders and retries.

---

## BUG-14 — Vault double-billing: re-subscribe only blocked while status is "active"
- **Severity:** High
- **Area:** `app/api/checkout/vault-subscription/route.ts:95-96,126-128`
- **What:** The "Already subscribed" guard fires only when `status === "active"`. A customer whose status is `"cancelled"` (cancel_at_period_end — Stripe sub still live) or `"past_due"` passes the guard and creates a SECOND Stripe subscription. No check against an existing live `vault_subscription_stripe_id`.
- **Impact:** Two concurrent annual subscriptions → double-charged $99/yr; the second sub id overwrites the first, orphaning it for cancellation.
- **Repro:** Subscribe → cancel → start vault checkout again → no block → second subscription created.
- **Check on website:** Subscribe, cancel, immediately start subscribe again from the vault page — it lets you pay again. In **Stripe → Customers → that customer → Subscriptions** you see two active annual subs.
- **Fix:** Block when the client has any live `vault_subscription_stripe_id` (or status active/cancelled/past_due with unexpired period); reactivate the existing sub instead of creating a new one.

---

## BUG-15 — Partner payout silently lost when Connect account exists but isn't payable
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:154-213` (connected branch + outer catch :210); `lib/stripe-payouts.ts:27`
- **What:** When a partner has a `stripe_account_id` but the Connect account's `transfers` capability isn't active (onboarding incomplete/under review/restricted), `transferToPartner` throws. Control jumps to the outer `catch` which only `console.error`s. Because the code took the connected branch, it never reaches the `else` that writes `ev_cut/partner_cut` and inserts a `pending` payout row → no transfer, no payout record, cuts left at defaults. (Distinct from BUG-13, which is the doc-gen queue.)
- **Impact:** Partner owed money, but no `sent` or `pending` payout row exists to reconcile against. Money silently unpaid; only a log line. Connect status is never checked before transferring.
- **Repro:** Partner with `stripe_account_id` whose onboarding is incomplete (`details_submitted:false`); a client buys through them; webhook 200s; `payouts` table has no row for the order.
- **Check on website:** Connect a partner but stop Stripe onboarding before "transfers" is enabled. Buy a Will through that partner's link → no payout appears in the revenue dashboard / `payouts` table; Stripe logs show the transfer error.
- **Fix:** Check the account is payable (reuse `getAccountStatus`) before transferring; if not, write a `pending` payout row instead of attempting and dropping. In the catch, always record a `pending` payout for the owed amount.

---

## BUG-16 — `/api/checkout/attorney/verify` is unauthenticated and non-idempotent → partner account overwrite on replay
- **Severity:** High (auth / integrity)
- **Area:** `app/api/checkout/attorney/verify/route.ts:14-134`
- **What:** Takes a `session_id`, verifies the Stripe session is paid, then creates an auth user + profile + partner record. Unauthenticated, with no idempotency/replay guard — it doesn't record that a `session_id` was processed. The partner `upsert` runs every call. The `session_id` is exposed in the success URL (`...?session_id={CHECKOUT_SESSION_ID}`), so anyone who sees it can POST repeatedly; a legitimate double-submit re-runs creation.
- **Impact:** Replay re-upserts the partner, resetting `custom_review_fee`/`tier`/`status` to signup values (undoing later admin changes), and writes a body-supplied `password` via `createUser`. Unauthenticated, replayable account-mutation keyed on a guessable/observable id.
- **Repro:** Complete an attorney paid signup, capture `session_id` from the welcome URL, POST it again with a chosen password → partner record re-written; tier/fee reset.
- **Check on website:** After an attorney signup completes, reload the welcome page (or resend the verify POST in DevTools) → the partner record is re-created/overwritten each time; no "already processed" guard.
- **Fix:** Make idempotent — record processed `session_id`s (or return success without mutating if the partner already exists for that session). Don't let the request body set a password on an existing account.

---

## BUG-17 — Vault PIN can be reset without knowing the current PIN
- **Severity:** High
- **Area:** `app/api/vault/pin/route.ts:38-44` (`action: "create"`)
- **What:** The `create` action hashes and writes `vault_pin_hash` unconditionally — it never checks whether a PIN already exists. `change` correctly requires the old PIN (`bcrypt.compare` at :60); `create` does not. Any authenticated client session can POST `{action:"create", pin:"000000"}` and silently overwrite the existing PIN.
- **Impact:** The PIN is a second factor over the session. An attacker with only the session (stolen/borrowed cookie, shared device, XSS-exfiltrated token) bypasses the PIN gate by re-creating it, then verifies with their own value.
- **Repro:** With a session that already has a PIN, `POST /api/vault/pin {action:"create", pin:"123456"}` → 200; old PIN no longer works.
- **Check on website:** Set a vault PIN. In DevTools → Network resend the PIN-create request with a different 6-digit value (not the change flow). Re-open the vault — the new PIN works, you were never asked for the original.
- **Fix:** In `create`, read `vault_pin_hash` first; if one exists, reject (409) and force `change` (which requires the current PIN).

---

## BUG-18 — `create-review-attorney` overwrites any existing user's profile (account hijack)
- **Severity:** High
- **Area:** `app/api/partners/create-review-attorney/route.ts:27-46`
- **What:** Route only verifies the caller owns `partnerId`. It then looks up the target by email and, if a profile exists, blindly UPDATEs it: `user_type: "review_attorney"`, `managed_by_admin: <this partner>`, overwriting `full_name`/`bar_number`. No check that the target email is unclaimed, belongs to the partner, or isn't another role.
- **Impact:** A logged-in partner can convert an arbitrary existing account (another partner, a client, staff) into a "review_attorney" managed by them, clobbering their profile. Role tampering + profile corruption.
- **Repro:** As partner P, `POST /api/partners/create-review-attorney {partnerId:P, attorneyEmail:"<existing user>", attorneyName:"Hijack", barNumber:"000"}` → victim's row flips to review_attorney managed by P.
- **Check on website:** As an attorney partner, in the "add in-house review attorney" form enter any other existing account's email → confirm in `profiles` that the target's `user_type` flips and `managed_by_admin` is set to you.
- **Fix:** Only attach an existing profile when unclaimed or already a review attorney managed by this partner; never overwrite `user_type`/`managed_by_admin`/`full_name` on a profile the partner doesn't own.

---

## BUG-19 — Cross-rep leak: any sales rep can read any partner's private notes (IDOR)
- **Severity:** High
- **Area:** `app/api/sales/partner-notes/route.ts:7-16` (GET)
- **What:** GET takes `?partnerId=` and returns all `sales_partner_notes` for that partner with NO ownership scoping. The sibling `partners/[partnerId]` route correctly enforces `partner.created_by === auth.user.id` for non-admins; the notes endpoint does not.
- **Impact:** A sales_rep can pass any partner id (guessable UUID) and read another rep's confidential deal notes — pricing posture, objections, internal warnings.
- **Repro:** As rep A, `GET /api/sales/partner-notes?partnerId=<partner B created>` → 200 with B's notes.
- **Check on website:** As a sales rep, on `/sales/partners` grab any partner id you don't own, then `fetch('/api/sales/partner-notes?partnerId=<other-id>')` → other rep's notes returned.
- **Fix:** Scope the GET like `partners/[partnerId]`: for non-admin, verify `partner.created_by === auth.user.id` before returning; else 404/empty.

---

## BUG-20 — Equal-shares math emits percentages that don't sum to 100% into the legal document
- **Severity:** High
- **Area:** `lib/documents/templates/michigan-will.ts:119`; `lib/documents/templates/michigan-revocable-trust.ts:121`
- **What:** For equal shares among >1 beneficiaries the prompt builds `Equal shares (${(100/n).toFixed(n===3?2:0)}% each)`. Only n=3 is special-cased. For other counts `100/n` rounds to 0 decimals: 6 → "17% each" (=102%), 7 → "14%" (=98%), 8 → "13%" (=104%); even n=3 "33.33%" sums to 99.99%. This wrong percentage is injected verbatim into the Claude drafting prompt.
- **Impact:** Generated will/trust can over- or under-distribute the estate — legally incoherent residuary shares in a paid ($400/$600) document. Same class as BUG-29, distinct defect (share math).
- **Repro:** Will/Trust intake with 6 beneficiaries, equal shares → prompt contains "Equal shares (17% each)".
- **Check on website:** Start a Will at `/will`, add 6 beneficiaries, choose "split equally" → generated will divides the residue in shares totaling 102%. Try 7 → 98%.
- **Fix:** Don't emit a per-head percentage — say "in equal shares" and let the residuary clause divide equally; or compute exact fractions summing to 100%.

---

## BUG-21 — Attorney `notify-client` has no per-review ownership check (IDOR + client-spam)
- **Severity:** High
- **Area:** `app/api/attorney/notify-client/route.ts:10-34`
- **What:** Gates on role `["review_attorney","admin"]` but, unlike `review/route.ts:19` and `approve/route.ts:32` (which enforce `review.attorney_id !== auth.user.id → 403`), performs NO check that the caller is the assigned attorney for `reviewId`. It loads the review, pulls the client email, and sends `sendApprovalEmail` ("documents approved / ready").
- **Impact:** Any review_attorney can pass an arbitrary `reviewId` (another attorney's case) and trigger a real "documents approved & ready" email to that client — false approval signal before review is done — and enumerate/abuse across all reviews. No rate limit.
- **Repro:** As review_attorney A, `POST /api/attorney/notify-client {reviewId:"<B's review>"}` → 200, approval email sent to B's client. Expected 403.
- **Check on website:** Log in as one review attorney; in DevTools resend notify-client with a `reviewId` from a case you're not assigned → the other client gets an "approved/ready" email.
- **Fix:** Mirror `approve`/`review`: for non-admins require `review.attorney_id === auth.user.id` before sending; add a rate limit.

---

## BUG-22 — Unescaped HTML email injection in professionals/request-access (unauth, stored)
- **Severity:** High
- **Area:** `app/api/professionals/request-access/route.ts:70-83, :110`; schema `lib/validation/schemas.ts:412-424`
- **What:** `firstName`, `lastName`, `email`, `phone`, `companyName`, `professionalType`, `clientCount`, `referralSource` are interpolated RAW into two `resend.emails.send` HTML bodies with no escaping. The sibling `contact` route HTML-escapes its fields; this one doesn't. Schema has no length caps; endpoint is unauthenticated/public. Values are also stored unsanitized in `professional_leads` and re-rendered.
- **Impact:** Anyone can POST a lead with `companyName:"<img src=x onerror=...>"` that renders in the sales team's inbox — HTML-injection/phishing against staff; stored content re-renders wherever leads are displayed. Unbounded fields enable oversized-payload spam.
- **Repro:** `POST /api/professionals/request-access` with `companyName:"<img src=x onerror=alert(1)>"` → 200; both emails send unescaped.
- **Check on website:** On `/professionals` submit the partner-access form with `<b>BOLD</b>` in company-name → the sales notification email renders it bold (not literal), confirming no escaping.
- **Fix:** Apply the `escape()` helper from `contact/route.ts` to every interpolated field; add `.max(...)` bounds to all string fields in `professionalRequestAccessSchema`.

---

## BUG-23 — Webhook side effects (payouts, affiliate counter, docs, attorney review) aren't individually idempotent — ✅ FIXED
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:178-184, :246-255, :287, :290-291`
- **What:** The Stripe transfers carry idempotency keys, but the DB records of them — `payouts` rows, the affiliate stats counter (`increment_affiliate_stats`, a blind `+=`), `documents` rows, and the attorney_review row — have no unique constraint or status guard. The only thing preventing duplication is the single router-level event-id guard (BUG-8).
- **Impact:** Defense-in-depth gap. Any re-entry (a future reprocess endpoint, two near-simultaneous deliveries before the marker commits, or the BUG-8 fix that re-runs after partial failure) double-counts affiliate lifetime earnings and inserts duplicate payout/document/review rows. The monotonic affiliate counter is the highest risk (un-reversible).
- **Repro:** Invoke `handleDocumentCheckout` twice for one session (bypassing the router guard) → transfers collapse via idempotency key, but `payouts` gets two "sent" rows and `affiliates.total_earned` increments twice.
- **Check on website:** Not reproducible from UI today (router guard holds); confirm in staging by calling the handler twice / replaying concurrent deliveries.
- **Fix:** Make each side effect idempotent independently: unique constraint on `payouts(stripe_transfer_id)` and `documents(order_id, document_type)`; guard the affiliate increment against re-application (or derive totals from payout rows); make the attorney-review insert an upsert keyed on `order_id`.
- **Resolution:** DB-level backstop added in `supabase/migrations/20260610_000_bug23_payout_idempotency.sql` (dedup-then-create unique indexes): `documents(order_id, document_type)`, `attorney_reviews(order_id)`, partial `payouts(stripe_transfer_id)` and `affiliate_payouts(stripe_transfer_id)`, and a new webhook-only `affiliate_payouts.order_id` column with a partial unique index (the manual batch-payout route writes a multi-order `orders_included` array, leaves `order_id` null, and is untouched). The irreversible affiliate counter is now gated on a winning insert — `insertAffiliatePayout` returns the row (or null on unique conflict) and `handleDocumentCheckout` only calls `incrementStats` + writes the conversion audit when a row comes back, so a concurrent replay that loses the insert race cannot double-count. Attorney-review fee transfer now carries an `idempotencyKey` (`attyfee_<orderId>`). Together these make every side effect at-most-once regardless of concurrency, closing the check-then-act race the BUG-1/BUG-8 retries opened.

---

## BUG-24 — Document-records insert failure is ignored; generation still queues (paid, no documents)
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:287`; `lib/repos/server/documentRepo.ts:11`
- **What:** `documentRepo.insertMany(...)` returns `{data, error}` but the result is never checked. If the bulk insert fails, the handler still queues the gen job and returns 200; the event is marked processed (no retry).
- **Impact:** Order `generating`, partner already paid, but no `documents` rows exist — the worker has nothing to update; dashboard shows no documents, nothing surfaces it. Distinct from BUG-13 (queue throw) and BUG-10 (Claude failure) — this is the DB insert of the records themselves.
- **Repro:** Force the `documents` insert to fail during a paid checkout webhook → 200, order `generating`, zero document rows.
- **Check on website:** In staging induce a `documents` insert failure (e.g. break the FK), pay a checkout → success page + partner payout, but the dashboard never shows documents and no error is raised.
- **Fix:** Capture `{error}` from `insertMany`; on error mark the order `failed`, alert, and don't queue. Reconcile orders `generating` with zero document rows.

---

## BUG-25 — Attorney-review fee transfer failure silently lost; no payout/fee record
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleAttorneyReview.ts:57-84`
- **What:** When the fee destination is `partner_admin` with a `stripe_account_id`, it calls `stripe.transfers.create` directly; on failure it only `console.error`s. Unlike the doc/vault payout paths there's no `payouts` fallback row for the owed fee, and the Connect account's transfer capability is never checked. BUG-15 covers only the document partner cut, not this attorney-fee transfer.
- **Impact:** Client charged $300 for review; the fee owed to the in-house/partner-admin reviewer is never transferred and leaves no trace but a log line. No reconciliation can recover it.
- **Repro:** Attorney partner with an incomplete Connect account; client buys will/trust + attorney review → 200, attorney_review row created, no fee transfer, no payout row.
- **Check on website:** Connect an attorney partner but stop onboarding before "transfers" is enabled; buy a Will with Attorney Review through them → Stripe logs show the transfer error, no fee record exists in the app.
- **Fix:** Check payability (reuse `getAccountStatus`) before transferring; on failure/unpayable write a `pending` payout/fee record, mirroring `handleVaultSubscriptionCheckout`.

---

## BUG-26 — `Failed to create client record` (FK on `clients.profile_id`)
- **Severity:** Medium — *largely fixed, verify*
- **Area:** `lib/checkout/createCheckoutSession.ts`, `app/dashboard/layout.tsx`
- **What:** Logged-in session references a `userId` with no `profiles` row (wiped account, partial signup) → `clients_profile_id_fkey` violation.
- **Fixes applied:** Checkout self-heals (recreate profile if auth user exists; guest fallback if fully wiped). Dashboard layout signs out + redirects orphaned sessions to login.
- **Remaining:** Add regression test for orphaned-session path; verify across will/trust/vault.
- **Repro:** Wipe a test user's `profiles` row, keep browser session, attempt checkout.

---

## BUG-27 — Checkout trusts client-supplied `userId` (auth weakness)
- **Severity:** Medium (security hardening)
- **Area:** `lib/validation/schemas.ts:121`, checkout route
- **What:** `userId` comes from request body (`z.string().nullable().optional()`), not the verified server session. A caller could POST an arbitrary `userId`.
- **Impact:** Order could attach to an account the caller doesn't own. No data leak today; latent integrity hole.
- **Fix:** Ignore `body.userId`; derive real user server-side via `requireAuth()` / `supabase.auth.getUser()`, pass only that into `createCheckoutSession`.

---

## BUG-28 — Intake answers are effectively unvalidated at the server boundary
- **Severity:** Medium
- **Area:** `lib/validation/schemas.ts:100-117` (`intakeAnswersSchema` is `.passthrough()`); consumed in `lib/documents/templates/michigan-will.ts`
- **What:** Only `email/firstName/lastName` are typed; every field that actually drives the document (beneficiaries array, shares, executor, guardian, free-text descriptions) is unconstrained — no required fields, no length caps, no numeric bounds, no array-size limits. The "shares must total 100%" rule is enforced only in the browser UI. The blob is stored as JSON and interpolated into the Claude prompt.
- **Impact:** A direct API call can submit empty/garbage intake (no beneficiaries, shares summing to 30%, a 1MB description, prompt-injection text) and an order + document are still created from it.
- **Repro:** POST `/api/checkout/will` with `intakeAnswers: { firstName: "A" }` → order created, generation queued.
- **Check on website:** In DevTools → Network, resend a checkout POST with an empty/garbage `intakeAnswers` → order + document still created.
- **Fix:** Tighten `intakeAnswersSchema` to require and bound the consumed fields (executor, ≥1 beneficiary, relationship enums, numeric `share` 0–100 with a server-side 100% sum check, max lengths on free text); re-validate before queueing.

---

## BUG-29 — Trust accepts a distribution age under 18
- **Severity:** Medium
- **Area:** `app/trust/page.tsx:471-479`
- **What:** The custom distribution-age input clamps anything over 99 but accepts any low value (0–17). `isCardComplete` only checks the field is truthy. The value flows into `michigan-revocable-trust.ts`.
- **Impact:** Generated trust can say "hold assets until age 5" — legally incoherent (a person is an adult at 18 in Michigan). Customer pays for a flawed document.
- **Repro:** Minor children = Yes → distribution age → Other → type `5` → continue. Accepted.
- **Check on website:** `/trust` → answer you have minor children → distribution age → **Other** → type `5` (or `0`) → it's accepted.
- **Fix:** Enforce a minimum (≥18) in the custom-age handler and in `isCardComplete`.

---

## BUG-30 — TEST promo generates real documents for $0 with weak guards
- **Severity:** Medium
- **Area:** `lib/checkout/createCheckoutSession.ts:298-400` (`handleTestPromo`)
- **What:** The `TEST` code path creates an order with `status: "generating"` and inserts document records — full real-document generation for $0 — gated only by an app-settings `active` flag and a global 50/hr rate limit. The origin allowlist is bypassable when `Origin`/`Referer`/`Host` are all absent (`origin === ""` passes).
- **Impact:** If `test_promo_code.active` is ever left on in production, anyone can mint free real documents (up to 50/hr globally), and the estatevault-only restriction is not enforced for header-less callers.
- **Repro:** With the test promo active, enter `TEST` on `/will/checkout` or `/trust/checkout` → real documents created at $0.
- **Check on website:** Only reproducible if `test_promo_code` is on — enter `TEST` at checkout and confirm documents generate with no payment. Verify the flag is forced **off** in production.
- **Fix:** Treat empty/unknown origin as untrusted; scope the rate limit per IP/email; ensure prod has the flag off; emit watermarked (not real) output for test orders.

---

## BUG-31 — Partner "trust" earnings advertised as $500, actual payout is $450
- **Severity:** Medium (price drift vs SSOT)
- **Area:** `app/khan-lawgroup/page.tsx:22, :157`; `app/partners/attorneys/page.tsx:22, :152`; `app/partners/attorneys/CLAUDE.md:13`
- **What:** The Professional (= enterprise) partner tier is advertised as `$500/trust` on the partner-recruitment pages — both the static feature lists and the live earnings calculator (`calcTier === 'standard' ? 400 : 500`). The source of truth `lib/orders/pricing.ts:43` sets the enterprise trust partner cut to `45000` cents = **$450** (root `CLAUDE.md` agrees: "Enterprise partner: $350/will, $450/trust"). The will figures ($300 standard / $350 professional) are correct; only the professional trust figure drifts. The webhook pays the correct $450 from `PARTNER_SPLITS`, so the marketing overstates earnings by $50/trust.
- **Impact:** Partners are promised $500/trust but paid $450 — partner trust / dispute / chargeback-of-goodwill risk. Not a direct money loss to the platform.
- **Repro:** N/A (static + calculator copy).
- **Check on website:** Open `/khan-lawgroup` or `/partners/attorneys` → toggle the earnings calculator to **Professional** → the "per trust" figure shows **$500**; the Professional feature bullet reads **"$500/trust + your review fee"**. Compare to `lib/orders/pricing.ts:43` (enterprise trust partner = 45000 = $450).
- **Fix:** Change the four `500` occurrences (2 calculator lines, 2 feature strings) to `450`, and the doc line. Ideally derive from `PARTNER_SPLITS.trust.enterprise.partner` so it can't drift again.

---

## BUG-32 — Lapsed/expired vault subscription keeps full access (expiry never enforced)
- **Severity:** Medium
- **Area:** `lib/repos/server/clientRepo.ts:146` (activate sets active + expiry); all gates check only `status === "active"`; no cron downgrades expired vault subs; `vault_subscription_expiry` read only in `subscription/status` (returned, not enforced)
- **What:** `vault_subscription_expiry` is written but never compared to "now" by any access gate. If a renewal webhook is missed or a sub lapses without a `subscription.deleted`/`payment_failed` event reaching the handler, status stays `"active"` with a past expiry and the customer keeps full vault access without paying.
- **Impact:** Free vault access after a subscription ends; lost recurring revenue; no reconciliation job catches it.
- **Repro:** Set a client's `vault_subscription_expiry` to a past date, leave status `"active"` → vault upload/farewell/download still succeed.
- **Check on website:** Requires DB state — in staging simulate a missed renewal (past expiry, status still active); access persists.
- **Fix:** Gate on `status === "active" AND expiry > now`; add a reconciliation cron that downgrades expired subs and re-checks Stripe.

---

## BUG-33 — Attorney `review_fee` checkout input is unbounded (validation-boundary defect; feeds BUG-4)
- **Status:** ✅ FIXED (2026-06-09)
- **Severity:** Medium
- **Area:** `lib/validation/schemas.ts:163` (`review_fee: z.coerce.number().nonnegative().optional()`); `app/api/checkout/attorney/route.ts:84,157`; `app/api/checkout/attorney/verify/route.ts:121`
- **What:** The attorney signup `review_fee` has no upper bound and no `ATTORNEY_REVIEW_FEE_RANGE` check. It's multiplied by 100, stored as `custom_review_fee`, and echoed into Stripe session metadata. This is the input vector feeding BUG-4 and a validation defect in its own right.
- **Impact:** Garbage/excessive fees persisted on partner records and metadata; surfaced in sales dashboards and (via BUG-4) in real payouts.
- **Repro:** POST `/api/checkout/attorney` with `review_fee: 9999999` → accepted; partner `custom_review_fee` = 999999900 cents.
- **Check on website:** In the attorney signup form (or DevTools) submit an absurd review fee → accepted with no validation error.
- **Fix:** Replace `nonnegative().optional()` with a bound tied to `ATTORNEY_REVIEW_FEE_RANGE` ($150–$1,500), validated at every write site.
- **Resolution:** Input vector removed entirely — `review_fee` deleted from the attorney signup schema and no longer read in `attorney/route.ts` or `verify/route.ts` (new partners seed the platform default). The only remaining write path is admin-set and clamped to `ATTORNEY_REVIEW_FEE_RANGE` via `adminPartnerFeeSchema`. See BUG-4 resolution.

---

## BUG-34 — Subscription renewal webhook reactivates by status only, ignoring cancel intent
- **Severity:** Medium
- **Area:** `app/api/webhooks/stripe/route.ts:52-70`; `lib/repos/server/clientRepo.ts:140-148` (`activateVaultByStripeId`)
- **What:** On `invoice.payment_succeeded` with `billing_reason === "subscription_cycle"`, the handler unconditionally sets status back to `"active"` and pushes expiry +1 year, matched only on subscription id, with no cross-check against `cancel_at_period_end`. A stray/retried/out-of-order cycle invoice can flip a cancelled record back to active. `subscription/sync` early-returns on `status === "active"`, so it won't correct a wrongly-active record.
- **Impact:** Status drift between Stripe and the DB; a cancelled customer shown as active (or vice-versa).
- **Repro:** Replay a `subscription_cycle` invoice event for a sub whose client row is `cancelled` → row re-activates.
- **Check on website:** N/A (webhook ordering) — reproduce in staging with the Stripe CLI replaying events.
- **Fix:** On renewal confirm the Stripe subscription is genuinely active (not `cancel_at_period_end` past end) before reactivating; set expiry from the invoice's actual period end, not blindly +1 year.

---

## BUG-35 — No lockout / rate limit on PIN verify (brute-forceable)
- **Severity:** Medium
- **Area:** `app/api/vault/pin/route.ts:46-54` (`action: "verify"`) — route imports no rate limiter
- **What:** Unlike every other sensitive vault route (`upload-url`, `download-url`, `file-key`, crypto, trustee OTP all use limiters), PIN verify has zero rate limiting or attempt counter. A 6-digit PIN is a 1,000,000-space; no lockout/backoff exists.
- **Impact:** An attacker holding a valid session (the PIN's whole threat model) can brute-force the PIN by hammering `verify`.
- **Repro:** Loop `POST /api/vault/pin {action:"verify", pin:NNNNNN}` — no 429, no lockout.
- **Check on website:** From a logged-in session, submit wrong PINs repeatedly via the network panel — never locked out or throttled.
- **Fix:** Add a per-user limiter + persistent failed-attempt counter with lockout, mirroring the trustee OTP `MAX_OTP_ATTEMPTS` pattern.

---

## BUG-36 — Client-controlled `storage_path` never scoped to caller (farewell write paths)
- **Severity:** Medium
- **Area:** `app/api/vault/farewell/upload-complete/route.ts:21-35`; `app/api/vault/farewell/route.ts:110,210`; schemas `lib/validation/schemas.ts:63,74,433` (all accept `storagePath` as free `z.string()`)
- **What:** Owners can set their own farewell message's `storage_path` to an arbitrary string with no `vault/<client.id>/` prefix check (unlike `download-url`, which enforces it at :27-30). The read path `farewell/[id]/signed-url/route.ts:28,42-44` then signs `message.storage_path` for the owner for 7 days.
- **Impact:** Cross-tenant read primitive in the `farewell-videos` bucket: point your own message at `vault/<victimId>/<uuid>.bin`, then GET your own signed-url → 7-day link to the victim's video. Gated by guessing the victim's random upload UUID, but the missing prefix scoping is the same class as BUG-12 in the owner branch.
- **Repro:** `PATCH /api/vault/farewell {messageId:<mine>, storagePath:"vault/<victim>/<uuid>.bin"}` then `GET /api/vault/farewell/<mine>/signed-url`.
- **Check on website:** Create a farewell message, then in DevTools resend the PATCH/upload-complete with a `storagePath` outside your own `vault/<your id>/` folder — accepted.
- **Fix:** Require client-supplied `storagePath` to start with `vault/${client.id}/` at create, PATCH, and upload-complete (reuse the `download-url` check).

---

## BUG-37 — Vault subscription not required for farewell upload-complete and `[id]/signed-url`
- **Severity:** Medium
- **Area:** `app/api/vault/farewell/upload-complete/route.ts`, `app/api/vault/farewell/[id]/signed-url/route.ts` (no `vault_subscription_status` check)
- **What:** `farewell` POST (create) and `upload-url` gate on `status === "active"`, but `upload-complete` and the per-id `signed-url` do not. A lapsed/never-subscribed client with an existing message row can still attach storage and mint a 7-day view URL.
- **Impact:** Inconsistent paywall; non-subscriber completes uploads and views stored videos. Distinct gate gap from BUG-5/22.
- **Repro:** With `status != "active"` but an existing message id, call `upload-complete` and `[id]/signed-url` → both succeed.
- **Check on website:** Let a vault subscription lapse, then attach/view an existing farewell video — still works.
- **Fix:** Add the same subscription gate to both routes (with BUG-5/22's "gate on expiry too" fix in mind).

---

## BUG-38 — `verify-code` OTP brute-force: no route rate-limit + resend resets attempt counter
- **Severity:** Medium (account-takeover chain)
- **Area:** `app/api/auth/verify-code/route.ts:9-31`; `lib/auth/emailVerification.ts:89-114` (`MAX_ATTEMPTS=5`, `storeCode` resets `attempts:0`); `app/api/auth/send-verify-code/route.ts:51` (5/min/email)
- **What:** verify-code has no rate limiter of its own; only the per-code `attempts >= 5` lockout. Each `send-verify-code` stores a fresh code with `attempts:0`, and send is allowed 5×/min/email → ~25 guesses/min (1,500/hr) against a 6-digit code. The trustee OTP path already fixed this exact class with `trusteeOtpResendRateLimit` (3/hr, comment cites H-4); email-verification has no equivalent.
- **Impact:** Sustained OTP guessing is feasible far faster than intended; a verified token gates set-password/signup, so a guessed code → account creation / password set (chains with BUG-40).
- **Repro:** Script `send-verify-code` then 5× `verify-code` guesses per cycle; no IP/global throttle.
- **Check on website:** In DevTools repeatedly POST `/api/auth/verify-code` with wrong codes, re-calling `send-verify-code` every 5 failures — guessing continues indefinitely.
- **Fix:** Per-email + per-IP rate limit on `verify-code`; cap fresh-code resends (mirror `trusteeOtpResendRateLimit`).

---

## BUG-39 — `check-email` is an unauthenticated account/asset enumeration oracle
- **Severity:** Medium
- **Area:** `app/api/auth/check-email/route.ts:9-54`; public per `lib/supabase/middleware.ts:162`
- **What:** Returns `{exists:false}` for unknown emails and, for known ones, `exists:true` + `fullName`, `hasWill`, `hasTrust`, `hasVault`. Unauthenticated, public, no rate limit. `recovery`/`resend-verification` were deliberately written NOT to leak existence; check-email contradicts that.
- **Impact:** Anyone can enumerate which emails have accounts and learn the holder's full name and which estate products they own — sensitive PII, useful for targeted phishing.
- **Repro:** POST `/api/auth/check-email {email:"victim@x.com"}` → `{exists:true, fullName:"Jane Doe", hasWill:true,...}`.
- **Check on website:** On the signup/login email step, watch the `/api/auth/check-email` call; submit a known customer email → full name + product flags returned.
- **Fix:** Require a verified session/step-up before returning name/product flags; rate-limit per IP; keep response shape uniform for exists/not-exists.

---

## BUG-40 — set-password silently resets an existing account's password with no notification
- **Severity:** Medium
- **Area:** `app/api/auth/set-password/route.ts:99-117`
- **What:** For an existing account, set-password resets the password using only an email-verification token — no current password, no notification email. The email-ownership check at :101 prevents cross-account use, but it turns any email-code verification into a silent full credential reset.
- **Impact:** A guessed verification code (BUG-38) silently rewrites the victim's password with no out-of-band alert. Removes the "you'll be emailed if your password changes" safety net.
- **Repro:** With a valid verified token for an existing account's email, POST set-password with a new password → changed, no notification.
- **Check on website:** Use verify-email + set-password for an email that already has an account → password changes, no "password changed" email arrives.
- **Fix:** Send a "your password was changed" notification on every reset; route existing-account changes through the `recovery` link flow.

---

## BUG-41 — `partners/branding` GET: PostgREST `.or()` filter injection via `domain`
- **Severity:** Medium
- **Area:** `app/api/partners/branding/route.ts:9,19`
- **What:** `domain` from the query string (`.toLowerCase().trim()` only) is interpolated raw into `query.or(\`subdomain.eq.${domain},custom_domain.eq.${domain}\`)`. Commas/parens/dots aren't stripped, so the caller controls PostgREST filter syntax. The same class is already sanitized in `lib/supabase/middleware.ts` (tested S-08) but not applied here; endpoint is unauthenticated.
- **Impact:** A crafted `domain` injects extra OR conditions against the `partners` table. Read-only, limited to branding columns, but a real filter-injection on a public endpoint.
- **Repro:** `GET /api/partners/branding?domain=x,id.eq.<uuid>` → injected predicate becomes part of the `.or()`.
- **Check on website:** Hit `/api/partners/branding?domain=` with comma/parenthesis payloads → response selects by the injected predicate.
- **Fix:** Sanitize `domain` with the middleware allowlist (`replace(/[^a-zA-Z0-9.\-]/g, "")`) or split into two `.eq` queries.

---

## BUG-42 — `add-domain` ignores the DB write result → false success on a failed claim
- **Severity:** Medium
- **Area:** `app/api/partner/add-domain/route.ts:71-72` (also DELETE :97-99)
- **What:** After registering the domain with Vercel, the route calls `partnerRepo.update(...)` but never inspects its error. `subdomain`/`custom_domain` have unique partial indexes, so if the domain is already owned by another partner the UPDATE fails — yet the route returns `{success:true}` and writes a `partner.domain_registered` audit entry. Vercel registration treats already-registered as success and runs before the DB write with no ownership proof.
- **Impact:** Partner told their domain is configured when the DB never recorded it (e.g. collision). Silent misconfiguration + misleading audit trail; Vercel registration for arbitrary attacker-supplied domains.
- **Repro:** Partner B owns `foo.com`. As partner A, `POST /api/partner/add-domain {businessUrl:"foo.com", domainType:"custom_domain"}` → Vercel ok, DB UPDATE violates unique index, route still returns success.
- **Check on website:** Two enterprise partners; A submits a custom domain B already saved → A's UI shows success but `partners.custom_domain` for A is unchanged.
- **Fix:** Check the `update` error and `fail()` on it; pre-check the domain isn't owned by another partner (mirror `isSubdomainTaken`); register with Vercel only after the DB claim succeeds.

---

## BUG-43 — Partner can enroll arbitrary existing accounts as their clients
- **Severity:** Medium
- **Area:** `app/api/partner/clients/route.ts:49-84`
- **What:** POST resolves the target purely by `email`. If a profile exists, it reuses it and inserts a `clients` row linking that profile to the partner — no consent, no check on the existing profile's `user_type`. Only `partnerId` ownership is verified.
- **Impact:** A partner can attach any existing user (other partners/clients/staff, by email) as their "client," creating spurious `clients` rows + audit entries. (The detail route enforces `client.partner_id === partner.id`, so it only exposes what was just attached — but the attach shouldn't be possible.)
- **Repro:** As partner P, `POST /api/partner/clients {email:"<existing user>", partnerId:P, action:"invite"}` → clients row links that user to P.
- **Check on website:** In Pro → Clients, "add" a client using an existing account's email you don't own → a clients row appears under your partner.
- **Fix:** Only auto-link an existing profile when unclaimed or already this partner's client; otherwise require an explicit invite/accept handshake.

---

## BUG-44 — Sales-rep commission default rate inconsistent (5% display vs 50% calc)
- **Severity:** Medium
- **Area:** `app/api/sales/my-platform-commission/route.ts:41` and `commission/route.ts:37` (default `0.5`) vs `reps/route.ts:26` (default `0.05`)
- **What:** Three routes disagree on the default when `commission_rate` is null: commission summaries default to 50%, the reps-management list to 5%. A rep with a null rate is shown 5% in admin but has 50% applied to owed-commission math.
- **Impact:** Commission owed can be 10× what the admin sees — overstated liability and disputes.
- **Repro:** Set a rep's `commission_rate` to null → `my-platform-commission` computes at 0.5; `reps` shows 0.05.
- **Check on website:** With a rep that has no commission_rate, compare the rep's "My Commission" figure to the rate in the admin Sales Rep list — they imply different rates.
- **Fix:** Single shared default constant; make all sites agree; ideally make the column NOT NULL with a default.

---

## BUG-45 — "My Commission" ignores the rep's stored rate (hardcoded 5%)
- **Severity:** Medium
- **Area:** `app/api/sales/my-commission/route.ts:8,48,73` (`COMMISSION_RATE = 0.05`); `app/api/sales/overview/route.ts:33`
- **What:** These routes compute the rep's commission on partner order revenue using a hardcoded `0.05`, ignoring `profiles.commission_rate`. Meanwhile `my-platform-commission`/`commission` apply the stored rate to platform onboarding fees. Admin changes to a rep's rate have no effect on the order-revenue commission view.
- **Impact:** Admin-configured rates not honored on the order-revenue view; figure fixed at 5% regardless of the negotiated rate — disputes.
- **Repro:** Admin sets a rep's rate to 10%; the rep's `my-commission` still returns `revenue * 0.05`.
- **Check on website:** As admin change a rep's commission rate; as that rep open "My Commission" — order-revenue commission unchanged.
- **Fix:** Pick the SSOT (stored rate) and apply consistently; remove the hardcoded `0.05` or document the two distinct streams from one config.

---

## BUG-46 — `/api/admin/test-promo` GET is unauthenticated (kill-switch state disclosure; ties to BUG-30)
- **Severity:** Medium
- **Area:** `app/api/admin/test-promo/route.ts:9-20` (GET, no `requireAuth`); `lib/supabase/middleware.ts:162` (public allowlist)
- **What:** POST toggle is admin-gated, but GET reads the `test_promo_code` setting with no auth (bare admin client) and the path is whitelisted public. Any anonymous caller can read whether the free-document TEST promo is active.
- **Impact:** Unauthenticated disclosure of the free-document kill-switch state — an attacker can poll to detect the moment it's left on in prod, then exploit BUG-30.
- **Repro:** Logged out, `GET /api/admin/test-promo` → `{active: true|false}`.
- **Check on website:** In an incognito window (not logged in) visit `/api/admin/test-promo` → returns the active state.
- **Fix:** Require admin for GET (or remove from the public allowlist); the checkout consumer should read app_settings server-side, not via a public admin endpoint.

---

## BUG-47 — Amendment checkout fakes the acknowledgment signature (Core Rule 3)
- **Severity:** Medium
- **Area:** `app/api/checkout/amendment/route.ts:50-51` (free path) and `:89-90` (paid path)
- **What:** Both amendment branches unconditionally write `acknowledgment_signed: true` + `acknowledgment_signed_at: now()`. `amendmentCheckoutSchema` has no acknowledgment field and the amendment UI shows no acknowledgment step. BUG-2 logged this for `createCheckoutSession.ts` (will/trust); the amendment route is a separate file = distinct still-open occurrence.
- **Impact:** Amended documents generated for clients who never acknowledged; order falsely asserts they did. Same compliance/fabricated-records exposure as BUG-2, on the amendment product.
- **Repro:** Request any amendment from `/dashboard/amendment` → order row has `acknowledgment_signed: true` with no acknowledgment shown.
- **Check on website:** Log in → `/dashboard/amendment` → submit a change → never shown an "agree this isn't legal advice" box; the `orders` row shows `acknowledgment_signed = true`.
- **Fix:** Require explicit `acknowledged: boolean` in `amendmentCheckoutSchema`, reject when false, set the column from it; show the acknowledgment in the amendment UI.

---

## BUG-48 — Consumer "We recommend" copy violates no-legal-advice rule (trust intake)
- **Severity:** Medium
- **Area:** `app/trust/page.tsx:575`
- **What:** Selecting "Business interests" during trust intake shows: "Business interests in a trust require careful structuring. **We recommend** adding attorney review…". Core Rule 2 forbids "We recommend…"; must use "Based on your answers…". Live consumer copy on a paid funnel screen.
- **Impact:** Direct violation of the hardcoded no-legal-advice voice rule.
- **Repro:** `/trust` → asset types → "Business interests" → amber callout reads "We recommend adding attorney review."
- **Check on website:** Start a Trust, on assets check "Business interests" → the warning box says "We recommend adding attorney review."
- **Fix:** Reword neutrally, e.g. "Attorney review is available to ensure your business provisions are correctly drafted."

---

## BUG-49 — Consumer "We recommend" / "best for you" copy in dashboard life-events
- **Severity:** Medium
- **Area:** `app/dashboard/life-events/page.tsx:9,12,13,15`
- **What:** Logged-in client tool. "Started or Sold a Business" renders `"…We recommend attorney review for this change."`; line 15 says "which estate planning strategy is best for you"; lines 9/13 "review … is recommended". Prohibited advisory voice rendered directly to the client.
- **Impact:** No-legal-advice violations shown to paying clients.
- **Repro:** `/dashboard/life-events` → "Started or Sold a Business" → "We recommend attorney review."; "Significant Change in Assets" → "best for you."
- **Check on website:** In the client dashboard open "Has anything changed in your life?", tick the business + assets events → advisory wording appears.
- **Fix:** Replace with answer-framed neutral copy ("Attorney review is available for this change"; "may affect which package fits your situation").

---

## BUG-50 — `pro/marketing` annual-review copy uses "We recommend"
- **Severity:** Medium
- **Area:** `app/pro/marketing/page.tsx:78`
- **What:** Body copy: "…**We recommend** a quick annual review to make sure your plan is still current." (The ✗-example strings at :30-31 are intentional don't-say examples and are fine; line 78 is real recommending copy.)
- **Impact:** Recommendation-voice violation in partner-distributed marketing copy.
- **Repro:** Render `/pro/marketing` → annual-review section reads "We recommend a quick annual review."
- **Check on website:** Open the pro marketing materials page → annual-review blurb uses "We recommend."
- **Fix:** Reword neutrally ("An annual review helps keep your plan current.").

---

## BUG-51 — Trust successor-trustee numbering can silently drop a named trustee
- **Severity:** Medium
- **Area:** `lib/documents/templates/michigan-revocable-trust.ts:85, :109`
- **What:** `second_successor_trustee` falls back to `additional_successor_trustees[0]?.name`, then the extra list renders `additional_successor_trustees.slice(1)`. If the client supplied both an explicit `secondSuccessorTrusteeName` AND an `additionalSuccessorTrustees` array, index 0 of the array is silently dropped (skipped by `slice(1)` though it was never consumed as the second successor).
- **Impact:** A named successor trustee can be omitted from the generated trust — a missing fiduciary in a legal document.
- **Repro:** Trust intake with `secondSuccessorTrusteeName:"X"` and `additionalSuccessorTrustees:[{name:"Y"},{name:"Z"}]` → prompt names X as second successor and only Z as additional; **Y dropped**.
- **Check on website:** Hard via standard UI; reachable via direct API since intake is `.passthrough()` (BUG-28). See note.
- **Fix:** Seed `second_successor_trustee` from the array only when no explicit value exists, and slice accordingly; otherwise render the full array.

---

## BUG-52 — Attorney review status PATCH accepts arbitrary free-string status (no state machine)
- **Severity:** Medium
- **Area:** `app/api/attorney/reviews/[reviewId]/route.ts:17-25`; schema `lib/validation/schemas.ts:488-490` (`status: z.string().min(1).max(40)`)
- **What:** Any non-empty string ≤40 chars is written straight to `attorney_reviews.status` (correctly scoped to the owning attorney). No allow-list, no transition validation. The approve flow + SLA `findOverdue` rely on specific status values.
- **Impact:** The owning attorney can set `"approved"`/`"delivered"`/anything directly — bypassing the `approve` route's order/document-unlock side effects + audit logging, and corrupting SLA/pipeline filtering. An unknown value removes the case from the overdue query (evading SLA tracking). A review can be "approved" with no decision audit and no client unlock → divergent state.
- **Repro:** As the assigned attorney, `PATCH /api/attorney/reviews/<id> {status:"approved"}` → review shows approved but order/documents stay locked, no audit row. Or `{status:"x"}` → disappears from check-sla.
- **Check on website:** On the review pipeline, intercept the status-update request, change `status` to `approved`/arbitrary word → accepted; compare to the proper Approve button (which unlocks the order).
- **Fix:** Use `z.enum([...valid statuses])` + enforce legal transitions; terminal decisions must go through `approve`.

---

## BUG-53 — Attorney `approve` is not idempotent and doesn't require a reviewed document
- **Severity:** Medium
- **Area:** `app/api/attorney/approve/route.ts:30-51`; `attorneyReviewRepo.updateDecision`
- **What:** `approve` never checks current status before acting — `updateDecision` overwrites unconditionally. A review can be approved repeatedly (re-stamps `reviewed_at`, re-runs the order/documents `delivered` update, re-sends the delivery email, writes another audit row). Separately, approval performs no check that a reviewed document exists (`documents.reviewed_path` may be null).
- **Impact:** (1) Duplicate "documents delivered" emails on retry. (2) The paid $300 attorney-review product can be marked complete and delivered with zero reviewed artifact — client paid for review they may not have received; no server-side gate ensures the deliverable exists.
- **Repro:** `POST /api/attorney/approve {reviewId, decision:"approved"}` twice → second still 200, order re-delivered, second email sent. Or approve a review whose documents have no `reviewed_path` → order delivered anyway.
- **Check on website:** Open an assigned review, click Approve without uploading a reviewed document → client is unlocked/emailed. Click Approve again → another delivery email.
- **Fix:** Reject (409) if already in a terminal decision; for approvals require at least one document with a non-null `reviewed_path` before unlocking.

---

## BUG-54 — Attorney-review role lists are inconsistent across routes (broken workflow / privilege mismatch)
- **Severity:** Medium
- **Area:** `reviews/route.ts:14`, `pipeline/route.ts:14`, `reviews/[reviewId]/route.ts:14` use `["review_attorney","attorney"]`; `approve`, `upload-reviewed`, `review`, `review-docx`, `notify-client` use `["review_attorney","admin"]`
- **What:** Accepted-role sets differ across the review surface. An `attorney`-typed user can list the queue and PATCH status (BUG-52) but is 403'd from approve/upload/detail/docx. An `admin` can approve/view detail but is 403'd from the queue. No route accepts all three.
- **Impact:** An `attorney`-typed user gets a half-working tool (can see + re-status cases, can't fetch docs or approve); admins can't use the queues. Privilege-model defect: status mutation granted to a role denied the corresponding decision/upload capability.
- **Repro:** Provision a user `user_type:"attorney"`; `GET /api/attorney/reviews` → 200; `POST /api/attorney/approve` → 403.
- **Check on website:** Compare an `attorney` vs `review_attorney` login — the `attorney` sees the reviews list but every document/approve action fails.
- **Fix:** Standardize the role list across all attorney-review routes (or drop the unused `attorney` type from the queue routes); decide admin queue access and apply uniformly.

---

## BUG-55 — `/api/contact` missing from public allowlist → contact form 401s for anonymous visitors
- **Severity:** Medium
- **Area:** `lib/supabase/middleware.ts:162`; consumer `lib/api-client/misc.ts:8` (`publicPost`); page `app/contact/page.tsx`
- **What:** The contact form renders on public `/contact` and submits via `publicPost("/api/contact")` (no auth header). `/api/contact` is NOT in `publicPaths` and isn't a partner-slug path → middleware returns 401 for any logged-out caller.
- **Impact:** The contact form silently fails for its intended audience (anonymous prospects). Lost leads / broken public funnel.
- **Repro:** Logged out, `POST /api/contact {name,email,message}` → 401 before the handler.
- **Check on website:** In incognito open `/contact`, fill + submit → fails (401 in Network tab) instead of sending.
- **Fix:** Add `"/api/contact"` to `publicPaths`.

---

## BUG-56 — `/api/csp-report` missing from public allowlist → all CSP reports dropped
- **Severity:** Medium
- **Area:** `lib/supabase/middleware.ts:162`; `next.config.mjs:22,38` (`report-uri /api/csp-report`)
- **What:** Browsers POST CSP violation reports unauthenticated to `/api/csp-report` (configured in CSP headers). The path isn't allowlisted, so middleware 401s every report before the handler. The endpoint's purpose (collect violations to later flip CSP to enforce) is defeated.
- **Impact:** Zero CSP telemetry; the team can never safely move CSP from Report-Only to enforce. Security-visibility gap.
- **Repro:** Trigger any CSP violation logged out → POST to `/api/csp-report` returns 401; nothing logged.
- **Check on website:** Load a public page logged out, cause a blocked inline script, watch `/api/csp-report` return 401 in DevTools.
- **Fix:** Add `"/api/csp-report"` to `publicPaths`.

---

## BUG-57 — No rate limiting on public lead / Claude-cost endpoints
- **Severity:** Medium
- **Area:** `app/api/professionals/request-access/route.ts`, `app/api/contact/route.ts`, `app/api/quiz/personalize/route.ts`, `app/api/affiliate/signup/route.ts`, `app/api/csp-report/route.ts` (none import a limiter; contrast `app/api/share/route.ts:5,31`)
- **What:** None apply `apiRateLimit` / per-IP throttle. `quiz/personalize` calls the Claude API on every request with caller-controlled, unbounded `quiz_answers` (`z.record(z.string(), z.unknown())`); `request-access`/`affiliate/signup` create DB rows + send emails / create Stripe Connect accounts.
- **Impact:** (a) `quiz/personalize` is a paid-API cost-abuse vector (scripted unbounded Claude calls; the unbounded record is also a prompt-injection surface). (b) lead-table + email spam; affiliate spam spawns Stripe Connect accounts.
- **Repro:** Loop `POST /api/quiz/personalize {quiz_answers:{},recommendation:"will"}` → every request hits Claude, no 429.
- **Check on website:** Resend the quiz-personalize or contact request rapidly in DevTools → never throttled.
- **Fix:** Add per-IP `apiRateLimit` to each (mirror `share/route.ts`); cap `quiz_answers` size/depth; whitelist consumed keys before building the prompt.

---

## BUG-58 — script-card PDF: unsanitized `company_name` in Content-Disposition (header injection)
- **Severity:** Medium
- **Area:** `app/api/marketing/script-card/route.ts:124`
- **What:** `Content-Disposition: attachment; filename="${companyName} - Compliance Script Card.pdf"` interpolates partner-controlled `company_name` directly into the response header with no header-safe sanitization (no quote/CR/LF stripping). A `"` truncates the filename; control chars corrupt the header.
- **Impact:** Header corruption / malformed filename driven by partner data; latent header-injection class on a generated-document response.
- **Repro:** Set partner `company_name` to `x"; evil` (or a newline), GET `/api/marketing/script-card` → malformed `Content-Disposition`.
- **Check on website:** As a partner set the company name to include a double-quote, download the Script Card → saved filename is broken/truncated.
- **Fix:** Sanitize for the header (strip `"`, `\r`, `\n`, control chars) or use RFC 5987 `filename*=UTF-8''…` with a slug.

---

## BUG-59 — `farewell/verify` has no Zod schema; `clientId` is an unvalidated free string in DB queries
- **Severity:** Medium
- **Area:** `app/api/farewell/verify/route.ts:21-26`
- **What:** The only money/data-adjacent route that reads `formData` with zero schema validation. `clientId` is checked only for truthiness, then passed raw into `.eq("id", clientId)` / `.eq("client_id", clientId)` across six tables and concatenated into the cert storage path (the BUG-67 area). Not validated as a UUID; route is unauthenticated (IP-rate-limited only).
- **Impact:** Malformed/oversized `clientId` reaches Postgres unfiltered → 500 instead of a clean 400; the raw value flows into a storage object path (compounds BUG-67). No cross-tenant read (blind-index `.eq("email_blind")` gate still applies) — a hardening/robustness defect.
- **Repro:** `POST /api/farewell/verify` (multipart) with `clientId` = a long non-UUID string → query-layer 500.
- **Check on website:** On the public farewell-verify form, intercept the submit and replace `clientId` with junk text → the request 500s instead of a clean validation error.
- **Fix:** Add a `farewellVerifySchema` (`clientId: z.string().uuid()`, `trusteeEmail: z.string().email()`, cert type/size) and `safeParse` before any DB call; whitelist the cert `ext` here too (fixes part of BUG-67).

---

## BUG-60 — Guest client creation in the webhook is read-then-insert with no unique constraint (duplicate-client race)
- **Severity:** Medium
- **Area:** `lib/webhooks/stripe/resolveOrCreateGuestClient.ts:77-87`; mirrored `handleDocumentCheckout.ts:116-133`
- **What:** Both paths "find client by profile_id → if none, create" with no transaction and no reliance on a unique constraint. If two checkout webhooks for the same guest email arrive close together (e.g. will + vault, or two deliveries), both pass the "no existing client" check and each create a separate `clients` row for the same profile.
- **Impact:** One customer ends up with two `clients` rows; orders/documents split across them so the dashboard shows only one purchase (related to BUG-6's class). Data-integrity + support load.
- **Repro:** Fire two guest `checkout.session.completed` for the same new email within one window → two `clients` rows for one profile.
- **Check on website:** Hard via UI timing; reproduce in staging by replaying two guest checkouts for one new email concurrently → two rows sharing `profile_id`.
- **Fix:** Unique constraint on `clients(profile_id)` (where not null) + upsert / `ON CONFLICT DO NOTHING … RETURNING`; never read-then-insert for client creation.

---

## BUG-61 — Amendment partner payout: connected-account failure leaves no pending payout
- **Severity:** Medium
- **Area:** `lib/webhooks/stripe/handleAmendmentCheckout.ts:33-63`
- **What:** When `partnerId && partnerCut > 0` and the partner has a `stripe_account_id`, `transferToPartner` runs inside a try/catch that only `console.error`s. The `else` that writes a `pending` payout runs only when there's NO `stripe_account_id`. So a connected-but-failed transfer (capability inactive, or `transferToPartner` returns null) writes no payout row at all. Same defect as BUG-15, in the amendment handler.
- **Impact:** Partner owed an amendment cut, transfer fails, no reconcilable payout row — silently unpaid.
- **Repro:** Partner with an incomplete Connect account; client pays for an amendment through them → 200, `payouts` has no row.
- **Check on website:** Connect a partner but stop onboarding before "transfers" enabled, buy an amendment through them → no payout for the order; Stripe logs show the error.
- **Fix:** In the catch (and on `transfer === null`) always write a `pending` payout; check payability before transferring.

---

## BUG-62 — Order status flip to `generating` is unchecked in webhook handlers
- **Severity:** Medium
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:150`; `handleAmendmentCheckout.ts:16-20`; `lib/repos/server/orderRepo.ts:20`
- **What:** Both handlers call `orderRepo.update(supabase, orderId, {status:"generating", ...})` and ignore the returned `{error}`. If the UPDATE fails (transient error, or `orderId` from metadata doesn't match a row), the handler continues — pays the partner, inserts document records, queues generation — while the order stays `pending`. 200 returned, marked processed.
- **Impact:** Status diverges from reality: a paid order can stay `pending` while payouts/docs proceed, or fulfillment runs against the wrong/no order. Same swallowed-write class as BUG-42, on the core money-path status field.
- **Repro:** Force the `orders` UPDATE to fail (invalid `order_id` metadata or transient error) during a paid webhook → downstream side-effects still run, status not advanced, 200.
- **Check on website:** Hard via UI (needs DB fault injection); in staging tamper with `order_id` metadata → order stays `pending` while a payout row appears.
- **Fix:** Check the `update` error; on failure abort fulfillment, alert, return non-200 (with the BUG-8 release-on-failure fix so Stripe retries).

---

## BUG-63 — `partner_platform_fee` webhook applies tier/fee-paid flags without checking the write result
- **Severity:** Medium
- **Area:** `app/api/webhooks/stripe/route.ts:127-132`; `partnerRepo.update`
- **What:** On `checkout.session.completed` with `type === "partner_platform_fee"`, the router sets `one_time_fee_paid:true`, `onboarding_step:2`, `platform_fee_amount`, and the paid `tier`, then writes a success audit entry and returns 200 — without inspecting the update `error`. The event is already marked processed.
- **Impact:** If the partner UPDATE fails, the partner paid the platform fee but `one_time_fee_paid` stays false and the tier upgrade never applies; the audit log falsely records success and the event won't retry. Partner charged but not upgraded/unblocked. BUG-42 class, distinct route.
- **Repro:** Force the `partners` UPDATE to fail (invalid `partner_id` metadata) on a platform-fee checkout → 200, audit says "platform_fee_paid", partner record unchanged.
- **Check on website:** In staging complete a partner platform-fee checkout with a stale `partner_id` (or induce an UPDATE error) → partner stays on the pre-payment onboarding step despite a successful charge.
- **Fix:** Check the `update` error; on failure don't write the success audit and return non-200 so Stripe retries (with BUG-8's idempotency release-on-failure).

---

## BUG-64 — Lost intake session → `Missing intake answers` (400)
- **Severity:** Low/Medium (UX)
- **Area:** `app/trust/checkout/page.tsx`, `app/will/checkout/page.tsx` (reads `sessionStorage`)
- **What:** Intake answers live in `sessionStorage`. If cleared/expired/new context, checkout posts empty intake → 400.
- **Impact:** User reaches checkout but can't pay; confusing dead-end.
- **Repro:** Clear `sessionStorage` on checkout page, click Proceed.
- **Fix:** Detect missing intake earlier; redirect to quiz with friendly message instead of failing at submit.

---

## BUG-65 — Lost intake silently dumps the user back to start, mid-payment
- **Severity:** Low/Medium (UX / lost sales)
- **Area:** `app/will/checkout/page.tsx:61-62` (mount) and `:166-171` (`handlePayment`; same shape in `handleTestSubmit`, `handleAcknowledgmentAccepted`)
- **What:** Intake lives in `sessionStorage.willIntake`. If missing, the page redirects to `/will` with no message. In the pay handlers the redirect happens *after* `setLoading(true)` with no reset and no notice — so a user who already entered/verified email and clicked Proceed sees a spinner then lands back at the start. (BUG-64 is the server-side 400 version of the same root cause.)
- **Impact:** Customer dumped at the worst moment (about to pay), no explanation; likely abandons. Verified-email state lost.
- **Repro:** On `/will/checkout`, clear `sessionStorage`, click Proceed → silent bounce to `/will`.
- **Check on website:** Start a will → reach `/will/checkout` → verify email → DevTools → Application → Session Storage → delete `willIntake` → click **Proceed to Payment** → spinner flickers, then silent bounce to `/will` start.
- **Fix:** Detect missing intake on mount and show an explicit "your session expired — please restart" message before redirecting; reset `loading` and surface a message in the handlers; preserve verified-email state.

---

## BUG-66 — Trustee invite token never expires and is reusable (contradicts "expires in 7 days")
- **Severity:** Low
- **Area:** `lib/repos/server/trusteeRepo.ts:43-49` (`findByInviteToken` — no age filter); `app/api/vault/trustees/route.ts:162-208` (PATCH confirm — no expiry check, token not cleared); email copy claims 7-day expiry at :249
- **What:** Confirmation looks up the trustee purely by `invite_token` with no age check; `markActive` never nulls the token. The advertised 7-day expiry is not enforced.
- **Impact:** A forwarded/leaked/stale invite link works forever. Token is an unguessable UUID so exposure is limited, but the stated guarantee is false.
- **Repro:** Use an invite link past 7 days (or reuse after confirming) → still accepted.
- **Check on website:** Use a trustee invite link well after 7 days — it still confirms.
- **Fix:** Reject when `now - invite_sent_at > 7d`; null `invite_token` on confirm.

---

## BUG-67 — Death-certificate uploads can overwrite each other; unauthenticated path write
- **Severity:** Low
- **Area:** `app/api/farewell/verify/route.ts:119-123`
- **What:** Cert uploaded to `${clientId}/${Date.now()}.${ext}` with `upsert:true`. `ext` comes from the client filename, unbounded/unsanitized; `Date.now()` collisions overwrite a prior cert. Path keyed only on `clientId` (public, in the farewell URL); the route is unauthenticated (IP rate-limited only), so anyone passing the trustee-email blind-index check can write objects under any `clientId/` prefix.
- **Impact:** Unauthenticated, overwrite-enabled storage write into the `death-certificates` bucket; can clobber a legitimate cert of record. Low (requires passing blind-index lookup; cert is admin-reviewed).
- **Repro:** Two verify requests in the same `Date.now()` window / same filename → second overwrites first.
- **Check on website:** N/A (storage internals) — reproduce in staging with two rapid cert submissions.
- **Fix:** Random UUID in the path (not `Date.now()`), `upsert:false`, whitelist `ext` to the validated content type.

---

## BUG-68 — Marketing flyer/one-pager interpolate partner fields into HTML without escaping
- **Severity:** Low
- **Area:** `app/api/marketing/flyer/route.ts:38,71,72`; `app/api/marketing/one-pager/route.ts:40,80`
- **What:** `company_name`, `product_name`, `business_url`, `accent_color`, `profile.full_name/phone/email` are interpolated raw into returned `text/html`. `accent_color` lands inside `<style>` (CSS-context). Served `Content-Type: text/html` inline.
- **Impact:** Self-XSS / CSS-injection scoped to the partner's own document (they control their own branding). Becomes worse if branding fields are ever set by a non-owner (see BUG-41/37) or rendered in a shared/admin context.
- **Repro:** Set partner `accent_color` to `red;} body{display:none` or `company_name` to `<script>…`, GET `/api/marketing/flyer` → injected.
- **Check on website:** As a partner set the accent color / company name to an HTML/CSS payload, open the flyer endpoint → markup/styles injected.
- **Fix:** HTML-escape all interpolated text; validate `accent_color` against a strict hex regex.

---

## BUG-69 — `partner/add-domain` DELETE reads `domainType` with no schema → deletes the wrong domain
- **Severity:** Low
- **Area:** `app/api/partner/add-domain/route.ts:92`
- **What:** The DELETE branch does `const { domainType } = await req.json();` with no schema (the POST uses `partnerAddDomainSchema`). `domainType` drives a Vercel removal + a column-nulling ternary; anything other than `"custom_domain"` defaults to the subdomain branch. A missing/garbage body silently removes the partner's subdomain.
- **Impact:** Owner-scoped (no cross-tenant impact), but a malformed DELETE removes the wrong domain with no validation error. Footgun.
- **Repro:** As a partner, `DELETE /api/partner/add-domain` with `{}` → subdomain removed, returns `{success:true}`.
- **Check on website:** As a partner with both a subdomain and custom domain, fire the domain-delete with an empty body in DevTools → the subdomain is removed even though you didn't target it.
- **Fix:** Validate the DELETE body with `{ domainType: z.enum(["custom_domain","subdomain"]) }`; reject when absent/invalid.

---
