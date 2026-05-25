# EstateVault — Verified Conventions Map

The current, real way this codebase works, derived from the actual files (not the older scaffolding docs). Read this at the start of a Build task. **Still a hint, not gospel:** if a neighbor file disagrees, the neighbor wins and this doc should be updated.

## Contents
- [Layering](#layering)
- [API routes](#api-routes)
- [Auth](#auth)
- [Repos (database access)](#repos-database-access)
- [Validation](#validation)
- [Migrations](#migrations)
- [Components & pages](#components--pages)
- [Naming](#naming)
- [Money, pricing, hard stops](#money-pricing-hard-stops)
- [Commands](#commands)
- [Known doc drift](#known-doc-drift)

---

## Layering

```
app/                  pages, layouts (App Router) — UI only
app/api/<name>/route.ts   HTTP handlers — thin: auth → validate → call lib/repo → respond
components/           one React component per file
lib/repos/*Repo.ts    all database access lives here
lib/api/             route helpers (auth, crypto, dek)
lib/validation/schemas.ts   Zod schemas for input validation
lib/<domain>/        business logic by domain (documents, orders, crypto, notifications, …)
supabase/migrations/ SQL migrations
hooks/               React hooks
```

Rule of thumb: a route should read top-to-bottom in a few lines. If a route has a big block of `supabase.from(...)` chains or business rules, that logic belongs in `lib/repos/` or `lib/<domain>/`.

## API routes

File: `app/api/<kebab-name>/route.ts`. Export named handlers (`GET`, `POST`, …) with explicit `Promise<NextResponse>` return type.

Real shape (from `lib/api/auth.ts` usage across `app/api/vault/*`):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { someSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(["client"], req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const parsed = someSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid input" }, { status: 400 });
    }

    // call a repo / lib function with parsed.data and user.id
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[vault/whatever]", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
```

- Take `req: NextRequest` and pass it to `requireAuth` so Bearer-token (mobile) auth works, not just cookies.
- Return typed `{ error: string }` on failure; never leak DB errors or stack traces.
- `console.error("[route-context]", error)` prefix for log filtering.

## Auth

`lib/api/auth.ts` is the single source. Use it; don't hand-roll `getUser()` in routes.

- `requireAuth(allowed?: UserType[], req?: NextRequest)` → returns `{ user, profile, admin }` or `{ error: NextResponse }`. Always handle the `"error" in auth` branch first.
- It checks `Authorization: Bearer <token>` first (mobile), then the Supabase session cookie (web). Profiles are read with the admin client.
- `UserType = "client" | "partner" | "sales_rep" | "admin" | "attorney"`. Pass the allowed list to gate by role.
- `createAdminClient()` (service role, bypasses RLS) — only for genuine cross-user / webhook / background work. Never use it just to skip writing an RLS policy.
- Cookie/session note: `signOut({ scope: "local" })` still kills the *current* session — don't pre-signout before a token handoff.

## Repos (database access)

Location: `lib/repos/<entity>Repo.ts` (e.g. `vaultRepo.ts`, `documentRepo.ts`, `trusteeRepo.ts`). This is the real home for queries — **there is no `/lib/db`** despite what `new-db-helper.md` says.

- Each exported function has an explicit return type.
- Note whether a repo runs client-side (some, like `vaultRepo.ts`, are `"use client"` and call `/api/...` via `fetch`) or server-side (calls Supabase directly). Match the neighbor: a server repo and a client repo look different.
- Server-side repos: log errors with `console.error("[fnName]", error)`; return `null` for missing single rows, `[]` for empty lists — callers null-check rather than catch.
- Column names stay `snake_case` to match Postgres; map to camelCase at the boundary if the neighbor does.
- Never build SQL by string concat — Supabase query builder only.

## Validation

All Zod schemas live in `lib/validation/schemas.ts` (one file, appended to). Use the `new-zod-schema` skill to add one. Naming: `featureSchema` (camelCase const) + `Feature` (PascalCase inferred type via `z.infer`). Money fields = integer cents with a `// stored in cents` comment. Acknowledgment checkboxes go last and `.refine(v => v === true)`.

## Migrations

Location: `supabase/migrations/YYYYMMDD_description.sql` (e.g. `20260524_option_a_dek.sql`). **Not** root-level `migration-*.sql`.

- Enable RLS on every table holding user data; scope by `user_id` referencing `auth.users(id)`.
- Match the newest migration's style for triggers/indexes/policies.
- Money columns are integers (cents). Application-encrypted columns get a comment saying so.

## Components & pages

- One component per file in `/components`, PascalCase filename, `[Name]Props` interface, default export.
- Tailwind utility classes only — no inline styles. Brand: navy `#1C3557`, gold `#C9A84C`, white `#FFFFFF`, charcoal `#2D2D2D`, font Inter.
- Mobile-first: base classes for phone, `md:` tablet, `lg:` desktop.
- Anything async needs loading + error + success states.
- No prop drilling past ~2 levels — lift state or use context.
- Voice: warm, protective. Never the word "death" — use "passing" / "when you're gone".

## Naming

| Thing | Style | Example |
|---|---|---|
| Component file | PascalCase | `HeroSection.tsx` |
| Hook / util | camelCase | `useVaultPin.ts` |
| API route folder | kebab-case | `app/api/download-url/` |
| Repo file | camelCase + `Repo` | `vaultRepo.ts` |
| DB columns | snake_case | `created_at` |
| Zod schema / type | `xSchema` / `X` | `pinSchema` / `Pin` |

## Money, pricing, hard stops

From `CLAUDE.md` — non-negotiable, never make editable:
- Will $400 · Trust $600 · Attorney review add-on $300 (100% to attorney) · Amendment $50.
- Splits: standard $300/will, $400/trust; enterprise $350/will, $450/trust.
- Platform never gives legal advice; quiz says "Based on your answers…", never "We recommend…".
- Hard stops (special-needs dependent, irrevocable trust) halt generation → attorney referral. Hardcoded, no override.
- Client signs acknowledgment before any document generates.
- All money in integer cents end to end.

## Commands

```bash
npx tsc --noEmit     # strict typecheck (excludes scripts/ and supabase/functions/)
npm run lint         # next lint
npm test             # vitest run
npm run test:watch   # vitest watch
npm run test:e2e     # playwright
npm run dev          # local dev server
```

Path alias: `@/*` → project root (e.g. `@/lib/api/auth`).

## Known doc drift

These older skill docs are partly stale. Prefer real code; fixing the docs is welcome.
- `new-db-helper.md`: says `/lib/db` → reality `lib/repos/*Repo.ts`.
- `new-api-route.md`: shows raw `getUser()` → reality `requireAuth()` from `lib/api/auth.ts`.
- `new-migration.md`: says root `migration-*.sql` → reality `supabase/migrations/YYYYMMDD_*.sql`.
- `code-style.md`: says queries in `/lib/db` → reality `lib/repos/`.
