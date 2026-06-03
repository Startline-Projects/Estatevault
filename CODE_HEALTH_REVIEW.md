# EstateVault — Code Health Review

**Date:** 2026-06-03
**Reviewer:** senior-engineer pass (software-engineer skill, audit mode)
**Method:** mapped the real code — routes, repos, the api-client layer, auth paths, type safety, tests — not the docs. Numbers below come from grepping the actual tree, not from prior progress notes.

> **One-line verdict:** the architecture is sound and it scales. Clean layering, a typed UI→API→repo→DB boundary, near-zero `any`, real test coverage. The remaining work is **finishing** a migration that's ~85% done and cleaning up a few drift pockets — not redesign. Two earlier claims were over-stated and are corrected here.

---

## 1. The shape of the codebase (by the numbers)

| Thing | Count | Read |
|---|---|---|
| API routes (`app/api/**/route.ts`) | 148 | Lots of surface, but thin handlers |
| Server repos (`lib/repos/server/*Repo.ts`) | 21 | DB access is centralized here |
| api-client modules (`lib/api-client/*.ts`) | 15 | Typed wrappers the screens call |
| Page screens (`app/**/page.tsx`) | 112 | |
| Components | 60 | One per file |
| Zod schemas (`lib/validation/schemas.ts`) | 76 exported | Real boundary validation |
| Migrations (`supabase/migrations/`) | 55 | Dated, RLS-enabled |
| Unit test files / e2e specs | 23 / 24 | 376 unit tests pass |

The intended layering — **UI → api-client → API route (auth + Zod) → repo → DB** — is real and followed by the large majority of the app. That's the thing that makes a codebase scale: one place to change DB access, one place for auth, one place for validation.

---

## 2. What's genuinely strong

- **Type safety is excellent for a project this size.** Across all of `lib/` + `app/`: **7** `any`/`as any` total, **0** `@ts-ignore`/`@ts-expect-error`. TypeScript strict is doing its job — runtime surprises have few places to hide.
- **Thin routes, fat repos** is the norm. A typical route reads top-to-bottom in ~15 lines: `requireAuth` → `safeParse` → call a repo → `ok()`. DB chains live in `lib/repos/server/*`, not inline.
- **Auth is layered and (mostly) intentional**, not ad-hoc:
  - `requireAuth(roles?, req)` — 77 routes (cookie + mobile Bearer)
  - `requireClientUser` — 13 routes (vault/crypto, client-scoped)
  - `requireTrusteeSession` — trustee vault access (separate OTP-based identity)
  - `CRON_SECRET` bearer — 6 cron routes
  - Stripe webhook signature — the webhook route
  Most "no-`requireAuth`" routes are correctly guarded by one of the above, or are legitimately public (pre-account checkout, auth/signup, branding).
- **Money stays integer cents**, fixed prices/splits are honored, hard stops are present. Business law intact.
- **Validation at the boundary** is widely adopted — 76 central Zod schemas, and a unit test forbids inline `z.object()` in routes.
- **Real test coverage** on the dangerous parts (crypto, splits, idempotency) plus 24 e2e specs including B2 endpoint guards.

---

## 3. What's NOT done / fragile (ranked by risk)

### 🔴 3.1 — B2 ("screens off direct DB") is ~85% done, not 100%
This review found **~8 client-component screens still query the database directly in the browser** — the earlier "B2 done" status was scoped to only four directories (`pro/`, `sales/`, `attorney/`, `dashboard/`) and missed the rest of `app/`.

Still on direct browser `supabase.from()`:

| Screen | What it does directly | Why it matters |
|---|---|---|
| `app/will/page.tsx` | reads `clients`, `quiz_sessions` (intake prefill) | **consumer money flow** |
| `app/trust/page.tsx` | reads `clients`, `quiz_sessions` | **consumer money flow** |
| `app/will/success/page.tsx` | reads `documents` + storage | post-checkout, security-sensitive |
| `app/trust/success/page.tsx` | reads `documents` + storage | post-checkout, security-sensitive |
| `app/auth/login/page.tsx` | reads `profiles`, `clients`, `partners` (post-login routing) | auth path |
| `app/pro/training/exam/page.tsx` | reads/writes `partners` (certification) | unlocks platform features |
| `app/pro/sales/page.tsx` | **partial** — reads converted, action handlers (`handleMarkContacted`, `handleActivateAttorney`) still write `professional_leads`/`partners` directly | half-migrated |
| `app/sales/dashboard/page.tsx` | **partial** — same shape | half-migrated |

**Blast radius:** same as the rest of B2 — business rules in the screen, no server backstop beyond RLS, not reusable by a mobile app. The consumer will/trust flow is the most important one left because it's the revenue path.
**Half-migrated is the worst state** — `pro/sales/page` and `sales/dashboard` have converted reads but direct writes, so the pattern is inconsistent within one file.

### 🟠 3.2 — Inline admin clients re-duplicated in ~8 places (B1 "67→0" has exceptions)
These define their **own** `createAdminClient()` with `SUPABASE_SERVICE_ROLE_KEY` and query the DB directly, bypassing the shared `lib/api/auth.ts` client and the repo layer:

