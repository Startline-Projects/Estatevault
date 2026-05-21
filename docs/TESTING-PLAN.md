# EstateVault — Platform E2E Testing Plan (Playwright)

Status legend: ✅ covered · 🟡 partial / stub · ❌ missing · 🔺 high-risk "never break" rule

## 1. Current state

Playwright is already set up — build on it, don't restart.

- **Config:** `playwright.config.ts` — 4 projects routed by tag, separate baseURLs per host:
  - `app` (default) → `localhost:3100` (consumer estatevault.us)
  - `pro` (`@pro`) → `pro.localhost:3100`
  - `sales` (`@sales`) → `sales.localhost:3100`
  - `admin` (`@admin`) → `admin.localhost:3100` (admin + attorney)
- **Auth helpers:** `tests/e2e/helpers/auth.ts` — `loginAs(page, email, pw)`, `logout(page)`, `adminClient()`.
- **Seed users:** `tests/fixtures/users.ts` — admin, partnerBasic (standard), partnerEnterprise, client, attorney, salesRep — all `@estatevault.test`.
- **DB lifecycle:** `npm run test:db:reset` / `test:db:seed` (guarded by `TEST_MODE=1` + `@estatevault.test` domain). Shared-DB variants exist.
- **Existing specs:** 25 e2e files (auth, role-access, dashboards, documents, quiz, vault/e2ee, attorney, stripe webhooks, etc.) + vitest unit (`calculate-split`, `stripe-webhooks`).

## 2. Conventions for new tests

- Tag the spec for its host: `test.describe("...", { tag: "@pro" }, ...)`. Untagged = consumer app.
- Authenticate via `loginAs(page, TEST_USERS.x.email, TEST_USERS.x.password)` — never hand-roll login except in the auth-specific specs.
- Each spec must be idempotent against the seed; create+cleanup its own mutable data.
- Prefer data-testid selectors; add them where missing rather than relying on copy (brand voice copy changes).
- API-only logic → vitest under `tests/unit` / `tests/api`. Full user journeys → Playwright.

## 3. Seed data gaps to add first

The current seed can't exercise several critical paths. Extend `scripts/test-db-seed.ts` + `tests/fixtures/users.ts`:

- ❌ **Firm-scoped client + whitelabel partner** — a `client` with `clients.partner_id` → partnerBasic, and partnerBasic given a real `subdomain` (e.g. `test-basic.localhost`). Required for the login-lockout regression (§5.1).
- ❌ **Affiliate user** (`user_type=affiliate`) with a referral code, for `/a/[code]` attribution.
- ❌ **Misconfigured partner** — partner row with all host columns null, to assert the fail-safe message path.
- ❌ **Orders/reviews fixtures** — a pending attorney review with a known SLA deadline (and one overdue) for queue tests.

## 4. Coverage matrix by domain

### A. Auth, routing, host isolation 🔺
| Scenario | Status | Notes |
|---|---|---|
| Valid/invalid login, post-login routing per user_type | ✅ | `auth.spec.ts` |
| Unauthenticated route guards | ✅ | `role-access.spec.ts`, `api-auth-guards.spec.ts` |
| Wrong-host block (partner on client host, etc.) | 🟡 | exists in code (`page.tsx:116`); assert message + redirect URL per role |
| **Firm-client lockout (the recent bug)** | ❌ | see §5.1 — highest priority |
| Logout clears session on all hosts | ✅ | `auth.spec.ts` |

### B. Consumer: quiz → will/trust → checkout 🔺
| Scenario | Status | Notes |
|---|---|---|
| Quiz happy path → will recommendation | ✅ | `quiz-flow.spec.ts` |
| Quiz happy path → trust recommendation | 🟡 | add explicit net-worth/asset branch asserting trust |
| Michigan-only gate rejects other states | ❌ | residency step, both flows |
| Hard stop: special-needs dependent → attorney referral, no checkout | ❌ 🔺 | quiz B2 + G1 → `/attorney-referral` |
| Hard stop: irrevocable trust → referral | ❌ 🔺 | per CLAUDE.md rule 4 |
| Acknowledgment gate shown before any intake/generation | 🟡 🔺 | rule 3 — assert intake blocked until accepted |
| Age gate (DOB < 18 rejected) | ❌ | will + trust "about" step |
| Beneficiary shares must sum to 100% | ❌ | unequal-shares validation |
| Trust complexity auto-enables attorney review + decline warning | 🟡 | `document-generation.spec.ts` touches; assert toggle + warning |
| Quiz copy never says "We recommend" / "death" | ❌ 🔺 | rules 1,2 + brand voice — assert phrasing |

