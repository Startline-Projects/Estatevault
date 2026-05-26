# EstateVault Refactor — Handoff & Status

_Living status doc. Open this first if you're picking up the refactor mid-stream. For the **why** + full architecture, read [`CODE_REFACTOR_PLAN.md`](./CODE_REFACTOR_PLAN.md). For known bugs, see [`CODE_AUDIT.md`](./CODE_AUDIT.md)._

---

## 🚀 First 5 minutes (read this if you're new to the refactor)

**The refactor in one paragraph.** The app has ~119 backend "rooms" (API routes). Most are copy-pasted plumbing — each room hand-rolls its own door (auth), rulebook (input validation), and direct access to the database. We're sweeping them onto one shared layer: a wrapper (`withRoute`) that catches errors cleanly, a server "records department" (`lib/repos/server/*`) that's the only thing allowed to touch each database table, and a rulebook (`lib/validation/schemas.ts` Zod) at the front door so bad input is rejected before it does anything. Vault and checkout are already done — they're your copy templates.

**What's done as of last commit (`0d108df`).**
- **Vault group** (14 routes): fully shipped — kernel, server repos, Zod schemas, tests. Reference example: `app/api/vault/items/route.ts`.
- **Checkout group** (9 routes): fully shipped — same pattern + a real money bug (C-8) found and fixed with a characterization test.

**What's NOT done.** Every other group: webhooks, documents, partner, sales, attorney, crypto, admin, trustee, auth, cron (~96 routes total).

**Your first task** (recommended): take the **`cron` group** — 4 small routes in `app/api/cron/*`. Money-free. Isolated tables. Folds in an audit fix (H-3, fail-closed cron secrets). Smallest possible introduction to the pattern.

**5-minute setup**
```bash
git pull origin Amir-Dev          # latest is 0d108df
npm install                       # if anything new
npx tsc --noEmit                  # expect clean
npm test                          # expect 117 tests green
npm run dev                       # confirm app runs
```
If anything's red, ping the other dev before changing anything.

**The pattern, in 4 lines** (copy from `app/api/vault/items/route.ts`):
```ts
export const POST = withRoute(async (req: NextRequest) => {
  const auth = await requireAuth(["client"], req);
  if ("error" in auth) return auth.error;
  const parsed = mySchema.safeParse(await req.json());
  if (!parsed.success) return fail("invalid input", 400, { details: parsed.error.flatten() });
  const data = await myRepo.doTheThing(auth.admin, parsed.data);
  return ok(data);
});
```
That's it. Auth → validate → repo → reply. Errors caught by `withRoute`. No `try/catch` boilerplate, no raw `.from("table")`, no `any`-typed bodies.

**Five rules that keep us from colliding**
1. **One owner per repo file.** If `xRepo.ts` exists, import it — don't recreate. New repo? You own it. The other dev imports.
2. **Schemas append-only.** Add new Zod schemas at the **bottom** of `lib/validation/schemas.ts`. Never reorder.
3. **Never edit a price, split, or hard-stop value.** They're business law (see `CLAUDE.md`). Relocate, never change.
4. **Verify gate green after every step.** `npx tsc --noEmit && npm run lint && npm test`. Red = stop.
5. **Update this file's §2 + §3 when you wrap a group** so the next person sees current state.

**Heads up on overlaps.** I'm (likely) on **webhooks** next. Stay off `webhooks`, `documents`, `partner`, `sales`, `attorney` for now — they all reuse the checkout repos. Safe picks for parallel work: `cron`, then `auth`, then `trustee`, then `admin`. We sync before tackling the money-overlap groups together.

**When in doubt** read sections §4 (next steps) → §6 (reference pattern) → §8 (collision rules).

---

