# Certification enforcement — lockout implications

**Date:** 2026-09-15 · **For:** the review session

## What changed

Certification was a facade. The exam page had no questions; a button called
`POST /api/partner/certify`, and that route set `certification_completed = true`
after reading nothing from the request. The flag then gated nothing on the
server — the "🔒 Complete Certification" lock on the clients screen was a
disabled button in the browser, and the routes behind it accepted uncertified
partners.

Three changes, no exam content built:

1. `POST /api/partner/certify` requires an `admin` or `sales_rep` session and
   takes the partner it is certifying. A partner can no longer certify
   themselves. The action is written to the audit log with the actor.
2. `GET /api/partner/clients` and `POST /api/partner/invite-client` refuse an
   uncertified partner with 403.
3. The partner-facing "Pass Exam (Test Mode)" button is gone, along with the
   `certifyMe()` client helper. It could not work against an admin-only route in
   any environment, so it was removed rather than left to 403.

## The lockout implication — needs a decision

**Every partner certified before today was certified by pressing that button.**
No exam existed, so the flag records only that someone clicked. Those partners
keep the flag — this change does not clear it — so nothing breaks for them today.

The decision is whether that is acceptable:

- **Leave them certified.** Nothing changes for existing partners. The flag
  keeps meaning "clicked a button" for everyone certified before 2026-09-15 and
  "an admin confirmed it" after.
- **Clear and re-confer.** Set `certification_completed = false` for all
  partners and have Admin re-confirm each one. Every partner loses access to
  their clients list and invite flow until someone re-confirms. That is a real
  outage for the partner base and needs sequencing with whoever manages them.

**Recommendation: clear and re-confer, but only once an admin has a way to do
it.** See the gap below.

## Gap: Admin has no UI for this

The route exists and is admin-only, but nothing in the sales/admin screens calls
it. Conferring certification today means an API call by hand. If the decision is
to re-confer, the admin partner-detail page needs a button first — roughly an
hour's work, not included here because the brief was enforcement only.

## What is still not true

There is still no exam. A certified partner has demonstrated nothing about the
training content; certification now records an Admin's judgement instead of a
partner's click. Real modules and a scored exam remain a separate product task.
