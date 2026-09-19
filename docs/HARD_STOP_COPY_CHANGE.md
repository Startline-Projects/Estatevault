# Hard-stop copy correction — for Drake (UPL review)

**Date:** 2026-09-15 · **Reason:** a compliance audit found that three of the
four hard stops the marketing pages promised were enforced nowhere. The three
questions now exist and halt generation at both server gates, and the copy is
corrected to match what the platform actually does.

## The canonical three (updated 2026-09-18)

A hard stop fires, and document generation halts, on exactly these:

1. Special-needs dependent
2. Medicaid planning
3. Active estate dispute

Defined once, in `lib/compliance/hardStop.ts` (`HARD_STOP_REASONS`). Nothing
else halts generation.

**Irrevocable trust was removed on 2026-09-18 by the founder's decision.** When
this document was written it was the second of four. The questionnaire no
longer asks about it, the evaluator no longer has a branch for it, and an answer
left on an old order is ignored. The partner-facing copy was brought into line the same day — see **"Change of
2026-09-18"** at the end of this file for the before and after of all eight
lines. The "After" text in "Changes, verbatim" below is the 2026-09-15 wording
and is superseded.

**"Business succession" was removed everywhere.** It was listed on two partner
pages as a hard stop. Nothing has ever asked about it, no evaluator branch
exists, and none is being added — so the claim was removed rather than
implemented. If it should be a hard stop, that is a product decision and needs a
question behind it before the claim goes back.

## Changes, verbatim

### 1. `app/khan-lawgroup/page.tsx:50` and `app/partners/attorneys/page.tsx:50` — FAQ answer

**Before**
> If a client's intake indicates an irrevocable trust, special needs planning, Medicaid asset protection, or business succession, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.

**After**
> If a client's intake indicates a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.

### 2. `app/khan-lawgroup/page.tsx:1035` and `app/partners/attorneys/page.tsx:1049` — body paragraph

**Before**
> When a client's situation involves irrevocable trusts, special needs planning, Medicaid asset protection, or business succession, the platform flags the case and routes it directly to you.

**After**
> When a client's situation involves a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, the platform flags the case and routes it directly to you.

### 3. `app/khan-lawgroup/page.tsx:452` and `app/partners/attorneys/page.tsx:434` — numbered step 4

**Before**
> Irrevocable trusts, Medicaid planning, business succession, flagged to you.

**After**
> Special-needs dependents, irrevocable trusts, Medicaid planning, estate disputes, flagged to you.

### 4. `app/pro/support/page.tsx:40` — partner FAQ answer

**Before**
> If a client indicates they have a special needs dependent or need an irrevocable trust, document generation halts automatically. The client is routed to a licensed attorney for consultation. You earn a $75 referral fee if the case converts. This is a compliance safeguard and cannot be overridden.

**After**
> If a client indicates a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, document generation halts automatically. The client is routed to a licensed attorney for consultation. You earn a $75 referral fee if the case converts. This is a compliance safeguard and cannot be overridden.

### 5. `app/pro/referrals/page.tsx:111` — body paragraph

**Before**
> When a client triggers a hard stop (e.g., special needs dependent or irrevocable trust), they are automatically routed to an attorney. You earn a $75 referral fee for each case that converts.

**After**
> When a client triggers a hard stop (a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute), they are automatically routed to an attorney. You earn a $75 referral fee for each case that converts.

## What is still true after the change

- "halts document generation" — yes, at `createCheckoutSession` (no order, no
  Stripe session) and again at the Stripe webhook (order parked as
  `needs_attorney`, no documents created).
- "cannot be overridden" — yes; the evaluator takes no flag and no promo path
  bypasses it.
- The $75 referral fee on conversion is unchanged.

## Separate from this change

The client-facing question wording and the referral-screen copy are the
development team's and are awaiting Mo Murshed's approval — see the open entry
in `PENDING_ATTORNEY_REVIEW.md`. Drake's review here is about the partner-facing
claims, not that wording.