**Last updated:** 2026-05-27
**Current branch:** `Amir-Dev`
**Last commits (newest first):**
- `6853ffe` docs(handoff): plain-English "First 5 minutes" partner onboarding
- `0d108df` feat(checkout): Phase 3 Zod at boundary + C-8 attorney-verify fix
- `6d89b8a` docs: handoff doc + refactor plan
- `51fdca1` refactor(checkout): kernel + server repos + pricing module
- `01ec972` feat(vault): trustee file access, death-certificate bucket, farewell verify
- `90e75d0` refactor(vault): API kernel + server repos + Zod

**Open work (uncommitted):** none. Working tree is clean.

---

## 1. TL;DR — where we are right now

Two groups are **fully shipped on `Amir-Dev`**: **vault** (Phases 1→3) and **checkout** (Phases 0→3, plus the C-8 attorney-verify data bug fix and its profile sibling). Working tree clean.

What's left: every other group (~96 routes) — webhooks, documents, partner, sales, attorney, crypto, admin, trustee, auth, cron. Each follows the same Phase 1→2→3 sweep, copying vault or checkout as the reference.

A real production bug — **C-8** — was caught while testing checkout (paid-attorney signup wrote 4 phantom columns + 2 money values in the wrong unit). Fixed with a characterization test (`tests/unit/attorney-verify-c8.test.ts`, 13 tests). The profile sibling bug (route was writing `first_name`/`last_name`; `profiles` only has `full_name`) was fixed in the same pass. Both upsert paths now check their error and fail fast — no more silent success.

---

## 2. Status by group

| Group | Phase 0 (tests) | Phase 1 (kernel) | Phase 2 (repos) | Phase 3 (Zod) | Notes |
|---|---|---|---|---|---|
| **vault** | ✅ | ✅ | ✅ | ✅ | Shipped (`90e75d0`). Reference pattern. |
| **checkout** | ✅ | ✅ | ✅ | ✅ | Shipped (`51fdca1` + `0d108df`). C-8 + profile sibling fixed. |
| **webhooks** | ⬜ | ⬜ | ⬜ | ⬜ | Not started. Money-critical — folds in audit C-1 (idempotency), H-1, H-5, H-6. |
| **documents** | ⬜ | ⬜ | ⬜ | ⬜ | Not started. Folds in C-4, C-5. |
| **partner / sales** | ⬜ | ⬜ | ⬜ | ⬜ | Not started. Folds in C-6, C-7, and the same `user_id`→`profile_id` bug at `sales/create-partner/route.ts:117`. |
| **attorney** | ⬜ | ⬜ | ⬜ | ⬜ | Not started. |
| **crypto** | ⬜ | ⬜ | ⬜ | ⬜ | Not started. Folds in C-2, C-3 (DEK AAD + atomic provisioning). |
| **admin / trustee / auth / cron** | ⬜ | ⬜ | ⬜ | ⬜ | Not started. Cron is safest first pick (folds in H-3 fail-closed). |

Group counts (route handlers): ~119 total · vault 14 · checkout 9 · remaining ~96.

---

## 3. Uncommitted work in the working tree

**None.** Last verified gate: `npx tsc --noEmit && npm run lint && npm test` — clean (117 tests pass).

When you start a group, this section is where you list what's in-flight so the other dev can see it. Update before you push.

---

## 4. Immediate next steps (do in this order)

### Done in earlier rounds — kept for history
- 4.1 — Commit checkout WIP — ✅ shipped in `51fdca1`.
- 4.2 — Fix C-8 (paid-attorney signup data bug) — ✅ shipped in `0d108df`. Partners upsert now writes `profile_id`, normalized tier, money in cents, `practice_areas` (array), dropped non-existent columns, error checked.
- 4.3 — Profile sibling bug (`profiles` only has `full_name`) — ✅ shipped in `0d108df`.
- 4.4 — Checkout Phase 3 (Zod) — ✅ shipped in `0d108df`. 9 schemas, every route `safeParse`s body/query at the top.

