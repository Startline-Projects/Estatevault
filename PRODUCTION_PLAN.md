# EstateVault — Unified Production Readiness Plan

> **This plan merges two sources:**
> 1. **Fresh 4-agent audit (2026-05-27)** — Security Engineer, Code Reviewer, Software Architect, Frontend Developer. Independent full-codebase scan.
> 2. **Existing CODE_REFACTOR_PLAN.md** — Structural refactoring phases (architecture layers, DRY, server repos, typed client).
>
> **Key change from the original plan:** Security and reliability fixes come FIRST as ship-blockers. Structural refactoring follows. Frontend quality is added as a new phase. The original plan folded security fixes into structural group sweeps — this plan treats them as prerequisites.

---

## Current State (as of 2026-05-27)

**Branch:** `Amir-Dev` — latest commit `6853ffe`
**Shipped groups:** vault (14 routes), checkout (9 routes) — fully on kernel + repos + Zod
**Remaining:** ~96 routes across webhooks, documents, partner, sales, attorney, crypto, admin, trustee, auth, cron
**Tests:** 117 unit tests passing, 49/61 e2e passing
**Working tree:** clean

---

## Master Issue Registry

Every finding from both audits, deduplicated, with a single ID and the phase that fixes it.

### CRITICAL — Ship-Blockers

| ID | Finding | File(s) | Source | Phase |
|----|---------|---------|--------|-------|
| S-01 | `/api/documents/process` — zero auth, triggers Claude API + purges intake data | `app/api/documents/process/route.ts` | Fresh audit + CODE_AUDIT C-4 | **Phase 0** |
| S-02 | `/api/documents/process-now` — zero auth, processes any order by UUID | `app/api/documents/process-now/route.ts` | Fresh audit | **Phase 0** |
| S-03 | `/api/documents/cleanup-test-orders` — zero auth, deletes orders+docs+storage | `app/api/documents/cleanup-test-orders/route.ts` | Fresh audit + CODE_AUDIT C-5 | **Phase 0** |
| S-04 | `/api/documents/check-status` — zero auth IDOR, leaks order metadata | `app/api/documents/check-status/route.ts` | Fresh audit | **Phase 0** |
| S-05 | `/api/partner/clients` — any auth user creates accounts under any partner | `app/api/partner/clients/route.ts` | Fresh audit + CODE_AUDIT C-6 | **Phase 0** |
| S-06 | `/api/sales/partner-notes` — any auth user reads/writes all partner notes | `app/api/sales/partner-notes/route.ts` | Fresh audit + CODE_AUDIT C-7 | **Phase 0** |
| S-07 | `/api/auth/set-password` — no verified token, account takeover | `app/api/auth/set-password/route.ts` | Fresh audit (NEW) | **Phase 0** |
| S-08 | Hostname injection in middleware — raw hostname in PostgREST `.or()` filter | `lib/supabase/middleware.ts:75-76` | Fresh audit (NEW) | **Phase 0** |
| S-09 | Stripe webhook no idempotency — duplicate orders + payouts on replay | `app/api/webhooks/stripe/route.ts` | Fresh audit + CODE_AUDIT C-1 | **Phase 0** |
| S-10 | DEK write race condition — concurrent bootstrap loses encryption key permanently | `lib/api/dek.ts:39-57` | Fresh audit + CODE_AUDIT C-3 | **Phase 0** |
| S-11 | DEK missing AAD binding — swapped wrapped keys decrypt wrong tenant | `lib/api/dek.ts` + vault routes | Fresh audit + CODE_AUDIT C-2 | **Phase 0** |

### HIGH