```
app/affiliate/page.tsx
app/sales/affiliates/page.tsx
app/sales/affiliates/[id]/page.tsx
app/[partner-slug]/page.tsx
app/[partner-slug]/vault/page.tsx
app/dashboard/layout.tsx
app/a/[code]/route.ts
lib/documents/storage.ts · lib/marketing/admin-auth.ts (lib-level, more defensible)
```

These are **server** components/routes (no browser key leak), so it's a consistency/maintainability issue, not an exposure. But it's the exact "same concept implemented N ways" drift the architecture was trying to kill — change the admin-client setup once and these 8 don't follow.

### 🟠 3.3 — Auth drift: a few routes hand-roll `getUser()` instead of `requireAuth`
e.g. `app/api/marketing/materials/route.ts` does raw `supabase.auth.getUser()` + manual 401 rather than `requireAuth`. Functionally fine today; it's drift from the canonical guard and won't pick up future changes to `requireAuth` (e.g. mobile Bearer support).

### 🟡 3.4 — The strict typecheck gate is not actually green
`lib/repos/server/quizSessionRepo.ts` has a pre-existing `tsc` error (`Record<string, unknown>` passed to a typed `.insert()`). It predates the B2 work and was left untouched, but it means `npx tsc --noEmit` is **not** clean — the bug gate the project relies on is one error short of green. Cheap to fix (type the insert like `attorneyReviewRepo` was).

### 🟡 3.5 — `webhooks/stripe/route.ts` is 805 lines
The single biggest, highest-risk file (it moves money and provisions accounts). Not broken, but fat enough that a change is hard to reason about. Candidate for extracting per-event handlers into `lib/` — carefully, with characterization tests first.

### 🟡 3.6 — `custom_review_fee` is partner-editable
It's in the partner self-update whitelist (`partnerSelfUpdateSchema`). It's the attorney-partner's own in-house review fee (they keep 100%), so it's arguably theirs to set — but it sits next to the fixed-pricing rule. Decide explicitly: lock it server-side, or document it as intentionally partner-owned.

---

## 4. Is it scalable?

**Architecturally, yes.** The properties that let a codebase grow without getting more fragile are present:

- **A single data-access layer.** 21 repos; the DB schema can change in one place. ✅
- **An enforced input boundary.** 76 Zod schemas; client input is parsed, not trusted. ✅
- **Centralized auth** with a clear (if multi-path) set of guards. ✅
- **Strong types** so refactors are caught at compile time, not in production. ✅
- **A second frontend (mobile) is now realistic** — `requireAuth` already does Bearer tokens and the api-client layer is the contract a mobile app would reuse. The ~8 unconverted screens are the only piece that wouldn't port.

**What would limit scale if left unattended:**
- The half-migrated screens (3.1) and inline admin clients (3.2) are *drift seeds* — each one is a template someone copies next time, re-spreading the old pattern. Converging them is what keeps the "one way to do it" property true.
- 148 routes is a lot of surface; the discipline of thin-route/fat-repo is what keeps that surface cheap. It's holding — keep enforcing it (the no-inline-`z.object` and no-`as any` tests help).
- The 805-line webhook is the one place where "scale" means "complexity that's hard to test." Worth decomposing before it grows.

**Net:** this is a mid-stage codebase that has done the hard structural work (layering, types, validation, repos) and is now in the **finish-and-converge** phase, not the redesign phase. That's a healthy place to be.

---

## 5. Recommended next steps (smallest-risk-removed first)

1. **Fix the `quizSessionRepo` tsc error** (3.4) — makes the strict gate actually green. ~10 min.
2. **Finish the partial screens** `pro/sales/page` + `sales/dashboard` (3.1) — convert the lingering write handlers so no file is half-migrated. Highest consistency payoff.
3. **Convert the consumer flow** `will/`, `trust/`, and their `success/` pages (3.1) — the revenue path; do it with a browser check each.
4. **Converge the inline admin clients** (3.2) onto the shared `createAdminClient` + repos, one page at a time.
5. **Then** correct the B2 status in `SCALABILITY_PLAN`/`AUDIT` to "≈85% — N screens left" (see §6).
6. Later: decompose `webhooks/stripe` behind characterization tests (3.5); decide `custom_review_fee` policy (3.6); migrate the raw-`getUser` routes onto `requireAuth` (3.3).

None of these are live bugs today. They're completion + drift-cleanup.

---

## 6. Correction to prior docs

The `SCALABILITY_PLAN.md/.html` and `SCALABILITY_AUDIT.html` updates from earlier today mark B2 as **fully done**. This review shows that's **over-stated** — it was true for the four portal directories audited, but ~8 client screens outside them (the consumer will/trust flow, auth/login, training exam, and two half-migrated sales screens) still call the DB directly. Those docs should be corrected to "≈85% complete — consumer flow + auth + exam remain." Flagging rather than silently editing, since the prior status was committed.
