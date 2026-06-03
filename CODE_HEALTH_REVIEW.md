# EstateVault — Code Health Review

**Date:** 2026-06-03
**Reviewer:** senior-engineer pass (software-engineer skill, audit mode)
**Method:** mapped the real code — routes, repos, the api-client layer, auth paths, type safety, tests — not the docs. Numbers below come from grepping the actual tree, not from prior progress notes.

> **One-line verdict:** the architecture is sound and it scales. Clean layering, a typed UI→API→repo→DB boundary, near-zero `any`, real test coverage. The B2 migration (screens off direct DB) is now **100% complete** for browser-side calls (commit `3bbbbee`); the remaining work is small drift cleanup — not redesign.

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

### ✅ 3.1 — B2 ("screens off direct DB") — now 100% (fixed 2026-06-03, commit `3bbbbee`)
The first version of this review found ~8 client screens still hitting the DB in the browser (the earlier "B2 done" status had been scoped to only four directories and missed the rest of `app/`). **Those 8 are now all converted.** For the record, they were:

| Screen | Was | Now |
|---|---|---|
| `app/will/page.tsx` · `app/trust/page.tsx` | read `clients` + `quiz_sessions` (intake prefill) | `GET /api/client/quiz-latest` |
| `app/will/success` · `app/trust/success` | read `documents` + storage | unified on the existing `check-status` poll (one path for promo/test/normal) |
| `app/auth/login/page.tsx` | read `profiles`/`clients`/`partners` + `get_partner_login_target` RPC | `GET /api/auth/login-routing` (hosts resolved server-side) |
| `app/pro/training/exam/page.tsx` | read/write `partners` (certification) | `getMe()` + `POST /api/partner/certify` |
| `app/pro/sales/page.tsx` · `app/sales/dashboard/page.tsx` | half-migrated — direct write handlers | `PATCH /api/sales/leads/[id]` + `POST /api/sales/attorney-verification` |

**Result:** no client-component screen runs `supabase.from()`/`.storage`/`.rpc()` in the browser. The only remaining browser Supabase usage is the **realtime channel** in `app/dashboard/documents/page.tsx` (Supabase realtime has no REST equivalent — correct to keep) and `supabase.auth.*` calls (sign-in/out/session — not DB). Verified: tsc clean, 376 unit, lint clean, e2e anon guards for all 5 new endpoints.

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
- **A second frontend (mobile) is now realistic** — `requireAuth` already does Bearer tokens and the api-client layer is the contract a mobile app would reuse. With B2 complete, every screen's data path is a reusable endpoint.

**What would limit scale if left unattended:**
- The inline admin clients (3.2) are *drift seeds* — each one is a template someone copies next time, re-spreading the old pattern. Converging them is what keeps the "one way to do it" property true. (The half-migrated screens that were here have since been finished — 3.1.)
- 148 routes is a lot of surface; the discipline of thin-route/fat-repo is what keeps that surface cheap. It's holding — keep enforcing it (the no-inline-`z.object` and no-`as any` tests help).
- The 805-line webhook is the one place where "scale" means "complexity that's hard to test." Worth decomposing before it grows.

**Net:** this is a mid-stage codebase that has done the hard structural work (layering, types, validation, repos) and is now in the **finish-and-converge** phase, not the redesign phase. That's a healthy place to be.

---

## 5. Recommended next steps (smallest-risk-removed first)

1. ✅ **B2 finished** (3.1) — done in commit `3bbbbee`; all 8 remaining screens converted, browser-check pending on the consumer flow.
2. **Fix the `quizSessionRepo` tsc error** (3.4) — makes the strict gate actually green. ~10 min. *Now the top open item.*
3. **Converge the inline admin clients** (3.2) onto the shared `createAdminClient` + repos, one page at a time.
4. **Migrate the raw-`getUser` routes** onto `requireAuth` (3.3).
5. Later: decompose `webhooks/stripe` behind characterization tests (3.5); decide `custom_review_fee` policy (3.6).

None of these are live bugs today. They're drift-cleanup.

---

## 6. Note on prior docs

The first version of this review (and the `SCALABILITY_PLAN`/`AUDIT` docs) marked B2 as fully done while ~8 client screens were in fact still on direct DB — the original audit was scoped to four directories. **That gap has since been closed** (commit `3bbbbee`): the remaining screens were converted and B2 is now genuinely 100% for browser-side calls. The SCALABILITY docs are accurate again. Kept this section as a record of how the over-claim was caught and fixed — the lesson is that "done" claims should be backed by a whole-tree scan, not a directory subset.
