# EstateVault — Scalability Fix Plan

_Created 2026-06-02. A plain-English plan to finish the **unfinished** and **partly-done** items from [SCALABILITY_AUDIT.html](SCALABILITY_AUDIT.html). The "✅ Done" items (B1 admin client, B6 pricing, B8 types, serverless state) are left out — they're finished._

## How to read this

- Each item: **what it is** · **why it matters** · **how to do it (steps)** · **effort** · **risk**.
- Effort: **Quick** (an afternoon) · **Medium** (a few days) · **Big** (phased over weeks).
- Do them in the order below — quick wins first, the big architecture job last.
- After every change, run the gate: `npx tsc --noEmit && npm run lint && npm test`. Never touch pricing/split/hard-stop logic.

---

## The 5 items, simplest first

| Order | Item | What | Effort | Status (2026-06-02) |
|-------|------|------|--------|--------------|
| 1 | B7 | One name for the app's URL | Quick | ✅ **Done** — `getAppUrl()`, all 13 usages |
| 2 | B4 | Finish the shared login check | Quick | 🟡 **Mostly done** — 49 routes on `requireAuth`; ~10 left (intentional) |
| 3 | B3 | Send all email through one place | Medium | 🟡 **Client centralized** (28→1 `getResend()`); from/branding left |
| 4 | B5 | One shared "call the API" helper | Medium | ✅ **Done** — `lib/api-client/` adopted by ~50 screens; 0 raw internal fetch |
| 5 | B2 | Stop screens talking to the DB directly | Big | ✅ **Done** — every browser-side screen off direct `supabase.from()`; only 2 server-side RLS auth gates left by design |

> **Progress 2026-06-02:** B7 fully implemented; B4 advanced (14 routes migrated); B3 client centralized (all 15 inline `new Resend(...)` → shared `getResend()`, 28→1 init). Verified: `tsc` clean of new errors, 376 tests pass, lint clean. **B3 remaining (lower value, needs live email testing):** ~19 routes still hardcode the from-address and call `resend.emails.send()` directly instead of a branded `lib/email.ts` helper — that change alters retry/error semantics. **Left as intentional:** ~10 B4 routes (checkout `userId`-match, marketing PDFs, `auth/welcome` user-metadata).

> **Progress 2026-06-03 (B2 complete, commit `9a0d97a`):** All ~30+ browser-side screens converted to typed `lib/api-client/*` calls over `withRoute`/`requireAuth` endpoints — onboarding steps 1-7 + 3 vault variants, pro/settings, pro/revenue, both sales partner-detail twins, sales/commission, client dashboard (funding-checklist, settings), and the sales/pro-sales/attorney portal layouts. ~25 new API routes + matching repos. **Security hardened in the move:** promo fee-waiver (`one_time_fee_paid`) now server-validated on both the partner-self and sales-rep paths; financial fields excluded from the partner self-update whitelist; logo upload runs server-side; sales partner-detail enforces ownership via `created_by` (foreign id → 404). **e2e** anon-rejection guards added for every new endpoint. Verified: `tsc` clean (1 pre-existing `quizSessionRepo` error untouched), 376 unit pass, lint clean. **Left by design:** `app/pro/layout.tsx` and `app/dashboard/page.tsx` — server components that read via the RLS-scoped server client; routing them through admin repos would bypass RLS for no browser-leak benefit.

**All 5 items now done or intentionally parked.** B2 — the big one — is complete: no client screen talks to the database directly.

---

## 1 · B7 — Give the app's URL a single name

**What it is.** The app's own web address is read from an environment variable, but the code uses **three different names** for it: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_BASE_URL`.

**Why it matters.** This isn't just messy — it's a real bug. A password-reset or email-verification link can be built from the **wrong domain** depending on which file runs. A user could get a link that points nowhere.

**How to do it.**
1. Make one tiny helper, e.g. `lib/config/appUrl.ts`:
   ```ts
   export function getAppUrl(): string {
     return (
       process.env.NEXT_PUBLIC_SITE_URL ||
       process.env.NEXT_PUBLIC_APP_URL ||
       process.env.NEXT_PUBLIC_BASE_URL ||
       "https://www.estatevault.us"
     );
   }
   ```
2. Find every use of those three vars (`grep -rn "NEXT_PUBLIC_SITE_URL\|NEXT_PUBLIC_APP_URL\|NEXT_PUBLIC_BASE_URL" app lib`) — about 12 files.
3. Replace each with `getAppUrl()`.
4. In `.env.example`, keep only `NEXT_PUBLIC_SITE_URL` and delete the other two.