| ID | Finding | File(s) | Source | Phase |
|----|---------|---------|--------|-------|
| H-01 | `listUsers()` fetches ALL users into memory — 7 call sites | `webhooks/stripe`, `checkout/*`, `auth/set-password`, `create-review-attorney` | Fresh audit (NEW) | **Phase 0** |
| H-02 | In-memory rate limiter useless on Vercel serverless | `lib/api/auth.ts:91-102` | Fresh audit (NEW) | **Phase 0** |
| H-03 | Cron routes fail-open when CRON_SECRET unset (`if (secret && ...)`) | All 4 cron routes | Fresh audit + CODE_AUDIT H-3 | **Phase 0** |
| H-04 | `create-partner` + `create-rep` return tempPassword in JSON response | `app/api/sales/create-partner/route.ts:160`, `create-rep/route.ts:120` | Fresh audit (NEW) | **Phase 0** |
| H-05 | `Math.random()` for temp password generation | `app/api/sales/create-partner/route.ts:43` | Fresh audit (NEW) | **Phase 0** |
| H-06 | Hardcoded fallback secrets (`"sk_test_placeholder"`) — silent fail in prod | `lib/stripe.ts`, `lib/claude.ts`, `lib/email.ts` | Fresh audit (NEW) | **Phase 1** |
| H-07 | Two Stripe clients with different API versions (`2026-03-25.dahlia` vs `2024-12-18.acacia`) | `lib/stripe.ts`, `lib/stripe-payouts.ts` | Fresh audit (NEW) | **Phase 1** |
| H-08 | `createAdminClient` copy-pasted into 51 route files | 51 API route files | Original plan | **Phase 2** |
| H-09 | 51/120 API routes lack `withRoute` error wrapper | 51 route files | Original plan + fresh audit | **Phase 2** |
| H-10 | Will/Trust checkout routes ~90% identical (800+ lines duplicated) | `app/api/checkout/will/route.ts`, `trust/route.ts` | Fresh audit | **Phase 2** |
| H-11 | 8 test files for 120 API routes — critical paths untested | `tests/` | Fresh audit | **Phase 1** |
| H-12 | No migration files in source control — schema not reproducible | `supabase/migrations/` | Fresh audit (NEW) | **Phase 5** |

### MEDIUM

| ID | Finding | File(s) | Source | Phase |
|----|---------|---------|--------|-------|
| M-01 | `/api/farewell/verify` — unauthenticated file upload | `app/api/farewell/verify/route.ts` | Fresh audit (NEW) | **Phase 0** |
| M-02 | `/api/farewell/access` — no rate limit, email bombing | `app/api/farewell/access/route.ts` | Fresh audit (NEW) | **Phase 0** |
| M-03 | `/api/documents/download-by-session` — IDOR via order_id fallback | `app/api/documents/download-by-session/route.ts` | Fresh audit (NEW) | **Phase 0** |
| M-04 | `dangerouslySetInnerHTML` in partner CSS — XSS if partner injects script tags | `components/partner/PartnerThemedShell.tsx:129` | Fresh audit (NEW) | **Phase 0** |
| M-05 | `/api/email/partner-activated` — role check uses `"sales"` not `"sales_rep"` | `app/api/email/partner-activated/route.ts:22` | Fresh audit (NEW) | **Phase 0** |
| M-06 | No Zod validation on ~10 API route inputs | `partner/clients`, `sales/partner-notes`, `admin/farewell-verification`, etc. | Fresh audit | **Phase 3** |
| M-07 | Email fire-and-forget — no retry, no dead-letter, silent failures | `lib/email.ts` | Fresh audit (NEW) | **Phase 4** |
| M-08 | Document pipeline no per-document status — partial failure = stuck order | `app/api/documents/process/route.ts` | Fresh audit (NEW) | **Phase 4** |
| M-09 | Cron jobs fetch ALL qualifying orders, no pagination | `app/api/cron/*/route.ts` | Fresh audit (NEW) | **Phase 4** |
| M-10 | Redis queue no TTL, no dead-letter, no max-retry | `lib/queue/document-queue.ts` | Fresh audit (NEW) | **Phase 4** |
| M-11 | KEK cached indefinitely — rotation requires redeploy | `lib/api/dek.ts:13` | Fresh audit (NEW) | **Phase 4** |
| M-12 | `images.remotePatterns: '**'` defeats image optimization allowlist | `next.config.mjs:75-77` | Fresh audit (NEW) | **Phase 1** |
| M-13 | Webhook handler missing `maxDuration` in vercel.json | `vercel.json` | Fresh audit (NEW) | **Phase 1** |
| M-14 | Stripe error messages leak internal state | `app/api/webhooks/stripe/route.ts:34` | Fresh audit (NEW) | **Phase 0** |

