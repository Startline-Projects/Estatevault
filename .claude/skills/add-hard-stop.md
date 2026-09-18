---
name: add-hard-stop
description: Insert the EstateVault hard-stop check into a route or component. Uses the one shared evaluator so the special-needs, Medicaid-planning and estate-dispute conditions always halt document generation identically.
---

Insert the EstateVault hard-stop check into the file the user specifies. This logic is hardcoded and must never be modified or bypassed.

## The three hard-stop conditions (Core Rule 4 — all three are always checked)
1. Client has a dependent with special needs → `hasSpecialNeedsDependent === "Yes"`
2. Client is planning for Medicaid or long-term care costs → `hasMedicaidPlanning === "Yes"`
3. There is an active dispute over the client's estate → `hasEstateDispute === "Yes"`

**Irrevocable trust is NOT a hard stop.** It was removed on 2026-09-18 by the founder's decision (see `CLAUDE.md`, Core Rule 4). Do not add a check for it, and do not treat its absence as a bug.

**Never write a new evaluator.** There is exactly one: `evaluateHardStop()` in `lib/compliance/hardStop.ts`, with the canonical reason strings in `HARD_STOP_REASONS`. A second, divergent evaluator existed once (`detectQuizHardStop`) and had to be removed.

## Server-side pattern (API route)

```ts
import { evaluateHardStop } from "@/lib/compliance/hardStop";

// Hard stop (Core Rule 4) — re-derive from the answers server-side; never trust
// a client flag. Runs BEFORE any order, Stripe session or document row.
const hardStop = evaluateHardStop(intakeAnswers);
if (hardStop.halted) {
  return NextResponse.json(
    {
      error:
        "Based on your answers, your family's situation needs a licensed attorney. We can't generate this document automatically.",
      hardStop: true,
      reasons: hardStop.reasons,
      referralPath: "/attorney-referral",
    },
    { status: 409 },
  );
}
```

The two existing server gates are the reference implementations — match them:
- `lib/checkout/createCheckoutSession.ts` — 409 before any order or Stripe session; records a partner referral through `referralRepo` when a partner sent the client.
- `lib/webhooks/stripe/handleDocumentCheckout.ts` — parks the order as `needs_attorney` and creates no document rows.

## Client-side pattern (component)

```tsx
import { evaluateHardStop } from "@/lib/compliance/hardStop";
import HardStopCard from "@/components/quiz/HardStopCard";

const hardStop = evaluateHardStop(intake as unknown as Record<string, unknown>);
if (hardStop.halted) {
  return <HardStopCard partnerId={partnerId} reason={hardStop.reasons[0]} />;
}
```

`HardStopCard` carries the reason-specific copy and the contact form that records the referral.

## Rules
- Hard-stop check runs BEFORE any document generation — no exceptions
- Use `evaluateHardStop` and `HARD_STOP_REASONS`; never hardcode field checks or reason strings
- Client-facing copy lives in `components/quiz/HardStopCard.tsx`; wording changes go through `PENDING_ATTORNEY_REVIEW.md`
- No user action, admin override, promo code or partner setting can bypass this check
- Client-side copy never uses the word "death" or "complex situation"

## Ask the user
- Which file to add the check to
- Is this a server-side route or a client component?
