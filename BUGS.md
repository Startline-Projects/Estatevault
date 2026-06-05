# Known Bugs & Risks — Will / Trust Purchase Flow

Tracking doc for checkout + fulfillment failure modes. Severity: Critical > High > Medium > Low.

---

## BUG-1 — Stripe session creation can orphan a `pending` order
- **Severity:** High
- **Area:** `lib/checkout/createCheckoutSession.ts` (~line 226)
- **What:** Order row is inserted before the Stripe Checkout session is created. If `stripe.checkout.sessions.create()` throws (bad/expired key, Stripe outage, network), the request 500s but the `pending` order row already exists with no `stripe_session_id`.
- **Impact:** Orphan `pending` orders accumulate; never paid, never cleaned up; pollute reporting. Retries create duplicates.
- **Repro:** Set invalid `STRIPE_SECRET_KEY`, run a will/trust checkout → `pending` order in DB with no session.
- **Fix:** Create Stripe session first then insert order, OR try/catch and delete/mark-failed the order on Stripe error. Add cron to expire stale `pending` orders.

---

## BUG-2 — Webhook miss = paid but not fulfilled
- **Severity:** Critical
- **Area:** Stripe webhook handler (needs audit)
- **What:** Card is charged but `checkout.session.completed` webhook is missed/delayed/errors. Order never advances; documents never generate.
- **Impact:** Customer paid, gets nothing. Highest-trust failure.
- **Repro:** Disable webhook endpoint, complete a test payment → order stuck `pending`/`paid`.
- **Fix:** Ensure handler is idempotent + retried. Add reconciliation job polling Stripe for completed sessions whose orders are still pending. Alert on paid-but-unfulfilled orders past threshold.

---

## BUG-3 — Document generation failure = paid, no documents
- **Severity:** High
- **Area:** Doc-gen pipeline (Claude API) + `documents` table
- **What:** Order paid + marked `generating`, but AI generation fails (API error, timeout, rate limit). Documents stay `pending`/`generating` indefinitely.
- **Impact:** Paid, no usable output. No auto-retry surfaces it.
- **Repro:** Force Claude API call to fail during generation → stuck `documents` rows.
- **Fix:** Retry with backoff. Admin alert/dashboard for orders stuck in `generating`. Manual re-trigger.

---

## BUG-4 — Account linking failure on success page locks out paying customer
- **Severity:** High
- **Area:** `components/success/PasswordSetup.tsx` + set-password API
- **What:** After payment, success page creates/links the auth account + sets password. If profile/auth-user creation fails here, customer paid but can't log in.
- **Impact:** Paid customer with no access to their documents.
- **Repro:** Force set-password / profile-upsert to fail on success page after guest checkout.
- **Fix:** Make linking idempotent + retryable. Clear "finish account setup" recovery path. Ensure order recoverable by verified email.

---

## BUG-5 — `Failed to create client record` (FK on `clients.profile_id`)
- **Severity:** Medium — *largely fixed, verify*
- **Area:** `lib/checkout/createCheckoutSession.ts`, `app/dashboard/layout.tsx`
- **What:** Logged-in session references a `userId` with no `profiles` row (wiped account, partial signup) → `clients_profile_id_fkey` violation.
- **Fixes applied:** Checkout self-heals (recreate profile if auth user exists; guest fallback if fully wiped). Dashboard layout signs out + redirects orphaned sessions to login.
- **Remaining:** Add regression test for orphaned-session path; verify across will/trust/vault.
- **Repro:** Wipe a test user's `profiles` row, keep browser session, attempt checkout.

---

## BUG-6 — Checkout trusts client-supplied `userId` (auth weakness)
- **Severity:** Medium (security hardening)
- **Area:** `lib/validation/schemas.ts:121`, checkout route
- **What:** `userId` comes from request body (`z.string().nullable().optional()`), not the verified server session. A caller could POST an arbitrary `userId`.
- **Impact:** Order could attach to an account the caller doesn't own. No data leak today; latent integrity hole.
- **Fix:** Ignore `body.userId`; derive real user server-side via `requireAuth()` / `supabase.auth.getUser()`, pass only that into `createCheckoutSession`.