### FRONTEND

| ID | Finding | File(s) | Source | Phase |
|----|---------|---------|--------|-------|
| F-01 | 84/100 pages use `"use client"` unnecessarily — kills SSR | All `app/` page files | Fresh audit (NEW) | **Phase 6** |
| F-02 | 837-line vault god component (20+ useState, PIN + grid + modal + upload) | `app/dashboard/vault/page.tsx` | Fresh audit (NEW) | **Phase 6** |
| F-03 | Only 3 `loading.tsx` files — blank screens during navigation | `app/` segments | Fresh audit (NEW) | **Phase 6** |
| F-04 | No route-level `error.tsx` — all crashes bubble to root | `app/` segments | Fresh audit (NEW) | **Phase 6** |
| F-05 | 10 total `aria-` attributes — vault modal no role/focus-trap | Components throughout | Fresh audit (NEW) | **Phase 6** |
| F-06 | No sitemap.ts, robots.ts, per-page metadata, OG images | `app/` | Fresh audit (NEW) | **Phase 6** |
| F-07 | ScrollReveal forces entire homepage to client-render | Landing page sections | Fresh audit (NEW) | **Phase 6** |
| F-08 | Partner logos use raw `<img>` not `next/image` | Partner components | Fresh audit (NEW) | **Phase 6** |

### LOW / NIT

| ID | Finding | Phase |
|----|---------|-------|
| L-01 | 7 `as any` casts, 1 `@ts-ignore` | Phase 5 |
| L-02 | `void validateEnvelope` dead import in share/route.ts | Phase 2 |
| L-03 | `app/CLAUDE.md` says "Phase 1" and references `/lib/db` | Phase 7 |
| L-04 | Stale scaffolding skills reference old patterns | Phase 7 |
| L-05 | Audit log inserts fire-and-forget with swallowed errors | Phase 4 |
| L-06 | `b64/bytea` helpers duplicated 7 times | Phase 2 |

---

## Phased Plan

### Verify gate (every phase, every step)
```bash
npx tsc --noEmit && npm run lint && npm test
```
Red = stop. No exceptions.

---

### Phase 0 — Security Lockdown (Days 1-3)

> **Nothing else ships until this phase is done.** These are active vulnerabilities that can be exploited by anyone on the internet right now.

#### 0.1 — Auth guards on public destructive endpoints (S-01 through S-06)

Add `CRON_SECRET` bearer check or `requireAuth(["admin"])` to:
- `app/api/documents/process/route.ts` — add CRON_SECRET check (S-01)
- `app/api/documents/process-now/route.ts` — add `requireAuth(["admin"])` (S-02)
- `app/api/documents/cleanup-test-orders/route.ts` — add CRON_SECRET check (S-03)
- `app/api/documents/check-status/route.ts` — add `requireAuth()` + `assertOrderAccess()` (S-04)
- `app/api/partner/clients/route.ts` — add `requireAuth(["partner"])` + verify caller owns `partnerId` (S-05)
- `app/api/sales/partner-notes/route.ts` — add `requireAuth(["sales_rep", "admin"])` (S-06)

#### 0.2 — Account takeover fix (S-07)

`/api/auth/set-password` — require a verified OTP or magic-link token before allowing password set. Match the signup flow pattern that already uses `verifiedToken`.

#### 0.3 — Hostname injection (S-08)

`lib/supabase/middleware.ts:75-76` — sanitize hostname before interpolating into `.or()` filter. Strip `"`, `'`, `(`, `)`, `,` and any non-alphanumeric/dot/hyphen characters. Or use a parameterized approach.

#### 0.4 — Stripe webhook idempotency (S-09)

