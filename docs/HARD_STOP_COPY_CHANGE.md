# Hard-stop copy correction — for Drake (UPL review)

**Date:** 2026-09-15 · **Reason:** a compliance audit found that three of the
four hard stops the marketing pages promised were enforced nowhere. The three
questions now exist and halt generation at both server gates, and the copy is
corrected to match what the platform actually does.

## The canonical four

A hard stop fires, and document generation halts, on exactly these:

1. Special-needs dependent
2. Irrevocable trust
3. Medicaid planning
4. Active estate dispute

Defined once, in `lib/compliance/hardStop.ts` (`HARD_STOP_REASONS`). Nothing
else halts generation.

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
