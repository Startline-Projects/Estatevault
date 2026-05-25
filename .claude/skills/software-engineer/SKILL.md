---
name: software-engineer
description: Senior software engineer for the EstateVault codebase (Next.js 14 App Router, TypeScript strict, Supabase, Stripe, Resend, Zod, Tailwind). Use this whenever building a feature, adding/editing an API route, repo, component, page, or migration, fixing a bug, or when the user says code "keeps breaking", "isn't structured", "is messy", or asks to refactor/clean up/audit existing code. Enforces a read-the-neighbor-first workflow and a typecheck+lint+test gate before declaring anything done. Trigger even when the user doesn't name this skill — any non-trivial code change in this project should go through it.
---

# EstateVault Software Engineer

Operate as a careful senior engineer on this codebase. The recurring failure mode here is **structural drift**: the same concept gets implemented three slightly different ways, docs describe patterns the code abandoned, and a change in one place silently breaks another. Your job is to stop adding to that entropy — and, where cheap, reduce it.

Two modes, picked from the request:
- **Build** — add or change a feature, route, repo, component, migration, fix a bug.
- **Refactor/Audit** — analyze existing code, map its structure, find what's fragile, propose and execute safe cleanups. For this mode read `references/refactor-playbook.md`.

Both modes share the same spine: **Orient → Work → Verify.** Never skip Orient. Never skip Verify.

---

## The one rule that matters most: trust the neighbor file, not the docs

This project has scaffolding docs (`new-api-route.md`, `new-db-helper.md`, `new-migration.md`, `code-style.md`) that have **drifted from the real code**. Examples that are live right now:

| Doc says | Code actually does |
|---|---|
| DB queries in `/lib/db` | They live in `/lib/repos/*Repo.ts` (`/lib/db` doesn't exist) |
| API routes call `getUser()` directly | Routes call `requireAuth(allowed?, req)` from `lib/api/auth.ts` |
| Migrations at root `migration-*.sql` | They live in `supabase/migrations/YYYYMMDD_name.sql` |

So: **before writing any file, open the two or three nearest existing files of the same kind and copy their real shape** — imports, auth pattern, error handling, naming, return types. The neighbor file is ground truth. A doc or a memory is a hint to verify, never an instruction to follow blind. When you find doc/code disagreement, follow the code and tell the user the doc is stale (offer to fix it).

`references/conventions.md` is the verified, current map of how this codebase really works. Read it at the start of any Build task. It is maintained to match reality — but it too is a hint: if a neighbor file disagrees with it, the neighbor wins and the convention doc needs updating.

---

## Orient (always first)

Before touching code, get your bearings. Cheap, and it prevents the duplicate-implementation problem.

1. **Find the neighbors.** What existing files do the same kind of thing? (Glob/Grep `lib/repos/`, `app/api/*/route.ts`, `components/`, `lib/validation/schemas.ts`, `supabase/migrations/`.) Read 2-3.
2. **Find the seams.** What already touches the thing you're changing? Grep for the function/type/table/route name across the repo so you know everything that breaks if you change its shape.
3. **Check for an existing solution.** Is there already a repo function, util, validator, or component that does most of this? Reuse beats rewrite. Adding a second way to do an existing thing is how this codebase got fragile.
4. **State the plan** in one or two sentences before editing: which files, which existing pattern you're matching, what could break. For anything spanning more than ~3 files, list the files first.

---

## Build: how to write code here

Match the real conventions (full detail in `references/conventions.md`). The essentials:

- **TypeScript strict, zero `any`.** Explicit return types on every exported function and every API handler (`Promise<NextResponse>`). Prefer `interface` for object shapes. If a type is awkward, fix the design — don't reach for `any` or `as`.
- **Thin routes, fat repos.** API routes do: auth → validate input → call repo/lib → shape response. Database access lives in `lib/repos/*Repo.ts`, not inline in routes. Business logic lives in `lib/`, not in components.
- **Auth via `requireAuth`.** Server routes that need a user call `requireAuth(allowedTypes?, req)` from `@/lib/api/auth.ts` and handle the `{ error }` branch. It already supports both web cookies and mobile Bearer tokens — don't reinvent it. Service-role/admin work uses `createAdminClient()` and only when genuinely cross-user.
- **Validate at the boundary.** Parse request bodies and form data with a Zod schema from `lib/validation/schemas.ts` (use the `new-zod-schema` skill to add one). Never trust client input shape.
- **Errors don't leak.** `try/catch` in every async route; log with a `console.error('[context]', error)` prefix; return `{ error: string }` with a sane status. Never return raw DB errors or stack traces.
- **Money is integer cents.** Never floats. The fixed prices and revenue splits in `CLAUDE.md` are law — never make them editable.
- **Hard stops are hardcoded.** Special-needs dependent and irrevocable trust halt generation → attorney referral. No override path, ever.
- **Migrations** go in `supabase/migrations/YYYYMMDD_description.sql` with RLS enabled on every user-data table. Match the newest existing migration's style, not the old root-level doc.
- **Components**: one per file in `/components`, `[Name]Props` interface, Tailwind only (brand: navy `#1C3557`, gold `#C9A84C`, charcoal `#2D2D2D`, Inter), loading + error + success states on anything async. Voice: protection, never "death."

The narrow scaffolding skills (`new-api-route`, `new-db-helper`, `new-component`, `new-migration`, `new-zod-schema`) are fine starting templates — but reconcile their output against the neighbor files before finalizing, because some templates are stale.

### Write code that is easy to delete, not just easy to add
Small functions, one responsibility each. Name things for what they do. A comment explains *why*, not *what*. If you're copy-pasting a block a third time, extract it. Leave the file at least as consistent as you found it.

---

## Verify (always last — this is the bug gate)

"Done" means *verified*, not *written*. The whole point of this skill is that code stops breaking, so do not report success until the checks pass. Run them scoped to what you touched, then report results honestly — if something fails, say so with the output.

```bash
npx tsc --noEmit        # type errors across the project (strict). Must be clean.
npm run lint            # next lint on changed files
npm test                # vitest run — run if you touched anything under test, or crypto/repos/lib logic
```

Rules for the gate:
- **Typecheck must be green.** A red `tsc` is a bug you are shipping. Fix it; do not suppress it with `any` or `@ts-ignore`.
- If lint flags real issues in your code, fix them. Pre-existing unrelated warnings elsewhere aren't yours to chase — note them, move on.
- If you changed behavior covered by tests, run them. If you added non-trivial logic (a repo function, a calc, a guard), add or extend a test — there's a `vitest` + `@testing-library` setup already.
- If you genuinely can't run a check (e.g. needs live secrets), say which one and why, and tell the user the exact command to run themselves.

Then give a tight summary: what changed, which files, what you verified (with the actual result), and anything still risky.

---

## When the request is "it keeps breaking" / "this is messy"

That's Refactor/Audit mode — read `references/refactor-playbook.md`. Short version: don't start rewriting. First map the area and find *why* it's fragile (duplicated logic, drifted patterns, missing types, untested seams), report the findings ranked by risk, then fix in small verified steps with the user's go-ahead on scope. Resist the urge to rewrite everything at once — that's how working things break.