Create a `stripe_webhook_events` table with `event_id TEXT PRIMARY KEY`. At the top of the webhook handler:
```sql
INSERT INTO stripe_webhook_events (event_id, event_type, processed_at)
VALUES ($1, $2, now())
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;
```
If no row returned → already processed → return 200 early.

#### 0.5 — DEK race condition + AAD binding (S-10, S-11)

- Race: Change `getOrCreateUserDek()` to use `INSERT ... ON CONFLICT DO NOTHING` on `client_id` + re-read pattern. Or use a Postgres advisory lock.
- AAD: Pass `client_id` as Additional Authenticated Data to both `wrapKey`/`unwrapKey` and `encryptBytes`/`decryptBytes`. Requires a migration to re-wrap existing DEKs with AAD.

#### 0.6 — Replace `listUsers()` bomb (H-01)

Replace all 7 occurrences of `listUsers()` + `.find(u => u.email === ...)` with targeted lookups. Use `supabase.auth.admin.getUserById()` where you have the ID, or query `profiles` table by email.

Files: `webhooks/stripe/route.ts` (2), `checkout/will/route.ts`, `checkout/trust/route.ts`, `checkout/vault-subscription/route.ts`, `partners/create-review-attorney/route.ts`, `auth/set-password/route.ts`.

#### 0.7 — Replace in-memory rate limiter (H-02)

Delete the `Map`-based `rateLimit()` in `lib/api/auth.ts:91-102`. Replace all call sites with the Upstash rate limiters already defined in `lib/rate-limit.ts`.

#### 0.8 — Cron fail-closed (H-03)

All 4 cron routes: change `if (secret && auth !== ...)` to `if (!secret || auth !== ...)`. Missing secret = deny, not allow.

#### 0.9 — Password generation + exposure (H-04, H-05)

- Replace `Math.random()` with `crypto.randomBytes()` for temp password generation.
- Remove `tempPassword` from JSON response body in `create-partner` and `create-rep`. Password is already emailed.

#### 0.10 — Medium security fixes

- M-01: Add Upstash rate limiting to `/api/farewell/verify`
- M-02: Add IP-based Upstash rate limiting to `/api/farewell/access`
- M-03: Remove bare `order_id` fallback in `/api/documents/download-by-session` or require session auth
- M-04: Sanitize all partner-controlled values in `PartnerThemedShell.tsx` CSS template — strip `<`, `>`, `"`, `url()`
- M-05: Fix role check in `/api/email/partner-activated` — change `"sales"` to `"sales_rep"`
- M-14: Replace raw Stripe error message with generic error in webhook handler

**Verify:** Gate green. Manually test: hit each locked-down endpoint without auth → expect 401/403. Test webhook replay → expect dedup. Test set-password without token → expect rejection.

---

### Phase 1 — Foundation Hardening (Days 4-6)

> Config safety, test coverage for critical paths, deployment fixes. Builds on Phase 0 security work.

#### 1.1 — Fail-fast on missing secrets (H-06)

Replace fallback placeholders with throws in production:
```ts
// lib/stripe.ts — remove: process.env.STRIPE_SECRET_KEY || "sk_test_placeholder"
// lib/claude.ts — remove: process.env.ANTHROPIC_API_KEY || "placeholder"
// lib/email.ts — remove: process.env.RESEND_API_KEY || "re_placeholder"
```
Wire `lib/env.ts` `validateEnv()` into app startup or `instrumentation.ts`.

#### 1.2 — Unify Stripe client (H-07)

Delete the standalone Stripe client in `lib/stripe-payouts.ts`. Import the shared instance from `lib/stripe.ts`. Remove the `as any` API version cast.

#### 1.3 — Deployment config fixes (M-12, M-13)

- Tighten `images.remotePatterns` in `next.config.mjs` — replace `hostname: '**'` with explicit allowed domains.
- Add `maxDuration: 300` for webhook handler in `vercel.json`.

#### 1.4 — Characterization tests for critical paths (H-11)

