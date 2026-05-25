---
name: new-api-route
description: Scaffold a Next.js App Router API route with Supabase auth, typed request/response, error handling, and correct client pattern.
---

Scaffold a new Next.js App Router API route for EstateVault based on the endpoint the user describes.

## Output
Create a file at `/app/api/[route-name]/route.ts`.

## Two Supabase client patterns — pick the right one

**User-scoped (most routes):** reads session from cookies, respects RLS
```ts
import { createClient } from '@/lib/supabase/server'
const supabase = createClient()
```

**Admin/service-role (webhooks, background jobs, cross-user ops):** bypasses RLS — use only when necessary
```ts
import { createServerClient } from '@supabase/ssr'
function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

## Standard user-auth route template

Current canonical auth is `requireAuth()` from `@/lib/api/auth.ts` — it handles both web session cookies and mobile `Bearer` tokens, plus role gating. Use it instead of calling `getUser()` directly. Read a neighbor route under `app/api/vault/` to confirm the live shape.

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { someSchema } from '@/lib/validation/schemas'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(['client'], req) // pass req so Bearer auth works
    if ('error' in auth) return auth.error
    const { user } = auth

    const parsed = someSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid input' }, { status: 400 })
    }

    // business logic — call a repo from /lib/repos with parsed.data and user.id

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[route-name]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## Rules
- Auth via `requireAuth(allowed?, req)` from `@/lib/api/auth.ts` — handle the `'error' in auth` branch first; pass `req` so mobile Bearer tokens work
- Never `getSession()` server-side (not secure); never `createRouteHandlerClient` (deprecated)
- Admin/service-role only via `createAdminClient()` from `@/lib/api/auth.ts`, and only for: Stripe webhooks, background jobs, cross-user admin operations
- Explicit `Promise<NextResponse>` return type on every handler
- Return typed `{ error: string }` on failure — never expose raw DB errors or stack traces
- Log errors with `console.error('[route-name]', error)` prefix for easy log filtering
- No `any` types

## Ask the user if not provided
- Route name (becomes the folder name under `/app/api/`)
- HTTP method(s) needed (GET / POST / PUT / DELETE)
- What the route does (one sentence)
- Does it require user auth, admin/service-role, or no auth (e.g. webhook)?
- What tables does it read/write?