## Change of 2026-09-18 — irrevocable trust removed from the partner copy

**Reason:** irrevocable trust stopped being a hard stop on 2026-09-18 (founder's
decision; `CLAUDE.md`, Core Rule 4). Eight partner-facing lines still promised
attorneys that irrevocable-trust cases halt and are routed to them. Each list now
names the three stops the platform enforces. Nothing else in any sentence changed.
**For Drake:** partner-facing copy that changed — please re-review.

Wrapped JSX lines are shown as the sentence renders. The **"Irrevocable Trust
$3,500 to $7,500"** engagement-pricing rows (`app/partners/attorneys/page.tsx:1057`,
`app/khan-lawgroup/page.tsx:1043`) are unchanged: they price work an attorney can
still be hired for, not a promise that the platform stops and routes the case.

`tests/unit/partner-hard-stop-copy.test.ts` now fails if these pages and
`lib/compliance/hardStop.ts` disagree again.

### 1. `app/partners/attorneys/page.tsx:50` — FAQ answer

**Before**
> If a client's intake indicates a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.

**After**
> If a client's intake indicates a special-needs dependent, Medicaid planning, or an active estate dispute, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.

### 2. `app/khan-lawgroup/page.tsx:50` — FAQ answer

**Before**
> If a client's intake indicates a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.

**After**
> If a client's intake indicates a special-needs dependent, Medicaid planning, or an active estate dispute, the platform halts document generation and flags the case directly to you for a full engagement. These are your clients, not referrals.

### 3. `app/partners/attorneys/page.tsx:434` — "How it works", step 4 description (the step title, "Complex cases become engagements", is unchanged)

**Before**
> Special-needs dependents, irrevocable trusts, Medicaid planning, estate disputes, flagged to you.

**After**
> Special-needs dependents, Medicaid planning, estate disputes, flagged to you.

### 4. `app/khan-lawgroup/page.tsx:452` — "How it works", step 4 description (the step title, "Complex cases become engagements", is unchanged)

**Before**
> Special-needs dependents, irrevocable trusts, Medicaid planning, estate disputes, flagged to you.

**After**
> Special-needs dependents, Medicaid planning, estate disputes, flagged to you.

### 5. `app/partners/attorneys/page.tsx:1049-1051` — body paragraph above the engagement-pricing list

**Before**
> When a client's situation involves a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, the platform flags the case and routes it directly to you.

**After**
> When a client's situation involves a special-needs dependent, Medicaid planning, or an active estate dispute, the platform flags the case and routes it directly to you.

### 6. `app/khan-lawgroup/page.tsx:1035-1037` — body paragraph above the engagement-pricing list

**Before**
> When a client's situation involves a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, the platform flags the case and routes it directly to you.

**After**
> When a client's situation involves a special-needs dependent, Medicaid planning, or an active estate dispute, the platform flags the case and routes it directly to you.

### 7. `app/pro/support/page.tsx:40` — partner support FAQ answer

**Before**
> If a client indicates a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute, document generation halts automatically. The client is routed to a licensed attorney for consultation. You earn a $75 referral fee if the case converts. This is a compliance safeguard and cannot be overridden.

**After**
> If a client indicates a special-needs dependent, Medicaid planning, or an active estate dispute, document generation halts automatically. The client is routed to a licensed attorney for consultation. You earn a $75 referral fee if the case converts. This is a compliance safeguard and cannot be overridden.

### 8. `app/pro/referrals/page.tsx:111-113` — referrals page body paragraph

**Before**
> When a client triggers a hard stop (a special-needs dependent, an irrevocable trust, Medicaid planning, or an active estate dispute), they are automatically routed to an attorney. You earn a $75 referral fee for each case that converts.

**After**
> When a client triggers a hard stop (a special-needs dependent, Medicaid planning, or an active estate dispute), they are automatically routed to an attorney. You earn a $75 referral fee for each case that converts.