Write tests for the flows that Phase 2+ will restructure:
- Webhook: `checkout.session.completed` → order creation → document queuing → payout
- Trustee: invite → confirm → unlock flow
- Document generation: queue → process → seal → upload
- Cron: at least one cron job happy path
- Auth: set-password (now with token gate), signup, login

Target: double test count from 117 to ~200.

#### 1.5 — Shared kernel (from original Phase 0-1)

These pieces already exist from the vault/checkout work. Confirm they're solid:
- `lib/api/route.ts` — `withRoute(handler)` ✅ exists
- `lib/api/response.ts` — `ok(data)`, `fail(message, status)` ✅ exists
- `lib/api/auth.ts` — `requireAuth`, `createAdminClient`, `UserType` ✅ exists
- `lib/orders/pricing.ts` — `PRICES`, `PROMO_CODES` ✅ exists
- `lib/crypto/encoding.ts` — consolidate 7 b64/bytea copies (L-06). **Do this now.**

**Verify:** Gate green. New tests green. Stripe initializes with single client.

---

### Phase 2 — Structural Refactor: Server Repos + Thin Routes (Days 7-18)

> The largest phase. Migrate ~96 remaining routes onto the kernel pattern. Done group-by-group, never big-bang. Each group follows: delete local `createAdminClient` → wrap with `withRoute` → extract queries to server repo → add Zod validation.

#### Group order (risk-first):

| Order | Group | Routes | Folds in | Risk |
|-------|-------|--------|----------|------|
| 1 | **cron** | 4 | H-03 already fixed in Phase 0 | Low — safest intro |
| 2 | **webhooks** | ~6 | S-09 idempotency (done in Phase 0) | High — money flows |
| 3 | **documents** | ~12 | S-01/S-02/S-03/S-04 auth (done in Phase 0) | Med — pipeline complexity |
| 4 | **partner / sales** | ~20 | S-05/S-06 role guards (done in Phase 0), `user_id`→`profile_id` bug | Med — shared repos with checkout |
| 5 | **attorney** | ~8 | — | Low |
| 6 | **crypto** | ~6 | S-10/S-11 DEK fixes (done in Phase 0) | High — encryption paths |
| 7 | **admin** | ~10 | — | Low |
| 8 | **trustee** | ~10 | Farewell verify/access rate limits (done in Phase 0) | Med — security-sensitive |
| 9 | **auth** | ~10 | S-07 set-password (done in Phase 0) | Med |

#### Per-group checklist:
- [ ] Delete local `createAdminClient` — import from `@/lib/api/auth` (H-08)
- [ ] Wrap all handlers with `withRoute` (H-09)
- [ ] Extract inline `.from("table")` queries into `lib/repos/server/` returning typed results
- [ ] Bake ownership scoping into repo (`.eq("client_id", ...)`)
- [ ] Add Zod schemas for all inputs to `lib/validation/schemas.ts` (M-06)
- [ ] Replace inlined prices/promos with imports from `lib/orders/pricing.ts`
- [ ] Gate green after each group

#### Special: checkout dedup (H-10)
Extract shared checkout logic (affiliate attribution, promo codes, client creation, Stripe session) into `lib/checkout/createCheckoutSession.ts`. Will/trust routes become thin wrappers differing only in line items and document types.

**Verify:** Gate green after each group. Characterization tests from Phase 1 prove parity. Manually smoke each group.

---

### Phase 3 — Validation at Every Boundary (Days 19-21)

> From original plan Phase 3. Most Zod work happens during Phase 2 group sweeps. This phase catches stragglers and hardens the pattern.

- Audit every route: confirm `safeParse` at the top of every handler
- Reconcile duplicate type definitions (e.g., `WillIntake` interface vs `willIntakeSchema`) into single Zod-inferred types
- Add Zod schemas for remaining unvalidated inputs (~10 routes from M-06)
- Wire `withRoute` to reject invalid input with standard envelope before handler logic runs

**Verify:** Gate green. Schema unit tests for every new schema.

---

### Phase 4 — Reliability & Scalability (Days 22-27)

