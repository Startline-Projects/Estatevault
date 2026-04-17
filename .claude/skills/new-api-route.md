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

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  // typed fields here
}

interface ResponseBody {
  // typed fields here
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = createClient()

    // Auth check — always getUser(), never getSession()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: RequestBody = await request.json()

    // TODO: validate body fields

    // TODO: business logic

    return NextResponse.json({ /* response */ } satisfies ResponseBody)
  } catch (error) {
    console.error('[route-name]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## Rules
- Use `createClient` from `@/lib/supabase/server` — never `createRouteHandlerClient` (deprecated)
- Auth check uses `getUser()` — never `getSession()` (getSession is not secure server-side)
- Admin client only for: Stripe webhooks, background jobs, cross-user admin operations
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
