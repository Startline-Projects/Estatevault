<!-- Proposed additions for BUGS.md. NOT applied to the real BUGS.md. -->

## BUG-8 — Acknowledgment gate is client-side only; server always records it signed
- **Severity:** Critical
- **Area:** `lib/checkout/createCheckoutSession.ts:188-189` (paid), `:351-352` (test), `:416-420` (free); `app/api/checkout/amendment/route.ts:50-51, 89-90`; schema `lib/validation/schemas.ts:107-132`
- **What:** Core Rule 3 requires a signed acknowledgment before document generation, but it is enforced only in the UI. The checkout endpoint takes no acknowledgment proof and hardcodes `acknowledgment_signed: true` / `acknowledgment_signed_at = now()` on every order. A direct POST (or the in-app test path) creates an order recorded as acknowledged and, on free/test codes, begins generation.
- **Impact:** Documents can be generated without a real acknowledgment, and the DB falsely attests one was signed. Breaks a hardcoded Core Rule and the compliance audit trail.
- **Repro:** POST `/api/checkout/will` with valid `intakeAnswers` and no UI interaction → `acknowledgment_signed = true`; with a free promo, documents insert and generation starts.
- **Fix:** Require an explicit `acknowledgment {accepted, at, version}` in the checkout Zod schema; reject when absent; set the column from input, never as a constant. Apply to the amendment route too.

---

## BUG-9 — No server-side hard-stop enforcement (Core Rule 4 bypassable)
- **Severity:** High
- **Area:** Client-only check at `app/quiz/page.tsx:118-128` + `components/quiz/HardStopCard.tsx`; absent in `lib/checkout/createCheckoutSession.ts`, the Stripe webhook, and doc-gen
- **What:** Rule 4 hard stops (special-needs dependent, irrevocable trust) are "Hardcoded, no override," but the halt exists only in the quiz React component. Checkout proceeds regardless of intake content and even accepts a client-supplied `confirmOverride` (`schemas.ts:131`, used at `createCheckoutSession.ts:76`).
- **Impact:** A direct POST, deep link, or post-quiz answer change can generate documents for a hard-stop case, skipping the mandatory attorney referral.
- **Repro:** POST `/api/checkout/trust` with special-needs intake (or a free promo) → order + documents created, no halt.
- **Fix:** Re-derive hard-stop conditions from `intakeAnswers` server-side and reject before order/doc creation; never honor a client override for Rule-4 conditions.

---

## BUG-10 — Trust intake never enforces a Rule-4 hard stop
- **Severity:** High
- **Area:** `app/trust/page.tsx:183-195`, `lib/trust-types.ts:102-118`
- **What:** The `/trust` flow computes `checkComplexity`, stores it in `sessionStorage`, and routes straight to checkout regardless of `flagged` (no halt screen, unlike the quiz). Worse, `checkComplexity` only flags business/multi-state/unequal-split/custom-healthcare cases — not the Rule-4 hard stops (special-needs, irrevocable). Users entering via `/trust` are never subject to the Rule-4 hard stop on any path.
- **Impact:** The most dangerous Rule-4 scenarios pass straight through the trust flow to generation.
- **Repro:** Complete `/trust` intake for a special-needs scenario → proceeds to checkout/generation; no attorney referral.
- **Fix:** Add a true hard-stop check (special-needs/irrevocable) to the trust intake and authoritatively server-side; keep `complexity` as a separate attorney-engagement signal.

---

## BUG-11 — Partner earnings calculator overstates enterprise trust split ($500 vs $450)
- **Severity:** Medium
- **Area:** `app/khan-lawgroup/page.tsx:157` (`calcTier === 'standard' ? 400 : 500`)
- **What:** The earnings calculator computes enterprise trust earnings as $500/trust. SSOT (`lib/orders/pricing.ts:43`, enterprise trust partner = 45000) and CLAUDE.md fix it at $450. The will figure ($350) is correct; only enterprise trust is wrong.
- **Impact:** Marketing over-states enterprise partner earnings by $50/trust — an unpayable promise; reputational/contractual risk.
- **Repro:** `/khan-lawgroup` calculator → Enterprise + Trust shows $500 vs. $450 paid.
- **Fix:** Change `500` to `450`; ideally import from `PARTNER_SPLITS` instead of hardcoding.
