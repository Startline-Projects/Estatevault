# Bug Categories — EstateVault hunting checklists

Walk the checklist for whatever surface is in scope. Each item is a question to
answer against real code. A "yes, and the path is reachable" = a finding.

---

## 1. Money path (checkout → Stripe → webhook → fulfillment)

The highest-trust failures. Customer paid; did they get what they paid for, at the
right price, exactly once?

- **Order/Stripe ordering** — is the DB order row written before or after the Stripe
  session is created? If before and `sessions.create()` throws, do we orphan a
  `pending` order? (BUG-1)
- **Webhook delivery** — what happens if `checkout.session.completed` is missed,
  delayed, or errors mid-handler? Is there reconciliation? Is the handler idempotent
  (replay-safe), or does a retried webhook double-fulfill / double-charge? (BUG-2)
- **Doc-gen failure** — if Claude API errors/times out after payment, does the order
  stay stuck forever with no retry/alert? (BUG-3)
- **Account linking** — on the success page, if profile/auth-user creation fails,
  can the paying customer still log in and reach documents? Idempotent + recoverable? (BUG-4)
- **Orphaned session** — logged-in `userId` with no `profiles` row: does checkout
  self-heal or 500 on FK violation? (BUG-5)
- **Trusted client IDs** — is `userId` taken from the request body instead of the
  verified server session (`requireAuth()` / `getUser()`)? Can an order attach to an
  account the caller doesn't own? (BUG-6)
- **Lost intake** — intake answers in `sessionStorage`: if cleared/expired, does
  checkout dead-end with a 400 instead of redirecting friendly? (BUG-7)
- **Amount integrity** — is the charged amount derived server-side from
  `lib/orders/pricing.ts`, or can the client influence it? Promo codes: can a code
  zero out a price it shouldn't, or be replayed?
- **Currency/rounding** — all money in integer cents? Any float math on amounts?

## 2. Core Rules (business law — any drift is Critical)

Cross-check every number against `lib/orders/pricing.ts` and
`lib/attorney-review/routing.ts`. A bug = another file disagrees with these.

- **Fixed prices** (cents): will 40000, trust 60000, attorney review 30000,
  amendment 5000, vault/yr 9900. Any hardcoded price elsewhere that differs?
- **Revenue splits** (partner take): standard will 30000 / trust 40000;
  enterprise will 35000 / trust 45000. Does any split math or display contradict
  `PARTNER_SPLITS`? Do ev + partner always sum to the full price?
- **Attorney review = $300, 100% to attorney** — `custom_review_fee` must only apply
  for an attorney partner with an in-house reviewer; ignored otherwise (the 3.6
  invariant). Can a forged value override it?
- **Partner self-update** — can a partner PATCH set financial flags
  (`one_time_fee_paid`, `platform_fee_amount`, `tier`, `partner_revenue_pct`)? The
  schema must strip them.
- **Hard stops** — special-needs dependent and irrevocable trust must halt generation
  → attorney referral, hardcoded, no override. Is the stop reachable around (skipped
  step, alternate route, client flag)?
- **Acknowledgment gate** — can a document generate before the client signs the
  acknowledgment? Any path that reaches doc-gen without it?
- **No legal advice** — quiz/result copy must say "Based on your answers…", never
  "We recommend…". Grep for recommendation language in result/quiz components.

## 3. Vault & crypto

- **PIN/access** — can the vault be opened without the correct PIN? Retry/lockout?
  Is the PIN compared in constant time / handled so it can't leak?
- **Encryption** — is data encrypted before storage? Key handling sound? Check
  `lib/crypto/` against its `__tests__` and crypto vectors
  (`npm run crypto:vectors:check`).
- **Access control** — can user A read user B's vault items? Does the query scope to
  the authenticated user, or rely only on client-side filtering?
- **Data loss** — any path that overwrites/deletes vault content without confirm or
  without it being recoverable?

## 4. Auth & ownership

- Server session vs. client-supplied identity — anywhere trusting body/query over
  `getUser()`?
- RLS assumptions — does code assume the DB enforces a scope that RLS may not?
- Redirect/role checks — can a client reach a pro/sales/admin route? Middleware gaps?
- Session lifecycle — note: `signOut({scope:'local'})` still kills the current
  session; don't pre-signout before a token handoff.

## 5. Validation boundary (`lib/validation/schemas.ts`)

- Does every API route parse its body/params with Zod before use?
- Are nullable/optional fields that should be required actually loose? (BUG-6 was a
  `z.string().nullable().optional()` on `userId`.)
- Numeric bounds — can a negative/huge quantity, fee, or page slip through?
- Does parsing happen at the edge, or after the data already touched the DB?

## 6. Async / state / general correctness

- **Race conditions** — concurrent requests on the same order/profile; double-submit
  on a pay button; webhook + success-page both linking the account.
- **Unhandled promise rejection / missing await** — fire-and-forget DB writes whose
  failure is silently swallowed.
- **Error swallowing** — `catch {}` that hides a real failure; 200 returned on a
  partial failure.
- **Null/undefined** — optional DB fields dereferenced without a guard.
- **Off-by-one / boundary** — pagination, retry counts, expiry comparisons
  (`<` vs `<=`).

---

## Useful commands

- `npm test` — run vitest unit/integration suite (see what's already covered).
- `npm run test:e2e` — Playwright end-to-end.
- `npm run crypto:vectors:check` — verify crypto vectors unchanged.
- `npx tsc --noEmit` / `npm run lint` — type + lint (catches a class of real bugs).
- Grep the codebase for hardcoded prices to catch drift from `pricing.ts`:
  `grep -rn -E "40000|60000|30000|\\$400|\\$600" app lib components`
