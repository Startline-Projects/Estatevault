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

### ✅ 3.2 — Inline admin clients converged (fixed 2026-06-03, commit `4218d94`)
Ten files used to define their **own** `createAdminClient()` with `SUPABASE_SERVICE_ROLE_KEY`, bypassing the shared `lib/api/auth.ts` client. **All now import the shared one** — single source of truth, and it's typed `<Database>`.

Files converged: `app/affiliate`, `app/sales/affiliates` (+`[id]`), `app/a/[code]`, `app/dashboard/layout`, `app/[partner-slug]` (+`/vault`), `app/api/professionals/request-access`, `lib/documents/storage`, `lib/marketing/admin-auth` (re-exports for its callers).

**Bonus:** the typed shared client surfaced several **latent null-safety bugs** the untyped copies were hiding — all fixed properly (no casts): `request-access` was inserting number/array values into string columns (`client_count`, `practice_areas`, `desired_review_fee`); the affiliate admin pages mapped nullable `status`/`created_at`/`affiliate_id` into non-null component props; the marketing materials PATCH typed its update object. Verified: tsc clean, 376 unit, lint clean. **0 inline SERVICE_ROLE admin clients remain.**

### ✅ 3.3 — Auth drift on the marketing routes fixed (2026-06-03, commit `e2e4938`)
The 4 marketing asset routes (`materials`, `flyer`, `one-pager`, `script-card`) hand-rolled `createClient().auth.getUser()` + a manual 401. They now use `requireAuth(undefined, req)` — same "any logged-in user" semantics, but gains mobile Bearer support, a consistent 401, and follows future `requireAuth` changes.

**Of the original ~10 raw-`getUser` routes, the rest were deliberately left** (they are *not* drift):
- `checkout/{partner,amendment,vault-subscription}` — guest-capable purchase flows; `user` is optional, so `requireAuth` would wrongly block pre-account checkout.
- `documents/download-by-session` — authenticated by a **Stripe session token**, not a user session.
- `auth/welcome` — needs the raw `user.user_metadata`, which `requireAuth`'s profile shape doesn't expose.
- `share` — an E2EE-vault feature (uses `getMyClient` + rate limiting). Convertible, but it's a `requireAuth` vs `requireClientUser` judgment call — parked as a small standalone decision rather than risk the crypto path.

### ✅ 3.4 — The strict typecheck gate is now green (fixed 2026-06-03, commit `475ef72`)
`lib/repos/server/quizSessionRepo.ts` took `row: Record<string, unknown>`, which the typed Supabase client rejected — the one error keeping `npx tsc --noEmit` red. Typed `row` as the table's Insert shape (same fix pattern as `attorneyReviewRepo`). That surfaced a real caller hole in `createCheckoutSession` (an `answers` object the `Json` column couldn't accept), fixed with the existing `as Json` boundary convention. **`tsc --noEmit` now reports zero errors** — the bug gate is trustworthy for the first time.

### ✅ 3.5 — `webhooks/stripe` split into a thin router + handlers (fixed 2026-06-03, commit `98368ae`)
The webhook was an 805-line file that moved money and provisioned accounts (one handler ~320 lines). The per-product handlers were **extracted verbatim** into `lib/webhooks/stripe/*` (`resolveOrCreateGuestClient`, `handleAttorneyReview`, `handleAmendmentCheckout`, `handleVaultSubscriptionCheckout`, `handleDocumentCheckout` + a shared `Admin` type). Behaviour is preserved by construction — byte-identical moves, proven by tsc + the full suite (no logic changed).

`app/api/webhooks/stripe/route.ts` is now a **156-line router**: verify signature → idempotency guard → dispatch by `event.type` → call the lib handler. The short inline events (`invoice.*`, `subscription.deleted`, `partner_platform_fee`) stay in the router. Each heavy handler is now independently importable + testable. The `phase0-security` guard was extended so the no-`listUsers()` check and the `find_auth_user_by_email` RPC assertion follow the code into the new handlers.

**Recommended follow-up (not blocking):** now that the handlers are isolated, add event-simulation characterization tests (mock a `checkout.session.completed` → assert the order/split/documents/payout writes) for deeper safety on future changes. Cheap to do per-handler now; was impractical when it was one 805-line function.

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
- Drift seeds (a template someone copies next time, re-spreading an old pattern) are what erode the "one way to do it" property. The two biggest pools — the half-migrated screens (3.1) and the inline admin clients (3.2) — have both since been converged.
- 148 routes is a lot of surface; the discipline of thin-route/fat-repo is what keeps that surface cheap. It's holding — keep enforcing it (the no-inline-`z.object` and no-`as any` tests help).
- The Stripe webhook used to be the one place where "scale" meant "complexity that's hard to test" — now decomposed into a thin router + isolated handlers (3.5), so each piece is testable in isolation.

**Net:** this is a mid-stage codebase that has done the hard structural work (layering, types, validation, repos) and is now in the **finish-and-converge** phase, not the redesign phase. That's a healthy place to be.

---

## 5. Recommended next steps (smallest-risk-removed first)

1. ✅ **B2 finished** (3.1) — commit `3bbbbee`; all 8 remaining screens converted.
2. ✅ **Inline admin clients converged** (3.2) — commit `4218d94`; 0 left, plus several null-safety bugs fixed.
3. ✅ **Marketing routes onto `requireAuth`** (3.3) — commit `e2e4938`; the rest left as intentional non-drift.
4. ✅ **`quizSessionRepo` tsc error fixed** (3.4) — commit `475ef72`; `tsc --noEmit` is now fully green.
5. ✅ **`webhooks/stripe` decomposed** (3.5) — commit `98368ae`; 805 → 156-line router + isolated handlers.
6. **Decide `custom_review_fee` policy** (3.6) — a one-line call: lock server-side, or keep partner-editable? *Last open item.*
7. Optional: event-simulation characterization tests for the stripe handlers (3.5 follow-up); settle `share`'s guard (3.3).

None of these are live bugs today. They're drift-cleanup.

---

## 6. Note on prior docs

The first version of this review (and the `SCALABILITY_PLAN`/`AUDIT` docs) marked B2 as fully done while ~8 client screens were in fact still on direct DB — the original audit was scoped to four directories. **That gap has since been closed** (commit `3bbbbee`): the remaining screens were converted and B2 is now genuinely 100% for browser-side calls. The SCALABILITY docs are accurate again. Kept this section as a record of how the over-claim was caught and fixed — the lesson is that "done" claims should be backed by a whole-tree scan, not a directory subset.
