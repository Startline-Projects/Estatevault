# EstateVault — Structured Refactor Plan (Architecture & Scalability)

> 📌 **Picking up mid-stream?** Open [`CODE_REFACTOR_HANDOFF.md`](./CODE_REFACTOR_HANDOFF.md) first — that's the live status (what's committed, what's uncommitted, where to continue, open bugs). This plan covers the **architecture and phases**; the handoff covers **where we are right now**.

_Generated 2026-05-25 from a direct full-codebase analysis (API route layer, `lib/`, data layer, migrations, frontend, config). This plan is **not** derived from `CODE_AUDIT.md`; the audit is a separate bug list. This document is about **structure**: stop re-defining the same plumbing in every route/component, establish clear layers, and make the codebase scalable. No files were modified._

---

## 1. The core problem (measured, from the code)

The codebase has good building blocks that **never propagated**. The same concern is re-implemented dozens of times instead of being called from one place. Concrete measurements:

| Concern | Canonical thing that exists | Reality across the codebase |
|---|---|---|
| Auth gate | `requireAuth()` in `lib/api/auth.ts` (handles Bearer + cookie + role gating) | **16 / 119 routes** use it. 57 call `supabase.auth.getUser()` raw; 13 use `requireClientUser`. |
| Service-role client | `createAdminClient()` exported from `lib/api/auth.ts` | **Re-declared inline in 64 routes.** Only 5 import the shared one. |
| Data access | `lib/repos/*Repo.ts` (8 repos) | **0 routes use them** — repos are client-side only. Routes run **581 inline `.from("table")` queries**. |
| Input validation | `lib/validation/schemas.ts` (Zod) | **1 route** imports it; 8 inline `z.object`; 62 hand-roll `request.json()` + `if (!x)`. |
| Client → server calls | `lib/api/authedFetch.ts` (401 refresh wrapper) | **Unused.** Components copy-paste raw `fetch()` + manual `try/catch` + ad-hoc error state. |
| Prices / promo codes | `calculateSplit()` in `lib/stripe-payouts.ts` (splits only) | Prices inlined in ~15 routes; promo codes redefined per-route (`VALID_PROMO_CODES` in 3+ files). |
| Byte encoding | `byteaToBytes`/`bytesToBytea` in `lib/api/crypto.ts` | **7 separate copies** of b64/bytea helpers across repos and security utils. |
| DB types | — | No generated Supabase types. Types redefined ad hoc per route/repo. |
| Return types | convention: `Promise<NextResponse>` | **0 handlers** declare one. |

