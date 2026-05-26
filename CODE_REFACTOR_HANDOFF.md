# EstateVault Refactor — Handoff & Status

_Living status doc. Open this first if you're picking up the refactor mid-stream. For the **why** + full architecture, read [`CODE_REFACTOR_PLAN.md`](./CODE_REFACTOR_PLAN.md). For known bugs, see [`CODE_AUDIT.md`](./CODE_AUDIT.md)._

**Last updated:** 2026-05-26
**Current branch:** `Amir-Dev`
**Last committed:** `01ec972` (pre-existing feature changes), preceded by `90e75d0` (vault refactor).

---

## 1. TL;DR — where we are right now

The refactor is **partially done**. The **vault** route group is fully converted (Phases 1→2→3) and committed. The **checkout** route group has Phases 0, 1, and 2 done **but not committed** — the changes are sitting in the working tree, deliberately staged for a later commit after Phase 3 + the C-8 fix. **All other groups** are untouched.

A real production bug — **C-8** — was found while testing checkout: the paid-attorney signup writes 4 columns that don't exist on `partners`, plus 2 money values in the wrong unit. Confirmed by manual reproduction (auth user created, profile + partner NOT created, customer paid). **Not fixed yet** — needs a characterization test first.

---

## 2. Status by group

| Group | Phase 0 (tests) | Phase 1 (kernel) | Phase 2 (repos) | Phase 3 (Zod) | Notes |
|---|---|---|---|---|---|
| **vault** | ✅ | ✅ | ✅ | ✅ | **Done + committed** (`90e75d0`). Reference pattern. |
| **checkout** | ✅ | ✅ | ✅ | ⬜ | **Uncommitted in working tree.** C-8 bug also open. |
| webhooks, documents, partner, sales, attorney, crypto, admin, trustee, auth, cron, others | ⬜ | ⬜ | ⬜ | ⬜ | Not started. |

Group counts (route handlers): ~119 total · vault 14 · checkout 9 · remaining ~96.

---

## 3. Uncommitted work in the working tree (checkout)

These files are modified or new and **not yet committed**. Do not lose them.

**New (checkout-specific):**
- `lib/orders/pricing.ts` — pricing SSOT (constants + promo codes)
- `tests/unit/pricing.test.ts` — pins every money value + the calculateSplit invariant
- `lib/repos/server/orderRepo.ts`
- `lib/repos/server/partnerRepo.ts`
- `lib/repos/server/quizSessionRepo.ts`
- `lib/repos/server/affiliateRepo.ts`
- `lib/repos/server/affiliateClickRepo.ts`
- `lib/repos/server/documentRepo.ts`
- `lib/repos/server/profileRepo.ts`
- `lib/repos/server/appSettingsRepo.ts`

**Modified (all 9 checkout routes):**
- `app/api/checkout/will/route.ts`
- `app/api/checkout/trust/route.ts`
- `app/api/checkout/amendment/route.ts`
- `app/api/checkout/vault-subscription/route.ts`
- `app/api/checkout/partner/route.ts`
- `app/api/checkout/attorney/route.ts`
- `app/api/checkout/attorney/verify/route.ts`
- `app/api/checkout/verify/route.ts`
- `app/api/checkout/check-conflict/route.ts`

**Also modified (shared file with vault commit — checkout-related additions):**
- `lib/repos/server/clientRepo.ts` — extra exports `findWithPartnerByProfile`, `findIdAndSubByProfileMaybe`, `create`, `createReturningWithSub`, `setProfileId`. Safe; vault routes don't use them.

**Verify gate is green** with all of the above present: `npx tsc --noEmit && npm run lint && npm test` (94 tests pass as of handoff date).

---

## 4. Immediate next steps (do in this order)

### 4.1 — Commit the checkout work in progress
Before doing anything else, **commit and push** the checkout files above so a teammate can pull and continue without recreating them. Suggested commit message:

```
refactor(checkout): Phases 0-2 — pricing SSOT, withRoute kernel, server repos

Phase 0: lib/orders/pricing.ts + pricing.test.ts pin every price + the
calculateSplit invariant. No routes wired yet (Phase 5).

Phase 1: all 9 checkout routes wrapped in withRoute; 8 inline
createAdminClient copies removed; attorney/verify dropped its
@supabase/supabase-js outlier for the shared SSR admin client.

Phase 2: new server repos for orders/partners/quizSessions/affiliates/
affiliateClicks/documents/profiles/appSettings; clientRepo extended;
every business-table .from() in checkout moved behind a repo. Only
audit_log inserts remain inline (cross-cutting, same policy as vault).

Money lines preserved byte-for-byte. C-8 bug in attorney/verify
intentionally left for a tested fix (see CODE_REFACTOR_HANDOFF.md §5).
```

### 4.2 — Fix C-8 (paid-attorney signup data bug) — **HIGHEST PRIORITY**
Read §5 below for the full picture. Do **all** of:
1. Write `tests/unit/attorney-verify-c8.test.ts` — a characterization test that captures the current broken behavior (writes `user_id`, `300` in cents, etc.).
2. Verify the test fails as expected on the bug.
3. Apply the fix (see §5).
4. Update the test to assert the **correct** behavior — both ends provably changed.
5. Add an error check on the upsert so it can't fail silently again.