---

## BUG-7 — Lost intake session → `Missing intake answers` (400)
- **Severity:** Low/Medium (UX)
- **Area:** `app/trust/checkout/page.tsx`, `app/will/checkout/page.tsx` (reads `sessionStorage`)
- **What:** Intake answers live in `sessionStorage`. If cleared/expired/new context, checkout posts empty intake → 400.
- **Impact:** User reaches checkout but can't pay; confusing dead-end.
- **Repro:** Clear `sessionStorage` on checkout page, click Proceed.
- **Fix:** Detect missing intake earlier; redirect to quiz with friendly message instead of failing at submit.

---

> **Flows audited 2026-06-04 (BUG-8 → BUG-15):** Create Will, Create Trust, Client Portal.
> Each entry includes a **Check on website** section so a non-developer can reproduce it.

---

## BUG-8 — Acknowledgment signature is faked server-side (Core Rule 3)
- **Severity:** Critical
- **Area:** `lib/checkout/createCheckoutSession.ts:188-189` (also `:351-352`, `:416-420`); `app/will/checkout/page.tsx` (paid path)
- **What:** Rule 3 requires the client to sign the "this is not legal advice" acknowledgment before any document is generated. The normal paid path never shows an acknowledgment step (only the free/promo path does), yet the server unconditionally writes `acknowledgment_signed: true` + `acknowledgment_signed_at: now()` on every order. The Zod checkout schema has no acknowledgment field, so nothing from the client is even checked.
- **Impact:** Documents generate for customers who never acknowledged; the order record falsely asserts they did. Compliance + legal-exposure (records are fabricated proof).
- **Repro:** Set `sessionStorage.willIntake` directly (or skip the intake ack card), reach `/will/checkout`, pay → order created with `acknowledgment_signed: true` though no acknowledgment was shown.
- **Check on website:** Start a will and go through to checkout with a real card — notice you are never shown a "check this box to agree" step on the pay path. Then look at the order (Supabase `orders` table, or the order in the dashboard): `acknowledgment_signed` is `true` anyway.
- **Fix:** Require an explicit `acknowledged: boolean` in the checkout schema; reject (400) when false; set the column from that value, never a hardcoded `true`. Show the acknowledgment on the paid path too.

---

## BUG-9 — Hard stops (special-needs / irrevocable) not enforced on the purchase paths (Core Rule 4)
- **Severity:** Critical
- **Area:** `app/quiz/page.tsx:118-128` (only place a hard stop exists); `app/will/page.tsx`, `app/trust/page.tsx` (no hard-stop questions); `lib/checkout/createCheckoutSession.ts` and `lib/webhooks/stripe/handleDocumentCheckout.ts:274-322` (no server enforcement)
- **What:** Rule 4 says special-needs dependent / irrevocable trust must halt generation → attorney referral, "hardcoded, no override." The only hard-stop logic is React state in the marketing quiz. `/will` and `/trust` are separate, directly-linked entry points (Hero, Footer, PackageCards) that never ask the risky questions, and neither checkout nor the webhook re-checks anything before generating. The trust flow's `checkComplexity` is a different, overridable "complex" flag — not a hard stop.
- **Impact:** A family that legally must see an attorney can start from the homepage, never be asked, pay $400–$600, and receive auto-generated documents. The advertised "cannot be overridden" safeguard does not exist on the paid paths. The webhook is the last possible checkpoint and performs no stop check.
- **Repro:** Go straight to `/trust` (skip quiz) → complete intake (no special-needs question shown) → pay → documents generate, no referral.
- **Check on website:** From the homepage click **Trust** (not the quiz) → go through every intake screen → confirm it never asks about a special-needs dependent or irrevocable trust → reach checkout → it lets you pay. The "see an attorney" screen never appears.
- **Fix:** Ask the hard-stop questions inside both `/will` and `/trust`, AND re-derive them from `intakeAnswers` server-side in `createCheckoutSession` and again in the webhook before queueing — block with an attorney-referral response. Never rely on a client flag.

