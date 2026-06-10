---
name: bug-hunter
description: >
  Hunt bugs and audit business-rule correctness in the EstateVault codebase, then
  log confirmed findings to BUGS.md. Use this WHENEVER the user wants to find bugs,
  test the platform, make it "bug-free", harden a flow, audit correctness, or asks
  things like "what could break in checkout?", "are the prices/splits right?",
  "is the vault flow safe?", "review this for bugs", "stress-test the order flow",
  or "go find problems". Trigger even if the user doesn't say the word "bug" —
  any request to verify a flow works, check edge cases, or confirm money/rule logic
  is correct should use this skill. Specializes in EstateVault's money path
  (checkout → Stripe → webhook → fulfillment), the hardcoded Core Rules (pricing,
  revenue splits, hard stops, no-legal-advice, acknowledgment gates), and the vault.
---

# EstateVault Bug Hunter

Find real, reproducible bugs in EstateVault — not style nits, not hypotheticals.
Every finding must be traceable to `file:line` and explain how it actually breaks.
Confirmed findings get logged to [BUGS.md](../../../BUGS.md) in the existing format.

The goal is a platform that takes people's money and protects their families
without losing data, mischarging, or giving bad output. Bias toward the failures
that hurt that promise: paid-but-nothing-delivered, wrong price/split, broken
hard stop, leaked or lost vault data.

## Workflow

1. **Scope.** If the user named a flow (checkout, vault, webhook, doc-gen), focus
   there. If they said "the whole platform" or "make it bug-free", default to the
   high-value surfaces in priority order below — don't try to read everything at once.

2. **Read before judging.** Open the actual files. A bug you can't point to in code
   is a guess. Trace the real call path (route → repo → server client → DB), not
   what you assume the code does. Use the neighbor files to learn the conventions
   so you don't flag intentional patterns as bugs.

3. **Hunt by category.** Walk the checklists in `references/bug-categories.md`. For
   the Core Rules, verify against the canonical constants in
   [lib/orders/pricing.ts](../../../lib/orders/pricing.ts) and
   [lib/attorney-review/routing.ts](../../../lib/attorney-review/routing.ts) — never
   trust a number hardcoded elsewhere; cross-check it against that source of truth.

4. **Confirm, don't speculate.** Before logging, ask: can I write the repro? Does
   the failing path actually reach this code? If a test already covers it, it's not
   a bug. Check `tests/` and the `*.test.ts` files before claiming something is
   untested. Run `npm test` to see what's currently green.

5. **Report + log.** Output the markdown report (format below). Append every
   **confirmed** finding to BUGS.md using its existing structure. Don't log
   speculation — keep "maybe" findings in the report's Needs-Verification section.

## Priority surfaces (where the money and trust live)

1. **Money path** — `lib/checkout/createCheckoutSession.ts`, `lib/webhooks/stripe/`,
   `lib/orders/`, the success/set-password flow. Failure = paid but nothing delivered,
   or charged wrong amount. This is where BUG-1..BUG-7 already live.
2. **Core Rules** — pricing, revenue splits, hard stops, acknowledgment gate,
   no-legal-advice copy. These are business law (CLAUDE.md). Any drift is critical.
3. **Vault** — `components/vault/`, `lib/crypto/`, vault repos. PIN, encryption,
   access control, data loss.
4. **Auth & ownership** — `lib/auth/`, RLS assumptions, client-supplied IDs trusted
   over server session (see BUG-6).
5. **Validation boundary** — `lib/validation/schemas.ts`. Missing/loose Zod at an
   API edge = bad data reaching the DB.

## Report structure

Use this template. Severity scale matches BUGS.md: Critical > High > Medium > Low.

```
# Bug Hunt — <scope> — <date>

## Summary
<one line: N findings, X critical/high, areas covered>

## Confirmed findings
### <SEV> — <short title>
- **Area:** file:line
- **What:** the defect
- **Impact:** what the user/business loses
- **Repro:** concrete steps
- **Fix:** the smallest correct fix

## Needs verification
<findings you suspect but couldn't confirm — say what would confirm them>

## Checked & OK
<surfaces you audited and found sound — so the user knows coverage>
```

## Logging to BUGS.md

- Match the existing entry format exactly (see current BUG-1..BUG-7).
- Continue the numbering (BUG-8, BUG-9, …). Read the file first to get the next number.
- Only log **confirmed** findings. Never duplicate an existing BUG-N — if you
  re-confirm or refine one, update that entry instead.
- If a finding is "largely fixed, verify", mark it like BUG-5 does.

## What is NOT a bug here

- Style, naming, formatting — out of scope (that's `/simplify` / lint).
- Intentional hardcoded business values in `lib/orders/pricing.ts` — those are law,
  not bugs. The bug is when *another* file disagrees with them.
- Anything already covered by a passing test.
- Pure speculation with no reachable code path. Put it in Needs-Verification, not BUGS.md.

When you want to also write tests or apply fixes, route through the
`software-engineer` skill so the typecheck+lint+test gate runs.