### 4.3 — Investigate why the `profiles` upsert also fails
Manual repro showed auth user created but no `profiles` row. The route writes `first_name` / `last_name`; the `profiles` table may only have `full_name`. Run:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' ORDER BY ordinal_position;
```
If `first_name`/`last_name` don't exist, fix `app/api/checkout/attorney/verify/route.ts` to write the columns that do (likely a single `full_name`).

### 4.4 — Finish checkout Phase 3 (Zod)
Add these schemas to `lib/validation/schemas.ts` (append at the end — see §8 collision rules):
- `willCheckoutSchema`, `trustCheckoutSchema`, `amendmentCheckoutSchema`,
- `vaultSubscriptionSchema`, `partnerCheckoutSchema`,
- `attorneyCheckoutSchema`, `attorneyVerifySchema`,
- `verifyQuerySchema`, `checkConflictSchema`.

Wire each route to `safeParse` its body/query at the top of the handler (vault `items` route is the reference). Add unit tests next to `vault-schemas.test.ts`.

### 4.5 — Then commit checkout as fully refactored, and pick the next group
Suggested next groups, money-critical first:
1. **webhooks** (Stripe) — folds in audit C-1 (idempotency)
2. **documents**
3. **partner / sales**
4. attorney, crypto, admin, trustee, auth, cron

Each group goes through the same Phase 1 → 2 → 3.

---

## 5. C-8 — the open critical bug

### Symptom
Paid attorney signup (`POST /api/checkout/attorney/verify`):
- Stripe charges the customer ✅
- `auth.users` row created ✅
- `profiles` row created ❌ (fails silently — see §4.3)
- `partners` row created ❌ (the C-8 upsert itself)
- HTTP response: 500 / "something went wrong" (user sees error after paying)

Confirmed live with Stripe test card on 2026-05-26.

### Root cause — 4 phantom columns + 2 wrong units + bad tier value

The route's `partners.upsert` writes columns that don't exist on `partners`:
| Field written | Reality on `partners` | Fix |
|---|---|---|
| `user_id` | no such column — use **`profile_id`** | rename |
| `stripe_session_id` | no such column | drop (data lives on Stripe) |
| `practice_area` (singular) | only `practice_areas` (array) | rename + wrap in `[]` |
| `years_in_practice` | no such column | drop |
| `custom_review_fee` (integer cents) | route writes dollars (`300`) | multiply by 100 |
| `one_time_fee_amount` (integer cents) | route writes dollars (`session.amount_total / 100`) | keep raw cents |
| `tier: meta.tier` may be `"professional"` | DB CHECK: `('standard','enterprise')` | normalize (audit H-7) |

Because Supabase rejects the entire upsert on unknown columns, no partner row is ever created. The error isn't checked, so the rest of the flow runs and may also fail (email, etc.) → 500.

### Suggested fix (after the characterization test)
```ts
const normalizedTier = tier === "professional" ? "enterprise" : "standard";

