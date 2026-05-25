# Refactor / Audit Playbook

Use when the request is "this keeps breaking", "the code is messy / not structured", "clean this up", or "audit X". The goal is to make fragile code boring and safe — **without breaking the working parts**. A big-bang rewrite is the most common way a refactor introduces new bugs. Go in small, verified steps.

## Phase 1 — Map before you touch

Don't read the whole repo. Scope to the area named (a route, a feature, a `lib/` domain) plus its immediate seams.

1. **List the files** in the area and what each is responsible for.
2. **Trace one real flow** end to end (e.g. user clicks → component → `fetch` → route → repo → DB). Note every hop. This reveals where logic actually lives vs. where it should.
3. **Find the seams** — Grep the key function/type/route/table names across the whole repo to learn everything that depends on them. You can't safely change a shape until you know its callers.

## Phase 2 — Diagnose *why* it's fragile

Look specifically for the failure modes that cause "it keeps breaking" in this codebase. Rank findings by risk (what could corrupt data, break auth/payments, or silently ship wrong output) — not by how ugly they look.

Common culprits here:
- **Duplicated logic / parallel implementations.** The same concept done two+ ways (e.g. two auth checks, two ways to fetch the same data). Pick the canonical one; converge the rest.
- **Drifted patterns.** Code following an old doc instead of the current pattern (raw `getUser()` instead of `requireAuth`; queries inline in a route instead of a repo; migration at root). See `conventions.md` "Known doc drift".
- **Fat routes / fat components.** Business logic or DB chains where they don't belong → hard to test, easy to break. Move to `lib/repos` / `lib/<domain>`.
- **Weak types.** `any`, `as` casts, missing return types, optional fields that are actually always present. These are where runtime surprises hide. Tighten them.
- **Untested seams.** Critical logic (money, crypto, hard stops, auth) with no test. Fragile by definition.
- **Leaky errors / swallowed errors.** `catch {}` that hides failures, or raw DB errors returned to clients.
- **Input not validated at the boundary.** Routes trusting client-shaped JSON without a Zod parse.

## Phase 3 — Report, then get scope agreement

Before editing, give the user a short ranked report:

```
Area: <what you mapped>
Findings (highest risk first):
1. [risk] <problem> — at <file:line> — blast radius: <what depends on it>
   Fix: <concrete change>
2. ...
Suggested order: <which to do first and why>
```

Then confirm scope. "Fix everything" usually shouldn't happen in one pass — propose the smallest change that removes the most risk, and start there. The user picks how far to go.

## Phase 4 — Refactor in safe steps

For each change:
1. **Pin behavior first.** If the code has no test and it's risky, add a characterization test that captures current behavior *before* you change it — so you can prove you didn't alter what works.
2. **Make one change at a time.** Converge a duplicate, or extract a function, or tighten a type — not all three at once.
3. **Update all seams** found in Phase 1 in the same step, so nothing is left half-migrated (half-migrated is worse than not migrated).
4. **Verify** after each step: `npx tsc --noEmit`, `npm run lint`, `npm test`. Green before the next step.
5. **Keep diffs reviewable.** Prefer several small verified commits over one giant one.

## Phase 5 — Leave it more consistent than you found it

- If you converged on the canonical pattern, and a stale doc described the old one, fix the doc (or tell the user). Reducing drift is part of the job.
- Note any fragile spot you deliberately left alone and why, so it's not forgotten.
- Final summary: what was fragile, what you changed, what you verified, what risk remains.

## What not to do
- Don't rewrite a working module wholesale to make it "cleaner" — risk with no functional payoff.
- Don't change a public shape (route response, exported type, DB column) without updating every caller in the same change.
- Don't silence type/lint errors to make the gate pass — that re-buries the bug.
- Don't touch pricing, revenue splits, or hard-stop logic under the banner of "cleanup". Those are business law (see `conventions.md`).