**Consequence (why it doesn't scale):** every new route re-writes auth + admin client + validation + error handling + a raw query. Every new component re-writes fetch + error handling. A change to any cross-cutting rule (auth, RLS, error format, a price) must be hand-applied in 50+ places and silently rots where it's missed. This *is* the "APIs defined everywhere" problem.

---

## 2. Target architecture (layers, one responsibility each)

The goal is a thin, repeatable request pipeline where each layer is written **once** and reused. New features compose these layers instead of re-implementing them.

```
                          ┌──────────────────────────────────────────┐
  Browser / Mobile  ──►   │  Typed API client  (lib/api-client/*)      │   ← one fetch wrapper,
                          │  authedFetch + typed endpoints + envelope  │     typed responses,
                          └───────────────────┬──────────────────────┘     401 refresh, 1 error shape
                                              │
                          ┌───────────────────▼──────────────────────┐
  app/api/**/route.ts ─►  │  Route handler (THIN)                      │
                          │  withRoute(): auth → validate → call svc   │   ← no inline admin client,
                          │  → shape response. Promise<NextResponse>.  │     no inline query, no z inline
                          └───────────────────┬──────────────────────┘
                          ┌───────────────────▼──────────────────────┐
                          │  Service / domain layer (lib/<domain>)     │   ← business rules:
                          │  vault, checkout, trustee, partner, ...    │     pricing, splits, hard stops
                          └───────────────────┬──────────────────────┘
                          ┌───────────────────▼──────────────────────┐
                          │  Server repos (lib/repos/server/*)         │   ← the ONLY place that
                          │  all .from("table") lives here             │     touches Supabase tables
                          └───────────────────┬──────────────────────┘
                          ┌───────────────────▼──────────────────────┐
                          │  Supabase (Postgres + RLS)                 │
                          └────────────────────────────────────────────┘

  Shared kernel (used by every layer): lib/api/auth.ts (requireAuth, createAdminClient),
  lib/validation/schemas.ts (Zod registry), lib/crypto/encoding.ts (one b64/bytea),
  lib/orders/pricing.ts (prices + promo SSOT), types/db.generated.ts (DB types).
```

### Design principles (the rules that keep it scalable)
1. **One way to do each thing.** A route never re-declares auth, an admin client, validation, or a query. It calls the shared layer.
2. **Thin routes, fat services, single data layer.** Tables are touched only in `lib/repos`. Business rules live in `lib/<domain>`. Routes orchestrate.
3. **Validate at the boundary, type through the stack.** Every body/query parsed by a named Zod schema; generated DB types flow up so a column rename breaks the build, not production.
4. **One client transport.** Components call a typed API client, never raw `fetch`. One place owns auth refresh + error envelope.
5. **Single source of truth for money and config.** Prices, promo codes, splits live in one module. Never inlined.
6. **Make wrong code not compile / not lint.** Enforce the above with ESLint-error rules + `Promise<NextResponse>` return types + CI, so drift can't re-accumulate.
7. **Never touch pricing/split/hard-stop business values under "cleanup"** — relocate them, don't change them (`CLAUDE.md` law).

---

## 3. Phased plan

Each phase is independently shippable and gated by `npx tsc --noEmit && npm run lint && npm test`. Order is chosen so foundations land before the mass migrations that depend on them. The big sweeps (Phase 2, 5) are done **route-group by route-group**, not all at once.

### Phase 0 — Safety net (do first)
Pin behavior on the seams the later phases will move, so refactors can't silently change them.
- Generate Supabase types: `supabase gen types typescript > types/db.generated.ts` (wire an `npm run db:types` script). Foundation for every typed layer below.
- Add characterization tests around the highest-traffic flows that Phase 2 will refactor: vault items CRUD, checkout → webhook, trustee unlock. (vitest + the existing Playwright e2e already cover some — fill gaps.)
- **Payoff:** later phases prove they preserved behavior. **Verify:** types compile; new tests green.

### Phase 1 — Establish the shared kernel
Build/clean the single implementations everything else will call. Small, low-risk, no mass migration yet.
- **`lib/api/route.ts` — a `withRoute()` wrapper.** Wraps a handler with: try/catch (logs `console.error('[route]', e)`, returns generic `{ error }`), enforced `Promise<NextResponse>`, and a hook for auth + Zod parse. This becomes the standard handler shape. Model its ergonomics on the existing `requireAuth` return contract.
- **Confirm `requireAuth` is the only auth path** and `createAdminClient` the only admin client (both already in `lib/api/auth.ts`). Make `UserType` the single source of truth — add the real DB role strings so role gating can't silently 403 (the code stores roles the enum doesn't list).
- **`lib/api/response.ts`** — one helper set: `ok(data)`, `fail(message, status)`. Defines the response envelope the typed client will consume.
- **`lib/crypto/encoding.ts`** — consolidate the 7 b64/bytea copies into one module; re-export the server canonical (`byteaToBytes`/`bytesToBytea`). Migrate the 7 call sites.
- **`lib/orders/pricing.ts`** — export `PRICES` (cents) and a `PROMO_CODES` registry; move the ~15 inlined prices and per-route promo tables here. **Do not change any value** — `calculateSplit` stays the source of truth for splits; this is the source of truth for prices/promos.
- **Payoff:** the toolkit exists; from here, migrating a route *removes* code. **Verify:** full gate; existing tests + a new pricing test.