### 4.5 — Pick the next group (current)
Both vault and checkout are reference patterns now. Pick a group and run Phase 1→2→3 on it. **Coordinate so two devs aren't on overlapping groups.**

Suggested split (money/risk first):

| Owner | Next group | Why |
|---|---|---|
| Lead dev | **`webhooks`** | Highest money risk. Folds in C-1 (Stripe idempotency), H-1 (amendment branch), H-5 (affiliate payout idempotency), H-6 (partner tier elevation). |
| Second dev (if any) | **`cron`** | Safest parallel pick. 4 small routes. No money. Isolated tables. Folds in H-3 (fail-closed cron secrets). |

After those land, sequence the rest: documents → partner / sales (still need joint planning — share repos with checkout) → attorney → crypto → admin → trustee → auth.

### 4.6 — Carry the audit fixes along with the group sweep
| Audit ID | Lands during |
|---|---|
| C-1 webhook idempotency | webhooks |
| C-2 / C-3 DEK fixes | crypto |
| C-4 / C-5 public cron-like routes | documents |
| C-6 / C-7 role gating | partner / sales |
| **C-8 attorney-verify** | **done (`0d108df`)** |
| H-3 cron fail-closed | cron |
| H-4 OTP atomic counter | trustee |
| H-5 affiliate payout idempotency | webhooks |

Each group goes through the same Phase 1 → 2 → 3.

---

## 5. C-8 — fixed (historical record)

> Closed by `0d108df`. Kept for reference — useful when fixing the same `user_id` → `profile_id` mistake in `app/api/sales/create-partner/route.ts:117` during the sales group.

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

### Server repos (`lib/repos/server/`, all committed)
- Vault: `vaultItemRepo`, `trusteeRepo`, `farewellRepo`
- Checkout: `orderRepo`, `partnerRepo`, `quizSessionRepo`, `affiliateRepo`, `affiliateClickRepo`, `documentRepo`, `profileRepo`, `appSettingsRepo`
- Shared: `clientRepo` (used by vault, checkout, and most future groups)

### Validation (`lib/validation/schemas.ts`)
- Vault: `vaultItemSchema`, `vaultItemSearchSchema`, `trusteeCreateSchema`, `trusteeConfirmSchema`, `farewellCreateSchema`, `farewellUpdateSchema`, `vaultUploadUrlSchema`, `vaultDownloadUrlSchema`
- Checkout: `willCheckoutSchema`, `trustCheckoutSchema`, `amendmentCheckoutSchema`, `vaultSubscriptionCheckoutSchema`, `partnerCheckoutSchema`, `attorneyCheckoutSchema`, `attorneyVerifySchema`, `checkoutVerifyQuerySchema`, `checkConflictSchema` (+ shared `intakeAnswersSchema`)
- Pre-existing: `willIntakeSchema`, `trustIntakeSchema`, `quizAnswersSchema`, `affiliateSignupSchema`

### Pricing
- `lib/orders/pricing.ts` — `PRICES`, `EV_DEFAULT_CUT`, `PARTNER_PLATFORM_FEE`, `DEFAULT_ATTORNEY_REVIEW_FEE`, `PROMO_CODES`. **SSOT exists; routes still use inlined values.** Phase 5 of the whole-app sweep wires them.

### Tests
- `tests/unit/api-kernel.test.ts` — kernel
- `tests/unit/vault-schemas.test.ts` — vault Zod
- `tests/unit/pricing.test.ts` — pricing SSOT + calculateSplit invariant
- `tests/unit/checkout-schemas.test.ts` — checkout Zod
- `tests/unit/attorney-verify-c8.test.ts` — C-8 + profile sibling characterization → fix verification
- `tests/unit/calculate-split.test.ts`, `stripe-webhooks.test.ts`, `sanity.test.ts` — pre-existing
- `tests/e2e/*` — Playwright suite (needs live test DB)
- Total: **117 unit tests pass** as of `6853ffe`.

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