> All findings from the fresh audit that address system resilience — not covered by the original plan at all.

#### 4.1 — Email retry + failure tracking (M-07)
- Add retry logic (3 attempts, exponential backoff) to `lib/email.ts`
- Log failed sends to a `failed_emails` table or dead-letter queue
- Add admin notification for persistent failures

#### 4.2 — Document pipeline resilience (M-08)
- Add per-document status column (`pending`, `generating`, `generated`, `failed`)
- Track each document independently instead of bulk `update().eq("order_id")`
- Add recovery path: admin can re-trigger single failed documents
- Eliminate duplicated processing logic between queue and fallback paths

#### 4.3 — Cron pagination + idempotency (M-09)
- All cron jobs: paginate qualifying orders (batch of 50)
- Add `last_reminder_sent_at` or idempotency key to survive partial failures
- Add timeout awareness: check remaining execution time before starting next batch

#### 4.4 — Redis queue hardening (M-10)
- Add TTL to jobs (e.g., 24h)
- Add max-retry count (e.g., 3)
- Add dead-letter handling for poisoned jobs
- When Redis is unconfigured, fail loudly instead of silent no-op

#### 4.5 — KEK cache TTL (M-11)
- Add 5-minute TTL to `kekCache` in `lib/api/dek.ts`
- After TTL, re-fetch from Supabase Vault on next request

#### 4.6 — Audit log durability (L-05)
- Replace fire-and-forget `.then(() => undefined, () => undefined)` with a small buffer that retries once on failure

**Verify:** Gate green. Test email retry by simulating Resend failure. Test cron with >50 qualifying orders.

---

### Phase 5 — Type System + Config Hardening (Days 28-30)

> Combines original plan Phases 5, 6, 7.

#### 5.1 — Generate Supabase DB types
```bash
supabase gen types typescript > types/db.generated.ts
```
Wire `npm run db:types` script. Flow generated types through repos and services.

#### 5.2 — Migration baseline (H-12)
- Export current production schema as `00000000000000_baseline.sql`
- Ensure all migrations are in source control and reproducible
- Test: apply to fresh DB via `npm run test:db:reset`

#### 5.3 — SSOT finish
- Replace every remaining inlined price/promo with imports from `lib/orders/pricing.ts`
- Tighten `calculateSplit()` to accept a union type (no silent all-zeros on typo)

#### 5.4 — Remove `as any` / `@ts-ignore` (L-01)
- Fix all 7 `as any` casts (Stripe version fixed in Phase 1, audit remaining 6)
- Add explicit `Promise<NextResponse>` return types to all handlers (trivial via `withRoute`)

**Verify:** Gate green. `tsc --noEmit` with stricter types. Fresh DB build succeeds.

---

### Phase 6 — Frontend Production Quality (Days 31-40)

> Entirely new — not in the original plan. All findings from the frontend audit.

#### 6.1 — Server component conversion (F-01)
Audit all 84 `"use client"` pages. For each:
- If it only fetches data via `useEffect` + Supabase client → convert to server component
- Keep `"use client"` only for pages with interactive state (forms, modals, animations)
- Target: reduce from 84 to ~30 client pages
- Reference: `app/dashboard/page.tsx` already does this correctly

#### 6.2 — Decompose god components (F-02)
`app/dashboard/vault/page.tsx` (837 lines) → split into:
- `VaultGrid` — category display + item list
- `VaultItemDetail` — single item modal with `role="dialog"`, `aria-modal`, focus trap
- `PinEntry` — PIN creation + verification
- `VaultUpload` — file upload form
- `AddItemForm` — new item creation
- Use `useReducer` instead of 20+ `useState` calls

#### 6.3 — Loading states (F-03)
Add `loading.tsx` to: `/dashboard`, `/pro`, `/sales`, `/attorney`, `/auth`
Each should render a skeleton/spinner appropriate to the page layout.

#### 6.4 — Error boundaries (F-04)
Add `error.tsx` to: `/dashboard`, `/pro`, `/sales`, `/attorney`, `/quiz`
Each should offer retry + navigation home. The root `error.tsx` stays as final fallback.

