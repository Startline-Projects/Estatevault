---
name: add-hard-stop
description: Insert the EstateVault hard-stop check pattern into a route or component. Ensures special-needs and irrevocable-trust conditions always halt document generation identically.
---

Insert the EstateVault hard-stop check into the file the user specifies. This logic is hardcoded and must never be modified or bypassed.

## The two hard-stop conditions (both must always be checked)
1. Client has a dependent with special needs → `hasSpecialNeedsDependent === true`
2. Client indicated an irrevocable trust → `trustType === 'irrevocable'`

## Server-side pattern (API route)

```ts
// Hard-stop check — DO NOT MODIFY
const HARD_STOP_REASONS = {
  specialNeeds: 'This situation requires personalized attorney guidance. We\'ve paused document generation and will connect you with a qualified estate planning attorney.',
  irrevocableTrust: 'Irrevocable trusts require direct attorney involvement. We\'ve paused document generation and will connect you with a qualified estate planning attorney.',
}

function checkHardStop(answers: QuizAnswers): { stop: boolean; reason?: string } {
  if (answers.hasSpecialNeedsDependent) {
    return { stop: true, reason: HARD_STOP_REASONS.specialNeeds }
  }
  if (answers.trustType === 'irrevocable') {
    return { stop: true, reason: HARD_STOP_REASONS.irrevocableTrust }
  }
  return { stop: false }
}

// Usage — call before any document generation logic
const hardStop = checkHardStop(clientAnswers)
if (hardStop.stop) {
  // Log for attorney referral queue
  await supabase.from('attorney_referrals').insert({
    user_id: session.user.id,
    reason: hardStop.reason,
    quiz_answers: clientAnswers,
  })
  return NextResponse.json({ hardStop: true, message: hardStop.reason }, { status: 200 })
}
```

## Client-side pattern (component)

```tsx
if (hardStop) {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-6 text-center">
      <h3 className="font-semibold text-navy text-lg mb-2">
        Let's get you the right help
      </h3>
      <p className="text-charcoal text-sm mb-4">{hardStopMessage}</p>
      <p className="text-xs text-gray-500">
        An estate planning attorney will reach out within 1 business day.
      </p>
    </div>
  )
}
```

## Rules
- Hard-stop check runs BEFORE any document generation — no exceptions
- The reason strings above are final — do not rewrite them
- Always log to `attorney_referrals` table when a hard-stop fires
- No user action, admin override, or partner setting can bypass this check
- Client-side copy never uses the word "death" or "complex situation"

## Ask the user
- Which file to add the check to
- Is this a server-side route or a client component?
