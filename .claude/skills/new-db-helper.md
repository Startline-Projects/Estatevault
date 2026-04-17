---
name: new-db-helper
description: Scaffold a typed database query helper in /lib/db/ for EstateVault. Use this whenever adding reusable Supabase queries so API routes stay thin.
---

Scaffold a new typed database helper file under `/lib/db/[name].ts` for EstateVault.

## Why this pattern exists
API routes should contain minimal DB logic. Reusable queries live in `/lib/db/` so they can be shared across routes and tested in isolation.

## Output
Create a file at `/lib/db/[name].ts`.

Note: `/lib/db/` may not exist yet — create the directory by creating the file at the full path.

## Two client patterns — pick the right one

**Server component / API route (user-scoped, respects RLS):**
```ts
import { createClient } from '@/lib/supabase/server'
```

**Background job / admin helper (service-role, bypasses RLS):**
```ts
import { createServerClient } from '@supabase/ssr'
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

## Template (user-scoped example)

```ts
import { createClient } from '@/lib/supabase/server'

// ── Types ────────────────────────────────────────────────────────────────────

export interface [EntityName] {
  id: string
  // columns from the DB table
  created_at: string
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function get[EntityName]ById(id: string): Promise<[EntityName] | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('[table_name]')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[get[EntityName]ById]', error)
    return null
  }
  return data
}

export async function list[EntityName]sByUser(userId: string): Promise<[EntityName][]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('[table_name]')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[list[EntityName]sByUser]', error)
    return []
  }
  return data ?? []
}

export async function create[EntityName](
  payload: Omit<[EntityName], 'id' | 'created_at'>
): Promise<[EntityName] | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('[table_name]')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('[create[EntityName]]', error)
    return null
  }
  return data
}
```

## Rules
- Every function has an explicit return type — no implicit `any`
- Errors logged with `console.error('[functionName]', error)` — never thrown (callers check for null/empty)
- Return `null` on single-row failures, `[]` on list failures — never throw from helpers
- Column names stay snake_case to match Postgres
- Financial values are integers (cents) — add a comment if a column stores money
- Vault/credential columns noted with `// encrypted at application layer`
- Never build SQL with string concatenation — always use Supabase query builder

## Ask the user if not provided
- Helper file name (e.g. `orders`, `clients`, `vault-items`)
- Which table(s) it queries
- Which operations are needed (get by id / list by user / create / update / delete)
- Is it user-scoped (RLS) or admin/service-role?
- Any notable columns (money, encrypted data, foreign keys)?
