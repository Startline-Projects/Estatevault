
---

## BUG-8 — Webhook idempotency row committed before fulfillment; handler failure permanently drops the event
- **Severity:** Critical
- **Area:** `app/api/webhooks/stripe/route.ts` (~lines 42-49), `lib/repos/server/stripeWebhookRepo.ts`
- **What:** `checkIdempotency()` INSERTs the `stripe_webhook_events` row and the router treats a successful insert as "new event, proceed." The row commits BEFORE `handleDocumentCheckout` runs. If the handler throws afterward, `withRoute` returns 500 and Stripe retries — but the retry finds the event row already present, so `inserted` is null and the router returns `{ duplicate: true }` 200 at line 48 without ever running the handler again.
- **Impact:** Customer is charged but the order never advances past `pending`; no documents, no email, no account link. Stripe's retry mechanism (the normal safety net for BUG-2) is defeated by this ordering. No reconciliation cron exists to catch it. Paid-but-nothing-delivered.
- **Repro:** Force any throw inside `handleDocumentCheckout` after the idempotency insert (e.g. make `documentRepo.insertMany` reject). First delivery 500s; the event_id is now stored. Stripe redelivers → 200 `duplicate:true`, handler skipped, order stuck `pending`.
- **Fix:** Mark the event processed only AFTER the handler succeeds — wrap dispatch in try/catch and delete the idempotency row on failure then rethrow (so the 500 lets Stripe retry), or use a `received`/`processed` two-state column and only set `processed` at the end. Pair with a reconciliation cron polling Stripe for paid sessions whose orders are still `pending`.

---

## BUG-9 — Test promo origin guard bypassable when request has no Origin/referer/host headers
- **Severity:** Medium
- **Area:** `lib/checkout/createCheckoutSession.ts` (~lines 306-311, `handleTestPromo`)
- **What:** The origin guard is `if (isPartnerUrl || (!isEstateVault && origin !== "" && !origin.includes("localhost")))`. When Origin, referer, and host are all absent, `origin === ""`, the second clause is false, and the request passes the domain check. Combined with `test_promo_code.active`, a scripted/server-to-server POST with no Origin header can mint a $0 `generating` order with real documents queued, up to the 50/hr cap.
- **Impact:** When the test code is toggled active, free document sets can be created from contexts the guard intended to block. A $0 wrong-amount fulfillment path. Gated on an admin toggle, hence Medium.
- **Repro:** With `test_promo_code.active = true`, POST `/api/checkout/will` with `promoCode: "TEST"` and no Origin/referer/host headers → passes the origin check, returns `{ test: true }`, documents queued at amount_total 0.
- **Fix:** Default-deny on empty origin — require a positive `isEstateVault || localhost` match instead of only rejecting known-bad origins.
