# Pre-pilot follow-ups

Found during the staging no-payment smoke test of 2026-09-17 (preview built from
`staging` @ `7569ca8`) and the two fix batches that followed.

Status key: ☐ open · ☑ fixed. Fix batch 2 merged to `staging` as PR #8 (`53d2218`) on 2026-09-17;
the admin-email commit followed as `1e47d2c`. **☑ means fixed on `staging`; whether the preview or
production has rebuilt is a separate question — check the deployment id.**

## Pilot readiness — what blocks a first real client, and what does not

### Blockers

| # | Item | What unblocks it |
|---|------|------------------|
| B1 | **The paid path has never been smoke-tested.** Both purchases, the attorney-review add-on, the blocked-document test and the webhook hard-stop gate are all parked on Stripe test keys. | Test keys on Preview, then one run. |
| B2 | **Fix batch 2 — ☑ merged and proven.** Password reset verified end to end on the rebuilt preview on 2026-09-17 (exchange route 200, session established, password set, sign-in succeeded, token consumed). The trust document-set change is merged but its 7/8-row behaviour is only exercised by a trust order, which is parked with B1. | — |
| B3 | **`PDF_RENDERER` / compliance sign-off (item 1).** A Trust Package cannot be fulfilled with the flag unset, and `HANDOFF.md` says it must stay unset until sign-off. `MOCK_DOC_GENERATION` must not be set anywhere a client can reach. | A decision in the review session. Will Packages are not affected. |
| B4 | **Production database needs `20260916_000_trust_package_document_types.sql` before the code.** | Being applied by Sam, 2026-09-17. |
| B5 | **Production env was never checked (item 6).** The rate limiter fails OPEN without `UPSTASH_REDIS_REST_URL` / `_REST_TOKEN`, the example file named them wrongly until fix batch 2, and the boot-time guard that would catch it never runs. | Read the Production env vars in Vercel; two minutes. |
| B6 | **Promo-code namespace (decision A)** — only if any `PROMO_CODES` will be set in production during the pilot. With it empty this is inert. | A decision; or keep `PROMO_CODES` empty for the pilot. |
| B8 | **The reviewing attorney was a test address (item 8) — ☑ code fixed, accounts pending.** Paid reviews now route to the pilot relay `ahm3dkass@gmail.com` (`lib/config/contacts.ts`, marked PILOT RELAY; post-pilot: the reviewing attorney's own address). | **Staging: created 2026-09-18.** Production: scripted in `LAUNCH_PRODUCTION_ACCOUNTS.md`, to be run by Sam in the launch sequence — not before. |
| B9 | **The admin account must exist under `info@estatevault.us` (item 8) — ☑ code fixed, accounts pending.** Both addresses now live in one file, `lib/config/contacts.ts`; `scripts/create-admin.ts` creates the account under it. | **Staging: created 2026-09-18.** Production: scripted in `LAUNCH_PRODUCTION_ACCOUNTS.md`, launch sequence. |
| B7 | **Client-facing trust copy (decision E)** — the trust success page shows raw identifiers such as `certification_of_trust` and says the attorney "will review all 4 documents". Trust Package only. | Approved wording for four labels and one sentence. |

### Not blockers — fix after the pilot starts

Item 3 (orphaned staging PDFs — housekeeping; the erasure-policy question behind it should be
raised, but nothing breaks) · item 5 (leftover `quiz_sessions` rows) · item 7 (resume vs schema
edge cases — unreachable through the UI) · decision B (`verifiedToken` hand-off — fails closed) ·
decision C (.com vs .us — only affects test-kind promo codes) · decision D (wording) ·
grandfathered four-document trust orders (a business call, no defect) · remove `PROMO_CODES`
from the Preview environment (do it now; it is not a pilot question).

---

## 1. ☐ `PDF_RENDERER` mode on Preview is unconfirmed (`react-pdf` vs `react-pdf-strict`)

**What is known.** It is one of the two: all three smoke-test documents logged
`template-rendered … (v1.1.0-michigan / v1.0.0-michigan)`, which cannot happen with
the flag unset. `MOCK_DOC_GENERATION=true` is also set on Preview.

**Why it cannot be read from outside.** `lib/documents/generate-from-template.ts`
consults `isStrictTemplateMode()` only on its three failure branches (no template,
adapter failure, `validateForDocument` reports missing fields). Whenever a template
renders, the two modes are byte-for-byte identical. No route echoes env flags, and
this machine has no Vercel CLI, token or `.vercel/` link.

**Why it matters.** In non-strict mode a document that cannot render falls back
*silently* to the legacy path — and with `MOCK_DOC_GENERATION` on, that is a
placeholder document delivered to the client as if it were real. Strict mode marks
it `blocked` and alerts an admin instead.

**To settle it (pick one).**
- Vercel → Project → Settings → Environment Variables → Preview → `PDF_RENDERER`. Ten seconds.
- Or one free-promo order on staging with `organDonation: "specific_purposes"` and an
  empty `organDonationPurposes`. That passes Zod but fails `validateForDocument("ahcd")`,
  so the healthcare directive ends `blocked` (strict) or `claude-generated`/mock
  (non-strict). This is a write; not run.

**Related gap the test above exploits.** `willIntakeSchema` / `trustIntakeSchema` accept
`specific_purposes` with blank purposes; the template requires them. Add a `.refine()`
so the questionnaire's requirement and the template's agree.

**Decide before pilot:** production should run `react-pdf-strict`, and
`MOCK_DOC_GENERATION` must not be set anywhere a real client can reach.

**This is now a hard requirement for selling Trust Packages, not just a preference.** `HANDOFF.md`
says `PDF_RENDERER` "is unset and must stay unset until compliance sign-off". Four of the Trust
Package's documents (Certification of Trust, both Assignments, Funding Instructions) exist ONLY as
templates — there is no legacy generator for them. With the flag unset a trust order cannot be
completed: since fix batch 2 those documents are marked `blocked`, the order is held and one admin
alert goes out (before, the order was marked delivered with four of its seven documents). So either
compliance signs off on the template renderer before the first trust sale, or trust sales wait.

---

## 2. ☑ Emailed password-reset link always fails for a signed-out user — fixed in fix batch 2

**Trace.**
1. `/auth/forgot-password` → `POST /api/auth/recovery` (public) → emails
   `{origin}/auth/reset-password?token_hash=…&type=recovery` (`app/api/auth/recovery/route.ts:70`).
2. `/auth/reset-password` (public page) calls `exchangeResetToken()` on mount, which is
   `publicPost("/api/auth/exchange-reset-token")` — no session, by definition: the
   person forgot their password (`app/auth/reset-password/page.tsx`, `lib/api-client/auth.ts`).
3. `/api/auth/exchange-reset-token` is **not** in `publicPaths`
   (then an inline array in `lib/supabase/middleware.ts`) and never had been since the route was added in
   `b326e52` (2026-06-09). Middleware answers `401 {"error":"unauthorized"}` before the
   handler runs. Observed live on the preview.
4. The page maps any non-`link_already_used` error to *"This reset link is invalid or
   has expired. Please request a new one."* — so every reset attempt dead-ends, and
   requesting a new link repeats it.

The only caller who gets through is someone already signed in on that browser.
The token is not burned by the 401 (the handler never runs), so links already sent
will work once this is fixed, until they expire.

**Production today:** not affected. `origin/master` has no `exchange-reset-token` route;
its reset page uses Supabase's native `PASSWORD_RECOVERY` auth event. The break ships
when `staging` is promoted.

**Fixed (batch 2).**
- The allowlist moved out of middleware into `lib/supabase/publicPaths.ts` (`PUBLIC_PATHS`,
  `isPublicPath`) with `/api/auth/exchange-reset-token` added. The handler authenticates itself:
  `verifyOtp` against Supabase, which is also what creates the recovery session.
- It is rate-limited by source (`authIpRateLimit`), as `set-password` is.
- The link is marked used only AFTER `verifyOtp` succeeds, and that write is best-effort: by then
  Supabase has consumed the token, so a store outage must not turn a successful reset into a 500.
  A new read-only `isResetTokenClaimed()` only picks the message (410 "already used" vs 400).
- A Supabase outage during verification is a 503 "try again", not "invalid or expired": the link is
  still unspent.
- The reset page exchanges the link once per load, drops the spent token from the address bar, and
  no longer reports a rate limit or a server error as a dead link. On reload it recovers the session
  only in the tab that actually used the link (a `sessionStorage` marker) — a session that merely
  happens to exist in the browser unlocks nothing. The decision is a pure function,
  `lib/auth/resetLinkState.ts`, table-tested in `tests/unit/reset-link-state.test.ts`.
- `tests/unit/public-api-allowlist.test.ts` checks every `publicPost` / `publicGet` / `postForm`
  call in `lib/api-client/` against `PUBLIC_PATHS`, and fails on any call it cannot read.
- **Not verified end to end:** that needs a real mailbox against a deployed build. Do one reset on
  the staging preview after this merges.

---

## 3. ☐ Staging storage: three orphaned PDFs from the smoke run

Bucket `documents`, folder
`280f9e7e-bba6-479c-9074-c0598725b869/7640ae23-80eb-4313-9f7d-e9a184735406/`
(`will.pdf`, `poa.pdf`, `healthcare_directive.pdf`). Every database row from the run
is deleted; these could not be, because Supabase's `storage.protect_delete()` trigger
refuses SQL deletes on `storage.objects` and no service key is available here. Delete
them from the Supabase dashboard (Storage → documents), staging project
`ededvmvmgrqqeqcemsuz` only.

**Underlying product question:** nothing in the app deletes storage objects when an
order or account is removed. Decide the retention/erasure behaviour before pilot.

---

## 4. ☑ Trust Package via free promo creates 4 documents, not 7/8 — fixed in fix batch 2

`handleFreePromo` and `handleTestPromo` insert document rows from `config.docTypes`
(`app/api/checkout/trust/route.ts` → `trust, pour_over_will, poa, healthcare_directive`).
Only the Stripe webhook uses `expectedDocumentTypes()` (7, or 8 for a joint trust).
A free or test trust order is therefore short the certification of trust, the
assignment(s) of personal property and the funding instructions — and
`/api/documents/status` will report them missing. Both promo paths now call `expectedDocumentTypes(productType, intakeAnswers)` and `docTypes` is gone
from the route configs (`tests/unit/promo-document-set.test.ts`). Rows on the free path now carry
`client_id` (without it they never reached the dashboard and could not be downloaded), and a failed
row insert rolls the order back with a 500 instead of answering 200 with zero rows.

**The same private four-type list was in five more places**, which the review of this batch found:
`process-now`, `process`, `generate` (the generators) and `reconcile-orders`, `orders-missing-docs`
(the monitors). So since the webhook fix (`8a4e53e`) a *paid* Trust Package also created seven rows,
generated four, and was marked delivered. All five now work from **the rows the order actually has** (`documentTypesForOrder`,
`orderDocumentProgress` in `lib/documents/trust-package.ts`), falling back to `expectedDocumentTypes()`
only for an order with no rows. Two reasons: creation and generation can no longer disagree about a
joint trust, and an order created when the package was four documents stays four — measured against
today's list it would look unfinished forever and the reconcile cron would re-dispatch and alert on
it every 15 minutes. A test fails if a file in `app/` or `lib/` spells out a package's documents as
an array literal again (it catches that shape, not every conceivable one).

**Decision left for you:** trust orders created before this change have four documents. They are
grandfathered, not backfilled. If those clients are owed the other three or four, that is a
one-off backfill (insert the missing rows, then `regenerate-missing`). **Deploy note:** like the webhook
fix, this needs `20260916_000_trust_package_document_types.sql` applied to a database BEFORE the
code reaches it, or trust inserts fail the `document_type` CHECK. Staging has it; production does not yet.

---

## 5. ☐ Refused free-promo requests leave `quiz_sessions` rows behind

On the mailbox-guard 409, `handleFreePromo` now deletes the `pending` order (mirroring
the BUG-9 Stripe-failure rollback), but the `quiz_sessions` row inserted just before it
stays, attached to the existing account's client and holding a full copy of the
caller-supplied intake. Two were left by the smoke test's refused requests. The
Stripe-failure path has the same leftover. The new 500 rollback (document rows could not be
created) has it too, and on the free path it can also leave the just-created account behind, so a
retry with the same email is told to sign in. Delete the quiz session in both rollbacks, or
move the account check ahead of the order and quiz-session inserts so a refused request
writes nothing.

---

## 6. ☐ Production environment has never been verified, and the guard that would catch it is dead

`lib/rate-limit.ts` hands every route a limiter that always allows when
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are absent — no in-memory fallback, no
error, every `429` branch becomes dead code. Preview is configured correctly (429s observed in the
smoke test). Production has not been looked at, and `.env.local.example` told whoever provisioned
it to set `UPSTASH_REDIS_URL` / `_TOKEN`, which the limiter does not read.

`lib/env.ts` lists both as required and throws at boot under `NODE_ENV=production` — but its only
caller is `instrumentation.ts`, and Next 14.2 runs that file only with
`experimental.instrumentationHook: true`, which `next.config.mjs` does not set. So a
mis-configured production starts silently. **Before pilot:** read the Production env in Vercel.
**Fix:** enable the hook (check first that every variable `lib/env.ts` requires really is set, or
the next deploy will refuse to boot).

---

## 7. ☐ The resume check and the checkout schema disagree on two healthcare answers

`lib/intake/incomplete-steps.ts` treats `organDonation` as answered if it is any non-empty string,
and does not list `hasHealthcareWishes` at all; `willIntakeSchema` / `trustIntakeSchema` require an
enum and a Yes/No. A stored snapshot with a legacy value (e.g. `organDonation: "Yes"`) passes
resume, reaches checkout, and gets a 400 it cannot explain. Not reachable by someone filling the
questionnaire today — the card's own gate (`components/intake/PoaPadSteps.tsx`) enforces both —
only by a restored pre-change snapshot or a direct API call. Make the three agree.

---

## 8. ☑ Two accounts are found by hardcoded email — one source of truth now; the accounts themselves are B8/B9

`handleAttorneyReview` (the Stripe webhook's attorney-review step) turns two addresses into
profile ids by lookup. They were two constants in `lib/attorney-review/routing.ts`, one a personal
Gmail address and one a test placeholder. Both now live in **`lib/config/contacts.ts`** and nothing
else may spell them (`tests/unit/contacts.test.ts`):

- `PLATFORM_ADMIN_EMAIL = "info@estatevault.us"` → `attorney_reviews.fee_controlled_by`, and the
  recipient of fulfilment-failure alerts. The seed migration `20260401_001` repeats it (SQL cannot
  import); the test keeps the two in step.
- `REVIEW_ATTORNEY_EMAIL = "ahm3dkass@gmail.com"` → `attorney_reviews.attorney_id`, the reviewer.
  **Pilot relay to the founder's inbox**, marked as such in the file; post-pilot it becomes the
  reviewing attorney's own address. `scripts/create-review-attorney.ts`,
  `scripts/reassign-pending-reviews.ts`, `scripts/create-admin.ts` and `scripts/reset-db.ts` all
  read from the same file, so running them creates exactly the accounts the webhook looks for.

If either account is missing the review row is still created, just without that id, and the webhook
logs an error naming the address. Staging has no users at all. **Before pilot:** the two accounts,
in production and staging (B8, B9), and someone reading the `info@` mailbox.

Placeholder addresses remaining in the repo, all legitimately test-only: `tests/fixtures/users.ts`
and `scripts/create-staging-test-users.ts` (the six `@estatevault.test` test accounts; documented in
`TESTING_PLAN.md`), and the `@example.com` hints in form placeholders. Dev-only admin logins
`admin2@` / `admin3@` / `salesadmin@estatevault.us` in `scripts/create-admin-dummy.ts`,
`create-admin3.ts`, `create-sales-admin.ts` are separate accounts, not the platform admin.

---

## Needs a product decision (left alone on purpose)

### A. ☐ One promo-code namespace serves clients AND partner fee waivers
`/api/checkout/attorney`, `/api/sales/create-partner`, `/api/partner/apply-promo` and
`/api/sales/partners/[id]/apply-promo` accept **any** enabled code (`isPromoEnabled`). This predates the
env refactor — the old code tested `code in PROMO_CODES` the same way — so it is not a regression, but it
means a client code such as `SMOKE0916:free` also waives an attorney partner's platform fee through a
direct POST, and a `test`-kind code does too. Meanwhile the partner *pages* decide by spelling:
`app/partners/attorneys/signup` only sends a code if the URL says `TPFP`, the server redirects to a
hardcoded `?promo=TPFP`, `…/welcome` checks for that literal, `app/partners/attorneys/page.tsx` and
`app/khan-lawgroup/page.tsx` validate the code field against `TPFP` and build the signup link from it,
`app/pro/sales/new-partner` shows "Valid" only for `FREE676`, and `app/pro/sales/partners/[partner-id]/page.tsx`
suggests `Free676` in its placeholder. Any fix to those pages has to answer the namespace question first.
**Suggested direction:** scope codes in config, fail-closed — `CODE:kind[:scope]` with scope
`client` (default) | `attorney_partner` | `sales_partner` — then have the pages ask the server.

### B. ☐ The checkout UI never sends `verifiedToken`
The server-side "proved" free-promo branch is reachable (PR #7) but no page supplies the token. Wiring
it means deciding whether the free flow should require the same email-verify step the paid flow uses.

### C. ☐ Which domain is real?
`CLAUDE.md` says estatevault.**com**; the middleware defaults and `isTrustedPromoOrigin` say
estatevault.**us**. The origin check is now an exact host match, so if production is `.com`, test-kind
promo codes will be refused there (they were before too — `.com` never contained the substring `.us`).

### D. ☐ Cosmetic: the will and trust checkout routes word the same validation failure differently
Nothing parses either string. Pick one wording.

### E. ☐ Labels and copy still describe a four-document Trust Package
Document-type labels live in ~30 separate places (both success pages, the dashboard, the attorney
review screen, emails, marketing pages and PDFs). The success pages have no label for
`certification_of_trust`, `assignment_personal_property_g1/g2` or `trust_funding_instructions`, so
they render the raw identifier, and `app/trust/success/page.tsx:271` tells the client the attorney
"will review all 4 documents". One shared label map is the fix, but the wording is client-facing
copy (and some of it marketing), so it needs the same review as the rest of the copy.

## Resolved from the PR #7 review (fix batch 2)

- ☑ `isTrustedPromoOrigin` matched by substring (`includes("estatevault.us")`) — now parses the
  Origin/Referer and compares the hostname.
- ☑ `.env.local.example` named `UPSTASH_REDIS_URL` / `_TOKEN`; the limiter reads the `_REST_` spellings.

## Still parked on Stripe test keys

Both purchases · attorney-review add-on · blocked-document test · the webhook hard-stop gate.