---

## BUG-10 — Cross-customer farewell video leak
- **Severity:** High (confidentiality)
- **Area:** `app/api/vault/farewell/[id]/signed-url/route.ts:30-44`
- **What:** The route authenticates any logged-in client, then if the caller is not the owner it only checks `message.vault_farewell_status === "unlocked"` — it never verifies the caller is a trustee of (or has any relationship to) the message's owner. It then mints a 7-day signed download URL and logs the access as `farewell.trustee_viewed`. Real trustees use a separate, properly authenticated surface (`/api/trustee/vault/*`), so this non-owner branch grants no legitimate capability.
- **Impact:** Any client account can download another client's private farewell video (the most personal vault item) for 7 days, with no permission and no PIN.
- **Repro:** Account B's farewell video reaches `unlocked` (a trustee verifies). Log in as unrelated Account A. `GET /api/vault/farewell/<B's message id>/signed-url` → 200 with a working link to B's video. Expected 403.
- **Check on website:** Use two test accounts as above; in the browser hit the signed-url endpoint for the other account's message id and confirm you get a downloadable link.
- **Fix:** Remove the non-owner branch — require `message.client_id === client.id`, else 404/403. Trustees use their own route.

---

## BUG-11 — Document-generation queue failure is swallowed (paid, no documents, no alert)
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:294-322`
- **What:** Queueing the generation job is wrapped in a try/catch that only `console.error`s. If `addJob` throws (Redis/Upstash down or unconfigured), the webhook still returns `200 ok`. By then document records exist as `pending` and the partner/affiliate have already been paid out (earlier in the same handler). No retry, no admin alert, no reconciliation.
- **Impact:** Customer charged, partner paid, documents never generated, order frozen in `generating` — and nothing surfaces it. Highest-trust failure (same family as BUG-2/BUG-3).
- **Repro:** Unset `UPSTASH_REDIS_*`, complete a paid checkout → webhook 200s, order stuck, queue empty.
- **Check on website:** In staging, break the queue (unset Redis env vars), pay a checkout → success page appears, but no documents ever show in the dashboard and no error is displayed.
- **Fix:** On queue failure, mark order/documents `failed` (not `pending`), emit an alert, don't return success. Add a reconciliation job that finds paid-but-unfulfilled orders and retries.

---

## BUG-12 — Intake answers are effectively unvalidated at the server boundary
- **Severity:** Medium
- **Area:** `lib/validation/schemas.ts:100-117` (`intakeAnswersSchema` is `.passthrough()`); consumed in `lib/documents/templates/michigan-will.ts`
- **What:** Only `email/firstName/lastName` are typed; every field that actually drives the document (beneficiaries array, shares, executor, guardian, free-text descriptions) is unconstrained — no required fields, no length caps, no numeric bounds, no array-size limits. The "shares must total 100%" rule is enforced only in the browser UI. The blob is stored as JSON and interpolated into the Claude prompt.
- **Impact:** A direct API call can submit empty/garbage intake (no beneficiaries, shares summing to 30%, a 1MB description, prompt-injection text) and an order + document are still created from it.
- **Repro:** POST `/api/checkout/will` with `intakeAnswers: { firstName: "A" }` → order created, generation queued.
- **Check on website:** In DevTools → Network, resend a checkout POST with an empty/garbage `intakeAnswers` → order + document still created.
- **Fix:** Tighten `intakeAnswersSchema` to require and bound the consumed fields (executor, ≥1 beneficiary, relationship enums, numeric `share` 0–100 with a server-side 100% sum check, max lengths on free text); re-validate before queueing.

---