#### 6.5 — Accessibility (F-05)
Priority fixes:
- Vault modal: add `role="dialog"`, `aria-modal="true"`, focus trap, Escape key handler
- FAQ accordion: add `aria-expanded`, `aria-controls` to toggle buttons
- All decorative SVGs: add `aria-hidden="true"`
- Form fields: add `aria-invalid` and `aria-describedby` on validation errors
- Delete confirmation: replace `window.alert()` with accessible confirmation dialog

#### 6.6 — SEO (F-06)
- Create `app/sitemap.ts` — dynamic sitemap generation
- Create `app/robots.ts` — robots.txt
- Add `generateMetadata()` or `metadata` export to every public-facing page
- Add Open Graph images for key pages (landing, quiz, pricing)

#### 6.7 — Performance (F-07, F-08)
- Replace `ScrollReveal` with CSS-only `@starting-style` or a single root `IntersectionObserver`
- Replace raw `<img>` tags with `next/image` for partner logos
- Tighten `images.remotePatterns` (done in Phase 1, verify here)

**Verify:** Gate green. Manual test all pages — no blank screens on navigation. Lighthouse accessibility score > 90. Test with keyboard-only navigation.

---

### Phase 7 — Lock It In (Days 41-43)

> From original plan Phase 8 + doc cleanup.

#### 7.1 — ESLint enforcement
Promote from `warn` to `error`:
- Ban raw `fetch("/api/...")` in components
- Ban inline `createAdminClient`
- Ban `.from("table")` outside `lib/repos`
- Require `requireAuth` in routes
- Ban `Math.random()` for security-sensitive values

#### 7.2 — CI gate
Add CI step: `npx tsc --noEmit && npm run lint && npm test` on every PR.

#### 7.3 — Doc cleanup (L-03, L-04)
- Fix `app/CLAUDE.md`: remove "Phase 1" and `/lib/db` references
- Update scaffolding skills (`new-api-route`, `new-db-helper`) to describe the layered architecture
- Update `references/conventions.md`

#### 7.4 — Typed API client (from original Phase 4)
- Build `lib/api-client/` on top of existing `authedFetch`
- Typed functions per endpoint returning typed data from response envelope
- Migrate components off raw `fetch` group by group
- Adopt consistent loading/error/success via shared async-state hook

**Verify:** Full gate green in CI. Lint rules catch violations. All docs accurate.

---

## Summary: Phase → Effort → Risk

| Phase | Theme | Days | Risk | Findings Addressed |
|-------|-------|------|------|-------------------|
| **0** | **Security Lockdown** | 1-3 | Low (targeted fixes) | S-01→S-11, H-01→H-05, M-01→M-05, M-14 |
| **1** | Foundation Hardening | 4-6 | Low | H-06, H-07, H-11, M-12, M-13, L-06 |
| **2** | Structural Refactor (per group) | 7-18 | Med-High (most surface) | H-08→H-10, L-02 |
| **3** | Validation at Boundary | 19-21 | Low | M-06 |
| **4** | Reliability & Scalability | 22-27 | Med | M-07→M-11, L-05 |
| **5** | Type System + Config | 28-30 | Med | H-12, L-01 |
| **6** | Frontend Production Quality | 31-40 | Med | F-01→F-08 |
| **7** | Lock It In | 41-43 | Low | L-03, L-04 |

**Total estimated: ~43 working days for full production readiness.**

---

## Guardrails (every phase, every step)

1. **Never alter pricing, revenue-split, or hard-stop values** — relocate, don't change (`CLAUDE.md` law).
2. **No `any` / `@ts-ignore` / `as` to make the gate pass.**
3. **Gate green before moving to next step.** `npx tsc --noEmit && npm run lint && npm test`.
4. **One group at a time.** Finish a route group before starting the next.
5. **No public-shape change** (route response, exported type, DB column) without updating every caller in the same step.
6. **Crypto/DEK and money paths are the danger zone** — silent data loss, not loud crash. Most test coverage, most manual verification.
7. **Small, reviewable commits per group.** Never a 50-file commit.

