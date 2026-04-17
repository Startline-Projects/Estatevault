# EstateVault — Code Style

Apply these rules to all code written in this project.

## TypeScript
- Strict mode — zero `any` types, ever
- Prefer `interface` over `type` for object shapes
- Name all props interfaces `[Component]Props`
- Explicit return types on all API route handlers and async functions

## File & Folder Structure
- One component per file under `/components`
- Pages and layouts only in `/app` (Next.js App Router)
- API routes in `/app/api/[route-name]/route.ts`
- All database queries in `/lib/db`
- Shared utilities in `/lib`

## Naming Conventions
- Components: PascalCase → `HeroSection.tsx`
- Hooks & utilities: camelCase → `useVaultPin.ts`
- API route folders: kebab-case → `/app/api/create-will/route.ts`
- Database helpers: snake_case to match Postgres column names

## Components
- Every form must have: loading state, error state, success feedback
- No inline styles — Tailwind utility classes only
- Mobile-first: base = mobile, `md:` = tablet, `lg:` = desktop
- No prop drilling beyond 2 levels — use context or lift state

## Error Handling
- All `async` functions use try/catch
- API routes always return `{ error: string }` on failure
- Never expose raw error stack traces or DB errors to the client

## Security
- All secrets via environment variables — zero hardcoded values
- Supabase queries always parameterized — never string-concatenated SQL
- Sanitize any value rendered as HTML
- Validate all user input at the API boundary