### Phase 2 — Server data-access layer (the biggest scalability win)
Today 581 `.from()` calls live inside routes. Move them behind server repos so tables are touched in exactly one layer.
- Create `lib/repos/server/` (or extend existing repos with server-safe entry points — note current repos are client-only and import worker/browser code, so a server-side split is required).
- For each route group (start: `vault`, then `checkout`, `documents`, `partner`, `sales`, `trustee`, `admin`), extract its inline queries into typed repo functions returning generated DB types. Route becomes: `withRoute` → `requireAuth` → Zod parse → `repo.x()` → `ok()`.
- Bake ownership scoping into the repo writes (`.eq("client_id", …)` etc.) so authorization is structural, not per-route.
- **Payoff:** a schema/RLS/ownership change is one repo edit, not 50 route edits; routes shrink ~60–70%. **Verify:** gate per group; the Phase-0 characterization tests prove parity.

### Phase 3 — Validation at every boundary
Make untrusted input parse through a named schema.
- Grow `lib/validation/schemas.ts` into a per-domain registry: add `vaultItemSchema`, `trusteeSchema`, `farewellSchema`, `checkoutSchema`, `partnerClientSchema`, amendment, etc. (use the `new-zod-schema` skill).
- Wire `withRoute` to `safeParse` the body/query and reject early with the standard envelope. Reconcile the duplicate `WillIntake` interface vs `willIntakeSchema` into one inferred type.
- **Payoff:** no route trusts client shape; one validation style. **Verify:** gate; schema unit tests.

### Phase 4 — One typed client transport (kills "fetch everywhere")
Stop components re-implementing fetch + error handling.
- **`lib/api-client/`** — a typed client built on the existing `authedFetch` (401 refresh): functions per endpoint returning typed data from the response envelope, throwing a single `ApiError` type. Optionally generate hooks for React Query-style usage, or thin `useX` wrappers.
- Migrate components/pages off raw `fetch("/api/…")` onto the client, group by group. Adopt consistent loading/error/success via a small shared async-state hook.
- **Payoff:** components drop ~20–30% boilerplate; auth refresh + error format owned in one place; renaming a route updates one client function. **Verify:** gate; smoke the migrated pages.

### Phase 5 — Single-source config cleanup (finishes Phase 1's SSOT)
- Replace every remaining inlined price/promo with imports from `lib/orders/pricing.ts`.
- Tighten `calculateSplit(productType: ProductType)` to a union (no silent all-zeros on a typo).
- **Payoff:** price/promo change = one edit. **Verify:** gate; split + pricing tests.

### Phase 6 — Type system hardening
- Flow `types/db.generated.ts` through repos and services; remove ad-hoc per-route row types.
- Add explicit `Promise<NextResponse>` to all handlers (now trivial via `withRoute`).
- Remove the stray `as any` CSS-var casts with a typed style helper.
- **Payoff:** a column/enum change fails the build. **Verify:** `tsc` green with stricter types.

### Phase 7 — Migration lineage baseline
- Squash the 18 legacy `migration-*.sql` + `database.sql` monolith into one timestamped baseline (`00000000000000_baseline.sql`); keep only the 28 dated migrations after it. Remove the dual-system ordering hazard.
- **Payoff:** reproducible rebuilds; no lexical-order landmine. **Verify:** apply to a fresh test DB (`npm test:db:reset`).

### Phase 8 — Lock it in (prevent re-drift)
- Promote the ESLint rules from `warn` to `error`: ban raw `fetch("/api/…")` in components, ban inline `createAdminClient`, ban `.from()` outside `lib/repos`, require `requireAuth` in routes.
- Add a CI step running the gate on every PR.
- Update the stale scaffolding docs (`new-api-route.md`, `code-style.md`, `app/CLAUDE.md` which still says `/lib/db` and "Phase 1") to describe the layers above, and refresh `references/conventions.md`.
- **Payoff:** the architecture is now the path of least resistance; drift can't silently return.

---

## 4. Will this break functionality? (risk & safety — read before starting)

**Honest answer: no refactor of this size is zero-risk.** The plan is built to keep risk low and *catchable before shipping* — but the safety lives in the discipline, not the document. Specifics:

