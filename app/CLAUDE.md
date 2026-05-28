# Frontend Rules — /app

## Code Quality
- TypeScript strict mode — no `any` types
- Every component in its own file under `/components`
- Pages in `/app` (App Router) · API routes in `/app/api` · DB queries in `/lib/repos/*Repo.ts`
- All forms: loading states + error handling + client-side validation
- Mobile-first responsive on every page

## Architecture (current)
- Routes use `withRoute()` error wrapper from `lib/api/route.ts`
- Auth via `requireAuth()` from `lib/api/auth.ts`
- Responses via `ok()` / `fail()` from `lib/api/response.ts`
- DB access only through `lib/repos/server/*Repo.ts`
- Validation via Zod schemas in `lib/validation/schemas.ts`
- Pricing SSOT in `lib/orders/pricing.ts`
- Client-side API calls via `lib/api-client/` (typed wrappers over `authedFetch`)

## Vault Feature
Encrypted vault per client: estate docs, insurance, financial accounts (masked), digital credentials, physical locations, contacts, final wishes.
- PIN separate from account password
- Trustee: 1–2 people, 72h review + identity verification before access