**Effort:** Quick. **Risk:** Low (and it fixes a correctness bug).

---

## 2 · B4 — Finish the shared login/permission check

**What it is.** Routes that need a logged-in user used to each write their own "is this person allowed?" code. A shared helper, `requireAuth()`, now does this — and **35 routes use it** — but a handful still hand-roll the check.

**Why it matters.** When the rule changes (add a role, add an audit log, add a lockout), you want to edit **one** place, not chase the leftovers. Hand-rolled checks also return inconsistent error messages, which confuses the frontend.

**How to do it.**
1. List the stragglers: `grep -rln "auth.getUser()" app/api` then remove the ones that already use `requireAuth`.
2. For each, replace the manual `getUser()` + `profiles.user_type` lookup with:
   ```ts
   const auth = await requireAuth(["partner", "admin"], req); // the roles it needs
   if ("error" in auth) return auth.error;
   ```
3. Use `auth.admin`, `auth.user`, `auth.profile` from the helper instead of re-creating them.
4. Make sure the route is wrapped in `withRoute(...)` like its neighbors.

**Effort:** Quick. **Risk:** Low (mechanical — copy the pattern from a neighbor route).

---

## 3 · B3 — Send all email through one place

> **✅ Step 1 done (2026-06-02):** all 15 inline `new Resend(...)` clients replaced with the shared `getResend()` from `lib/email.ts` (28 → 1 client init, no more inconsistent key forms). Verified green. **Remaining:** the per-route from-address + branded-template step below — lower value, needs live email testing because it changes retry/error behavior.

**What it is.** **15 routes** still create their own email client (`new Resend(...)`) and call send directly, instead of going through the shared `lib/email.ts`.

**Why it matters.** Change the sender domain or the email branding and today you edit ~15 files. `lib/email.ts` already has branded templates — the routes just bypass it.

**How to do it.**
1. Find them: `grep -rln "new Resend(" app/api`.
2. For each kind of email being sent, add (or reuse) a function in `lib/email.ts` — e.g. `sendPartnerWelcomeEmail({...})`.
3. Replace the inline `resend.emails.send(...)` in the route with a call to that function.
4. Remove the inline `new Resend(...)` and the hardcoded from-address.
5. Send a test of each email type (Resend test mode / dashboard) to confirm it still arrives.

**Effort:** Medium. **Risk:** Medium — you're touching live email; test each type before shipping.

---

## 4 · B5 — One shared "call the API" helper

> **✅ Done (verified 2026-06-02).** Re-measuring showed this was already resolved by the Jun-2 refactor: the typed `lib/api-client/` layer (11 domain modules over `client.ts` → `authedFetch`) is imported by ~50 screens, and there are **0 raw internal `/api/` fetches** left in client code. The audit's "2 files use authedFetch" counted only *direct* calls and missed that the wrappers route through it — so token-refresh-on-401 now reaches every screen. The only `fetch("/api/…")` left are 3 server-side calls to external APIs (Vercel/domain providers), which correctly don't use `authedFetch`. No code change needed. The detail below is kept for reference.

**What it was.** Screens made ~122 raw `fetch("/api/...")` calls. The shared wrapper that **refreshes an expired login and retries** (`lib/api/authedFetch.ts`) was used in just **2 files**. The typed wrappers live in `lib/api-client/`.

**Why it matters.** With raw `fetch`, a user whose login token quietly expired gets a **random logout or a silent failure** instead of a smooth refresh-and-retry. There's also no shared loading/error handling, so every screen reinvents it.

**How to do it.**
1. Decide the standard: use `lib/api-client/*` typed wrappers (preferred — they give types too) built on `authedFetch`.
2. For each feature area, add small client functions, e.g. `lib/api-client/partners.ts` → `listPartners()`, `createPartner(...)`.
3. Replace the screen's raw `fetch("/api/partners")` with `listPartners()`.
4. Do this **alongside item 5 (B2)** — when you give a screen an API route, give it a client function at the same time.

**Effort:** Medium. **Risk:** Medium. **Best combined with B2.**

---

## 5 · B2 — Stop screens from talking to the database directly  ⭐ the big one

**What it is.** **53 UI screens** run database queries (`supabase.from(...).select/insert/update`) **inside the screen itself** — no API route in between. The only thing protecting the data is row-level security (RLS).

