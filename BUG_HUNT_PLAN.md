# EstateVault — Full-Website Bug-Hunt Plan

**Goal:** systematically find and confirm bugs across the entire platform, log every confirmed one to `BUGS.md` (and `BUGS.html`), until coverage is complete.
**Method:** driven by the `bug-hunter` skill (`.claude/skills/bug-hunter/`). One surface at a time, severity-ranked (Critical > High > Medium > Low), confirmed findings only.
**Surface:** ~110 page routes + ~150 API routes. Too big for one pass → split into 9 domains, run worst-risk first.

---

## Principles (apply to every phase)

1. **Read before judging** — trace the real path (page → API route → repo → DB), don't guess.
2. **Confirm, don't speculate** — write the repro. If a test already covers it, it's not a bug. Speculation → "Needs verification", not BUGS.md.
3. **Server is the source of truth** — every finding asks: can the client lie? Is the value re-derived/verified server-side? Is auth from the session, not the body?
4. **Cross-check money against the SSOT** — `lib/orders/pricing.ts` + `lib/attorney-review/routing.ts`. Any other file disagreeing = bug.
5. **Dedup** — re-confirming an existing BUG-N updates that entry; don't create duplicates.
6. **Log as you go** — append confirmed findings to `BUGS.md` per phase, continue the numbering.

---

## Domain map (the whole surface, grouped)