### C. Pricing & revenue splits 🔺
| Scenario | Status | Notes |
|---|---|---|
| Split math: will/trust/amendment × standard/enterprise | ✅ | `calculate-split.test.ts` (unit) — keep as source of truth |
| Fixed prices enforced ($400/$600/$300/$50), partner cannot change | ❌ 🔺 | rule 5 — assert checkout totals + no edit path in `/pro/settings` |
| Attorney review add-on = $300, 100% to attorney | 🟡 | assert split routes full fee to attorney |
| Affiliate attribution credits correct cut | ❌ | tie to §D |

### D. Checkout, Stripe, documents
| Scenario | Status | Notes |
|---|---|---|
| Will/trust checkout → Stripe session | 🟡 | `quiz-flow.spec.ts`; use Stripe test mode |
| Email conflict check (existing plan) | ❌ | `/api/checkout/check-conflict` behavior |
| Webhook: checkout.session.completed → order paid → generation triggered | ✅ | `stripe-webhooks.spec.ts` + unit |
| No document generated before acknowledgment + payment | ❌ 🔺 | rule 3/CLAUDE — guard test |
| Document generation produces will/trust/POA/healthcare | ✅ | `document-generation.spec.ts` |
| Refund / charge.refunded handling | 🟡 | unit exists; e2e assert state |

### E. Client portal & vault (E2EE) 🔺
| Scenario | Status | Notes |
|---|---|---|
| Dashboard, documents, life-events, settings smoke | ✅ | `client-dashboard*.spec.ts` |
| Vault CRUD + PIN (separate from password) | 🟡 | `e2ee-smoke.spec.ts`; assert PIN required each unlock |
| Trustee setup (1–2), 72h + identity verify before access | ✅ | `trustee-unlock.spec.ts`, `e2ee-smoke.spec.ts` |
| Trustee read-only + session timeout revoke | 🟡 | assert no-write + expiry |
| Key rotation / re-encryption | ✅ | `crypto-rotate.spec.ts` |
| Farewell record/upload + owner veto | ✅ | `farewell-flows.spec.ts` |

### F. Partner portal (`@pro`)
| Scenario | Status | Notes |
|---|---|---|
| Onboarding steps 1–7 (standard + enterprise) | 🟡 | `partner-onboarding.spec.ts`; assert each step gate |
| Dashboard stats / revenue | 🟡 | `partner-revenue.spec.ts` |
| Client management list/detail | ❌ | `/pro/clients*` |
| Marketing tools (flyer/script/one-pager PDF) | 🟡 | `marketing-pdf.spec.ts` |
| Whitelabel branding applied (accent color, logo) | 🟡 | `partner-whitelabel.spec.ts` is `@fixme` — implement |
| Settings cannot alter fixed pricing | ❌ 🔺 | rule 5 |
| Stripe Connect required before payout | ❌ | onboarding step 6 gate |

### G. Sales rep (`@sales`) & affiliate
| Scenario | Status | Notes |
|---|---|---|
| Sales portal access + guards | ✅ | `admin-sales.spec.ts`, `sales-pages.spec.ts` |
| Create partner / create rep | ❌ | `/sales/new-partner`, `/sales/create-rep` |
| Pipeline CRUD | 🟡 | smoke only |
| Affiliate `/a/[code]` click → 90-day cookie → order attribution | ❌ | new flow |
| Affiliate payout (Stripe transfer) | ❌ | `/sales/affiliates/[id]/payout` |