---

## Target Architecture (unchanged from original plan)

```
                          ┌──────────────────────────────────────────┐
  Browser / Mobile  ──>   │  Typed API client  (lib/api-client/*)      │   <- one fetch wrapper,
                          │  authedFetch + typed endpoints + envelope  │     typed responses,
                          └───────────────────┬──────────────────────┘     401 refresh, 1 error shape
                                              │
                          ┌───────────────────▼──────────────────────┐
  app/api/**/route.ts ──> │  Route handler (THIN)                      │
                          │  withRoute(): auth -> validate -> call svc  │   <- no inline admin client,
                          │  -> shape response. Promise<NextResponse>.  │     no inline query, no z inline
                          └───────────────────┬──────────────────────┘
                          ┌───────────────────▼──────────────────────┐
                          │  Service / domain layer (lib/<domain>)     │   <- business rules:
                          │  vault, checkout, trustee, partner, ...    │     pricing, splits, hard stops
                          └───────────────────┬──────────────────────┘
                          ┌───────────────────▼──────────────────────┐
                          │  Server repos (lib/repos/server/*)         │   <- the ONLY place that
                          │  all .from("table") lives here             │     touches Supabase tables
                          └───────────────────┬──────────────────────┘
                          ┌───────────────────▼──────────────────────┐
                          │  Supabase (Postgres + RLS)                 │
                          └────────────────────────────────────────────┘

  Shared kernel: lib/api/auth.ts (requireAuth, createAdminClient),
  lib/validation/schemas.ts (Zod registry), lib/crypto/encoding.ts,
  lib/orders/pricing.ts (prices + promo SSOT), types/db.generated.ts.
```

### Design Principles
1. **One way to do each thing.** Route never re-declares auth, admin client, validation, or query.
2. **Thin routes, fat services, single data layer.** Tables touched only in `lib/repos`.
3. **Validate at the boundary, type through the stack.** Every body/query parsed by named Zod schema.
4. **One client transport.** Components call typed API client, never raw `fetch`.
5. **Single source of truth for money and config.** Prices, promos, splits in one module.
6. **Make wrong code not compile.** ESLint-error rules + CI enforcement.
7. **Never touch business values under cleanup** — relocate, don't change.

---

## What's Already Done (preserve, don't redo)

| Item | Commit | Status |
|------|--------|--------|
| Vault group (14 routes) — kernel + repos + Zod | `90e75d0` | ✅ Shipped |
| Checkout group (9 routes) — kernel + repos + Zod | `51fdca1` + `0d108df` | ✅ Shipped |
| C-8 attorney-verify data bug fixed | `0d108df` | ✅ Fixed |
| Profile sibling bug (full_name) fixed | `0d108df` | ✅ Fixed |
| `withRoute`, `ok()`, `fail()` — shared kernel | `90e75d0` | ✅ Exists |
| Server repos: vaultItemRepo, trusteeRepo, farewellRepo, orderRepo, partnerRepo, quizSessionRepo, affiliateRepo, clientRepo, documentRepo, profileRepo, appSettingsRepo | Various | ✅ Exist |
| Pricing module: `PRICES`, `PROMO_CODES` | `51fdca1` | ✅ Exists |
| 117 unit tests passing | Latest | ✅ Green |

---

## Collision Rules (multi-dev)

1. **One owner per repo file.** Creator owns it. Others import, never recreate.
2. **Schemas append-only.** Add new Zod schemas at the bottom of `lib/validation/schemas.ts`. Never reorder.
3. **Never edit a money value during refactor.** Relocate, don't change.
4. **Verify gate green after every step.** Red = stop.
5. **Update `CODE_REFACTOR_HANDOFF.md` when you wrap a group** so the next person sees current state.

---

_Generated 2026-05-27. Merges fresh 4-agent security/quality/architecture/frontend audit with existing CODE_REFACTOR_PLAN.md structural phases. Security-first ordering._