### It is mostly behavior-preserving — with deliberate exceptions
The intent is to move code, not change what it does. But a few steps **intentionally change behavior because the current behavior is buggy**:
- Phase 1: `UserType` gains the real DB role strings → role gating starts matching where it silently failed.
- Phase 2: ownership scoping baked into repo writes → loosely-scoped writes get tighter.

These are fixes, not regressions. So the honest claim is **"no unintended loss of working features,"** not "no change at all."

### Risk is not uniform
| Phase | Risk | Why |
|---|---|---|
| 0 (types+tests), 5 (pricing move), 8 (lint/CI) | Low | additive or mechanical; no value changes |
| 1 (kernel), 3 (zod), 6 (types) | Low–Med | new code; old code keeps working until switched over |
| 7 (migration squash) | Med | rebuild correctness — test on a fresh DB |
| **2 (server repos, 581 queries), 4 (typed-client fetch sweep)** | **Highest** | most surface touched; subtle bugs hide here |

### What keeps it safe
- Characterization tests **first** (Phase 0) — prove a flow behaves the same before/after.
- Per-group migration, never big-bang — a mistake breaks one group, not the app.
- Verify gate (`tsc + lint + test`) green before each next step.
- No pricing / split / hard-stop **value** edits.

### Gaps you must respect (where it CAN bite)
- **The gate won't catch everything.** Stripe webhooks, Supabase RLS, auth cookies, crypto/DEK, and trustee access need **live secrets** → verify with Playwright e2e + a manual run, not just `tsc/lint/unit`.
- **Characterization tests only protect what they cover.** Thin coverage = thin safety; the money, crypto, and auth flows need real tests *before* Phase 2 touches them.
- **Crypto/DEK and money paths are the danger zone** — a structural slip there is silent data loss or mis-pay, not a loud crash. Treat those route groups last and with the most test coverage.

### Bottom line
Done as written — small steps, tests first, per-group, gate each step, verify money/crypto/auth flows live — the chance of breaking working functionality is **low and catchable before shipping.** Skip those steps and it becomes **high.**

---

## 5. Sequencing & effort

| Phase | Theme | Risk | Rough size |
|---|---|---|---|
| 0 | Types codegen + characterization tests | Low | S |
| 1 | Shared kernel (`withRoute`, response, encoding, pricing SSOT) | Low | M |
| 2 | Server repos + thin routes (per group) | Med | L (largest) |
| 3 | Zod at boundary | Low | M |
| 4 | Typed API client; kill scattered fetch | Med | L |
| 5 | Price/promo SSOT finish | Low | S |
| 6 | DB types through stack + return types | Low | M |
| 7 | Migration baseline squash | Med | M |
| 8 | ESLint-error + CI + doc fixes | Low | S |

**Recommended first slice:** Phase 0 → Phase 1 → Phase 2 for the `vault` group only. That proves the full pipeline end-to-end on one domain (smallest change, biggest structural signal) before sweeping the rest.

---

## 6. Guardrails (every phase)
- Never alter pricing, revenue-split, or hard-stop **values** under cleanup — relocate, don't edit (`CLAUDE.md`).
- No public-shape change (route response, exported type, DB column) without updating every caller in the same step. Half-migrated is worse than not migrated — finish a route group before moving on.
- No `any` / `@ts-ignore` / `as` to make the gate pass.
- Small, reviewable commits per route group; `npx tsc --noEmit && npm run lint && npm test` green before the next.

---

## 7. Stale docs found during analysis (fix in Phase 8)
- `app/CLAUDE.md`: "DB queries in `/lib/db`" → real location `lib/repos/*` (and, post-refactor, `lib/repos/server/*`).
- `app/CLAUDE.md`: "Current phase: PHASE 1" → vault/payments/portals already shipped.
- Scaffolding skills (`new-api-route`, `new-db-helper`) describe `getUser()`/`/lib/db` patterns the code abandoned.

_Plan only — no code changed. Recommended start: Phase 0 + 1, then Phase 2 on `vault` as the pilot._