## BUG-13 — Trust accepts a distribution age under 18
- **Severity:** Medium
- **Area:** `app/trust/page.tsx:471-479`
- **What:** The custom distribution-age input clamps anything over 99 but accepts any low value (0–17). `isCardComplete` only checks the field is truthy. The value flows into `michigan-revocable-trust.ts`.
- **Impact:** Generated trust can say "hold assets until age 5" — legally incoherent (a person is an adult at 18 in Michigan). Customer pays for a flawed document.
- **Repro:** Minor children = Yes → distribution age → Other → type `5` → continue. Accepted.
- **Check on website:** `/trust` → answer you have minor children → distribution age → **Other** → type `5` (or `0`) → it's accepted.
- **Fix:** Enforce a minimum (≥18) in the custom-age handler and in `isCardComplete`.

---

## BUG-14 — TEST promo generates real documents for $0 with weak guards
- **Severity:** Medium
- **Area:** `lib/checkout/createCheckoutSession.ts:298-400` (`handleTestPromo`)
- **What:** The `TEST` code path creates an order with `status: "generating"` and inserts document records — full real-document generation for $0 — gated only by an app-settings `active` flag and a global 50/hr rate limit. The origin allowlist is bypassable when `Origin`/`Referer`/`Host` are all absent (`origin === ""` passes).
- **Impact:** If `test_promo_code.active` is ever left on in production, anyone can mint free real documents (up to 50/hr globally), and the estatevault-only restriction is not enforced for header-less callers.
- **Repro:** With the test promo active, enter `TEST` on `/will/checkout` or `/trust/checkout` → real documents created at $0.
- **Check on website:** Only reproducible if `test_promo_code` is on — enter `TEST` at checkout and confirm documents generate with no payment. Verify the flag is forced **off** in production.
- **Fix:** Treat empty/unknown origin as untrusted; scope the rate limit per IP/email; ensure prod has the flag off; emit watermarked (not real) output for test orders.

---

## BUG-15 — Lost intake silently dumps the user back to start, mid-payment
- **Severity:** Low/Medium (UX / lost sales)
- **Area:** `app/will/checkout/page.tsx:61-62` (mount) and `:166-171` (`handlePayment`; same shape in `handleTestSubmit`, `handleAcknowledgmentAccepted`)
- **What:** Intake lives in `sessionStorage.willIntake`. If missing, the page redirects to `/will` with no message. In the pay handlers the redirect happens *after* `setLoading(true)` with no reset and no notice — so a user who already entered/verified email and clicked Proceed sees a spinner then lands back at the start. (BUG-7 is the server-side 400 version of the same root cause.)
- **Impact:** Customer dumped at the worst moment (about to pay), no explanation; likely abandons. Verified-email state lost.
- **Repro:** On `/will/checkout`, clear `sessionStorage`, click Proceed → silent bounce to `/will`.
- **Check on website:** Start a will → reach `/will/checkout` → verify email → DevTools → Application → Session Storage → delete `willIntake` → click **Proceed to Payment** → spinner flickers, then silent bounce to `/will` start.
- **Fix:** Detect missing intake on mount and show an explicit "your session expired — please restart" message before redirecting; reset `loading` and surface a message in the handlers; preserve verified-email state.

---

## BUG-16 — Partner "trust" earnings advertised as $500, actual payout is $450
- **Severity:** Medium (price drift vs SSOT)
- **Area:** `app/khan-lawgroup/page.tsx:22, :157`; `app/partners/attorneys/page.tsx:22, :152`; `app/partners/attorneys/CLAUDE.md:13`
- **What:** The Professional (= enterprise) partner tier is advertised as `$500/trust` on the partner-recruitment pages — both the static feature lists and the live earnings calculator (`calcTier === 'standard' ? 400 : 500`). The source of truth `lib/orders/pricing.ts:43` sets the enterprise trust partner cut to `45000` cents = **$450** (root `CLAUDE.md` agrees: "Enterprise partner: $350/will, $450/trust"). The will figures ($300 standard / $350 professional) are correct; only the professional trust figure drifts. The webhook pays the correct $450 from `PARTNER_SPLITS`, so the marketing overstates earnings by $50/trust.
- **Impact:** Partners are promised $500/trust but paid $450 — partner trust / dispute / chargeback-of-goodwill risk. Not a direct money loss to the platform.
- **Repro:** N/A (static + calculator copy).
- **Check on website:** Open `/khan-lawgroup` or `/partners/attorneys` → toggle the earnings calculator to **Professional** → the "per trust" figure shows **$500**; the Professional feature bullet reads **"$500/trust + your review fee"**. Compare to `lib/orders/pricing.ts:43` (enterprise trust partner = 45000 = $450).
- **Fix:** Change the four `500` occurrences (2 calculator lines, 2 feature strings) to `450`, and the doc line. Ideally derive from `PARTNER_SPLITS.trust.enterprise.partner` so it can't drift again.

