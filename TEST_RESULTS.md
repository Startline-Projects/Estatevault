# EstateVault — Test Run Results

_Run 2026-06-03 against the **staging** Supabase project, after `npm run test:db:seed`. Covers the audit-remediation + scalability (B7/B4/B3) work._

## Summary

| Suite | Result |
|-------|--------|
| **Unit (Vitest)** | ✅ **376 / 376 passed** |
| **Typecheck (`tsc --noEmit`)** | ✅ no new errors (2 pre-existing in `attorneyReviewRepo`, `quizSessionRepo`) |
| **Lint (`next lint`)** | ✅ clean on all changed files |
| **Crypto parity vectors** | ✅ `crypto-vectors.json in sync` |
| **E2E — Playwright `app` project** | 🟡 **73 passed · 5 failed · 43 skipped** — all 5 failures are environmental (see below), 0 code regressions |

## Where to view the reports

Generated artifacts (gitignored — local to this machine):

- **Unit:** `test-results/unit/results.json`, `test-results/unit/junit.xml`
- **E2E HTML report:** `playwright-report/full-seeded-2026-06-03/index.html`
  - open it: `npx playwright show-report playwright-report/full-seeded-2026-06-03`
- **E2E JSON/JUnit:** `test-results/results-full-seeded-2026-06-03.json`, `test-results/junit-*.xml`

Re-run anytime:
```bash
npm test            # unit -> writes test-results/unit/
RUN_ID=myrun npx playwright test --project=app   # e2e -> playwright-report/myrun/
```

## E2E coverage that directly validates this work

- **`api-auth-guards`** (18 ✅) — every sensitive route rejects anonymous callers, incl. the B4-migrated `GET /api/subscription/status`, `vault/*`, `trustee/*`, `crypto/*`, `checkout/*`, and the Stripe webhook signature check.
- **`api-subscription-status`** (4 ✅) — the B4-rewritten route returns the right payload for an authenticated client **and** 401s anonymously; a client is 403'd from a partner route (role enforcement).
- **`role-access`, `partner-revenue` (read), `vault-subscription`, `trustee-unlock`, `smoke`** — all ✅.
- **Unit:** new `dek-aad.test.ts` (C-2, 3 ✅) and `stripe-transfer-idempotency.test.ts` (C-1, 4 ✅), plus the existing webhook/DEK/attorney-verify suites.

## The 5 E2E failures — all environmental, not code regressions

All five depend on `loginAs()`, which performs the app's **cross-host auth handoff** to `clientUrl("/auth/handoff")`. In `.env.test`, `NEXT_PUBLIC_CLIENT_HOST=app.localhost:3000`, but the Playwright dev server runs on **port 3100**, and `app.localhost` is not in `/etc/hosts`. So the post-login redirect lands on an unreachable host → the page errors → the test times out. This is a **test-infrastructure host/port mismatch**, unrelated to the changes here (none of the 75 changed files touch the login page, `app/api/auth/handoff`, `lib/hosts`, or the quiz UI).

Failing specs (all `loginAs`-dependent):
- `auth › client login routes to /dashboard`
- `client-dashboard › /dashboard/funding-checklist loads for authenticated client`
- `document-generation › POST /api/documents/generate requires order_id`
- `e2ee-smoke › onboarding writes wrapped material`
- `quiz-flow › result screen shows 'Based on your answers'`

The **43 skipped** tests are tagged `@pro` / `@sales` / `@admin`; they run in the other three Playwright projects (consumer `app` project excludes them).

## To run the website fully (all 4 host projects)

Needs the multi-host setup the login handoff expects:

```bash
# 1. point the host vars at one consistent port (or run dev on :3000)
#    and add the subdomains to /etc/hosts:
echo "127.0.0.1 app.localhost pro.localhost sales.localhost admin.localhost" | sudo tee -a /etc/hosts

# 2. seed (staging) — already done for this run
TEST_ALLOW_SHARED_DB=1 npm run test:db:seed

# 3. run every project
npx playwright test          # app + pro + sales + admin
```

With that in place, the login-handoff and the `@pro/@sales/@admin` specs can pass too.
