<!-- PROPOSED additions to BUGS.md. Do NOT modify the repo's real BUGS.md.
     Numbering continues from existing BUG-7. -->

## BUG-8 — Webhook idempotency marker committed before fulfillment; mid-handler failure permanently skipped on retry
- **Severity:** Critical
- **Area:** `app/api/webhooks/stripe/route.ts:42-49`, `lib/repos/server/stripeWebhookRepo.ts:8-14`
- **What:** The router inserts the `stripe_webhook_events` dedup row before running `handleDocumentCheckout`. If the handler throws before its internal try/catch blocks (e.g. `orderRepo.update` line 150, `createUser` line 76, payout logic), Stripe retries the same `event.id`, but `checkIdempotency` now returns null → router replies `{ duplicate: true }` and the handler never re-runs. Order left partial; documents never generate.
- **Impact:** Customer paid; the only fulfillment safety net (Stripe retries) is defeated by the dedup marker. Paid-but-nothing-delivered.
- **Repro:** Force a throw before line 295 in `handleDocumentCheckout` on the first webhook delivery; the Stripe retry is dropped as duplicate and the order stays unfulfilled.
- **Fix:** Commit the idempotency row only after the handler succeeds, or use a status column (`received` → `processed`) and treat `received` rows as re-processable; re-throw so Stripe retries.

---

## BUG-9 — No reconciliation for paid-but-unfulfilled orders (resolves BUG-2 open item)
- **Severity:** Critical
- **Area:** Webhook is the sole fulfillment trigger; `app/api/checkout/verify/route.ts` does not fulfill; no relevant cron exists under `app/api/cron/`.
- **What:** Fulfillment (mark generating, create document rows, queue doc-gen) happens only inside the `checkout.session.completed` webhook. The success-page `verify` route only reads the session + profile. If the webhook is never delivered (endpoint down, secret rotated, Stripe retry window exhausted), the card is charged but nothing fulfills it and no job detects it.
- **Impact:** Paid customer gets no documents, no account email, no alert. Highest-trust failure.
- **Repro:** Disable the webhook endpoint, complete a real payment → order stuck `pending` indefinitely.
- **Fix:** Add a reconciliation cron that polls Stripe for paid sessions whose orders are still pending and runs fulfillment idempotently; alert on paid-but-unfulfilled past a threshold. Optionally have `verify` kick fulfillment as a backstop. NOTE: depends on BUG-8 fix and a unique index on `documents(order_id, document_type)` to stay idempotent.

---

## BUG-10 — Partner revenue split silently defaults to "standard" when tier is null
- **Severity:** Medium
- **Area:** `lib/webhooks/stripe/handleDocumentCheckout.ts:197-209`
- **What:** In the no-Stripe-account branch, `calculateSplit(productType, (partner?.tier as ...) || "standard")` defaults a missing tier to standard. An enterprise partner whose tier read is null/partial gets the standard split persisted to the order (`ev_cut`/`partner_cut`), disagreeing with `PARTNER_SPLITS` (enterprise will: ev 5000 / partner 35000 vs standard ev 10000 / partner 30000).
- **Impact:** Order records the wrong partner cut; later pending-payout reconciliation pays the standard amount. Revenue-split drift from the SSOT.
- **Repro:** Webhook for an enterprise partner where `getStripeAndTier` returns `{ tier: null }`.
- **Fix:** Treat a missing tier as an error (skip + alert) or re-read it authoritatively; never default a financial tier silently.

---

## BUG-1 (confirmed STILL OPEN) — Stripe session creation can orphan a `pending` order
- Re-confirmed unchanged at `lib/checkout/createCheckoutSession.ts:195` (order insert) before `:251` (session create). Keep open. Fix and reconciliation cron (BUG-9) together.
