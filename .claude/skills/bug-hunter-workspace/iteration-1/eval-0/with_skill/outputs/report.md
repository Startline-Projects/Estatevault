# Bug Hunt — Will/Trust Checkout Money Path — 2026-06-04

## Summary
3 findings (1 Critical, 1 High, 1 Medium) on the paid-but-no-docs / wrong-amount surface.
Covered: checkout route -> createCheckoutSession -> Stripe session -> webhook router ->
handleDocumentCheckout -> doc-gen queue, plus pricing/split SSOT and the success-page
verify path. The Critical is a new idempotency-on-failure hole not yet in BUGS.md.

## Confirmed findings

### Critical — Webhook idempotency row committed before fulfillment; handler failure permanently drops the event
- Area: app/api/webhooks/stripe/route.ts:42-49 + lib/repos/server/stripeWebhookRepo.ts:8
- What: checkIdempotency() INSERTs the event row and the router treats a successful insert as
  "new event, proceed." The row commits immediately, BEFORE handleDocumentCheckout runs. If the
  handler later throws (Supabase blip, auth.admin.createUser error, queue import failure), withRoute
  returns 500. Stripe retries — but the retry finds the event row present, so inserted is null and
  the router short-circuits at line 48 returning {duplicate:true} 200. The handler never runs again.
- Impact: Customer charged (checkout.session.completed fired) but order never advances past pending,
  no documents created/queued, no welcome email, no account link. Stripe's retry safety net (the
  normal mitigation for BUG-2) is defeated by this ordering. No reconciliation cron exists to catch it.
- Repro: Force a throw inside handleDocumentCheckout after the idempotency row commits. First
  delivery 500s; event_id now in stripe_webhook_events. Stripe redelivers -> 200 duplicate without
  running the handler. Order stuck pending forever.
- Fix: Mark the event processed only AFTER the handler succeeds. Either wrap dispatch in try/catch
  and delete the idempotency row on failure then rethrow (so 500 lets Stripe retry), or use a
  received vs processed state and only set processed at the end. Add a reconciliation cron polling
  Stripe for paid sessions whose orders are still pending.

### High — No reconciliation for orders stuck in pending or generating (BUG-2 / BUG-3 still open)
- Area: vercel.json crons; lib/webhooks/stripe/handleDocumentCheckout.ts:294-322
- What: Fulfillment depends on a single webhook delivery succeeding. If the webhook is never
  delivered the order is never touched. If delivered but addJob throws, the catch(queueError) at
  line 320 swallows it and the webhook still returns 200 — order is generating but nothing is queued.
  No cron reconciles pending/generating orders. vercel.json has document processing and test-order
  cleanup crons but nothing detecting paid-but-unfulfilled.
- Impact: Paid customers with no documents and no automated recovery/alert. BUG-2/BUG-3 risk still
  unmitigated; the Critical above makes it worse by eating retries.
- Repro: (a) Disable webhook endpoint, complete payment -> order stays pending. (b) Make addJob
  throw -> order generating, no job, webhook 200.
- Fix: Cron that scans pending orders with a stripe_session_id (or lists Stripe completed sessions)
  and re-dispatches fulfillment; alert on generating past threshold; don't swallow queue error
  without flagging the order.

### Medium — Test promo guard bypassable when request has no Origin/referer/host
- Area: lib/checkout/createCheckoutSession.ts:306-311
- What: handleTestPromo derives origin from headers and rejects partner/non-estatevault origins.
  The guard is: if (isPartnerUrl || (!isEstateVault && origin !== "" && !origin.includes("localhost"))).
  With all three headers absent, origin === "", the second clause is false, and the request passes
  the origin check. It still requires test_promo_code.active and a 50/hr rate limit, but a
  server-to-server/scripted POST with no Origin header sidesteps the domain restriction, creating a
  $0 generating order with real documents queued.
- Impact: When the test code is toggled active, free document sets can be minted from contexts the
  guard meant to block, up to 50/hr. Gated on an admin toggle (hence Medium) but it is a $0
  wrong-amount path.
- Repro: With test_promo_code.active = true, POST /api/checkout/will with promoCode "TEST" and no
  Origin/referer/host headers -> passes origin check, returns {test:true}, documents queued at 0.
- Fix: Default-deny on empty origin: require a positive isEstateVault || localhost match rather than
  only rejecting known-bad origins.

## Needs verification
- Vault-subscription renewal (route.ts:58-60) always sets expiry to now + 1 year on every
  subscription_cycle invoice rather than extending from prior expiry. Likely fine for annual cycle;
  confirm it can't shorten an early-renewed term.

## Checked & OK
- Amount integrity: charge + line items derived server-side from PRICES/config.baseAmount; client
  cannot influence price. Attorney add-on amount server-set.
- Splits SSOT: calculateSplit reads PARTNER_SPLITS/AFFILIATE_SPLITS from pricing.ts; ev + partner
  sum to full price for both tiers/products. No drift in webhook/checkout.
- Transfer double-pay: transferToPartner/transferToAffiliate use order-scoped idempotencyKeys, so
  webhook replay won't double-pay (documented C-1 fix).
- Partner platform fee: platform_fee_amount taken from session.amount_total (Stripe truth), tier
  upgrade applied only after payment — sound.