---

> **Phase 1 — Money path deep audit (BUG-17 → BUG-24), 2026-06-05.** Surfaces: attorney-review fee integrity, vault-subscription lifecycle, Connect payouts, attorney/verify replay.

---

## BUG-17 — Platform pays out more attorney-review fee than it collected ($300 fixed in, up to $1,000+ out)
- **Severity:** Critical (direct money loss)
- **Area:** `lib/attorney-review/routing.ts:88`; `lib/webhooks/stripe/handleAttorneyReview.ts:57-69`; `lib/checkout/createCheckoutSession.ts:148`; `lib/validation/schemas.ts:163,548`; SSOT `lib/orders/pricing.ts:27`
- **What:** The client is ALWAYS charged `PRICES.attorneyReview` = 30000 ($300) at checkout (hardcoded, partner-independent). But for an attorney partner with an in-house reviewer (routing Case 4), `resolveReviewRouting` returns `feeAmount: partner.custom_review_fee || DEFAULT` and `handleAttorneyReview` transfers exactly that to the partner's Connect account. `custom_review_fee` has no upper bound tied to what was collected — attorney signup `review_fee` is `nonnegative().optional()` (no max), the partner self-update PATCH caps at $1,000, `/pro/settings` lets the partner set it freely. The canonical guard `ATTORNEY_REVIEW_FEE_RANGE { min:15000, max:150000 }` is **defined but referenced nowhere** (grep confirms zero usages).
- **Impact:** Partner sets review fee to $1,000+. Each attorney-reviewed order: client pays $300, EstateVault transfers $1,000+ → **net loss of $700+ per review out of platform funds.** Breaks the "3.6 invariant" the routing comment claims to protect.
- **Repro:** Attorney partner with in-house reviewer sets `custom_review_fee` to 100000; a client buys will/trust + attorney review ($300); webhook transfers $1,000 to the partner.
- **Check on website:** As an attorney partner go to **Pro → Settings**, set review fee to $1,000, save. Have a test client buy a Will with Attorney Review (pays $300). In **Stripe → Connect → that partner → Transfers**, the attorney_review_fee transfer is $1,000 vs the $300 collected.
- **Fix:** Clamp `custom_review_fee` to `ATTORNEY_REVIEW_FEE_RANGE` at every write boundary; never transfer more than the attorney cut actually collected. If a partner's fee exceeds $300, charge that amount at client checkout instead of the fixed price.

---

## BUG-18 — Cancelling a vault subscription revokes paid access immediately (mid-period)
- **Severity:** Critical (paid value revoked)
- **Area:** `app/api/subscription/cancel/route.ts:22-29`; gates at `subscription/status/route.ts:20`, `vault/upload-url/route.ts:42`, `vault/farewell/route.ts:82`, `vault/download-document/route.ts:23`
- **What:** Cancel correctly tells Stripe `cancel_at_period_end: true` (sub stays live until term end) but then immediately sets `vault_subscription_status = "cancelled"` in the DB. Every vault gate checks `status === "active"` and never consults `vault_subscription_expiry`. The route's own comment says "Cancel at period end, don't revoke access mid-period" — the DB flip does exactly that.
- **Impact:** A customer who paid for a year and cancels in month 2 instantly loses vault uploads, farewell messages, downloads, and free amendments for the 10 months already paid. Refund/chargeback risk.
- **Repro:** Active subscriber → POST `/api/subscription/cancel` → GET `/api/subscription/status` returns `canUseFarewell:false`; vault upload/farewell/download 403.
- **Check on website:** Subscribe to the vault, click Cancel Subscription, then immediately try to upload a document or record a farewell — you're blocked despite having paid through term end.
- **Fix:** On cancel keep `status: "active"` (or a `cancel_pending` state the gates still treat as active) until `vault_subscription_expiry`; let `customer.subscription.deleted` flip it at period end. Better: gate on `status active OR expiry > now`.

