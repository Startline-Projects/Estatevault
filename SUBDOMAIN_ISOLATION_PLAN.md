# Subdomain Session Isolation — Implementation Plan

**Date:** 2026-05-05
**Status:** Approved, deferred for later implementation
**Estimated effort:** 4–5 hours

---

## Problem

Client portal and partner portal share the same domain (`estatevault.com`). Browser cookies are domain-scoped, so:

- Logging in as a client in tab 1 and partner in tab 2 → second login overwrites the first.
- Server reads whichever cookie is set last → wrong user rendered.
- Users (especially internal team / power users with multiple roles) cannot use both portals concurrently in the same browser.

## Root Cause

Single-domain architecture. Cookies + localStorage shared across all tabs of `estatevault.com`. No way to isolate per tab without architectural change.

## Solution — Separate Subdomains

- `estatevault.com` (or `app.estatevault.com`) → client portal
- `pro.estatevault.com` → partner portal

Each subdomain gets its own cookie scope. Independent sessions. Industry standard (Stripe, Shopify, etc.). Already aligns with `CLAUDE.md` architecture plan.

---

## Phase 1 — Local Dev Hosts

1. Add to `/etc/hosts`:
   ```
   127.0.0.1 app.localhost
   127.0.0.1 pro.localhost
   ```
2. Run dev server on `:3000`. Access via `http://app.localhost:3000` and `http://pro.localhost:3000`.
3. Add env vars to `.env.local` + `.env.example`:
   ```
   NEXT_PUBLIC_CLIENT_HOST=app.localhost:3000
   NEXT_PUBLIC_PARTNER_HOST=pro.localhost:3000
   ```

---

## Phase 2 — Cookie Isolation

Files to patch:
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/middleware.ts`

In `cookies.set` options:
- Omit `domain` field (defaults to current host, no parent share).
- OR explicitly set `domain` = current request host.

Verify: log in on `app.localhost` → DevTools cookies present only on `app.localhost`, absent on `pro.localhost`.

---

## Phase 3 — Host-Based Routing

`lib/supabase/middleware.ts` — add host check at top:

```ts
const host = request.headers.get("host") || "";
const isPartnerHost = host.startsWith("pro.");
const isClientHost = host.startsWith("app.") || host === "localhost:3000";
```

Route guards:
- Partner host + path is `/dashboard|/quiz|/will|/trust` → redirect to client host, same path.
- Client host + path is `/pro/*` → redirect to partner host, same path.
- Auth pages (`/auth/*`) allowed on both.

Remove the existing cross-portal redirect block (lines 137–177). Host-based logic replaces it.

---

## Phase 4 — Login Redirect Logic

`app/auth/login/page.tsx`:
- After successful sign-in, fetch `profiles.user_type`.
- If on partner host but user is client → redirect to client-host `/dashboard`.
- If on client host but user is partner → redirect to partner-host `/pro/dashboard`.
- Else → stay on current host's appropriate landing page.

New helper `lib/hosts.ts`:

```ts
const proto = process.env.NODE_ENV === "production" ? "https" : "http";
export const clientUrl = (path = "/") => `${proto}//${process.env.NEXT_PUBLIC_CLIENT_HOST}${path}`;
export const partnerUrl = (path = "/") => `${proto}//${process.env.NEXT_PUBLIC_PARTNER_HOST}${path}`;
```

---

## Phase 5 — Internal Links + Emails

- Audit all `<Link>` and `router.push` calls. Hardcoded `/pro/*` from client pages → use `partnerUrl()`.
- Resend email templates: client emails link to client host, partner emails link to partner host.
- Stripe webhook: keep single canonical URL (server-side, host doesn't matter).

---

## Phase 6 — Tests

- Playwright config: add two projects, `clientApp` (baseURL `app.localhost`) and `partnerApp` (baseURL `pro.localhost`).
- Reroute existing specs:
  - Client/quiz/dashboard tests → `clientApp` project.
  - Partner specs → `partnerApp` project.
  - Cross-host tests (login redirect) → full URLs.
- Update `tests/e2e/helpers/auth.ts loginAs` to accept optional host arg.

---

## Phase 7 — Production Deploy

1. Vercel: add `estatevault.com` + `pro.estatevault.com` to project domains.
2. DNS: point both to Vercel.
3. Supabase Auth → Site URL + Redirect URLs: add both hostnames.
4. Production env vars:
   ```
   NEXT_PUBLIC_CLIENT_HOST=estatevault.com
   NEXT_PUBLIC_PARTNER_HOST=pro.estatevault.com
   ```
5. First deploy invalidates any old parent-domain cookies → users re-login once.

---

## Verification Checklist (post-deploy)

- [ ] Tab 1 `app.localhost` logged in as client. Tab 2 `pro.localhost` logged in as partner. Both stay logged in independently.
- [ ] Logout in tab 1 doesn't affect tab 2.
- [ ] Client visiting `pro.localhost/pro/dashboard` → redirected to client portal.
- [ ] Partner visiting `app.localhost/dashboard` → redirected to partner portal.
- [ ] Stripe webhook fires successfully.
- [ ] Resend emails point to correct host.
- [ ] Existing E2E suite still 100% pass (after Playwright config update).

---

## Risks / Gotchas

- Stripe webhook URLs: pick one canonical host (e.g. `pro.estatevault.com/api/webhooks/stripe`).
- Email links from Resend: must match user's portal host (client emails → `app`, partner emails → `pro`).
- OAuth callbacks (if added later): register both hosts.
- Existing users with cookies on parent `.estatevault.com`: invalidated on deploy, one-time forced re-login.
- Local dev: `app.localhost` / `pro.localhost` only resolves after `/etc/hosts` edit. Document in onboarding.

---

## Effort Breakdown

| Phase | Time |
|-------|------|
| 1 — Local hosts + env | 15 min |
| 2 — Cookie isolation | 45 min |
| 3 — Middleware routing | 1 hr |
| 4 — Login redirect | 30 min |
| 5 — Links + emails audit | 45 min |
| 6 — Tests | 1 hr |
| 7 — Production deploy | 30 min |
| **Total** | **~4.5 hrs** |

---

## Order of Work

1. Phase 1 first (lowest risk, sets up env).
2. Phase 2 → verify cookie scope locally before middleware changes.
3. Phase 3 + 4 together (interlinked).
4. Phase 5 audit pass.
5. Phase 6 test updates → run full suite.
6. Phase 7 deploy.

Each phase independently revertible.
