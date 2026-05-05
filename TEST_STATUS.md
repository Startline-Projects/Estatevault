# EstateVault — Test Suite Status

**Date:** 2026-05-05
**Run:** `npx playwright test` + `vitest`

## Summary

- **Vitest:** 18/18 passing (2 files)
- **Playwright E2E:** 49/61 passing, 11 failing, 1 skipped
- Total surface: 5 unit specs + 9 E2E spec files

## Failing Tests (11)

Grouped by root cause. All failures reveal **real product gaps**, not test bugs (test assertions are already loose).

---

### A. Missing role guards on `/pro/*` pages (2 fails)

Routes render for users who should be blocked.

| Test | File:line | Symptom |
|------|-----------|---------|
| client cannot access /pro/dashboard | `tests/e2e/role-access.spec.ts:26` | Client lands on `/pro/dashboard` instead of redirect |
| non-partner cannot access /pro/revenue | `tests/e2e/partner-revenue.spec.ts:27` | Client lands on `/pro/revenue` |

**Fix:** Add role check in `/pro/dashboard/page.tsx` and `/pro/revenue/page.tsx` (or shared `/pro/layout.tsx`). Redirect non-partners to `/dashboard`.

---

### B. `/pro/revenue` page renders empty / broken (2 fails)

| Test | File:line | Symptom |
|------|-----------|---------|
| basic partner sees revenue page without crash | `tests/e2e/partner-revenue.spec.ts:6` | No `h1, h2` element visible (status <500 OK) |
| revenue page shows earnings sections | `tests/e2e/partner-revenue.spec.ts:13` | No `total\|earnings` text found |

**Fix:** Verify `app/pro/revenue/page.tsx` exists and renders headings. Page likely 404s or returns blank for partner without seeded orders.

---

### C. Partner login redirects to wrong route (1 fail)

| Test | File:line | Symptom |
|------|-----------|---------|
| partner login routes to /pro/dashboard or onboarding | `tests/e2e/auth.spec.ts:20` | Navigated to `/dashboard` not `/pro/dashboard` |

**Fix:** Login redirect logic (likely `/auth/login` post-success or middleware) must route partner role → `/pro/dashboard`. Currently sends all users to `/dashboard`. Check `partnerBasic` seed has `partners` row + correct role.

---

### D. API routes return 200 unauthenticated — auth gap (5 fails)

Routes use service-role Supabase client without JWT verification.

| Route | Test | File:line |
|-------|------|-----------|
| `POST /api/sales/create-partner` | sales API blocks unauthenticated | `tests/e2e/admin-sales.spec.ts:40` |
| `GET /api/sales/reps` | sales API blocks unauthenticated | `tests/e2e/admin-sales.spec.ts:48` |
| `POST /api/attorney/approve` | attorney routes block unauthenticated | `tests/e2e/admin-sales.spec.ts:74` |
| `POST /api/documents/generate` | document gen blocks unauthenticated | `tests/e2e/document-generation.spec.ts:19` |
| `GET /api/documents/status` | document status blocks unauthenticated | `tests/e2e/document-generation.spec.ts:28` |

Test asserts status ∈ `[401, 403, 307, 404]`; actual = `200`.

**Fix:** Add JWT check at top of each route handler:
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
// Then role check (admin / sales / attorney) before service-role ops.
```
Pattern already used in `/api/sales/create-partner` flow per memory obs 742 — apply to remaining routes.

---

### E. `/api/partner/revenue` response shape mismatch (1 fail)

| Test | File:line | Symptom |
|------|-----------|---------|
| returns earnings shape for partner | `tests/e2e/api-subscription-status.spec.ts:29` | Shape assertion fails |

**Fix:** Either update route to return expected fields (`total`, `pending`, `breakdown`) OR update test to match actual shape. Inspect `app/api/partner/revenue/route.ts` then decide.

---

## Passing (49 E2E + 18 unit)

- `tests/e2e/smoke.spec.ts` — 2/2
- `tests/e2e/auth.spec.ts` — 5/6
- `tests/e2e/vault-subscription.spec.ts` — all
- `tests/e2e/partner-revenue.spec.ts` — 1/4
- `tests/e2e/role-access.spec.ts` — most
- `tests/e2e/quiz.spec.ts` — all
- `tests/e2e/partner-onboarding.spec.ts` — all
- `tests/e2e/admin-sales.spec.ts` — partial
- `tests/e2e/document-generation.spec.ts` — partial
- `tests/e2e/api-subscription-status.spec.ts` — partial

## Priority Order for Fixing

1. **D (API auth gap)** — security critical, 5 tests, single pattern fix
2. **A (role guards)** — security, 2 tests, add layout check
3. **C (partner login redirect)** — UX, 1 test
4. **B (revenue page broken)** — feature, 2 tests, depends on C
5. **E (shape mismatch)** — 1 test, smallest blast radius