const { error: partnerErr } = await partnerRepo.upsert(supabase, {
  profile_id: userId,                          // was user_id
  company_name: firmName || `${firstName} ${lastName} Law`,
  professional_type: "attorney",
  tier: normalizedTier,                        // satisfies CHECK
  status: "pending_verification",
  custom_review_fee: reviewFee * 100,          // dollars → cents
  bar_number: barNumber,
  practice_areas: practiceArea ? [practiceArea] : [],  // singular → array
  one_time_fee_paid: true,
  one_time_fee_amount: session.amount_total,   // already cents
  // years_in_practice + stripe_session_id dropped — no column exists
});
if (partnerErr) {
  console.error("[attorney/verify] partners upsert failed", partnerErr);
  return NextResponse.json({ error: "Failed to create partner record." }, { status: 500 });
}
```

The same `user_id` → `profile_id` mistake appears in `app/api/sales/create-partner/route.ts:117` — fix together while you're in there.

### Backfill needed?
**No.** Confirmed by SQL on 2026-05-26: no orphaned `profiles` with `user_type = 'partner'` and no missing `partners` rows. The bug has been latent — no broken data to repair.

### Cleanup from manual test
A test auth user exists with the developer's real email — delete before re-running:
```sql
DELETE FROM auth.users WHERE email = '<the test email>';
```

---

## 6. Reference pattern (copy from `vault`)

Every route follows this shape:
```
auth (requireAuth / requireClientUser)  →  validate (Zod safeParse)  →
service / domain logic in route  →  ask repo  →  ok() / fail()
```

Wrapped in `withRoute(...)` so any throw becomes a generic `{ error: "internal error" }` 500 + a logged `[route METHOD path]` line.

**Best example to copy:** `app/api/vault/items/route.ts` (full CRUD on the kernel + repos + Zod).

---

## 7. What exists today (catalog)

### Shared kernel (committed)
- `lib/api/route.ts` — `withRoute(handler)`
- `lib/api/response.ts` — `ok(data)`, `fail(message, status, extra?)`
- `lib/api/auth.ts` — `requireAuth`, `createAdminClient`, `UserType`
- `lib/api/crypto.ts` — `requireClientUser` (typed) for vault-style routes

### Server repos (`lib/repos/server/`)
- Committed: `vaultItemRepo`, `trusteeRepo`, `farewellRepo`, `clientRepo` (base set)
- Uncommitted (checkout): `orderRepo`, `partnerRepo`, `quizSessionRepo`, `affiliateRepo`, `affiliateClickRepo`, `documentRepo`, `profileRepo`, `appSettingsRepo`, plus the extra `clientRepo` exports

### Validation (`lib/validation/schemas.ts`)
- Vault: `vaultItemSchema`, `vaultItemSearchSchema`, `trusteeCreateSchema`, `trusteeConfirmSchema`, `farewellCreateSchema`, `farewellUpdateSchema`, `vaultUploadUrlSchema`, `vaultDownloadUrlSchema`
- Existing: `willIntakeSchema`, `trustIntakeSchema`, `quizAnswersSchema`, `affiliateSignupSchema`
- Checkout schemas: **TODO** (see §4.4)

### Pricing
- `lib/orders/pricing.ts` (uncommitted) — `PRICES`, `EV_DEFAULT_CUT`, `PARTNER_PLATFORM_FEE`, `DEFAULT_ATTORNEY_REVIEW_FEE`, `PROMO_CODES`. **Not yet wired** to any route (Phase 5).

### Tests
- `tests/unit/api-kernel.test.ts` — kernel
- `tests/unit/vault-schemas.test.ts` — vault Zod
- `tests/unit/pricing.test.ts` (uncommitted) — pricing SSOT + invariant
- `tests/unit/calculate-split.test.ts`, `stripe-webhooks.test.ts`, `sanity.test.ts` — pre-existing
- `tests/e2e/*` — Playwright suite (needs live test DB)

### Docs
- [`CODE_REFACTOR_PLAN.md`](./CODE_REFACTOR_PLAN.md) — full architecture + phase definitions
- [`CODE_REFACTOR_PLAN.html`](./CODE_REFACTOR_PLAN.html) — styled version
- [`CODE_AUDIT.md`](./CODE_AUDIT.md) — bug audit (C-1…C-8, H-1…H-12, M, L)
- [`CODE_AUDIT.html`](./CODE_AUDIT.html) — styled version
- This file + matching `.html`.

---

## 8. Collision rules (so two devs don't step on each other)

- **One owner per repo file.** Whoever creates `xRepo.ts` owns it. The other dev imports — never recreates. If two groups both need (e.g.) `partnerRepo`, the first to touch it owns it; the other extends it via PR.
- **Schemas append-only.** Add new schemas at the **end** of `lib/validation/schemas.ts`. Don't reorder existing ones — diff stays small + merges cleanly.
- **Never edit a money value during refactor.** Prices, splits, hard-stops are `CLAUDE.md` law. Relocate, don't change.
- **Branch off `Amir-Dev` after the checkout commit lands.** Otherwise the new dev won't see the uncommitted repos and will recreate them.
- **Don't touch checkout files** while the current owner is still on it.
- **Verify gate green** (`tsc + lint + test`) **after every step.** A red gate is a bug you're shipping.

---

## 9. Test commands cheat sheet

```bash
# Fast — re-run anytime (no secrets needed)
npx tsc --noEmit            # type errors across project — must be clean
npm run lint                # eslint on changed code
npm test                    # vitest run (currently 94 tests)

# E2E — needs live test DB (.env.test + seeded)
npm run test:db:reset && npm run test:db:seed
npm run test:e2e -- <spec-name-glob>

# Generate Supabase DB types (when ready — Phase 6 prerequisite)
supabase login && supabase link --project-ref <ref>
npm run db:types
```

Key e2e specs to run after touching:
- vault: `client-dashboard-crud`, `e2ee-smoke`, `farewell-flows`, `trustee-unlock`, `crypto-rotate`
- checkout/webhooks: `stripe-webhooks`, `vault-subscription`, `role-access`, `api-auth-guards`

Manual reproduction for the C-8 bug: see §5 + the test plan that the previous session worked out (signup at `/partners/attorneys/signup?tier=standard`, pay with Stripe test card `4242 4242 4242 4242`, inspect DB — `auth.users` row created, no `profiles`, no `partners`).

---

## 10. Future-pickup-friendly checklist

When you sit down to continue:
1. [ ] Pull latest on `Amir-Dev`. Confirm `90e75d0` and `01ec972` are present.
2. [ ] Run the gate — should be green. If not, something drifted; fix before continuing.
3. [ ] Read this file's §4 — next steps. Skim §5 if you're touching anything money.
4. [ ] If continuing checkout: commit §3 first (see §4.1).
5. [ ] If picking a new group: see §4.5 for suggested order, follow §6's reference pattern, obey §8's collision rules.
6. [ ] After your work: update this file (status table in §2, uncommitted list in §3, what was done) so the next person has the same clean handoff.

---

_This document is the source of truth for "where are we?" — keep it current as work lands._