### H. Review attorney (`@admin`)
| Scenario | Status | Notes |
|---|---|---|
| Portal routes + API guards | ✅ | `attorney.spec.ts` |
| Review decision (approve / w-notes / flag) | 🟡 | `attorney-review.spec.ts` |
| **Edit-and-upload DOCX flow** (new feature, commit a69f31b) | ❌ | download DOCX → upload reviewed → deliver |
| SLA: overdue flagged in queue | ❌ | needs overdue fixture |
| Farewell verification | 🟡 | `attorney/farewell-verification` |

### I. Whitelabel partner pages
| Scenario | Status | Notes |
|---|---|---|
| `/[partner-slug]` renders partner branding | 🟡 | `partner-whitelabel.spec.ts` fixme |
| `/[partner-slug]/vault` vault-only tier | ❌ | |
| Partner-attributed order from whitelabel landing | ❌ 🔺 | revenue correctness |

## 5. Priority new specs (write these first)

### 5.1 `auth-firm-client-lockout.spec.ts` (regression for the live bug) — P0
Covers the partner-scoped client lockout end to end. Requires seed from §3.
1. Firm client on **firm host** (`test-basic.localhost`) → login succeeds → lands on dashboard.
2. Firm client on **generic host** (`localhost`/estatevault.us) → blocked, signed out, error names the partner (`company_name`) and links the firm host URL — assert it is **not** the generic "your advisor / your firm's portal" fallback.
3. Direct (non-firm) client on generic host → login succeeds.
4. Misconfigured partner (no host columns) → graceful message, not a crash.
5. RPC guard: `get_partner_login_target` returns host fields only for the caller's own partner (API/unit test; assert no `stripe_account_id` etc. in payload).

### 5.2 `quiz-hard-stops.spec.ts` — P0 🔺
Special-needs dependent and irrevocable-trust paths halt generation → `/attorney-referral`. No checkout reachable. (CLAUDE rule 4, hardcoded.)

### 5.3 `pricing-immutable.spec.ts` — P0 🔺
Assert checkout totals = fixed prices; partner settings exposes no price edit; splits match `calculate-split` for both tiers. (rule 5/6)

### 5.4 `acknowledgment-gate.spec.ts` — P1 🔺
No intake/generation before acknowledgment accepted. (rule 3)

### 5.5 `attorney-edit-upload.spec.ts` — P1
New DOCX review flow: download → reviewed upload → client delivery + status transition.

### 5.6 `affiliate-attribution.spec.ts` — P1
`/a/[code]` → cookie → purchase → affiliate credited; payout transfer in Stripe test mode.

## 6. Non-functional / cross-cutting

- **Brand-voice lint** 🔺: assert key user-facing pages never render "death" or "We recommend" (rules 1,2 + voice). Cheap text-grep test across rendered quiz/result/checkout.
- **Accessibility smoke**: `@axe-core/playwright` on landing, quiz, dashboard, checkout.
- **Mobile viewport**: run a tagged subset at 390×844 (CLAUDE: mobile-first on every page).
- **Visual regression** (optional): Playwright screenshots for whitelabel branding correctness.

## 7. CI integration

- Add GitHub Action: on PR → `test:db:reset:shared` + `test:db:seed:shared` against test project → `test` (vitest) → `test:e2e`.
- Block merge on P0 specs. Upload Playwright HTML report + traces as artifacts.
- Run the 4 projects; shard if runtime grows (`--shard`).
- Stripe in test mode with a webhook fixture/CLI; never hit live.

## 8. Phased rollout

1. **Phase 1 (this week):** §3 seed data + 5.1 lockout + 5.2 hard stops + 5.3 pricing. These guard the rules most likely to cause revenue/compliance damage and the bug just shipped.
2. **Phase 2:** acknowledgment gate, attorney edit-upload, affiliate attribution, conflict check.
3. **Phase 3:** fill 🟡 partials (onboarding step gates, client management, whitelabel branding), brand-voice + a11y + mobile.
4. **Phase 4:** CI gating + visual regression + sharding.