---

## BUG-19 — Vault double-billing: re-subscribe only blocked while status is "active"
- **Severity:** High
- **Area:** `app/api/checkout/vault-subscription/route.ts:95-96,126-128`
- **What:** The "Already subscribed" guard fires only when `status === "active"`. A customer whose status is `"cancelled"` (cancel_at_period_end — Stripe sub still live) or `"past_due"` passes the guard and creates a SECOND Stripe subscription. No check against an existing live `vault_subscription_stripe_id`.
- **Impact:** Two concurrent annual subscriptions → double-charged $99/yr; the second sub id overwrites the first, orphaning it for cancellation.
- **Repro:** Subscribe → cancel → start vault checkout again → no block → second subscription created.
- **Check on website:** Subscribe, cancel, immediately start subscribe again from the vault page — it lets you pay again. In **Stripe → Customers → that customer → Subscriptions** you see two active annual subs.
- **Fix:** Block when the client has any live `vault_subscription_stripe_id` (or status active/cancelled/past_due with unexpired period); reactivate the existing sub instead of creating a new one.

---

## BUG-20 — Partner payout silently lost when Connect account exists but isn't payable
- **Severity:** High
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:154-213` (connected branch + outer catch :210); `lib/stripe-payouts.ts:27`
- **What:** When a partner has a `stripe_account_id` but the Connect account's `transfers` capability isn't active (onboarding incomplete/under review/restricted), `transferToPartner` throws. Control jumps to the outer `catch` which only `console.error`s. Because the code took the connected branch, it never reaches the `else` that writes `ev_cut/partner_cut` and inserts a `pending` payout row → no transfer, no payout record, cuts left at defaults. (Distinct from BUG-11, which is the doc-gen queue.)
- **Impact:** Partner owed money, but no `sent` or `pending` payout row exists to reconcile against. Money silently unpaid; only a log line. Connect status is never checked before transferring.
- **Repro:** Partner with `stripe_account_id` whose onboarding is incomplete (`details_submitted:false`); a client buys through them; webhook 200s; `payouts` table has no row for the order.
- **Check on website:** Connect a partner but stop Stripe onboarding before "transfers" is enabled. Buy a Will through that partner's link → no payout appears in the revenue dashboard / `payouts` table; Stripe logs show the transfer error.
- **Fix:** Check the account is payable (reuse `getAccountStatus`) before transferring; if not, write a `pending` payout row instead of attempting and dropping. In the catch, always record a `pending` payout for the owed amount.

---

## BUG-21 — `/api/checkout/attorney/verify` is unauthenticated and non-idempotent → partner account overwrite on replay
- **Severity:** High (auth / integrity)
- **Area:** `app/api/checkout/attorney/verify/route.ts:14-134`
- **What:** Takes a `session_id`, verifies the Stripe session is paid, then creates an auth user + profile + partner record. Unauthenticated, with no idempotency/replay guard — it doesn't record that a `session_id` was processed. The partner `upsert` runs every call. The `session_id` is exposed in the success URL (`...?session_id={CHECKOUT_SESSION_ID}`), so anyone who sees it can POST repeatedly; a legitimate double-submit re-runs creation.
- **Impact:** Replay re-upserts the partner, resetting `custom_review_fee`/`tier`/`status` to signup values (undoing later admin changes), and writes a body-supplied `password` via `createUser`. Unauthenticated, replayable account-mutation keyed on a guessable/observable id.
- **Repro:** Complete an attorney paid signup, capture `session_id` from the welcome URL, POST it again with a chosen password → partner record re-written; tier/fee reset.
- **Check on website:** After an attorney signup completes, reload the welcome page (or resend the verify POST in DevTools) → the partner record is re-created/overwritten each time; no "already processed" guard.
- **Fix:** Make idempotent — record processed `session_id`s (or return success without mutating if the partner already exists for that session). Don't let the request body set a password on an existing account.

---

## BUG-22 — Lapsed/expired vault subscription keeps full access (expiry never enforced)
- **Severity:** Medium
- **Area:** `lib/repos/server/clientRepo.ts:146` (activate sets active + expiry); all gates check only `status === "active"`; no cron downgrades expired vault subs; `vault_subscription_expiry` read only in `subscription/status` (returned, not enforced)
- **What:** `vault_subscription_expiry` is written but never compared to "now" by any access gate. If a renewal webhook is missed or a sub lapses without a `subscription.deleted`/`payment_failed` event reaching the handler, status stays `"active"` with a past expiry and the customer keeps full vault access without paying.
- **Impact:** Free vault access after a subscription ends; lost recurring revenue; no reconciliation job catches it.
- **Repro:** Set a client's `vault_subscription_expiry` to a past date, leave status `"active"` → vault upload/farewell/download still succeed.
- **Check on website:** Requires DB state — in staging simulate a missed renewal (past expiry, status still active); access persists.
- **Fix:** Gate on `status === "active" AND expiry > now`; add a reconciliation cron that downgrades expired subs and re-checks Stripe.

---

## BUG-23 — Attorney `review_fee` checkout input is unbounded (validation-boundary defect; feeds BUG-17)
- **Severity:** Medium
- **Area:** `lib/validation/schemas.ts:163` (`review_fee: z.coerce.number().nonnegative().optional()`); `app/api/checkout/attorney/route.ts:84,157`; `app/api/checkout/attorney/verify/route.ts:121`
- **What:** The attorney signup `review_fee` has no upper bound and no `ATTORNEY_REVIEW_FEE_RANGE` check. It's multiplied by 100, stored as `custom_review_fee`, and echoed into Stripe session metadata. This is the input vector feeding BUG-17 and a validation defect in its own right.
- **Impact:** Garbage/excessive fees persisted on partner records and metadata; surfaced in sales dashboards and (via BUG-17) in real payouts.
- **Repro:** POST `/api/checkout/attorney` with `review_fee: 9999999` → accepted; partner `custom_review_fee` = 999999900 cents.
- **Check on website:** In the attorney signup form (or DevTools) submit an absurd review fee → accepted with no validation error.
- **Fix:** Replace `nonnegative().optional()` with a bound tied to `ATTORNEY_REVIEW_FEE_RANGE` ($150–$1,500), validated at every write site.

---

## BUG-24 — Subscription renewal webhook reactivates by status only, ignoring cancel intent
- **Severity:** Medium
- **Area:** `app/api/webhooks/stripe/route.ts:52-70`; `lib/repos/server/clientRepo.ts:140-148` (`activateVaultByStripeId`)
- **What:** On `invoice.payment_succeeded` with `billing_reason === "subscription_cycle"`, the handler unconditionally sets status back to `"active"` and pushes expiry +1 year, matched only on subscription id, with no cross-check against `cancel_at_period_end`. A stray/retried/out-of-order cycle invoice can flip a cancelled record back to active. `subscription/sync` early-returns on `status === "active"`, so it won't correct a wrongly-active record.
- **Impact:** Status drift between Stripe and the DB; a cancelled customer shown as active (or vice-versa).
- **Repro:** Replay a `subscription_cycle` invoice event for a sub whose client row is `cancelled` → row re-activates.
- **Check on website:** N/A (webhook ordering) — reproduce in staging with the Stripe CLI replaying events.
- **Fix:** On renewal confirm the Stripe subscription is genuinely active (not `cancel_at_period_end` past end) before reactivating; set expiry from the invoice's actual period end, not blindly +1 year.
