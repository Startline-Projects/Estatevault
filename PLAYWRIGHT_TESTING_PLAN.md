# EstateVault — Playwright Testing Plan

## Status: Playwright already wired

- Config: `playwright.config.ts` — Chromium only, sequential (`fullyParallel: false`), auto-starts dev server.
- Commands:
  - `npm run test:e2e` — run all
  - `npm run test:e2e:ui` — UI mode
  - `npm run test:e2e:shared` — run against shared DB (`TEST_ALLOW_SHARED_DB=1`)
  - `npm run test:db:reset` / `npm run test:db:seed` — test DB lifecycle
- Env: loads `.env.test`, falls back to `.env.local` only when `TEST_ALLOW_SHARED_DB=1`.
- Existing specs (11): smoke, auth, quiz-flow, document-generation, partner-onboarding,
  partner-revenue, admin-sales, role-access, vault-subscription, e2ee-smoke,
  api-subscription-status.

## What CAN be tested

### UI flows (browser)
- Public pages — landing, quiz, will/trust, checkout, success
- Auth — signup, login, forgot/reset password, email verify, handoff, vault-pin
- Client dashboard — documents, amendment, life-events, funding-checklist, settings, vault
- Vault — items CRUD, farewell upload/playback, trustees init, PIN gate
- Pro portal — onboarding step 1-7, dashboard, clients, revenue, marketing, training + exam
- Sales — dashboard, partners, pipeline, new-partner, affiliates, commission
- Attorney — dashboard, reviews, review/[id], pipeline, partners, farewell-verification
- Trustee — unlock OTP, vault page client-side decrypt + video player
- Partner white-label — `[partner-slug]` page + vault, theme color
- Farewell — `/farewell/[clientId]`, owner-veto

### API (request context, no browser)
- 90+ route handlers — checkout, documents/generate, crypto/*, vault/*, trustee/*,
  webhooks/stripe, subscription/*

### Crypto / E2EE
- `e2ee-smoke.spec.ts` pattern — key derivation, encryption headers, rotate, recovery, Shamir

## Coverage gap (missing specs)
- Trustee unlock / vault decrypt
- Farewell flows (`/farewell/[clientId]`, owner-veto)
- Attorney review approve → client notified
- Client dashboard CRUD (amendment, life-events, vault items)
- White-label partner page + theme
- Checkout webhooks (Stripe)
- Crypto rotate passphrase/recovery, Shamir setup
- Marketing PDF generation

## Plan — full-site coverage

### Phase 0 — infra check
- Verify `.env.test` exists + points at isolated test DB (NOT prod Supabase)
- `npm run test:db:reset && npm run test:db:seed`
- `npm run test:e2e` → baseline, record pass/fail

### Phase 1 — public / unauth
- Smoke crawl every public route → 200, no console error
- Quiz full flow → result page
- Will + Trust checkout (Stripe test mode / mock)

### Phase 2 — auth + roles
- Each user type login → correct dashboard
- Extend `role-access.spec.ts` → cross-role 403s

### Phase 3 — client journey
- Signup → quiz → checkout → doc generate → download
- Acknowledgment gate (Core Rule 3)
- Hard-stop → attorney referral (Core Rule 4)
- Dashboard: amendment, life-events, vault items CRUD

### Phase 4 — vault + E2EE + trustee
- Vault upload/encrypt, farewell video upload + playback
- Trustee unlock OTP → vault decrypt
- Crypto rotate passphrase/recovery, Shamir setup

### Phase 5 — pro / sales / attorney
- Pro onboarding step 1-7 end to end
- Sales create-partner → partner activated
- Attorney review approve → client notified
- Revenue split assertions (Core Rules 5 + 6)

### Phase 6 — API layer
- `tests/api/` — webhooks/stripe, checkout verify, documents/process, subscription/sync
- Use Playwright `request` fixture, no browser

### Phase 7 — CI
- GitHub Action: reset + seed DB, `test:e2e`, upload `playwright-report`

## Warning
- `.env.test` not yet confirmed present. Verify isolated test DB before ANY run —
  else risk mutating real Supabase data.