**Why it matters.**
- Business rules live inside screens, so there's no single place to add logging, caching, validation, or rate-limiting.
- A second frontend (a mobile app) couldn't reuse any of it — it'd be a full rewrite.
- One weak RLS policy = **direct data exposure** with no server-side backstop.

**How to do it — phase it, do NOT do all 53 at once.**

For each screen, the pattern is always the same three layers (copy how the vault feature already does it):
1. **Repo** — put the DB query in `lib/repos/server/<thing>Repo.ts` (e.g. `partnerRepo.listForRep(...)`).
2. **API route** — add `app/api/<thing>/route.ts` that does: `requireAuth(...)` → validate input (Zod) → call the repo → return `ok(...)`.
3. **Client + screen** — add a client function in `lib/api-client/` (this is item B5), then change the screen to call it instead of touching `supabase` directly.

**Suggested phases (one area per PR):**
- **Phase A — `app/pro/*`** (the biggest cluster: dashboard, clients, revenue, the 11 onboarding steps). Most screens, highest payoff.
- **Phase B — `app/sales/*` and `app/pro/sales/*`** (pipeline, partners, commission).
- **Phase C — dashboard / attorney / checkout-success screens.**
- **Phase D — the `components/*` that query the DB** (DocumentActions, PackageStatusCard, etc.).

**Per-phase checklist.**
- [ ] Move each query into a repo function.
- [ ] Wrap it in an API route with `requireAuth` + Zod.
- [ ] Add a client function; switch the screen to it.
- [ ] Screen no longer imports the browser `supabase` client for data.
- [ ] `tsc + lint + test` green; click through the screen in the browser.

**Effort:** Big (weeks, phased). **Risk:** High if rushed — that's why it's split into small per-area PRs. This is the main remaining architecture + security work.

> **✅ Done (2026-06-03, commit `9a0d97a`).** All four phases complete — every browser-side screen now goes repo → API route → `lib/api-client/*` → screen, never `supabase` directly.
>
> **Converted (~30+ screens):** Phase A — pro/onboarding steps 1-7 + step-2/3/4-vault (incl. logo uploads + promo comp), pro/settings, pro/revenue, pro/{support,preview,training,clients,clients/[id],vault-clients,documents,dashboard}. Phase B — sales + pro/sales partner-detail (both twins), sales/commission, sales/partners, sales/dashboard, pipelines. Phase C — client dashboard (funding-checklist, settings), dashboard/documents, attorney reviews/pipeline. Layouts — sales, pro/sales, attorney portal gates via `getMyProfile()`.
>
> **New endpoints (~25):** `partner/{me PATCH, invite-client, apply-promo, logo}`, `profile/me PATCH` (+returns `user_type`), `sales/partners/[id]` GET+PATCH & `.../apply-promo`, `sales/my-platform-commission`, `client/{funding-checklist, settings}`, plus the earlier partner/sales/attorney read endpoints.
>
> **Security hardened in the move:** promo fee-waiver (`one_time_fee_paid`) re-validated server-side on **both** the partner-self and sales-rep paths — the screen can no longer flip the financial flag; financial fields excluded from the partner self-update whitelist; logo upload runs server-side under the partner's own id; sales partner-detail enforces ownership via `created_by` (foreign id → 404, a guard the old client page lacked).
>
> **Verified:** `tsc` clean (1 pre-existing `quizSessionRepo` error untouched), 376 unit pass, lint clean, e2e anon-rejection guards for every new endpoint.
>
> **Left by design (NOT browser DB calls):** `app/pro/layout.tsx` and `app/dashboard/page.tsx` — server components reading through the RLS-scoped server client. Routing them through admin repos would **bypass RLS** for no browser-leak benefit, so they stay as server-side auth gates.
>
> **Open flag for review:** `custom_review_fee` is in the partner self-update whitelist (partner-editable in-house review fee). Lock server-side if the fixed-pricing rule should cover it.

---

## Suggested order & rough timeline

1. **Week 1 (quick wins):** B7 (app URL) → finish B4 (login check) → start B3 (email).
2. **Week 2:** finish B3 → set up the `lib/api-client/` standard for B5.
3. **Weeks 3+:** B2 phase by phase (A → B → C → D), bringing B5 client functions along with each phase.

Quick wins (B7, B4, B3) are safe and give a fast, visible structural improvement. B2+B5 is the real project — take it one area at a time, verifying each in the browser before moving on.

**Never under "cleanup":** don't change the fixed prices, the revenue-split math, or the hard-stop rules (special-needs dependent, irrevocable trust). Those are business law in `CLAUDE.md`.