| # | Domain | Pages | API routes (key) | Why it matters |
|---|--------|-------|------------------|----------------|
| 1 | **Money path** | will/trust/vault/amendment checkout + success | `checkout/*`, `webhooks/stripe`, `documents/*`, `subscription/*`, `stripe/connect/*` | Paid-but-nothing / wrong charge. Highest trust. |
| 2 | **Core Rules** | quiz, will, trust intake | checkout + webhook | Pricing, splits, hard stops, acknowledgment, no-legal-advice. Business law. |
| 3 | **Vault & crypto** | dashboard/vault/*, onboarding/vault-setup, trustee/* | `vault/*`, `crypto/*`, `trustee/*`, `farewell/*` | Data loss, encryption, cross-tenant leaks. |
| 4 | **Auth & sessions** | auth/*, recover, handoff | `auth/*`, `profile/me` | Account takeover, lockout, orphaned sessions, role escalation. |
| 5 | **Client portal** | dashboard/* | `client/*`, `documents/download*` | Client A reads B; download authz; stuck states. |
| 6 | **Partner / pro portal** | pro/*, [partner-slug] | `partner/*`, `partners/*` | Self-serve financial flags, branding/domain abuse, client data scoping. |
| 7 | **Sales / admin** | sales/*, pro/sales/*, attorney/* (admin) | `sales/*`, `admin/*` | Privilege boundaries, commission math, lead/prospect leakage. |
| 8 | **Attorney review** | attorney/*, review/[id] | `attorney/*`, `checkout/attorney` | $300 routing (100% to attorney), SLA, doc upload authz. |
| 9 | **Marketing / public** | landing, partner pages, quiz, contact, share | `marketing/*`, `share`, `contact`, `quiz/*`, `csp-report` | Injection, partner-slug spoofing, lead spam, info leak. |

---

## Phased execution (run in this order)

### Phase 0 — Baseline (once, before hunting)
- `npm test` and `npm run test:e2e` — capture what's already green (don't re-report covered bugs).
- `npx tsc --noEmit` + `npm run lint` — surface type/lint-level real bugs.
- `npm run crypto:vectors:check` — confirm crypto vectors intact.
- Grep price drift: `grep -rn -E "40000|60000|30000|\$400|\$600" app lib components`.
- Re-verify open entries BUG-1..BUG-15 still reproduce; close any now-fixed.

### Phase 1 — Money path (Domain 1) 🔴 do first
Hunt: order/Stripe ordering (BUG-1), webhook idempotency + reconciliation (BUG-2/H2), doc-gen failure handling (BUG-3/H2), payout splits + double-pay, amount integrity (client can't influence), promo/test abuse (BUG-14), subscription lifecycle (cancel/sync/status), account linking on success (BUG-4), refund/chargeback path.
Key files: `lib/checkout/*`, `lib/webhooks/stripe/*`, `lib/orders/*`, `lib/stripe-payouts.ts`, `app/api/checkout/*`, `app/api/subscription/*`, `app/api/documents/*`, success pages.

### Phase 2 — Core Rules (Domain 2) 🔴
Hunt: hard-stop enforcement on every entry (BUG-9), acknowledgment gate server-side (BUG-8), price/split drift vs SSOT, attorney-review $300 invariant, no-legal-advice copy ("Based on your answers", never "We recommend").
Key files: `app/quiz`, `app/will`, `app/trust`, `lib/trust-types.ts`, `lib/orders/pricing.ts`, `lib/attorney-review/routing.ts`, document templates.

### Phase 3 — Vault & crypto (Domain 3) 🔴
Hunt: cross-tenant leaks via unscoped storage paths / signed URLs (BUG-10 pattern — check farewell, download-url, download-document, file-key, trustee routes), PIN brute-force/lockout, encryption correctness + key zeroing, trustee invite/OTP lifecycle + expiry, backfill safety, data-loss on overwrite/delete, decrypt-failure masking.
Key files: `app/api/vault/*`, `app/api/crypto/*`, `app/api/trustee/*`, `app/api/farewell/*`, `lib/crypto/*`, `lib/repos/server/*Repo` for vault/farewell/trustee.

### Phase 4 — Auth & sessions (Domain 4) 🟠
Hunt: session vs client-supplied identity (BUG-6 pattern across all routes), signOut handoff pitfalls, verify-code/link replay + expiry + rate-limit, set-password/recovery abuse, orphaned-session handling (BUG-5), email-enumeration on check-email/check-verification, login-routing role leakage.
Key files: `app/api/auth/*`, `lib/auth/*`, `lib/supabase/middleware.ts`, `app/auth/*`.

### Phase 5 — Client portal (Domain 5) 🟠
Hunt: client A reads B (RLS assumptions), document download authz + attorney-review gate, settings/funding-checklist/mark-executed scoping, lost-state dead-ends (BUG-7/BUG-15), null derefs on optional profile/order fields.
Key files: `app/dashboard/**`, `app/api/client/*`, `app/api/documents/download*`.

### Phase 6 — Partner / pro portal (Domain 6) 🟠
Hunt: partner self-update can't set financial flags (verify whitelist holds), branding/logo/domain takeover (`add-domain`, `verify-domain`, `vault-subdomain`), partner sees only own clients, invite-client abuse, revenue math vs SSOT, partner vault-client checkout pricing.
Key files: `app/api/partner/*`, `app/api/partners/*`, `app/pro/**`, `app/[partner-slug]/**`.

### Phase 7 — Sales / admin (Domain 7) 🟠
Hunt: role boundaries (rep vs admin vs platform-admin), commission/payout math, create-partner/create-rep authz, prospect/lead cross-leak, affiliate payout/status authz, admin-only routes reachable by lower roles, regenerate-docs abuse.
Key files: `app/api/sales/*`, `app/api/admin/*`, `app/sales/**`, `app/pro/sales/**`.

### Phase 8 — Attorney review (Domain 8) 🟡
Hunt: $300 routing 100%-to-attorney invariant, review assignment/approval authz, SLA logic, reviewed-doc upload authz + integrity, farewell-verification access, attorney can only see assigned reviews.
Key files: `app/api/attorney/*`, `app/api/checkout/attorney*`, `lib/attorney-review/*`, `app/attorney/**`.

### Phase 9 — Marketing / public (Domain 9) 🟡
Hunt: partner-slug spoofing/enumeration, marketing material generation (injection, path/access), share/contact lead spam + validation, quiz personalize abuse, info leak in public pages, CSP-report endpoint abuse.
Key files: `app/api/marketing/*`, `app/api/share`, `app/api/contact`, `app/api/quiz/*`, `app/[partner-slug]/**`, public pages.

---

## Cross-cutting passes (run after the domain phases, across whole codebase)

- **A. Auth/ownership sweep** — every API route: is identity from the session? is every row scoped to the caller? (catches the BUG-6/BUG-10 class everywhere at once).
- **B. Validation-boundary sweep** — every route parses body/params with Zod before use; no `.passthrough()` on data that drives documents/money (BUG-12 class); numeric bounds.
- **C. Race / idempotency sweep** — double-submit, concurrent webhook + success page, missing `await`, fire-and-forget writes with swallowed errors (BUG-11 class).
- **D. Error-handling sweep** — `catch {}` that hides failures; 200 returned on partial failure; unhandled rejections.

---

## Execution mechanics

- **Parallelize:** one `bug-hunter` agent per domain (Phases 1–9 can fan out; keep the worst-risk three reviewed by a human first). Each writes a report; consolidate + dedupe before logging.
- **Two test accounts** ready (client A + client B) for cross-tenant checks (Domain 3/5/6).
- **Staging env** with toggles to force failures (bad Stripe key, Redis off, webhook disabled) for money-path repros.
- **Log discipline:** after each phase, append confirmed findings to `BUGS.md` (continue BUG-N), regenerate `BUGS.html`.

---

## Coverage tracker

| Phase | Domain | Status | New bugs | Logged |
|-------|--------|--------|----------|--------|
| 0 | Baseline | ☐ | — | — |
| 1 | Money path | ☐ partial (BUG-1..4,8,11,14) | | |
| 2 | Core Rules | ☐ partial (BUG-8,9) | | |
| 3 | Vault & crypto | ☐ partial (BUG-10) | | |
| 4 | Auth & sessions | ☐ | | |
| 5 | Client portal | ☐ partial (BUG-5,6,7,15) | | |
| 6 | Partner / pro | ☐ | | |
| 7 | Sales / admin | ☐ | | |
| 8 | Attorney review | ☐ | | |
| 9 | Marketing / public | ☐ | | |
| A–D | Cross-cutting | ☐ | | |

**Done when:** every phase + cross-cutting pass is complete, all confirmed bugs are logged, and re-running the phase surfaces nothing new.
